import { positionFloatingElement } from './FloatingPosition';
import { ToastManager } from './ToastManager';
import { Adventurer } from '../models/Adventurer';
import { EquipmentSlot, MapNode, NodeLevel, NodeFeature, AdventurerState, getMaxCaravansLimit, FactionChampion } from '../models/types';
import { GameState } from '../core/GameState';
import { renderAdventurerCard } from './components/AdventurerCard';
import { EnhancementSystem } from '../systems/EnhancementSystem';
import { UIManager } from './UIManager';
import { DataStore } from '../systems/DataStore';
import { EquipmentGenerator } from '../systems/EquipmentGenerator';
import { DispatchTask, EnemyFeature, TaskType, TradeInstruction, TradePhase } from '../models/DispatchTask';
import { monsterSystem } from '../systems/MonsterSystem';
import { GAME_EVENTS } from '../data/EventData';
import { startRoutePlanning } from './MapController';
import { TRADE_GOODS } from '../systems/MarketSystem';
import { DispatchSystem, ActiveMission } from '../systems/DispatchSystem';
import { CombatUIManager } from './CombatUIManager';
import { Random } from '../core/Random';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import {
  getCombatPrestigeReward,
  getDifficultyModifiers
} from '../data/BalanceData';

export async function openWarehouse(isForgeMode: boolean) {
  const { openWarehouse: impl } = await import('./ShopController');
  impl(isForgeMode);
}

let currentPartyAdv: Adventurer | null = null;
let currentPartyTab: 'stats' | 'equip' = 'stats';
let tempAllocations: Record<string, number> = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };

export function getSelectedPartyAdventurer(): Adventurer | null {
  return currentPartyAdv;
}

export function selectPartyAdventurer(adv: Adventurer | null) {
  if (currentPartyAdv !== adv) {
    currentPartyAdv = adv;
    tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
  }
  renderPartyUpperSection();
}

export function setPartyTab(tab: 'stats' | 'equip') {
  currentPartyTab = tab;
  const btnStats = document.getElementById('tab-btn-stats');
  const btnEquip = document.getElementById('tab-btn-equip');
  if (btnStats && btnEquip) {
    if (tab === 'stats') {
      btnStats.className = 'party-tab-btn active';
      btnStats.style.border = '1px solid rgba(234,179,8,0.4)';
      btnStats.style.background = 'rgba(234,179,8,0.2)';
      btnStats.style.color = '#eab308';
      
      btnEquip.className = 'party-tab-btn';
      btnEquip.style.border = '1px solid rgba(255,255,255,0.1)';
      btnEquip.style.background = 'rgba(255,255,255,0.05)';
      btnEquip.style.color = '#94a3b8';
    } else {
      btnEquip.className = 'party-tab-btn active';
      btnEquip.style.border = '1px solid rgba(234,179,8,0.4)';
      btnEquip.style.background = 'rgba(234,179,8,0.2)';
      btnEquip.style.color = '#eab308';

      btnStats.className = 'party-tab-btn';
      btnStats.style.border = '1px solid rgba(255,255,255,0.1)';
      btnStats.style.background = 'rgba(255,255,255,0.05)';
      btnStats.style.color = '#94a3b8';
    }
  }
  renderPartyUpperSection();
}

