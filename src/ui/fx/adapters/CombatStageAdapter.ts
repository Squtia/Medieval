import { CombatEvent, CombatEventType } from '../../../models/Combat';
import { CombatFXEngine, ScreenPoint } from '../CombatFXEngine';
import { VFXImpactConfig, VFXImpactCue, getSequenceImpactConfig } from '../../../models/VFX';
import { VFXPresetRepository } from '../VFXPresetRepository';
import { CombatAction, CombatActionPlayer, CombatImpactPresentation, resolveActionMainTargetId } from '../CombatActionPlayer';
import { ScreenFxRenderer } from '../renderers/ScreenFxRenderer';
import { TargetType } from '../../../models/Skill';
import { SkillRegistry } from '../../../systems/combat/SkillRegistry';
import { CombatAnchorResolver } from './CombatAnchorResolver';

/**
 * ⚔️ CombatStageAdapter
 * 負責將主遊戲戰鬥模態框 (CombatUIManager / #combat-modal) 與 3D VFXPlayer (CombatFXEngine) 橋接
 * 實現 Action/Impact/Cue/Target 在主遊戲實戰舞台的同源視覺演出與打擊感反饋
 */
export class CombatStageAdapter {
  private static instance: CombatStageAdapter | null = null;

  private modalContainer: HTMLElement | null = null;
  private vfxEnabled: boolean = true;
  private activeTimers = new Set<ReturnType<typeof setTimeout>>();
  private actionPlayer: CombatActionPlayer = new CombatActionPlayer();

  private constructor() {}

  public static getInstance(): CombatStageAdapter {
    if (!CombatStageAdapter.instance) {
      CombatStageAdapter.instance = new CombatStageAdapter();
    }
    return CombatStageAdapter.instance;
  }

  /**
   * 🏗️ 掛載主遊戲戰鬥模態框
   */
  public mount(modal: HTMLElement): void {
    this.modalContainer = modal;
    const fxEngine = CombatFXEngine.getInstance();
    fxEngine.mount(modal);
  }

