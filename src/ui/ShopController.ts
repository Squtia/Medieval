/**
 * ShopController.ts
 * 負責武器店、防具店、領地鍛造屋 (100% 滿版全螢幕 Layout、傭兵小隊 3 欄網格、PATK/MATK 屬性與指標跟隨懸浮 Tooltip) 與倉庫介面的渲染與互動邏輯。
 * 從 ModalController.ts 拆分出來作為 Lazy Chunk，降低首屏 bundle 體積。
 */

import { ToastManager } from './ToastManager';
import { GameState } from '../core/GameState';
import { UIManager } from './UIManager';
import { DataStore } from '../systems/DataStore';
import { EquipmentGenerator } from '../systems/EquipmentGenerator';
import { EnhancementSystem } from '../systems/EnhancementSystem';
import { EquipmentSlot, ElementType, Equipment, CombatStats } from '../models/types';
import { TRADE_GOODS } from '../systems/MarketSystem';
import { positionFloatingElement } from './FloatingPosition';
import materialsJson from '../data/materials.json';



// === 輔助懸浮 Tooltip 綁定器 (跟隨滑鼠移動) ===

export function attachTooltip(element: HTMLElement, getHtml: () => string) {
  element.addEventListener('mouseenter', (e) => {
    const tEl = document.getElementById('adv-tooltip');
    if (tEl) {
      tEl.innerHTML = getHtml();
      tEl.style.opacity = '1';
      positionFloatingElement(tEl, e.clientX, e.clientY);
    }
  });
  element.addEventListener('mousemove', (e) => {
    const tEl = document.getElementById('adv-tooltip');
    if (tEl) {
      positionFloatingElement(tEl, e.clientX, e.clientY);
    }
  });
  element.addEventListener('mouseleave', () => {
    const tEl = document.getElementById('adv-tooltip');
    if (tEl) {
      tEl.style.opacity = '0';
    }
  });
  element.addEventListener('click', () => {
    const tEl = document.getElementById('adv-tooltip');
    if (tEl) {
      tEl.style.opacity = '0';
    }
  });
}

import { renderEquipIcon as helperRenderEquipIcon, ICON_SIZE } from './IconSpriteHelper';
export { ICON_SIZE };

export function renderEquipIcon(eq: any, sizePx: number = ICON_SIZE.MD): string {
  return helperRenderEquipIcon(eq, sizePx);
}

export function getEquipTooltipHtml(eq: any): string {
  const name = eq.name || '未知裝備';
  const lvl = eq.enhancementLevel ? ` +${eq.enhancementLevel}` : '';
  const tier = eq.tier ? ` (T${eq.tier})` : '';
  const jobs = eq.allowedJobs ? eq.allowedJobs.join('/') : '通用';
  const elemBadge = getElementBadge(eq.element);
  const statsStr = formatStatsTags(eq.combatEffects || eq.baseCombatEffects, eq.effects || eq.baseEffects);
  const iconHtml = renderEquipIcon(eq, 32);

  return `
    <div style="padding:10px 12px; max-width:260px; line-height:1.4;">
      <div style="font-weight:bold; color:#eab308; font-size:1.05em; border-bottom:1px solid rgba(217,119,6,0.3); padding-bottom:4px; margin-bottom:6px; display:flex; align-items:center; gap:6px;">
        ${iconHtml} <span>${name}${lvl}${tier}</span>
      </div>
      <div style="font-size:0.82em; color:#94a3b8; margin-bottom:4px;">
        屬性：${elemBadge} | 職業：${jobs}
      </div>
      <div style="font-size:0.85em; color:#cbd5e1; margin-top:6px; background:rgba(0,0,0,0.4); padding:6px; border-radius:4px;">
        <strong>戰鬥效果：</strong><br/>${statsStr}
      </div>
      <div style="font-size:0.85em; color:#fbbf24; margin-top:6px; background:rgba(0,0,0,0.4); padding:6px; border-radius:4px;">
        <strong>武器屬性：</strong><br/>${formatScalingTags(eq.scaling)}
      </div>
    </div>
  `;
}

/**
 * 渲染單張裝備卡片內容 (用於雙欄對比 Tooltip)
 */