export function renderPartyUpperSection() {
  if (!currentPartyAdv || !GameState.adventurers.includes(currentPartyAdv)) {
    currentPartyAdv = GameState.adventurers[0] || null;
  }
  const adv = currentPartyAdv;
  const titleEl = document.getElementById('party-panel-title');
  if (!adv) {
    if (titleEl) titleEl.textContent = '🛡️ 冒險者小隊 (無冒險者)';
    const viewport = document.getElementById('party-tab-viewport');
    if (viewport) viewport.innerHTML = '<div style="color:#94a3b8; text-align:center; padding-top:40px;">目前尚無冒險者，請至酒館招募！</div>';
    const cardEl = document.getElementById('party-portrait-card');
    if (cardEl) cardEl.style.display = 'none';
    return;
  }

  const cardEl = document.getElementById('party-portrait-card');
  if (cardEl) cardEl.style.display = 'flex';

  // 1. 更新頂部動態冒險者姓名標題
  if (titleEl) {
    titleEl.textContent = `🛡️ ${adv.name} (Lv.${adv.level} ${adv.job.name})`;
  }

  // 2. 更新左側常駐立繪卡
  const avatarEl = document.getElementById('party-portrait-avatar');
  const jobTraitEl = document.getElementById('party-job-trait');
  const traitNameEl = document.getElementById('party-trait-name');
  const statusBadgeEl = document.getElementById('party-status-badge');

  if (avatarEl) avatarEl.textContent = '🦸';
  if (jobTraitEl) jobTraitEl.textContent = `Lv.${adv.level} ${adv.job.name}`;
  if (traitNameEl) traitNameEl.textContent = adv.trait.name;

  // 更新半身像正下方的 HP / MP 能量條
  const stats = adv.getCombatStats();
  const hpTextEl = document.getElementById('party-bar-hp-text');
  const hpFillEl = document.getElementById('party-bar-hp-fill');
  const mpTextEl = document.getElementById('party-bar-mp-text');
  const mpFillEl = document.getElementById('party-bar-mp-fill');
  
  if (hpTextEl) hpTextEl.textContent = `${stats.hp} / ${stats.hp}`;
  if (hpFillEl) hpFillEl.style.width = '100%';
  if (mpTextEl) mpTextEl.textContent = `${stats.mp} / ${stats.mp}`;
  if (mpFillEl) mpFillEl.style.width = '100%';

  if (statusBadgeEl) {
    if (adv.currentState === AdventurerState.RESTING) {
      statusBadgeEl.textContent = `🛌 休養(${adv.restingDaysLeft}天)`;
      statusBadgeEl.style.background = 'rgba(234, 179, 8, 0.2)';
      statusBadgeEl.style.color = '#fde047';
      statusBadgeEl.style.borderColor = 'rgba(234, 179, 8, 0.4)';
    } else if (adv.currentState !== AdventurerState.IDLE) {
      statusBadgeEl.textContent = '🔴 任務中';
      statusBadgeEl.style.background = 'rgba(239, 68, 68, 0.2)';
      statusBadgeEl.style.color = '#f87171';
      statusBadgeEl.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    } else {
      statusBadgeEl.textContent = '🟢 閒置中';
      statusBadgeEl.style.background = 'rgba(34, 197, 94, 0.2)';
      statusBadgeEl.style.color = '#4ade80';
      statusBadgeEl.style.borderColor = 'rgba(34, 197, 94, 0.4)';
    }
  }

  // 3. 更新中間 Viewport (根據當前頁籤)
  const viewport = document.getElementById('party-tab-viewport');
  if (!viewport) return;

  const attr = adv.getEffectiveAttributes();

  if (currentPartyTab === 'stats') {
    const sumAllocated = tempAllocations.str + tempAllocations.agi + tempAllocations.con + tempAllocations.int + tempAllocations.spr + tempAllocations.luk;
    const tempUnspent = adv.unspentStatPoints - sumAllocated;
    
    const unspentBanner = (adv.unspentStatPoints > 0 || sumAllocated > 0)
      ? `<div style="text-align: center; color: #eab308; font-weight: bold; font-size: 0.8em; margin-bottom: 4px; background: rgba(234,179,8,0.15); padding: 2px; border-radius: 4px;">可用點數：${tempUnspent}</div>` 
      : '';

    const getStatRow = (label: string, key: 'str' | 'agi' | 'con' | 'int' | 'spr' | 'luk', val: number) => {
      const tempVal = tempAllocations[key] || 0;
      const plusBtn = tempUnspent > 0 
        ? `<button class="btn-temp-plus" data-stat="${key}" style="margin-left:4px; padding:0 4px; font-size:0.75em; cursor:pointer; background:rgba(34,197,94,0.3); border:1px solid #22c55e; color:#fff; border-radius:3px;">+</button>` 
        : '';
      const minusBtn = tempVal > 0 
        ? `<button class="btn-temp-minus" data-stat="${key}" style="margin-left:2px; padding:0 4px; font-size:0.75em; cursor:pointer; background:rgba(239,68,68,0.3); border:1px solid #ef4444; color:#fff; border-radius:3px;">-</button>` 
        : '';
      const greenStr = tempVal > 0 ? `<span style="color:#22c55e; font-size:0.8em; font-weight:bold;">(+${tempVal})</span>` : '';
      return `<div style="display:flex; justify-content:space-between; align-items:center; font-size:0.78em; background:rgba(255,255,255,0.03); padding:2px 6px; border-radius:4px;"><span style="color:#94a3b8;">${label}</span><span style="font-weight:bold; color:#f1f5f9;">${val + tempVal}${greenStr}${plusBtn}${minusBtn}</span></div>`;
    };

    let confirmBtnsHtml = '';
    if (sumAllocated > 0) {
      confirmBtnsHtml = `
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <button id="btn-confirm-stats" class="action-btn" style="flex:1; background:linear-gradient(135deg, #059669, #047857); padding:3px 0; font-size:0.78em; font-weight:bold;">確認分配</button>
          <button id="btn-reset-stats" class="action-btn" style="flex:1; background:rgba(255,255,255,0.1); padding:3px 0; font-size:0.78em;">重設</button>
        </div>
      `;
    }

    viewport.innerHTML = `
      ${unspentBanner}
      <div style="font-size: 0.78em; margin-bottom: 4px; background: rgba(234,179,8,0.12); padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(234,179,8,0.2); display: flex; justify-content: space-between; align-items: center;">
        <span>⚔️ 戰力：<b style="color:#eab308; font-size: 1.05em;">${adv.power}</b></span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3px;">
        <div style="display:flex; justify-content:space-between; font-size:0.75em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">物攻 (ATK)</span><span style="color:#eab308; font-weight:bold;">${stats.atk}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.75em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">防禦 (DEF)</span><span style="color:#eab308; font-weight:bold;">${stats.def}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.75em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">命中 (HIT)</span><span style="color:#3b82f6;">${stats.hit}</span></div>
        <div style="display:flex; justify-content:space-between; font-size:0.75em; background:rgba(255,255,255,0.03); padding:2px 5px; border-radius:3px;"><span style="color:#94a3b8;">閃避 (EVD)</span><span style="color:#3b82f6;">${stats.evade}</span></div>
      </div>

      <div style="font-size:0.75em; color:#e2e8f0; font-weight:bold; margin: 4px 0 2px 0; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:2px;">六維屬性：</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3px;">
        ${getStatRow('STR 力量', 'str', attr.str)}
        ${getStatRow('AGI 敏捷', 'agi', attr.agi)}
        ${getStatRow('CON 體質', 'con', attr.con)}
        ${getStatRow('INT 智慧', 'int', attr.int)}
        ${getStatRow('SPR 精神', 'spr', attr.spr)}
        ${getStatRow('LUK 幸運', 'luk', attr.luk)}
      </div>

      <div style="display: flex; gap: 8px; font-size:0.72em; margin-top:4px; background:rgba(255,255,255,0.02); padding:2px 5px; border-radius:3px;">
        <span style="color:#94a3b8;">魅力 (CHM): <b style="color:#f472b6;">${attr.charm}</b></span>
        <span style="color:#94a3b8;">統帥 (CMD): <b style="color:#60a5fa;">${attr.command}</b></span>
      </div>

      ${confirmBtnsHtml}
    `;

    viewport.querySelectorAll('.btn-temp-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).getAttribute('data-stat')!;
        tempAllocations[key] = (tempAllocations[key] || 0) + 1;
        renderPartyUpperSection();
      });
    });

    viewport.querySelectorAll('.btn-temp-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = (e.currentTarget as HTMLElement).getAttribute('data-stat')!;
        if ((tempAllocations[key] || 0) > 0) {
          tempAllocations[key]--;
        }
        renderPartyUpperSection();
      });
    });

    const btnConfirm = viewport.querySelector('#btn-confirm-stats');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        for (const [key, val] of Object.entries(tempAllocations)) {
          if (val > 0) {
            for (let i = 0; i < val; i++) {
              adv.allocateStat(key as any);
            }
          }
        }
        tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
        renderPartyUpperSection();
        UIManager.updateUI();
      });
    }

    const btnReset = viewport.querySelector('#btn-reset-stats');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
        renderPartyUpperSection();
      });
    }
  } else if (currentPartyTab === 'equip') {
    const slots = [
      { key: EquipmentSlot.WEAPON, name: '武器', icon: '🗡️' },
      { key: EquipmentSlot.ARMOR, name: '防具', icon: '🛡️' },
      { key: EquipmentSlot.ACCESSORY, name: '飾品', icon: '💍' }
    ];

    let equipRowsHtml = '';
    slots.forEach(s => {
      const eq = adv.equipment[s.key];
      if (eq) {
        const lvlStr = eq.enhancementLevel ? `+${eq.enhancementLevel}` : '';
        equipRowsHtml += `
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:3px 6px; border-radius:4px; font-size:0.78em; margin-bottom:3px;">
            <span>${eq.icon || s.icon} <b>${eq.name} ${lvlStr}</b></span>
            <button class="action-btn btn-party-unequip" data-slot="${s.key}" style="padding:1px 5px; font-size:0.75em; background:rgba(239,68,68,0.3); border-color:#ef4444; color:#fff;">卸下</button>
          </div>
        `;
      } else {
        equipRowsHtml += `
          <div class="btn-party-equip" data-slot="${s.key}" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px dashed rgba(255,255,255,0.15); padding:3px 6px; border-radius:4px; font-size:0.78em; margin-bottom:3px; cursor:pointer;">
            <span style="color:#64748b;">${s.icon} ${s.name} (空位)</span>
            <span style="color:#3b82f6; font-size:0.8em;">+ 裝備</span>
          </div>
        `;
      }
    });

    const canRetire = adv.trait.name !== '誓約守衛';
    const retireBtnHtml = canRetire ? `
        <button id="btn-party-retire-init" class="action-btn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; padding: 2px 6px; font-size: 0.72em; border-radius: 4px; cursor: pointer;">
          🚪 退休...
        </button>
        <div id="retire-confirm-group" style="display:none; gap:4px;">
          <button id="btn-party-retire-confirm" class="action-btn" style="background: rgba(239,68,68,0.2); border: 1px solid #ef4444; color: #f87171; padding: 2px 6px; font-size: 0.72em; border-radius: 4px; cursor: pointer;">
            ⚠️ 確認退休
          </button>
          <button id="btn-party-retire-cancel" class="action-btn" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; padding: 2px 6px; font-size: 0.72em; border-radius: 4px; cursor: pointer;">
            取消
          </button>
        </div>
    ` : `<span style="font-size: 0.72em; color: #64748b; font-style: italic;">誓約守衛不可退休</span>`;

    viewport.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
        <span style="font-size:0.78em; color:#eab308; font-weight:bold;">裝備槽位：</span>
        ${retireBtnHtml}
      </div>
      ${equipRowsHtml}
    `;

    viewport.querySelectorAll('.btn-party-unequip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slotKey = (e.currentTarget as HTMLElement).getAttribute('data-slot') as EquipmentSlot;
        const eq = adv.equipment[slotKey];
        if (eq) {
          adv.unequip(slotKey);
          GameState.myTerritory.addEquipmentToWarehouse(eq);
          renderPartyUpperSection();
          UIManager.updateUI();
        }
      });
    });

    viewport.querySelectorAll('.btn-party-equip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slotKey = (e.currentTarget as HTMLElement).getAttribute('data-slot') as EquipmentSlot;
        openEquipSelect(adv, slotKey);
      });
    });

    const btnRetireInit = viewport.querySelector('#btn-party-retire-init') as HTMLButtonElement;
    const retireConfirmGroup = viewport.querySelector('#retire-confirm-group') as HTMLDivElement;
    const btnRetireConfirm = viewport.querySelector('#btn-party-retire-confirm') as HTMLButtonElement;
    const btnRetireCancel = viewport.querySelector('#btn-party-retire-cancel') as HTMLButtonElement;

    if (btnRetireInit && retireConfirmGroup && btnRetireConfirm && btnRetireCancel) {
      btnRetireInit.addEventListener('click', () => {
        btnRetireInit.style.display = 'none';
        retireConfirmGroup.style.display = 'flex';
      });

      btnRetireCancel.addEventListener('click', () => {
        retireConfirmGroup.style.display = 'none';
        btnRetireInit.style.display = 'block';
      });

      btnRetireConfirm.addEventListener('click', () => {
        if (confirm(`確定要讓 ${adv.name} 退休嗎？\n退休後將利用其魅力 (當前: ${attr.charm}) 永久提升領地每日稅收！`)) {
          const slotsArr = [EquipmentSlot.WEAPON, EquipmentSlot.ARMOR, EquipmentSlot.ACCESSORY];
          slotsArr.forEach(s => {
            const eq = adv.equipment[s];
            if (eq) {
              adv.unequip(s);
              GameState.myTerritory.addEquipmentToWarehouse(eq);
            }
          });
          GameState.myTerritory.retireAdventurer(adv);
          const index = GameState.adventurers.indexOf(adv);
          if (index !== -1) {
            GameState.adventurers.splice(index, 1);
          }
          currentPartyAdv = GameState.adventurers[0] || null;
          renderPartyUpperSection();
          UIManager.updateUI();
        }
      });
    }
  }
}

export function openAdvDetail(adv: Adventurer) {
  selectPartyAdventurer(adv);
  const modal = document.getElementById('modal-party-list');
  if (modal) {
    modal.classList.add('active');
  }
}

export function openEquipSelect(adv: Adventurer, slotKey: EquipmentSlot) {
  const modalEquipSelect = document.getElementById('modal-equip-select')!;
  const equipSelectList = document.getElementById('equip-select-list')!;
  const myTerritory = GameState.myTerritory;

  equipSelectList.innerHTML = '';
  const availableEqs = myTerritory.warehouse.filter(e => e.slot === slotKey);

  if (availableEqs.length === 0) {
    equipSelectList.innerHTML = `<p style="text-align:center; color:#94a3b8;">倉庫中沒有符合條件的裝備。</p>`;
  } else {
    availableEqs.forEach(eq => {
      const card = document.createElement('div');
      card.className = 'glass-panel';
      card.style.padding = '10px';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      
      const statsStr = Object.entries(eq.combatEffects || {}).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(', ');
      const lvlStr = eq.enhancementLevel ? `+${eq.enhancementLevel}` : '';

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:2em;">${eq.icon || '🛡️'}</span>
          <div>
            <strong style="color:#e2e8f0;">${eq.name} ${lvlStr}</strong><br/>
            <span style="font-size:0.8em; color:#94a3b8;">${statsStr}</span>
          </div>
        </div>
        <button class="action-btn" style="padding:5px 15px; font-size:0.9em;">裝備</button>
      `;

      card.querySelector('button')!.addEventListener('click', () => {
        try {
          adv.equip(eq);
          myTerritory.removeEquipmentFromWarehouse(eq.uuid!);
          console.log(`[系統] ${adv.name} 裝備了 ${eq.name}！`);
          modalEquipSelect.classList.remove('active');
          openAdvDetail(adv);
          UIManager.updateUI();
        } catch (e: any) {
          ToastManager.show(e.message); 
        }
      });
      equipSelectList.appendChild(card);
    });
  }

  modalEquipSelect.classList.add('active');
}

