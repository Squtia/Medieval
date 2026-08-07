import { GameState } from '../core/GameState';
import { ToastManager } from './ToastManager';
import { UIManager } from './UIManager';
import { renderAdventurerCard } from './components/AdventurerCard';
import { getMaxRosterLimit } from '../models/types';
import { TavernSystem } from '../systems/TavernSystem';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';

export function initRecruitController(): void {
  const modalRecruit = document.getElementById('modal-recruit');
  const recruitCardsContainer = document.getElementById('recruit-cards-container');
  const btnCloseRecruit = document.getElementById('btn-close-recruit');
  
  // 原有的招募按鈕已被移除，現在應該從 FacilityController 點擊進入酒館時呼叫渲染
  // 我們將渲染邏輯封裝起來並導出供外部調用
  


  const btnAskRumor = document.getElementById('btn-ask-rumor');
  if (btnAskRumor) {
    btnAskRumor.addEventListener('click', () => {
      const territory = GameState.myTerritory;
      const rumorDialogue = document.getElementById('tavern-rumor-dialogue');
      
      if (territory.gold < 50) {
        ToastManager.show('⚠️ 金幣不足 50G，老闆不想理你。');
        return;
      }
      
      const response = TavernSystem.askRumor(territory);
      
      if (rumorDialogue) {
        rumorDialogue.innerHTML = response.replace(/\n/g, '<br/>');
        rumorDialogue.style.color = '#fff';
      }
      UIManager.updateUI(); // 更新金幣顯示
    });
  }

  // 監聽天數推進事件，自動刷新酒館快取與畫面
  EventBus.getInstance().subscribe(GameEventType.DAY_PASSED, () => {
    selectedTavernGuest = null; // 無條件清除快取，確保日後或當下進入酒館時自動選中最新傭兵
    const viewCamp = document.getElementById('view-camp');
    if (viewCamp && viewCamp.classList.contains('active')) {
      renderTavernView();
    }
  });

}

let selectedTavernGuest: any = null;

export function renderTavernView(): void {
  const recruitCardsContainer = document.getElementById('recruit-cards-container');
  const rumorSection = document.getElementById('tavern-rumor-section');
  const rumorDialogue = document.getElementById('tavern-rumor-dialogue');
  const territory = GameState.myTerritory;

  if (!recruitCardsContainer) return;

  const tavernLvl = territory.tavernLevel || 0;
  if (tavernLvl <= 0) {
    ToastManager.show('⚠️ 請先至領主自宅（書房）建造傭兵酒館！');
    return;
  }

  // 重置情報對話框
  if (rumorDialogue) {
    rumorDialogue.innerHTML = '「想打聽點什麼嗎？」';
    rumorDialogue.style.color = '#cbd5e1';
  }

  // 顯示或隱藏情報功能 (Lv3 以上解鎖)
  if (rumorSection) {
    rumorSection.style.display = tavernLvl >= 3 ? 'block' : 'none';
  }

  recruitCardsContainer.innerHTML = '';

  const guests = territory.tavernGuests || [];
  
  if (guests.length === 0) {
    recruitCardsContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; width: 100%; grid-column: 1 / -1;">酒館裡空蕩蕩的，沒有半個傭兵...</p>';
    selectedTavernGuest = null;
    renderSelectedGuestDetail();
  } else {
    // 確保有預設選擇
    if (!selectedTavernGuest || !guests.find(g => g.adventurer.id === selectedTavernGuest.adventurer.id)) {
      selectedTavernGuest = guests[0];
    }

    guests.forEach(guest => {
      const adv = guest.adventurer;
      const isSelected = selectedTavernGuest && selectedTavernGuest.adventurer.id === adv.id;
      
      // 使用標準的 AdventurerCard 渲染
      const card = document.createElement('div');
      card.className = 'adventurer-card';
      if (isSelected) {
        card.classList.add('selected');
        card.style.borderColor = '#3b82f6';
        card.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';
      } else {
        card.style.borderColor = 'rgba(255,255,255,0.1)';
        card.style.boxShadow = 'none';
      }
      
      card.dataset.id = adv.id;
      card.innerHTML = renderAdventurerCard(adv, { cornerLabel: isSelected ? '✓' : '' });
      card.style.position = 'relative';
      card.style.cursor = 'pointer';
      
      card.addEventListener('click', () => {
        selectedTavernGuest = guest;
        renderTavernView(); // 重新渲染以更新選擇狀態
      });

      recruitCardsContainer.appendChild(card);
    });
    
    renderSelectedGuestDetail();
  }
}

