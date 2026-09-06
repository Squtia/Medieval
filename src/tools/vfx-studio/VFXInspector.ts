import { VFXPreset } from '../../models/VFX';
import { VFXStudioStore } from './VFXStudioStore';

export interface ControlConfig {
  id: string;
  labelId?: string;
  key: keyof VFXPreset | string;
  isImpact?: boolean;
  isCasterMotion?: boolean;
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
  { id: 'param-spatial-mode', key: 'spatialMode', type: 'select', defaultVal: 'TRAJECTORY', applicable: 'ALL' },
  { id: 'param-trajectory-path', key: 'trajectoryPath', type: 'select', defaultVal: 'A_TO_B', applicable: 'ALL' },
  { id: 'param-reverse', key: 'reverse', type: 'select-boolean', defaultVal: false, applicable: 'ALL' },
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
  { id: 'param-glow-radius', labelId: 'val-glow-radius', key: 'glowRadius', type: 'range', unit: 'px', defaultVal: 75, applicable: 'ALL' },
  { id: 'param-glow-opacity', labelId: 'val-glow-opacity', key: 'glowOpacity', type: 'range', unit: '', defaultVal: 0.85, applicable: 'ALL' },
  { id: 'param-fresnel', labelId: 'val-fresnel', key: 'fresnel', type: 'range', unit: '', defaultVal: 1.8, applicable: 'ALL' },
  { id: 'param-flame-turbulence', labelId: 'val-flame-turbulence', key: 'flameTurbulence', type: 'range', unit: 'px', defaultVal: 5.0, applicable: 'SPECIAL' },
  { id: 'param-flame-speed', labelId: 'val-flame-speed', key: 'flameTurbulenceSpeed', type: 'range', unit: 'x', defaultVal: 2.0, applicable: 'SPECIAL' },

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
  { id: 'param-wave-plane', key: 'wavePlane', isImpact: true, type: 'select', defaultVal: 'CAMERA', applicable: 'IMPACT' },

  // 9. 🏃 施術者發力動作力學反饋 (Caster Motion)
  { id: 'param-caster-step', labelId: 'val-caster-step', key: 'stepForward', isCasterMotion: true, type: 'range', unit: 'px', defaultVal: 0, applicable: 'ALL' },
  { id: 'param-caster-recoil', labelId: 'val-caster-recoil', key: 'recoil', isCasterMotion: true, type: 'range', unit: 'px', defaultVal: 0, applicable: 'ALL' },
  { id: 'param-caster-tilt', labelId: 'val-caster-tilt', key: 'tiltAngle', isCasterMotion: true, type: 'range', unit: '°', defaultVal: 0, applicable: 'ALL' },
  { id: 'param-caster-motion-dur', labelId: 'val-caster-motion-dur', key: 'motionDuration', isCasterMotion: true, type: 'range', unit: 's', defaultVal: 0.3, applicable: 'ALL' }
];

/**
 * 🛡️ 將任意 VFXPreset 補齊預設值，消除任何 undefined / NaN 洩漏風險
 */
