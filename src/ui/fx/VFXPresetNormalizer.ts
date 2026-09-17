import { VFXPreset, VFXSequence } from '../../models/VFX';
import { resolvePresetSpatialTopology } from './VFXSpatialPolicy';

export type InspectorCapability =
  | 'TRANSFORM'
  | 'TRAJECTORY'
  | 'SLASH_GEOMETRY'
  | 'PROJECTILE_GEOMETRY'
  | 'SPIKE_GEOMETRY'
  | 'SHIELD_GEOMETRY'
  | 'SHOUT_GEOMETRY'
  | 'PARTICLES'
  | 'FIRE_SHADER'
  | 'ICE_SHADER'
  | 'IMPACT_FEEDBACK'
  | 'CASTER_MOTION'
  | 'BINDING'
  | 'CUE';

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
 * 🗺️ 單一真相來源之 Inspector 控制項契約表 (Inspector Control Map)
 */
export const INSPECTOR_CONTROL_MAP: ControlConfig[] = [
  // 1. 🌐 基礎彈道與時空節奏
  { id: 'param-spatial-topology', key: 'spatialTopology', type: 'select', defaultVal: 'POINT_TRANSPORT', capability: 'TRAJECTORY' },
  { id: 'param-spatial-mode', key: 'spatialMode', type: 'select', defaultVal: 'TRAJECTORY', capability: 'TRAJECTORY' },
  { id: 'param-trajectory-path', key: 'trajectoryPath', type: 'select', defaultVal: 'A_TO_B', capability: 'TRAJECTORY' },
  { id: 'param-reverse', key: 'reverse', type: 'select-boolean', defaultVal: false, capability: 'TRAJECTORY' },
  { id: 'param-target-offset-x', labelId: 'val-target-offset-x', key: 'targetOffsetX', type: 'range', unit: 'px', defaultVal: 0, capability: 'TRAJECTORY' },
  { id: 'param-target-offset-y', labelId: 'val-target-offset-y', key: 'targetOffsetY', type: 'range', unit: 'px', defaultVal: 0, capability: 'TRAJECTORY' },
  { id: 'param-track-offset-x', labelId: 'val-track-offset-x', key: 'trackOffsetX', type: 'range', unit: 'px', defaultVal: 0, capability: 'TRAJECTORY' },
  { id: 'param-track-offset-y', labelId: 'val-track-offset-y', key: 'trackOffsetY', type: 'range', unit: 'px', defaultVal: 0, capability: 'TRAJECTORY' },
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
  { id: 'param-enable-trail', key: 'enableTrail', type: 'select-boolean', defaultVal: false, capability: 'PARTICLES' },
  { id: 'param-trail-color', key: 'trailColor', type: 'color', defaultVal: '#f59e0b', capability: 'PARTICLES' },
  { id: 'param-trail-count', labelId: 'val-trail-count', key: 'trailCount', type: 'range', unit: '', defaultVal: 40, capability: 'PARTICLES' },
  { id: 'param-trail-size', labelId: 'val-trail-size', key: 'trailSize', type: 'range', unit: 'px', defaultVal: 10, capability: 'PARTICLES' },
  { id: 'param-burst-count', labelId: 'val-burst-count', key: 'burstCount', type: 'range', unit: ' 顆', defaultVal: 60, capability: 'PARTICLES' },
  { id: 'param-burst-time', labelId: 'val-burst-time', key: 'burstTime', type: 'range', unit: 's', defaultVal: 0, capability: 'PARTICLES' },
  { id: 'param-trail-spread', labelId: 'val-trail-spread', key: 'trailSpread', type: 'range', unit: 'px', defaultVal: 0, capability: 'PARTICLES' },
  { id: 'param-trail-strands', labelId: 'val-trail-strands', key: 'trailStrands', type: 'range', unit: ' 股', defaultVal: 1, capability: 'PARTICLES' },

  // 4. ⚔️ 斬擊走向與形態 (Slash Section)
  { id: 'param-slash-align-to-path', key: 'slashAlignToPath', type: 'select-boolean', defaultVal: true, capability: 'SLASH_GEOMETRY' },
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
  { id: 'param-salvo-curve', key: 'salvoRhythmCurve', type: 'select', defaultVal: 'LINEAR', capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-salvo-spread', labelId: 'val-salvo-spread', key: 'salvoSpreadAngle', type: 'range', unit: '°', defaultVal: 0, capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-salvo-scatter', labelId: 'val-salvo-scatter', key: 'salvoSpreadRadius', type: 'range', unit: 'px', defaultVal: 0, capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-arc-height', labelId: 'val-arc-height', key: 'arcHeight', type: 'range', unit: 'px', defaultVal: 0, capability: 'PROJECTILE_GEOMETRY' },
  { id: 'param-multihit-impact', key: 'multiHitImpact', type: 'select-boolean', defaultVal: true, capability: 'PROJECTILE_GEOMETRY' },

  // 6. 🏔️ 地刺幾何與破土連鎖 (Spike Section)
  { id: 'param-spike-array-behavior', key: 'spikeArrayBehavior', type: 'select', defaultVal: 'PERSIST_FADE', capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-array-count', labelId: 'val-spike-array-count', key: 'spikeArrayCount', type: 'range', unit: ' 根', defaultVal: 5, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-shape', key: 'spikeShape', type: 'select', defaultVal: 'CONE_SPIKE', capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-angle', labelId: 'val-spike-angle', key: 'spikeAngle', type: 'range', unit: '°', defaultVal: 0, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spikes', labelId: 'val-spikes', key: 'spikes', type: 'range', unit: ' 根', defaultVal: 0, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-width', labelId: 'val-spike-width', key: 'spikeWidth', type: 'range', unit: 'px', defaultVal: 7, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-height', labelId: 'val-spike-height', key: 'spikeHeight', type: 'range', unit: 'px', defaultVal: 45, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-radius', labelId: 'val-spike-radius', key: 'spikeRadius', type: 'range', unit: 'px', defaultVal: 80, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-stagger', labelId: 'val-spike-stagger', key: 'spikeStagger', type: 'range', unit: 'ms', defaultVal: 25, capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-material-mode', key: 'spikeMaterialMode', type: 'select', defaultVal: 'PHONG', capability: 'SPIKE_GEOMETRY' },
  { id: 'param-spike-erupt-fire', key: 'spikeEruptFire', type: 'select-boolean', defaultVal: false, capability: 'SPIKE_GEOMETRY' },

  // 7. 🛡️ 護盾與衝擊震波 (Shield & Shockwave)
  { id: 'param-shield-shape', key: 'shieldShape', type: 'select', defaultVal: 'HEX', capability: 'SHIELD_GEOMETRY' },
  { id: 'param-wave-count', labelId: 'val-wave-count', key: 'waveCount', type: 'range', unit: ' 圈', defaultVal: 3, capability: 'SHOUT_GEOMETRY' },
  { id: 'param-wave-radius', labelId: 'val-wave-radius', key: 'waveRadius', type: 'range', unit: 'px', defaultVal: 65, capability: 'SHOUT_GEOMETRY' },
  { id: 'param-wave-thickness', labelId: 'val-wave-thickness', key: 'waveThickness', type: 'range', unit: 'px', defaultVal: 4, capability: 'SHOUT_GEOMETRY' },
  { id: 'param-wave-blur', labelId: 'val-wave-blur', key: 'waveBlur', type: 'range', unit: '%', defaultVal: 30, capability: 'SHOUT_GEOMETRY' },
  { id: 'param-wave-rot-x', labelId: 'val-wave-rot-x', key: 'waveRotX', type: 'range', unit: '°', defaultVal: 0, capability: 'SHOUT_GEOMETRY' },
  { id: 'param-wave-rot-y', labelId: 'val-wave-rot-y', key: 'waveRotY', type: 'range', unit: '°', defaultVal: 0, capability: 'SHOUT_GEOMETRY' },
  { id: 'param-texture-sprite', key: 'textureSprite', type: 'select', defaultVal: 'GLOW', isHidden: true },

  // 8. 🥊 戰鬥受擊物理反饋 (Impact Feedback)
  { id: 'param-hit-stop', labelId: 'val-hit-stop', key: 'hitStopTime', isImpact: true, type: 'range', unit: 'ms', defaultVal: 55, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-punch-scale', labelId: 'val-punch-scale', key: 'targetPunchScale', isImpact: true, type: 'range', unit: 'x', defaultVal: 0.88, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-shake-intensity', labelId: 'val-shake-intensity', key: 'shakeIntensity', isImpact: true, type: 'range', unit: 'px', defaultVal: 12, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-shake-dur', labelId: 'val-shake-dur', key: 'shakeDuration', isImpact: true, type: 'range', unit: 's', defaultVal: 0.28, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-knockback', labelId: 'val-knockback', key: 'knockbackDistance', isImpact: true, type: 'range', unit: 'px', defaultVal: 18, capability: 'IMPACT_FEEDBACK' },
  { id: 'param-flash-color', key: 'hitFlashColor', isImpact: true, type: 'color', defaultVal: '#ffffff', capability: 'IMPACT_FEEDBACK' },
  { id: 'param-screen-shake', key: 'screenShake', isImpact: true, type: 'checkbox', defaultVal: false, capability: 'IMPACT_FEEDBACK' },

  // 9. 🏃 施術者發力動作力學反饋 (Caster Motion)
  { id: 'param-caster-step', labelId: 'val-caster-step', key: 'stepForward', isCasterMotion: true, type: 'range', unit: 'px', defaultVal: 0, capability: 'CASTER_MOTION' },
  { id: 'param-caster-recoil', labelId: 'val-caster-recoil', key: 'recoil', isCasterMotion: true, type: 'range', unit: 'px', defaultVal: 0, capability: 'CASTER_MOTION' },
  { id: 'param-caster-tilt', labelId: 'val-caster-tilt', key: 'tiltAngle', isCasterMotion: true, type: 'range', unit: '°', defaultVal: 0, capability: 'CASTER_MOTION' },
  { id: 'param-caster-motion-dur', labelId: 'val-caster-motion-dur', key: 'motionDuration', isCasterMotion: true, type: 'range', unit: 's', defaultVal: 0.3, capability: 'CASTER_MOTION' }
];

/**
 * 🛡️ 將任意 VFXPreset 或 VFXSequence 補齊拍平欄位與預設值，消除任何 undefined / NaN 洩漏風險
 */
export function normalizeVfxPreset(preset: VFXPreset | VFXSequence): VFXPreset & VFXSequence {
  const normalized: any = { ...preset };
  normalized.impact = { ...((preset as any).impact || {}) };
  normalized.casterMotion = { ...((preset as any).casterMotion || {}) };

  // 🌟 若傳入的是標準 VFXSequence，自動提取主軌、粒子軌與受擊軌真實 clip 數據，保證 SSOT 絕不丟失
  if ((preset as any).tracks && Array.isArray((preset as any).tracks)) {
    const tracks: any[] = (preset as any).tracks;
    const mainTrack = tracks.find(t => t.id === 'trk_main' || t.type === 'MESH' || t.type === 'SLASH') || tracks[0];
    const mainClip = mainTrack?.clips?.[0];
    const mainData = mainClip?.payload?.data || {};
    const partTrack = tracks.find(t => t.type === 'PARTICLE');
    const partData = partTrack?.clips?.[0]?.payload?.data || {};
    const impactTrack = tracks.find(t => t.type === 'IMPACT');
    const impactData = impactTrack?.clips?.[0]?.payload?.data || {};

    // 提取主軌時長與延遲
    if (mainClip) {
      normalized.mainDelay = mainClip.startTime ?? normalized.mainDelay ?? 0;
      normalized.mainDuration = mainClip.duration ?? normalized.mainDuration ?? normalized.duration;
    }

    const {
      layers: _ignLayers,
      tracks: _ignTracks,
      impactCues: _ignCues,
      duration: _ignDur,
      ...cleanMainData
    } = mainData;

    const explicitSpatialMode = (preset as any).spatialMode || mainData.spatialMode;
    const explicitTopology = (preset as any).spatialTopology || mainData.spatialTopology;
    const rawMode = explicitSpatialMode || (preset as any).trajectoryPath || mainData.trajectoryPath || (preset as any).trajectory || mainData.trajectory || 'A_TO_B';
    let mappedSpatialMode = 'TRAJECTORY';
    let mappedTrajectoryPath = 'A_TO_B';

    if (explicitSpatialMode === 'TRAJECTORY' || explicitTopology === 'POINT_TRANSPORT') {
      mappedSpatialMode = 'TRAJECTORY';
      const pathCandidate = (preset as any).trajectoryPath || mainData.trajectoryPath || (preset as any).trajectory || mainData.trajectory;
      if (pathCandidate && pathCandidate !== 'AT_TARGET' && pathCandidate !== 'MELEE_SWEEP' && pathCandidate !== 'AT_CASTER') {
        mappedTrajectoryPath = pathCandidate;
      } else {
        mappedTrajectoryPath = 'A_TO_B';
      }
    } else if (rawMode === 'AT_CASTER' || rawMode === 'BODY_AURA' || rawMode === 'SHIELD_BARRIER' || rawMode === 'SHOUT_WAVE') {
      mappedSpatialMode = 'AT_CASTER';
    } else if (rawMode === 'AT_TARGET' || rawMode === 'MELEE_SWEEP') {
      mappedSpatialMode = 'AT_TARGET';
    } else {
      mappedSpatialMode = 'TRAJECTORY';
      if (rawMode === 'VERTICAL_DROP' || rawMode === 'VERTICAL_SKY_TO_B') {
        mappedTrajectoryPath = 'VERTICAL_SKY_TO_B';
      } else if (rawMode === 'DIAGONAL_DROP' || rawMode === 'DIAGONAL_SKY_TO_B') {
        mappedTrajectoryPath = 'DIAGONAL_SKY_TO_B';
      } else if (rawMode === 'A_TO_VERTICAL_SKY') {
        mappedTrajectoryPath = 'A_TO_VERTICAL_SKY';
      } else if (rawMode === 'A_TO_DIAGONAL_SKY') {
        mappedTrajectoryPath = 'A_TO_DIAGONAL_SKY';
      } else {
        mappedTrajectoryPath = (preset as any).trajectoryPath || mainData.trajectoryPath || 'A_TO_B';
      }
    }

    Object.assign(normalized, {
      ...cleanMainData,
      spatialTopology: (preset as any).spatialTopology || mainData.spatialTopology || resolvePresetSpatialTopology(preset || mainData),
      spatialMode: mappedSpatialMode,
      trajectoryPath: mappedTrajectoryPath,
      reverse: mainData.reverse ?? (preset as any).reverse ?? false,
      // 斬擊幾何對齊
      slashAlignToPath: mainData.slashAlignToPath ?? (preset as any).slashAlignToPath ?? true,
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
      slashAngleJitter: mainData.angleJitter ?? mainData.slashAngleJitter ?? normalized.slashAngleJitter,
      slashAlternating: mainData.isAlternating ?? mainData.slashAlternating ?? normalized.slashAlternating,
      // 地裂尖刺對齊
      spikeArrayBehavior: mainData.spikeArrayBehavior ?? (preset as any).spikeArrayBehavior ?? 'PERSIST_FADE',
      spikeArrayCount: mainData.spikeArrayCount ?? (preset as any).spikeArrayCount ?? 5,
      spikes: mainData.spikes ?? normalized.spikes,
      spikeShape: mainData.spikeShape ?? normalized.spikeShape,
      spikeWidth: mainData.spikeWidth ?? normalized.spikeWidth,
      spikeHeight: mainData.spikeHeight ?? normalized.spikeHeight,
      spikeRadius: mainData.spikeRadius ?? normalized.spikeRadius,
      spikeStagger: mainData.spikeStagger ?? normalized.spikeStagger,
      spikeAngle: mainData.spikeAngle ?? normalized.spikeAngle,
      spikeMaterialMode: mainData.spikeMaterialMode ?? normalized.spikeMaterialMode,
      spikeEruptFire: mainData.spikeEruptFire ?? normalized.spikeEruptFire,
      // 彈幕連射對齊
      salvoCount: mainData.salvoCount ?? (mainData.salvo?.count) ?? normalized.salvoCount,
      salvoDuration: mainData.salvoDuration ?? (mainData.salvo?.duration) ?? normalized.salvoDuration,
      salvoRhythmCurve: mainData.salvoRhythmCurve ?? (mainData.salvo?.rhythm) ?? normalized.salvoRhythmCurve,
      salvoSpreadAngle: mainData.salvoSpreadAngle ?? (mainData.salvo?.spreadAngle) ?? normalized.salvoSpreadAngle,
      salvoSpreadRadius: mainData.salvoSpreadRadius ?? (mainData.salvo?.spreadRadius) ?? normalized.salvoSpreadRadius,
      arcHeight: mainData.arcHeight ?? normalized.arcHeight,
      multiHitImpact: mainData.multiHitImpact ?? normalized.multiHitImpact,
      // 著色與光學對齊
      glowRadius: mainData.glowRadius ?? normalized.glowRadius,
      glowOpacity: mainData.glowOpacity ?? normalized.glowOpacity,
      coreBrightness: mainData.coreBrightness ?? normalized.coreBrightness,
      flameTurbulence: mainData.flameTurbulence ?? normalized.flameTurbulence,
      flameTurbulenceSpeed: mainData.flameTurbulenceSpeed ?? mainData.flameSpeed ?? normalized.flameTurbulenceSpeed,
      coreMeshShape: mainData.coreMeshShape ?? mainData.shape ?? normalized.coreMeshShape,
      spin: mainData.spin ?? normalized.spin,
      fresnel: mainData.fresnel ?? normalized.fresnel,
      // 粒子軌跡對齊
      trailCount: mainData.trailCount ?? partData.trailCount ?? normalized.trailCount,
      trailSize: mainData.trailSize ?? partData.trailSize ?? normalized.trailSize,
      trailSpread: mainData.trailSpread ?? partData.trailSpread ?? (preset as any).trailSpread ?? normalized.trailSpread ?? 0,
      trailStrands: mainData.trailStrands ?? partData.trailStrands ?? (preset as any).trailStrands ?? normalized.trailStrands ?? 1,
      burstCount: mainData.burstCount ?? partData.burstCount ?? normalized.burstCount,
      burstTime: mainData.burstTime ?? partData.burstTime ?? normalized.burstTime,
      enableTrail: mainData.enableTrail ?? partData.enableTrail ?? normalized.enableTrail,
      trailColor: mainData.trailColor ?? partData.trailColor ?? normalized.trailColor,
      // 空間座標偏移對齊
      targetOffsetX: mainData.targetOffsetX ?? (preset as any).targetOffsetX ?? normalized.targetOffsetX ?? 0,
      targetOffsetY: mainData.targetOffsetY ?? (preset as any).targetOffsetY ?? normalized.targetOffsetY ?? 0,
      trackOffsetX: mainData.trackOffsetX ?? (preset as any).trackOffsetX ?? normalized.trackOffsetX ?? 0,
      trackOffsetY: mainData.trackOffsetY ?? (preset as any).trackOffsetY ?? normalized.trackOffsetY ?? 0,
      // 🌊 震波幾何對齊
      waveCount: mainData.waveCount ?? (preset as any).waveCount ?? normalized.waveCount,
      waveRadius: mainData.waveRadius ?? (preset as any).waveRadius ?? normalized.waveRadius,
      waveThickness: mainData.waveThickness ?? (preset as any).waveThickness ?? normalized.waveThickness,
      waveBlur: mainData.waveBlur ?? (preset as any).waveBlur ?? normalized.waveBlur,
      waveRotX: mainData.waveRotX ?? (preset as any).waveRotX ?? normalized.waveRotX,
      waveRotY: mainData.waveRotY ?? (preset as any).waveRotY ?? normalized.waveRotY,
      // 🛡️ 護盾外觀對齊
      shieldShape: mainData.shieldShape ?? (preset as any).shieldShape ?? normalized.shieldShape ?? 'HEX'
    });

    normalized.impact = {
      ...impactData,
      ...normalized.impact
    };
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

  return normalized as VFXPreset & VFXSequence;
}
