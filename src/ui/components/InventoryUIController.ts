import { GameState } from '../../core/GameState';
import { UIManager } from '../UIManager';
import { TRADE_GOODS } from '../../systems/MarketSystem';
import materialsJson from '../../data/materials.json';
import { renderEquipIcon, ICON_SIZE, attachTooltip, getEquipTooltipHtml } from '../ShopController';
import { renderResourceSpriteHtml, renderUniversalIcon } from '../IconSpriteHelper';
import { getTradeGoodStock } from '../ShopController';

export class InventoryUIController {
  private panel: HTMLElement | null;
  private btnDock: HTMLElement | null;
  private btnClose: HTMLElement | null;
  private listContainer: HTMLElement | null;
  private tabBtns: NodeListOf<HTMLElement>;
  private uiManager: typeof UIManager;
  
  private currentTab: 'equip' | 'material' | 'trade' = 'equip';

  constructor(uiManager: typeof UIManager) {
    this.uiManager = uiManager;
    this.panel = document.getElementById('inventory-panel');
    this.btnDock = document.getElementById('btn-dock-inventory');
    this.btnClose = document.getElementById('btn-close-inventory');
    this.listContainer = document.getElementById('inventory-list-container');
    this.tabBtns = document.querySelectorAll('#inventory-panel .tab-btn');

    this.bindEvents();
  }

  private bindEvents() {
    if (this.btnDock) {
      this.btnDock.addEventListener('click', () => {
        // Toggle panel
        const isCurrentlyOpen = this.panel?.classList.contains('active');
        
        // Close others
        this.uiManager.closeAllLeftPanels();
        
        if (!isCurrentlyOpen && this.panel) {
          this.panel.classList.add('active');
          this.renderList();
        }
      });
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => {
        if (this.panel) this.panel.classList.remove('active');
      });
    }

