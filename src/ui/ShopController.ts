/**
 * ShopController.ts
 * 負責武器店、防具店與倉庫介面的渲染與互動邏輯。
 * 從 ModalController.ts 拆分出來作為 Lazy Chunk，降低首屏 bundle 體積。
 */

import { ToastManager } from './ToastManager';
import { GameState } from '../core/GameState';
import { UIManager } from './UIManager';
import { DataStore } from '../systems/DataStore';
import { EquipmentGenerator } from '../systems/EquipmentGenerator';
import { EnhancementSystem } from '../systems/EnhancementSystem';
import { EquipmentSlot } from '../models/types';
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

export function renderWarehouseGoods() {
  const goodsContainer = document.getElementById('warehouse-goods-panel')!;
  const myTerritory = GameState.myTerritory;
  
  goodsContainer.innerHTML = '';
  
  const inventory = myTerritory.tradeInventory || {};
  const goodIds = Object.keys(inventory).filter(id => inventory[id] > 0);
  
  if (goodIds.length === 0) {
    goodsContainer.innerHTML = '<p style="color:#94a3b8; text-align: center; padding: 20px;">跑商倉庫目前沒有貨物。派遣商隊後貨物會存放在這裡。</p>';
    return;
  }
  
  // 總資產提示
  let totalAssetValue = 0;
  const rows: string[] = [];
  
  for (const goodId of goodIds) {
    const amount = inventory[goodId];
    const goodDef = TRADE_GOODS.find(g => g.id === goodId);
    if (!goodDef || amount <= 0) continue;
    
    const sellPrice = Math.floor(goodDef.basePrice * 0.8); // 本地收購折扣 80%
    const totalValue = sellPrice * amount;
    totalAssetValue += totalValue;
    
    rows.push(`
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px;">
        <div>
          <strong style="color: #e2e8f0;">${goodDef.icon || '📦'} ${goodDef.name}</strong>
          <span style="color: #94a3b8; margin-left: 10px;">x ${amount}</span><br/>
          <span style="font-size: 0.8em; color: #94a3b8;">本地售價：${sellPrice} 金/件（原價 ${goodDef.basePrice}）</span>
        </div>
        <div style="text-align: right;">
          <div style="color: #fbbf24; font-weight: bold; margin-bottom: 5px;">≈ ${totalValue} 金</div>
          <button class="action-btn btn-sell-good" data-id="${goodId}" data-price="${sellPrice}" style="padding: 4px 12px; font-size: 0.85em;">💰 全部出售</button>
        </div>
      </div>
    `);
  }
  
  goodsContainer.innerHTML = `
    <div style="color: #94a3b8; font-size: 0.85em; margin-bottom: 12px; padding: 8px; background: rgba(251,191,36,0.1); border-radius: 6px; border-left: 3px solid #fbbf24;">
      💰 貨物總資產估值：<strong style="color: #fbbf24;">${totalAssetValue} 金幣</strong>（按本地收購價 80% 計算）
    </div>
    ${rows.join('')}
    <button class="action-btn btn-sell-all-goods" style="width: 100%; margin-top: 10px; background: linear-gradient(135deg, #059669, #065f46);">
      🏪 一鍵全部出售（獲得 ${totalAssetValue} 金幣）
    </button>
  `;
  
  // 綁定單項出售
  goodsContainer.querySelectorAll('.btn-sell-good').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const goodId = (e.currentTarget as HTMLElement).getAttribute('data-id')!;
      const price = parseInt((e.currentTarget as HTMLElement).getAttribute('data-price')!);
      const amount = myTerritory.tradeInventory[goodId] || 0;
      const revenue = price * amount;
      myTerritory.addGold(revenue);
      myTerritory.tradeInventory[goodId] = 0;
      console.log(`💰 [跑商收益] 出售了 ${amount} 件貨物，獲得 ${revenue} 金幣！`);
      UIManager.updateUI();
      renderWarehouseGoods();
    });
  });
  
  // 綁定一鍵全部出售
  const btnSellAll = goodsContainer.querySelector('.btn-sell-all-goods');
  if (btnSellAll) {
    btnSellAll.addEventListener('click', () => {
      let total = 0;
      for (const goodId of Object.keys(myTerritory.tradeInventory)) {
        const amount = myTerritory.tradeInventory[goodId] || 0;
        const goodDef = TRADE_GOODS.find(g => g.id === goodId);
        if (!goodDef || amount <= 0) continue;
        const sellPrice = Math.floor(goodDef.basePrice * 0.8);
        total += sellPrice * amount;
        myTerritory.tradeInventory[goodId] = 0;
      }
      myTerritory.addGold(total);
      console.log(`💰 [跑商收益] 一鍵出售全部貨物，獲得 ${total} 金幣！`);
      UIManager.updateUI();
      renderWarehouseGoods();
    });
  }
}

