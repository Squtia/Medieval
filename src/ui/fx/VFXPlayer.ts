/**
 * 🎬 VFXPlayer 統一回放管線出口 (Unified VFX Playback Pipeline)
 * 供主遊戲、戰鬥工房 (Combat Studio) 與特效工房 (VFX Studio) 共享同一個 Three.js 渲染中樞
 */
export { CombatFXEngine as VFXPlayer, CombatFXEngine, type ScreenPoint } from './CombatFXEngine';
export { VFXStudioAdapter, type VFXStudioAdapterOptions } from './VFXStudioAdapter';
export { VFXPresetRepository, VFX_STORAGE_KEY, CURRENT_SCHEMA_VERSION } from './VFXPresetRepository';
export { VFXPresetValidator, type ValidationResult } from './VFXPresetValidator';
