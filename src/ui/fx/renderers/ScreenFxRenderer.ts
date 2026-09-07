import { VFXImpactConfig } from '../../../models/VFX';

export interface ScreenShakeOptions {
  intensity?: number;
  duration?: number;
  isHeavy?: boolean;
}

/**
 * 📺 ScreenFxRenderer
 * 專門負責視窗震顫 (screenShake)、鏡頭受擊抖動與 Flash 高光覆蓋的渲染器
 * 依據 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md §6 規格建立
 */
export class ScreenFxRenderer {
  private static activeTimers = new Set<ReturnType<typeof setTimeout>>();

  /**
   * 觸發全螢幕視窗震顫
   * @param container 目標容器（通常為 modal 或 body）
   */
  public static triggerScreenShake(container?: HTMLElement | null, isHeavy: boolean = false): void {
    const el = container || (typeof document !== 'undefined' ? document.body : null);
    if (!el) return;

    const shakeClass = isHeavy ? 'screen-shake-heavy' : 'screen-shake-light';
    el.classList.add(shakeClass);

    const timer = setTimeout(() => {
      el.classList.remove(shakeClass);
      this.activeTimers.delete(timer);
    }, isHeavy ? 350 : 200);

    this.activeTimers.add(timer);
  }

  /**
   * 套用目標卡牌受擊抖動、定格擠壓、閃光與位移 CSS 變數
   */
  public static applyTargetShake(
    targetEl: HTMLElement,
    impact: VFXImpactConfig,
    isLastHit: boolean = true,
    knockDir: number = 0
  ): void {
    const baseIntensity = impact.shakeIntensity || 12;
    const shakeX = isLastHit ? baseIntensity : Math.max(4, Math.round(baseIntensity * 0.45));
    const shakeY = Math.round(shakeX * 0.35);
    const shakeDur = isLastHit ? (impact.shakeDuration || 0.28) : 0.16;
    const punchScale = isLastHit ? (impact.targetPunchScale || 0.88) : 0.95;
    const knockDist = isLastHit ? ((impact.knockbackDistance || 0) * knockDir) : 0;

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
      targetEl.style.removeProperty('--shake-x');
      targetEl.style.removeProperty('--shake-y');
      targetEl.style.removeProperty('--shake-dur');
      this.activeTimers.delete(timer);
    }, shakeDur * 1000);

    this.activeTimers.add(timer);
  }

  /**
   * 清除當前所有震顫定時器與樣式
   */
  public static clear(): void {
    this.activeTimers.forEach(t => clearTimeout(t));
    this.activeTimers.clear();

    if (typeof document !== 'undefined') {
      document.body.classList.remove('screen-shake-heavy', 'screen-shake-light');
    }
  }
}
