import { ToastManager } from './ToastManager';
import { Adventurer } from '../models/Adventurer';
import { EquipmentSlot, MapNode, NodeLevel, NodeFeature, AdventurerState, getMaxCaravansLimit } from '../models/types';
import { GameState } from '../core/GameState';
import { EnhancementSystem } from '../systems/EnhancementSystem';
import { UIManager } from './UIManager';
import { DataStore } from '../systems/DataStore';
import { EquipmentGenerator } from '../systems/EquipmentGenerator';
import { DispatchTask, EnemyFeature, TaskType, TradeInstruction, TradePhase } from '../models/DispatchTask';
import { GAME_EVENTS } from '../data/EventData';
import { startRoutePlanning } from './MapController';
import { TRADE_GOODS } from '../systems/MarketSystem';
import { DispatchSystem, ActiveMission } from '../systems/DispatchSystem';
import { CombatUIManager } from './CombatUIManager';
import { Random } from '../core/Random';

export async function openWarehouse(isForgeMode: boolean) {
  const { openWarehouse: impl } = await import('./ShopController');
  impl(isForgeMode);
}

let currentDetailAdv: Adventurer | null = null;
let tempAllocations: Record<string, number> = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };

export function openAdvDetail(adv: Adventurer) {
  const modalAdvDetail = document.getElementById('modal-adv-detail')!;
  const myTerritory = GameState.myTerritory;

  if (currentDetailAdv !== adv) {
    currentDetailAdv = adv;
    tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
  }

  document.getElementById('adv-detail-name')!.textContent = adv.name;
  document.getElementById('adv-detail-desc')!.textContent = `Lv.${adv.level} ${adv.job.name} | ${adv.trait.name}`;
  document.getElementById('adv-detail-power')!.textContent = adv.power.toString();
  
  const stats = adv.getCombatStats();
  const attr = adv.getEffectiveAttributes();
  
  const sumAllocated = tempAllocations.str + tempAllocations.agi + tempAllocations.con + tempAllocations.int + tempAllocations.spr + tempAllocations.luk;
  const tempUnspent = adv.unspentStatPoints - sumAllocated;
  
  const unspent = (adv.unspentStatPoints > 0 || sumAllocated > 0)
    ? `<div style="grid-column: span 2; text-align: center; color: #eab308; font-weight: bold; margin-bottom: 10px;">可用屬性點：${tempUnspent}</div>` 
    : '';

  const getStatHtml = (label: string, key: 'str' | 'agi' | 'con' | 'int' | 'spr' | 'luk', val: number) => {
    const tempVal = tempAllocations[key] || 0;
    const plusBtn = tempUnspent > 0 
      ? `<button class="btn-temp-plus" data-stat="${key}" style="margin-left:5px; padding:0 5px; font-size:0.8em; cursor:pointer;">+</button>` 
      : '';
    const minusBtn = tempVal > 0 
      ? `<button class="btn-temp-minus" data-stat="${key}" style="margin-left:3px; padding:0 5px; font-size:0.8em; cursor:pointer; background:rgba(239,68,68,0.3); border-color:#ef4444; color:#fff;">-</button>` 
      : '';
    const greenStr = tempVal > 0 ? ` <span style="color:#22c55e; font-size:0.85em; font-weight:bold;">(+${tempVal})</span>` : '';
    return `<div class="stat-item"><span class="stat-label">${label}</span><span class="stat-value">${val + tempVal}${greenStr}${plusBtn}${minusBtn}</span></div>`;
  };

  let confirmBtnsHtml = '';
  if (sumAllocated > 0) {
    confirmBtnsHtml = `
      <div style="grid-column: span 2; display: flex; gap: 15px; margin-top: 15px;">
        <button id="btn-confirm-stats" class="action-btn" style="flex:1; background:linear-gradient(135deg, #059669, #047857); padding:8px 0; font-size:0.9em; font-weight:bold;">確認分配</button>
        <button id="btn-reset-stats" class="action-btn" style="flex:1; background:rgba(255,255,255,0.1); padding:8px 0; font-size:0.9em;">取消重設</button>
      </div>
    `;
  }

  const statsHtml = `
    ${unspent}
    <div class="stat-item"><span class="stat-label">生命值 (HP)</span><span class="stat-value highlight">${stats.hp}</span></div>
    ${getStatHtml('力量 (STR)', 'str', attr.str)}
    <div class="stat-item"><span class="stat-label">魔力值 (MP)</span><span class="stat-value highlight">${stats.mp}</span></div>
    ${getStatHtml('敏捷 (AGI)', 'agi', attr.agi)}
    <div class="stat-item"><span class="stat-label">物理攻擊 (ATK)</span><span class="stat-value highlight">${stats.atk}</span></div>
    ${getStatHtml('體質 (CON)', 'con', attr.con)}
    <div class="stat-item"><span class="stat-label">防禦力 (DEF)</span><span class="stat-value highlight">${stats.def}</span></div>
    ${getStatHtml('智慧 (INT)', 'int', attr.int)}
    <div class="stat-item"><span class="stat-label">命中率 (HIT)</span><span class="stat-value highlight">${stats.hit}</span></div>
    ${getStatHtml('精神 (SPR)', 'spr', attr.spr)}
    <div class="stat-item"><span class="stat-label">閃避率 (EVD)</span><span class="stat-value highlight">${stats.evade}</span></div>
    ${getStatHtml('幸運 (LUK)', 'luk', attr.luk)}
    <div class="stat-item" style="grid-column: span 2; display: flex; justify-content: space-between;">
      <div style="flex:1;"><div class="stat-item"><span class="stat-label">魅力 (CHM)</span><span class="stat-value">${attr.charm}</span></div></div>
      <div style="flex:1;"><div class="stat-item"><span class="stat-label">統帥 (CMD)</span><span class="stat-value">${attr.command}</span></div></div>
    </div>
    ${confirmBtnsHtml}
  `;
  document.getElementById('adv-detail-stats')!.innerHTML = statsHtml;

  // 綁定暫存配點 + 事件
  const plusBtns = document.getElementById('adv-detail-stats')!.querySelectorAll('.btn-temp-plus');
  plusBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = (e.currentTarget as HTMLElement).getAttribute('data-stat')!;
      tempAllocations[key]++;
      openAdvDetail(adv);
    });
  });

  // 綁定暫存配點 - 事件
  const minusBtns = document.getElementById('adv-detail-stats')!.querySelectorAll('.btn-temp-minus');
  minusBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = (e.currentTarget as HTMLElement).getAttribute('data-stat')!;
      if (tempAllocations[key] > 0) {
        tempAllocations[key]--;
      }
      openAdvDetail(adv);
    });
  });

  // 綁定確認配點
  const btnConfirm = document.getElementById('btn-confirm-stats');
  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      for (const [key, val] of Object.entries(tempAllocations)) {
        if (val > 0) {
          for (let i = 0; i < val; i++) {
            adv.allocateStat(key as any);
          }
        }
      }
      console.log(`[屬性] ⚔️ ${adv.name} 完成了屬性配點，當前六維已更新！`);
      tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
      openAdvDetail(adv);
      UIManager.updateUI();
    });
  }

  // 綁定取消重設
  const btnReset = document.getElementById('btn-reset-stats');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      tempAllocations = { str: 0, agi: 0, con: 0, int: 0, spr: 0, luk: 0 };
      openAdvDetail(adv);
    });
  }

  const equipGrid = document.getElementById('adv-detail-equips')!;
  equipGrid.innerHTML = '';
  const slots = [
    { key: EquipmentSlot.WEAPON, name: '武器', icon: '🗡️' },
    { key: EquipmentSlot.ARMOR, name: '防具', icon: '🛡️' },
    { key: EquipmentSlot.ACCESSORY, name: '飾品', icon: '💍' }
  ];

  slots.forEach(s => {
    const equip = adv.equipment[s.key];
    const el = document.createElement('div');
    el.className = 'equip-slot';
    el.style.position = 'relative';

    if (equip) {
      const lvlStr = equip.enhancementLevel ? `+${equip.enhancementLevel}` : '';
      el.innerHTML = `
        <div class="equip-icon">${equip.icon || '✨'}</div>
        <div class="equip-name">${equip.name} ${lvlStr}</div>
        <button class="action-btn btn-unequip" style="margin-top:5px; padding:2px 5px; font-size:0.8em;">卸下</button>
      `;
      const btnUnequip = el.querySelector('.btn-unequip')!;
      btnUnequip.addEventListener('click', (e) => {
        e.stopPropagation();
        adv.unequip(s.key);
        myTerritory.addEquipmentToWarehouse(equip);
        console.log(`[系統] 已將 ${adv.name} 身上的 ${equip.name} 卸下並放入倉庫。`);
        openAdvDetail(adv);
        UIManager.updateUI();
      });
    } else {
      el.style.cursor = 'pointer';
      el.innerHTML = `
        <div class="equip-icon" style="filter: grayscale(1); opacity: 0.3;">${s.icon}</div>
        <div class="equip-name" style="color: #64748b;">${s.name}</div>
        <div style="font-size:0.8em; color:#3b82f6; margin-top:5px;">+ 裝備</div>
      `;
      el.addEventListener('click', () => openEquipSelect(adv, s.key));
    }
    equipGrid.appendChild(el);
  });

  const btnRetire = document.getElementById('btn-retire-adv') as HTMLButtonElement;
  btnRetire.onclick = () => {
    if (confirm(`確定要讓 ${adv.name} 退休嗎？\n退休後將無法恢復，但他將利用自身的【魅力】屬性永久提升您的稅收 (當前魅力: ${attr.charm})！`)) {
      // 從隊伍中移除
      GameState.adventurers = GameState.adventurers.filter(a => a.id !== adv.id);
      
      // 卸下所有裝備放回倉庫
      slots.forEach(s => {
        const eq = adv.equipment[s.key];
        if (eq) {
          adv.unequip(s.key);
          myTerritory.addEquipmentToWarehouse(eq);
        }
      });
      
      // 執行退休邏輯 (加入名單並提升稅收)
      myTerritory.retireAdventurer(adv);
      
      console.log(`[系統] 👴 感謝 ${adv.name} 的貢獻！他已轉往幕後協助領地發展。`);
      
      modalAdvDetail.classList.remove('active');
      UIManager.updateUI();
    }
  };

  modalAdvDetail.classList.add('active');
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
    buttons.push({ icon: '🗺️', text: '派遣探索小隊', action: () => openDispatchSetup(node, 'explore') });
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
    buttons.push({ icon: '⚔️', text: '派遣討伐部隊', action: () => openDispatchSetup(node, 'subjugation') });
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

