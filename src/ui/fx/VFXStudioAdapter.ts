import { VFXPreset, VFXImpactConfig, VFXImpactCue, ImpactPresentationMode } from '../../models/VFX';
import { CombatFXEngine, ScreenPoint } from './CombatFXEngine';
import { VFXPresetRepository } from './VFXPresetRepository';

export interface VFXStudioAdapterOptions {
  viewportContainer: HTMLElement;
  casterElement: HTMLElement;
  targetElements: HTMLElement[];
  onImpact?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, targetEl: HTMLElement) => void;
}

export class VFXStudioAdapter {
  private fxEngine: CombatFXEngine;
  private repo: VFXPresetRepository;
  private options: VFXStudioAdapterOptions;
  private activeTimers = new Set<ReturnType<typeof setTimeout>>();

  constructor(options: VFXStudioAdapterOptions) {
    this.options = options;
    this.fxEngine = CombatFXEngine.getInstance();
    this.repo = VFXPresetRepository.getInstance();

    if (options.viewportContainer) {
      this.fxEngine.mount(options.viewportContainer);
    }
  }

  private registerTimer(fn: () => void, delayMs: number): void {
    if (this.fxEngine) {
      this.fxEngine.scheduleLogical(delayMs / 1000, fn);
    } else {
      const timer = setTimeout(() => {
        this.activeTimers.delete(timer);
        fn();
      }, delayMs);
      this.activeTimers.add(timer);
    }
  }

  /**
   * 動態更新受擊目標 DOM 清單（解決 AOE 模式切換重建 DOM 導致座標失效）
   */
  public setTargets(targets: HTMLElement[]): void {
    this.options.targetElements = targets.filter(Boolean);
  }

  /**
   * 設定播放倍速（支援慢動作 0.3x 與快速播放）
   */
  public setPlaybackSpeed(speed: number): void {
    this.fxEngine.setPlaybackSpeed(speed);
  }

  /**
   * 獲取目前掛載的 FX 引擎
   */
  public getFxEngine(): CombatFXEngine {
    return this.fxEngine;
  }

  /**
   * 計算特定 DOM 元素在 Viewport 內部的相對中心像素座標
   */
  public getElementCenter(el: HTMLElement): ScreenPoint {
    const vRect = this.options.viewportContainer.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();

    return {
      x: eRect.left - vRect.left + eRect.width / 2,
      y: eRect.top - vRect.top + eRect.height / 2
    };
  }

  /**
   * 觸發目標卡片受擊打擊感反饋（定格、擠壓、震動、閃光、跳字與全螢幕微震）
   */
  public triggerTargetFeedback(
    targetEl: HTMLElement,
    impact: VFXImpactConfig,
    hitIndex: number,
    totalHits: number,
    multiHitImpact: boolean = true,
    cue?: VFXImpactCue,
    presentationMode?: ImpactPresentationMode
  ): void {
    const isFinal = hitIndex >= totalHits - 1;
    const isPrimary = cue?.isPrimary !== undefined ? cue.isPrimary : isFinal;

    // 1. 全螢幕震動
    if (impact.screenShake && (isPrimary || isFinal)) {
      const vp = this.options.viewportContainer;
      vp.classList.remove('screen-quake');
      void vp.offsetWidth;
      vp.classList.add('screen-quake');
      this.registerTimer(() => vp.classList.remove('screen-quake'), 400);
    }

    // 2. 前段多段輕打擊判定
    const isSubImpact = presentationMode === 'PRIMARY_ONLY' ? !isPrimary : (!isFinal && multiHitImpact);
    if (isSubImpact) {
      targetEl.classList.remove('target-hit-light');
      void targetEl.offsetWidth;
      targetEl.classList.add('target-hit-light');

      const floatEl = document.createElement('div');
      floatEl.className = 'vfx-floating-dmg light-dmg';
      floatEl.textContent = '-' + Math.floor(Math.random() * 80 + 120);
      targetEl.appendChild(floatEl);
      this.registerTimer(() => { if (floatEl.parentNode) floatEl.remove(); }, 500);
      return;
    }

    // 3. 終結/主打擊感
    targetEl.style.setProperty('--punch-scale', (impact.targetPunchScale || 0.88).toString());
    targetEl.style.setProperty('--shake-x', `${impact.shakeIntensity || 12}px`);
    targetEl.style.setProperty('--shake-y', `${Math.round((impact.shakeIntensity || 12) * 0.35)}px`);
    targetEl.style.setProperty('--shake-dur', `${impact.shakeDuration || 0.28}s`);
    targetEl.style.setProperty('--flash-color', impact.hitFlashColor || '#ffffff');
    targetEl.style.setProperty('--knockback-x', `${impact.knockbackDistance || 0}px`);

    targetEl.classList.remove('target-hit');
    targetEl.classList.remove('target-hit-light');
    void targetEl.offsetWidth;
    targetEl.classList.add('target-hit');
    this.registerTimer(() => {
      targetEl.classList.remove('target-hit');
    }, (impact.shakeDuration || 0.28) * 1000);

    // 4. 暴擊判定與傷害跳字（若為 SPLIT_SINGLE_IMPACT 則乘上 cue.weight）
    const isCrit = (impact.shakeIntensity || 12) >= 15 || impact.screenShake;
    let baseDmg = Math.floor(Math.random() * 400 + (isCrit ? 850 : 420));
    if (presentationMode === 'SPLIT_SINGLE_IMPACT' && cue?.weight !== undefined) {
      baseDmg = Math.max(1, Math.round(baseDmg * cue.weight));
    }
    const floatEl = document.createElement('div');
    floatEl.className = 'vfx-floating-dmg';
    if (isCrit) {
      floatEl.style.color = '#ef4444';
      floatEl.textContent = `💥 -${baseDmg} (CRIT!)`;
    } else {
      floatEl.textContent = `-${baseDmg}`;
    }
    targetEl.appendChild(floatEl);
    this.registerTimer(() => { if (floatEl.parentNode) floatEl.remove(); }, 850);
  }

