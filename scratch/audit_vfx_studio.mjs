import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('tools/vfx-studio.html', 'utf8');

// 讀取所有 vfx-studio 相關源碼
function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      results.push(file);
    }
  });
  return results;
}

const vfxFiles = getFiles('src/tools/vfx-studio');
let allJs = '';
for (const f of vfxFiles) {
  allJs += fs.readFileSync(f, 'utf8') + '\n';
}
// 也加入 CombatFXEngine
allJs += fs.readFileSync('src/ui/fx/CombatFXEngine.ts', 'utf8') + '\n';
allJs += fs.readFileSync('src/ui/fx/CombatActionPlayer.ts', 'utf8') + '\n';

// 1. 抓出所有 button
const buttonMatches = [...html.matchAll(/<button[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)].map(m => ({
  id: m[1],
  text: m[2].trim().replace(/<[^>]+>/g, '').trim()
}));

console.log(`=== 1. 所有 HTML 按鈕審計 (共 ${buttonMatches.length} 個) ===`);
const deadButtons = [];
for (const btn of buttonMatches) {
  const referenced = allJs.includes(`'${btn.id}'`) || allJs.includes(`"${btn.id}"`) || allJs.includes(`\`${btn.id}\``) || allJs.includes(`#${btn.id}`);
  if (!referenced) {
    deadButtons.push(btn);
  }
}
console.log(`❌ 發現未被任何 JS 程式碼引用的按鈕 (${deadButtons.length} 個):`, deadButtons);

// 2. 抓出所有 input / select / range
const inputMatches = [...html.matchAll(/<(input|select)[^>]*id="([^"]+)"/g)].map(m => ({
  tag: m[1],
  id: m[2]
}));

console.log(`\n=== 2. 所有輸入/選擇控制項審計 (共 ${inputMatches.length} 個) ===`);
const deadInputs = [];
for (const inp of inputMatches) {
  const referenced = allJs.includes(`'${inp.id}'`) || allJs.includes(`"${inp.id}"`) || allJs.includes(`\`${inp.id}\``) || allJs.includes(`#${inp.id}`);
  if (!referenced) {
    deadInputs.push(inp);
  }
}
console.log(`❌ 發現未被任何 JS 程式碼引用的控制項 (${deadInputs.length} 個):`, deadInputs);

// 3. 抓出所有 card 標題
const cardMatches = [...html.matchAll(/class="inspector-card[^"]*"[^>]*>[\s\S]*?class="inspector-card-title"[^>]*>([\s\S]*?)<\/div>/g)].map(m => {
  return m[1].replace(/<[^>]+>/g, '').trim();
});
console.log(`\n=== 3. 所有卡片清單 (共 ${cardMatches.length} 個) ===`);
cardMatches.forEach((c, idx) => console.log(`  [Card ${idx + 1}] ${c}`));