// === Radial Menu 與派遣系統 ===

export function closeRadialMenu() {
  const radialMenu = document.getElementById('radial-menu');
  if (radialMenu) {
    radialMenu.classList.remove('active');
    radialMenu.innerHTML = '';
  }
}

export function openRadialMenu(node: MapNode, targetEl: HTMLElement) {
  const radialMenu = document.getElementById('radial-menu')!;
  radialMenu.innerHTML = '';
  
  // 計算節點相對於 radial-menu 父元素的精確像素位置
  const nodeRect = targetEl.getBoundingClientRect();
  const parentEl = radialMenu.parentElement!;
  const parentRect = parentEl.getBoundingClientRect();
  
  const nodeCenterX = nodeRect.left - parentRect.left + nodeRect.width / 2;
  const nodeCenterY = nodeRect.top - parentRect.top + nodeRect.height / 2;

  radialMenu.style.left = `${nodeCenterX}px`;
  radialMenu.style.top = `${nodeCenterY}px`;

  // Tooltip（顯示在節點下方）
  const tooltip = document.createElement('div');
  tooltip.className = 'radial-tooltip';
  tooltip.id = 'radial-tooltip';
  radialMenu.appendChild(tooltip);
  
  const buttons: { icon: string, text: string, action: () => void, disabled?: boolean }[] = [];

  // 動態判斷可用功能
  if (node.ownerFactionId !== null && !node.isPlayerBase) {
    // UI-13: 間諜功能準備中，改為 disabled 灰色不可點擊（保留提醒待開發）
    buttons.push({ icon: '👁️', text: '派遣間諜 (開發中)', action: () => {}, disabled: true });
  }
  if (node.ownerFactionId === null && !node.isPlayerBase) {
    if (node.nodeLevel === NodeLevel.WILDERNESS) {
      buttons.push({ icon: '⛺', text: '在此建立據點', action: () => {
        if (GameState.mapSystem.foundSettlement(node.id, GameState.myTerritory)) {
          closeRadialMenu();
          import('./SceneController').then(m => m.enterScene(node));
        }
      }});
    }
  }
  if (!node.isPlayerBase) {
    if (node.ownerFactionId !== null) {
      buttons.push({ icon: '🛡️', text: '發動攻城戰', action: () => openDispatchSetup(node, 'war') });
    } else {
      buttons.push({ icon: '⚔️', text: '派遣傭兵討伐', action: () => openDispatchSetup(node, 'subjugation') });
    }
  }

  const radius = 60; // 圓半徑
  const angleStep = (2 * Math.PI) / buttons.length;

  // 根據節點在地圖中的位置，動態計算起始角度使按鈕朝向中央展開
  // node.x, node.y 是 0~100 的百分比座標
  // 計算方向：從節點指向地圖中心 (50, 50) 的角度
  const dirX = 50 - node.x; // 正值 = 偏右，負值 = 偏左
  const dirY = 50 - node.y; // 正值 = 偏下，負值 = 偏上
  const startAngle = Math.atan2(dirY, dirX) - (Math.PI * (buttons.length - 1)) / buttons.length / 2;

  buttons.forEach((btnInfo, index) => {
    const angle = startAngle + index * angleStep;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    const btnEl = document.createElement('div');
    btnEl.className = 'radial-btn';
    
    // UI-13: 若為 disabled 狀態，加入灰色樣式且不可點擊
    if (btnInfo.disabled) {
      btnEl.style.opacity = '0.35';
      btnEl.style.filter = 'grayscale(1)';
      btnEl.style.cursor = 'not-allowed';
    }
    
    btnEl.innerHTML = btnInfo.icon;
    btnEl.style.left = `${x}px`;
    btnEl.style.top = `${y}px`;

    btnEl.addEventListener('mouseenter', () => {
      tooltip.textContent = btnInfo.text;
      tooltip.style.opacity = '1';
      tooltip.style.top = '80px';
    });
    btnEl.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
    
    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
      // UI-13: disabled 按鈕不觸發區塊
      if (btnInfo.disabled) return;
      btnInfo.action();
      closeRadialMenu();
    });

    radialMenu.appendChild(btnEl);
  });

  radialMenu.classList.add('active');
}

