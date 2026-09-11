import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Starting VFX Preset Graph & Layer Cycle Verification (規格 §12)...');

const presetsPath = path.resolve(__dirname, '../src/data/vfx_sequences.json');
const raw = fs.readFileSync(presetsPath, 'utf-8');
const presets = JSON.parse(raw);

console.log(`📦 Loaded ${presets.length} official VFX sequences.`);

let hasError = false;
const presetMap = new Map();
presets.forEach(p => presetMap.set(p.id, p));

function getSubPresetIds(sequence) {
  const ids = [];
  if (Array.isArray(sequence.tracks)) {
    for (const t of sequence.tracks) {
      if (Array.isArray(t.clips)) {
        for (const c of t.clips) {
          if (c.payload && c.payload.type === 'COMPOSITE_LAYER' && c.payload.data && c.payload.data.presetId) {
            ids.push(c.payload.data.presetId);
          }
        }
      }
    }
  }
  return ids;
}

// 1. 檢驗自我引用 (Self-reference: A -> A)
for (const p of presets) {
  const subIds = getSubPresetIds(p);
  for (const subId of subIds) {
    if (subId === p.id) {
      console.error(`❌ Self-referencing detected in sequence "${p.id}"! Layer references itself.`);
      hasError = true;
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
  if (p) {
    const subIds = getSubPresetIds(p);
    for (const subId of subIds) {
      if (subId && presetMap.has(subId)) {
        const cycle = checkCycle(subId, visited, [...pathStack]);
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
