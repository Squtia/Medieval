import { VFXPreset } from '../../models/VFX';
import { VFXStudioStore } from './VFXStudioStore';

export interface ControlConfig {
  id: string;
  labelId?: string;
  key: keyof VFXPreset | string;
  isImpact?: boolean;
  type: 'range' | 'select' | 'select-boolean' | 'checkbox' | 'color';
  unit?: string;
  defaultVal: any;
  applicable?: 'ALL' | 'SLASH' | 'SPIKE' | 'SALVO' | 'IMPACT' | 'SPECIAL';
}

/**
 * 🗺️ 單一真相來源之 Inspector 控制項契約表 (Inspector Control Map)
 * 嚴格對應 tools/vfx-studio.html 中的每一項 DOM 元素與 VFXPreset 屬性
 */
export const INSPECTOR_CONTROL_MAP: ControlConfig[] = [
  // 1. 🌐 基礎彈道與時空節奏
  { id: 'param-trajectory', key: 'trajectory', type: 'select', defaultVal: 'HORIZONTAL', applicable: 'ALL' },
  { id: 'param-duration', labelId: 'val-duration', key: 'duration', type: 'range', unit: 's', defaultVal: 0.35, applicable: 'ALL' },
  { id: 'param-scale', labelId: 'val-scale', key: 'scale', type: 'range', unit: 'x', defaultVal: 1.0, applicable: 'ALL' },
  { id: 'param-spin', labelId: 'val-spin', key: 'spin', type: 'range', unit: ' rad/s', defaultVal: 0, applicable: 'ALL' },

  // 2. 🎨 色彩與光學著色
  { id: 'param-shader-mode', key: 'shaderMode', type: 'select', defaultVal: 'SLASH_BLADE', applicable: 'ALL' },
  { id: 'param-core-mesh-shape', key: 'coreMeshShape', type: 'select', defaultVal: 'SPHERE', applicable: 'ALL' },
  { id: 'param-color-core', key: 'colorCore', type: 'color', defaultVal: '#ffffff', applicable: 'ALL' },
  { id: 'param-color-rim', key: 'colorRim', type: 'color', defaultVal: '#38bdf8', applicable: 'ALL' },
  { id: 'param-core-brightness', labelId: 'val-core-brightness', key: 'coreBrightness', type: 'range', unit: 'x', defaultVal: 1.5, applicable: 'ALL' },
  { id: 'param-fresnel', labelId: 'val-fresnel', key: 'fresnel', type: 'range', unit: '', defaultVal: 1.8, applicable: 'ALL' },
  { id: 'param-flame-turbulence', labelId: 'val-flame-turbulence', key: 'flameTurbulence', type: 'range', unit: 'px', defaultVal: 5.0, applicable: 'SPECIAL' },
  { id: 'param-flame-speed', labelId: 'val-flame-speed', key: 'flameSpeed', type: 'range', unit: 'x', defaultVal: 2.0, applicable: 'SPECIAL' },

  // 3. ✨ 粒子流、拖尾與爆散
  { id: 'param-trail-count', labelId: 'val-trail-count', key: 'trailCount', type: 'range', unit: '', defaultVal: 40, applicable: 'ALL' },
  { id: 'param-trail-size', labelId: 'val-trail-size', key: 'trailSize', type: 'range', unit: 'px', defaultVal: 10, applicable: 'ALL' },
  { id: 'param-burst-count', labelId: 'val-burst-count', key: 'burstCount', type: 'range', unit: ' 顆', defaultVal: 60, applicable: 'ALL' },

  // 4. ⚔️ 斬擊走向與形態 (Slash Section)
  { id: 'param-slash-traj', key: 'slashTrajectory', type: 'select', defaultVal: 'CLEAVE_DOWN', applicable: 'SLASH' },
  { id: 'param-slash-shape', key: 'slashShape', type: 'select', defaultVal: 'CRESCENT', applicable: 'SLASH' },
  { id: 'param-slash-angle', labelId: 'val-slash-angle', key: 'slashAngle', type: 'range', unit: '°', defaultVal: -45, applicable: 'SLASH' },
  { id: 'param-slash-arc-span', labelId: 'val-slash-arc-span', key: 'slashArcSpan', type: 'range', unit: '°', defaultVal: 120, applicable: 'SLASH' },
  { id: 'param-slash-aspect', labelId: 'val-slash-aspect', key: 'slashAspect', type: 'range', unit: 'x', defaultVal: 1.0, applicable: 'SLASH' },
  { id: 'param-slash-width', labelId: 'val-slash-width', key: 'slashBladeWidth', type: 'range', unit: 'px', defaultVal: 10, applicable: 'SLASH' },
  { id: 'param-slash-radius', labelId: 'val-slash-radius', key: 'slashRadius', type: 'range', unit: 'px', defaultVal: 65, applicable: 'SLASH' },
  { id: 'param-slash-jitter', labelId: 'val-slash-jitter', key: 'slashAngleJitter', type: 'range', unit: '°', defaultVal: 0, applicable: 'SLASH' },
  { id: 'param-slash-reverse', key: 'slashReverse', type: 'select-boolean', defaultVal: false, applicable: 'SLASH' },
  { id: 'param-slash-alternating', key: 'slashAlternating', type: 'select-boolean', defaultVal: false, applicable: 'SLASH' },

  // 5. 🚀 彈幕發射與節奏曲線 (Salvo Section)
  { id: 'param-salvo-count', labelId: 'val-salvo-count', key: 'salvoCount', type: 'range', unit: ' 發', defaultVal: 1, applicable: 'SALVO' },
  { id: 'param-salvo-dur', labelId: 'val-salvo-dur', key: 'salvoDuration', type: 'range', unit: 's', defaultVal: 0.35, applicable: 'SALVO' },
  { id: 'param-salvo-curve', key: 'salvoRhythmCurve', type: 'select', defaultVal: 'LINEAR', applicable: 'SALVO' },
  { id: 'param-salvo-spread', labelId: 'val-salvo-spread', key: 'salvoSpreadAngle', type: 'range', unit: '°', defaultVal: 0, applicable: 'SALVO' },
  { id: 'param-salvo-scatter', labelId: 'val-salvo-scatter', key: 'salvoSpreadRadius', type: 'range', unit: 'px', defaultVal: 0, applicable: 'SALVO' },
  { id: 'param-arc-height', labelId: 'val-arc-height', key: 'arcHeight', type: 'range', unit: 'px', defaultVal: 0, applicable: 'SALVO' },
  { id: 'param-multihit-impact', key: 'multiHitImpact', type: 'select-boolean', defaultVal: true, applicable: 'ALL' },

  // 6. 🏔️ 地刺幾何與破土連鎖 (Spike Section)
  { id: 'param-spike-shape', key: 'spikeShape', type: 'select', defaultVal: 'CONE_SPIKE', applicable: 'SPIKE' },
  { id: 'param-spike-angle', labelId: 'val-spike-angle', key: 'spikeAngle', type: 'range', unit: '°', defaultVal: 0, applicable: 'SPIKE' },
  { id: 'param-spikes', labelId: 'val-spikes', key: 'spikes', type: 'range', unit: ' 根', defaultVal: 0, applicable: 'SPIKE' },
  { id: 'param-spike-width', labelId: 'val-spike-width', key: 'spikeWidth', type: 'range', unit: 'px', defaultVal: 7, applicable: 'SPIKE' },
  { id: 'param-spike-height', labelId: 'val-spike-height', key: 'spikeHeight', type: 'range', unit: 'px', defaultVal: 45, applicable: 'SPIKE' },
  { id: 'param-spike-radius', labelId: 'val-spike-radius', key: 'spikeRadius', type: 'range', unit: 'px', defaultVal: 80, applicable: 'SPIKE' },
  { id: 'param-spike-stagger', labelId: 'val-spike-stagger', key: 'spikeStagger', type: 'range', unit: 'ms', defaultVal: 25, applicable: 'SPIKE' },
  { id: 'param-spike-material-mode', key: 'spikeMaterialMode', type: 'select', defaultVal: 'PHONG', applicable: 'SPIKE' },
  { id: 'param-spike-erupt-fire', key: 'spikeEruptFire', type: 'select-boolean', defaultVal: false, applicable: 'SPIKE' },

  // 7. 🛡️ 護盾與材質貼圖
  { id: 'param-shield-shape', key: 'shieldShape', type: 'select', defaultVal: 'HEX', applicable: 'SPECIAL' },
  { id: 'param-wave-count', labelId: 'val-wave-count', key: 'waveCount', type: 'range', unit: ' 圈', defaultVal: 3, applicable: 'SPECIAL' },
  { id: 'param-texture-sprite', key: 'textureSprite', type: 'select', defaultVal: 'GLOW', applicable: 'SPECIAL' },

  // 8. 🥊 戰鬥受擊物理反饋 (Impact & Wave)
  { id: 'param-hit-stop', labelId: 'val-hit-stop', key: 'hitStopTime', isImpact: true, type: 'range', unit: 'ms', defaultVal: 55, applicable: 'IMPACT' },
  { id: 'param-punch-scale', labelId: 'val-punch-scale', key: 'targetPunchScale', isImpact: true, type: 'range', unit: 'x', defaultVal: 0.88, applicable: 'IMPACT' },
  { id: 'param-shake-intensity', labelId: 'val-shake-intensity', key: 'shakeIntensity', isImpact: true, type: 'range', unit: 'px', defaultVal: 12, applicable: 'IMPACT' },
  { id: 'param-shake-dur', labelId: 'val-shake-dur', key: 'shakeDuration', isImpact: true, type: 'range', unit: 's', defaultVal: 0.28, applicable: 'IMPACT' },
  { id: 'param-knockback', labelId: 'val-knockback', key: 'knockbackDistance', isImpact: true, type: 'range', unit: 'px', defaultVal: 18, applicable: 'IMPACT' },
  { id: 'param-flash-color', key: 'hitFlashColor', isImpact: true, type: 'color', defaultVal: '#ffffff', applicable: 'IMPACT' },
  { id: 'param-wave-radius', labelId: 'val-wave-radius', key: 'waveRadius', isImpact: true, type: 'range', unit: 'px', defaultVal: 65, applicable: 'IMPACT' },
  { id: 'param-wave-thickness', labelId: 'val-wave-thickness', key: 'waveThickness', isImpact: true, type: 'range', unit: 'px', defaultVal: 4, applicable: 'IMPACT' },
  { id: 'param-wave-blur', labelId: 'val-wave-blur', key: 'waveBlur', isImpact: true, type: 'range', unit: '%', defaultVal: 30, applicable: 'IMPACT' },
  { id: 'param-wave-plane', key: 'wavePlane', isImpact: true, type: 'select', defaultVal: 'CAMERA', applicable: 'IMPACT' }
];

