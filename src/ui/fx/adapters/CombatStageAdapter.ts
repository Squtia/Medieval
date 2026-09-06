import { CombatEvent, CombatEventType } from '../../../models/Combat';
import { CombatFXEngine, ScreenPoint } from '../CombatFXEngine';
import { VFXImpactConfig, VFXImpactCue } from '../../../models/VFX';
import { VFXPresetRepository } from '../VFXPresetRepository';
import { CombatAction, CombatActionPlayer, CombatImpactPresentation } from '../CombatActionPlayer';

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
   * 🎬 播放完整的 CombatAction (Single Action SSOT Pipeline)
   */
  public async playCombatAction(
    action: CombatAction,
    options?: {
      skipVfx?: boolean;
      onImpact?: (item: CombatImpactPresentation, cue?: VFXImpactCue) => void;
      onComplete?: () => void;
    }
  ): Promise<void> {
    const skip = !this.vfxEnabled || options?.skipVfx;

    const attackerEl = this.findCardElement(action.actorId);
    const isAttackerPlayer = attackerEl ? attackerEl.classList.contains('player-side') : true;

    // 尋找目標
    const firstTargetEv = action.events.find(e => e.targetId);
    const mainTargetId = firstTargetEv?.targetId || action.actorId;
    const defaultTargetEl = this.findCardElement(mainTargetId);

    const fromPt = this.getUnitPoint(action.actorId, isAttackerPlayer ? 'player' : 'enemy');
    const toPt = this.getUnitPoint(mainTargetId, isAttackerPlayer ? 'enemy' : 'player');

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
      onPresentImpact: (item: CombatImpactPresentation, cue?: VFXImpactCue) => {
        const targetEl = this.findCardElement(item.targetId) || defaultTargetEl;
        const dummyEv: CombatEvent = {
          type: item.kind === 'HEAL' ? CombatEventType.HEAL : (item.isCrit ? CombatEventType.CRIT : CombatEventType.HIT),
          actorId: action.actorId,
          targetId: item.targetId || mainTargetId,
          damage: item.amount,
          healAmount: item.kind === 'HEAL' ? item.amount : undefined,
          targetHp: item.targetHp,
          targetMaxHp: item.targetMaxHp,
          text: ''
        };

        const preset = VFXPresetRepository.getInstance().getPreset(finalAction.vfxId || '');
        const impactCfg = preset?.impact || null;

        this.triggerHitFeedback(targetEl, dummyEv, impactCfg, item.cueIndex, 1, cue, item);
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

    // 1. 卡牌定格擠壓與受擊抖動
    if (impact) {
      const knockDist = isLastHit ? ((impact.knockbackDistance || 0) * knockDir) : 0;
      const shakeX = isLastHit ? (impact.shakeIntensity || 12) : Math.max(4, Math.round((impact.shakeIntensity || 12) * 0.45));
      const shakeY = Math.round(shakeX * 0.35);
      const shakeDur = isLastHit ? (impact.shakeDuration || 0.28) : 0.16;
      const punchScale = isLastHit ? (impact.targetPunchScale || 0.88) : 0.95;

      targetEl.style.setProperty('--punch-scale', punchScale.toString());
      targetEl.style.setProperty('--shake-x', `${shakeX}px`);
      targetEl.style.setProperty('--shake-y', `${shakeY}px`);
      targetEl.style.setProperty('--shake-dur', `${shakeDur}s`);
      targetEl.style.setProperty('--flash-color', impact.hitFlashColor || '#ffffff');
      targetEl.style.setProperty('--knockback-x', `${knockDist}px`);

      targetEl.classList.remove('target-hit');
      void targetEl.offsetWidth;
      targetEl.classList.add('target-hit');

      const timer = setTimeout(() => {
        targetEl.classList.remove('target-hit');
        this.activeTimers.delete(timer);
      }, shakeDur * 1000);
      this.activeTimers.add(timer);
    }

    // 2. 產生跳字
    this.spawnFloatingNumber(targetEl, ev, presentationItem);
  }

  /**
   * 💬 產生漂浮傷害／治療跳字
   */
  private spawnFloatingNumber(
    targetEl: HTMLElement,
    ev: CombatEvent,
    presentationItem?: CombatImpactPresentation
  ): void {
    if (ev.type === CombatEventType.MISS || presentationItem?.kind === 'MISS') {
      const missEl = document.createElement('div');
      missEl.className = 'floating-dmg';
      missEl.style.color = '#94a3b8';
      missEl.textContent = 'MISS';
      targetEl.appendChild(missEl);
      const timer = setTimeout(() => {
        if (missEl.parentNode) missEl.remove();
        this.activeTimers.delete(timer);
      }, 800);
      this.activeTimers.add(timer);
      return;
    }

    if (ev.type === CombatEventType.HEAL || presentationItem?.kind === 'HEAL') {
      const healAmt = presentationItem ? presentationItem.amount : (ev.healAmount || 0);
      if (healAmt > 0) {
        const healEl = document.createElement('div');
        healEl.className = 'floating-dmg';
        healEl.style.color = '#4ade80';
        healEl.textContent = `💚 +${healAmt}`;
        targetEl.appendChild(healEl);
        const timer = setTimeout(() => {
          if (healEl.parentNode) healEl.remove();
          this.activeTimers.delete(timer);
        }, 800);
        this.activeTimers.add(timer);
      }
      return;
    }

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
      }, 800);
      this.activeTimers.add(timer);
    }
  }
}