let pendingDispatchTask: DispatchTask | null = null;
let pendingDispatchNode: MapNode | null = null;
let selectedAdventurersForDispatch: Set<string> = new Set();
let selectedTroopsForDispatch: Record<string, number> = {};

export function openDispatchSetup(node: MapNode, actionType: 'subjugation' | 'war' | 'diplomacy') {
  const modal = document.getElementById('modal-dispatch-setup')!;
  const title = document.getElementById('dispatch-setup-title')!;
  const desc = document.getElementById('dispatch-setup-desc')!;
  const reqPowerEl = document.getElementById('dispatch-req-power')!;
  
  pendingDispatchNode = node;
  selectedAdventurersForDispatch.clear();
  selectedTroopsForDispatch = {};
  // 根據 NodeLevel 或自訂難度決定難度
  const difficultyModifiers = getDifficultyModifiers(GameState.worldGeneration?.difficulty);
  const rawBaseDiff = node.baseDifficulty !== undefined ? node.baseDifficulty : (node.nodeLevel === NodeLevel.WILDERNESS ? 10 : 20 + node.nodeLevel * 10);
  const baseDiff = Math.max(1, Math.round(rawBaseDiff * difficultyModifiers.enemyStrength));
  const rawMinPower = node.nodeLevel === NodeLevel.WILDERNESS ? 30 : 50 + node.nodeLevel * 40;
  const minPower = Math.max(1, Math.round(rawMinPower * difficultyModifiers.enemyStrength));
  
  const optionsContainer = document.getElementById('dispatch-subjugation-options')!;
  
  if (actionType === 'diplomacy') {
    optionsContainer.style.display = 'none';
    title.innerHTML = '🤝 外交使節隊伍編制';
    desc.textContent = `目標：${node.name} (派遣使節前往簽署通商條約)`;
    pendingDispatchTask = new DispatchTask(`外交使節前往${node.name}`, TaskType.DIPLOMACY, 3, 0, 50, 0, 30);
    pendingDispatchTask.targetNodeId = node.id;
  } else if (actionType === 'war') {
    optionsContainer.style.display = 'block';
    title.innerHTML = '🛡️ 攻城隊伍編制';
    const features = Object.values(EnemyFeature);
    const randomFeature = Random.pick(features);
    const prestigeReward = getCombatPrestigeReward(baseDiff, true, node.nodeLevel);
    pendingDispatchTask = new DispatchTask(`攻城${node.name}`, TaskType.COMBAT, 4, baseDiff, 100 + node.nodeLevel * 50, prestigeReward, minPower, randomFeature);
    pendingDispatchTask.targetNodeId = node.id;
    pendingDispatchTask.isWar = true;
    
    let fStr = '';
    if (randomFeature === EnemyFeature.HIGH_DEF) fStr = '（高防禦敵人：建議高攻擊與多波續戰能力）';
    if (randomFeature === EnemyFeature.HIGH_EVADE) fStr = '（高閃避敵人：建議高命中隊員）';
    desc.textContent = `目標：${node.name}${fStr} - 難度評估：${baseDiff}`;
  } else {
    optionsContainer.style.display = 'block';
    title.innerHTML = '⚔️ 討伐隊伍編制';
    const features = Object.values(EnemyFeature);
    const randomFeature = Random.pick(features);
    
    // 透過魔物系統產出實際的怪物陣容
    const enemyLineup = monsterSystem.generateEncounter(node.terrain, baseDiff);
    
    // 討伐任務需要較長天數 (預設 4 天)
    const prestigeReward = getCombatPrestigeReward(baseDiff, false, node.nodeLevel);
    pendingDispatchTask = new DispatchTask(`討伐${node.name}`, TaskType.COMBAT, 4, baseDiff, 100 + node.nodeLevel * 50, prestigeReward, minPower, randomFeature);
    pendingDispatchTask.targetNodeId = node.id;
    pendingDispatchTask.enemyLineup = enemyLineup;
    
    let fStr = '';
    if (enemyLineup && enemyLineup.length > 0) {
      const monsterInstance = enemyLineup[0] as any; // Cast to access calculatedPowerScore easily
      fStr = `\n情報回報：營地周圍預估有 ${enemyLineup.length} 隻【${enemyLineup[0].name}】(單體戰力評估：${monsterInstance.calculatedPowerScore ? Math.round(monsterInstance.calculatedPowerScore) : '未知'})`;
    } else {
      if (randomFeature === EnemyFeature.HIGH_DEF) fStr = '（高防禦敵人：建議高攻擊與多波續戰能力）';
      if (randomFeature === EnemyFeature.HIGH_EVADE) fStr = '（高閃避敵人：建議高命中隊員）';
    }
    desc.textContent = `目標：${node.name}${fStr} - 難度評估：${baseDiff}`;
  }

  reqPowerEl.textContent = `🎯 建議戰力：${pendingDispatchTask.minPowerRequired}`;
  
  const playerBase = GameState.mapSystem.getNodes().find(candidate => candidate.isPlayerBase);
  if (playerBase && GameState.roadSystem && pendingDispatchTask) {
    const roadTiming = GameState.roadSystem.getMissionDays(
      pendingDispatchTask.requiredDays,
      playerBase,
      node
    );
    if (roadTiming.hasRoad) {
      pendingDispatchTask.baseRequiredDays = roadTiming.baseDays;
      pendingDispatchTask.requiredDays = roadTiming.adjustedDays;
      pendingDispatchTask.roadBenefitApplied = true;
    }
  }

  renderDispatchAdvList();

  // 更新確認按鈕事件
  const btnConfirm = document.getElementById('btn-confirm-dispatch')!;
  const newBtn = btnConfirm.cloneNode(true) as HTMLButtonElement;
  btnConfirm.parentNode!.replaceChild(newBtn, btnConfirm);

  newBtn.addEventListener('click', () => {
    if (selectedAdventurersForDispatch.size === 0) {
      ToastManager.show('請至少選擇一名冒險者！');
      return;
    }
    const team = GameState.adventurers.filter(a => selectedAdventurersForDispatch.has(a.id));
    if (pendingDispatchTask) {
      const totalPower = team.reduce((sum, adventurer) => sum + adventurer.power, 0);
      if (
        totalPower < pendingDispatchTask.minPowerRequired &&
        !confirm(`我方戰力 ${totalPower} 低於建議戰力 ${pendingDispatchTask.minPowerRequired}，預估勝率偏低，仍要出征嗎？`)
      ) {
        return;
      }
      if (actionType === 'subjugation' || actionType === 'war') {
        const selectedMode = (document.querySelector('input[name="subjugation-mode"]:checked') as HTMLInputElement)?.value as any;
        pendingDispatchTask.subjugationMode = selectedMode;
        if (selectedMode === 'PROGRESS') {
           pendingDispatchTask.totalWaves = 3;
        }
        
        // 驗證總派兵數是否超過領地庫存 (只有 WAR 模式才會帶兵)
        if (pendingDispatchTask.isWar) {
          const terr = GameState.myTerritory;
          const totals: Record<string, number> = { INFANTRY: 0, CAVALRY: 0, ARCHER: 0 };
          // selectedTroopsForDispatch is Record<string, any> where any is {type, count}
          for (const [id, tObj] of Object.entries(selectedTroopsForDispatch)) {
            const t = tObj as any;
            if (t.type !== 'NONE' && selectedAdventurersForDispatch.has(id)) {
               totals[t.type] += t.count;
            }
          }
          if ((totals.INFANTRY > (terr.workers.INFANTRY || 0)) ||
              (totals.CAVALRY > (terr.workers.CAVALRY || 0)) ||
              (totals.ARCHER > (terr.workers.ARCHER || 0))) {
            ToastManager.show('派出的兵力總和超過了領地現有庫存！');
            return;
          }
          
          // 將有效兵力綁定至 Task
          pendingDispatchTask.troopAssignments = {};
          for (const [id, tObj] of Object.entries(selectedTroopsForDispatch)) {
            const t = tObj as any;
            if (t.type !== 'NONE' && t.count > 0 && selectedAdventurersForDispatch.has(id)) {
              pendingDispatchTask.troopAssignments[id] = { type: t.type, count: t.count };
            }
          }
        }
      }
      GameState.system.dispatchAdventurers(team, pendingDispatchTask);
      modal.classList.remove('active');
    }
  });

  const btnClose = document.getElementById('btn-close-dispatch-setup')!;
  btnClose.onclick = () => modal.classList.remove('active');

  modal.classList.add('active');
}