  public setVfxEnabled(enabled: boolean): void {
    this.vfxEnabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  public isVfxEnabled(): boolean {
    return this.vfxEnabled;
  }

  /**
   * 🧹 清空當前所有特效、定時器與受擊樣式
   */
  public clear(): void {
    this.activeTimers.forEach(t => clearTimeout(t));
    this.activeTimers.clear();

    CombatFXEngine.getInstance().clear();

    if (this.modalContainer) {
      const hits = this.modalContainer.querySelectorAll('.target-hit, .attack-bump-player, .attack-bump-enemy, .skill-cast-glow');
      hits.forEach(el => {
        el.classList.remove('target-hit', 'attack-bump-player', 'attack-bump-enemy', 'skill-cast-glow');
      });

      const floatings = this.modalContainer.querySelectorAll('.floating-dmg');
      floatings.forEach(el => el.remove());
    }
  }

  /**
   * 🧹 冪等銷毀適配器實例
   */
  public destroy(): void {
    this.clear();
    this.modalContainer = null;
  }

  /**
   * 🎯 尋找主遊戲角色卡牌 DOM 元素
   */
  public findCardElement(unitId: string | undefined): HTMLElement | null {
    if (!unitId || !this.modalContainer) return null;

    // 1. 直譯 combat-p-${unitId}
    let el = this.modalContainer.querySelector(`#combat-p-${unitId}`) as HTMLElement | null;
    if (el) return el;

    // 2. 清理 adv_123_ 格式
    const cleanId = unitId.replace(/^adv_\d+_/, '');
    el = this.modalContainer.querySelector(`#combat-p-${cleanId}`) as HTMLElement | null;
    if (el) return el;

    // 3. 攻城門目標
    if (unitId === 'combat-siege-gate-hud' || unitId === 'siege_gate') {
      return this.modalContainer.querySelector('#combat-siege-gate-hud') as HTMLElement | null;
    }

    return null;
  }

  /**
   * 📍 取得卡牌相對模態框的中心點座標
   */
  public getUnitPoint(unitId: string | undefined, fallbackSide: 'player' | 'enemy' = 'player'): ScreenPoint {
    const defaultWidth = this.modalContainer?.clientWidth || 900;
    const defaultHeight = this.modalContainer?.clientHeight || 550;

    const fallback: ScreenPoint = fallbackSide === 'player'
      ? { x: defaultWidth * 0.25, y: defaultHeight * 0.5 }
      : { x: defaultWidth * 0.75, y: defaultHeight * 0.5 };

    if (!unitId || !this.modalContainer) return fallback;

    const el = this.findCardElement(unitId);
    if (!el) return fallback;

    const mRect = this.modalContainer.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    return {
      x: (elRect.left + elRect.right) / 2 - mRect.left,
      y: (elRect.top + elRect.bottom) / 2 - mRect.top
    };
  }

  /**
   * 🎯 依據技能目標範圍 (TargetType) 求解特效目標基準中心點 B (Fixed Geometric Target B)
   * 遵循使用者絕對準則：
   * 1. 目標中心 B 點是戰鬥棋盤 3x3 陣型上的絕對固定物理幾何點，與死活狀態 100% 解耦。
   * 2. 全體 (ALL_ENEMIES / ALL_ALLIES) ➔ 該陣型九宮格「中排中 (Row 2, Col 2)」正中心。
   * 3. 前排 (FRONT_ENEMIES) ➔ 該陣型「前排中 (Front Row Center)」正中心。
   * 4. 後排 (BACK_ENEMY) ➔ 該陣型「後排中 (Back Row Center)」正中心。
   * 5. 自身 (SELF) ➔ 施術者自身卡片中心。
   * 6. 單體 (SINGLE_ENEMY / ALLY_LOWEST_HP / 預設) ➔ 該指定目標卡片中心。
   */
  public resolveTargetAnchorPoint(
    targetType: TargetType | string | undefined,
    isAttackerPlayer: boolean,
    mainTargetId?: string,
    actorId?: string
  ): ScreenPoint {
    const isTargetingAllies =
      targetType === TargetType.ALL_ALLIES ||
      targetType === TargetType.ALLY_LOWEST_HP ||
      targetType === TargetType.ALLY_DEAD;

    const targetSide: 'player' | 'enemy' = isTargetingAllies
      ? (isAttackerPlayer ? 'player' : 'enemy')
      : (isAttackerPlayer ? 'enemy' : 'player');

    const teamContainerId = targetSide === 'player' ? '#combat-player-team' : '#combat-enemy-team';
    const teamEl = this.modalContainer?.querySelector(teamContainerId) as HTMLElement | null;

    return CombatAnchorResolver.resolveAnchor(
      targetType,
      isAttackerPlayer,
      this.modalContainer,
      teamEl,
      (unitId, side) => this.getUnitPoint(unitId, side),
      mainTargetId,
      actorId
    );
  }

  // 供外部調用或單元測試引用
  public static resolveMainTargetId = resolveActionMainTargetId;

  /**
   * 🎬 播放完整的 CombatAction (Single Action SSOT Pipeline)
   */
  public async playCombatAction(
    action: CombatAction,
    options?: {
      fromPoint?: ScreenPoint;
      toPoint?: ScreenPoint;
      targetId?: string;
      skipVfx?: boolean;
      onImpact?: (item: CombatImpactPresentation, cue?: VFXImpactCue) => void;
      onComplete?: () => void;
    }
  ): Promise<void> {
    const skip = !this.vfxEnabled || options?.skipVfx;

    const attackerEl = this.findCardElement(action.actorId);
    const isAttackerPlayer = attackerEl ? attackerEl.classList.contains('player-side') : true;

    // 尋找主目標（優先使用 options 傳入之 targetId，或呼叫嚴格目標解析器排除 SKILL_CAST 自身扣 MP）
    const mainTargetId = options?.targetId || resolveActionMainTargetId(action);
    const defaultTargetEl = this.findCardElement(mainTargetId);

    // 解析技能目標範圍 TargetType
    let skillTargetType: TargetType | undefined;
    if (action.skillId) {
      const skillDef = SkillRegistry.getSkill(action.skillId);
      if (skillDef) {
        skillTargetType = skillDef.targetType;
      }
    }

    const fromPt = options?.fromPoint || this.getUnitPoint(action.actorId, isAttackerPlayer ? 'player' : 'enemy');
    const toPt = options?.toPoint || this.resolveTargetAnchorPoint(skillTargetType, isAttackerPlayer, mainTargetId, action.actorId);

    // 施術者卡片微幅突進動畫 (僅在非 skip 模式)
    if (!skip && attackerEl) {
      attackerEl.classList.add('skill-cast-glow');
      const isPlayer = attackerEl.classList.contains('player-side');
      const bumpClass = isPlayer ? 'attack-bump-player' : 'attack-bump-enemy';
      attackerEl.classList.remove(bumpClass);
      void attackerEl.offsetWidth;
      attackerEl.classList.add(bumpClass);
      const timer = setTimeout(() => {
        attackerEl.classList.remove('skill-cast-glow', bumpClass);
        this.activeTimers.delete(timer);
      }, 280);
      this.activeTimers.add(timer);
    }

    // 決定 action 的 vfxId
    let vfxId = action.vfxId;
    if (!vfxId) {
      for (const ev of action.events) {
        if (ev.vfxId) {
          vfxId = ev.vfxId;
          break;
        }
      }
    }
    const finalAction: CombatAction = {
      ...action,
      vfxId: vfxId || 'VFX_DEFAULT_SLASH'
    };

    await this.actionPlayer.playAction(finalAction, {
      fromPoint: fromPt,
      toPoint: toPt,
      skipVfx: skip,
      resolveVisualPoint: (targetId) => this.getUnitPoint(
        targetId,
        targetId === action.actorId
          ? (isAttackerPlayer ? 'player' : 'enemy')
          : (isAttackerPlayer ? 'enemy' : 'player')
      ),
      onPresentImpact: (item: CombatImpactPresentation, cue?: VFXImpactCue) => {
        const targetEl = this.findCardElement(item.targetId) || defaultTargetEl;
        const dummyEv: CombatEvent = {
          type: item.kind === 'HEAL' ? CombatEventType.HEAL : (item.kind === 'SHIELD_DAMAGE' ? CombatEventType.SHIELD_DAMAGE : (item.kind === 'SHIELD_BREAK' ? CombatEventType.SHIELD_BREAK : (item.kind === 'STATUS' ? CombatEventType.STATUS_APPLY : (item.isCrit ? CombatEventType.CRIT : CombatEventType.HIT)))),
          actorId: action.actorId,
          targetId: item.targetId || mainTargetId,
          damage: item.kind === 'DAMAGE' ? item.amount : undefined,
          healAmount: item.kind === 'HEAL' ? item.amount : undefined,
          shieldDamage: (item.kind === 'SHIELD_DAMAGE' || item.kind === 'SHIELD_BREAK') ? item.amount : item.shieldDamage,
          targetHp: item.targetHp,
          targetMaxHp: item.targetMaxHp,
          text: item.text || '',
          skillName: item.skillName
        };

        const seq = VFXPresetRepository.getInstance().getSequence(finalAction.vfxId || '');
        const impactCfg = seq ? (getSequenceImpactConfig(seq) || null) : null;

        this.triggerHitFeedback(
          targetEl,
          dummyEv,
          impactCfg,
          item.presentationIndex ?? item.cueIndex,
          item.presentationCount ?? 1,
          cue,
          item
        );

        options?.onImpact?.(item, cue);
      },
      onActionComplete: () => {
        options?.onComplete?.();
      }
    });
  }

  /**
   * 🥊 觸發受擊擠壓、震屏與跳字
   */
  public triggerHitFeedback(
    targetEl: HTMLElement | null,
    ev: CombatEvent,
    impact: VFXImpactConfig | null,
    hitIdx: number = 0,
    totalHits: number = 1,
    cue?: VFXImpactCue,
    presentationItem?: CombatImpactPresentation
  ): void {
    if (!targetEl) return;

    const isLastHit = hitIdx >= totalHits - 1;
    const isTargetEnemy = targetEl.classList.contains('enemy-side');
    const knockDir = isTargetEnemy ? 1 : -1;

    // 1. 卡牌定格擠壓與受擊抖動 (委派 ScreenFxRenderer)
    if (impact) {
      ScreenFxRenderer.applyTargetShake(targetEl, impact, isLastHit && presentationItem?.kind !== 'VISUAL_ONLY', knockDir);
    }

    // 2. 產生跳字 (依據 impact 種類嚴格分流)
    this.spawnFloatingNumber(targetEl, ev, presentationItem);
  }

  /**
   * 💬 產生漂浮傷害／治療／護盾／狀態跳字
   */
  private spawnFloatingNumber(
    targetEl: HTMLElement,
    ev: CombatEvent,
    presentationItem?: CombatImpactPresentation
  ): void {
    if (typeof document === 'undefined') return;

    // 0. VISUAL_ONLY: 絕不產生數值跳字，杜絕 -0 幽靈打擊
    if (presentationItem?.kind === 'VISUAL_ONLY') {
      return;
    }

    // 1. MISS
    if (ev.type === CombatEventType.MISS || presentationItem?.kind === 'MISS') {
      const missEl = document.createElement('div');
      missEl.className = 'floating-dmg floating-miss';
      missEl.style.color = '#94a3b8';
      missEl.textContent = 'MISS';
      targetEl.appendChild(missEl);
      const timer = setTimeout(() => {
        if (missEl.parentNode) missEl.remove();
        this.activeTimers.delete(timer);
      }, 1300);
      this.activeTimers.add(timer);
      return;
    }

    // 2. HEAL
    if (ev.type === CombatEventType.HEAL || presentationItem?.kind === 'HEAL') {
      const healAmt = presentationItem ? presentationItem.amount : (ev.healAmount || 0);
      if (healAmt > 0) {
        const healEl = document.createElement('div');
        healEl.className = 'floating-dmg floating-heal';
        healEl.style.color = '#4ade80';
        healEl.textContent = `💚 +${healAmt}`;
        targetEl.appendChild(healEl);
        const timer = setTimeout(() => {
          if (healEl.parentNode) healEl.remove();
          this.activeTimers.delete(timer);
        }, 1300);
        this.activeTimers.add(timer);
      }
      return;
    }

    // 3. SHIELD_BREAK
    if (ev.type === CombatEventType.SHIELD_BREAK || presentationItem?.kind === 'SHIELD_BREAK') {
      const breakEl = document.createElement('div');
      breakEl.className = 'floating-dmg floating-shield-break';
      breakEl.style.color = '#f97316';
      breakEl.style.fontWeight = 'bold';
      breakEl.textContent = '🛡️ 破盾！';
      targetEl.appendChild(breakEl);
      const timer = setTimeout(() => {
        if (breakEl.parentNode) breakEl.remove();
        this.activeTimers.delete(timer);
      }, 1300);
      this.activeTimers.add(timer);
      return;
    }

    // 4. SHIELD_DAMAGE
    if (ev.type === CombatEventType.SHIELD_DAMAGE || presentationItem?.kind === 'SHIELD_DAMAGE') {
      const sDamage = presentationItem ? (presentationItem.shieldDamage ?? presentationItem.amount) : (ev.shieldDamage ?? ev.damage ?? 0);
      if (sDamage > 0) {
        const shieldEl = document.createElement('div');
        shieldEl.className = 'floating-dmg floating-shield-dmg';
        shieldEl.style.color = '#38bdf8';
        shieldEl.textContent = `🛡️ -${sDamage}`;
        targetEl.appendChild(shieldEl);
        const timer = setTimeout(() => {
          if (shieldEl.parentNode) shieldEl.remove();
          this.activeTimers.delete(timer);
        }, 1300);
        this.activeTimers.add(timer);
      }
      return;
    }

    // 5. STATUS
    if (presentationItem?.kind === 'STATUS') {
      const statusEl = document.createElement('div');
      statusEl.className = 'floating-dmg floating-status';
      statusEl.style.color = '#a855f7';
      statusEl.textContent = presentationItem?.text || ev.text || (presentationItem?.statusType ? `✨ ${presentationItem.statusType}` : '✨ 狀態觸發');
      targetEl.appendChild(statusEl);
      const timer = setTimeout(() => {
        if (statusEl.parentNode) statusEl.remove();
        this.activeTimers.delete(timer);
      }, 1300);
      this.activeTimers.add(timer);
      return;
    }

    // 6. 普通 HP DAMAGE
    const finalDamage = presentationItem ? presentationItem.amount : ev.damage;
    if (finalDamage !== undefined && finalDamage > 0) {
      const isCrit = presentationItem ? presentationItem.isCrit : (ev.type === CombatEventType.CRIT);

      const dmgEl = document.createElement('div');
      dmgEl.className = `floating-dmg ${isCrit ? 'crit' : ''}`;
      dmgEl.textContent = `${isCrit ? '💥 ' : ''}-${finalDamage}`;

      targetEl.appendChild(dmgEl);
      const timer = setTimeout(() => {
        if (dmgEl.parentNode) dmgEl.remove();
        this.activeTimers.delete(timer);
      }, 1300);
      this.activeTimers.add(timer);
    }
  }
}