export function renderSingleEquipCardHtml(eq: any, headerTitle: string, isCurrent: boolean): string {
  if (!eq) {
    return `
      <div style="width:215px; min-width:215px; box-sizing:border-box; background:rgba(0,0,0,0.45); border:1px dashed rgba(255,255,255,0.2); border-radius:6px; padding:10px; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
        <div style="font-weight:bold; color:#94a3b8; font-size:0.88em; margin-bottom:8px;">${headerTitle}</div>
        <div style="color:#64748b; font-size:0.82em; font-style:italic;">(未穿戴任何裝備)</div>
      </div>
    `;
  }

  const name = eq.name || '未知裝備';
  const lvl = eq.enhancementLevel ? ` +${eq.enhancementLevel}` : '';
  const tier = eq.tier ? ` (T${eq.tier})` : '';
  const jobs = eq.allowedJobs ? eq.allowedJobs.join('/') : '通用';
  const elemBadge = getElementBadge(eq.element);
  const statsStr = formatStatsTags(eq.combatEffects || eq.baseCombatEffects, eq.effects || eq.baseEffects);
  const iconHtml = renderEquipIcon(eq, 24);
  const headerColor = isCurrent ? '#94a3b8' : '#38bdf8';
  const borderColor = isCurrent ? 'rgba(148, 163, 184, 0.3)' : 'rgba(56, 189, 248, 0.4)';

  return `
    <div style="width:215px; min-width:215px; box-sizing:border-box; background:rgba(0,0,0,0.5); border:1px solid ${borderColor}; border-radius:6px; padding:8px 10px; display:flex; flex-direction:column; gap:4px; text-align:left;">
      <div style="font-size:0.78em; font-weight:bold; color:${headerColor}; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:3px; display:flex; justify-content:space-between; align-items:center;">
        <span>${headerTitle}</span>
        <span style="font-size:0.9em;">${elemBadge}</span>
      </div>
      <div style="font-weight:bold; color:#eab308; font-size:0.92em; display:flex; align-items:center; gap:5px; margin-top:2px;">
        ${iconHtml} <span style="line-height:1.2;">${name}${lvl}${tier}</span>
      </div>
      <div style="font-size:0.74em; color:#94a3b8;">
        職業：${jobs}
      </div>
      <div style="font-size:0.78em; color:#cbd5e1; background:rgba(0,0,0,0.4); padding:5px 6px; border-radius:4px; margin-top:2px;">
        <strong style="color:#fbbf24;">戰鬥效果：</strong><br/>${statsStr}
      </div>
      <div style="font-size:0.78em; color:#fbbf24; background:rgba(0,0,0,0.4); padding:5px 6px; border-radius:4px; margin-top:2px;">
        <strong style="color:#fbbf24;">武器屬性：</strong><br/>${formatScalingTags(eq.scaling)}
      </div>
    </div>
  `;
}

/**
 * 取得傭兵裝備雙欄比較 Tooltip HTML (支援戰力變動預覽)
 */
export function getEquipComparisonTooltipHtml(adv: any, slotKey: any, targetEq: any): string {
  if (!adv || !targetEq) {
    return getEquipTooltipHtml(targetEq);
  }

  const currentEq = adv.equipment ? adv.equipment[slotKey] : null;
  const currentPower = typeof adv.getPower === 'function' ? adv.getPower() : (adv.power || 0);

  // 暫存並模擬置換裝備計算新戰力
  let newPower = currentPower;
  if (adv.equipment && typeof adv.getPower === 'function') {
    const savedEq = adv.equipment[slotKey];
    adv.equipment[slotKey] = targetEq;
    newPower = adv.getPower();
    adv.equipment[slotKey] = savedEq;
  }

  const powerDiff = newPower - currentPower;
  let powerDiffBadge = '';
  if (powerDiff > 0) {
    powerDiffBadge = `<span style="color:#22c55e; font-weight:bold;">(+${powerDiff} 戰力提升 🟢)</span>`;
  } else if (powerDiff < 0) {
    powerDiffBadge = `<span style="color:#ef4444; font-weight:bold;">(${powerDiff} 戰力下降 🔴)</span>`;
  } else {
    powerDiffBadge = `<span style="color:#94a3b8; font-weight:bold;">(戰力持平 ⚪)</span>`;
  }

  const leftCardHtml = renderSingleEquipCardHtml(currentEq, '🛡️【當前穿戴】', true);
  const rightCardHtml = renderSingleEquipCardHtml(targetEq, '✨【選中裝備】', false);

  return `
    <div style="display:flex; flex-direction:column; width:440px; box-sizing:border-box; line-height:1.35; font-family:sans-serif;">
      <!-- 頂部：傭兵與戰力預覽條 -->
      <div style="width:100%; box-sizing:border-box; background:rgba(0,0,0,0.65); padding:6px 10px; border-radius:6px; margin-bottom:6px; border:1px solid rgba(217,119,6,0.35); text-align:center;">
        <div style="font-weight:bold; color:#f8fafc; font-size:0.9em;">
          👤 ${adv.name} <span style="color:#94a3b8; font-size:0.85em;">(Lv.${adv.level} ${adv.job?.name || ''})</span>
        </div>
        <div style="font-size:0.84em; margin-top:2px;">
          戰力評估：<span style="color:#cbd5e1;">${currentPower}</span> ➔ <span style="color:${powerDiff >= 0 ? '#22c55e' : '#ef4444'}; font-weight:bold;">${newPower}</span> ${powerDiffBadge}
        </div>
      </div>

      <!-- 中段：雙欄並排對比 (左: 當前穿戴, 右: 選中目標) -->
      <div style="display:flex; gap:8px; justify-content:center; align-items:stretch; width:100%; box-sizing:border-box;">
        ${leftCardHtml}
        ${rightCardHtml}
      </div>
    </div>
  `;
}

