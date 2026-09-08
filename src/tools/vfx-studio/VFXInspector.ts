import { VFXPreset } from '../../models/VFX';
import { VFXStudioStore, VFXEditorSelection } from './VFXStudioStore';

export type InspectorCapability =
  | 'TRANSFORM'
  | 'TRAJECTORY'
  | 'SLASH_GEOMETRY'
  | 'PROJECTILE_GEOMETRY'
  | 'SPIKE_GEOMETRY'
  | 'SHIELD_GEOMETRY'
  | 'SHOUT_GEOMETRY'
  | 'FIRE_SHADER'
  | 'ICE_SHADER'
  | 'PARTICLES'
  | 'IMPACT_FEEDBACK'
  | 'CASTER_MOTION'
  | 'CUE'
  | 'BINDING';

export interface ControlConfig {
  id: string;
  labelId?: string;
  key: keyof VFXPreset | string;
  isImpact?: boolean;
  isCasterMotion?: boolean;
  type: 'range' | 'select' | 'select-boolean' | 'checkbox' | 'color';
  unit?: string;
  defaultVal: any;
  capability?: InspectorCapability;
  isLegacy?: boolean;
  isHidden?: boolean;
}

/**
 * 🎯 依據當前 Preset 與選取狀態純函式求值可用的 Inspector 能力集合 (Capability Schema)
 */
export function getSelectionCapabilities(
  preset: VFXPreset,
  selection: VFXEditorSelection
): Set<InspectorCapability> {
  const caps = new Set<InspectorCapability>();

  if (selection.type === 'BINDING') {
    caps.add('BINDING');
    return caps;
  }

  if (selection.type === 'CUE') {
    caps.add('CUE');
    return caps;
  }

  // PRESET, MAIN_TRACK, LAYER 基本能力
  caps.add('TRANSFORM');
  caps.add('TRAJECTORY');
  caps.add('PARTICLES');

  const layer = selection.type === 'LAYER'
    ? preset.layers?.find(l => l.id === selection.layerId)
    : undefined;

  const shaderMode = layer?.shaderMode || preset.shaderMode || 'SLASH_BLADE';
  const spatialMode = layer?.spatialMode || preset.spatialMode || 'TRAJECTORY';
  const rendererType = preset.rendererType;

  // Slash 幾何能力
  if (
    rendererType === 'SLASH' ||
    shaderMode === 'SLASH_BLADE' ||
    preset.trajectory === 'MELEE_SWEEP'
  ) {
    caps.add('SLASH_GEOMETRY');
  }

  // Projectile 幾何能力
  const isMelee = rendererType === 'SLASH' || preset.trajectory === 'MELEE_SWEEP';
  if (
    !isMelee &&
    (rendererType === 'PROJECTILE' ||
     preset.spatialMode === 'TRAJECTORY' ||
     preset.trajectoryPath !== undefined ||
     (preset.salvoCount && preset.salvoCount > 1))
  ) {
    caps.add('PROJECTILE_GEOMETRY');
  }

  // Spike 幾何能力
  if (
    rendererType === 'GROUND_FISSURE' ||
    shaderMode === 'EARTH_SHATTER' ||
    preset.trajectory === 'GROUND_FISSURE' ||
    preset.trajectory === 'GROUND_BURST' ||
    (preset.spikes !== undefined && preset.spikes > 0)
  ) {
    caps.add('SPIKE_GEOMETRY');
  }

  // Shield 幾何能力
  if (
    rendererType === 'SHIELD' ||
    (preset.trajectory as string) === 'SHIELD_BARRIER'
  ) {
    caps.add('SHIELD_GEOMETRY');
  }

  // Shout 幾何能力
  if (
    rendererType === 'SHOUT_WAVE' ||
    (preset.trajectory as string) === 'SHOUT_WAVE'
  ) {
    caps.add('SHOUT_GEOMETRY');
  }

  // Fire / Ice Shader
  if (shaderMode.includes('FLAME') || shaderMode.includes('FIRE') || shaderMode === 'VOLUMETRIC_FIRE') {
    caps.add('FIRE_SHADER');
  }
  if (shaderMode.includes('ICE') || shaderMode.includes('FROST') || shaderMode === 'FRESNEL_ICE') {
    caps.add('ICE_SHADER');
  }

  // 僅主軌或整體 Preset 顯示受擊反饋與施法動作
  if (selection.type === 'MAIN_TRACK' || selection.type === 'PRESET') {
    caps.add('IMPACT_FEEDBACK');
    caps.add('CASTER_MOTION');
  }

  return caps;
}