export function renderWeaponShop() {
  const shopList = document.getElementById('weapon-shop-list');
  const shopLvlEl = document.getElementById('ui-weapon-shop-lvl');
  if (!shopList || !shopLvlEl) return;

  const territory = GameState.myTerritory;
  const lvl = territory.weaponShopLevel || 0;
  shopLvlEl.textContent = lvl.toString();
  shopList.innerHTML = '';

  if (lvl <= 0) {
    shopList.style.display = 'block';
    shopList.innerHTML = `
      <div style="grid-column: span 3; text-align: center; color: #f87171; font-size: 1.2em; padding: 40px 0; background: rgba(0,0,0,0.3); border-radius: 8px;">
        ⚠️ 武器店尚未建造！請至領主書房（自宅）的「領地建築升級」面板進行建造。
      </div>
    `;
    return;
  }
  shopList.style.display = 'grid';

  const allowedItemLevels: number[] = [];
  if (lvl >= 1) allowedItemLevels.push(10);
  if (lvl >= 2) allowedItemLevels.push(25);
  if (lvl >= 3) allowedItemLevels.push(50);

  const allTemplates = Object.values(DataStore.EquipmentDB);
  const weapons = allTemplates.filter(t => t.slot === EquipmentSlot.WEAPON && allowedItemLevels.includes(t.itemLevel));

  weapons.forEach(wpn => {
    const price = DataStore.EquipmentPriceDB[wpn.id] || 0;
    const canBuy = territory.gold >= price;
    
    let reqs = '';
    for (const [k, v] of Object.entries(wpn.baseRequirements)) {
      reqs += `${k.toUpperCase()}:${v} `;
    }
    let effs = '';
    for (const [k, v] of Object.entries(wpn.baseEffects)) {
      effs += `${k.toUpperCase()}:+${v} `;
    }
    for (const [k, v] of Object.entries(wpn.baseCombatEffects)) {
      effs += `${k.toUpperCase()}:+${v} `;
    }

    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '15px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';
    card.style.background = 'rgba(0,0,0,0.4)';
    card.style.borderRadius = '8px';
    card.style.border = '1px solid rgba(255,255,255,0.05)';

    card.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <div style="font-size: 1.8em; margin-bottom: 5px; text-align: center;">${wpn.icon || '⚔️'}</div>
        <div style="font-weight: bold; font-size: 1.1em; text-align: center; color: #fff; margin-bottom: 5px;">${wpn.name}</div>
        <div style="font-size: 0.8em; color: #f87171; margin-bottom: 5px; text-align: center;">需求: ${reqs || '無'}</div>
        <div style="font-size: 0.8em; color: #34d399; line-height: 1.4; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; flex: 1; display: flex; align-items: center; justify-content: center; text-align: center;">加成: ${effs}</div>
      </div>
      <button class="action-btn btn-buy-wpn" style="margin-top:15px; font-size: 0.9em; width:100%; background: ${canBuy ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.05)'};" ${canBuy ? '' : 'disabled'}>
        💰 購買 (${price} 金幣)
      </button>
    `;

    const buyBtn = card.querySelector('.btn-buy-wpn') as HTMLButtonElement;
    buyBtn.onclick = () => {
      if (territory.gold >= price) {
        territory.gold -= price;
        const eq = EquipmentGenerator.generate(wpn.id);
        if (eq) {
          territory.addEquipmentToWarehouse(eq);
          console.log(`[武器店] 💰 購買了【${wpn.name}】並放入了您的倉庫！`);
          ToastManager.show(`成功購買【${wpn.name}】！`);
          renderWeaponShop();
          UIManager.updateUI();
        }
      }
    };

    shopList.appendChild(card);
  });
}

export function renderArmorShop() {
  const shopList = document.getElementById('armor-shop-list');
  const shopLvlEl = document.getElementById('ui-armor-shop-lvl');
  if (!shopList || !shopLvlEl) return;

  const territory = GameState.myTerritory;
  const lvl = territory.armorShopLevel || 0;
  shopLvlEl.textContent = lvl.toString();
  shopList.innerHTML = '';

  if (lvl <= 0) {
    shopList.style.display = 'block';
    shopList.innerHTML = `
      <div style="grid-column: span 3; text-align: center; color: #f87171; font-size: 1.2em; padding: 40px 0; background: rgba(0,0,0,0.3); border-radius: 8px;">
        ⚠️ 防具店尚未建造！請至領主書房（自宅）的「領地建築升級」面板進行建造。
      </div>
    `;
    return;
  }
  shopList.style.display = 'grid';

  const allowedItemLevels: number[] = [];
  if (lvl >= 1) { allowedItemLevels.push(8); allowedItemLevels.push(10); }
  if (lvl >= 2) { allowedItemLevels.push(22); allowedItemLevels.push(25); }
  if (lvl >= 3) { allowedItemLevels.push(45); allowedItemLevels.push(50); }

  const allTemplates = Object.values(DataStore.EquipmentDB);
  const armors = allTemplates.filter(t => t.slot === EquipmentSlot.ARMOR && allowedItemLevels.includes(t.itemLevel));

  armors.forEach(arm => {
    const price = DataStore.EquipmentPriceDB[arm.id] || 0;
    const canBuy = territory.gold >= price;
    
    let reqs = '';
    for (const [k, v] of Object.entries(arm.baseRequirements)) {
      reqs += `${k.toUpperCase()}:${v} `;
    }
    let effs = '';
    for (const [k, v] of Object.entries(arm.baseEffects)) {
      effs += `${k.toUpperCase()}:+${v} `;
    }
    for (const [k, v] of Object.entries(arm.baseCombatEffects)) {
      effs += `${k.toUpperCase()}:+${v} `;
    }

    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '15px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';
    card.style.background = 'rgba(0,0,0,0.4)';
    card.style.borderRadius = '8px';
    card.style.border = '1px solid rgba(255,255,255,0.05)';

    card.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%;">
        <div style="font-size: 1.8em; margin-bottom: 5px; text-align: center;">${arm.icon || '🛡️'}</div>
        <div style="font-weight: bold; font-size: 1.1em; text-align: center; color: #fff; margin-bottom: 5px;">${arm.name}</div>
        <div style="font-size: 0.8em; color: #f87171; margin-bottom: 5px; text-align: center;">需求: ${reqs || '無'}</div>
        <div style="font-size: 0.8em; color: #34d399; line-height: 1.4; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; flex: 1; display: flex; align-items: center; justify-content: center; text-align: center;">加成: ${effs}</div>
      </div>
      <button class="action-btn btn-buy-arm" style="margin-top:15px; font-size: 0.9em; width:100%; background: ${canBuy ? 'linear-gradient(135deg, #d97706, #b45309)' : 'rgba(255,255,255,0.05)'};" ${canBuy ? '' : 'disabled'}>
        💰 購買 (${price} 金幣)
      </button>
    `;

    const buyBtn = card.querySelector('.btn-buy-arm') as HTMLButtonElement;
    buyBtn.onclick = () => {
      if (territory.gold >= price) {
        territory.gold -= price;
        const eq = EquipmentGenerator.generate(arm.id);
        if (eq) {
          territory.addEquipmentToWarehouse(eq);
          console.log(`[防具店] 💰 購買了【${arm.name}】並放入了您的倉庫！`);
          ToastManager.show(`成功購買【${arm.name}】！`);
          renderArmorShop();
          UIManager.updateUI();
        }
      }
    };

    shopList.appendChild(card);
  });
}

(window as any).renderWeaponShop = renderWeaponShop;
(window as any).renderArmorShop = renderArmorShop;
