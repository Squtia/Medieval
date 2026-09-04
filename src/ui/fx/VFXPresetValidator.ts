import { VFXPreset, VFXTrajectory, VFXShaderMode } from '../../models/VFX';

export const VALID_TRAJECTORIES: ReadonlySet<string> = new Set<VFXTrajectory>([
  'HORIZONTAL',
  'VERTICAL_DROP',
  'DIAGONAL_DROP',
  'GROUND_BURST',
  'GROUND_FISSURE',
  'COLUMN_PIERCE',
  'MELEE_SWEEP',
  'BODY_AURA',
  'ARC_MULTI',
  'PARABOLA_ARC',
  'SHIELD_BARRIER',
  'SHOUT_WAVE'
]);

export const VALID_SHADER_MODES: ReadonlySet<string> = new Set<VFXShaderMode>([
  'FRESNEL_ICE',
  'VOLUMETRIC_FIRE',
  'DIELECTRIC_LIGHTNING',
  'ENERGY_BEAM',
  'HOLY_LIGHT',
  'DARK_VOID',
  'SLASH_BLADE',
  'EARTH_SHATTER'
]);

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class VFXPresetValidator {
  /**
   * 驗證單一 VFXPreset 結構與資料完整性
   */
  public static validatePreset(preset: any): ValidationResult {
    const errors: string[] = [];

    if (!preset || typeof preset !== 'object') {
      return { isValid: false, errors: ['Preset must be a valid object'] };
    }

    if (!preset.id || typeof preset.id !== 'string') {
      errors.push('Missing or invalid "id"');
    }
    if (!preset.name || typeof preset.name !== 'string') {
      errors.push(`Preset [${preset.id || 'unknown'}]: Missing or invalid "name"`);
    }
    if (!VALID_TRAJECTORIES.has(preset.trajectory)) {
      errors.push(`Preset [${preset.id}]: Invalid trajectory "${preset.trajectory}"`);
    }
    if (!VALID_SHADER_MODES.has(preset.shaderMode)) {
      errors.push(`Preset [${preset.id}]: Invalid shaderMode "${preset.shaderMode}"`);
    }
    if (typeof preset.duration !== 'number' || !Number.isFinite(preset.duration) || preset.duration <= 0) {
      errors.push(`Preset [${preset.id}]: "duration" must be a positive finite number`);
    }
    if (typeof preset.scale !== 'number' || !Number.isFinite(preset.scale) || preset.scale <= 0) {
      errors.push(`Preset [${preset.id}]: "scale" must be a positive finite number`);
    }
    if (!preset.impact || typeof preset.impact !== 'object') {
      errors.push(`Preset [${preset.id}]: Missing "impact" configuration`);
    }

    // 🎯 檢驗 impactCues 結構、ID 唯一性與時間範圍 (規範 9.2)
    if (preset.impactCues !== undefined) {
      if (!Array.isArray(preset.impactCues)) {
        errors.push(`Preset [${preset.id}]: "impactCues" must be an array`);
      } else {
        const cueIdSet = new Set<string>();
        preset.impactCues.forEach((cue: any, cIdx: number) => {
          if (!cue || typeof cue !== 'object') {
            errors.push(`Preset [${preset.id}]: impactCue at index ${cIdx} is invalid`);
            return;
          }
          if (!cue.cueId || typeof cue.cueId !== 'string') {
            errors.push(`Preset [${preset.id}]: impactCue at index ${cIdx} missing "cueId"`);
          } else {
            if (cueIdSet.has(cue.cueId)) {
              errors.push(`Preset [${preset.id}]: Duplicate cueId "${cue.cueId}"`);
            }
            cueIdSet.add(cue.cueId);
          }
          if (typeof cue.time !== 'number' || !Number.isFinite(cue.time)) {
            errors.push(`Preset [${preset.id}]: Cue [${cue.cueId || cIdx}] "time" must be a finite number`);
          } else if (cue.time < 0 || (typeof preset.duration === 'number' && cue.time > preset.duration + 0.001)) {
            errors.push(`Preset [${preset.id}]: Cue [${cue.cueId}] time (${cue.time}s) exceeds preset duration (${preset.duration}s) or is negative`);
          }
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 驗證整個 Preset 清單（包含唯一 ID 檢驗）
   */
  public static validatePresetList(presets: any[]): ValidationResult {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    if (!Array.isArray(presets)) {
      return { isValid: false, errors: ['Preset list must be an array'] };
    }

    presets.forEach((preset, index) => {
      const singleRes = this.validatePreset(preset);
      if (!singleRes.isValid) {
        errors.push(...singleRes.errors);
      }

      if (preset && preset.id) {
        if (seenIds.has(preset.id)) {
          errors.push(`Duplicate preset ID "${preset.id}" at index ${index}`);
        }
        seenIds.add(preset.id);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 檢查所有技能特效綁定映射 (SKILL_VFX_MAP) 是否皆對應到存在的 Preset
   */
  public static validateSkillVfxMap(
    skillVfxMap: Record<string, string>,
    availableIds: Set<string>
  ): ValidationResult {
    const errors: string[] = [];

    for (const [skillKey, vfxId] of Object.entries(skillVfxMap)) {
      if (!availableIds.has(vfxId)) {
        errors.push(`SKILL_VFX_MAP key "${skillKey}" maps to non-existent VFX ID "${vfxId}"`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