/**
 * 🗺️ 單一真相來源之 Inspector 控制項契約表 (Inspector Control Map)
 */
export const INSPECTOR_CONTROL_MAP: ControlConfig[] = [
  // 1. 🌐 基礎彈道與時空節奏
  { id: 'param-spatial-mode', key: 'spatialMode', type: 'select', defaultVal: 'TRAJECTORY', capability: 'TRAJECTORY' },
  { id: 'param-trajectory-path', key: 'trajectoryPath', type: 'select', defaultVal: 'A_TO_B', capability: 'TRAJECTORY' },
  { id: 'param-reverse', key: 'reverse', type: 'select-boolean', defaultVal: false, capability: 'TRAJECTORY' },
  { id: 'param-trajectory', key: 'trajectory', type: 'select', defaultVal: 'HORIZONTAL', isLegacy: true, isHidden: true },
  { id: 'param-scale', labelId: 'val-scale', key: 'scale', type: 'range', unit: 'x', defaultVal: 1.0, capability: 'TRANSFORM' },
  { id: 'param-spin', labelId: 'val-spin', key: 'spin', type: 'range', unit: ' rad/s', defaultVal: 0, capability: 'TRANSFORM' },

  // 2. 🎨 色彩與光學著色
  { id: 'param-shader-mode', key: 'shaderMode', type: 'select', defaultVal: 'SLASH_BLADE', capability: 'TRANSFORM' },
  { id: 'param-core-mesh-shape', key: 'coreMeshShape', type: 'select', defaultVal: 'SPHERE', capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-color-core', key: 'colorCore', type: 'color', defaultVal: '#ffffff', capability: 'TRANSFORM' },
  { id: 'param-color-rim', key: 'colorRim', type: 'color', defaultVal: '#38bdf8', capability: 'TRANSFORM' },
  { id: 'param-core-brightness', labelId: 'val-core-brightness', key: 'coreBrightness', type: 'range', unit: 'x', defaultVal: 1.5, capability: 'TRANSFORM' },
  { id: 'param-glow-radius', labelId: 'val-glow-radius', key: 'glowRadius', type: 'range', unit: 'px', defaultVal: 75, capability: 'TRANSFORM' },
  { id: 'param-glow-opacity', labelId: 'val-glow-opacity', key: 'glowOpacity', type: 'range', unit: '', defaultVal: 0.85, capability: 'TRANSFORM' },
  { id: 'param-fresnel', labelId: 'val-fresnel', key: 'fresnel', type: 'range', unit: '', defaultVal: 1.8, capability: 'ICE_SHADER' },
  { id: 'param-flame-turbulence', labelId: 'val-flame-turbulence', key: 'flameTurbulence', type: 'range', unit: 'px', defaultVal: 5.0, capability: 'FIRE_SHADER' },
  { id: 'param-flame-speed', labelId: 'val-flame-speed', key: 'flameTurbulenceSpeed', type: 'range', unit: 'x', defaultVal: 2.0, capability: 'FIRE_SHADER' },

  // 3. ✨ 粒子流、拖尾與爆散
  { id: 'param-trail-count', labelId: 'val-trail-count', key: 'trailCount', type: 'range', unit: '', defaultVal: 40, capability: 'PARTICLES' },
  { id: 'param-trail-size', labelId: 'val-trail-size', key: 'trailSize', type: 'range', unit: 'px', defaultVal: 10, capability: 'PARTICLES' },
  { id: 'param-burst-count', labelId: 'val-burst-count', key: 'burstCount', type: 'range', unit: ' 顆', defaultVal: 60, capability: 'PARTICLES' },

  // 4. ⚔️ 斬擊走向與形態 (Slash Section)
  { id: 'param-slash-traj', key: 'slashTrajectory', type: 'select', defaultVal: 'CLEAVE_DOWN', capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-shape', key: 'slashShape', type: 'select', defaultVal: 'CRESCENT', capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-angle', labelId: 'val-slash-angle', key: 'slashAngle', type: 'range', unit: '°', defaultVal: -45, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-arc-span', labelId: 'val-slash-arc-span', key: 'slashArcSpan', type: 'range', unit: '°', defaultVal: 120, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-aspect', labelId: 'val-slash-aspect', key: 'slashAspect', type: 'range', unit: 'x', defaultVal: 1.0, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-width', labelId: 'val-slash-width', key: 'slashBladeWidth', type: 'range', unit: 'px', defaultVal: 10, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-radius', labelId: 'val-slash-radius', key: 'slashRadius', type: 'range', unit: 'px', defaultVal: 65, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-jitter', labelId: 'val-slash-jitter', key: 'slashAngleJitter', type: 'range', unit: '°', defaultVal: 0, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-reverse', key: 'slashReverse', type: 'select-boolean', defaultVal: false, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-alternating', key: 'slashAlternating', type: 'select-boolean', defaultVal: false, capability: 'SLASH_GEOMETRY' },

  // 5. 🚀 彈幕發射與節奏曲線 (Salvo Section)
  { id: 'param-salvo-count', labelId: 'val-salvo-count', key: 'salvoCount', type: 'range', unit: ' 發', defaultVal: 1, capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-salvo-dur', labelId: 'val-salvo-dur', key: 'salvoDuration', type: 'range', unit: 's', defaultVal: 0.35, capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-salvo-curve', key: 'salvoRhythmCurve', type: 'select', defaultVal: 'LINEAR', capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-salvo-spread', labelId: 'val-salvo-spread', key: 'salvoSpreadAngle', type: 'range', unit: '°', defaultVal: 0, capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-salvo-scatter', labelId: 'val-salvo-scatter', key: 'salvoSpreadRadius', type: 'range', unit: 'px', defaultVal: 0, capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-arc-height', labelId: 'val-arc-height', key: 'arcHeight', type: 'range', unit: 'px', defaultVal: 0, capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-multihit-impact', key: 'multiHitImpact', type: 'select-boolean', defaultVal: true, capability: 'PROJECTILE_GEOMETRY' },

  // 6. 🏔️ 地刺幾何與破土連鎖 (Spike Section)
  { id: 'param-spike-shape', key: 'spikeShape', type: 'select', defaultVal: 'CONE_SPIKE', capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-angle', labelId: 'val-spike-angle', key: 'spikeAngle', type: 'range', unit: '°', defaultVal: 0, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spikes', labelId: 'val-spikes', key: 'spikes', type: 'range', unit: ' 根', defaultVal: 0, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-width', labelId: 'val-spike-width', key: 'spikeWidth', type: 'range', unit: 'px', defaultVal: 7, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-height', labelId: 'val-spike-height', key: 'spikeHeight', type: 'range', unit: 'px', defaultVal: 45, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-radius', labelId: 'val-spike-radius', key: 'spikeRadius', type: 'range', unit: 'px', defaultVal: 80, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-stagger', labelId: 'val-spike-stagger', key: 'spikeStagger', type: 'range', unit: 'ms', defaultVal: 25, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-material-mode', key: 'spikeMaterialMode', type: 'select', defaultVal: 'PHONG', capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-erupt-fire', key: 'spikeEruptFire', type: 'select-boolean', defaultVal: false, capability: 'SPIKE_GEOMETRY' },

  // 7. 🛡️ 護盾與戰吼
  { id: 'param-shield-shape', key: 'shieldShape', type: 'select', defaultVal: 'HEX', capability: 'SHIELD_GEOMETRY' },
  { id: 'param-wave-count', labelId: 'val-wave-count', key: 'waveCount', type: 'range', unit: ' 圈', defaultVal: 3, capability: 'SHOUT_GEOMETRY' },
  { id: 'param-texture-sprite', key: 'textureSprite', type: 'select', defaultVal: 'GLOW', isHidden: true },

  // 8. 🥊 戰鬥受擊物理反饋 (Impact & Wave)
  { id: 'param-hit-stop', labelId: 'val-hit-stop', key: 'hitStopTime', isImpact: true, type: 'range', unit: 'ms', defaultVal: 55, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-punch-scale', labelId: 'val-punch-scale', key: 'targetPunchScale', isImpact: true, type: 'range', unit: 'x', defaultVal: 0.88, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-shake-intensity', labelId: 'val-shake-intensity', key: 'shakeIntensity', isImpact: true, type: 'range', unit: 'px', defaultVal: 12, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-shake-dur', labelId: 'val-shake-dur', key: 'shakeDuration', isImpact: true, type: 'range', unit: 's', defaultVal: 0.28, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-knockback', labelId: 'val-knockback', key: 'knockbackDistance', isImpact: true, type: 'range', unit: 'px', defaultVal: 18, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-flash-color', key: 'hitFlashColor', isImpact: true, type: 'color', defaultVal: '#ffffff', capability: 'IMPACT_FEEDBACK' },
  { id: 'param-wave-radius', labelId: 'val-wave-radius', key: 'waveRadius', isImpact: true, type: 'range', unit: 'px', defaultVal: 65, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-wave-thickness', labelId: 'val-wave-thickness', key: 'waveThickness', isImpact: true, type: 'range', unit: 'px', defaultVal: 4, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-wave-blur', labelId: 'val-wave-blur', key: 'waveBlur', isImpact: true, type: 'range', unit: '%', defaultVal: 30, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-wave-plane', key: 'wavePlane', isImpact: true, type: 'select', defaultVal: 'CAMERA', capability: 'IMPACT_FEEDBACK' },

  // 9. 🏃 施術者發力動作力學反饋 (Caster Motion)
  { id: 'param-caster-step', labelId: 'val-caster-step', key: 'stepForward', isCasterMotion: true, type: 'range', unit: 'px', defaultVal: 0, capability: 'CASTER_MOTION' },
  { id: 'param-caster-recoil', labelId: 'val-caster-recoil', key: 'recoil', isCasterMotion: true, type: 'range', unit: 'px', defaultVal: 0, capability: 'CASTER_MOTION' },
  { id: 'param-caster-tilt', labelId: 'val-caster-tilt', key: 'tiltAngle', isCasterMotion: true, type: 'range', unit: '°', defaultVal: 0, capability: 'CASTER_MOTION' },
  { id: 'param-caster-motion-dur', labelId: 'val-caster-motion-dur', key: 'motionDuration', isCasterMotion: true, type: 'range', unit: 's', defaultVal: 0.3, capability: 'CASTER_MOTION' }
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
    this.store.subscribeSelection(() => {
      this.updateContextualVisibility(this.store.getPreset());
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
      const cue = (this.store.getPreset().impactCues || [])[this.selectedCueIndex || 0];
      this.store.setSelection({ type: 'CUE', cueId: cue?.cueId || 'cue_0' });
    } else if (target?.type === 'LAYER') {
      const layer = (this.store.getPreset().layers || [])[target.index || 0];
      this.store.setSelection({ type: 'LAYER', layerId: layer?.id || 'layer_0' });
      this.selectedCueIndex = null;
    } else if (target?.type === 'MAIN') {
      this.store.setSelection({ type: 'MAIN_TRACK' });
      this.selectedCueIndex = null;
    } else {
      this.store.setSelection({ type: 'PRESET' });
      this.selectedCueIndex = null;
    }
    this.updateContextualVisibility(this.store.getPreset());
  }

  public updateContextualVisibility(p: VFXPreset): void {
    const sel = this.store.getSelection();
    const caps = getSelectionCapabilities(p, sel);

    const isCueSelected = sel.type === 'CUE' || this.selectedCueIndex !== null;
    const isBindingSelected = sel.type === 'BINDING';
    const isLayerSelected = sel.type === 'LAYER';

    const slashCard = document.querySelector('.card-slash-section') as HTMLElement;
    if (slashCard) {
      slashCard.style.display = (!isCueSelected && !isBindingSelected && caps.has('SLASH_GEOMETRY')) ? 'block' : 'none';
    }

    const spikeCard = document.querySelector('.card-spike-section') as HTMLElement;
    if (spikeCard) {
      spikeCard.style.display = (!isCueSelected && !isBindingSelected && caps.has('SPIKE_GEOMETRY')) ? 'block' : 'none';
    }

    const salvoCard = document.querySelector('.card-salvo-section') as HTMLElement;
    const isSalvo = (p.salvoCount !== undefined && p.salvoCount > 1);
    if (salvoCard) {
      salvoCard.style.display = (!isCueSelected && !isBindingSelected && caps.has('PROJECTILE_GEOMETRY') && isSalvo) ? 'block' : 'none';
    }

    // 施法動作與受擊回饋卡片：僅在主軌選中或未特選時展示，避免圖層與 Cue 干擾
    const casterCard = document.querySelector('.card-caster-motion') as HTMLElement;
    if (casterCard) {
      casterCard.style.display = (!isCueSelected && !isBindingSelected && caps.has('CASTER_MOTION')) ? 'block' : 'none';
    }

    const impactCard = document.querySelector('.card-impact-section') as HTMLElement;
    if (impactCard) {
      impactCard.style.display = (!isCueSelected && !isBindingSelected && caps.has('IMPACT_FEEDBACK')) ? 'block' : 'none';
    }

    // 🛡️ 依 §5.8 規則：Shield shape 只有 shield renderer 顯示
    const shieldCard = document.querySelector('.card-shield-section') as HTMLElement;
    if (shieldCard) {
      shieldCard.style.display = (!isCueSelected && !isBindingSelected && caps.has('SHIELD_GEOMETRY')) ? 'block' : 'none';
    }

    // 🔥 依 §5.8 規則：Fire turbulence 只有 fire renderer 顯示
    const rowFire = document.getElementById('row-flame-turbulence');
    if (rowFire) {
      rowFire.style.display = (!isCueSelected && !isBindingSelected && caps.has('FIRE_SHADER')) ? 'flex' : 'none';
    }

    // ❄️ 依 §5.8 規則：Fresnel 只有 ice/fresnel shader 顯示
    const colFresnel = document.getElementById('col-fresnel');
    if (colFresnel) {
      colFresnel.style.display = (!isCueSelected && !isBindingSelected && caps.has('ICE_SHADER')) ? 'block' : 'none';
    }

    // 隱藏 Legacy trajectory 與無效欄位
    const legacyTraj = document.getElementById('param-trajectory');
    if (legacyTraj) {
      const col = (typeof legacyTraj.closest === 'function')
        ? (legacyTraj.closest('.param-col') || legacyTraj.closest('.param-row'))
        : legacyTraj.parentElement;
      if (col) (col as HTMLElement).style.display = 'none';
    }

    const textureSprite = document.getElementById('param-texture-sprite');
    if (textureSprite) {
      const col = (typeof textureSprite.closest === 'function')
        ? (textureSprite.closest('.param-col') || textureSprite.closest('.param-row'))
        : textureSprite.parentElement;
      if (col) (col as HTMLElement).style.display = 'none';
    }

    // 🚀 當空間發生模式為原地類（AT_CASTER / AT_TARGET）時，隱藏位移路徑選單
    const rowTrajPath = document.getElementById('row-trajectory-path');
    if (rowTrajPath) {
      const activeSpatial = p.spatialMode || 'TRAJECTORY';
      rowTrajPath.style.display = (activeSpatial !== 'AT_CASTER' && activeSpatial !== 'AT_TARGET') ? 'block' : 'none';
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
    if (index !== null) {
      const cue = (this.store.getPreset().impactCues || [])[index];
      this.store.setSelection({ type: 'CUE', cueId: cue?.cueId || `cue_${index}` });
    }
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

    // 🎯 依模式控制 cue.weight 顯隱 (僅在 SPLIT_SINGLE_IMPACT 時顯示)
    const mode = preset.impactPresentationMode || 'EXACT_IMPACTS';
    const rowWeight = (inputWeight && typeof inputWeight.closest === 'function') 
      ? (inputWeight.closest('.param-row') as HTMLElement) 
      : (inputWeight?.parentElement as HTMLElement | null);
    if (rowWeight) {
      rowWeight.style.display = (mode === 'SPLIT_SINGLE_IMPACT') ? 'block' : 'none';
    }

    // ⭐ 依 §5.8 規則：cue.isPrimary 在 PRIMARY_ONLY 必顯示，其他模式標示用途
    const lblPrimary = chkPrimary ? (chkPrimary.nextElementSibling as HTMLElement) : null;
    if (lblPrimary) {
      if (mode === 'PRIMARY_ONLY') {
        lblPrimary.textContent = '⭐ 主要終結打擊點 (PRIMARY_ONLY 於此點顯示完整數值)';
      } else {
        lblPrimary.textContent = '⭐ 標記為主要打擊點 (當前模式保留為特效音畫同步參考點)';
      }
    }
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