export function normalizeVfxPreset(preset: VFXPreset): VFXPreset {
  const normalized: any = { ...preset };
  normalized.impact = { ...(preset.impact || {}) };
  normalized.casterMotion = { ...(preset.casterMotion || {}) };

  for (const c of INSPECTOR_CONTROL_MAP) {
    if (c.isImpact) {
      if (normalized.impact[c.key] === undefined || normalized.impact[c.key] === null) {
        normalized.impact[c.key] = c.defaultVal;
      }
    } else if (c.isCasterMotion) {
      if (normalized.casterMotion[c.key] === undefined || normalized.casterMotion[c.key] === null) {
        normalized.casterMotion[c.key] = c.defaultVal;
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
  private onParamChangeCallback?: (preset: VFXPreset) => void;

  constructor(leftContainer: HTMLElement, rightContainer: HTMLElement) {
    this.leftContainer = leftContainer;
    this.rightContainer = rightContainer;
    this.store = VFXStudioStore.getInstance();
    this.store.subscribe((preset) => {
      this.syncUI(preset);
    });
  }

  /**
   * 📡 註冊參數變更回調（用於即時預覽 / 熱更新）
   */
  public onParamChange(cb: (preset: VFXPreset) => void): void {
    this.onParamChangeCallback = cb;
  }

  private triggerChange(): void {
    if (this.onParamChangeCallback) {
      this.onParamChangeCallback(this.store.getPreset());
    }
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
            const prefix = (c.id === 'param-slash-jitter' && val > 0) ? '±' : '';
            label.textContent = `${prefix}${val}${c.unit || ''}`;
          }
          if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
        });
      } else if (c.type === 'select') {
        const sel = el as HTMLSelectElement;
        sel.addEventListener('change', (e) => {
          this.store.recordSnapshot();
          const val = (e.target as HTMLSelectElement).value;
          if (c.id === 'param-wave-plane') {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), wavePlane: val };
            this.store.updateConfig({ wavePlane: val as any, impact }, false);
          } else if (c.isImpact) {
            const cur = this.store.getPreset();
            const impact = { ...(cur.impact || {}), [c.key]: val };
            this.store.updateConfig({ impact }, false);
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
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
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
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
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
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
          } else if (c.isCasterMotion) {
            const cur = this.store.getPreset();
            const casterMotion = { ...(cur.casterMotion || {}), [c.key]: val };
            this.store.updateConfig({ casterMotion }, false);
          } else {
            this.store.updateConfig({ [c.key]: val }, false);
          }
          this.triggerChange();
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

      const rawVal = c.isImpact
        ? p.impact?.[c.key as keyof typeof p.impact]
        : (c.isCasterMotion
          ? (p.casterMotion as any)?.[c.key]
          : ((p as any)[c.key] !== undefined ? (p as any)[c.key] : (c.key === 'flameTurbulenceSpeed' ? (p as any).flameSpeed : undefined)));
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

  private contextualTarget: { type: 'MAIN' | 'LAYER' | 'CUE'; index?: number } | null = null;

  public setContextualTarget(target: { type: 'MAIN' | 'LAYER' | 'CUE'; index?: number } | null): void {
    this.contextualTarget = target;
    if (target?.type === 'CUE') {
      this.selectedCueIndex = target.index !== undefined ? target.index : null;
    } else if (target) {
      this.selectedCueIndex = null;
    }
    this.updateContextualVisibility(this.store.getPreset());
  }

  public updateContextualVisibility(p: VFXPreset): void {
    const isCueSelected = this.selectedCueIndex !== null || this.contextualTarget?.type === 'CUE';
    const isLayerSelected = this.contextualTarget?.type === 'LAYER';
    const selectedLayer = (isLayerSelected && this.contextualTarget?.index !== undefined)
      ? p.layers?.[this.contextualTarget.index]
      : null;

    // 依選取圖層或主圖層判定生效的幾何與模式
    const activeSpatial = selectedLayer?.spatialMode || p.spatialMode || p.trajectoryPath || p.trajectory || 'TRAJECTORY';
    const activeShader = selectedLayer?.shaderMode || p.shaderMode || 'SLASH_BLADE';
    const activeTrajectory = selectedLayer ? (selectedLayer.spatialMode || 'TRAJECTORY') : p.trajectory;

    const isSlash = (activeTrajectory === 'MELEE_SWEEP' || activeShader === 'SLASH_BLADE' || (p.slashArcSpan !== undefined && p.slashArcSpan > 0));
    const isSpike = ((p.spikes !== undefined && p.spikes > 0) || activeTrajectory === 'GROUND_FISSURE' || activeTrajectory === 'GROUND_BURST' || activeShader === 'EARTH_SHATTER');
    const isSalvo = ((p.salvoCount !== undefined && p.salvoCount > 1) || p.salvoDuration !== undefined || activeTrajectory === 'ARC_MULTI');

    const slashCard = document.querySelector('.card-slash-section') as HTMLElement;
    if (slashCard) {
      slashCard.style.display = (!isCueSelected && isSlash) ? 'block' : 'none';
    }

    const spikeCard = document.querySelector('.card-spike-section') as HTMLElement;
    if (spikeCard) {
      spikeCard.style.display = (!isCueSelected && isSpike) ? 'block' : 'none';
    }

    const salvoCard = document.querySelector('.card-salvo-section') as HTMLElement;
    if (salvoCard) {
      salvoCard.style.display = (!isCueSelected && isSalvo) ? 'block' : 'none';
    }

    // 施法動作與受擊回饋卡片：僅在主軌選中或未特選時展示，避免圖層與 Cue 干擾
    const casterCard = document.querySelector('.card-caster-motion') as HTMLElement;
    if (casterCard) {
      casterCard.style.display = (!isCueSelected && !isLayerSelected) ? 'block' : 'none';
    }

    const impactCard = document.querySelector('.card-impact-section') as HTMLElement;
    if (impactCard) {
      impactCard.style.display = (!isCueSelected && !isLayerSelected) ? 'block' : 'none';
    }

    // 🚀 當空間發生模式為原地類（AT_CASTER / AT_TARGET）時，隱藏位移路徑選單
    const rowTrajPath = document.getElementById('row-trajectory-path');
    if (rowTrajPath) {
      const mode = activeSpatial;
      rowTrajPath.style.display = (mode !== 'AT_CASTER' && mode !== 'AT_TARGET') ? 'block' : 'none';
    }

    // 🎯 同步選中的 Cue 資訊
    this.syncSelectedCueUI(p);
  }

  // ─────────────────────────────────────────────────────────────
  // 🎯 情境式 Cue 檢查器實作 (Contextual Cue Inspector)
  // ─────────────────────────────────────────────────────────────
  private selectedCueIndex: number | null = null;
  private isCueBindingDone = false;

  public setSelectedCueIndex(index: number | null): void {
    this.selectedCueIndex = index;
    this.syncSelectedCueUI(this.store.getPreset());
  }

  private syncSelectedCueUI(preset: VFXPreset): void {
    const cueCard = document.getElementById('card-cue-inspector');
    if (!cueCard) return;

    if (!this.isCueBindingDone) {
      this.bindCueControls();
      this.isCueBindingDone = true;
    }

    const cues = preset.impactCues || [];
    if (this.selectedCueIndex === null || this.selectedCueIndex < 0 || this.selectedCueIndex >= cues.length) {
      cueCard.style.display = 'none';
      return;
    }

    const cue = cues[this.selectedCueIndex];
    cueCard.style.display = 'block';

    const inputId = document.getElementById('param-cue-id') as HTMLInputElement;
    const inputTime = document.getElementById('param-cue-time') as HTMLInputElement;
    const valTime = document.getElementById('val-cue-time');
    const selKind = document.getElementById('param-cue-kind') as HTMLSelectElement;
    const inputWeight = document.getElementById('param-cue-weight') as HTMLInputElement;
    const valWeight = document.getElementById('val-cue-weight');
    const selPolicy = document.getElementById('param-cue-target-policy') as HTMLSelectElement;
    const chkPrimary = document.getElementById('param-cue-is-primary') as HTMLInputElement;

    if (inputId) inputId.value = cue.cueId || '';
    if (inputTime) {
      inputTime.max = (preset.duration || 1.0).toString();
      inputTime.value = (cue.time || 0).toString();
    }
    if (valTime) valTime.textContent = `${(cue.time || 0).toFixed(2)}s`;
    if (selKind) selKind.value = cue.kind || 'IMPACT';
    const weightVal = cue.weight !== undefined ? cue.weight : 1.0;
    if (inputWeight) inputWeight.value = weightVal.toString();
    if (valWeight) valWeight.textContent = weightVal.toFixed(1);
    if (selPolicy) selPolicy.value = cue.targetPolicy || 'PRIMARY_TARGET';
    if (chkPrimary) chkPrimary.checked = !!cue.isPrimary;
  }

  private bindCueControls(): void {
    const cueCard = document.getElementById('card-cue-inspector');
    if (!cueCard) return;

    const inputId = document.getElementById('param-cue-id') as HTMLInputElement;
    const inputTime = document.getElementById('param-cue-time') as HTMLInputElement;
    const valTime = document.getElementById('val-cue-time');
    const selKind = document.getElementById('param-cue-kind') as HTMLSelectElement;
    const inputWeight = document.getElementById('param-cue-weight') as HTMLInputElement;
    const valWeight = document.getElementById('val-cue-weight');
    const selPolicy = document.getElementById('param-cue-target-policy') as HTMLSelectElement;
    const chkPrimary = document.getElementById('param-cue-is-primary') as HTMLInputElement;
    const btnDelete = document.getElementById('btn-delete-cue') as HTMLButtonElement;

    const updateCurrentCue = (updater: (cue: any) => void, recordHistory = false) => {
      if (this.selectedCueIndex === null) return;
      const cues = [...(this.store.getPreset().impactCues || [])];
      if (this.selectedCueIndex >= 0 && this.selectedCueIndex < cues.length) {
        updater(cues[this.selectedCueIndex]);
        this.store.updateConfig({ impactCues: cues }, recordHistory);
        this.triggerChange();
      }
    };

    inputId?.addEventListener('input', (e) => {
      updateCurrentCue(cue => { cue.cueId = (e.target as HTMLInputElement).value; }, false);
    });

    inputTime?.addEventListener('pointerdown', () => this.store.recordSnapshot());
    inputTime?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (valTime) valTime.textContent = `${val.toFixed(2)}s`;
      updateCurrentCue(cue => { cue.time = val; }, false);
    });

    selKind?.addEventListener('change', (e) => {
      this.store.recordSnapshot();
      updateCurrentCue(cue => { cue.kind = (e.target as HTMLSelectElement).value; }, true);
    });

    inputWeight?.addEventListener('pointerdown', () => this.store.recordSnapshot());
    inputWeight?.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (valWeight) valWeight.textContent = val.toFixed(1);
      updateCurrentCue(cue => { cue.weight = val; }, false);
    });

    selPolicy?.addEventListener('change', (e) => {
      this.store.recordSnapshot();
      updateCurrentCue(cue => { cue.targetPolicy = (e.target as HTMLSelectElement).value; }, true);
    });

    chkPrimary?.addEventListener('change', (e) => {
      this.store.recordSnapshot();
      const isChecked = (e.target as HTMLInputElement).checked;
      updateCurrentCue(cue => { cue.isPrimary = isChecked; }, true);
    });

    btnDelete?.addEventListener('click', () => {
      if (this.selectedCueIndex === null) return;
      this.store.recordSnapshot();
      const cues = [...(this.store.getPreset().impactCues || [])];
      if (this.selectedCueIndex >= 0 && this.selectedCueIndex < cues.length) {
        cues.splice(this.selectedCueIndex, 1);
        this.selectedCueIndex = null;
        this.store.updateConfig({ impactCues: cues }, true);
        this.setSelectedCueIndex(null);
      }
    });
  }
}
