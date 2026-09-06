import fs from 'fs';

const ts = fs.readFileSync('src/tools/vfx-studio/VFXInspector.ts', 'utf8');
const engineTs = fs.readFileSync('src/ui/fx/CombatFXEngine.ts', 'utf8') + 
                 fs.readFileSync('src/ui/fx/renderers/MeshLayerRenderer.ts', 'utf8') +
                 fs.readFileSync('src/ui/fx/renderers/ImpactLayerRenderer.ts', 'utf8') +
                 fs.readFileSync('src/ui/fx/renderers/ParticleLayerRenderer.ts', 'utf8');

const keyRegex = /key:\s*['"]([^'"]+)['"]/g;
const keys = [];
let match;
while ((match = keyRegex.exec(ts)) !== null) {
  keys.push(match[1]);
}

console.log('=== 檢查所有 Inspector key 在渲染引擎中的實際使用情況 ===');
const unusedKeys = [];
for (const k of keys) {
  // 檢查是否在 engine 檔案中出現 preset[k] 或 preset.k 或 options.k 或 [k]
  const pattern = new RegExp(`(\\b${k}\\b)`, 'g');
  const count = (engineTs.match(pattern) || []).length;
  if (count === 0) {
    unusedKeys.push(k);
  }
}

console.log('❌ 存在於 Inspector 但在渲染引擎中完全沒有被讀取/渲染的死屬性 (使用者調了絕無視覺變化):', unusedKeys);
