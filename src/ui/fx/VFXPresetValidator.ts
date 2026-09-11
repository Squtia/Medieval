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
  public static validatePreset(preset: any, availableIds?: Set<string>): ValidationResult {
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

    // 🌟 若為標準 VFXSequence (具備 tracks 結構)
    if (Array.isArray(preset.tracks)) {
      if (typeof preset.duration !== 'number' || !Number.isFinite(preset.duration) || preset.duration <= 0) {
        errors.push(`Sequence [${preset.id}]: "duration" must be a positive finite number`);
      }
      return { isValid: errors.length === 0, errors };
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

    // 🎯 檢驗 layers 結構、延遲、時長、自我引用與 presetId 存在性
    if (preset.layers !== undefined) {
      if (!Array.isArray(preset.layers)) {
        errors.push(`Preset [${preset.id}]: "layers" must be an array`);
      } else {
        preset.layers.forEach((layer: any, lIdx: number) => {
          if (!layer || typeof layer !== 'object') {
            errors.push(`Preset [${preset.id}]: layer at index ${lIdx} is invalid`);
            return;
          }
          if (layer.delay !== undefined && (typeof layer.delay !== 'number' || !Number.isFinite(layer.delay) || layer.delay < 0)) {
            errors.push(`Preset [${preset.id}]: layer [${layer.id || lIdx}] "delay" must be a non-negative finite number`);
          }
          if (layer.duration !== undefined && (typeof layer.duration !== 'number' || !Number.isFinite(layer.duration) || layer.duration <= 0)) {
            errors.push(`Preset [${preset.id}]: layer [${layer.id || lIdx}] "duration" must be a positive finite number`);
          }
          if (layer.presetId) {
            if (layer.presetId === preset.id) {
              errors.push(`Preset [${preset.id}]: layer [${layer.id || lIdx}] cannot self-reference presetId "${preset.id}" (自我引用)`);
            } else if (availableIds && !availableIds.has(layer.presetId)) {
              errors.push(`Preset [${preset.id}]: layer references non-existent presetId "${layer.presetId}"`);
            }
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
   * 驗證整個 Preset 清單（包含唯一 ID、圖層存在性、DAG 循環引用與最大深度防護）
   */
  public static validatePresetList(presets: any[]): ValidationResult {
    const errors: string[] = [];
    const seenIds = new Set<string>();

    if (!Array.isArray(presets)) {
      return { isValid: false, errors: ['Preset list must be an array'] };
    }

    const availableIds = new Set<string>();
    presets.forEach(p => {
      if (p && typeof p.id === 'string') {
        availableIds.add(p.id);
      }
    });

    presets.forEach((preset, index) => {
      const singleRes = this.validatePreset(preset, availableIds);
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

    // 建立引用有向圖 (Dependency Graph)
    const graph = new Map<string, string[]>();
    presets.forEach(p => {
      if (p && p.id) {
        const refs: string[] = [];
        if (Array.isArray(p.layers)) {
          p.layers.forEach((l: any) => {
            if (l && l.presetId && typeof l.presetId === 'string') {
              refs.push(l.presetId);
            }
          });
        }
        graph.set(p.id, refs);
      }
    });

    // 偵測循環引用 (Cycle Detection) 與最大深度限制 (Max Depth = 8)
    const MAX_DEPTH = 8;
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycleAndDepth = (currentId: string, path: string[]): boolean => {
      visited.add(currentId);
      recStack.add(currentId);

      const neighbors = graph.get(currentId) || [];
      for (const neighbor of neighbors) {
        if (!graph.has(neighbor)) continue;

        if (recStack.has(neighbor)) {
          const cyclePath = [...path, neighbor];
          errors.push(`Circular layer dependency detected: ${cyclePath.join(' -> ')} (圖層循環引用)`);
          return true;
        }

        if (!visited.has(neighbor)) {
          if (path.length >= MAX_DEPTH) {
            errors.push(`Layer reference depth exceeds maximum limit of ${MAX_DEPTH}: ${[...path, neighbor].join(' -> ')}`);
            return true;
          }
          if (checkCycleAndDepth(neighbor, [...path, neighbor])) {
            return true;
          }
        }
      }

      recStack.delete(currentId);
      return false;
    };

    for (const presetId of graph.keys()) {
      if (!visited.has(presetId)) {
        checkCycleAndDepth(presetId, [presetId]);
      }
    }

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
