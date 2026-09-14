import * as THREE from 'three';
import { VFXPreset, VFXSpatialMode, VFXSpatialTopology, VFXTrajectory, VFXTrajectoryPath } from '../../models/VFX';

type SpatialPreset = Pick<VFXPreset, 'spatialTopology' | 'spatialMode' | 'trajectory' | 'trajectoryPath' | 'shaderMode' | 'rendererType'>;

export const VFX_RENDER_ORDER = {
  GROUND: 1,
  MAIN: 5,
  TRAIL: 8,
  IMPACT: 10
} as const;

/** 規範新版：依據空間傳播形態解析，向下相容歷史 Preset */
export function resolvePresetSpatialTopology(preset: Partial<SpatialPreset>): VFXSpatialTopology {
  if (preset.spatialTopology) return preset.spatialTopology;

  if (preset.trajectory === 'GROUND_FISSURE' || preset.rendererType === 'GROUND_FISSURE') {
    return 'STAGGERED_ARRAY';
  }
  if (
    preset.shaderMode === 'DIELECTRIC_LIGHTNING' ||
    preset.shaderMode === 'ENERGY_BEAM' ||
    preset.rendererType === 'LIGHTNING' ||
    preset.rendererType === 'BEAM'
  ) {
    return 'SPAN_BEAM';
  }
  if (
    preset.trajectory === 'MELEE_SWEEP' ||
    preset.trajectory === 'BODY_AURA' ||
    preset.trajectory === 'SHIELD_BARRIER' ||
    preset.trajectory === 'SHOUT_WAVE' ||
    preset.spatialMode === 'AT_TARGET' ||
    preset.spatialMode === 'AT_CASTER' ||
    preset.shaderMode === 'SLASH_BLADE' ||
    preset.rendererType === 'SLASH'
  ) {
    return 'LOCAL_MORPH';
  }

  return 'POINT_TRANSPORT';
}

/** Keep legacy trajectory-only presets on the same spatial policy as authored presets. */
export function resolvePresetSpatialMode(preset: Partial<SpatialPreset>): VFXSpatialMode {
  if (preset.spatialMode) return preset.spatialMode;
  if (preset.trajectoryPath) return preset.trajectoryPath;

  switch (preset.trajectory) {
    case 'VERTICAL_DROP':
      return 'VERTICAL_SKY_TO_B';
    case 'DIAGONAL_DROP':
      return 'DIAGONAL_SKY_TO_B';
    case 'BODY_AURA':
    case 'SHIELD_BARRIER':
    case 'SHOUT_WAVE':
      return 'AT_CASTER';
    case 'MELEE_SWEEP':
    case 'GROUND_BURST':
      return 'AT_TARGET';
    default:
      return 'A_TO_B';
  }
}

/** Resolve the authored start point before dispatching a nested or dynamic effect. */
export function resolveVFXWorldStart(
  mode: VFXSpatialMode | VFXTrajectoryPath | VFXTrajectory | string | undefined,
  casterPos: THREE.Vector3,
  targetPos: THREE.Vector3
): THREE.Vector3 {
  if (mode === 'VERTICAL_DROP' || mode === 'VERTICAL_SKY_TO_B') {
    return new THREE.Vector3(targetPos.x, targetPos.y + 380, targetPos.z);
  }
  if (mode === 'DIAGONAL_DROP' || mode === 'DIAGONAL_SKY_TO_B') {
    return new THREE.Vector3(targetPos.x - 260, targetPos.y + 380, targetPos.z);
  }
  if (mode === 'GROUND_BURST') {
    return new THREE.Vector3(targetPos.x, targetPos.y - 120, targetPos.z);
  }
  if (mode === 'AT_TARGET' || mode === 'MELEE_SWEEP') return targetPos.clone();
  return casterPos.clone();
}

export interface VFXEndpoints {
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
}

/**
 * 🌐 全域通用空間座標與時空路徑求解器 (Universal Spatial Kinematics Pipeline)
 * 嚴格遵循 Rule 9：單一真相來源，100% 統一所有特效（天雷、光束、火球、冰槍、飛劍、穿透箭、狙擊彈、地刺）的起點與終點
 */
