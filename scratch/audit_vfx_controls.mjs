import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('tools/vfx-studio.html');
const html = fs.readFileSync(htmlPath, 'utf-8');

// 匹配所有包含 id 的標籤，特別是 input, select, button, textarea 等控制項
const tagRegex = /<([a-zA-Z0-9\-]+)[^>]*id=["']([^"']+)["'][^>]*>/g;
let match;
const elements = [];

while ((match = tagRegex.exec(html)) !== null) {
  const fullTag = match[0];
  const tagName = match[1].toLowerCase();
  const id = match[2];
  const typeMatch = fullTag.match(/type=["']([^"']+)["']/);
  const type = typeMatch ? typeMatch[1] : (tagName === 'button' ? 'button' : (tagName === 'select' ? 'select' : ''));
  elements.push({ tagName, id, type, fullTag });
}

console.log('Total tagged elements with ID:', elements.length);

// 讀取 src/tools/vfx-studio 內的所有 .ts 檔案
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

const tsFiles = getFiles(path.resolve('src/tools/vfx-studio'));
// 也包含 src/styles, src/ui/fx
const fxFiles = getFiles(path.resolve('src/ui/fx'));
const allFiles = [...tsFiles, ...fxFiles];

const fileContents = allFiles.map(f => ({ path: f, content: fs.readFileSync(f, 'utf-8') }));

const controlTags = ['input', 'select', 'button', 'textarea'];
const missing = [];
const found = [];

for (const el of elements) {
  const isControl = controlTags.includes(el.tagName);
  const occurrences = [];

  for (const f of fileContents) {
    if (f.content.includes(el.id)) {
      occurrences.push(path.basename(f.path));
    }
  }

  if (occurrences.length === 0) {
    missing.push({ ...el, isControl });
  } else {
    found.push({ ...el, isControl, occurrences });
  }
}

console.log('\n=== 完全未在 TS 程式碼中被引用的元素 (' + missing.length + ') ===');
for (const m of missing) {
  console.log(`[${m.isControl ? 'CONTROL' : 'STATIC'}] <${m.tagName} id="${m.id}" type="${m.type}">`);
}

console.log('\n=== 控制項被引用情況 (' + found.filter(f => f.isControl).length + ') ===');
for (const f of found.filter(f => f.isControl)) {
  console.log(`[CONTROL] <${f.tagName} id="${f.id}"> -> in: ${f.occurrences.join(', ')}`);
}
