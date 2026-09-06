import { CombatEvent, CombatEventType } from '../../../models/Combat';
import { CombatFXEngine, ScreenPoint } from '../CombatFXEngine';
import { VFXImpactConfig, VFXImpactCue } from '../../../models/VFX';
import { VFXPresetRepository } from '../VFXPresetRepository';
import { mapImpactsToCues, CombatImpactPresentation, CombatAction, CombatActionPlayer } from '../CombatActionPlayer';


/**
 * ⚔️ CombatStudioStageAdapter
 * 負責將戰鬥平衡工坊 (Combat Studio) 的 3x3 擂台棋盤與 VFXPlayer (CombatFXEngine) 橋接
 * 實現 Action/Impact/Cue/Target 在演播室雙向棋盤中的精準視覺演出與打擊反饋
 */
export class CombatStudioStageAdapter {
  private static instance: CombatStudioStageAdapter | null = null;

  private container: HTMLElement | null = null;
  private vfxEnabled: boolean = true;
  private resizeObserver: ResizeObserver | null = null;
  private activeTimers = new Set<ReturnType<typeof setTimeout>>();
  private playSpeed: number = 1.0;
  private actionPlayer: CombatActionPlayer = new CombatActionPlayer();

  private constructor() {}

  public static getInstance(): CombatStudioStageAdapter {
    if (!CombatStudioStageAdapter.instance) {
      CombatStudioStageAdapter.instance = new CombatStudioStageAdapter();
    }
    return CombatStudioStageAdapter.instance;
  }

