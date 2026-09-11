import { VFXPreset, getTrajectorySpatialAnchor } from '../../models/VFX';
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
    caps.add('IMPACT_FEEDBACK');
    caps.add('CASTER_MOTION');
  }

  // PRESET, MAIN_TRACK, CUE, LAYER 基本能力
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
  { id: 'param-enable-trail', key: 'enableTrail', type: 'select-boolean', defaultVal: false, capability: 'SLASH_GEOMETRY' },
  { id: 'param-trail-color', key: 'trailColor', type: 'color', defaultVal: '#f59e0b', capability: 'SLASH_GEOMETRY' },
  { id: 'param-trail-count', labelId: 'val-trail-count', key: 'trailCount', type: 'range', unit: '', defaultVal: 40, capability: 'PARTICLES' },
  { id: 'param-trail-size', labelId: 'val-trail-size', key: 'trailSize', type: 'range', unit: 'px', defaultVal: 10, capability: 'PARTICLES' },
  { id: 'param-burst-count', labelId: 'val-burst-count', key: 'burstCount', type: 'range', unit: ' 顆', defaultVal: 60, capability: 'PARTICLES' },

  // 4. ⚔️ 斬擊走向與形態 (Slash Section)
  { id: 'param-slash-traj', key: 'slashTrajectory', type: 'select', defaultVal: 'CLEAVE_DOWN', capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-shape', key: 'slashShape', type: 'select', defaultVal: 'CRESCENT', capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-rot-x', labelId: 'val-slash-rot-x', key: 'slashRotX', type: 'range', unit: '°', defaultVal: 0, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-rot-y', labelId: 'val-slash-rot-y', key: 'slashRotY', type: 'range', unit: '°', defaultVal: 0, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-rot-z', labelId: 'val-slash-rot-z', key: 'slashRotZ', type: 'range', unit: '°', defaultVal: -45, capability: 'SLASH_GEOMETRY' },
  { id: 'param-slash-angle', key: 'slashAngle', type: 'range', unit: '°', defaultVal: -45, capability: 'SLASH_GEOMETRY' },
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

  // 🌟 若傳入的是標準 VFXSequence，自動提取主軌與粒子軌真實 clip 數據，保證 SSOT 絕不丟失
  if ((preset as any).tracks && Array.isArray((preset as any).tracks)) {
    const tracks: any[] = (preset as any).tracks;
    const mainTrack = tracks.find(t => t.id === 'trk_main' || t.type === 'MESH' || t.type === 'SLASH') || tracks[0];
    const mainData = mainTrack?.clips?.[0]?.payload?.data || {};
    const partTrack = tracks.find(t => t.type === 'PARTICLE');
    const partData = partTrack?.clips?.[0]?.payload?.data || {};
    const impactTrack = tracks.find(t => t.type === 'IMPACT');
    const impactData = impactTrack?.clips?.[0]?.payload?.data || {};

    Object.assign(normalized, {
      ...mainData,
      slashRotX: mainData.rotX ?? mainData.slashRotX ?? normalized.slashRotX,
      slashRotY: mainData.rotY ?? mainData.slashRotY ?? normalized.slashRotY,
      slashRotZ: mainData.rotZ ?? mainData.slashRotZ ?? mainData.angle ?? normalized.slashRotZ,
      slashAngle: mainData.angle ?? mainData.slashAngle ?? mainData.rotZ ?? normalized.slashAngle,
      slashArcSpan: mainData.arcSpan ?? mainData.slashArcSpan ?? normalized.slashArcSpan,
      slashBladeWidth: mainData.bladeWidth ?? mainData.slashBladeWidth ?? normalized.slashBladeWidth,
      slashRadius: mainData.radius ?? mainData.slashRadius ?? normalized.slashRadius,
      slashAspect: mainData.aspect ?? mainData.slashAspect ?? normalized.slashAspect,
      slashShape: mainData.shape ?? mainData.slashShape ?? normalized.slashShape,
      slashReverse: mainData.reverse ?? mainData.slashReverse ?? normalized.slashReverse,
      trailCount: mainData.trailCount ?? partData.trailCount ?? normalized.trailCount,
      trailSize: mainData.trailSize ?? partData.trailSize ?? normalized.trailSize,
      burstCount: mainData.burstCount ?? partData.burstCount ?? normalized.burstCount,
      enableTrail: mainData.enableTrail ?? partData.enableTrail ?? normalized.enableTrail,
      trailColor: mainData.trailColor ?? partData.trailColor ?? normalized.trailColor
    });

    normalized.impact = { ...impactData, ...normalized.impact };
  }

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
          } else if (c.id === 'param-slash-rot-x') {
            this.store.updateConfig({ slashRotX: val, rotX: val }, false);
          } else if (c.id === 'param-slash-rot-y') {
            this.store.updateConfig({ slashRotY: val, rotY: val }, false);
          } else if (c.id === 'param-slash-rot-z' || c.id === 'param-slash-angle') {
            this.store.updateConfig({ slashRotZ: val, rotZ: val, slashAngle: val, angle: val }, false);
          } else if (c.id === 'param-slash-width') {
            this.store.updateConfig({ slashBladeWidth: val, bladeWidth: val }, false);
          } else if (c.id === 'param-slash-radius') {
            this.store.updateConfig({ slashRadius: val, radius: val }, false);
          } else if (c.id === 'param-slash-arc-span') {
            this.store.updateConfig({ slashArcSpan: val, arcSpan: val }, false);
          } else if (c.id === 'param-slash-aspect') {
            this.store.updateConfig({ slashAspect: val, aspect: val }, false);
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
          } else if (c.id === 'param-slash-shape') {
            this.store.updateConfig({ slashShape: val as any, shape: val as any }, false);
          } else if (c.id === 'param-slash-traj') {
            const updates: any = { slashTrajectory: val as any };
            if (val === 'CLEAVE_DOWN') {
              updates.slashAngle = -45;
              updates.angle = -45;
              updates.slashRotX = 0;
              updates.rotX = 0;
              updates.slashRotY = 0;
              updates.rotY = 0;
              updates.slashRotZ = -45;
              updates.rotZ = -45;
              updates.slashArcSpan = 120;
              updates.arcSpan = 120;
              updates.slashReverse = false;
              updates.reverse = false;
            } else if (val === 'UPPER_CUT') {
              updates.slashAngle = 135;
              updates.angle = 135;
              updates.slashRotX = 0;
              updates.rotX = 0;
              updates.slashRotY = 0;
              updates.rotY = 0;
              updates.slashRotZ = 135;
              updates.rotZ = 135;
              updates.slashArcSpan = 110;
              updates.arcSpan = 110;
              updates.slashReverse = true;
              updates.reverse = true;
            } else if (val === 'HORIZONTAL') {
              updates.slashAngle = -15;
              updates.angle = -15;
              updates.slashRotX = 0;
              updates.rotX = 0;
              updates.slashRotY = 0;
              updates.rotY = 0;
              updates.slashRotZ = -15;
              updates.rotZ = -15;
              updates.slashArcSpan = 140;
              updates.arcSpan = 140;
              updates.slashReverse = false;
              updates.reverse = false;
            } else if (val === 'VERTICAL_DOWN') {
              updates.slashAngle = 90;
              updates.angle = 90;
              updates.slashRotX = 0;
              updates.rotX = 0;
              updates.slashRotY = 0;
              updates.rotY = 0;
              updates.slashRotZ = 90;
              updates.rotZ = 90;
              updates.slashArcSpan = 130;
              updates.arcSpan = 130;
              updates.slashReverse = false;
              updates.reverse = false;
            }
            this.store.updateConfig(updates, false);
            this.syncUI(this.store.getPreset());
          } else if (c.id === 'param-trajectory') {
            const anchor = getTrajectorySpatialAnchor(val);
            const spatialMode = anchor === 'TRAJECTORY' ? 'TRAJECTORY' : anchor;
            this.store.updateConfig({ trajectory: val as any, spatialMode: spatialMode as any }, false);
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
          if (c.id === 'param-slash-reverse') {
            this.store.updateConfig({ slashReverse: val, reverse: val }, false);
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
      slashCard.style.display = (!isBindingSelected && caps.has('SLASH_GEOMETRY')) ? 'block' : 'none';
    }

    const particleCard = document.querySelector('.card-particle-section') as HTMLElement;
    if (particleCard) {
      particleCard.style.display = (!isBindingSelected && caps.has('PARTICLES')) ? 'block' : 'none';
    }

    const spikeCard = document.querySelector('.card-spike-section') as HTMLElement;
    if (spikeCard) {
      spikeCard.style.display = (!isBindingSelected && caps.has('SPIKE_GEOMETRY')) ? 'block' : 'none';
    }

    const salvoCard = document.querySelector('.card-salvo-section') as HTMLElement;
    if (salvoCard) {
      // 🚀 徹底解鎖彈幕卡片：只要是投射物幾何，隨時開放創作者調整發射彈數、節奏與散佈
      salvoCard.style.display = (!isBindingSelected && caps.has('PROJECTILE_GEOMETRY')) ? 'block' : 'none';
    }

    // 施法動作與受擊回饋卡片：在主軌或常規編輯時始終開放調整
    const casterCard = document.querySelector('.card-caster-motion') as HTMLElement;
    if (casterCard) {
      casterCard.style.display = (!isBindingSelected && caps.has('CASTER_MOTION')) ? 'block' : 'none';
    }

    const impactCard = document.querySelector('.card-impact-section') as HTMLElement;
    if (impactCard) {
      impactCard.style.display = (!isBindingSelected && caps.has('IMPACT_FEEDBACK')) ? 'block' : 'none';
    }

    // 🛡️ 依 §5.8 規則：Shield shape 只有 shield renderer 顯示
    const shieldCard = document.querySelector('.card-shield-section') as HTMLElement;
    if (shieldCard) {
      shieldCard.style.display = (!isBindingSelected && caps.has('SHIELD_GEOMETRY')) ? 'block' : 'none';
    }

    // 🔥 依 §5.8 規則：Fire turbulence 只有 fire renderer 顯示
    const rowFire = document.getElementById('row-flame-turbulence');
    if (rowFire) {
      rowFire.style.display = (!isBindingSelected && caps.has('FIRE_SHADER')) ? 'flex' : 'none';
    }

    // ❄️ 依 §5.8 規則：Fresnel 只有 ice/fresnel shader 顯示
    const colFresnel = document.getElementById('col-fresnel');
    if (colFresnel) {
      colFresnel.style.display = (!isBindingSelected && caps.has('ICE_SHADER')) ? 'block' : 'none';
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

    if (index !== null) {
      const cueCard = document.getElementById('card-cue-inspector');
      if (cueCard && typeof cueCard.scrollIntoView === 'function') {
        cueCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        cueCard.classList.remove('cue-card-highlight');
        if (typeof (cueCard as any).offsetWidth === 'number') {
          void (cueCard as any).offsetWidth;
        }
        cueCard.classList.add('cue-card-highlight');
      }
    }
  }

  private syncSelectedCueUI(preset: VFXPreset): void {
    const cueCard = document.getElementById('card-cue-inspector');
    if (!cueCard) return;

    if (!this.isCueBindingDone) {
      this.bindCueControls();
      this.isCueBindingDone = true;
    }

    const cues = preset.impactCues || [];
    cueCard.style.display = 'block';

    const tabsContainer = document.getElementById('cue-selector-tabs');
    const bodyEl = typeof (cueCard as any).querySelector === 'function'
      ? (cueCard as any).querySelector('.inspector-card-body') as HTMLElement | null
      : null;

    if (cues.length === 0) {
      this.selectedCueIndex = null;
      if (tabsContainer) {
        tabsContainer.innerHTML = `
          <span style="font-size: 0.72rem; color: #94a3b8;">目前尚無打擊 Cue 點</span>
          <button id="btn-add-first-cue" style="background: #f59e0b; color: #000; border: none; font-weight: bold; border-radius: 3px; font-size: 0.68rem; padding: 2px 8px; cursor: pointer;">➕ 新增打擊 Cue</button>
        `;
        if (typeof tabsContainer.querySelector === 'function') {
          tabsContainer.querySelector('#btn-add-first-cue')?.addEventListener('click', () => {
            this.store.recordSnapshot();
            const newCue = {
              cueId: `hit_${Date.now() % 10000}`,
              time: Number(((preset.duration || 0.5) * 0.5).toFixed(2)),
              kind: 'IMPACT' as const,
              weight: 1.0,
              isPrimary: true
            };
            this.store.updateConfig({ impactCues: [newCue] }, true);
            this.setSelectedCueIndex(0);
            this.triggerChange();
          });
        }
      }
      if (bodyEl) bodyEl.style.display = 'none';
      return;
    }

    if (bodyEl) bodyEl.style.display = 'block';

    // 若未特選或索引越界，預設選取第 0 個 Cue
    if (this.selectedCueIndex === null || this.selectedCueIndex < 0 || this.selectedCueIndex >= cues.length) {
      this.selectedCueIndex = 0;
    }

    // 渲染 Cue 標籤切換列
    if (tabsContainer) {
      tabsContainer.innerHTML = '';
      cues.forEach((c, idx) => {
        const isSel = idx === this.selectedCueIndex;
        const tabBtn = document.createElement('button');
        tabBtn.style.cssText = isSel
          ? 'background: #f59e0b; color: #000; border: 1px solid #fbbf24; font-weight: bold; border-radius: 3px; font-size: 0.68rem; padding: 2px 7px; cursor: pointer;'
          : 'background: #272013; color: #f59e0b; border: 1px solid #78350f; border-radius: 3px; font-size: 0.68rem; padding: 2px 7px; cursor: pointer;';
        tabBtn.textContent = `🎯 #${idx + 1} ${(c.time || 0).toFixed(2)}s`;
        tabBtn.onclick = () => this.setSelectedCueIndex(idx);
        tabsContainer.appendChild(tabBtn);
      });

      const addBtn = document.createElement('button');
      addBtn.style.cssText = 'background: #1e293b; color: #38bdf8; border: 1px dashed #38bdf8; border-radius: 3px; font-size: 0.68rem; padding: 2px 6px; cursor: pointer; margin-left: auto;';
      addBtn.textContent = '➕ 加 Cue';
      addBtn.onclick = () => {
        this.store.recordSnapshot();
        const lastCueTime = cues[cues.length - 1]?.time ?? 0.2;
        const nextTime = Number(Math.min((preset.duration || 1.0), lastCueTime + 0.15).toFixed(2));
        const newCue = {
          cueId: `hit_${cues.length + 1}`,
          time: nextTime,
          kind: 'IMPACT' as const,
          weight: 1.0,
          isPrimary: false
        };
        const updated = [...cues, newCue];
        this.store.updateConfig({ impactCues: updated }, true);
        this.setSelectedCueIndex(updated.length - 1);
        this.triggerChange();
      };
      tabsContainer.appendChild(addBtn);
    }

    const cue = cues[this.selectedCueIndex];
    if (!cue) return;

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
