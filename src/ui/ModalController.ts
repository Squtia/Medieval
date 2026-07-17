import { Adventurer } from '../models/Adventurer';
import { EquipmentSlot, MapNode, NodeLevel, AdventurerState } from '../models/types';
import { GameState } from '../core/GameState';
import { EnhancementSystem } from '../systems/EnhancementSystem';
import { UIManager } from './UIManager';
import { DispatchTask, EnemyFeature, TaskType, TradeInstruction } from '../models/DispatchTask';
import { GAME_EVENTS } from '../data/EventData';
import { startRoutePlanning } from './MapController';
import { TRADE_GOODS } from '../systems/MarketSystem';

export function openWarehouse(isForgeMode: boolean) {
  const modalWarehouse = document.getElementById('modal-warehouse')!;
  const warehouseGrid = document.getElementById('warehouse-grid')!;
  
  // 頁籤與面板
  const tabEquip = document.getElementById('tab-warehouse-equip')!;
  const tabGoods = document.getElementById('tab-warehouse-goods')!;
  const equipPanel = document.getElementById('warehouse-equip-panel')!;
  const goodsPanel = document.getElementById('warehouse-goods-panel')!;

  tabEquip.onclick = () => {
    equipPanel.style.display = 'block';
    goodsPanel.style.display = 'none';
    tabEquip.style.background = 'rgba(255,255,255,0.15)';
    tabEquip.style.borderColor = 'rgba(255,255,255,0.2)';
    tabGoods.style.background = 'rgba(255,255,255,0.05)';
    tabGoods.style.borderColor = 'rgba(255,255,255,0.1)';
  };

  tabGoods.onclick = () => {
    equipPanel.style.display = 'none';
    goodsPanel.style.display = 'block';
    tabEquip.style.background = 'rgba(255,255,255,0.05)';
    tabEquip.style.borderColor = 'rgba(255,255,255,0.1)';
    tabGoods.style.background = 'rgba(255,255,255,0.15)';
    tabGoods.style.borderColor = 'rgba(255,255,255,0.2)';
    renderWarehouseGoods();
  };

  // 預設切換回裝備 panel
  equipPanel.style.display = 'block';
  goodsPanel.style.display = 'none';
  tabEquip.style.background = 'rgba(255,255,255,0.15)';
  tabEquip.style.borderColor = 'rgba(255,255,255,0.2)';
  tabGoods.style.background = 'rgba(255,255,255,0.05)';
  tabGoods.style.borderColor = 'rgba(255,255,255,0.1)';

  warehouseGrid.innerHTML = '';
  const myTerritory = GameState.myTerritory;
  
  if (myTerritory.warehouse.length === 0) {
    warehouseGrid.innerHTML = '<p style="color:#94a3b8; grid-column: span 2; text-align: center;">倉庫目前空空如也。</p>';
  } else {
    myTerritory.warehouse.forEach(eq => {
      const card = document.createElement('div');
      card.className = 'glass-panel';
      card.style.padding = '15px';
      card.style.display = 'flex';
      card.style.gap = '15px';
      
      const statsStr = Object.entries(eq.combatEffects || {}).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(', ');
      const attrStr = Object.entries(eq.effects || {}).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(', ');
      
      const enhanceCost = EnhancementSystem.getEnhancementCost(eq.enhancementLevel || 0);
      const successRate = EnhancementSystem.getSuccessRate(eq.enhancementLevel || 0);
      const lvlStr = eq.enhancementLevel ? ` +${eq.enhancementLevel}` : '';

      let actionBtnHtml = '';
      if (isForgeMode) {
        actionBtnHtml = `
          <div style="margin-top: 10px;">
            <button class="action-btn btn-enhance" style="padding: 5px 10px; font-size: 0.85em;" data-uuid="${eq.uuid}">
              🔨 強化 (花費 ${enhanceCost} | 機率 ${successRate}%)
            </button>
          </div>
        `;
      }

      card.innerHTML = `
        <div style="font-size:3em;">${eq.icon || '🛡️'}</div>
        <div style="flex:1;">
          <strong style="color:#eab308; font-size:1.1em;">${eq.name}${lvlStr}</strong><br/>
          <span style="font-size:0.8em; color:#94a3b8;">${statsStr} | ${attrStr}</span>
          ${actionBtnHtml}
        </div>
      `;
      warehouseGrid.appendChild(card);
    });

    if (isForgeMode) {
      const enhanceBtns = warehouseGrid.querySelectorAll('.btn-enhance');
      enhanceBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const uuid = (e.currentTarget as HTMLElement).getAttribute('data-uuid')!;
          const eq = myTerritory.warehouse.find(x => x.uuid === uuid);
          if (eq) {
            const result = EnhancementSystem.enhance(myTerritory, eq);
            console.log(`[系統] ${result}`);
            UIManager.updateUI();
            openWarehouse(true); 
          }
        });
      });
    }
  }
  
  modalWarehouse.classList.add('active');
}

