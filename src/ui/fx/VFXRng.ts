/**
 * 🎲 VFXRng
 * 專案視覺特效確定性偽隨機數產生器 (Deterministic PRNG)
 * 嚴格遵循 docs/VFX_ARCHITECTURE_EXECUTION_PLAN.md Phase 3 規範：
 * 消除渲染路徑中散落的原生 Math.random()，確保同一 Seed 產生 100% 一致之姿態與粒子分佈。
 */

export type VFXSeed = number;

export function createLcgRng(seed: number = 12345): () => number {
  let s = Math.floor(Math.abs(seed)) || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * 依據 Preset ID、基礎種子與可選 instanceId 計算確定性衍生種子
 */
export function deriveVFXSeed(presetId: string, baseSeed: number = 12345, instanceId: string = ''): number {
  let hash = baseSeed;
  const str = `${presetId}_${instanceId}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 12345;
}

let globalFallbackSeed = 54321;

/**
 * 預設確定性隨機數生成器（完全杜絕調用原生 Math.random()）
 */
export const defaultVfxRng = (): number => {
  globalFallbackSeed = (globalFallbackSeed * 9301 + 49297) % 233280;
  return globalFallbackSeed / 233280;
};