export function openDispatchSetup(node: MapNode, actionType: 'explore' | 'subjugation') {
  const modal = document.getElementById('modal-dispatch-setup')!;
  const title = document.getElementById('dispatch-setup-title')!;
  const desc = document.getElementById('dispatch-setup-desc')!;
  const reqPowerEl = document.getElementById('dispatch-req-power')!;
  
  pendingDispatchNode = node;
  selectedAdventurersForDispatch.clear();

  // 根據 NodeLevel 決定難度
  const baseDiff = node.nodeLevel === NodeLevel.WILDERNESS ? 10 : 20 + node.nodeLevel * 10;
  // 荒野的 minPower 降為 30，後續每等加 40
  const minPower = node.nodeLevel === NodeLevel.WILDERNESS ? 30 : 50 + node.nodeLevel * 40;
  
  const optionsContainer = document.getElementById('dispatch-subjugation-options')!;
  
  if (actionType === 'explore') {
    optionsContainer.style.display = 'none';
    title.innerHTML = '🗺️ 探索隊伍編制';
    desc.textContent = `目標：${node.name} (進行區域探索與採集)`;
    // 探索任務需要較短天數 (預設 2 天)
    pendingDispatchTask = new DispatchTask(`探索${node.name}`, TaskType.EXPLORE, 2, baseDiff / 2, 50, 5, Math.floor(minPower * 0.5));
    pendingDispatchTask.targetNodeId = node.id;
  } else {
    optionsContainer.style.display = 'block';
    title.innerHTML = '⚔️ 討伐隊伍編制';
    const features = Object.values(EnemyFeature);
    const randomFeature = Random.pick(features);
    // 討伐任務需要較長天數 (預設 4 天)
    pendingDispatchTask = new DispatchTask(`討伐${node.name}`, TaskType.COMBAT, 4, baseDiff, 100 + node.nodeLevel * 50, 20 + node.nodeLevel * 10, minPower, randomFeature);
    pendingDispatchTask.targetNodeId = node.id;
    
    let fStr = '';
    if (randomFeature === EnemyFeature.HIGH_DEF) fStr = '（高防禦敵人：建議高攻擊與多波續戰能力）';
    if (randomFeature === EnemyFeature.HIGH_EVADE) fStr = '（高閃避敵人：建議高命中隊員）';
    desc.textContent = `目標：${node.name}${fStr} - 難度評估：${baseDiff}`;
  }

  reqPowerEl.textContent = `建議戰力門檻：${pendingDispatchTask.minPowerRequired}`;
  
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
      if (actionType === 'subjugation') {
        const selectedMode = (document.querySelector('input[name="subjugation-mode"]:checked') as HTMLInputElement)?.value as any;
        pendingDispatchTask.subjugationMode = selectedMode;
        if (selectedMode === 'PROGRESS') {
           pendingDispatchTask.totalWaves = 3;
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

function renderDispatchAdvList() {
  const container = document.getElementById('dispatch-adv-list')!;
  container.innerHTML = '';
  
  const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);
  
  if (idleAdvs.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#94a3b8;">目前沒有閒置的冒險者可以派遣。</p>';
    updateDispatchPowerPreview();
    return;
  }

  idleAdvs.forEach(adv => {
    const card = document.createElement('div');
    card.className = 'adv-checkbox-card' + (selectedAdventurersForDispatch.has(adv.id) ? ' selected' : '');
    
    const isChecked = selectedAdventurersForDispatch.has(adv.id) ? 'checked' : '';
    
    card.innerHTML = `
      <input type="checkbox" ${isChecked} style="pointer-events:none;">
      <div style="flex:1;">
        <strong style="color:#e2e8f0; font-size:1.1em;">${adv.name}</strong> <span style="color:#94a3b8; font-size:0.9em;">(Lv.${adv.level} ${adv.job.name})</span><br/>
        <span style="color:#fbbf24; font-size:0.85em;">綜合戰力: ${adv.power}</span>
      </div>
    `;

    card.addEventListener('click', () => {
      if (selectedAdventurersForDispatch.has(adv.id)) {
        selectedAdventurersForDispatch.delete(adv.id);
      } else {
        selectedAdventurersForDispatch.add(adv.id);
      }
      renderDispatchAdvList(); // 重新渲染清單以更新樣式
    });

    container.appendChild(card);
  });
  
  updateDispatchPowerPreview();
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
    riskEl.innerHTML = `風險：<strong style="color:${color}">${risk}</strong>｜耗時 ${pendingDispatchTask.requiredDays} 天｜預期 💰${pendingDispatchTask.expectedGold}／✨${pendingDispatchTask.expectedPrestige}｜失敗將休養`;
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
    
    newBtnScout.addEventListener('click', () => {
      if (GameState.mapSystem.scoutNode(node.id, GameState.myTerritory, GameState.totalDays)) {
        UIManager.updateUI(); // 更新金幣顯示
        openNodeDetailPanel(node); // 重新渲染面板
      }
    });
  }

  // 市場按鈕
  const marketBtn = document.getElementById('nd-btn-market') as HTMLButtonElement;
  if (node.nodeLevel >= NodeLevel.VILLAGE && node.isScouted && node.marketData) {
    marketBtn.style.display = 'block';
    marketBtn.onclick = () => {
      openTradeModal(node);
    };
  } else {
    marketBtn.style.display = 'none';
  }

  // 設定底部操作按鈕 (例如討伐/探索)
  if (node.ownerFactionId === null) {
    if (node.nodeLevel === NodeLevel.WILDERNESS && node.feature !== NodeFeature.MONSTER_NEST && node.feature !== NodeFeature.SUBJUGATION) {
      newBtnAction.textContent = '📖 探索此地';
      newBtnAction.onclick = () => {
        openDispatchSetup(node, 'explore');
        closeNodeDetailPanel();
      };
    } else {
      newBtnAction.textContent = '🛡️ 討伐該區';
      newBtnAction.onclick = () => {
        openDispatchSetup(node, 'subjugation');
        closeNodeDetailPanel();
      };
    }
  } else {
    newBtnAction.textContent = '🔒 無法操作';
    newBtnAction.onclick = () => ToastManager.show('目前無法對該派系領地進行操作！');
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
  const modal = document.getElementById('modal-combat-history')!;
  const listContainer = document.getElementById('combat-history-list')!;
  
  modal.style.display = 'flex';
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
    card.style.cssText = 'background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px; display: flex; justify-content: space-between; align-items: center;';
    
    card.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 5px;">
        <div style="font-size: 1.1em; font-weight: bold;">
          <span style="color: ${titleColor};">【${titleText}】</span> ${record.nodeName} 
          <span style="font-size: 0.8em; color: #64748b; font-weight: normal; margin-left: 10px;">(第 ${record.day} 天)</span>
        </div>
        <div style="font-size: 0.9em; color: #cbd5e1;">
          MVP: <span style="color: #eab308; font-weight: bold;">${record.report.mvpName || '無'}</span> | 
          總傷害: <span style="color: #f87171;">${record.report.totalDamageDealt || 0}</span> | 
          總收益: <span style="color: #fbbf24;">${record.report.lootValue || 0}</span>
        </div>
      </div>
      <button class="action-btn replay-btn" style="padding: 8px 15px; font-size: 0.9em; background: rgba(59, 130, 246, 0.4); border-color: #3b82f6;">🎬 重播</button>
    `;
    
    const replayBtn = card.querySelector('.replay-btn') as HTMLButtonElement;
    replayBtn.onclick = () => {
      modal.style.display = 'none';
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