export function openEventModal(event: any) {
  const modal = document.getElementById('modal-event')!;
  document.getElementById('event-title')!.textContent = event.title;
  document.getElementById('event-desc')!.textContent = event.description;
  
  const optionsContainer = document.getElementById('event-options')!;
  optionsContainer.innerHTML = '';
  
  event.options.forEach((opt: any) => {
    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.textContent = opt.text;
    btn.addEventListener('click', () => {
      opt.onSelect();
      UIManager.updateUI();
      modal.classList.remove('active');
    });
    optionsContainer.appendChild(btn);
  });
  
  modal.classList.add('active');
}

function renderDispatchTeamRoster() {
  const container = document.getElementById('dispatch-team-roster')!;
  if (!container) return;
  container.innerHTML = '';
  
  const selectedAdvs = GameState.adventurers.filter(a => selectedAdventurersForDispatch.has(a.id));
  
  for (let i = 0; i < 5; i++) {
    const adv = selectedAdvs[i];
    const slot = document.createElement('div');
    slot.style.position = 'relative';

    if (adv) {
      // 有傭兵時使用 adventurer-card class，讓 CSS 主導尺寸
      slot.className = 'adventurer-card';
      slot.style.borderStyle = 'solid';
      slot.style.borderColor = '#3b82f6';
      
      const isFront = adv.formationRow === 'FRONT' || (adv.formationRow as any) === 0;
      const rowText = isFront ? '前排' : '後排';
      const rowBg = isFront ? '#1d4ed8' : '#9333ea';
      
      // 修復：直接在 innerHTML 生成時加入 data-role="row-toggle"，避免 setTimeout 異步導致同步查詢找不到元素
      slot.innerHTML = renderAdventurerCard(adv, {
        showDismissBtn: true,
        dismissId: adv.id,
        bottomLabel: rowText,
        bottomLabelBg: rowBg,
        bottomLabelRole: 'row-toggle'
      });
      
      const displayClass = (adv as any).currentClass || adv.job.name;
      const tooltipHtml = `【${adv.name}】<br/>Lv.${adv.level} ${displayClass}<br/>狀態：🟢 出戰配置中<br/>戰力：${adv.power}`;

      slot.addEventListener('mouseenter', () => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          tEl.innerHTML = tooltipHtml;
          tEl.style.opacity = '1';
        }
      });

      slot.addEventListener('mousemove', (e) => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          positionFloatingElement(tEl, e.clientX, e.clientY);
        }
      });

      slot.addEventListener('mouseleave', () => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) {
          tEl.style.opacity = '0';
        }
      });
      
      // 修復：同步查詢 data-role 屬性，不再依賴 setTimeout 異步加上的 class
      const toggleBtn = slot.querySelector('[data-role="row-toggle"]') as HTMLElement | null;
      if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          adv.formationRow = isFront ? ('BACK' as any) : ('FRONT' as any);
          renderDispatchTeamRoster();
        });
      }
      
      const removeBtn = slot.querySelector('button');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
          selectedAdventurersForDispatch.delete(adv.id);
          renderDispatchTeamRoster();
          renderDispatchAdvList();
        });
      }
      
    } else {
      // 空位：手動設定尺寸和外觀
      slot.style.width = '90px';
      slot.style.height = '100px';
      slot.style.background = 'rgba(0,0,0,0.5)';
      slot.style.border = '1px dashed rgba(255,255,255,0.2)';
      slot.style.borderRadius = '6px';
      slot.style.display = 'flex';
      slot.style.flexDirection = 'column';
      slot.style.alignItems = 'center';
      slot.style.justifyContent = 'center';
      slot.innerHTML = renderAdventurerCard(null, { isEmpty: true });
    }
    
    container.appendChild(slot);
  }
  
  updateDispatchPowerPreview();
}

function renderDispatchAdvList() {
  const container = document.getElementById('dispatch-adv-list')!;
  container.innerHTML = '';
  
  const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);
  
  if (idleAdvs.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8; grid-column: 1 / -1;">目前沒有閒置的冒險者可以派遣。</p>';
    renderDispatchTeamRoster();
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
    }
    
    const displayClass = (adv as any).currentClass || adv.job.name;

    card.innerHTML = renderAdventurerCard(adv);

    const tooltipHtml = `【${adv.name}】<br/>Lv.${adv.level} ${displayClass}<br/>狀態：🟢 閒置<br/>戰力：${adv.power}`;

    card.addEventListener('mouseenter', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) {
        tEl.innerHTML = tooltipHtml;
        tEl.style.opacity = '1';
      }
    });

    card.addEventListener('mousemove', (e) => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) {
        positionFloatingElement(tEl, e.clientX, e.clientY);
      }
    });

    card.addEventListener('mouseleave', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) {
        tEl.style.opacity = '0';
      }
    });

    card.addEventListener('click', () => {
      const tEl = document.getElementById('adv-tooltip');
      if (tEl) tEl.style.opacity = '0';
      
      if (isSelected) {
        selectedAdventurersForDispatch.delete(adv.id);
      } else {
        if (selectedAdventurersForDispatch.size >= 5) {
          ToastManager.show('隊伍最多只能派出 5 名傭兵！');
          return;
        }
        selectedAdventurersForDispatch.add(adv.id);
      }
      renderDispatchAdvList();
      renderDispatchTeamRoster();
    });

    container.appendChild(card);
  });
  
  renderDispatchTeamRoster();
}