    this.tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.tabBtns.forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = '#94a3b8';
          b.style.borderColor = 'transparent';
        });
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        target.style.background = 'rgba(139,92,246,0.2)';
        target.style.color = '#ddd';
        target.style.borderColor = 'rgba(139,92,246,0.5)';
        
        this.currentTab = target.getAttribute('data-tab') as 'equip' | 'material' | 'trade';
        this.renderList();
      });
    });
  }

  public closePanel() {
    if (this.panel) this.panel.classList.remove('active');
  }

  public renderList() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    if (this.currentTab === 'equip') {
      this.renderEquipList();
    } else if (this.currentTab === 'material') {
      this.renderMaterialList();
    } else if (this.currentTab === 'trade') {
      this.renderTradeList();
    }
  }

  private renderEquipList() {
    const warehouse = GameState.myTerritory.warehouse;
    if (warehouse.length === 0) {
      this.listContainer!.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px;">倉庫內沒有任何裝備。</div>`;
      return;
    }

    const gridContainer = document.createElement('div');
    gridContainer.style.display = 'grid';
    gridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(90px, 1fr))';
    gridContainer.style.gap = '8px';
    gridContainer.style.justifyContent = 'start';
    this.listContainer!.appendChild(gridContainer);

    // Sort by slot then tier
    const sorted = [...warehouse].sort((a, b) => {
      if (a.slot !== b.slot) return (a.slot || '').localeCompare(b.slot || '');
      return (b.tier || 1) - (a.tier || 1);
    });

    sorted.forEach(eq => {
      const card = document.createElement('div');
      card.className = 'equip-card-square tooltip-eq-trigger';
      card.style.position = 'relative';
      card.style.width = '100%';
      card.style.maxWidth = '90px';
      card.style.height = '100px';
      card.style.background = 'rgba(15,23,42,0.7)';
      card.style.border = '1px solid rgba(255,255,255,0.15)';
      card.style.borderRadius = '6px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'center';
      card.style.padding = '6px 4px';
      card.style.cursor = 'pointer';
      
      const iconHtml = renderEquipIcon(eq, ICON_SIZE.MD);
      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center; padding: 2px 0;">${iconHtml}</div>
        <div style="font-size:0.75em; font-weight:500; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center; margin-top:2px;">${eq.name}</div>
        ${eq.enhancementLevel ? `<div style="position:absolute; top:2px; right:4px; font-size:0.7em; color:#3b82f6; font-weight:bold;">+${eq.enhancementLevel}</div>` : ''}
      `;
      
      attachTooltip(card, () => getEquipTooltipHtml(eq));
      
      gridContainer.appendChild(card);
    });
  }

  private renderMaterialList() {
    const materials = GameState.myTerritory.materials;
    const ids = Object.keys(materials).filter(id => materials[id] > 0);

    if (ids.length === 0) {
      this.listContainer!.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px;">沒有任何素材。</div>`;
      return;
    }

    const gridContainer = document.createElement('div');
    gridContainer.style.display = 'grid';
    gridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(90px, 1fr))';
    gridContainer.style.gap = '8px';
    gridContainer.style.justifyContent = 'start';
    this.listContainer!.appendChild(gridContainer);

    ids.forEach(id => {
      const def = (materialsJson as any[]).find(m => m.id === id);
      if (!def) return;
      const count = materials[id];

      const card = document.createElement('div');
      card.className = 'equip-card-square';
      card.style.position = 'relative';
      card.style.width = '100%';
      card.style.maxWidth = '90px';
      card.style.height = '100px';
      card.style.background = 'rgba(15,23,42,0.7)';
      card.style.border = '1px solid rgba(255,255,255,0.15)';
      card.style.borderRadius = '6px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.padding = '6px 4px';
      card.style.cursor = 'pointer';

      const iconDisplay = renderUniversalIcon(def.icon || def.id, 42);

      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">
          ${iconDisplay}
        </div>
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.75em; border-top:1px solid rgba(255,255,255,0.1); padding-top:2px; margin-top:2px;">
          <span style="color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:50px;">${def.name}</span>
          <span style="color:#fbbf24; font-weight:bold;">x${count}</span>
        </div>
      `;

      attachTooltip(card, () => `
        <div style="padding:8px; max-width:220px;">
          <div style="font-weight:bold; color:#fbbf24; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            ${renderUniversalIcon(def.icon || def.id, 20)} <span>${def.name}</span>
          </div>
          <div style="font-size:0.8em; color:#cbd5e1; line-height:1.4;">${def.description || '領地必備素材'}</div>
          <div style="font-size:0.8em; color:#4ade80; margin-top:4px;">庫存數量：${count}</div>
        </div>
      `);

      gridContainer.appendChild(card);
    });
  }

  private renderTradeList() {
    const territory = GameState.myTerritory;
    const goodsWithStock = TRADE_GOODS
      .map(g => ({ g, count: getTradeGoodStock(territory, g.id) }))
      .filter(item => item.count > 0);

    if (goodsWithStock.length === 0) {
      this.listContainer!.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px;">沒有任何交易品。</div>`;
      return;
    }

    const gridContainer = document.createElement('div');
    gridContainer.style.display = 'grid';
    gridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(90px, 1fr))';
    gridContainer.style.gap = '8px';
    gridContainer.style.justifyContent = 'start';
    this.listContainer!.appendChild(gridContainer);

    goodsWithStock.forEach(({ g, count }) => {
      const matDef = (materialsJson as any[]).find(m => m.id === g.id);
      const iconToUse = matDef?.icon || g.icon || '📦';

      const card = document.createElement('div');
      card.className = 'equip-card-square';
      card.style.position = 'relative';
      card.style.width = '100%';
      card.style.maxWidth = '90px';
      card.style.height = '100px';
      card.style.background = 'rgba(15,23,42,0.7)';
      card.style.border = '1px solid rgba(255,255,255,0.15)';
      card.style.borderRadius = '6px';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.padding = '6px 4px';
      card.style.cursor = 'pointer';

      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">
          ${renderUniversalIcon(iconToUse, 42)}
        </div>
        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; font-size:0.75em; border-top:1px solid rgba(255,255,255,0.1); padding-top:2px; margin-top:2px;">
          <span style="color:#e2e8f0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:50px;">${g.name}</span>
          <span style="color:#fbbf24; font-weight:bold;">x${count}</span>
        </div>
      `;

      attachTooltip(card, () => `
        <div style="padding:8px; max-width:220px;">
          <div style="font-weight:bold; color:#fbbf24; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px; margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            ${renderUniversalIcon(iconToUse, 20)} <span>${g.name}</span>
          </div>
          <div style="font-size:0.8em; color:#cbd5e1; line-height:1.4;">${g.description || '跑商交易物資'}</div>
          <div style="font-size:0.8em; color:#4ade80; margin-top:4px;">庫存數量：${count}</div>
        </div>
      `);

      gridContainer.appendChild(card);
    });
  }
}
