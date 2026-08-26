import { DataStore } from '../../systems/DataStore';
import { TRADE_GOODS } from '../../systems/MarketSystem';
import equipmentWeaponsJson from '../../data/equipment_weapons.json';
import equipmentArmorsJson from '../../data/equipment_armors.json';
import equipmentAccessoriesJson from '../../data/equipment_accessories.json';
import materialsJson from '../../data/materials.json';
import { escapeHtml } from './StoryStudioTypes';
import { renderUniversalIcon } from '../../ui/IconSpriteHelper';

export type ItemPickerCategory = 'MATERIAL' | 'TRADE_GOOD' | 'EQUIPMENT';

export interface PickedItem {
  category: ItemPickerCategory;
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tier?: number;
  slot?: string;
}

export class StoryStudioItemPicker {
  private static instance: StoryStudioItemPicker;
  private modalEl: HTMLElement | null = null;
  private currentCategory: ItemPickerCategory = 'MATERIAL';
  private onSelectCallback: ((item: PickedItem) => void) | null = null;
  private searchQuery: string = '';
  private currentEquipmentSlotFilter: string = 'ALL';
  private currentEquipmentTierFilter: string = 'ALL';

  public static getInstance(): StoryStudioItemPicker {
    if (!this.instance) {
      this.instance = new StoryStudioItemPicker();
    }
    return this.instance;
  }

  constructor() {
    this.ensureModalHtml();
  }

