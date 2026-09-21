import { GameState } from '../core/GameState';
import { UIManager } from './UIManager';
import { getTitleConfig, OfficeType, getOfficeConfig, NobleTitle } from '../models/types';
import { ToastManager } from './ToastManager';
import { renderAdventurerCard } from './components/AdventurerCard';
import { HeroPicker } from './components/HeroPicker';


let selectedSlotType: OfficeType | null = null;
let selectedSlotIndex: number = -1;

export function renderOfficeBoard(): void {
  const slotsContainer = document.getElementById('ui-office-slots');
  const candidatesContainer = document.getElementById('ui-office-candidates');
  const btnMakeCapital = document.getElementById('btn-make-capital');
  
  if (!slotsContainer || !candidatesContainer) return;

  const currentNode = GameState.currentViewNode;
  if (!currentNode) {
    slotsContainer.innerHTML = `<div style="color: #94a3b8; padding: 20px;">無法取得當前據點資訊。</div>`;
    return;
  }

  const currentTitle = GameState.myTerritory.title;
  const config = getTitleConfig(currentTitle);
  const slots = config.officeSlots;

  // Handle Capital button logic
  if (btnMakeCapital) {
    const isDukeOrHigher = currentTitle === NobleTitle.DUKE;
    if (isDukeOrHigher && !currentNode.isCapital) {
      btnMakeCapital.style.display = 'block';
      btnMakeCapital.onclick = () => {
        const allNodes = GameState.mapSystem ? GameState.mapSystem.getNodes() : [];
        const oldCapital = allNodes.find(n => n.isCapital);
        if (oldCapital) oldCapital.isCapital = false;
        
        currentNode.isCapital = true;
        
        GameState.adventurers.forEach(a => {
          if (a.office === OfficeType.BANNERET) {
            a.office = null;
            a.stationedNodeId = null;
          }
        });
        
        ToastManager.show(`已冊封 ${currentNode.name} 為首都！`);
        renderOfficeBoard();
      };
    } else {
      btnMakeCapital.style.display = 'none';
    }
  }

  // 1. Render Top Grid: Office Slots
  let slotsHtml = '';
  slotsContainer.innerHTML = '';
  const officesToRender = [OfficeType.CASTELLAN, OfficeType.BANNERET, OfficeType.CAPTAIN, OfficeType.RETAINER];
  let totalAllowedSlots = 0;
  
  // Track all slots that should be rendered so we can bind events
  const slotDataList: Array<{ type: OfficeType, index: number, holder: any | null, isAllowed: boolean }> = [];

  officesToRender.forEach(type => {
    if (type === OfficeType.BANNERET && !currentNode.isCapital) return;
    
    const maxCount = slots[type] || 0;
    if (maxCount === 0) return;
    
    totalAllowedSlots += maxCount;
    const holders = GameState.adventurers.filter(a => a.office === type && a.stationedNodeId === currentNode.id);
    
    for (let i = 0; i < maxCount; i++) {
      const holder = holders[i] || null;
      slotDataList.push({ type, index: i, holder, isAllowed: true });
    }
  });

  if (totalAllowedSlots === 0) {
    slotsContainer.innerHTML = `<div style="color: #94a3b8; padding: 20px;">當前爵位尚未解鎖任何官職。</div>`;
    candidatesContainer.innerHTML = '';
    return;
  }

  // Render slots in Party-like style
  slotDataList.forEach(slotData => {
    const { type, index, holder } = slotData;
    const officeConfig = getOfficeConfig(type);
    const isSelected = (selectedSlotType === type && selectedSlotIndex === index);
    
    // Create slot element
    const slotEl = document.createElement('div');
    slotEl.className = 'adventurer-card';
    if (isSelected) {
      slotEl.style.borderColor = '#eab308';
      slotEl.style.boxShadow = '0 0 10px rgba(234, 179, 8, 0.5)';
    } else {
      slotEl.style.borderColor = 'rgba(255,255,255,0.2)';
      slotEl.style.borderStyle = 'dashed';
    }

    if (holder) {
      slotEl.style.borderStyle = 'solid';
      slotEl.style.borderColor = '#3b82f6';
      
      slotEl.innerHTML = renderAdventurerCard(holder, {
        bottomLabel: officeConfig.nameCN,
        showDismissBtn: true,
        dismissId: holder.id
      });
    } else {
      slotEl.innerHTML = renderAdventurerCard(null, {
        isEmpty: true,
        emptyLabel: officeConfig.nameCN
      });
    }

    // Interactions
    slotEl.addEventListener('click', (e) => {
      // If click dismiss button, do not select slot
      if ((e.target as HTMLElement).classList.contains('btn-dismiss-holder')) return;
      
      if (selectedSlotType === type && selectedSlotIndex === index) {
        selectedSlotType = null;
        selectedSlotIndex = -1;
      } else {
        selectedSlotType = type;
        selectedSlotIndex = index;
      }
      renderOfficeBoard();
    });

    const dismissBtn = slotEl.querySelector('.btn-dismiss-holder');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const advId = (e.currentTarget as HTMLElement).getAttribute('data-id');
        const adv = GameState.adventurers.find(a => a.id === advId);
        if (adv) {
          adv.office = null;
          adv.stationedNodeId = null;
          ToastManager.show(`已解除 ${adv.name} 的官職`);
          selectedSlotType = null;
          selectedSlotIndex = -1;
          renderOfficeBoard();
          UIManager.updateUI();
        }
      });
    }

    slotsContainer.appendChild(slotEl);
  });

  // 2. Render Bottom Grid: Candidates from THIS node using HeroPicker (SSOT)
  if (selectedSlotType === null) {
    candidatesContainer.innerHTML = `<div style="grid-column: 1 / -1; width: 100%; color: #94a3b8; text-align: center; padding: 20px;">請先點擊上方要任命的「空位」，然後選擇下方的傭兵。</div>`;
    return;
  }

  HeroPicker.render({
    container: candidatesContainer,
    adventurers: GameState.adventurers,
    filter: (adv) => adv.office === null && adv.locationNodeId === currentNode.id,
    emptyMessage: '本據點目前沒有閒置的傭兵可供調遣。<br><span style="font-size: 0.8em; color: #94a3b8;">(必須是身處在該據點且無官職的傭兵)</span>',
    cardExtraOptions: (adv) => ({
      extraStats: `統帥: ${adv.baseAttributes.command}`
    }),
    onSelect: (adv) => {
      const existingHolders = GameState.adventurers.filter(a => a.office === selectedSlotType && a.stationedNodeId === currentNode.id);
      const config = getTitleConfig(currentTitle);
      const maxCount = config.officeSlots[selectedSlotType!] || 0;
      
      if (existingHolders.length >= maxCount) {
        ToastManager.show('該官職的槽位已滿，請先解任原有官員！');
        return;
      }

      adv.office = selectedSlotType;
      adv.stationedNodeId = currentNode.id;
      
      const officeConfig = getOfficeConfig(selectedSlotType!);
      ToastManager.show(`已任命 ${adv.name} 為 ${officeConfig.nameCN}`);
      
      selectedSlotType = null;
      selectedSlotIndex = -1;
      renderOfficeBoard();
      UIManager.updateUI();
    }
  });

  // 更新攻城重型軍備庫存展示
  const territory = GameState.myTerritory;
  const ramEl = document.getElementById('hall-siege-ram-count');
  const trebEl = document.getElementById('hall-siege-treb-count');
  const stock = territory.siegeEngineStock || { ram: 0, trebuchet: 0 };

  if (ramEl) ramEl.textContent = (stock.ram || 0).toString();
  if (trebEl) trebEl.textContent = (stock.trebuchet || 0).toString();
}