/**
 * 🛡️ 將任意 VFXPreset 補齊預設值，消除任何 undefined / NaN 洩漏風險
 */
export function normalizeVfxPreset(preset: VFXPreset): VFXPreset {
  const normalized: any = { ...preset };
  normalized.impact = { ...(preset.impact || {}) };

  for (const c of INSPECTOR_CONTROL_MAP) {
    if (c.isImpact) {
      if (normalized.impact[c.key] === undefined || normalized.impact[c.key] === null) {
        normalized.impact[c.key] = c.defaultVal;
      }
    } else {
      if (normalized[c.key] === undefined || normalized[c.key] === null) {
        normalized[c.key] = c.defaultVal;
      }
    }
  }

  return normalized as VFXPreset;
}

/**
 * 🎛️ VFXInspector
 * 情境式參數檢查器 (Contextual Inspector)
 * 負責屬性面板之雙向綁定、情境式顯隱（Contextual Visibility）與數值連動
 */
export class VFXInspector {
  private leftContainer: HTMLElement;
  private rightContainer: HTMLElement;
  private store: VFXStudioStore;

  constructor(leftContainer: HTMLElement, rightContainer: HTMLElement) {
    this.leftContainer = leftContainer;
    this.rightContainer = rightContainer;
    this.store = VFXStudioStore.getInstance();
    this.store.subscribe((preset) => {
      this.syncUI(preset);
    });
  }

