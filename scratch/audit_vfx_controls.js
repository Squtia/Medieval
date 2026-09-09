const fs = require('fs');
const path = require('path');

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

console.log('Total tagged IDs:', elements.length);

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
const tsContents = tsFiles.map(f => ({ path: f, content: fs.readFileSync(f, 'utf-8') }));

// 檢查各個控制項在 ts 中的引用情況
const controlTags = ['input', 'select', 'button', 'textarea'];
const results = [];

for (const el of elements) {
  const isControl = controlTags.includes(el.tagName);
  const occurrences = [];
  let hasEventListener = false;
  let hasChangeOrInput = false;

  for (const ts of tsContents) {
    if (ts.content.includes(el.id)) {
      occurrences.push(path.basename(ts.path));
      // 簡單檢測是否監聽
      const regexListen = new RegExp(el.id + "['\"`][^;)]*\\.(addEventListener|onclick|onchange|oninput)", 'g');
      if (regexListen.test(ts.content) || ts.content.includes(`'${el.id}'`) || ts.content.includes(`"${el.id}"`)) {
        // 進一步比對
      }
    }
  }

  results.push({
    id: el.id,
    tagName: el.tagName,
    type: el.type,
    isControl,
    occurrences,
  });
}

console.log(JSON.stringify(results, null, 2));