export function resolveVFXEndpoints(
  spatialMode: string | undefined,
  trajectoryPath: string | undefined,
  trajectory: string | undefined,
  reverse: boolean,
  casterPos: THREE.Vector3,
  targetPos: THREE.Vector3,
  penetrationDist: number = 0,
  options?: {
    shaderMode?: string;
    spatialTopology?: VFXSpatialTopology;
  }
): VFXEndpoints {
  const isSpanBeam =
    options?.spatialTopology === 'SPAN_BEAM' ||
    options?.shaderMode === 'DIELECTRIC_LIGHTNING' ||
    options?.shaderMode === 'ENERGY_BEAM';

  let mode = spatialMode || trajectoryPath || trajectory || 'A_TO_B';
  if (mode === 'TRAJECTORY') {
    mode = trajectoryPath || trajectory || 'A_TO_B';
  }

  // 跨空間幾何體（電弧/光束）：若使用者指定了具體路徑（如天降直劈或貫穿），其優先權高於近戰殘留的 AT_TARGET
  if (isSpanBeam) {
    if (trajectoryPath && trajectoryPath !== 'DEFAULT') {
      mode = trajectoryPath;
    } else if (trajectory && trajectory !== 'MELEE_SWEEP') {
      mode = trajectory;
    } else if (mode === 'AT_TARGET' || mode === 'MELEE_SWEEP') {
      mode = 'A_TO_B';
    }
  }

  // 🚀 質點傳播（POINT_TRANSPORT）：位移型子彈絕對不可被舊近戰 MELEE_SWEEP / 原地 AT_TARGET 污染為起終點塌縮
  if (options?.spatialTopology === 'POINT_TRANSPORT' || spatialMode === 'TRAJECTORY') {
    if (mode === 'AT_TARGET' || mode === 'MELEE_SWEEP') {
      mode = (trajectoryPath && trajectoryPath !== 'DEFAULT') ? trajectoryPath : 'A_TO_B';
    }
  }

  let actualEnd = targetPos.clone();
  if (penetrationDist > 0) {
    const dir = new THREE.Vector3().subVectors(targetPos, casterPos).normalize();
    actualEnd.addScaledVector(dir, penetrationDist);
  }

  let start: THREE.Vector3;
  let end: THREE.Vector3;

  switch (mode) {
    case 'VERTICAL_DROP':
    case 'VERTICAL_SKY_TO_B': {
      start = new THREE.Vector3(actualEnd.x, actualEnd.y + 380, actualEnd.z);
      end = actualEnd.clone();
      break;
    }
    case 'DIAGONAL_DROP':
    case 'DIAGONAL_SKY_TO_B': {
      const offsetX = Math.max(260, Math.abs(actualEnd.x - casterPos.x) * 0.7);
      start = new THREE.Vector3(actualEnd.x - offsetX, actualEnd.y + 380, actualEnd.z);
      end = actualEnd.clone();
      break;
    }
    case 'A_TO_VERTICAL_SKY': {
      start = casterPos.clone();
      end = new THREE.Vector3(casterPos.x, casterPos.y + 380, casterPos.z);
      break;
    }
    case 'A_TO_DIAGONAL_SKY': {
      start = casterPos.clone();
      end = new THREE.Vector3(casterPos.x + 260, casterPos.y + 380, casterPos.z);
      break;
    }
    case 'GROUND_BURST': {
      start = new THREE.Vector3(actualEnd.x, actualEnd.y - 120, actualEnd.z);
      end = actualEnd.clone();
      break;
    }
    case 'AT_CASTER':
    case 'BODY_AURA':
    case 'SHIELD_BARRIER':
    case 'SHOUT_WAVE': {
      start = casterPos.clone();
      end = casterPos.clone();
      break;
    }
    case 'AT_TARGET':
    case 'MELEE_SWEEP': {
      start = actualEnd.clone();
      end = actualEnd.clone();
      break;
    }
    case 'A_TO_B':
    case 'HORIZONTAL':
    case 'COLUMN_PIERCE':
    case 'ARC_MULTI':
    default: {
      start = casterPos.clone();
      end = actualEnd.clone();
      break;
    }
  }

  // 🛡️ 跨空間幾何體絕對防塌縮守護 (Anti-Collapse Guard)
  // 若為電弧、射線或跨空間幾何體，起終點距離 < 10 視為非法塌縮，自動重構物理跨度
  if (isSpanBeam && start.distanceTo(end) < 10) {
    if (mode.includes('VERTICAL')) {
      start = new THREE.Vector3(actualEnd.x, actualEnd.y + 380, actualEnd.z);
      end = actualEnd.clone();
    } else {
      start = casterPos.clone();
      end = actualEnd.clone();
    }
  }

  if (reverse) {
    return { startPos: end, endPos: start };
  }
  return { startPos: start, endPos: end };
}