export async function openTradePlanner(plannedRouteNodeIds: string[]) {
  const { openTradePlanner: impl } = await import('./TradeController');
  impl(plannedRouteNodeIds);
}

function updateDispatchPowerPreview() {
  let totalPower = 0;
  GameState.adventurers.forEach(adv => {
    if (selectedAdventurersForDispatch.has(adv.id)) {
      totalPower += adv.power;
    }
  });
  const el = document.getElementById('dispatch-total-power')!;
  const riskEl = document.getElementById('dispatch-risk-preview')!;
  el.textContent = totalPower.toString();
  
  if (pendingDispatchTask && totalPower >= pendingDispatchTask.minPowerRequired) {
    el.style.color = '#10b981'; // 綠色
  } else {
    el.style.color = '#eab308'; // 黃色
  }
  if (pendingDispatchTask) {
    const ratio = pendingDispatchTask.minPowerRequired > 0 ? totalPower / pendingDispatchTask.minPowerRequired : 1;
    const risk = ratio >= 1.4 ? '低' : ratio >= 1 ? '中' : '高';
    const color = risk === '低' ? '#10b981' : risk === '中' ? '#f59e0b' : '#ef4444';
    const roadText = pendingDispatchTask.roadBenefitApplied
      ? `｜🛤️ 道路加速（原 ${pendingDispatchTask.baseRequiredDays} 天）`
      : '';
    riskEl.innerHTML = `風險：<strong style="color:${color}">${risk}</strong>｜耗時 ${pendingDispatchTask.requiredDays} 天${roadText}｜預期 💰${pendingDispatchTask.expectedGold}／✨${pendingDispatchTask.expectedPrestige}｜失敗將休養`;
  }
}

export function openTodoModal() {
  const modal = document.getElementById('modal-todo')!;
  const container = document.getElementById('todo-list-container')!;
  const territory = GameState.myTerritory;
  
  container.innerHTML = '';

  if (!territory || !territory.pendingEvents || territory.pendingEvents.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8;">目前沒有待辦事項。</p>';
  } else {
    territory.pendingEvents.forEach((eventId, index) => {
      const evt = GAME_EVENTS.find(e => e.id === eventId);
      if (!evt) return;

      const card = document.createElement('div');
      card.className = 'glass-panel';
      card.style.padding = '15px';
      card.style.borderLeft = '4px solid #eab308';
      
      const title = document.createElement('h3');
      title.style.margin = '0 0 10px 0';
      title.style.color = '#eab308';
      title.textContent = evt.title;
      card.appendChild(title);

      const desc = document.createElement('p');
      desc.style.color = '#e2e8f0';
      desc.style.fontSize = '0.9em';
      desc.style.lineHeight = '1.5';
      desc.style.marginBottom = '15px';
      desc.textContent = evt.description;
      card.appendChild(desc);

      const optionsDiv = document.createElement('div');
      optionsDiv.style.display = 'flex';
      optionsDiv.style.gap = '10px';

      evt.options.forEach((opt: any) => {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.style.flex = '1';
        btn.style.fontSize = '0.85em';
        btn.style.padding = '8px';
        btn.textContent = opt.text;
        
        btn.addEventListener('click', () => {
          // 執行效果
          opt.onSelect();
          // 從 pendingEvents 移除
          territory.pendingEvents.splice(territory.pendingEvents.indexOf(eventId), 1);
          // 更新 UI
          UIManager.updateUI();
          // 重新渲染 Modal 或關閉
          if (territory.pendingEvents.length > 0) {
            openTodoModal();
          } else {
            modal.classList.remove('active');
          }
        });
        optionsDiv.appendChild(btn);
      });

      card.appendChild(optionsDiv);
      container.appendChild(card);
    });
  }

  const btnClose = document.getElementById('btn-close-todo')!;
  btnClose.onclick = () => modal.classList.remove('active');

  modal.classList.add('active');
}

// === 情報迷霧與節點詳細面板 ===

export function closeNodeDetailPanel() {
  const panel = document.getElementById('node-detail-panel');
  if (panel) {
    panel.style.display = 'none';
  }
  const mapInfoPanel = document.getElementById('map-info-panel');
  if (mapInfoPanel) {
    mapInfoPanel.style.display = 'flex'; // 預設為 flex，還原顯示
  }
}

