import fs from 'fs';

const inspectorSrc = fs.readFileSync('src/tools/vfx-studio/VFXInspector.ts', 'utf8');
const engineSrc = fs.readFileSync('src/ui/fx/CombatFXEngine.ts', 'utf8');

// 抓出 INSPECTOR_CONTROL_MAP 裡的 key
const keyMatches = [...inspectorSrc.matchAll(/key:\s*'([^']+)'/g)].map(m => m[1]);
const uniqueKeys = [...new Set(keyMatches)];

console.log(`=== INSPECTOR_CONTROL_MAP 中的參數 keys (共 ${uniqueKeys.length} 個) ===`);

const unusedInEngine = [];
const usedInEngine = [];

for (const k of uniqueKeys) {
  // 檢查在 CombatFXEngine 裡是否被引用
  const isUsed = engineSrc.includes(`.${k}`) || engineSrc.includes(`['${k}']`) || engineSrc.includes(`["${k}"]`) || engineSrc.includes(`${k}:`) || engineSrc.includes(k);
  if (!isUsed) {
    unusedInEngine.push(k);
  } else {
    usedInEngine.push(k);
  }
}

console.log(`\n✅ 3D FX 引擎有實質引用的參數 (${usedInEngine.length} 個):`);
console.log(usedInEngine.join(', '));

console.log(`\n⚠️ 3D FX 引擎「完全未直接出現」的參數 (${unusedInEngine.length} 個):`);
console.log(unusedInEngine);
