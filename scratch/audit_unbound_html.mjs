import fs from 'fs';
import path from 'path';

const html = fs.readFileSync('tools/vfx-studio.html', 'utf-8');
const inspectorTs = fs.readFileSync('src/tools/vfx-studio/VFXInspector.ts', 'utf-8');
const controllerTs = fs.readFileSync('src/tools/vfx-studio/VFXStudioController.ts', 'utf-8');
const stageTs = fs.readFileSync('src/tools/vfx-studio/VFXStage.ts', 'utf-8');
const libraryTs = fs.readFileSync('src/tools/vfx-studio/VFXLibrary.ts', 'utf-8');
const timelineViewTs = fs.readFileSync('src/tools/vfx-studio/timeline/TimelineView.ts', 'utf-8');
const timelineInteractionTs = fs.readFileSync('src/tools/vfx-studio/timeline/TimelineInteraction.ts', 'utf-8');
const meshRendererTs = fs.readFileSync('src/ui/fx/renderers/MeshLayerRenderer.ts', 'utf-8');
const fxEngineTs = fs.readFileSync('src/ui/fx/CombatFXEngine.ts', 'utf-8');
const storeTs = fs.readFileSync('src/tools/vfx-studio/VFXStudioStore.ts', 'utf-8');

// 匹配 HTML 中所有可交互標籤：input, select, button
const matches = [...html.matchAll(/<(input|select|button)\b([^>]*)>/gi)];
console.log(`HTML 中共有 ${matches.length} 個交互標籤。`);

const findings = [];

for (const m of matches) {
  const tag = m[1].toLowerCase();
  const attrs = m[2];
  const idM = attrs.match(/id=["']([^"']+)["']/i);
  const id = idM ? idM[1] : null;
  const typeM = attrs.match(/type=["']([^"']+)["']/i);
  const type = typeM ? typeM[1] : (tag === 'button' ? 'button' : (tag === 'select' ? 'select' : 'text'));

  if (!id) {
    findings.push({ tag, type, id: '(no id)', issue: '缺少 id' });
    continue;
  }

  // 檢查是否在 TS 中被選取
  const inInspector = inspectorTs.includes(`'${id}'`) || inspectorTs.includes(`"${id}"`) || inspectorTs.includes(id);
  const inController = controllerTs.includes(`'${id}'`) || controllerTs.includes(`"${id}"`);
  const inStage = stageTs.includes(`'${id}'`) || stageTs.includes(`"${id}"`);
  const inLibrary = libraryTs.includes(`'${id}'`) || libraryTs.includes(`"${id}"`);
  const inTimeline = timelineInteractionTs.includes(id) || timelineViewTs.includes(id);

  const bound = inInspector || inController || inStage || inLibrary || inTimeline;

  findings.push({
    tag,
    type,
    id,
    bound,
    boundIn: [
      inInspector ? 'Inspector' : '',
      inController ? 'Controller' : '',
      inStage ? 'Stage' : '',
      inLibrary ? 'Library' : '',
      inTimeline ? 'Timeline' : ''
    ].filter(Boolean).join(', ')
  });
}

const unbound = findings.filter(f => !f.bound);
console.log(`\n未在任何 TS 中綁定的控制項 (${unbound.length} 個)：`);
console.log(JSON.stringify(unbound, null, 2));