export function openNodeDetailPanel(node: MapNode) {
  const panel = document.getElementById('node-detail-panel')!;
  const mapInfoPanel = document.getElementById('map-info-panel')!;
  
  // 隱藏預設的世界地圖資訊
  mapInfoPanel.style.display = 'none';
  
  document.getElementById('nd-name')!.textContent = node.name;
  
  let typeStr = '';
  if (node.nodeLevel === NodeLevel.WILDERNESS) typeStr = '荒野';
  else if (node.nodeLevel === NodeLevel.CAMP) typeStr = '營地';
  else if (node.nodeLevel === NodeLevel.VILLAGE) typeStr = '村莊';
  else if (node.nodeLevel === NodeLevel.TOWN) typeStr = '城鎮';
  else if (node.nodeLevel === NodeLevel.CAPITAL) typeStr = '首都';
  
  document.getElementById('nd-type')!.textContent = `📍 規模：${typeStr}`;
  
  const weatherEl = document.getElementById('nd-weather')!;
  let weatherStr = '';
  let weatherColor = '#e2e8f0';
  switch(node.currentWeather) {
    case 'CLEAR': weatherStr = '☀️ 晴朗'; weatherColor = '#eab308'; break;
    case 'RAIN': weatherStr = '🌧️ 雨天'; weatherColor = '#60a5fa'; break;
    case 'SNOW': weatherStr = '❄️ 下雪'; weatherColor = '#bae6fd'; break;
    case 'SANDSTORM': weatherStr = '🌪️ 沙暴'; weatherColor = '#d97706'; break;
    case 'FOG': weatherStr = '🌫️ 濃霧'; weatherColor = '#94a3b8'; break;
    default: weatherStr = '☀️ 晴朗'; weatherColor = '#eab308'; break;
  }
  weatherEl.textContent = `${weatherStr} (剩餘 ${node.weatherDuration} 天)`;
  weatherEl.style.color = weatherColor;

  document.getElementById('nd-desc')!.textContent = node.description;

  const scoutInfoBox = document.getElementById('nd-scout-info')!;
  const unscoutedBox = document.getElementById('nd-unscouted-info')!;
  
  const btnScout = document.getElementById('btn-scout-node')!;
  const btnAction = document.getElementById('btn-nd-action')!;
  
  // 清除舊的事件監聽器
  const newBtnScout = btnScout.cloneNode(true) as HTMLButtonElement;
  btnScout.parentNode!.replaceChild(newBtnScout, btnScout);
  
  const newBtnAction = btnAction.cloneNode(true) as HTMLButtonElement;
  btnAction.parentNode!.replaceChild(newBtnAction, btnAction);

  if (node.isScouted) {
    scoutInfoBox.style.display = 'block';
    unscoutedBox.style.display = 'none';
    
    if (node.scoutData) {
      document.getElementById('nd-danger')!.textContent = node.scoutData.dangerLevel;
      document.getElementById('nd-treasure')!.textContent = node.scoutData.treasureTier;
      
      const garrisonBox = document.getElementById('nd-garrison-box')!;
      if (node.scoutData.garrisonPower !== undefined) {
        garrisonBox.style.display = 'block';
        document.getElementById('nd-garrison')!.textContent = node.scoutData.garrisonPower.toString();
      } else {
        garrisonBox.style.display = 'none';
      }
    }
    
    document.getElementById('nd-expiry')!.textContent = node.scoutExpiryDate ? `第 ${node.scoutExpiryDate} 天` : '-';
  } else {
    scoutInfoBox.style.display = 'none';
    unscoutedBox.style.display = 'block';
    
    if (node.pendingScoutDays && node.pendingScoutDays > 0) {
      newBtnScout.style.display = 'none';
      const pendingMsg = document.createElement('div');
      pendingMsg.style.color = '#fbbf24';
      pendingMsg.style.fontWeight = 'bold';
      pendingMsg.style.marginTop = '10px';
      pendingMsg.style.textAlign = 'center';
      pendingMsg.textContent = `👁️ 斥候偵查中... (預計剩餘 ${node.pendingScoutDays} 回合)`;
      
      // 移除舊的提示訊息，避免重複
      const oldMsg = unscoutedBox.querySelector('.pending-scout-msg');
      if (oldMsg) oldMsg.remove();
      
      pendingMsg.className = 'pending-scout-msg';
      unscoutedBox.appendChild(pendingMsg);
    } else {
      newBtnScout.style.display = 'inline-block';
      const oldMsg = unscoutedBox.querySelector('.pending-scout-msg');
      if (oldMsg) oldMsg.remove();
      
      newBtnScout.addEventListener('click', () => {
        if (GameState.mapSystem.scoutNode(node.id, GameState.myTerritory, GameState.totalDays)) {
          UIManager.updateUI(); // 更新金幣顯示
          openNodeDetailPanel(node); // 重新渲染面板
        }
      });
    }
  }

  // 市場按鈕
  const marketBtn = document.getElementById('nd-btn-market') as HTMLButtonElement;
  if (node.nodeLevel >= NodeLevel.VILLAGE && node.isScouted && node.marketData && node.ownerFactionId !== null && node.ownerFactionId !== 'player' && !node.isPlayerBase) {
    marketBtn.style.display = 'block';
    marketBtn.onclick = () => {
      openTradeModal(node);
    };
  } else {
    marketBtn.style.display = 'none';
  }

  // 代官 UI (僅限玩家佔領的附庸地)
  const oldRoadButton = document.getElementById('btn-build-road') as HTMLButtonElement;
  const roadButton = oldRoadButton.cloneNode(true) as HTMLButtonElement;
  oldRoadButton.parentNode!.replaceChild(roadButton, oldRoadButton);
  const playerBase = GameState.mapSystem.getNodes().find(candidate => candidate.isPlayerBase);
  const isNonPlayerTarget = !node.isPlayerBase && node.ownerFactionId !== 'player';

  if (isNonPlayerTarget && playerBase && GameState.roadSystem) {
    roadButton.style.display = 'block';
    const existingRoad = GameState.roadSystem.getRoadBetween(playerBase.id, node.id);
    const project = GameState.roadSystem.getProjectBetween(playerBase.id, node.id);
    const check = GameState.roadSystem.checkTarget(
      playerBase,
      node,
      GameState.explorationSystem
    );

    if (existingRoad) {
      roadButton.textContent = '✅ 道路已完成';
      roadButton.disabled = true;
      roadButton.title = '旅行路段縮短 40%、伏擊率降低，市場買價 -5%、賣價 +10%。';
    } else if (project) {
      roadButton.textContent = `🚧 道路施工中（${project.elapsedDays}/${project.totalDays} 天）`;
      roadButton.disabled = true;
    } else {
      roadButton.disabled = !check.valid;
      roadButton.textContent = check.valid
        ? `🛤️ 建造道路（${check.requiredDays} 天）`
        : '🛤️ 暫時無法建造';
      roadButton.title = check.reason ?? '';
      roadButton.onclick = () => {
        if (!check.valid || !check.requiredDays) {
          ToastManager.show(check.reason ?? '目前無法建造這條道路。', 'warning');
          return;
        }
        if (!window.confirm(
          `從 ${playerBase.name} 向 ${node.name} 建造道路？\n` +
          `預計需要 ${check.requiredDays} 天，同一時間只能施工一條道路。`
        )) return;

        const startedProject = GameState.roadSystem.startConstruction(
          playerBase,
          node,
          GameState.explorationSystem
        );
        EventBus.getInstance().publish({
          type: GameEventType.ROAD_CHANGED,
          payload: {
            reason: 'STARTED',
            roadId: startedProject.id,
            targetNodeId: node.id
          }
        });
        ToastManager.show(`通往 ${node.name} 的道路開始施工。`, 'success');
        openNodeDetailPanel(node);
      };
    }
  } else {
    roadButton.style.display = 'none';
  }

  const govBox = document.getElementById('nd-governor-box')!;
  if (node.ownerFactionId === 'player' && !node.isPlayerBase) {
    govBox.style.display = 'block';
    const govNameEl = document.getElementById('nd-governor-name')!;
    const govSelect = document.getElementById('nd-governor-select') as HTMLSelectElement;
    const btnAssign = document.getElementById('btn-assign-governor')!;

    if (node.governorId) {
      const govAdv = GameState.adventurers.find(a => a.id === node.governorId);
      govNameEl.textContent = govAdv ? govAdv.name : '未知的代官';
    } else {
      govNameEl.textContent = '無';
    }

    // 填充閒置傭兵
    govSelect.innerHTML = '<option value="">選擇閒置傭兵...</option>';
    const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE && !a.office && a.id !== node.governorId);
    idleAdvs.forEach(adv => {
      const intAttr = adv.getEffectiveAttributes().int;
      govSelect.innerHTML += `<option value="${adv.id}">${adv.name} (INT: ${intAttr})</option>`;
    });

    // 替換新的 assign 按鈕清除舊事件
    const newBtnAssign = btnAssign.cloneNode(true) as HTMLButtonElement;
    btnAssign.parentNode!.replaceChild(newBtnAssign, btnAssign);
    newBtnAssign.onclick = () => {
      const selId = govSelect.value;
      if (!selId) {
        ToastManager.show('請選擇一名傭兵！');
        return;
      }
      
      // 如果原本有代官，卸任
      if (node.governorId) {
        const oldGov = GameState.adventurers.find(a => a.id === node.governorId);
        if (oldGov) oldGov.currentState = AdventurerState.IDLE;
      }
      
      const newGov = GameState.adventurers.find(a => a.id === selId);
      if (newGov) {
        newGov.currentState = AdventurerState.DISPATCHED; // 指派出去當代官
        node.governorId = newGov.id;
        ToastManager.show(`已指派 ${newGov.name} 為 ${node.name} 的代官！`);
        openNodeDetailPanel(node); // 重新渲染 UI
      }
    };
  } else {
    govBox.style.display = 'none';
  }

  // 設定底部操作按鈕 (例如討伐/攻城)
  if (node.ownerFactionId === null) {
    newBtnAction.textContent = '🛡️ 討伐該區';
    newBtnAction.onclick = () => {
      if (!node.isScouted) {
        if (!confirm('⚠️ 【警告】您尚未偵查該區域，敵方戰力未知，貿然進軍將面臨極大風險！是否確定要盲目討伐？')) {
          return;
        }
      }
      openDispatchSetup(node, 'subjugation');
      closeNodeDetailPanel();
    };
  } else {
    if (node.isPlayerBase) {
      newBtnAction.textContent = '🔒 無法操作';
      newBtnAction.onclick = () => ToastManager.show('這是您自己的領地！');
    } else {
      newBtnAction.textContent = '⚔️ 發動攻城戰';
      newBtnAction.onclick = () => {
        if (!node.isScouted) {
          if (!confirm('⚠️ 【警告】您尚未偵查該據點，敵方駐軍數量與城防未知！是否確定要盲目發動攻城？')) {
            return;
          }
        }
        openDispatchSetup(node, 'war');
        closeNodeDetailPanel();
      };
    }
  }

  // 關閉按鈕
  document.getElementById('btn-close-node-detail')!.onclick = () => {
    closeNodeDetailPanel();
    mapInfoPanel.style.display = 'flex';
  };

  panel.style.display = 'flex';
}


