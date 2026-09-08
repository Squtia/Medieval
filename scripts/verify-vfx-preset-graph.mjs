import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Starting VFX Preset Graph & Layer Cycle Verification (規格 §12)...');

const presetsPath = path.resolve(__dirname, '../src/data/vfx_presets.json');
const raw = fs.readFileSync(presetsPath, 'utf-8');
const presets = JSON.parse(raw);

console.log(`📦 Loaded ${presets.length} official VFX presets.`);

let hasError = false;
const presetMap = new Map();
presets.forEach(p => presetMap.set(p.id, p));

// 1. 檢驗自我引用 (Self-reference: A -> A)
for (const p of presets) {
  if (Array.isArray(p.layers)) {
    for (const layer of p.layers) {
      if (layer.presetId === p.id) {
        console.error(`❌ Self-referencing detected in preset "${p.id}"! Layer "${layer.id}" references itself.`);
        hasError = true;
      }
    }
  }
}

// 2. 檢驗循環引用 (Cycle detection: DFS)
function checkCycle(presetId, visited = new Set(), pathStack = []) {
  if (pathStack.includes(presetId)) {
    return [...pathStack, presetId];
  }
  if (visited.has(presetId)) {
    return null;
  }

  visited.add(presetId);
  pathStack.push(presetId);

  const p = presetMap.get(presetId);
  if (p && Array.isArray(p.layers)) {
    for (const layer of p.layers) {
      if (layer.presetId && presetMap.has(layer.presetId)) {
        const cycle = checkCycle(layer.presetId, visited, [...pathStack]);
        if (cycle) return cycle;
      }
    }
  }

  return null;
}

const visitedGlobal = new Set();
for (const p of presets) {
  const cycle = checkCycle(p.id, visitedGlobal);
  if (cycle) {
    console.error(`❌ Cyclic layer dependency detected: ${cycle.join(' -> ')}`);
    hasError = true;
    break;
  }
}

if (hasError) {
  console.error('❌ VFX Preset Graph verification FAILED.');
  process.exit(1);
} else {
  console.log(`🎉 ALL ${presets.length} PRESETS VERIFIED: 0 SELF-REFERENCES, 0 CYCLIC DEPENDENCIES!`);
  process.exit(0);
}
