import { GameState } from '../core/GameState';
import { UIManager } from './UIManager';
import { getTitleConfig, OfficeType, getOfficeConfig, NobleTitle } from '../models/types';
import { Adventurer } from '../models/Adventurer';
import { ToastManager } from './ToastManager';

let selectedSlotIndex: number = -1;
let selectedOfficeType: OfficeType | null = null;

export function renderOfficeBoard(): void {
  const slotsContainer = document.getElementById('ui-office-slots');
  const candidatesContainer = document.getElementById('ui-office-candidates');
  if (!slotsContainer || !candidatesContainer) return;

  const currentTitle = GameState.myTerritory.title;
  const config = getTitleConfig(currentTitle);
  const slots = config.officeSlots;

  // Render left panel: Office Slots
  let slotsHtml = '';
  const officesToRender = [OfficeType.RETAINER, OfficeType.CAPTAIN, OfficeType.BANNERET, OfficeType.CASTELLAN];
  
  let totalSlotCount = 0;
  
  officesToRender.forEach(type => {
    const maxCount = slots[type] || 0;
    const officeConfig = getOfficeConfig(type);
    
    // Find all adventurers currently holding this office
    const holders = GameState.adventurers.filter(a => a.office === type);
    
    for (let i = 0; i < maxCount; i++) {
      const holder = holders[i] || null;
      const isSelected = selectedOfficeType === type && selectedSlotIndex === i;
      const selectedClass = isSelected ? 'border: 2px solid #3b82f6;' : 'border: 1px solid rgba(255,255,255,0.1);';
      
      let innerHtml = '';
      if (holder) {
        innerHtml = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="color: #eab308; font-weight: bold;">[${officeConfig.nameCN}]</span> ${holder.name} (Lv.${holder.level})
            </div>
            <button class="action-btn btn-dismiss" data-adv-id="${holder.id}" style="padding: 5px 10px; font-size: 0.9em; width: auto; background: #991b1b;">解任</button>
          </div>
          <div style="font-size: 0.85em; color: #94a3b8; margin-top: 5px;">
            俸祿: ${officeConfig.salary}金/回合 | 帶兵: ${officeConfig.troopLimit} | 統帥 +${officeConfig.commandBonus}
          </div>
        `;
      } else {
        innerHtml = `
          <div style="color: #94a3b8; cursor: pointer;">
            <span style="color: #eab308; font-weight: bold;">[${officeConfig.nameCN}]</span> 空缺 (點擊指派)
          </div>
          <div style="font-size: 0.85em; color: #64748b; margin-top: 5px;">
            俸祿: ${officeConfig.salary}金/回合 | 帶兵: ${officeConfig.troopLimit} | 統帥 +${officeConfig.commandBonus}
          </div>
        `;
      }

      slotsHtml += `
        <div class="office-slot-card" style="padding: 15px; background: rgba(255,255,255,0.05); border-radius: 4px; ${selectedClass}" data-type="${type}" data-index="${i}" ${!holder ? 'cursor: pointer;' : ''}>
          ${innerHtml}
        </div>
      `;
      totalSlotCount++;
    }
  });

  if (totalSlotCount === 0) {
    slotsHtml = `<div style="color: #94a3b8; padding: 20px;">當前爵位 (${config.titleCN}) 尚未解鎖任何官職。請努力提升聲望與晉升爵位！</div>`;
  }
  
  slotsContainer.innerHTML = slotsHtml;

  // Add event listeners for selecting slots
  slotsContainer.querySelectorAll('.office-slot-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      if (target.querySelector('.btn-dismiss')) return; // If clicking dismiss button, let its handler work
      
      selectedOfficeType = target.getAttribute('data-type') as OfficeType;
      selectedSlotIndex = parseInt(target.getAttribute('data-index')!);
      renderOfficeBoard();
    });
  });

  // Add event listeners for dismiss
  slotsContainer.querySelectorAll('.btn-dismiss').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const advId = (e.currentTarget as HTMLElement).getAttribute('data-adv-id');
      const adv = GameState.adventurers.find(a => a.id === advId);
      if (adv) {
        adv.office = null;
        ToastManager.show(`已解除 ${adv.name} 的官職`);
        selectedOfficeType = null;
        selectedSlotIndex = -1;
        renderOfficeBoard();
        UIManager.updateUI(); // To update top bar resources if needed
      }
    });
  });

  // Render right panel: Candidates
  if (selectedOfficeType === null) {
    candidatesContainer.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px; margin-top: 50px;">請先選擇左側的官職空位<br>來指派您的傭兵。</div>`;
    return;
  }

  const officeConfig = getOfficeConfig(selectedOfficeType);
  const availableAdvs = GameState.adventurers.filter(a => a.office === null);

  let candidatesHtml = '';
  if (availableAdvs.length === 0) {
    candidatesHtml = `<div style="color: #94a3b8; padding: 20px;">目前沒有閒置的傭兵可供指派。</div>`;
  } else {
    candidatesHtml = `<div style="margin-bottom: 10px; color: #eab308;">請選擇一位傭兵擔任 [${officeConfig.nameCN}]：</div>`;
    availableAdvs.forEach(adv => {
      candidatesHtml += `
        <div class="candidate-card" style="padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" data-adv-id="${adv.id}">
          <div>
            <div style="font-weight: bold; color: #fff;">${adv.name} <span style="color: #94a3b8; font-size: 0.9em;">(Lv.${adv.level} ${adv.currentClass})</span></div>
            <div style="font-size: 0.85em; color: #64748b;">統帥: ${adv.baseAttributes.command} | 品質: ${adv.quality}</div>
          </div>
          <button class="action-btn" style="padding: 5px 15px; width: auto; font-size: 0.9em;">任命</button>
        </div>
      `;
    });
  }

  candidatesContainer.innerHTML = candidatesHtml;

  // Add event listeners for assigning office
  candidatesContainer.querySelectorAll('.candidate-card').forEach(card => {
    card.addEventListener('click', (e) => {
      const advId = (e.currentTarget as HTMLElement).getAttribute('data-adv-id');
      const adv = GameState.adventurers.find(a => a.id === advId);
      if (adv && selectedOfficeType) {
        adv.office = selectedOfficeType;
        const config = getOfficeConfig(selectedOfficeType);
        ToastManager.show(`已任命 ${adv.name} 為 ${config.nameCN}`);
        selectedOfficeType = null;
        selectedSlotIndex = -1;
        renderOfficeBoard();
        UIManager.updateUI();
      }
    });
  });
}
