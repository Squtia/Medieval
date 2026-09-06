import fs from 'fs';

const html = fs.readFileSync('tools/vfx-studio.html', 'utf8');
const ts = fs.readFileSync('src/tools/vfx-studio/VFXInspector.ts', 'utf8');

const idRegex = /id=["'](param-[^"']+)["']/g;
const htmlIds = new Set();
let match;
while ((match = idRegex.exec(html)) !== null) {
  htmlIds.add(match[1]);
}

const mapIdRegex = /id:\s*['"]([^'"]+)['"]/g;
const mapIds = new Set();
while ((match = mapIdRegex.exec(ts)) !== null) {
  mapIds.add(match[1]);
}

console.log('=== HTML 總 param 控制項數量:', htmlIds.size);
console.log('=== Control Map 綁定控制項數量:', mapIds.size);

const unmapped = [];
for (const id of htmlIds) {
  if (!mapIds.has(id)) unmapped.push(id);
}
console.log('❌ HTML 存在但未在 Inspector 綁定的孤兒控制項 (調了絕對沒效果):', unmapped);

const missingInHtml = [];
for (const id of mapIds) {
  if (!htmlIds.has(id)) missingInHtml.push(id);
}
console.log('⚠️ Inspector 監聽但 HTML 不存在的控制項:', missingInHtml);
