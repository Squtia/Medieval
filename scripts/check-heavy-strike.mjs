import fs from 'fs';
import path from 'path';

const vfxFile = path.resolve('./src/data/vfx_presets.json');
const presets = JSON.parse(fs.readFileSync(vfxFile, 'utf-8'));
const heavy = presets.find(p => p.id === 'VFX_HEAVY_STRIKE');

if (!heavy) {
  console.error('❌ VFX_HEAVY_STRIKE not found in vfx_presets.json');
  process.exit(1);
}

// 根據 docs/VFX_STUDIO_GEMINI_REFACTOR_IMPLEMENTATION.md 與純演算法計算包絡線
function getEffectivePresentationDuration(preset) {
  let maxDur = Math.max(0.05, preset.duration || 0.35);
  const mainDelay = Math.max(0, preset.mainDelay || 0);
  const mainDur = preset.mainDuration !== undefined ? preset.mainDuration : (preset.duration || 0.35);
  maxDur = Math.max(maxDur, mainDelay + mainDur);
  const isActualSalvo = (preset.salvoCount !== undefined && preset.salvoCount > 1) || preset.trajectory === 'ARC_MULTI';
  if (isActualSalvo && preset.salvoDuration !== undefined && preset.salvoDuration > 0) {
    maxDur = Math.max(maxDur, preset.salvoDuration);
  }
  if (Array.isArray(preset.layers)) {
    for (const layer of preset.layers) {
      if (layer.enabled !== false) {
        const lDelay = Math.max(0, layer.delay || 0);
        const lDur = Math.max(0.05, layer.duration || 0.2);
        maxDur = Math.max(maxDur, lDelay + lDur);
      }
    }
  }
  if (Array.isArray(preset.impactCues)) {
    for (const cue of preset.impactCues) {
      if (typeof cue.time === 'number' && !Number.isNaN(cue.time)) {
        maxDur = Math.max(maxDur, cue.time);
      }
    }
  }
  return Number(maxDur.toFixed(3));
}

const effDur = getEffectivePresentationDuration(heavy);
console.log('Heavy Strike in JSON:');
console.log('duration:', heavy.duration);
console.log('salvoDuration:', heavy.salvoDuration);
console.log('layers:', JSON.stringify(heavy.layers, null, 2));
console.log('impactCues:', JSON.stringify(heavy.impactCues, null, 2));
console.log('getEffectivePresentationDuration:', effDur);

if (!heavy.impactCues || heavy.impactCues.length === 0) {
  console.error('❌ Heavy strike missing impact cues!');
  process.exit(1);
}
console.log('✅ VFX_HEAVY_STRIKE verification passed');
