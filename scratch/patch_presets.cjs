const fs = require('fs');
const path = 'i:/gameproject/Medieval/src/ui/ModalController.ts';
let content = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// 1. Add currentSelectedPresetIndex
const varRegex = /let dragSourceSlot: string \| null = null;/;
const varReplacement = `let dragSourceSlot: string | null = null;
let currentSelectedPresetIndex: number = 0;
let presetEventsInitialized: boolean = false;`;

if (varRegex.test(content)) {
    content = content.replace(varRegex, varReplacement);
} else {
    console.log('Var Regex not found!');
}

// 2. Add initPresetEvents() to openDispatchSetup
const openRegex = /renderDispatchTeamRoster\(\);\n\n  \/\/ 更新確認按鈕事件/;
const openReplacement = `renderDispatchTeamRoster();
  initPresetEvents();

  // 更新確認按鈕事件`;

if (openRegex.test(content)) {
    content = content.replace(openRegex, openReplacement);
} else {
    console.log('Open Regex not found!');
}

// 3. Add initPresetEvents function at the bottom
const funcRegex = /export async function openWarehouse\(isForgeMode: boolean\) {/;
const funcReplacement = `function initPresetEvents() {
  if (presetEventsInitialized) return;
  presetEventsInitialized = true;

  const presetBtns = document.querySelectorAll('.btn-preset');
  const saveBtn = document.getElementById('btn-save-preset');

  function updatePresetButtonUI() {
    presetBtns.forEach(btn => {
      const idx = parseInt((btn as HTMLElement).dataset.preset || '0');
      if (idx === currentSelectedPresetIndex) {
        (btn as HTMLElement).style.background = 'rgba(234, 179, 8, 0.4)';
        (btn as HTMLElement).style.borderColor = '#eab308';
        (btn as HTMLElement).style.color = '#fff';
      } else {
        (btn as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
        (btn as HTMLElement).style.borderColor = 'transparent';
        (btn as HTMLElement).style.color = '#d4c4a8';
      }
    });
  }

  presetBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).dataset.preset || '0');
      currentSelectedPresetIndex = idx;
      updatePresetButtonUI();
      
      const preset = GameState.formationPresets ? GameState.formationPresets[idx] : null;
      if (preset && preset.gridMap) {
        currentFormationId = preset.formationId || 'DEFAULT';
        currentGridMap = {};
        selectedAdventurersForDispatch.clear();
        
        let missingNames: string[] = [];
        
        for (const [slot, advId] of Object.entries(preset.gridMap)) {
          const adv = GameState.adventurers.find(a => a.id === advId);
          if (adv) {
            if (adv.currentState === AdventurerState.IDLE) {
              if (selectedAdventurersForDispatch.size < 5) {
                currentGridMap[slot] = advId;
                selectedAdventurersForDispatch.add(advId);
              }
            } else {
              missingNames.push(adv.name);
            }
          }
        }
        
        renderDispatchTeamRoster();
        renderDispatchAdvList();
        
        if (missingNames.length > 0) {
          ToastManager.show(\`隊伍讀取不完整：\${missingNames.join(', ')} 正在執行其他任務或休養中。\`);
        } else {
          ToastManager.show(\`已讀取隊伍 \${idx + 1}\`);
        }
      } else {
        ToastManager.show(\`隊伍 \${idx + 1} 尚未儲存任何配置\`);
      }
    });
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (!GameState.formationPresets) {
        GameState.formationPresets = [];
      }
      
      // Ensure the array has enough elements
      while (GameState.formationPresets.length <= currentSelectedPresetIndex) {
        GameState.formationPresets.push({
          id: \`preset_\${GameState.formationPresets.length}\`,
          name: \`隊伍 \${GameState.formationPresets.length + 1}\`,
          formationId: 'DEFAULT',
          gridMap: {}
        });
      }
      
      GameState.formationPresets[currentSelectedPresetIndex] = {
        id: \`preset_\${currentSelectedPresetIndex}\`,
        name: \`隊伍 \${currentSelectedPresetIndex + 1}\`,
        formationId: currentFormationId,
        gridMap: { ...currentGridMap }
      };
      
      ToastManager.show(\`已將當前配置儲存至隊伍 \${currentSelectedPresetIndex + 1}\`);
    });
  }
  
  updatePresetButtonUI();
}

export async function openWarehouse(isForgeMode: boolean) {`;

if (funcRegex.test(content)) {
    content = content.replace(funcRegex, funcReplacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Patch complete.');
} else {
    console.log('Func Regex not found!');
}