/**
 * 開啟市場交易與商隊派遣視窗
 */
export async function openTradeModal(node: MapNode) {
  const { openTradeModal: impl } = await import('./TradeController');
  impl(node);
}

export function openCombatHistory() {
  const panel = document.getElementById('combat-history-panel')!;
  const listContainer = document.getElementById('combat-history-list')!;

  panel.classList.add('active');
  listContainer.innerHTML = '';

  if (!GameState.myTerritory.combatHistory || GameState.myTerritory.combatHistory.length === 0) {
    listContainer.innerHTML = '<p style="text-align: center; color: #94a3b8; padding: 20px;">目前沒有任何近期的戰鬥紀錄。</p>';
    return;
  }

  GameState.myTerritory.combatHistory.forEach(record => {
    const isVictory = record.report.isVictory;
    const titleColor = isVictory ? '#10b981' : '#ef4444';
    const titleText = isVictory ? '勝利' : '失敗';

    const card = document.createElement('div');
    card.style.cssText = 'background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; display: flex; justify-content: space-between; align-items: center;';

    card.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;">
        <div style="font-size: 1em; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          <span style="color: ${titleColor};">【${titleText}】</span> ${record.nodeName}
          <span style="font-size: 0.8em; color: #64748b; font-weight: normal; margin-left: 8px;">(第 ${record.day} 天)</span>
        </div>
        <div style="font-size: 0.82em; color: #cbd5e1;">
          MVP: <span style="color: #eab308; font-weight: bold;">${record.report.mvpName || '無'}</span> |
          傷害: <span style="color: #f87171;">${record.report.totalDamageDealt || 0}</span> |
          收益: <span style="color: #fbbf24;">${record.report.lootValue || 0}</span>
        </div>
      </div>
      <button class="action-btn replay-btn" style="padding: 6px 12px; font-size: 0.82em; background: rgba(59,130,246,0.4); border-color: #3b82f6; margin-left: 10px; flex-shrink: 0;">🎬 重播</button>
    `;

    const replayBtn = card.querySelector('.replay-btn') as HTMLButtonElement;
    replayBtn.onclick = () => {
      panel.classList.remove('active');
      CombatUIManager.replayCombat(record.report);
    };

    listContainer.appendChild(card);
  });
}

export async function renderWeaponShop() {
  const { renderWeaponShop: impl } = await import('./ShopController');
  impl();
}

export async function renderArmorShop() {
  const { renderArmorShop: impl } = await import('./ShopController');
  impl();
}

/**
 * 將 AI 派系武將轉換為玩家傭兵 (Adventurer)
 */
export function convertChampionToAdventurer(champion: FactionChampion): Adventurer {
  const job = DataStore.JobDB[champion.jobId] || DataStore.JobDB['WARRIOR'];
  const trait = DataStore.TraitDB[champion.traitId] || DataStore.TraitDB['GUARDIAN'];

  const qualityMap: Record<string, 'R' | 'SR' | 'SSR'> = {
    'ELITE': 'R',
    'CHAMPION': 'SR',
    'LEGENDARY': 'SSR'
  };

  const newAdv = new Adventurer(
    `adv_${champion.id}_${Date.now()}`,
    champion.name,
    job,
    trait,
    qualityMap[champion.rarity] || 'SR'
  );

  // 依據 powerTier 計算等級並提升
  const targetLevel = Math.max(1, champion.powerTier * 2);
  for (let i = 1; i < targetLevel; i++) {
    newAdv.gainXP(newAdv.getRequiredXP());
  }

  return newAdv;
}

/**
 * 開啟戰後俘虜處置 Modal
 */
export function openPrisonerModal(champion: FactionChampion) {
  const modal = document.getElementById('modal-prisoner-action');
  if (!modal) return;

  const avatar = document.getElementById('prisoner-avatar');
  const nameEl = document.getElementById('prisoner-name');
  const titleEl = document.getElementById('prisoner-title');
  const descEl = document.getElementById('prisoner-desc');

  const faction = GameState.mapSystem?.getFactions().find(f => f.id === champion.factionId);
  const factionName = faction ? faction.factionName : '未知派系';

  if (avatar) avatar.textContent = champion.portraitEmoji;
  if (nameEl) nameEl.textContent = champion.name;
  if (titleEl) titleEl.textContent = `【${champion.title}】 ${factionName}`;
  if (descEl) descEl.textContent = champion.description;

  modal.classList.add('active');

  const btnRecruit = document.getElementById('btn-prisoner-recruit');
  const btnRansom = document.getElementById('btn-prisoner-ransom');
  const btnExecute = document.getElementById('btn-prisoner-execute');
  const btnRelease = document.getElementById('btn-prisoner-release');

  if (btnRecruit) {
    btnRecruit.onclick = () => {
      modal.classList.remove('active');
      const newAdv = convertChampionToAdventurer(champion);
      GameState.adventurers.push(newAdv);
      if (faction) faction.playerFavor = Math.max(-100, faction.playerFavor - 30);
      ToastManager.show(`🤝 成功招降【${champion.name}】！他已正式加入您的傭兵隊伍。`, 'success');
    };
  }

  if (btnRansom) {
    btnRansom.onclick = () => {
      modal.classList.remove('active');
      const ransomGold = champion.powerTier * 500;
      GameState.myTerritory.addGold(ransomGold);
      if (faction) faction.playerFavor = Math.max(-100, faction.playerFavor - 15);
      ToastManager.show(`💰 獲得贖金 ${ransomGold} 金幣，【${champion.name}】已安全交還給 ${factionName}。`, 'info');
    };
  }

  if (btnExecute) {
    btnExecute.onclick = () => {
      modal.classList.remove('active');
      if (faction) {
        if (!faction.defeatedChampionIds) faction.defeatedChampionIds = [];
        faction.defeatedChampionIds.push(champion.id);
        faction.playerFavor = Math.max(-100, faction.playerFavor - 60);
      }
      ToastManager.show(`⚰️ 處決了【${champion.name}】！${factionName} 對您的恨意暴增！`, 'error');
    };
  }

  if (btnRelease) {
    btnRelease.onclick = () => {
      modal.classList.remove('active');
      if (faction) faction.playerFavor = Math.min(100, faction.playerFavor + 10);
      ToastManager.show(`🔓 釋放了【${champion.name}】。${factionName} 對您的仁慈表示敬意（好感度 +10）。`, 'info');
    };
  }
}
