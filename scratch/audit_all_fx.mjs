import fs from 'fs';
import path from 'path';

const inspectorSrc = fs.readFileSync('src/tools/vfx-studio/VFXInspector.ts', 'utf8');

function getAllText(dir) {
  let text = '';
  const list = fs.readdirSync(dir);
  for (const f of list) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      text += getAllText(p);
    } else if (p.endsWith('.ts') || p.endsWith('.js')) {
      text += fs.readFileSync(p, 'utf8') + '\n';
    }
  }
  return text;
}

const fxAllText = getAllText('src/ui/fx') + fs.readFileSync('src/tools/vfx-studio/VFXStudioController.ts', 'utf8');

const keyMatches = [...inspectorSrc.matchAll(/key:\s*'([^']+)'/g)].map(m => m[1]);
const uniqueKeys = [...new Set(keyMatches)];

const trulyUnused = [];
const usedSomewhere = [];

for (const k of uniqueKeys) {
  const isUsed = fxAllText.includes(`.${k}`) || fxAllText.includes(`['${k}']`) || fxAllText.includes(`["${k}"]`) || fxAllText.includes(`${k}:`) || fxAllText.includes(k);
  if (!isUsed) {
    trulyUnused.push(k);
  } else {
    usedSomewhere.push(k);
  }
}

console.log(`真正完全未被渲染管線/控制器引用的參數 (${trulyUnused.length} 個):`, trulyUnused);