export function openAdvDetail(adv: Adventurer) {
  const modalAdvDetail = document.getElementById('modal-adv-detail')!;
  const myTerritory = GameState.myTerritory;

  document.getElementById('adv-detail-name')!.textContent = adv.name;
  document.getElementById('adv-detail-desc')!.textContent = `Lv.${adv.level} ${adv.job.name} | ${adv.trait.name}`;
  document.getElementById('adv-detail-power')!.textContent = adv.power.toString();
  
  const stats = adv.getCombatStats();
  const attr = adv.getEffectiveAttributes();
  const unspent = adv.unspentStatPoints > 0 
    ? `<div style="grid-column: span 2; text-align: center; color: #eab308; font-weight: bold; margin-bottom: 10px;">可用屬性點：${adv.unspentStatPoints}</div>` 
    : '';

  const getStatHtml = (label: string, key: keyof typeof attr, val: number) => {
    const btn = adv.unspentStatPoints > 0 
      ? `<button class="btn-allocate" data-stat="${key}" style="margin-left:5px; padding:0 5px; font-size:0.8em; cursor:pointer;">+</button>` 
      : '';
    return `<div class="stat-item"><span class="stat-label">${label}</span><span class="stat-value">${val}${btn}</span></div>`;
  };

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
      <div style="flex:1;">${getStatHtml('魅力 (CHM)', 'charm', attr.charm)}</div>
      <div style="flex:1;">${getStatHtml('統帥 (CMD)', 'command', attr.command)}</div>
    </div>
  `;
  document.getElementById('adv-detail-stats')!.innerHTML = statsHtml;

  // 綁定配點按鈕事件
  const allocateBtns = document.getElementById('adv-detail-stats')!.querySelectorAll('.btn-allocate');
  allocateBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const statKey = (e.currentTarget as HTMLElement).getAttribute('data-stat') as any;
      if (adv.allocateStat(statKey)) {
        openAdvDetail(adv); // 重新渲染畫面
        UIManager.updateUI();
      }
    });
  });

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
          alert(e.message); 
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
  
  const buttons: { icon: string, text: string, action: () => void }[] = [];

  // 動態判斷可用功能
  if (node.ownerFactionId !== null && !node.isPlayerBase) {
    buttons.push({ icon: '👁️', text: '派遣間諜 (開發中)', action: () => alert('間諜功能尚未實作') });
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
    btnEl.innerHTML = btnInfo.icon;
    btnEl.style.left = `${x}px`;
    btnEl.style.top = `${y}px`;

    btnEl.addEventListener('mouseenter', () => {
      tooltip.textContent = btnInfo.text;
      tooltip.style.opacity = '1';
      // 根據位置調整 tooltip 避免被擋住，暫且放正下方
      tooltip.style.top = '80px';
    });
    btnEl.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
    
    btnEl.addEventListener('click', (e) => {
      e.stopPropagation();
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
  
  if (actionType === 'explore') {
    title.innerHTML = '🗺️ 探索隊伍編制';
    desc.textContent = `目標：${node.name} (進行區域探索與採集)`;
    // 探索任務需要較短天數 (預設 2 天)
    pendingDispatchTask = new DispatchTask(`探索${node.name}`, TaskType.EXPLORE, 2, baseDiff / 2, 50, 5, Math.floor(minPower * 0.5));
  } else {
    title.innerHTML = '⚔️ 討伐隊伍編制';
    const features = Object.values(EnemyFeature);
    const randomFeature = features[Math.floor(Math.random() * features.length)];
    // 討伐任務需要較長天數 (預設 4 天)
    pendingDispatchTask = new DispatchTask(`討伐${node.name}`, TaskType.COMBAT, 4, baseDiff, 100 + node.nodeLevel * 50, 20 + node.nodeLevel * 10, minPower, randomFeature);
    
    let fStr = '';
    if (randomFeature === EnemyFeature.HIGH_DEF) fStr = ' (高防禦敵人)';
    if (randomFeature === EnemyFeature.HIGH_EVADE) fStr = ' (高閃避敵人)';
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
      alert('請至少選擇一名冒險者！');
      return;
    }
    const team = GameState.adventurers.filter(a => selectedAdventurersForDispatch.has(a.id));
    if (pendingDispatchTask) {
      GameState.system.dispatchAdventurers(team, pendingDispatchTask);
      UIManager.updateUI();
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

let selectedAdventurersForCaravan: Set<string> = new Set();

export function openTradePlanner(plannedRouteNodeIds: string[]) {
  const modal = document.getElementById('modal-trade-planner')!;
  const container = document.getElementById('trade-planner-nodes')!;
  const btnStart = document.getElementById('btn-start-caravan') as HTMLButtonElement;
  const btnClose = document.getElementById('btn-close-trade-planner') as HTMLButtonElement;
  const goldInput = document.getElementById('trade-planner-gold') as HTMLInputElement;
  const capacityText = document.getElementById('trade-planner-capacity')!;
  
  const mapSystem = GameState.mapSystem;
  container.innerHTML = '';
  selectedAdventurersForCaravan.clear();
  goldInput.value = '500';

  if (!mapSystem) return;

  const routeNodes = plannedRouteNodeIds.map(id => mapSystem.getNodeById(id)).filter(n => n !== undefined) as MapNode[];

  routeNodes.forEach((node, index) => {
    const nodeEl = document.createElement('div');
    nodeEl.style.marginBottom = '15px';
    nodeEl.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
    nodeEl.style.paddingBottom = '10px';
    
    let optionsHtml = '';
    if (node.marketData && node.marketData.goods) {
      optionsHtml = node.marketData.goods.map(g => `<option value="${g.goodId}">${g.goodId} (買${g.buyPrice}/賣${g.sellPrice})</option>`).join('');
    }

    nodeEl.innerHTML = `
      <h4 style="margin: 0 0 5px 0; color: #60a5fa;">第 ${index + 1} 站: ${node.name}</h4>
      <div style="display: flex; gap: 10px;">
        <div style="flex: 1;">
          <label style="font-size: 0.9em;">🛒 買入設定：</label><br/>
          <select id="buy-select-${node.id}" style="width:100%; margin-bottom:5px;">
            <option value="">不買入</option>
            ${optionsHtml}
          </select>
          <input type="number" id="buy-amount-${node.id}" placeholder="數量" style="width: 100%;" min="0">
        </div>
        <div style="flex: 1;">
          <label style="font-size: 0.9em;">💰 賣出設定：</label><br/>
          <select id="sell-select-${node.id}" style="width:100%; margin-bottom:5px;">
            <option value="">不賣出</option>
            ${optionsHtml}
          </select>
        </div>
      </div>
    `;
    container.appendChild(nodeEl);
  });

  const renderAdvList = () => {
    const advListContainer = document.getElementById('trade-planner-adv-list')!;
    advListContainer.innerHTML = '';
    const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);
    
    let totalCapacity = 0;
    
    idleAdvs.forEach(adv => {
      if (selectedAdventurersForCaravan.has(adv.id)) {
        totalCapacity += adv.getTradeStats().maxCargoWeight;
      }
    });
    capacityText.textContent = `商隊最大載重量: ${totalCapacity}`;

    idleAdvs.forEach(adv => {
      const card = document.createElement('div');
      card.className = 'adv-checkbox-card' + (selectedAdventurersForCaravan.has(adv.id) ? ' selected' : '');
      const isChecked = selectedAdventurersForCaravan.has(adv.id) ? 'checked' : '';
      const ts = adv.getTradeStats();
      card.innerHTML = `
        <input type="checkbox" ${isChecked} style="pointer-events:none;">
        <div style="flex:1;">
          <strong style="color:#e2e8f0; font-size:1.1em;">${adv.name}</strong> <span style="color:#94a3b8; font-size:0.9em;">(載重: ${ts.maxCargoWeight}, 議價: +${(ts.negotiationBonus * 100).toFixed(1)}%)</span>
        </div>
      `;
      card.addEventListener('click', () => {
        if (selectedAdventurersForCaravan.has(adv.id)) {
          selectedAdventurersForCaravan.delete(adv.id);
        } else {
          selectedAdventurersForCaravan.add(adv.id);
        }
        renderAdvList();
      });
      advListContainer.appendChild(card);
    });
  };

  renderAdvList();

  const handleStart = () => {
    if (selectedAdventurersForCaravan.size === 0) {
      alert('請至少指派一名冒險者來帶領商隊！');
      return;
    }
    
    const inputGold = parseInt(goldInput.value) || 0;
    if (inputGold > GameState.myTerritory.gold) {
      alert('領地金幣不足以支付投入本金！');
      return;
    }

    const instructions: TradeInstruction[] = [];
    routeNodes.forEach(node => {
      const buySelect = document.getElementById(`buy-select-${node.id}`) as HTMLSelectElement;
      const buyAmount = document.getElementById(`buy-amount-${node.id}`) as HTMLInputElement;
      const sellSelect = document.getElementById(`sell-select-${node.id}`) as HTMLSelectElement;
      
      const buyItem = buySelect.value;
      const amount = parseInt(buyAmount.value) || 0;
      const sellItem = sellSelect.value;
      
      const buyList = buyItem && amount > 0 ? [{ goodId: buyItem, maxAmount: amount }] : [];
      const sellList = sellItem ? [sellItem] : [];
      
      instructions.push({
        nodeId: node.id,
        buy: buyList,
        sell: sellList
      });
    });

    // 建立任務
    const taskName = `商隊路線 (${routeNodes.map(n => n.name).join(' ➔ ')})`;
    const task = new DispatchTask(taskName, TaskType.TRADE, 1, 0, 0, 0, 0, EnemyFeature.BALANCED);
    task.tradeRouteNodeIds = plannedRouteNodeIds;
    task.tradeInstructions = instructions;
    task.caravanCargo = {};
    task.caravanGold = inputGold;
    
    GameState.myTerritory.gold -= inputGold; // 扣除本金
    
    const team = GameState.adventurers.filter(a => selectedAdventurersForCaravan.has(a.id));
    GameState.system.dispatchAdventurers(team, task);
    
    console.log(`[系統] 🐪 商隊已出發！帶著 ${inputGold} 金幣的本金。`);
    modal.style.display = 'none';
    UIManager.updateUI();
  };
  
  // 避免重複綁定
  const newBtnStart = btnStart.cloneNode(true) as HTMLButtonElement;
  btnStart.parentNode!.replaceChild(newBtnStart, btnStart);
  newBtnStart.addEventListener('click', handleStart);

  btnClose.onclick = () => modal.style.display = 'none';

  modal.style.display = 'flex';
}

function updateDispatchPowerPreview() {
  let totalPower = 0;
  GameState.adventurers.forEach(adv => {
    if (selectedAdventurersForDispatch.has(adv.id)) {
      totalPower += adv.power;
    }
  });
  const el = document.getElementById('dispatch-total-power')!;
  el.textContent = totalPower.toString();
  
  if (pendingDispatchTask && totalPower >= pendingDispatchTask.minPowerRequired) {
    el.style.color = '#10b981'; // 綠色
  } else {
    el.style.color = '#eab308'; // 黃色
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
    if (node.nodeLevel === NodeLevel.WILDERNESS) {
      newBtnAction.textContent = '🗺️ 探索此地';
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
    newBtnAction.onclick = () => alert('目前無法對該派系領地進行操作！');
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
export function openTradeModal(node: MapNode) {
  const tradeModal = document.getElementById('modal-trade')!;
  const title = document.getElementById('trade-title')!;
  const invContainer = document.getElementById('trade-inventory')!;
  const marketContainer = document.getElementById('trade-market')!;

  title.textContent = `⚖️ 市場與商隊 - ${node.name}`;
  
  // 本地領地物資
  invContainer.innerHTML = '';
  const territory = GameState.myTerritory;
  const inventoryHtml = Object.entries(territory.tradeInventory).map(([goodId, amount]) => {
    const goodRef = TRADE_GOODS.find(g => g.id === goodId);
    const goodName = goodRef ? `${goodRef.icon || '📦'} ${goodRef.name}` : goodId;
    return `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>${goodName}</span>
              <span>數量: ${amount}</span>
            </div>`;
  }).join('');
  invContainer.innerHTML = inventoryHtml || '<p>背包空空如也</p>';

  // 當地市場
  marketContainer.innerHTML = '';
  if (node.marketData && node.marketData.goods.length > 0) {
    const marketHtml = node.marketData.goods.map(item => {
      const goodRef = TRADE_GOODS.find(g => g.id === item.goodId);
      const goodName = goodRef ? `${goodRef.icon || '📦'} ${goodRef.name}` : item.goodId;
      return `<div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: rgba(255,255,255,0.05);">
                <span>${goodName}</span>
                <span>買入: ${item.buyPrice} / 賣出: ${item.sellPrice} / 庫存: ${item.stock}</span>
              </div>`;
    }).join('');
    marketContainer.innerHTML = marketHtml;
  } else {
    marketContainer.innerHTML = '<p>市場今日無貨</p>';
  }

  tradeModal.style.display = 'flex';

  document.getElementById('btn-close-trade')!.onclick = () => {
    tradeModal.style.display = 'none';
  };

  document.getElementById('btn-plan-route')!.onclick = () => {
    tradeModal.style.display = 'none';
    closeNodeDetailPanel();
    startRoutePlanning(node);
  };
}

/**
 * 渲染交易品倉庫物資並提供出售功能
 */
export function renderWarehouseGoods() {
  const goodsGrid = document.getElementById('warehouse-goods-grid')!;
  if (!goodsGrid) return;
  goodsGrid.innerHTML = '';
  
  const myTerritory = GameState.myTerritory;
  const goodsEntries = Object.entries(myTerritory.tradeInventory).filter(([_, amount]) => amount > 0);

  if (goodsEntries.length === 0) {
    goodsGrid.innerHTML = '<p style="color:#94a3b8; grid-column: span 2; text-align: center; padding: 20px;">倉庫中目前沒有任何交易品物資。</p>';
    return;
  }

  goodsEntries.forEach(([goodId, amount]) => {
    const goodRef = TRADE_GOODS.find(g => g.id === goodId);
    const name = goodRef?.name || goodId;
    const icon = goodRef?.icon || '📦';
    const desc = goodRef?.description || '跑商帶回來的交易品。';
    const basePrice = goodRef?.basePrice || 10;

    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '15px';
    card.style.display = 'flex';
    card.style.gap = '15px';
    card.style.alignItems = 'center';
    card.style.background = 'rgba(0,0,0,0.4)';
    card.style.border = '1px solid rgba(255,255,255,0.05)';

    card.innerHTML = `
      <div style="font-size:3em;">${icon}</div>
      <div style="flex:1;">
        <strong style="color:#eab308; font-size:1.1em;">${name}</strong>
        <span style="color:#10b981; font-weight:bold; margin-left:10px;">數量: ${amount}</span><br/>
        <span style="font-size:0.8em; color:#94a3b8; display:block; margin: 4px 0;">${desc}</span>
        <span style="font-size:0.8em; color:#eab308;">基礎價值: ${basePrice} 金幣</span>
      </div>
      <div>
        <button class="action-btn btn-sell-good" style="padding: 5px 10px; font-size: 0.85em; background: linear-gradient(135deg, #d97706, #b45309);" data-good-id="${goodId}">
          💰 出售
        </button>
      </div>
    `;

    goodsGrid.appendChild(card);
  });

  // 綁定出售按鈕事件
  const sellBtns = goodsGrid.querySelectorAll('.btn-sell-good');
  sellBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const goodId = (e.currentTarget as HTMLElement).getAttribute('data-good-id')!;
      const goodRef = TRADE_GOODS.find(g => g.id === goodId);
      if (!goodRef) return;
      
      const currentAmount = myTerritory.tradeInventory[goodId] || 0;
      if (currentAmount <= 0) return;

      const sellAmount = prompt(`請輸入要出售的「${goodRef.name}」數量 (當前擁有: ${currentAmount}):`, currentAmount.toString());
      if (sellAmount === null) return;
      
      const num = parseInt(sellAmount);
      if (isNaN(num) || num <= 0 || num > currentAmount) {
        alert('請輸入正確的出售數量！');
        return;
      }

      // 扣除並給予金幣
      myTerritory.tradeInventory[goodId] -= num;
      const goldGained = goodRef.basePrice * num;
      myTerritory.addGold(goldGained);
      console.log(`[系統] 💰 您出售了 ${num} 個「${goodRef.name}」，獲得了 ${goldGained} 金幣！`);
      
      UIManager.updateUI();
      renderWarehouseGoods(); // 重新渲染交易品清單
    });
  });
}
