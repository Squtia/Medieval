import { CombatEvent, CombatEventType } from '../../../models/Combat';
import { CombatFXEngine, ScreenPoint } from '../CombatFXEngine';
import { VFXImpactConfig, VFXImpactCue } from '../../../models/VFX';
import { VFXPresetRepository } from '../VFXPresetRepository';
import { mapImpactsToCues, CombatImpactPresentation } from '../CombatActionPlayer';


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
   * 🎬 播放戰鬥事件特效演出
   */
  public async playEventAction(
    ev: CombatEvent,
    options?: {
      skipVfx?: boolean;
      onImpact?: (impact: VFXImpactConfig, hitIdx: number, totalHits: number, cue?: VFXImpactCue) => void;
    }
  ): Promise<void> {
    const skip = !this.vfxEnabled || options?.skipVfx;

    const targetEl = this.findCardElement(ev.targetId);
    const attackerEl = this.findCardElement(ev.actorId);

    // 攻擊者微幅突進動畫 (僅在非 skip 模式)
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

    // 取得或推導特效 ID
    const vfxId = this.resolveVfxId(ev);

    // 若為略過模式或無特效，直接觸發受擊表現並返回
    if (skip || !vfxId) {
      this.triggerHitFeedback(targetEl, ev, null, 0, 1);
      if (options?.onImpact) {
        options.onImpact({} as any, 0, 1);
      }
      return;
    }

    const isAttackerPlayer = attackerEl ? attackerEl.classList.contains('player-side') : true;
    const fromPt = this.getUnitPoint(ev.actorId, isAttackerPlayer ? 'player' : 'enemy');
    const toPt = this.getUnitPoint(ev.targetId, isAttackerPlayer ? 'enemy' : 'player');

    const fxEngine = CombatFXEngine.getInstance();
    const preset = VFXPresetRepository.getInstance().getPreset(vfxId);

    if (!preset) {
      this.triggerHitFeedback(targetEl, ev, null, 0, 1);
      if (options?.onImpact) {
        options.onImpact({} as any, 0, 1);
      }
      return;
    }

    const presentations = mapImpactsToCues([ev], preset.impactCues || [], preset.impactPresentationMode || 'EXACT_IMPACTS');

    await fxEngine.playPresetConfig(
      preset,
      fromPt,
      toPt,
      (impact: VFXImpactConfig, hitIdx: number, totalHits: number, cue?: VFXImpactCue) => {
        const item = presentations[hitIdx] || presentations[0];
        this.triggerHitFeedback(targetEl, ev, impact, hitIdx, totalHits, cue, item);
        if (options?.onImpact) {
          options.onImpact(impact, hitIdx, totalHits, cue);
        }
      }
    );
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
  private resolveVfxId(ev: CombatEvent): string | undefined {
    if (ev.vfxId) return ev.vfxId;

    if (ev.type === CombatEventType.HIT || ev.type === CombatEventType.CRIT) {
      return 'VFX_DEFAULT_SLASH';
    }

    if (ev.type === CombatEventType.HEAL) {
      return 'VFX_HEALING_LIGHT';
    }

    return undefined;
  }
}
