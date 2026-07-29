const fs = require('fs');

const path = 'i:/gameproject/Medieval/src/ui/ModalController.ts';
let content = fs.readFileSync(path, 'utf8');

const regex = /function renderDispatchTeamRoster\(\) \{[\s\S]*?\}\s*function renderDispatchAdvList\(\) \{[\s\S]*?\}\s*export async function openTradePlanner/;

const replacement = `function renderDispatchTeamRoster() {
  const container = document.getElementById('dispatch-team-grid');
  if (!container) return;
  container.innerHTML = '';
  
  // Render Formation Selector
  const select = document.getElementById('dispatch-formation-select') as HTMLSelectElement;
  if (select) {
    select.innerHTML = '';
    GameState.unlockedFormations.forEach(fid => {
      const form = FormationDB.getFormation(fid);
      const option = document.createElement('option');
      option.value = fid;
      option.textContent = \`\${form.icon} \${form.name}\`;
      if (fid === currentFormationId) option.selected = true;
      select.appendChild(option);
    });
    
    if (!select.dataset.bound) {
      select.dataset.bound = 'true';
      select.addEventListener('change', (e) => {
        currentFormationId = (e.target as HTMLSelectElement).value;
        renderDispatchTeamRoster();
      });
    }
  }
  
  const descEl = document.getElementById('dispatch-formation-desc');
  const activeFormation = FormationDB.getFormation(currentFormationId);
  if (descEl) {
    descEl.textContent = activeFormation.description;
  }
  
  const isFormationActive = FormationDB.isFormationActive(currentGridMap, currentFormationId);
  
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const slotId = \`\${r}_\${c}\`;
      const advId = currentGridMap[slotId];
      const adv = advId ? GameState.adventurers.find(a => a.id === advId) : null;
      
      const isRequired = activeFormation.requiredSlots.some(s => s.row === r && s.col === c);
      
      const slot = document.createElement('div');
      slot.className = 'grid-slot';
      slot.style.width = '95px';
      slot.style.height = '110px';
      slot.style.border = '2px dashed ' + (isRequired ? (isFormationActive ? '#10b981' : '#eab308') : 'rgba(255,255,255,0.2)');
      slot.style.borderRadius = '6px';
      slot.style.background = 'rgba(0,0,0,0.4)';
      slot.style.position = 'relative';
      slot.style.display = 'flex';
      slot.style.alignItems = 'center';
      slot.style.justifyContent = 'center';
      
      const label = document.createElement('div');
      label.textContent = r === 0 ? '前排' : r === 1 ? '中排' : '後排';
      label.style.position = 'absolute';
      label.style.bottom = '-20px';
      label.style.color = '#94a3b8';
      label.style.fontSize = '0.7em';
      label.style.whiteSpace = 'nowrap';
      slot.appendChild(label);
      
      slot.dataset.slotId = slotId;
      slot.addEventListener('dragover', (e) => { e.preventDefault(); });
      slot.addEventListener('drop', (e) => handleDropOnGrid(e, slotId));
      
      if (adv) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'adventurer-card';
        cardDiv.style.transform = 'scale(0.85)';
        cardDiv.style.transformOrigin = 'center';
        cardDiv.style.pointerEvents = 'auto'; 
        cardDiv.draggable = true;
        
        cardDiv.innerHTML = renderAdventurerCard(adv, {
          showDismissBtn: true,
          dismissId: adv.id
        });
        
        const displayClass = (adv as any).currentClass || adv.job.name;
        const tooltipHtml = \`【\${adv.name}】<br/>Lv.\${adv.level} \${displayClass}<br/>戰力：\${adv.power}\`;
        
        cardDiv.addEventListener('mouseenter', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.opacity = '1'; }
        });
        cardDiv.addEventListener('mousemove', (e) => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
        });
        cardDiv.addEventListener('mouseleave', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
        });
        
        cardDiv.addEventListener('dragstart', (e) => {
          dragDraggedAdvId = adv.id;
          dragSourceSlot = slotId;
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
        });
        
        const removeBtn = cardDiv.querySelector('button');
        if (removeBtn) {
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            delete currentGridMap[slotId];
            selectedAdventurersForDispatch.delete(adv.id);
            const tEl = document.getElementById('adv-tooltip');
            if (tEl) tEl.style.opacity = '0';
            renderDispatchTeamRoster();
            renderDispatchAdvList();
          });
        }
        
        slot.appendChild(cardDiv);
      } else if (isRequired) {
         const reqLabel = document.createElement('div');
         reqLabel.textContent = '📍';
         reqLabel.style.fontSize = '1.5em';
         reqLabel.style.opacity = '0.5';
         slot.appendChild(reqLabel);
      }
      
      container.appendChild(slot);
    }
  }
  
  const btnSave = document.getElementById('btn-save-preset');
  if (btnSave && !btnSave.dataset.bound) {
    btnSave.dataset.bound = 'true';
    btnSave.addEventListener('click', () => {
      if (Object.keys(currentGridMap).length === 0) {
        ToastManager.show('隊伍為空，無法儲存！');
        return;
      }
      if (GameState.formationPresets.length >= 5) {
        GameState.formationPresets.shift(); 
      }
      GameState.formationPresets.push({
        id: 'preset_' + Date.now(),
        name: \`隊伍 \${GameState.formationPresets.length + 1}\`,
        formationId: currentFormationId,
        gridMap: { ...currentGridMap }
      });
      ToastManager.show('隊伍配置已儲存！');
      renderDispatchTeamRoster();
    });
  }
  
  const presetBtns = document.querySelectorAll('.btn-preset');
  presetBtns.forEach((btn, index) => {
    const el = btn as HTMLElement;
    if (GameState.formationPresets[index]) {
      el.style.background = 'rgba(59,130,246,0.3)';
      el.style.color = '#fff';
      if (!el.dataset.bound) {
        el.dataset.bound = 'true';
        el.addEventListener('click', () => {
          const preset = GameState.formationPresets[index];
          currentFormationId = preset.formationId;
          currentGridMap = { ...preset.gridMap };
          selectedAdventurersForDispatch.clear();
          Object.values(currentGridMap).forEach(id => selectedAdventurersForDispatch.add(id as string));
          renderDispatchTeamRoster();
          renderDispatchAdvList();
        });
      }
    } else {
      el.style.background = 'rgba(255,255,255,0.1)';
      el.style.color = '#94a3b8';
    }
  });

  updateDispatchPowerPreview();
}

function handleDropOnGrid(e: DragEvent, targetSlotId: string) {
  e.preventDefault();
  if (!dragDraggedAdvId) return;
  
  if (dragSourceSlot && dragSourceSlot !== 'pool') {
    const existingAdvInTarget = currentGridMap[targetSlotId];
    if (existingAdvInTarget) {
      currentGridMap[dragSourceSlot] = existingAdvInTarget;
    } else {
      delete currentGridMap[dragSourceSlot];
    }
  } else {
    const existingAdvInTarget = currentGridMap[targetSlotId];
    if (existingAdvInTarget) {
      selectedAdventurersForDispatch.delete(existingAdvInTarget);
    }
    selectedAdventurersForDispatch.add(dragDraggedAdvId);
  }
  
  currentGridMap[targetSlotId] = dragDraggedAdvId;
  dragDraggedAdvId = null;
  dragSourceSlot = null;
  
  renderDispatchTeamRoster();
  renderDispatchAdvList();
}

function renderDispatchAdvList() {
  const container = document.getElementById('dispatch-adv-list');
  if (!container) return;
  container.innerHTML = '';
  
  const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);
  
  if (idleAdvs.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; grid-column: 1 / -1;">目前沒有閒置的冒險者可以派遣。</p>';
    return;
  }

  idleAdvs.forEach(adv => {
    const isSelected = selectedAdventurersForDispatch.has(adv.id);
    const card = document.createElement('div');
    card.className = 'adventurer-card';
    if (isSelected) {
      card.style.borderColor = '#3b82f6';
      card.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';
      card.style.opacity = '0.5';
    } else {
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        dragDraggedAdvId = adv.id;
        dragSourceSlot = 'pool';
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';
      });
    }
    
    card.innerHTML = renderAdventurerCard(adv);
    
    const displayClass = (adv as any).currentClass || adv.job.name;
    const tooltipHtml = \`【\${adv.name}】<br/>Lv.\${adv.level} \${displayClass}<br/>戰力：\${adv.power}\`;
    
    card.addEventListener('mouseenter', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.opacity = '1'; }
    });
    card.addEventListener('mousemove', (e) => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
    });
    card.addEventListener('mouseleave', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) tEl.style.opacity = '0';
    });

    card.addEventListener('click', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) tEl.style.opacity = '0';
      
      if (isSelected) {
        for (const [key, val] of Object.entries(currentGridMap)) {
          if (val === adv.id) delete currentGridMap[key];
        }
        selectedAdventurersForDispatch.delete(adv.id);
      } else {
        if (selectedAdventurersForDispatch.size >= 5) {
          ToastManager.show('隊伍最多只能派出 5 名傭兵！');
          return;
        }
        let found = false;
        for (let r=0; r<3; r++) {
          for (let c=0; c<3; c++) {
            const key = \`\${r}_\${c}\`;
            if (!currentGridMap[key]) {
              currentGridMap[key] = adv.id;
              selectedAdventurersForDispatch.add(adv.id);
              found = true;
              break;
            }
          }
          if (found) break;
        }
      }
      renderDispatchAdvList();
      renderDispatchTeamRoster();
    });

    container.appendChild(card);
  });
}

export async function openTradePlanner`;

content = content.replace(regex, replacement);

fs.writeFileSync(path, content, 'utf8');
console.log('Patch complete.');