  /**
   * 播放當前 Preset 配置（支援單目標或多目標輪巡）
   */
  public async play(
    preset: VFXPreset,
    targetIndex: number = 0,
    customOnImpact?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, targetEl: HTMLElement, cue?: VFXImpactCue) => void
  ): Promise<void> {
    const casterCenter = this.getElementCenter(this.options.casterElement);
    const targetEl = this.options.targetElements[targetIndex] || this.options.targetElements[0];
    if (!targetEl) return;

    const targetCenter = this.getElementCenter(targetEl);

    const onHit = (impact: VFXImpactConfig, hitIdx: number, totalHits: number, cue?: VFXImpactCue) => {
      this.triggerTargetFeedback(
        targetEl,
        impact,
        hitIdx,
        totalHits,
        preset.multiHitImpact !== false,
        cue,
        preset.impactPresentationMode
      );

      if (customOnImpact) {
        customOnImpact(impact, hitIdx, totalHits, targetEl, cue);
      } else if (this.options.onImpact) {
        this.options.onImpact(impact, hitIdx, totalHits, targetEl);
      }
    };

    return this.fxEngine.playPresetConfig(preset, casterCenter, targetCenter, onHit);
  }

  /**
   * 多目標 AOE 同步預覽播放
   */
  public async playMultiTarget(
    preset: VFXPreset,
    customOnImpact?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, targetEl: HTMLElement, cue?: VFXImpactCue) => void
  ): Promise<void> {
    const casterCenter = this.getElementCenter(this.options.casterElement);
    const targets = this.options.targetElements.length > 0 ? this.options.targetElements : [this.options.casterElement];

    const promises = targets.map((targetEl) => {
      const targetCenter = this.getElementCenter(targetEl);
      const onHit = (impact: VFXImpactConfig, hitIdx: number, totalHits: number, cue?: VFXImpactCue) => {
        this.triggerTargetFeedback(
          targetEl,
          impact,
          hitIdx,
          totalHits,
          preset.multiHitImpact !== false,
          cue,
          preset.impactPresentationMode
        );

        if (customOnImpact) {
          customOnImpact(impact, hitIdx, totalHits, targetEl, cue);
        } else if (this.options.onImpact) {
          this.options.onImpact(impact, hitIdx, totalHits, targetEl);
        }
      };

      return this.fxEngine.playPresetConfig(preset, casterCenter, targetCenter, onHit);
    });

    await Promise.all(promises);
  }

  public resize(): void {
    this.fxEngine.resize();
  }

  public clear(): void {
    this.activeTimers.forEach(t => clearTimeout(t));
    this.activeTimers.clear();

    if (this.options.viewportContainer) {
      const floatings = this.options.viewportContainer.querySelectorAll('.vfx-floating-dmg');
      floatings.forEach(el => el.remove());
      this.options.viewportContainer.classList.remove('screen-quake');
    }
    if (this.options.targetElements) {
      this.options.targetElements.forEach(el => {
        el.classList.remove('target-hit', 'target-hit-light');
      });
    }

    this.fxEngine.clear();
  }
}
