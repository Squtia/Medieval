/**
 * TradeController.ts
 * 
 * 📌 [架構變更註記 / ARCHITECTURE NOTE]
 * 本檔案於 P1 重構階段由 ModalController.ts 抽離獨立出。
 * 主要負責：
 *  1. openTradePlanner: 跑商路線規劃與護衛指派面板
 *  2. openTradeModal: 市場交易與單次跑商發起面板
 * 
 * 抽出目的為實現低頻 UI 模組 Lazy Chunk (動態載入 import('./TradeController'))，
 * 避免遊戲首屏下載過大包檔。若未來跑商介面有 Bug 或擴充需求，請至本檔案進行維護。
 */

import { ToastManager } from './ToastManager';
import { MapNode, AdventurerState, getMaxCaravansLimit } from '../models/types';
import { GameState } from '../core/GameState';
import { DispatchTask, EnemyFeature, TaskType, TradeInstruction, TradePhase } from '../models/DispatchTask';
import { TRADE_GOODS } from '../systems/MarketSystem';
import { startRoutePlanning } from './MapController';
import { closeNodeDetailPanel } from './ModalController';

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

  // 宣告動態預計數值計算函數
  const updateExpected = () => {
    let totalCost = 0;
    let totalWeight = 0;

    routeNodes.forEach(node => {
      const buySelect = document.getElementById(`buy-select-${node.id}`) as HTMLSelectElement;
      const buyAmount = document.getElementById(`buy-amount-${node.id}`) as HTMLInputElement;
      if (buySelect && buyAmount) {
        const goodId = buySelect.value;
        const amount = parseInt(buyAmount.value) || 0;
        if (goodId && amount > 0) {
          const marketGood = node.marketData?.goods.find(g => g.goodId === goodId);
          if (marketGood) {
            totalCost += marketGood.buyPrice * amount;
          }
          totalWeight += amount;
        }
      }
    });

    const costText = document.getElementById('trade-planner-expected-cost')!;
    const weightText = document.getElementById('trade-planner-expected-weight')!;
    
    // 獲取當前指派護衛的最大載重
    let totalCapacity = 0;
    GameState.adventurers.forEach(adv => {
      if (selectedAdventurersForCaravan.has(adv.id)) {
        totalCapacity += adv.getTradeStats().maxCargoWeight;
      }
    });

    costText.textContent = `預計買入總金額: ${totalCost} 金幣`;
    const inputGold = parseInt(goldInput.value) || 0;
    if (totalCost > inputGold) {
      costText.style.color = '#ef4444';
      costText.textContent += ` (超額本金！)`;
    } else {
      costText.style.color = '#3b82f6';
    }

    weightText.textContent = `預計買入總重量: ${totalWeight}`;
    if (totalWeight > totalCapacity) {
      weightText.style.color = '#ef4444';
      weightText.textContent += ` (超重！)`;
    } else {
      weightText.style.color = '#10b981';
    }

    // 計算預期天數
    let totalDays = 0;
    const playerNode = mapSystem.getNodes().find(n => n.isPlayerBase);
    if (playerNode && routeNodes.length > 0) {
      // 1. 本鎮 -> 站1
      const dist0 = Math.sqrt(Math.pow(playerNode.x - routeNodes[0].x, 2) + Math.pow(playerNode.y - routeNodes[0].y, 2));
      totalDays += Math.max(1, Math.ceil(dist0 / 15));

      // 2. 各站間
      for (let i = 0; i < routeNodes.length - 1; i++) {
        const dist = Math.sqrt(Math.pow(routeNodes[i].x - routeNodes[i+1].x, 2) + Math.pow(routeNodes[i].y - routeNodes[i+1].y, 2));
        totalDays += Math.max(1, Math.ceil(dist / 15));
      }

      // 3. 最後一站 -> 本鎮
      const lastNode = routeNodes[routeNodes.length - 1];
      const distLast = Math.sqrt(Math.pow(lastNode.x - playerNode.x, 2) + Math.pow(lastNode.y - playerNode.y, 2));
      totalDays += Math.max(1, Math.ceil(distLast / 15));
    }

    const daysText = document.getElementById('trade-planner-expected-days')!;
    if (daysText) {
      daysText.textContent = `預計旅途天數: ${totalDays} 天 (返程依距離計)`;
    }
  };

  routeNodes.forEach((node, index) => {
    const nodeEl = document.createElement('div');
    nodeEl.style.marginBottom = '15px';
    nodeEl.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
    nodeEl.style.paddingBottom = '10px';
    
    let optionsHtml = '';
    if (node.marketData && node.marketData.goods) {
      optionsHtml = node.marketData.goods.map(g => {
        const goodRef = TRADE_GOODS.find(x => x.id === g.goodId);
        const name = goodRef ? `${goodRef.icon || '📦'} ${goodRef.name}` : g.goodId;
        return `<option value="${g.goodId}">${name} (買${g.buyPrice}/賣${g.sellPrice})</option>`;
      }).join('');
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

  // 綁定指令設定與本金變更事件
  routeNodes.forEach(node => {
    const buySelect = document.getElementById(`buy-select-${node.id}`) as HTMLSelectElement;
    const buyAmount = document.getElementById(`buy-amount-${node.id}`) as HTMLInputElement;
    if (buySelect && buyAmount) {
      buySelect.addEventListener('change', updateExpected);
      buyAmount.addEventListener('input', updateExpected);
    }
  });
  goldInput.addEventListener('input', updateExpected);

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
    updateExpected(); // 護衛變動時重新計算

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
  updateExpected(); // 初始化預計金額與重量

  const handleStart = () => {
    const activeCaravansCount = GameState.system.getActiveMissions().filter(m => m.task.type === TaskType.TRADE).length;
    const maxAllowed = getMaxCaravansLimit(GameState.myTerritory.title);
    if (activeCaravansCount >= maxAllowed) {
      ToastManager.show(`行商序列已達上限！當前爵位【${GameState.myTerritory.title}】最多同時派遣 ${maxAllowed} 個商隊。`);
      return;
    }

    if (selectedAdventurersForCaravan.size === 0) {
      ToastManager.show('請至少指派一名冒險者來帶領商隊！');
      return;
    }
    
    const inputGold = parseInt(goldInput.value) || 0;
    if (inputGold > GameState.myTerritory.gold) {
      ToastManager.show('領地金幣不足以支付投入本金！');
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

    // 建立任務，首段天數依據本鎮到第一站距離計算
    let firstLegDays = 1;
    const playerNode = mapSystem.getNodes().find(n => n.isPlayerBase);
    if (playerNode && routeNodes.length > 0) {
      const firstNode = routeNodes[0];
      const dist = Math.sqrt(Math.pow(playerNode.x - firstNode.x, 2) + Math.pow(playerNode.y - firstNode.y, 2));
      firstLegDays = Math.max(1, Math.ceil(dist / 15));
    }

    const taskName = `商隊路線 (${routeNodes.map(n => n.name).join(' ➔ ')})`;
    const task = new DispatchTask(taskName, TaskType.TRADE, firstLegDays, 0, 0, 0, 0, EnemyFeature.BALANCED);
    task.tradeRouteNodeIds = [...plannedRouteNodeIds];
    task.tradeItineraryNodeIds = [...plannedRouteNodeIds];
    task.currentLegIndex = 0;
    task.currentRouteIndex = 0;
    task.tradePhase = TradePhase.OUTBOUND;
    task.tradeInstructions = instructions;
    task.caravanCargo = {};
    task.caravanGold = inputGold;
    task.initialCaravanGold = inputGold;
    
    GameState.myTerritory.gold -= inputGold; // 扣除本金
    
    const team = GameState.adventurers.filter(a => selectedAdventurersForCaravan.has(a.id));
    GameState.system.dispatchAdventurers(team, task);
    
    console.log(`[系統] 🐪 商隊已出發！帶著 ${inputGold} 金幣的本金。`);
    modal.style.display = 'none';
  };
  
  // 避免重複綁定
  const newBtnStart = btnStart.cloneNode(true) as HTMLButtonElement;
  btnStart.parentNode!.replaceChild(newBtnStart, btnStart);
  newBtnStart.addEventListener('click', handleStart);

  if (btnClose) {
    btnClose.onclick = () => {
      modal.style.display = 'none';
    };
  }

  modal.style.display = 'flex';
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
