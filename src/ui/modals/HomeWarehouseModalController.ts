import { GameState } from '../../core/GameState';
import { DataStore } from '../../systems/DataStore';
import { TRADE_GOODS } from '../../systems/MarketSystem';
import { renderEquipIcon, ICON_SIZE, attachTooltip, getEquipTooltipHtml, getTradeGoodStock } from '../ShopController';
import { renderUniversalIcon } from '../IconSpriteHelper';
import materialsJson from '../../data/materials.json';

export class HomeWarehouseModalController {
  public static open(): void {
    const modal = document.getElementById('modal-base-warehouse');
    if (!modal) return;
    modal.classList.add('active');

    const btnClose = document.getElementById('btn-close-base-warehouse');
    if (btnClose) {
      btnClose.onclick = () => modal.classList.remove('active');
    }

    const tabEquip = document.getElementById('tab-base-warehouse-equip');
    const tabMats = document.getElementById('tab-base-warehouse-mats');
    const tabGoods = document.getElementById('tab-base-warehouse-goods');

    const panelEquip = document.getElementById('panel-base-warehouse-equip');
    const panelMats = document.getElementById('panel-base-warehouse-mats');
    const panelGoods = document.getElementById('panel-base-warehouse-goods');

    const setActiveTab = (activeTab: HTMLElement, activePanel: HTMLElement) => {
      [tabEquip, tabMats, tabGoods].forEach(t => {
        if (t) {
          t.style.background = 'rgba(0,0,0,0.3)';
          t.style.border = '1px solid rgba(255,255,255,0.1)';
          t.style.color = '#94a3b8';
        }
      });
      [panelEquip, panelMats, panelGoods].forEach(p => {
        if (p) p.style.display = 'none';
      });

      if (activeTab) {
        activeTab.style.background = 'rgba(234,179,8,0.2)';
        activeTab.style.border = '1px solid rgba(234,179,8,0.4)';
        activeTab.style.color = '#fbbf24';
      }
      if (activePanel) {
        activePanel.style.display = 'block';
      }
    };

    if (tabEquip) {
      tabEquip.onclick = () => {
        setActiveTab(tabEquip, panelEquip!);
        HomeWarehouseModalController.renderEquip();
      };
    }
    if (tabMats) {
      tabMats.onclick = () => {
        setActiveTab(tabMats, panelMats!);
        HomeWarehouseModalController.renderMats();
      };
    }
    if (tabGoods) {
      tabGoods.onclick = () => {
        setActiveTab(tabGoods, panelGoods!);
        HomeWarehouseModalController.renderGoods();
      };
    }

    if (tabEquip && panelEquip) {
      setActiveTab(tabEquip, panelEquip);
      HomeWarehouseModalController.renderEquip();
    }
  }