  public bindAll(): void {
    for (const c of INSPECTOR_CONTROL_MAP) {
      const el = document.getElementById(c.id);
      if (!el) continue;

      const label = c.labelId ? document.getElementById(c.labelId) : null;

      if (c.type === 'range') {
        const input = el as HTMLInputElement;
        input.addEventListener('pointerdown', () => this.store.recordSnapshot());
        input.addEventListener('input', (e) => {
          const val = parseFloat((e.target as HTMLInputElement).value);
          if (label) {
            label.textContent = `${val}${c.unit || ''}`;
          }
          if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
        });
      } else if (c.type === 'select') {
        const sel = el as HTMLSelectElement;
        sel.addEventListener('change', (e) => {
          this.store.recordSnapshot();
          const val = (e.target as HTMLSelectElement).value;
          if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
        });
      } else if (c.type === 'select-boolean') {
        const sel = el as HTMLSelectElement;
        sel.addEventListener('change', (e) => {
          this.store.recordSnapshot();
          const val = (e.target as HTMLSelectElement).value === 'true';
          if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
        });
      } else if (c.type === 'checkbox') {
        const chk = el as HTMLInputElement;
        chk.addEventListener('change', (e) => {
          this.store.recordSnapshot();
          const val = (e.target as HTMLInputElement).checked;
          if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
        });
      } else if (c.type === 'color') {
        const input = el as HTMLInputElement;
        input.addEventListener('change', (e) => {
          this.store.recordSnapshot();
          const val = (e.target as HTMLInputElement).value;
          if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
        });
      }
    }

    // 初始同步
    this.syncUI(this.store.getPreset());
  }