  private ensureModalHtml(): void {
    let el = document.getElementById('story-studio-item-picker-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'story-studio-item-picker-modal';
      el.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px); z-index: 999999; display: none; align-items: center; justify-content: center; box-sizing: border-box;';
      el.innerHTML = `
        <div class="story-studio-modal-content" style="max-width: 840px; width: 92%; max-height: 88vh; display: flex; flex-direction: column; background: #1c1917; border: 2px solid #f59e0b; border-radius: 10px; color: #e7e5e4; box-shadow: 0 20px 50px rgba(0,0,0,0.9); overflow: hidden; z-index: 1000000;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; border-bottom: 1px solid #44403c; background: #292524;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.2rem; font-weight: bold; color: #fbbf24;">📦 挑選唯一來源物品 (素材／特產／裝備)</span>
            </div>
            <button type="button" id="item-picker-close" class="action-btn story-danger" style="padding: 5px 12px; font-size: 0.85rem; cursor: pointer;">✕ 關閉</button>
          </div>

          <div style="display: flex; gap: 8px; padding: 12px 18px; border-bottom: 1px solid #332f2c; background: #1f1c19;">
            <button type="button" class="action-btn item-picker-tab" data-cat="MATERIAL" style="padding: 7px 16px; font-size: 0.85rem; font-weight: bold; cursor: pointer; border-radius: 6px;">💎 素材庫</button>
            <button type="button" class="action-btn item-picker-tab" data-cat="TRADE_GOOD" style="padding: 7px 16px; font-size: 0.85rem; font-weight: bold; cursor: pointer; border-radius: 6px;">🍷 特產/貿易品</button>
            <button type="button" class="action-btn item-picker-tab" data-cat="EQUIPMENT" style="padding: 7px 16px; font-size: 0.85rem; font-weight: bold; cursor: pointer; border-radius: 6px;">⚔️ 裝備庫</button>
          </div>

          <div style="padding: 10px 18px; display: flex; gap: 10px; align-items: center; background: #1c1917; border-bottom: 1px solid #292524; flex-wrap: wrap;">
            <input type="text" id="item-picker-search" placeholder="🔍 搜尋物品名稱、代號或說明..." style="flex: 1; min-width: 220px; padding: 8px 12px; background: #0c0a09; border: 1px solid #57534e; border-radius: 6px; color: #f5f5f4; font-size: 0.88rem;">
            <div id="item-picker-equipment-filters" style="display: none; gap: 8px; align-items: center;">
              <select id="item-picker-slot-filter" style="padding: 7px 10px; background: #0c0a09; border: 1px solid #57534e; border-radius: 6px; color: #f5f5f4; font-size: 0.82rem;">
                <option value="ALL">全部部位</option>
                <option value="WEAPON">武器 (WEAPON)</option>
                <option value="ARMOR">防具 (ARMOR)</option>
                <option value="ACCESSORY">飾品 (ACCESSORY)</option>
              </select>
              <select id="item-picker-tier-filter" style="padding: 7px 10px; background: #0c0a09; border: 1px solid #57534e; border-radius: 6px; color: #f5f5f4; font-size: 0.82rem;">
                <option value="ALL">全部階級</option>
                <option value="1">Tier 1 (初階)</option>
                <option value="2">Tier 2 (中階)</option>
                <option value="3">Tier 3 (高階)</option>
                <option value="4">Tier 4 (神兵)</option>
              </select>
            </div>
          </div>

          <div id="item-picker-grid" style="flex: 1; overflow-y: auto; padding: 14px 18px; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; max-height: 520px;">
          </div>

          <div style="padding: 10px 18px; border-top: 1px solid #292524; background: #141210; font-size: 0.8rem; color: #a8a29e; display: flex; justify-content: space-between; align-items: center;">
            <span id="item-picker-count" style="font-weight: bold; color: #fbbf24;">共 0 項物品</span>
            <span style="color: #d6d3d1;">💡 點擊卡片一鍵選中並自動回填</span>
          </div>
        </div>
      `;
      document.body.appendChild(el);
    }
    this.modalEl = el;
    this.bindEvents();
  }

  private bindEvents(): void {
    if (!this.modalEl) return;
    this.modalEl.querySelector('#item-picker-close')?.addEventListener('click', () => this.close());
    
    this.modalEl.querySelectorAll<HTMLButtonElement>('.item-picker-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const cat = tab.dataset.cat as ItemPickerCategory;
        if (cat) {
          this.currentCategory = cat;
          this.renderTabs();
          this.renderItems();
        }
      });
    });

    const searchInput = this.modalEl.querySelector<HTMLInputElement>('#item-picker-search');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = (e.target as HTMLInputElement).value.trim().toLowerCase();
      this.renderItems();
    });

    const slotFilter = this.modalEl.querySelector<HTMLSelectElement>('#item-picker-slot-filter');
    slotFilter?.addEventListener('change', (e) => {
      this.currentEquipmentSlotFilter = (e.target as HTMLSelectElement).value;
      this.renderItems();
    });

    const tierFilter = this.modalEl.querySelector<HTMLSelectElement>('#item-picker-tier-filter');
    tierFilter?.addEventListener('change', (e) => {
      this.currentEquipmentTierFilter = (e.target as HTMLSelectElement).value;
      this.renderItems();
    });
  }

  public open(category: ItemPickerCategory, onSelect: (item: PickedItem) => void): void {
    this.ensureModalHtml();
    this.currentCategory = category;
    this.onSelectCallback = onSelect;
    this.searchQuery = '';
    const searchInput = this.modalEl?.querySelector<HTMLInputElement>('#item-picker-search');
    if (searchInput) searchInput.value = '';
    
    if (this.modalEl) this.modalEl.style.display = 'flex';
    this.renderTabs();
    this.renderItems();
  }

  public close(): void {
    if (this.modalEl) this.modalEl.style.display = 'none';
    this.onSelectCallback = null;
  }

  private renderTabs(): void {
    if (!this.modalEl) return;
    this.modalEl.querySelectorAll<HTMLButtonElement>('.item-picker-tab').forEach(tab => {
      const active = tab.dataset.cat === this.currentCategory;
      tab.style.background = active ? '#d97706' : '#292524';
      tab.style.color = active ? '#ffffff' : '#d6d3d1';
      tab.style.borderColor = active ? '#f59e0b' : '#44403c';
    });

    const eqFilters = this.modalEl.querySelector<HTMLElement>('#item-picker-equipment-filters');
    if (eqFilters) {
      eqFilters.style.display = this.currentCategory === 'EQUIPMENT' ? 'flex' : 'none';
    }
  }

  private getCleanIcon(icon?: string, fallback: string = '📦'): string {
    if (!icon) return fallback;
    if (icon.startsWith('icons_') || icon.includes(':')) {
      return fallback;
    }
    return icon;
  }

  private renderItems(): void {
    if (!this.modalEl) return;
    const grid = this.modalEl.querySelector<HTMLElement>('#item-picker-grid');
    const countEl = this.modalEl.querySelector<HTMLElement>('#item-picker-count');
    if (!grid) return;
    grid.innerHTML = '';

    const items: PickedItem[] = this.getItemsForCurrentCategory();
    const filtered = items.filter(item => {
      if (this.searchQuery) {
        const text = `${item.id} ${item.name} ${item.description || ''}`.toLowerCase();
        if (!text.includes(this.searchQuery)) return false;
      }
      if (this.currentCategory === 'EQUIPMENT') {
        if (this.currentEquipmentSlotFilter !== 'ALL' && item.slot !== this.currentEquipmentSlotFilter) return false;
        if (this.currentEquipmentTierFilter !== 'ALL' && String(item.tier) !== this.currentEquipmentTierFilter) return false;
      }
      return true;
    });

    if (countEl) countEl.textContent = `共 ${filtered.length} 項物品`;

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #78716c; padding: 40px 0;">無符合搜尋條件的物品</div>`;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.style.cssText = 'background: #141210; border: 1px solid #44403c; border-radius: 8px; padding: 10px 12px; cursor: pointer; display: flex; gap: 10px; align-items: center; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';
      card.onmouseenter = () => {
        card.style.borderColor = '#f59e0b';
        card.style.background = '#221c16';
        card.style.transform = 'translateY(-2px)';
      };
      card.onmouseleave = () => {
        card.style.borderColor = '#44403c';
        card.style.background = '#141210';
        card.style.transform = 'none';
      };

      const tierBadge = item.tier ? `<span style="font-size: 0.68rem; padding: 1px 5px; border-radius: 3px; background: #374151; color: #fbbf24; border: 1px solid #4b5563; font-weight: bold;">T${item.tier}</span>` : '';
      const slotBadge = item.slot ? `<span style="font-size: 0.68rem; padding: 1px 5px; border-radius: 3px; background: #1e293b; color: #94a3b8; border: 1px solid #334155;">${item.slot}</span>` : '';

      card.innerHTML = `
        <div style="width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.4); border-radius: 6px; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.06);">
          ${renderUniversalIcon(item.icon || '💎', 34)}
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
            <span style="font-weight: bold; font-size: 0.92rem; color: #fef08a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(item.name)}</span>
            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              ${tierBadge}
              ${slotBadge}
            </div>
          </div>
          <div style="font-size: 0.72rem; color: #9ca3af; font-family: ui-monospace, monospace;">${escapeHtml(item.id)}</div>
          ${item.description ? `<div style="font-size: 0.72rem; color: #78716c; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.description)}</div>` : ''}
        </div>
      `;

      card.addEventListener('click', () => {
        if (this.onSelectCallback) {
          this.onSelectCallback(item);
          this.close();
        }
      });

      grid.appendChild(card);
    });
  }

  private getItemsForCurrentCategory(): PickedItem[] {
    if (this.currentCategory === 'MATERIAL') {
      return (materialsJson as any[]).map(m => ({
        category: 'MATERIAL',
        id: m.id,
        name: m.name,
        description: m.description,
        icon: m.icon || '💎',
        tier: m.tier
      }));
    }

    if (this.currentCategory === 'TRADE_GOOD') {
      return TRADE_GOODS.map(g => ({
        category: 'TRADE_GOOD',
        id: g.id,
        name: g.name,
        description: `基礎價值: ${g.basePrice} G / 單位`,
        icon: g.icon || '🍷'
      }));
    }

    if (this.currentCategory === 'EQUIPMENT') {
      const list: PickedItem[] = [];
      (equipmentWeaponsJson as any[]).forEach(w => {
        list.push({
          category: 'EQUIPMENT',
          id: w.id,
          name: w.name,
          description: `武器類型: ${w.weaponType} | 攻擊力 +${w.damage || 0}`,
          icon: w.icon || '⚔️',
          tier: w.tier,
          slot: 'WEAPON'
        });
      });

      (equipmentArmorsJson as any[]).forEach(a => {
        list.push({
          category: 'EQUIPMENT',
          id: a.id,
          name: a.name,
          description: `防禦力 +${a.defense || 0}`,
          icon: a.icon || '🛡️',
          tier: a.tier,
          slot: 'ARMOR'
        });
      });

      (equipmentAccessoriesJson as any[]).forEach(acc => {
        list.push({
          category: 'EQUIPMENT',
          id: acc.id,
          name: acc.name,
          description: acc.description || '飾品配件',
          icon: acc.icon || '💍',
          tier: acc.tier || 1,
          slot: 'ACCESSORY'
        });
      });

      return list;
    }

    return [];
  }
}
