import { GameState } from '../../core/GameState';
import { UIManager } from '../UIManager';
import { TRADE_GOODS } from '../../systems/MarketSystem';
import materialsJson from '../../data/materials.json';
import { renderEquipIcon, attachTooltip, getEquipTooltipHtml } from '../ShopController';
import { renderResourceSpriteHtml } from '../IconSpriteHelper';

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
      
      const iconHtml = renderEquipIcon(eq, 38);
      card.innerHTML = `
        <div style="flex:1; display:flex; align-items:center; justify-content:center;">${iconHtml}</div>
        <div style="font-size:0.7em; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:100%; text-align:center;">${eq.name}</div>
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

    ids.forEach(id => {
      const def = (materialsJson as any[]).find(m => m.id === id);
      if (!def) return;
      const count = materials[id];

      const card = document.createElement('div');
      card.style.cssText = `
        display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4);
        padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
      `;
      const matSpriteType = id.replace('mat_', '');
      const iconDisplay = renderResourceSpriteHtml(matSpriteType, 42);

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          ${iconDisplay}
          <div>
            <div style="font-weight: bold; color: #cbd5e1;">${def.name}</div>
            <div style="font-size: 0.8em; color: #94a3b8;">${def.description}</div>
          </div>
        </div>
        <div style="font-weight: bold; font-size: 1.2em; color: #fff;">x${count}</div>
      `;
      this.listContainer!.appendChild(card);
    });
  }

  private renderTradeList() {
    const tradeInv = GameState.myTerritory.tradeInventory;
    const ids = Object.keys(tradeInv).filter(id => tradeInv[id] > 0);

    if (ids.length === 0) {
      this.listContainer!.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px;">沒有任何交易品。</div>`;
      return;
    }

    ids.forEach(id => {
      const def = TRADE_GOODS.find(g => g.id === id);
      if (!def) return;
      const count = tradeInv[id];

      const card = document.createElement('div');
      card.style.cssText = `
        display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4);
        padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
      `;
      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.5em;">${def.icon}</span>
          <div>
            <div style="font-weight: bold; color: #cbd5e1;">${def.name}</div>
            <div style="font-size: 0.8em; color: #94a3b8;">${def.description}</div>
          </div>
        </div>
        <div style="font-weight: bold; font-size: 1.2em; color: #fff;">x${count}</div>
      `;
      this.listContainer!.appendChild(card);
    });
  }
}