function renderSelectedGuestDetail() {
  const detailPanel = document.getElementById('tavern-selected-detail');
  const dialogueBox = document.getElementById('recruit-dialogue');
  const statPower = document.getElementById('recruit-stat-power');
  const statTrait = document.getElementById('recruit-stat-trait');
  const btnConfirm = document.getElementById('btn-recruit-confirm') as HTMLButtonElement;
  
  if (!detailPanel) return;

  if (!selectedTavernGuest) {
    detailPanel.style.display = 'none';
    return;
  }

  detailPanel.style.display = 'flex';
  
  const adv = selectedTavernGuest.adventurer;
  const territory = GameState.myTerritory;
  
  if (dialogueBox) {
    const defaultDialogue = '能為您效勞是我的榮幸！';
    const text = adv.trait && adv.trait.recruitDialogue ? adv.trait.recruitDialogue : defaultDialogue;
    dialogueBox.innerHTML = `💬 「${text}」`;
  }
  
  // 取得綜合戰力（以 getCombatStats 計算 atk+def+hp 估算，或保留原本欄位）
  const cs = adv.getCombatStats ? adv.getCombatStats() : null;
  const effectiveAttr = adv.getEffectiveAttributes ? adv.getEffectiveAttributes() : adv.baseAttributes;
  const totalPower = cs ? Math.floor((cs.atk * 2 + cs.def + cs.hp / 10)) : (adv.combatPower || 100);
  
  if (statPower) statPower.innerText = `${totalPower}`;
  if (statTrait) {
    statTrait.innerText = adv.trait ? adv.trait.name : '無';
  }

  // === 填入八維屬性 ===
  const attrMap: Record<string, string> = {
    'adv-attr-str': `${effectiveAttr.str}`,
    'adv-attr-agi': `${effectiveAttr.agi}`,
    'adv-attr-con': `${effectiveAttr.con}`,
    'adv-attr-int': `${effectiveAttr.int}`,
    'adv-attr-spr': `${effectiveAttr.spr}`,
    'adv-attr-luk': `${effectiveAttr.luk}`,
    'adv-attr-charm': `${effectiveAttr.charm}`,
    'adv-attr-command': `${effectiveAttr.command}`,
  };
  for (const [id, val] of Object.entries(attrMap)) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  }

  // === 填入衍生戰鬥數值 ===
  if (cs) {
    const combatMap: Record<string, string> = {
      'adv-cs-hp':   `${cs.hp}`,
      'adv-cs-mp':   `${cs.mp}`,
      'adv-cs-patk': `${cs.patk}`,
      'adv-cs-matk': `${cs.matk}`,
      'adv-cs-pdef': `${cs.pdef}`,
      'adv-cs-mdef': `${cs.mdef}`,
      'adv-cs-hit':  `${cs.hit}`,
      'adv-cs-evade':`${cs.evade}`,
      'adv-cs-crit': `${cs.critRate}%`,
    };
    for (const [id, val] of Object.entries(combatMap)) {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    }
  }

  if (btnConfirm) {
    const basePrice = 500;
    const modifier = adv.trait?.recruitmentModifier || 1.0;
    const finalPrice = Math.floor(basePrice * modifier);
    
    btnConfirm.innerText = `✅ 招募 (${finalPrice}金)`;
    
    // 清除舊的事件綁定
    const newBtn = btnConfirm.cloneNode(true) as HTMLButtonElement;
    btnConfirm.parentNode?.replaceChild(newBtn, btnConfirm);
    
    newBtn.addEventListener('click', () => {
      const maxRoster = getMaxRosterLimit(territory.title);
      if (GameState.adventurers.length >= maxRoster) {
        ToastManager.show(`⚠️ 英雄名單已滿！當前爵位最多容納 ${maxRoster} 名英雄。`);
        return;
      }

      if (territory.gold >= finalPrice) {
        territory.gold -= finalPrice;
        adv.locationNodeId = GameState.currentViewNode ? GameState.currentViewNode.id : territory.currentCountryId;
        GameState.adventurers.push(adv);
        
        // 從酒館名單移除
        territory.tavernGuests = territory.tavernGuests.filter((g: any) => g.adventurer.id !== adv.id);
        
        ToastManager.show(`🍻 成功招募了新夥伴「${adv.name}」！`);
        
        selectedTavernGuest = null;
        renderTavernView();
        UIManager.updateUI();
      } else {
        ToastManager.show(`⚠️ 金幣不足，需要 ${finalPrice} 金幣！`);
      }
    });
  }
}