  private static renderEquip(): void {
    const grid = document.getElementById('grid-base-warehouse-equip');
    if (!grid) return;
    grid.innerHTML = '';

    const warehouse = GameState.myTerritory.warehouse;
    if (warehouse.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:#94a3b8; padding:30px;">倉庫內暫無儲備裝備</div>';
      return;
    }

    warehouse.forEach(eq => {
      const card = document.createElement('div');
      card.style.background = 'rgba(30, 24, 20, 0.8)';
      card.style.border = '1.5px solid rgba(217, 119, 6, 0.3)';
      card.style.borderRadius = '6px';
      card.style.padding = '4px 3px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.textAlign = 'center';
      card.style.justifyContent = 'space-between';
      card.style.cursor = 'pointer';
      card.style.width = '85px';
      card.style.height = '94px';
      card.style.flexShrink = '0';
      card.style.boxSizing = 'border-box';
      card.style.overflow = 'hidden';

      const iconHtml = renderEquipIcon(eq, ICON_SIZE.MD);
      const enhancementText = eq.enhancementLevel ? `+${eq.enhancementLevel}` : '+0';
      const tierText = `T${eq.tier || 1}`;

      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">${iconHtml}</div>
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.7em; padding:2px 3px 0; border-top:1px solid rgba(255,255,255,0.12); margin-top:2px;">
          <span style="color:#38bdf8; font-weight:bold;">${enhancementText}</span>
          <span style="color:#fbbf24; background:rgba(0,0,0,0.5); padding:1px 4px; border-radius:3px; border:1px solid rgba(251,191,36,0.3);">${tierText}</span>
        </div>
      `;

      attachTooltip(card, () => getEquipTooltipHtml(eq));
      grid.appendChild(card);
    });
  }

  private static renderMats(): void {
    const grid = document.getElementById('grid-base-warehouse-mats');
    if (!grid) return;
    grid.innerHTML = '';

    const materials = GameState.myTerritory.materials;
    const matKeys = Object.keys(materials).filter(k => (materials[k] || 0) > 0);

    if (matKeys.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:#94a3b8; padding:30px;">倉庫內暫無素材與附魔石</div>';
      return;
    }

    matKeys.forEach(matId => {
      const count = materials[matId] || 0;
      const matDef = DataStore.MaterialDB[matId] || { name: matId, icon: '🧲', description: '強化/附魔素材' };

      const card = document.createElement('div');
      card.style.background = 'rgba(30, 24, 20, 0.8)';
      card.style.border = '1.5px solid rgba(217, 119, 6, 0.3)';
      card.style.borderRadius = '6px';
      card.style.padding = '5px 4px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.textAlign = 'center';
      card.style.justifyContent = 'space-between';
      card.style.cursor = 'pointer';
      card.style.width = '85px';
      card.style.height = '94px';
      card.style.flexShrink = '0';
      card.style.boxSizing = 'border-box';

      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">${renderUniversalIcon(matDef.icon || '🧲', 36)}</div>
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.75em; padding:0 4px;">
          <span style="color:#e2e8f0; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:45px;">${matDef.name}</span>
          <span style="color:#fbbf24; font-weight:bold;">x${count}</span>
        </div>
      `;

      attachTooltip(card, () => `
        <div style="padding:8px; max-width:200px;">
          <div style="font-weight:bold; color:#fbbf24; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            ${renderUniversalIcon(matDef.icon || '🧲', 20)} <span>${matDef.name}</span>
          </div>
          <div style="font-size:0.8em; color:#cbd5e1;">${matDef.description || '鍛造與附魔必備物資'}</div>
          <div style="font-size:0.8em; color:#e2e8f0; margin-top:4px;">擁有數量：${count}</div>
        </div>
      `);
      grid.appendChild(card);
    });
  }

  private static renderGoods(): void {
    const grid = document.getElementById('grid-base-warehouse-goods');
    if (!grid) return;
    grid.innerHTML = '';

    const territory = GameState.myTerritory;
    const goodsWithStock = TRADE_GOODS
      .map(g => ({ g, count: getTradeGoodStock(territory, g.id) }))
      .filter(item => item.count > 0);

    if (goodsWithStock.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color:#94a3b8; padding:30px;">倉庫內暫無交易品物資</div>';
      return;
    }

    goodsWithStock.forEach(({ g, count }) => {
      const goodId = g.id;
      const matDef = materialsJson.find(m => m.id === goodId);
      const name = matDef ? matDef.name : g.name;
      const icon = matDef?.icon || g.icon || '📦';

      const card = document.createElement('div');
      card.style.background = 'rgba(30, 24, 20, 0.8)';
      card.style.border = '1.5px solid rgba(217, 119, 6, 0.3)';
      card.style.borderRadius = '6px';
      card.style.padding = '5px 4px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.textAlign = 'center';
      card.style.justifyContent = 'space-between';
      card.style.cursor = 'pointer';
      card.style.width = '85px';
      card.style.height = '85px';
      card.style.aspectRatio = '1 / 1';
      card.style.flexShrink = '0';
      card.style.boxSizing = 'border-box';

      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">${renderUniversalIcon(icon, 36)}</div>
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.75em; padding:0 4px;">
          <span style="color:#e2e8f0; font-weight:bold; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:45px;">${name}</span>
          <span style="color:#fbbf24; font-weight:bold;">x${count}</span>
        </div>
      `;

      attachTooltip(card, () => `
        <div style="padding:8px; max-width:200px;">
          <div style="font-weight:bold; color:#fbbf24; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            ${renderUniversalIcon(icon, 20)} <span>${name}</span>
          </div>
          <div style="font-size:0.8em; color:#cbd5e1;">用於城鎮商隊貿易與物資輸送</div>
          <div style="font-size:0.8em; color:#e2e8f0; margin-top:4px;">庫存數量：${count} 單位</div>
        </div>
      `);
      grid.appendChild(card);
    });
  }
}