  /**
   * 🏗️ 掛載至戰鬥擂台容器
   */
  public mount(arenaContainer: HTMLElement): void {
    if (this.container === arenaContainer) return;
    this.container = arenaContainer;
    arenaContainer.style.position = 'relative';

    const fxEngine = CombatFXEngine.getInstance();
    fxEngine.mount(arenaContainer);

    if (typeof ResizeObserver !== 'undefined') {
      if (this.resizeObserver) this.resizeObserver.disconnect();
      this.resizeObserver = new ResizeObserver(() => {
        fxEngine.resize();
      });
      this.resizeObserver.observe(arenaContainer);
    }
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

  public setSpeed(speed: number): void {
    CombatFXEngine.getInstance().setPlaybackSpeed(speed);
  }

  /**
   * 🧹 清空當前所有特效、定時器與 DOM 動畫
   */
  public clear(): void {
    this.activeTimers.forEach(t => clearTimeout(t));
    this.activeTimers.clear();

    CombatFXEngine.getInstance().clear();

    if (this.container) {
      const hits = this.container.querySelectorAll('.target-hit, .cs-hit-shake, .attack-bump-player, .attack-bump-enemy');
      hits.forEach(el => {
        el.classList.remove('target-hit', 'cs-hit-shake', 'attack-bump-player', 'attack-bump-enemy');
      });

      const floatings = this.container.querySelectorAll('.floating-dmg');
      floatings.forEach(el => el.remove());
    }
  }

  /**
   * 🎯 尋找卡牌 DOM 元素
   */
  public findCardElement(unitId: string | undefined): HTMLElement | null {
    if (!unitId || !this.container) return null;

    // 1. 直譯 arena_${id}
    let el = this.container.querySelector(`#arena_${unitId}`) as HTMLElement | null;
    if (el) return el;

    // 2. 清理 adv_123_p1 格式中的前綴
    const cleanId = unitId.replace(/^adv_\d+_/, '');
    el = this.container.querySelector(`#arena_${cleanId}`) as HTMLElement | null;
    if (el) return el;

    // 3. 搜尋帶有 data-unit-id 或 id 包含 unitId 的卡片
    el = this.container.querySelector(`[id*="${unitId}"]`) as HTMLElement | null;
    if (el) return el;

    return null;
  }

  /**
   * 📍 取得卡牌相對容器的中心點座標
   */
  public getUnitPoint(unitId: string | undefined, fallbackSide: 'player' | 'enemy' = 'player'): ScreenPoint {
    const defaultWidth = this.container?.clientWidth || 800;
    const defaultHeight = this.container?.clientHeight || 450;

    const fallback: ScreenPoint = fallbackSide === 'player'
      ? { x: defaultWidth * 0.25, y: defaultHeight * 0.5 }
      : { x: defaultWidth * 0.75, y: defaultHeight * 0.5 };

    if (!unitId || !this.container) return fallback;

    const el = this.findCardElement(unitId);
    if (!el) return fallback;

    const cRect = this.container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    return {
      x: elRect.left - cRect.left + elRect.width / 2,
      y: elRect.top - cRect.top + elRect.height / 2
    };
  }

  /**
   * 🎬 播放完整的 CombatAction (Single Action SSOT Pipeline)
   * 保證一個 Action 僅調用一次 3D VFX，多段打擊依 Cue 精確呈現
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

    // 優先尋找主目標 ID
    const firstTargetEv = action.events.find(e => e.targetId);
    const mainTargetId = firstTargetEv?.targetId || action.actorId;
    const defaultTargetEl = this.findCardElement(mainTargetId);

    const fromPt = this.getUnitPoint(action.actorId, isAttackerPlayer ? 'player' : 'enemy');
    const toPt = this.getUnitPoint(mainTargetId, isAttackerPlayer ? 'enemy' : 'player');

    // 攻擊者微幅突進動畫 (非略過模式)
    if (!skip && attackerEl) {
      const isAttackerEnemy = attackerEl.classList.contains('enemy-side');
      const bumpClass = isAttackerEnemy ? 'attack-bump-enemy' : 'attack-bump-player';
      attackerEl.classList.remove(bumpClass);
      void attackerEl.offsetWidth;
      attackerEl.classList.add(bumpClass);
      const timer = setTimeout(() => {
        attackerEl.classList.remove(bumpClass);
        this.activeTimers.delete(timer);
      }, 250);
      this.activeTimers.add(timer);
    }

    // 決定 action 的 vfxId
    let vfxId = action.vfxId;
    if (!vfxId) {
      for (const ev of action.events) {
        vfxId = this.resolveVfxId(ev);
        if (vfxId) break;
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
   * 🎬 播放戰鬥事件特效演出
   */
  public async playEventAction(
    ev: CombatEvent,
    options?: {
      skipVfx?: boolean;
      onImpact?: (impact: VFXImpactConfig, hitIdx: number, totalHits: number, cue?: VFXImpactCue) => void;
    }
  ): Promise<void> {
    const action: CombatAction = {
      actionId: ev.actionId || `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      actorId: ev.actorId || '',
      skillId: ev.skillId,
      vfxId: this.resolveVfxId(ev),
      events: [ev]
    };

    let hitCount = 0;
    await this.playCombatAction(action, {
      skipVfx: options?.skipVfx,
      onImpact: (_item, cue) => {
        const preset = VFXPresetRepository.getInstance().getPreset(action.vfxId || '');
        const impactCfg = preset?.impact || ({} as VFXImpactConfig);
        options?.onImpact?.(impactCfg, hitCount++, 1, cue);
      }
    });
  }

  /**
   * 🥊 觸發受擊物理擠壓、抖動、閃光與漂浮跳字
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
    } else {
      // 簡易震動
      targetEl.classList.remove('cs-hit-shake');
      void targetEl.offsetWidth;
      targetEl.classList.add('cs-hit-shake');
    }

    // 2. 漂浮跳字（分段跳字或單段結算，直接讀取已配對之 amount，禁止現場二度計算）
    this.spawnFloatingNumber(targetEl, ev, isLastHit, cue, presentationItem);
  }

  /**
   * 💬 產生漂浮傷害／治療跳字
   */
  private spawnFloatingNumber(
    targetEl: HTMLElement,
    ev: CombatEvent,
    isLastHit: boolean,
    cue?: VFXImpactCue,
    presentationItem?: CombatImpactPresentation
  ): void {
    // 依事件類型判斷
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
      const healAmt = presentationItem ? presentationItem.amount : (ev.damage || 0);
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

    // 傷害數值呈現：若為 PRIMARY_ONLY 且當前為非 Primary Cue (amount === 0)，則純打擊不跳字
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

  /**
   * 🔍 解析事件所應套用之 VFX Preset ID
   */
  public resolveVfxId(ev: CombatEvent): string | undefined {
    let candidateId = ev.vfxId;

    if (!candidateId) {
      if (ev.type === CombatEventType.HIT || ev.type === CombatEventType.CRIT) {
        candidateId = 'VFX_DEFAULT_SLASH';
      } else if (ev.type === CombatEventType.HEAL) {
        candidateId = 'VFX_HOLY_LIGHT';
      }
    }

    if (!candidateId) return undefined;

    // 🛡️ 健全防禦校驗：確認 Preset 存在於 Repository 中，避免靜默報錯
    const preset = VFXPresetRepository.getInstance().getPreset(candidateId);
    if (!preset) {
      console.warn(`[CombatStudioStageAdapter] 特效預設不存在: "${candidateId}"，已降級為無 3D VFX 演出`);
      return undefined;
    }

    return candidateId;
  }
}
