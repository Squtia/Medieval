import * as THREE from 'three';
import { VFXPreset, VFXSpatialMode, VFXTrajectory, VFXTrajectoryPath } from '../../models/VFX';

type SpatialPreset = Pick<VFXPreset, 'spatialMode' | 'trajectory' | 'trajectoryPath'>;

export const VFX_RENDER_ORDER = {
  GROUND: 1,
  MAIN: 5,
  TRAIL: 8,
  IMPACT: 10
} as const;

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