  /**
   * 🔄 將 Preset 同步至 UI，以 Control Map 保證零 undefined 洩漏
   */
  public syncUI(rawPreset: VFXPreset): void {
    const p = normalizeVfxPreset(rawPreset);

    for (const c of INSPECTOR_CONTROL_MAP) {
      const el = document.getElementById(c.id) as HTMLInputElement | HTMLSelectElement;
      const label = c.labelId ? document.getElementById(c.labelId) : null;
      if (!el) continue;

      const rawVal = c.isImpact ? p.impact?.[c.key as keyof typeof p.impact] : (p as any)[c.key];
      const val = (rawVal !== undefined && rawVal !== null && !Number.isNaN(rawVal)) ? rawVal : c.defaultVal;

      if (c.type === 'range') {
        el.value = val.toString();
        if (label) {
          const prefix = (c.id === 'param-slash-jitter' && Number(val) > 0) ? '±' : '';
          label.textContent = `${prefix}${val}${c.unit || ''}`;
        }
      } else if (c.type === 'select') {
        el.value = val.toString();
      } else if (c.type === 'select-boolean') {
        el.value = val ? 'true' : 'false';
      } else if (c.type === 'checkbox') {
        (el as HTMLInputElement).checked = !!val;
      } else if (c.type === 'color') {
        el.value = val.toString();
      }
    }

    // 🎭 情境式顯示控制 (Contextual Visibility)
    this.updateContextualVisibility(p);
  }

  public updateContextualVisibility(p: VFXPreset): void {
    const isSlash = (p.trajectory === 'MELEE_SWEEP' || p.shaderMode === 'SLASH_BLADE' || (p.slashArcSpan !== undefined && p.slashArcSpan > 0));
    const isSpike = ((p.spikes !== undefined && p.spikes > 0) || p.trajectory === 'GROUND_FISSURE' || p.trajectory === 'GROUND_BURST' || p.shaderMode === 'EARTH_SHATTER');
    const isSalvo = ((p.salvoCount !== undefined && p.salvoCount > 1) || p.salvoDuration !== undefined || p.trajectory === 'ARC_MULTI');

    const slashCard = document.querySelector('.card-slash-section') as HTMLElement;
    if (slashCard) slashCard.style.display = isSlash ? 'block' : 'none';

    const spikeCard = document.querySelector('.card-spike-section') as HTMLElement;
    if (spikeCard) spikeCard.style.display = isSpike ? 'block' : 'none';

    const salvoCard = document.querySelector('.card-salvo-section') as HTMLElement;
    if (salvoCard) salvoCard.style.display = isSalvo ? 'block' : 'none';
  }
}