// === 鍛造屋主視圖全功能實作 (對齊領主書房與傭兵小隊 3 欄網格) ===



/**
 * 格式化雙攻雙防與衍生屬性標籤 (依據 ATTRIBUTE_SYSTEM.md 規範)
 */
export function formatScalingTags(scaling?: any): string {
  if (!scaling) return '<span style="color:#64748b;">(無特殊屬性，使用基礎保底)</span>';
  const parts: string[] = [];
  
  if (scaling.patk) {
     for(const [attr, tier] of Object.entries(scaling.patk)) {
        let color = '#ef4444'; // 紅色
        if (tier === 'S' || tier === 'A') color = '#facc15'; // 黃色
        parts.push(`<span style="display:inline-block; white-space:nowrap; color:${color}; font-weight:bold; margin:1px 1px;">⚔️${attr.toUpperCase()}(${tier})</span>`);
     }
  }
  if (scaling.matk) {
     for(const [attr, tier] of Object.entries(scaling.matk)) {
        let color = '#3b82f6';
        if (tier === 'S' || tier === 'A') color = '#facc15';
        parts.push(`<span style="display:inline-block; white-space:nowrap; color:${color}; font-weight:bold; margin:1px 1px;">🔮${attr.toUpperCase()}(${tier})</span>`);
     }
  }
  if (scaling.pdef) {
     for(const [attr, tier] of Object.entries(scaling.pdef)) {
        let color = '#10b981';
        if (tier === 'S' || tier === 'A') color = '#facc15';
        parts.push(`<span style="display:inline-block; white-space:nowrap; color:${color}; font-weight:bold; margin:1px 1px;">🛡️${attr.toUpperCase()}(${tier})</span>`);
     }
  }
  if (scaling.mdef) {
     for(const [attr, tier] of Object.entries(scaling.mdef)) {
        let color = '#8b5cf6';
        if (tier === 'S' || tier === 'A') color = '#facc15';
        parts.push(`<span style="display:inline-block; white-space:nowrap; color:${color}; font-weight:bold; margin:1px 1px;">✨${attr.toUpperCase()}(${tier})</span>`);
     }
  }
  return parts.length > 0 ? parts.join(' | ') : '<span style="color:#64748b;">(無特殊屬性)</span>';
}

/**
 * 格式化雙攻雙防與衍生屬性標籤 (依據 ATTRIBUTE_SYSTEM.md 規範)
 */
export function formatStatsTags(cb?: Partial<CombatStats>, eff?: any): string {
  const parts: string[] = [];
  if (!cb) cb = {};
  if (!eff) eff = {};

  if (cb.patk) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#ef4444; font-weight:bold;">⚔️物攻+${cb.patk}</span>`);
  if (cb.matk) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#3b82f6; font-weight:bold;">🔮魔攻+${cb.matk}</span>`);
  if (cb.pdef) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#10b981; font-weight:bold;">🛡️物防+${cb.pdef}</span>`);
  if (cb.mdef) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#8b5cf6; font-weight:bold;">✨魔防+${cb.mdef}</span>`);
  if (cb.hit) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#f59e0b;">🎯命中+${cb.hit}</span>`);
  if (cb.evade) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#06b6d4;">🌀閃避+${cb.evade}</span>`);
  if (cb.hp) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#ec4899;">❤️HP+${cb.hp}</span>`);
  if (cb.mp) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#6366f1;">💧MP+${cb.mp}</span>`);
  if (cb.critRate) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#f97316;">💥爆擊+${cb.critRate}%</span>`);

  for (const [k, v] of Object.entries(eff)) {
    if (v) parts.push(`<span style="display:inline-block; white-space:nowrap; color:#e2e8f0;">${k.toUpperCase()}+${v}</span>`);
  }

  return parts.join(' | ') || '無加成';
}

