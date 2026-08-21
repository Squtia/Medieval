/**
 * TradeController.ts
 * 
 * 精準單線跑商控制器 (Single-Target Caravan Controller)
 * 佈局：左側護衛傭兵編制 (上限 5 人) + 右側寬廣貿易與物資調度策略
 */

import { ToastManager } from './ToastManager';
import { MapNode, AdventurerState, getMaxCaravansLimit, TradeTreaty } from '../models/types';
import { GameState } from '../core/GameState';
import { DispatchTask, EnemyFeature, TaskType, TradeInstruction, TradePhase } from '../models/DispatchTask';
import { TRADE_GOODS } from '../systems/MarketSystem';
import { closeNodeDetailPanel } from './ModalController';
import { UIManager } from './UIManager';

let selectedAdventurersForCaravan: Set<string> = new Set();
let selectedCargoToSell: Record<string, number> = {};

function getTravelTiming(origin: MapNode, target: MapNode) {
  if (GameState.roadSystem) return GameState.roadSystem.getTravelDays(origin, target);
  const baseDays = Math.max(1, Math.ceil(Math.hypot(target.x - origin.x, target.y - origin.y) / 15));
  return { baseDays, adjustedDays: baseDays, hasRoad: false };
}

export function openTradePlanner(plannedRouteNodeIds: string[]) {
  const modal = document.getElementById('modal-trade-planner')!;
  const cargoContainer = document.getElementById('trade-planner-cargo-list')!;
  const btnStart = document.getElementById('btn-start-caravan') as HTMLButtonElement;
  const btnClose = document.getElementById('btn-close-trade-planner') as HTMLButtonElement;
  const goldInput = document.getElementById('trade-planner-gold') as HTMLInputElement;
  const buySelect = document.getElementById('trade-planner-buy-select') as HTMLSelectElement;
  const buyAmountInput = document.getElementById('trade-planner-buy-amount') as HTMLInputElement;
  const buySummaryText = document.getElementById('trade-planner-buy-summary')!;
  const sellSummaryText = document.getElementById('trade-planner-sell-summary')!;
  const capacityText = document.getElementById('trade-planner-capacity')!;
  const routeInfoText = document.getElementById('trade-planner-route-info')!;
  const daysText = document.getElementById('trade-planner-expected-days')!;
  const totalPowerText = document.getElementById('trade-planner-total-power')!;
  const negotiationText = document.getElementById('trade-planner-negotiation')!;
  const advCountText = document.getElementById('trade-planner-adv-count')!;
  const profitPreviewText = document.getElementById('trade-planner-profit-preview')!;

  const mapSystem = GameState.mapSystem;
  if (!mapSystem || plannedRouteNodeIds.length === 0) return;

  const targetNodeId = plannedRouteNodeIds[0];
  const targetNode = mapSystem.getNodeById(targetNodeId);
  const playerNode = mapSystem.getNodes().find(n => n.isPlayerBase);

  if (!targetNode || !playerNode) return;

  // 重置狀態
  selectedAdventurersForCaravan.clear();
  selectedCargoToSell = {};
  goldInput.value = '300';
  buyAmountInput.value = '10';

  const territory = GameState.myTerritory;
  const tradeInventory = territory.tradeInventory || {};

  // 1. 路線與往返天數計算
  const outboundTiming = getTravelTiming(playerNode, targetNode);
  const returnTiming = getTravelTiming(targetNode, playerNode);
  const totalDays = outboundTiming.adjustedDays + returnTiming.adjustedDays;
  const baseDays = outboundTiming.baseDays + returnTiming.baseDays;
  const roadSavings = baseDays - totalDays;

  routeInfoText.textContent = `目標據點：【${targetNode.name}】 · 往返距離：${totalDays} 天 ${roadSavings > 0 ? `(🛣️ 道路節省 ${roadSavings} 天)` : ''}`;
  daysText.textContent = `預計往返旅程：${totalDays} 天 (去程 ${outboundTiming.adjustedDays} 天 + 返程 ${returnTiming.adjustedDays} 天)`;

  const tradeModifiers = GameState.roadSystem
    ? GameState.roadSystem.getTradeModifiers(playerNode, targetNode)
    : { hasRoad: false, buyPriceMultiplier: 1, sellPriceMultiplier: 1 };

  // 2. 渲染目標城可採購特產選單
  buySelect.innerHTML = '<option value="">-- 不進行採購 (僅賣貨) --</option>';
  if (targetNode.marketData && targetNode.marketData.goods) {
    targetNode.marketData.goods.forEach(item => {
      const goodRef = TRADE_GOODS.find(g => g.id === item.goodId);
      const name = goodRef ? `${goodRef.icon || '📦'} ${goodRef.name}` : item.goodId;
      const actualBuyPrice = Math.max(1, Math.floor(item.buyPrice * tradeModifiers.buyPriceMultiplier));
      const opt = document.createElement('option');
      opt.value = item.goodId;
      opt.textContent = `${name} (單價: ${actualBuyPrice}G | 當地庫存: ${item.stock})`;
      buySelect.appendChild(opt);
    });
    if (targetNode.marketData.goods.length > 0) {
      buySelect.value = targetNode.marketData.goods[0].goodId;
    }
  }

  // 3. 動態更新計算函數
  const updatePlannerSummary = () => {
    // 計算護衛總戰力、總載重與議價加成
    let totalPower = 0;
    let totalCapacity = 0;
    let totalNegotiation = 0;
    GameState.adventurers.forEach(adv => {
      if (selectedAdventurersForCaravan.has(adv.id)) {
        totalPower += adv.power;
        const stats = adv.getTradeStats();
        totalCapacity += stats.maxCargoWeight;
        totalNegotiation += stats.negotiationBonus;
      }
    });

    if (advCountText) advCountText.textContent = `(已選 ${selectedAdventurersForCaravan.size} / 5 人)`;
    if (totalPowerText) totalPowerText.textContent = `${totalPower}`;
    if (negotiationText) negotiationText.textContent = `+${(totalNegotiation * 100).toFixed(1)}%`;

    // 載出貨物重量與預計賣出收益
    let cargoWeightOut = 0;
    let expectedSellGold = 0;
    for (const [gId, amount] of Object.entries(selectedCargoToSell)) {
      if (amount > 0) {
        cargoWeightOut += amount;
        const marketItem = targetNode.marketData?.goods.find(g => g.goodId === gId);
        const baseSellPrice = marketItem ? marketItem.sellPrice : (TRADE_GOODS.find(x => x.id === gId)?.basePrice || 10);
        const actualSellPrice = Math.max(1, Math.floor(baseSellPrice * (1 + totalNegotiation) * tradeModifiers.sellPriceMultiplier));
        expectedSellGold += actualSellPrice * amount;
      }
    }

    // 採購計算
    const selBuyGoodId = buySelect.value;
    const wantBuyAmount = parseInt(buyAmountInput.value) || 0;
    const inputGold = parseInt(goldInput.value) || 0;

    let expectedBuyCost = 0;
    let actualBuyCapacityNeed = wantBuyAmount;
    if (selBuyGoodId && wantBuyAmount > 0) {
      const marketItem = targetNode.marketData?.goods.find(g => g.goodId === selBuyGoodId);
      if (marketItem) {
        const actualBuyPrice = Math.max(1, Math.floor(marketItem.buyPrice * (1 - totalNegotiation) * tradeModifiers.buyPriceMultiplier));
        expectedBuyCost = actualBuyPrice * wantBuyAmount;
      }
    }

    // 載重檢定
    const maxTripWeight = Math.max(cargoWeightOut, actualBuyCapacityNeed);
    capacityText.textContent = `${maxTripWeight} / ${totalCapacity} 單位`;
    if (maxTripWeight > totalCapacity || totalCapacity === 0) {
      capacityText.style.color = '#ef4444';
    } else {
      capacityText.style.color = '#34d399';
    }

    sellSummaryText.textContent = `出發載重: ${cargoWeightOut} 單位 | 預計收益: +${expectedSellGold}G`;
    if (selBuyGoodId && wantBuyAmount > 0) {
      buySummaryText.innerHTML = `預計採購花費: <span style="color:#fbbf24; font-weight:bold;">${expectedBuyCost}</span> 金幣 ${expectedBuyCost > inputGold ? '<span style="color:#ef4444; font-weight:bold;">(⚠️ 投入本金不足！)</span>' : ''} (享議價 -${(totalNegotiation * 100).toFixed(1)}%)`;
    } else {
      buySummaryText.textContent = '未設定採購目標 (僅將出發貨物賣出換錢)';
    }

    // 預估淨損益結算
    const netGoldGain = expectedSellGold - expectedBuyCost;
    if (profitPreviewText) {
      profitPreviewText.innerHTML = `💰 預估現金損益：<span style="color:${netGoldGain >= 0 ? '#34d399' : '#ef4444'}; font-weight:bold;">${netGoldGain >= 0 ? '+' : ''}${netGoldGain} 金幣</span> (本金 ${inputGold}G)`;
    }
  };

  // 4. 渲染領地特產裝載列 (支援手打輸入 + 步進快捷鍵 + MAX)
  cargoContainer.innerHTML = '';
  const availableGoods = TRADE_GOODS.filter(g => (tradeInventory[g.id] || 0) > 0);

  if (availableGoods.length === 0) {
    cargoContainer.innerHTML = '<div style="color:#94a3b8; font-size:0.88em; text-align:center; padding:12px; background:rgba(0,0,0,0.2); border-radius:6px;">領地倉庫目前無特產貨物可供裝載 (可純投入金幣前往採購)</div>';
  } else {
    availableGoods.forEach(g => {
      const owned = tradeInventory[g.id] || 0;
      const marketItem = targetNode.marketData?.goods.find(x => x.goodId === g.id);
      const estPrice = marketItem ? Math.floor(marketItem.sellPrice * tradeModifiers.sellPriceMultiplier) : Math.floor(g.basePrice * 0.8);

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.background = 'rgba(0,0,0,0.3)';
      row.style.padding = '6px 12px';
      row.style.borderRadius = '6px';
      row.style.border = '1px solid rgba(255,255,255,0.05)';

      row.innerHTML = `
        <div style="flex: 1.2; min-width: 150px;">
          <span style="font-size:0.92em; color:#e2e8f0; font-weight:bold;">${g.icon || '📦'} ${g.name}</span>
          <div style="font-size:0.75em; color:#94a3b8; margin-top:1px;">庫存: <b style="color:#fbbf24;">${owned}</b> | 當地收購: <b style="color:#34d399;">${estPrice}G</b></div>
        </div>
        <div style="display:flex; align-items:center; gap:4px;">
          <button class="cargo-btn-sub10" style="padding:3px 6px; font-size:0.75em; background:#334155; border:1px solid rgba(255,255,255,0.1); color:#cbd5e1; border-radius:3px; cursor:pointer;" title="減少10">-10</button>
          <button class="cargo-btn-sub1" style="padding:3px 8px; font-size:0.8em; background:#475569; border:none; color:#fff; border-radius:3px; cursor:pointer;" title="減少1">-</button>
          <input type="number" class="cargo-amt-input" value="0" min="0" max="${owned}" style="width: 54px; text-align: center; padding: 3px 2px; font-size: 0.88em; font-weight: bold; background: rgba(0,0,0,0.7); border: 1px solid rgba(217,119,6,0.5); color: #fbbf24; border-radius: 4px;">
          <button class="cargo-btn-add1" style="padding:3px 8px; font-size:0.8em; background:#d97706; border:none; color:#fff; border-radius:3px; cursor:pointer;" title="增加1">+</button>
          <button class="cargo-btn-add10" style="padding:3px 6px; font-size:0.75em; background:#b45309; border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:3px; cursor:pointer;" title="增加10">+10</button>
          <button class="cargo-btn-max" style="padding:3px 8px; font-size:0.75em; background:#2563eb; border:none; color:#fff; border-radius:3px; cursor:pointer; font-weight:bold;">MAX</button>
          <button class="cargo-btn-zero" style="padding:3px 6px; font-size:0.75em; background:#64748b; border:none; color:#fff; border-radius:3px; cursor:pointer;">0</button>
        </div>
      `;

      const amtInput = row.querySelector('.cargo-amt-input') as HTMLInputElement;

      const setAmt = (val: number) => {
        const clamped = Math.max(0, Math.min(owned, isNaN(val) ? 0 : val));
        selectedCargoToSell[g.id] = clamped;
        amtInput.value = clamped.toString();
        updatePlannerSummary();
      };

      amtInput.addEventListener('input', () => setAmt(parseInt(amtInput.value) || 0));
      row.querySelector('.cargo-btn-sub10')?.addEventListener('click', () => setAmt((selectedCargoToSell[g.id] || 0) - 10));
      row.querySelector('.cargo-btn-sub1')?.addEventListener('click', () => setAmt((selectedCargoToSell[g.id] || 0) - 1));
      row.querySelector('.cargo-btn-add1')?.addEventListener('click', () => setAmt((selectedCargoToSell[g.id] || 0) + 1));
      row.querySelector('.cargo-btn-add10')?.addEventListener('click', () => setAmt((selectedCargoToSell[g.id] || 0) + 10));
      row.querySelector('.cargo-btn-max')?.addEventListener('click', () => setAmt(owned));
      row.querySelector('.cargo-btn-zero')?.addEventListener('click', () => setAmt(0));

      cargoContainer.appendChild(row);
    });
  }

  // 5. 渲染左側護衛傭兵清單 (卡片包含立繪圖標、等級、職業、戰力、載重、議價，上限 5 人)
  const renderAdvList = () => {
    const advContainer = document.getElementById('trade-planner-adv-list')!;
    advContainer.innerHTML = '';
    const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);

    if (idleAdvs.length === 0) {
      advContainer.innerHTML = '<div style="color:#ef4444; font-size:0.85em; padding:12px; text-align:center;">⚠️ 領地目前沒有閒置傭兵可供護衛！</div>';
      return;
    }

    idleAdvs.forEach(adv => {
      const isSelected = selectedAdventurersForCaravan.has(adv.id);
      const stats = adv.getTradeStats();
      const card = document.createElement('div');
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.padding = '8px 10px';
      card.style.background = isSelected ? 'rgba(234, 179, 8, 0.22)' : 'rgba(0,0,0,0.35)';
      card.style.border = `1px solid ${isSelected ? '#fbbf24' : 'rgba(255,255,255,0.1)'}`;
      card.style.borderRadius = '6px';
      card.style.cursor = 'pointer';
      card.style.transition = 'all 0.15s';
      card.style.userSelect = 'none';

      const displayClass = (adv as any).currentClass || adv.job.name;

      card.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.2em;">👤</span>
          <div>
            <div style="font-weight:bold; font-size:0.88em; color:${isSelected ? '#fbbf24' : '#e2e8f0'};">
              ${adv.name} <span style="font-size:0.8em; color:#94a3b8; font-weight:normal;">(Lv.${adv.level} ${displayClass})</span>
            </div>
            <div style="font-size:0.75em; color:#cbd5e1; margin-top:2px;">
              ⚔️ <span style="color:#fbbf24;">${adv.power}</span> · 📦+${stats.maxCargoWeight} · 💬+${(stats.negotiationBonus * 100).toFixed(0)}%
            </div>
          </div>
        </div>
        <div style="font-size:1.1em; color:${isSelected ? '#fbbf24' : 'rgba(255,255,255,0.2)'};">
          ${isSelected ? '☑' : '☐'}
        </div>
      `;

      card.onclick = () => {
        if (selectedAdventurersForCaravan.has(adv.id)) {
          selectedAdventurersForCaravan.delete(adv.id);
        } else {
          if (selectedAdventurersForCaravan.size >= 5) {
            ToastManager.show('商隊護衛最多只能指派 5 名傭兵！');
            return;
          }
          if (adv.quality === 'UR') {
            const hasUR = Array.from(selectedAdventurersForCaravan).some(id => {
              const m = GameState.adventurers.find(a => a.id === id);
              return m?.quality === 'UR';
            });
            if (hasUR) {
              ToastManager.show('⚠️ 戰鬥隊伍限制：每場戰鬥最多只能編入 1 位 UR 品質傭兵！');
              return;
            }
          }
          selectedAdventurersForCaravan.add(adv.id);
        }
        renderAdvList();
        updatePlannerSummary();
      };

      advContainer.appendChild(card);
    });
  };

  // 綁定輸入與選單變更
  goldInput.oninput = updatePlannerSummary;
  buySelect.onchange = updatePlannerSummary;
  buyAmountInput.oninput = updatePlannerSummary;

  renderAdvList();
  updatePlannerSummary();

  modal.style.display = 'flex';

  // 關閉
  btnClose.onclick = () => {
    modal.style.display = 'none';
  };

  // 6. 出發派遣商隊
  btnStart.onclick = () => {
    const activeCaravansCount = GameState.system.getActiveMissions().filter(m => m.task.type === TaskType.TRADE).length;
    const maxAllowed = getMaxCaravansLimit(territory.title);
    if (activeCaravansCount >= maxAllowed) {
      ToastManager.show(`行商序列已達上限！當前爵位【${territory.title}】最多同時派遣 ${maxAllowed} 個商隊。`);
      return;
    }

    if (selectedAdventurersForCaravan.size === 0) {
      ToastManager.show('請至少指派一名傭兵來護送商隊！');
      return;
    }

    const assignedAdvs = GameState.adventurers.filter(a => selectedAdventurersForCaravan.has(a.id));
    const urCount = assignedAdvs.filter(a => a.quality === 'UR').length;
    if (urCount > 1) {
      ToastManager.show('⚠️ 戰鬥隊伍限制：每場戰鬥最多只能編入 1 位 UR 品質傭兵！');
      return;
    }

    let totalCapacity = 0;
    GameState.adventurers.forEach(adv => {
      if (selectedAdventurersForCaravan.has(adv.id)) {
        totalCapacity += adv.getTradeStats().maxCargoWeight;
      }
    });

    let cargoWeightOut = 0;
    const finalCargoOut: Record<string, number> = {};
    for (const [gId, amount] of Object.entries(selectedCargoToSell)) {
      if (amount > 0) {
        if ((tradeInventory[gId] || 0) < amount) {
          ToastManager.show(`領地內的【${gId}】庫存不足！`);
          return;
        }
        cargoWeightOut += amount;
        finalCargoOut[gId] = amount;
      }
    }

    const inputGold = parseInt(goldInput.value) || 0;
    if (inputGold > territory.gold) {
      ToastManager.show('領地金幣不足以支付採購本金！');
      return;
    }

    const selBuyGoodId = buySelect.value;
    const wantBuyAmount = parseInt(buyAmountInput.value) || 0;
    const maxTripWeight = Math.max(cargoWeightOut, wantBuyAmount);

    if (maxTripWeight > totalCapacity) {
      ToastManager.show(`商隊載重超限！當前護衛最大載重為 ${totalCapacity} 單位。`);
      return;
    }

    // 扣除領地裝載的貨物與採購金幣
    territory.gold -= inputGold;
    for (const [gId, amt] of Object.entries(finalCargoOut)) {
      territory.tradeInventory[gId] -= amt;
    }

    // 建立指令
    const buyList = selBuyGoodId && wantBuyAmount > 0 ? [{ goodId: selBuyGoodId, maxAmount: wantBuyAmount }] : [];
    const sellList = Object.keys(finalCargoOut);

    const instructions: TradeInstruction[] = [{
      nodeId: targetNode.id,
      buy: buyList,
      sell: sellList
    }];

    const taskName = `單線商隊 (${targetNode.name})`;
    const task = new DispatchTask(taskName, TaskType.TRADE, outboundTiming.adjustedDays, 0, 0, 0, 0, EnemyFeature.BALANCED);
    task.tradeRouteNodeIds = [targetNode.id];
    task.tradeItineraryNodeIds = [targetNode.id];
    task.currentLegIndex = 0;
    task.currentRouteIndex = 0;
    task.tradePhase = TradePhase.OUTBOUND;
    task.tradeInstructions = instructions;
    task.caravanGold = inputGold;
    task.initialCaravanGold = inputGold;
    task.caravanCargo = finalCargoOut;

    GameState.system.dispatchAdventurers(assignedAdvs, task);

    modal.style.display = 'none';
    closeNodeDetailPanel();
    UIManager.updateUI();
    ToastManager.show(`🚀 商隊已啟程前往【${targetNode.name}】！預計 ${outboundTiming.adjustedDays} 天後抵達。`, 'success');
  };
}

export function openTradeModal(node: MapNode) {
  const tradeModal = document.getElementById('modal-trade')!;
  const invContainer = (document.getElementById('player-trade-inventory') || document.getElementById('trade-inventory'))!;
  const marketContainer = (document.getElementById('target-market-goods') || document.getElementById('trade-market'))!;

  const territory = GameState.myTerritory;
  const inventoryHtml = Object.entries(territory.tradeInventory || {})
    .filter(([_, count]) => count > 0)
    .map(([goodId, count]) => {
      const goodRef = TRADE_GOODS.find(g => g.id === goodId);
      const name = goodRef ? `${goodRef.icon || '📦'} ${goodRef.name}` : goodId;
      return `<div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 6px 10px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                <span>${name}</span>
                <span style="color:#fbbf24; font-weight:bold;">x${count}</span>
              </div>`;
    }).join('');
  invContainer.innerHTML = inventoryHtml || '<p style="color:#94a3b8; font-size:0.85em; text-align:center;">領地倉庫無特產庫存</p>';

  marketContainer.innerHTML = '';
  if (node.marketData && node.marketData.goods.length > 0) {
    let html = '';
    if (node.marketData.demandEvent) {
      html += `<div style="padding: 8px 12px; margin-bottom: 10px; background: rgba(239,68,68,0.2); border-left: 4px solid #ef4444; border-radius: 4px;">
                 <strong style="color:#f87171;">🔥 突發需求事件！</strong><br/>
                 <span style="font-size:0.85em; color:#e2e8f0;">${node.marketData.demandEvent.description}</span>
               </div>`;
    }
    
    html += node.marketData.goods.map(item => {
      const goodRef = TRADE_GOODS.find(g => g.id === item.goodId);
      const goodName = goodRef ? `${goodRef.icon || '📦'} ${goodRef.name}` : item.goodId;
      const isDemanded = node.marketData!.demandEvent?.goodId === item.goodId;
      const highlight = isDemanded ? 'color: #f87171; font-weight: bold;' : '';
      
      return `<div style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 6px 10px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                <span style="${highlight}">${goodName}${isDemanded ? ' (熱銷中)' : ''}</span>
                <span style="${highlight}">買入: ${item.buyPrice}G / 賣出: ${item.sellPrice}G / 庫存: ${item.stock}</span>
              </div>`;
    }).join('');
    marketContainer.innerHTML = html;
  } else {
    marketContainer.innerHTML = '<p style="color:#94a3b8; font-size:0.85em; text-align:center;">市場今日無貨</p>';
  }

  tradeModal.style.display = 'flex';

  document.getElementById('btn-close-trade')!.onclick = () => {
    tradeModal.style.display = 'none';
  };

  const btnPlanRoute = document.getElementById('btn-plan-route')!;
  const btnDiplomacy = document.getElementById('btn-diplomacy')!;
  const titleMsg = document.getElementById('trade-modal-msg-title')!;
  const descMsg = document.getElementById('trade-modal-msg-desc')!;

  const faction = GameState.mapSystem.getFactions().find(f => f.id === node.ownerFactionId);
  const treaty = faction?.tradeTreaty || TradeTreaty.NONE;

  if (treaty === TradeTreaty.NONE) {
    btnPlanRoute.style.display = 'none';
    btnDiplomacy.style.display = 'inline-block';
    titleMsg.textContent = '🤝 尚未建立通商條約';
    descMsg.textContent = `您與【${faction?.factionName || '未知勢力'}】尚未簽署通商條約，無法發起商隊。請派遣外交使節進行交涉。`;
    btnDiplomacy.onclick = () => {
      tradeModal.style.display = 'none';
      closeNodeDetailPanel();
      import('./ModalController').then(({ openDispatchSetup }) => {
        openDispatchSetup(node, 'diplomacy');
      });
    };
  } else {
    btnPlanRoute.style.display = 'inline-block';
    btnDiplomacy.style.display = 'none';
    titleMsg.textContent = treaty === TradeTreaty.ALLIED ? '🤝 免稅貿易協定生效中' : '🤝 基礎通商條約生效中';
    descMsg.textContent = '單線跑商：派遣商隊前往此地，可載運領地物資賣出換錢，並採購當地特產運回領地。';
    
    btnPlanRoute.onclick = () => {
      tradeModal.style.display = 'none';
      closeNodeDetailPanel();
      openTradePlanner([node.id]);
    };
  }
}
