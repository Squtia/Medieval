import { VFXPreset, VFXImpactConfig } from '../../models/VFX';
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

  constructor(options: VFXStudioAdapterOptions) {
    this.options = options;
    this.fxEngine = CombatFXEngine.getInstance();
    this.repo = VFXPresetRepository.getInstance();

    if (options.viewportContainer) {
      this.fxEngine.mount(options.viewportContainer);
    }
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
   * 播放當前 Preset 配置（支援單目標或多目標輪巡）
   */
  public async play(
    preset: VFXPreset,
    targetIndex: number = 0,
    customOnImpact?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, targetEl: HTMLElement) => void
  ): Promise<void> {
    const casterCenter = this.getElementCenter(this.options.casterElement);
    const targetEl = this.options.targetElements[targetIndex] || this.options.targetElements[0];
    if (!targetEl) return;

    const targetCenter = this.getElementCenter(targetEl);

    const onHit = (impact: VFXImpactConfig, hitIdx: number, totalHits: number) => {
      // 1. 受擊卡片物理衝擊位移與受擊發光抖動
      targetEl.classList.remove('shake-hit');
      void targetEl.offsetWidth; // 強制重繪觸發動畫
      targetEl.classList.add('shake-hit');

      // 2. 自訂回呼傳遞
      if (customOnImpact) {
        customOnImpact(impact, hitIdx, totalHits, targetEl);
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
    customOnImpact?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, targetEl: HTMLElement) => void
  ): Promise<void> {
    const casterCenter = this.getElementCenter(this.options.casterElement);

    const promises = this.options.targetElements.map((targetEl) => {
      const targetCenter = this.getElementCenter(targetEl);
      const onHit = (impact: VFXImpactConfig, hitIdx: number, totalHits: number) => {
        targetEl.classList.remove('shake-hit');
        void targetEl.offsetWidth;
        targetEl.classList.add('shake-hit');

        if (customOnImpact) {
          customOnImpact(impact, hitIdx, totalHits, targetEl);
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
    this.fxEngine.clear();
  }
}