export function getElementBadge(elem?: ElementType): string {
  switch (elem) {
    case ElementType.FIRE: return '<span style="color:#ef4444; font-weight:bold;">🔥 火</span>';
    case ElementType.ICE: return '<span style="color:#38bdf8; font-weight:bold;">❄️ 冰</span>';
    case ElementType.LIGHTNING: return '<span style="color:#eab308; font-weight:bold;">⚡ 雷</span>';
    case ElementType.HOLY: return '<span style="color:#fef08a; font-weight:bold;">☀️ 光</span>';
    case ElementType.DARK: return '<span style="color:#a855f7; font-weight:bold;">🌙 暗</span>';
    default: return '<span style="color:#64748b;">無</span>';
  }
}

// ----------------------------------------------------------------------------
// 1. 裝備強化模式 (對齊圖一傭兵小隊 3 欄網格選單 + 指標跟隨懸浮 Tooltip + 右欄工坊)
// ----------------------------------------------------------------------------



// ----------------------------------------------------------------------------
// 2. 裝備鍛造 & 3. 裝備重鑄模式 (100% 完全對齊截圖一排版 + 標籤精密過濾)
// ----------------------------------------------------------------------------







// ----------------------------------------------------------------------------
// 4. 元素加工與附魔模式 (左欄 3 欄傭兵網格卡片 + 右欄 5 大元素石對齊圖三)
// ----------------------------------------------------------------------------



// ----------------------------------------------------------------------------
// 5. 素材與背包模式 (半透明雙欄 Layout)
// ----------------------------------------------------------------------------

/**
 * 取得特產/交易品庫存 (打通基礎四大資源與交易品特產)
 */
export function getTradeGoodStock(territory: any, goodId: string): number {
  if (goodId === 'tg_timber') return territory.wood || 0;
  if (goodId === 'tg_iron') return territory.iron || 0;
  if (goodId === 'tg_stone') return territory.stone || 0;
  if (goodId === 'tg_wheat') return territory.food || 0;
  return (territory.tradeInventory && territory.tradeInventory[goodId]) || 0;
}

/**
 * 消耗特產/交易品庫存 (打通基礎四大資源與交易品特產)
 */
export function consumeTradeGoodStock(territory: any, goodId: string, count: number): void {
  if (goodId === 'tg_timber') { territory.wood = Math.max(0, (territory.wood || 0) - count); return; }
  if (goodId === 'tg_iron') { territory.iron = Math.max(0, (territory.iron || 0) - count); return; }
  if (goodId === 'tg_stone') { territory.stone = Math.max(0, (territory.stone || 0) - count); return; }
  if (goodId === 'tg_wheat') { territory.food = Math.max(0, (territory.food || 0) - count); return; }
  if (territory.tradeInventory && territory.tradeInventory[goodId]) {
    territory.tradeInventory[goodId] = Math.max(0, territory.tradeInventory[goodId] - count);
  }
}

/**
 * 增加特產/交易品庫存 (打通基礎四大資源與交易品特產)
 */
export function addTradeGoodStock(territory: any, goodId: string, count: number): void {
  if (goodId === 'tg_timber') { territory.wood = (territory.wood || 0) + count; return; }
  if (goodId === 'tg_iron') { territory.iron = (territory.iron || 0) + count; return; }
  if (goodId === 'tg_stone') { territory.stone = (territory.stone || 0) + count; return; }
  if (goodId === 'tg_wheat') { territory.food = (territory.food || 0) + count; return; }
  if (!territory.tradeInventory) territory.tradeInventory = {};
  territory.tradeInventory[goodId] = (territory.tradeInventory[goodId] || 0) + count;
}

export function getMaterialCount(territory: any, matId: string): number {
  if (matId.startsWith('tg_')) {
    return getTradeGoodStock(territory, matId);
  }
  // 檢查加工素材庫存 materials
  if (territory.materials && territory.materials[matId] !== undefined) {
    return territory.materials[matId] || 0;
  }
  return 0;
}

