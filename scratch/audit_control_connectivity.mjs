import fs from 'fs';
import path from 'path';

function getFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

const allTsFiles = [
  ...getFiles(path.resolve('src/tools/vfx-studio')),
  ...getFiles(path.resolve('src/ui/fx')),
  path.resolve('src/models/VFX.ts')
];

const fileContents = allTsFiles.map(f => ({
  path: f,
  rel: path.relative(path.resolve('.'), f),
  content: fs.readFileSync(f, 'utf-8')
}));

const inspectorContent = fs.readFileSync(path.resolve('src/tools/vfx-studio/VFXInspector.ts'), 'utf-8');
const htmlContent = fs.readFileSync(path.resolve('tools/vfx-studio.html'), 'utf-8');

// 擷取 INSPECTOR_CONTROL_MAP
const mapMatch = inspectorContent.match(/export const INSPECTOR_CONTROL_MAP: ControlConfig\[\] = (\[[\s\S]*?\]);/);
if (!mapMatch) {
  console.error('INSPECTOR_CONTROL_MAP not found!');
  process.exit(1);
}

const mapCode = mapMatch[1];
const itemRegex = /\{([^}]+)\}/g;
let m;
const controls = [];
while ((m = itemRegex.exec(mapCode)) !== null) {
  const itemStr = m[1];
  const idM = itemStr.match(/id:\s*['"]([^'"]+)['"]/);
  const keyM = itemStr.match(/key:\s*['"]([^'"]+)['"]/);
  const isImpact = itemStr.includes('isImpact: true');
  const isCasterMotion = itemStr.includes('isCasterMotion: true');
  const isLegacy = itemStr.includes('isLegacy: true');
  const isHidden = itemStr.includes('isHidden: true');
  const capabilityM = itemStr.match(/capability:\s*['"]([^'"]+)['"]/);
  
  if (idM && keyM) {
    controls.push({
      id: idM[1],
      key: keyM[1],
      isImpact,
      isCasterMotion,
      isLegacy,
      isHidden,
      capability: capabilityM ? capabilityM[1] : null,
      raw: itemStr.trim()
    });
  }
}

console.log(`Parsed ${controls.length} controls from INSPECTOR_CONTROL_MAP.`);

const results = [];

for (const c of controls) {
  const inHtml = htmlContent.includes(`id="${c.id}"`) || htmlContent.includes(`id='${c.id}'`);
  // 找出除了 VFXInspector.ts 之外，引用了這個 key 的檔案
  const keyRefs = [];
  // 也檢查 id 在其他檔案的引用
  const idRefs = [];

  for (const f of fileContents) {
    const isInspector = f.rel.includes('VFXInspector.ts');
    if (f.content.includes(c.key)) {
      keyRefs.push({ file: f.rel, isInspector });
    }
    if (f.content.includes(c.id)) {
      idRefs.push({ file: f.rel, isInspector });
    }
  }

  const nonInspectorKeyRefs = keyRefs.filter(k => !k.isInspector);
  const isUsed = nonInspectorKeyRefs.length > 0;

  results.push({
    id: c.id,
    key: c.key,
    inHtml,
    isLegacy: c.isLegacy,
    isHidden: c.isHidden,
    capability: c.capability,
    isUsed,
    keyRefs: nonInspectorKeyRefs.map(k => k.file)
  });
}

console.log('\n==============================');
console.log(' 全域接通審查報告 (Control Connectivity Audit)');
console.log('==============================');

const unused = results.filter(r => !r.isUsed);
const used = results.filter(r => r.isUsed);

console.log(`\n【⚠️ 未在任何渲染端、物理計算或業務邏輯中被讀取的控制項 (${unused.length} 個)】:`);
for (const u of unused) {
  console.log(`- id="${u.id}" | key="${u.key}" | capability: ${u.capability} | inHtml: ${u.inHtml} | legacy: ${u.isLegacy} | hidden: ${u.isHidden}`);
}

console.log(`\n【✅ 已在後續管線被引用的控制項 (${used.length} 個)】:`);
for (const u of used) {
  console.log(`- id="${u.id}" | key="${u.key}" | capability: ${u.capability} -> in: ${u.keyRefs.join(', ')}`);
}