export function consumeMaterial(territory: any, matId: string, count: number): void {
  if (matId.startsWith('tg_')) {
    consumeTradeGoodStock(territory, matId, count);
    return;
  }
  if (territory.materials && territory.materials[matId]) {
    territory.materials[matId] = Math.max(0, territory.materials[matId] - count);
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

  const allTemplates = Object.values(DataStore.EquipmentDB);
  const weapons = allTemplates.filter(t => t.id !== 'wpn_heirloom_sword' && t.shopBuyable !== false && t.slot === EquipmentSlot.WEAPON && (t.tier === undefined || t.tier <= 2));

  weapons.forEach(wpn => {
    const price = DataStore.EquipmentPriceDB[wpn.id] || 0;
    const canBuy = territory.gold >= price;

    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '15px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:6px;">
            ${renderEquipIcon(wpn, 28)}
            <strong style="color: #eab308; font-size: 1.1em;">${wpn.name}</strong>
          </div>
          <span style="font-size:0.8em; color:#94a3b8;">${wpn.weaponType || '武器'}</span>
        </div>
        <div style="font-size: 0.85em; color: #cbd5e1; margin-bottom: 6px;">
          限制：${wpn.allowedJobs ? wpn.allowedJobs.join('/') : '無限制'}
        </div>
        <div style="font-size: 0.85em; color: #34d399; margin-bottom: 12px;">
          效果：${formatStatsTags(wpn.baseCombatEffects, wpn.baseEffects)}
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
        <span style="color: #fbbf24; font-weight: bold;">💰 ${price} 金幣</span>
        <button class="action-btn btn-buy-weapon" data-id="${wpn.id}" data-price="${price}" style="padding: 4px 12px; font-size: 0.85em;" ${canBuy ? '' : 'disabled'}>
          ${canBuy ? '購買' : '金幣不足'}
        </button>
      </div>
    `;
    shopList.appendChild(card);
  });

  shopList.querySelectorAll('.btn-buy-weapon').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id')!;
      const price = parseInt((e.currentTarget as HTMLElement).getAttribute('data-price')!);

      if (territory.gold >= price) {
        territory.gold -= price;
        const newEq = EquipmentGenerator.generate(id);
        if (newEq) {
          territory.warehouse.push(newEq);
          ToastManager.show(`🛒 購買成功！【${newEq.name}】已放入領地倉庫。`, 'success');
          UIManager.updateUI();
          renderWeaponShop();
        }
      }
    });
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

  const allTemplates = Object.values(DataStore.EquipmentDB);
  const armors = allTemplates.filter(t => t.shopBuyable !== false && t.slot === EquipmentSlot.ARMOR && (t.tier === undefined || t.tier <= 2));

  armors.forEach(arm => {
    const price = DataStore.EquipmentPriceDB[arm.id] || 0;
    const canBuy = territory.gold >= price;

    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '15px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.justifyContent = 'space-between';

    card.innerHTML = `
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:6px;">
            ${renderEquipIcon(arm, 28)}
            <strong style="color: #eab308; font-size: 1.1em;">${arm.name}</strong>
          </div>
          <span style="font-size:0.8em; color:#94a3b8;">${arm.armorType || '防具'}</span>
        </div>
        <div style="font-size: 0.85em; color: #cbd5e1; margin-bottom: 6px;">
          限制：${arm.allowedJobs ? arm.allowedJobs.join('/') : '無限制'}
        </div>
        <div style="font-size: 0.85em; color: #34d399; margin-bottom: 12px;">
          效果：${formatStatsTags(arm.baseCombatEffects, arm.baseEffects)}
        </div>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
        <span style="color: #fbbf24; font-weight: bold;">💰 ${price} 金幣</span>
        <button class="action-btn btn-buy-armor" data-id="${arm.id}" data-price="${price}" style="padding: 4px 12px; font-size: 0.85em;" ${canBuy ? '' : 'disabled'}>
          ${canBuy ? '購買' : '金幣不足'}
        </button>
      </div>
    `;
    shopList.appendChild(card);
  });

  shopList.querySelectorAll('.btn-buy-armor').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id')!;
      const price = parseInt((e.currentTarget as HTMLElement).getAttribute('data-price')!);

      if (territory.gold >= price) {
        territory.gold -= price;
        const newEq = EquipmentGenerator.generate(id);
        if (newEq) {
          territory.warehouse.push(newEq);
          ToastManager.show(`🛒 購買成功！【${newEq.name}】已放入領地倉庫。`, 'success');
          UIManager.updateUI();
          renderArmorShop();
        }
      }
    });
  });
}

// === 自宅獨立總倉庫 (Home Base Warehouse) 功能與 5 欄正方形網格實作 ===









export function renderForgeView() {
  import('./components/ForgeUIController').then(m => m.ForgeUIController.getInstance().renderForgeView());
}
export function openWarehouse(isForgeMode: boolean) {
  import('./components/ForgeUIController').then(m => m.ForgeUIController.getInstance().openWarehouse(isForgeMode));
}
export function openHomeWarehouse() {
  import('./components/ForgeUIController').then(m => m.ForgeUIController.getInstance().openHomeWarehouse());
}
