import { EquipmentSlot, ElementType, WeaponType, MaterialItem } from '../models/types';
import materialsJson from '../data/materials.json';
import equipmentTemplatesJson from '../data/EquipmentTemplates.json';
import craftingRecipesJson from '../data/CraftingRecipes.json';
import itemsJson from '../data/items.json';
import '../styles/equipment-studio.css';

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as unknown as T;
const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));

export interface ConsumableItem {
  id: string;
  name: string;
  category: string;
  icon: string;
  tier: number;
  effectType: string;
  effectValue?: number;
  targetStatus?: string;
  description: string;
  flavorText?: string;
  maxStack: number;
  buyPrice: number;
  sellPrice: number;
}

export interface CustomEquipmentTemplate {
  id: string;
  name: string;
  slot: EquipmentSlot;
  weaponType?: WeaponType;
  tier: number;
  icon?: string;
  element?: ElementType;
  combatEffects: {
    patk?: number;
    matk?: number;
    pdef?: number;
    mdef?: number;
    hp?: number;
    mp?: number;
    hit?: number;
    evade?: number;
    crit?: number;
  };
  affixPool?: string[];
  description?: string;
  flavorText?: string;
}

export interface CustomCraftingRecipe {
  id: string;
  name?: string;
  tier: number;
  targetEquipmentId: string;
  requiredMaterials: Record<string, number>;
  goldCost: number;
}

class EquipmentStudioController {
  private materials: MaterialItem[] = [];
  private items: ConsumableItem[] = [];
  private equipment: CustomEquipmentTemplate[] = [];
  private recipes: CustomCraftingRecipe[] = [];

  // 當前左欄選中標籤 ('materials' | 'items')
  private leftTab: 'materials' | 'items' = 'materials';

  // 當前編輯中的對象與類型
  private activeEditingType: 'material' | 'item' | 'equipment' | 'recipe' = 'material';
  private activeEditingId: string | null = null;

  // 圖標選擇器回呼
  private iconPickerCallback: ((icon: string) => void) | null = null;

  public async init(): Promise<void> {
    await this.loadTemplate();
    await this.loadData();
    this.bindEvents();
    this.render();
  }

  private async loadTemplate(): Promise<void> {
    const response = await fetch(`${import.meta.env.BASE_URL}src/templates/equipment-studio.html?t=${Date.now()}`);
    if (!response.ok) throw new Error('無法載入裝備工坊介面');
    byId('equipment-studio-root').innerHTML = await response.text();
  }

  private async loadData(): Promise<void> {
    try {
      const res = await fetch('/api/get-equipment-studio-data');
      if (res.ok) {
        const data = await res.json();
        this.materials = data.materials?.length ? data.materials : clone(materialsJson);
        this.items = data.items?.length ? data.items : clone(itemsJson);
        this.equipment = data.equipment?.length ? data.equipment : clone(equipmentTemplatesJson);
        this.recipes = data.recipes?.length ? data.recipes : clone(craftingRecipesJson);
      } else {
        this.fallbackLocalData();
      }
    } catch {
      this.fallbackLocalData();
    }
  }

  private normalizeEquipmentList(raw: any): CustomEquipmentTemplate[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
      const list: any[] = [];
      if (Array.isArray(raw.weapons)) list.push(...raw.weapons);
      if (Array.isArray(raw.armors)) list.push(...raw.armors);
      if (Array.isArray(raw.accessories)) list.push(...raw.accessories);
      return list;
    }
    return [];
  }

  private fallbackLocalData(): void {
    this.materials = clone(materialsJson) as MaterialItem[];
    this.items = clone(itemsJson) as ConsumableItem[];
    this.equipment = this.normalizeEquipmentList(clone(equipmentTemplatesJson));
    this.recipes = clone(craftingRecipesJson) as any;
  }

  // ── 畫面渲染 ──
  private render(): void {
    this.renderLeftColumn();
    this.renderEquipColumn();
    this.renderRecipeColumn();
  }

  private renderLeftColumn(): void {
    const list = byId('es-left-list');
    list.innerHTML = '';

    byId('es-mat-count').textContent = String(this.materials.length);
    byId('es-item-count').textContent = String(this.items.length);

    const search = (byId('es-search-left') as HTMLInputElement)?.value.toLowerCase() || '';
    const tierFilter = (byId('es-filter-left-tier') as HTMLSelectElement)?.value || 'ALL';

    if (this.leftTab === 'materials') {
      const filtered = this.materials.filter(m => {
        const matchSearch = m.name.toLowerCase().includes(search) || m.id.toLowerCase().includes(search);
        const matchTier = tierFilter === 'ALL' || String(m.tier) === tierFilter;
        return matchSearch && matchTier;
      });

      filtered.forEach(m => {
        const card = document.createElement('div');
        card.className = 'es-card';
        const icon = m.icon || this.getMaterialDefaultIcon(m.id);

        card.innerHTML = `
          <div class="es-card-header">
            <div class="es-card-title">
              <div class="es-card-avatar" data-open-icon-mat="${m.id}">${icon}</div>
              <div>
                <div style="font-size: 0.85rem; font-weight: bold;">${m.name}</div>
                <div style="font-size: 0.7rem; color: var(--es-text-muted);">${m.id}</div>
              </div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <span class="es-badge es-badge-t${m.tier}">T${m.tier}</span>
              <button class="es-btn es-btn-sm" data-edit-mat="${m.id}">✎</button>
              <button class="es-btn es-btn-sm es-btn-danger" data-del-mat="${m.id}">✕</button>
            </div>
          </div>
          <div class="es-card-desc">${m.description || '用於鍛造與改造之基礎素材。'}</div>
          ${m.flavorText ? `<div class="es-card-flavor">${m.flavorText}</div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--es-text-muted); margin-top: 2px;">
            <span>💰 價值: ${m.basePrice || 15} 金幣</span>
            <span>分類: ${m.category || '金屬/素材'}</span>
          </div>
        `;
        list.appendChild(card);
      });
    } else {
      const filtered = this.items.filter(it => {
        const matchSearch = it.name.toLowerCase().includes(search) || it.id.toLowerCase().includes(search);
        const matchTier = tierFilter === 'ALL' || String(it.tier) === tierFilter;
        return matchSearch && matchTier;
      });

      filtered.forEach(it => {
        const card = document.createElement('div');
        card.className = 'es-card';
        card.innerHTML = `
          <div class="es-card-header">
            <div class="es-card-title">
              <div class="es-card-avatar" data-open-icon-item="${it.id}">${it.icon || '🧪'}</div>
              <div>
                <div style="font-size: 0.85rem; font-weight: bold;">${it.name}</div>
                <div style="font-size: 0.7rem; color: var(--es-text-muted);">${it.id}</div>
              </div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <span class="es-badge es-badge-t${it.tier}">T${it.tier}</span>
              <button class="es-btn es-btn-sm" data-edit-item="${it.id}">✎</button>
              <button class="es-btn es-btn-sm es-btn-danger" data-del-item="${it.id}">✕</button>
            </div>
          </div>
          <div class="es-card-desc">${it.description}</div>
          ${it.flavorText ? `<div class="es-card-flavor">${it.flavorText}</div>` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--es-text-muted); margin-top: 2px;">
            <span>📦 堆疊: ${it.maxStack}</span>
            <span>💰 買/賣: ${it.buyPrice}/${it.sellPrice}</span>
          </div>
        `;
        list.appendChild(card);
      });
    }
  }

  private renderEquipColumn(): void {
    const list = byId('es-equip-list');
    list.innerHTML = '';
    byId('es-equip-count').textContent = String(this.equipment.length);

    const search = (byId('es-search-equip') as HTMLInputElement)?.value.toLowerCase() || '';
    const slotFilter = (byId('es-filter-equip-slot') as HTMLSelectElement)?.value || 'ALL';
    const tierFilter = (byId('es-filter-equip-tier') as HTMLSelectElement)?.value || 'ALL';

    const filtered = this.equipment.filter(eq => {
      const matchSearch = eq.name.toLowerCase().includes(search) || eq.id.toLowerCase().includes(search);
      const matchSlot = slotFilter === 'ALL' || eq.slot === slotFilter;
      const matchTier = tierFilter === 'ALL' || String(eq.tier) === tierFilter;
      return matchSearch && matchSlot && matchTier;
    });

    filtered.forEach(eq => {
      const card = document.createElement('div');
      card.className = 'es-card';
      const eff = eq.combatEffects || {};
      const icon = eq.icon || this.getEquipDefaultIcon(eq.slot, eq.weaponType);
      const elemText = eq.element && eq.element !== ElementType.NONE ? `<span style="color: var(--es-gold);">[${eq.element}]</span>` : '';

      const patk = eff.patk || (eq.slot === EquipmentSlot.WEAPON ? eq.tier * 15 : 0);
      const matk = eff.matk || (eq.slot === EquipmentSlot.WEAPON ? eq.tier * 15 : 0);
      const pdef = eff.pdef || (eq.slot === EquipmentSlot.ARMOR ? eq.tier * 10 : 0);
      const mdef = eff.mdef || (eq.slot === EquipmentSlot.ARMOR ? eq.tier * 10 : 0);
      const hp = eff.hp || (eq.slot === EquipmentSlot.ARMOR ? eq.tier * 30 : 0);
      const crit = eff.crit || (eq.slot === EquipmentSlot.WEAPON ? 5 : 0);

      // +10 強化預估戰力
      const effAtk10 = Math.max(patk, matk) + 40;
      const avgDef10 = Math.floor((pdef + mdef) / 2) + 30;
      const maxHp10 = hp + 50;
      const power10 = effAtk10 + Math.floor(avgDef10 * 0.6) + Math.floor(maxHp10 * 0.2);

      const affixesHtml = (eq.affixPool && eq.affixPool.length > 0)
        ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
            ${eq.affixPool.map(af => `<span class="es-affix-tag">🎲 ${af}</span>`).join('')}
           </div>`
        : '';

      card.innerHTML = `
        <div class="es-card-header">
          <div class="es-card-title">
            <div class="es-card-avatar" data-open-icon-equip="${eq.id}">${icon}</div>
            <div>
              <div style="font-size: 0.88rem; font-weight: bold;">${elemText} ${eq.name}</div>
              <div style="font-size: 0.7rem; color: var(--es-text-muted);">${eq.weaponType || eq.slot} · ${eq.id}</div>
            </div>
          </div>
          <div style="display: flex; gap: 4px; align-items: center;">
            <span class="es-badge es-badge-t${eq.tier}">T${eq.tier}</span>
            <button class="es-btn es-btn-sm" data-edit-equip="${eq.id}">✎</button>
            <button class="es-btn es-btn-sm es-btn-danger" data-del-equip="${eq.id}">✕</button>
          </div>
        </div>

        <div class="es-stat-grid">
          <div>⚔️ 物攻 <b>${patk}</b></div>
          <div>🔮 魔攻 <b>${matk}</b></div>
          <div>🛡️ 物防 <b>${pdef}</b></div>
          <div>✨ 魔防 <b>${mdef}</b></div>
          <div>❤️ HP <b>${hp}</b></div>
          <div>💥 暴擊 <b>${crit}%</b></div>
          <div style="grid-column: span 2; color: var(--es-gold); font-weight: bold;">📈 +10戰力 <b>⚔️ ${power10}</b></div>
        </div>

        ${affixesHtml}
        <div class="es-card-desc" style="margin-top: 2px;">${eq.description || '精工打造之中世紀軍械。'}</div>
        ${eq.flavorText ? `<div class="es-card-flavor">${eq.flavorText}</div>` : ''}
      `;
      list.appendChild(card);
    });
  }

  private renderRecipeColumn(): void {
    const list = byId('es-recipe-list');
    list.innerHTML = '';
    byId('es-recipe-count').textContent = String(this.recipes.length);

    const search = (byId('es-search-recipe') as HTMLInputElement)?.value.toLowerCase() || '';

    const filtered = this.recipes.filter(r => {
      const targetEq = this.equipment.find(e => e.id === r.targetEquipmentId);
      const name = r.name || targetEq?.name || r.id;
      return name.toLowerCase().includes(search) || r.id.toLowerCase().includes(search);
    });

    filtered.forEach(r => {
      const card = document.createElement('div');
      card.className = 'es-card';
      const targetEq = this.equipment.find(e => e.id === r.targetEquipmentId);
      const eqName = targetEq?.name || r.targetEquipmentId;
      const eqIcon = targetEq ? (targetEq.icon || this.getEquipDefaultIcon(targetEq.slot, targetEq.weaponType)) : '📦';

      const matsHtml = Object.entries(r.requiredMaterials || {}).map(([matId, count]) => {
        const mat = this.materials.find(m => m.id === matId);
        const matName = mat?.name || matId;
        const matIcon = mat?.icon || '🪵';
        return `<span style="background: #161b22; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; border: 1px solid var(--es-panel-border);">${matIcon} ${matName} x${count}</span>`;
      }).join(' ');

      card.innerHTML = `
        <div class="es-card-header">
          <div class="es-card-title">
            <div class="es-card-avatar">${eqIcon}</div>
            <div>
              <div style="font-size: 0.85rem; font-weight: bold;">${r.name || eqName} 配方</div>
              <div style="font-size: 0.7rem; color: var(--es-text-muted);">${r.id} ➔ ${eqName}</div>
            </div>
          </div>
          <div style="display: flex; gap: 4px; align-items: center;">
            <span class="es-badge es-badge-t${r.tier || 1}">T${r.tier || 1}</span>
            <button class="es-btn es-btn-sm" data-edit-recipe="${r.id}">✎</button>
            <button class="es-btn es-btn-sm es-btn-danger" data-del-recipe="${r.id}">✕</button>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
          ${matsHtml}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--es-gold); margin-top: 4px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 4px;">
          <span>💰 消耗金幣: <b>${r.goldCost || 100}</b></span>
          <button class="es-btn es-btn-sm" data-simulate-craft="${r.id}" style="padding: 1px 6px;">🔨 模擬鍛造</button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  // ── 事件綁定 ──
  private bindEvents(): void {
    // 頂部導航
    byId('btn-nav-combat').onclick = () => window.open(`${import.meta.env.BASE_URL}tools/combat-studio.html`, '_blank');
    byId('btn-nav-icon').onclick = () => window.open(`${import.meta.env.BASE_URL}tools/icon-studio.html`, '_blank');
    byId('btn-nav-story').onclick = () => window.open(`${import.meta.env.BASE_URL}tools/story-studio.html`, '_blank');

    // 左欄標籤切換
    byId('tab-left-materials').onclick = () => {
      this.leftTab = 'materials';
      byId('tab-left-materials').className = 'es-btn es-btn-sm es-btn-gold';
      byId('tab-left-items').className = 'es-btn es-btn-sm';
      this.renderLeftColumn();
    };

    byId('tab-left-items').onclick = () => {
      this.leftTab = 'items';
      byId('tab-left-items').className = 'es-btn es-btn-sm es-btn-gold';
      byId('tab-left-materials').className = 'es-btn es-btn-sm';
      this.renderLeftColumn();
    };

    // 搜尋與篩選事件
    byId('es-search-left').oninput = () => this.renderLeftColumn();
    byId('es-filter-left-tier').onchange = () => this.renderLeftColumn();
    byId('es-search-equip').oninput = () => this.renderEquipColumn();
    byId('es-filter-equip-slot').onchange = () => this.renderEquipColumn();
    byId('es-filter-equip-tier').onchange = () => this.renderEquipColumn();
    byId('es-search-recipe').oninput = () => this.renderRecipeColumn();

    // ➕ 創造按鈕
    byId('btn-create-mat-or-item').onclick = () => {
      if (this.leftTab === 'materials') {
        this.openMaterialEditor(null);
      } else {
        this.openItemEditor(null);
      }
    };

    byId('btn-create-equipment').onclick = () => this.openEquipmentEditor(null);
    byId('btn-create-recipe').onclick = () => this.openRecipeEditor(null);

    // 磁碟持久化保存
    byId('btn-save-all-disk').onclick = async () => {
      try {
        const res = await fetch('/api/save-equipment-studio-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            materials: this.materials,
            items: this.items,
            equipment: this.equipment,
            recipes: this.recipes,
            note: '在裝備與素材工坊中儲存'
          })
        });
        if (res.ok) {
          const data = await res.json();
          alert(`💾 成功永久寫入專案磁碟！快照版本：${data.snapshot}`);
        } else {
          alert('寫入磁碟失敗，請確認 Vite 開發伺服器正常運作中');
        }
      } catch (err: any) {
        alert(`寫入失敗: ${err.message}`);
      }
    };

    // 時光機歷史快照
    byId('btn-history-backups').onclick = async () => {
      try {
        const res = await fetch('/api/list-equipment-studio-backups');
        if (res.ok) {
          const data = await res.json();
          const list = byId('es-backups-list');
          list.innerHTML = '';
          if (data.backups.length === 0) {
            list.innerHTML = '<div style="color: var(--es-text-muted);">尚無歷史快照。每次點擊「永久寫入專案磁碟」皆會自動生成備份。</div>';
          } else {
            data.backups.forEach((b: any) => {
              const item = document.createElement('div');
              item.style.cssText = 'padding: 8px; background: #0d1117; border: 1px solid var(--es-panel-border); border-radius: 6px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;';
              item.innerHTML = `
                <div>
                  <div style="font-weight: bold; font-size: 0.82rem; color: var(--es-gold);">${b.filename}</div>
                  <div style="font-size: 0.72rem; color: var(--es-text-muted);">${b.timestamp} · ${b.note || ''}</div>
                </div>
                <button class="es-btn es-btn-sm" data-restore-snap="${b.filename}">↩ 還原此版本</button>
              `;
              list.appendChild(item);
            });
          }
          byId('modal-history-backups').style.display = 'flex';
        }
      } catch {}
    };

    byId('btn-close-backups').onclick = () => byId('modal-history-backups').style.display = 'none';

    // 彈窗關閉事件
    byId('btn-close-me').onclick = () => byId('modal-material-editor').style.display = 'none';
    byId('btn-cancel-me').onclick = () => byId('modal-material-editor').style.display = 'none';
    byId('btn-close-ie').onclick = () => byId('modal-item-editor').style.display = 'none';
    byId('btn-cancel-ie').onclick = () => byId('modal-item-editor').style.display = 'none';
    byId('btn-close-ee').onclick = () => byId('modal-equipment-editor').style.display = 'none';
    byId('btn-cancel-ee').onclick = () => byId('modal-equipment-editor').style.display = 'none';
    byId('btn-close-re').onclick = () => byId('modal-recipe-editor').style.display = 'none';
    byId('btn-cancel-re').onclick = () => byId('modal-recipe-editor').style.display = 'none';
    byId('btn-close-icon-picker').onclick = () => byId('modal-icon-picker').style.display = 'none';

    // 彈窗保存按鈕
    this.bindSaveHandlers();

    // 委託點擊事件
    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.editMat) this.openMaterialEditor(target.dataset.editMat);
      if (target.dataset.delMat) {
        const id = target.dataset.delMat;
        if (confirm(`確定要刪除素材 [${id}] 嗎？`)) {
          this.materials = this.materials.filter(m => m.id !== id);
          this.renderLeftColumn();
        }
      }

      if (target.dataset.editItem) this.openItemEditor(target.dataset.editItem);
      if (target.dataset.delItem) {
        const id = target.dataset.delItem;
        if (confirm(`確定要刪除道具 [${id}] 嗎？`)) {
          this.items = this.items.filter(it => it.id !== id);
          this.renderLeftColumn();
        }
      }

      if (target.dataset.editEquip) this.openEquipmentEditor(target.dataset.editEquip);
      if (target.dataset.delEquip) {
        const id = target.dataset.delEquip;
        if (confirm(`確定要刪除裝備 [${id}] 嗎？`)) {
          this.equipment = this.equipment.filter(eq => eq.id !== id);
          this.renderEquipColumn();
        }
      }

      if (target.dataset.editRecipe) this.openRecipeEditor(target.dataset.editRecipe);
      if (target.dataset.delRecipe) {
        const id = target.dataset.delRecipe;
        if (confirm(`確定要刪除配方 [${id}] 嗎？`)) {
          this.recipes = this.recipes.filter(r => r.id !== id);
          this.renderRecipeColumn();
        }
      }

      if (target.dataset.simulateCraft) {
        const rId = target.dataset.simulateCraft;
        const recipe = this.recipes.find(r => r.id === rId);
        if (recipe) {
          const targetEq = this.equipment.find(e => e.id === recipe.targetEquipmentId);
          alert(`🔨 鍛造模擬成功！\n成功消耗了 ${recipe.goldCost} 金幣與所需素材。\n產出成品：【${targetEq?.name || recipe.targetEquipmentId}】！`);
        }
      }

      if (target.dataset.openIconMat) {
        const m = this.materials.find(mat => mat.id === target.dataset.openIconMat);
        if (m) {
          this.openIconPicker(ic => {
            m.icon = ic;
            this.renderLeftColumn();
          });
        }
      }

      if (target.dataset.openIconItem) {
        const it = this.items.find(item => item.id === target.dataset.openIconItem);
        if (it) {
          this.openIconPicker(ic => {
            it.icon = ic;
            this.renderLeftColumn();
          });
        }
      }

      if (target.dataset.openIconEquip) {
        const eq = this.equipment.find(e => e.id === target.dataset.openIconEquip);
        if (eq) {
          this.openIconPicker(ic => {
            eq.icon = ic;
            this.renderEquipColumn();
          });
        }
      }

      if (target.dataset.restoreSnap) {
        const filename = target.dataset.restoreSnap;
        if (confirm(`確定要還原至歷史快照 ${filename} 嗎？`)) {
          const res = await fetch('/api/restore-equipment-studio-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
          });
          if (res.ok) {
            const data = await res.json();
            this.materials = data.materials;
            this.items = data.items;
            this.equipment = data.equipment;
            this.recipes = data.recipes;
            byId('modal-history-backups').style.display = 'none';
            alert('已成功還原快照！');
            this.render();
          }
        }
      }
    });

    // 彈窗圖標直接點擊
    byId('me-icon').onclick = () => this.openIconPicker(ic => byId('me-icon').textContent = ic);
    byId('ie-icon').onclick = () => this.openIconPicker(ic => byId('ie-icon').textContent = ic);
    byId('ee-icon').onclick = () => this.openIconPicker(ic => byId('ee-icon').textContent = ic);
  }

  // ── 彈窗開啟與保存邏輯 ──
  private openMaterialEditor(id: string | null): void {
    this.activeEditingType = 'material';
    this.activeEditingId = id;
    const m = id ? this.materials.find(mat => mat.id === id) : null;

    byId('me-title').textContent = m ? `🧱 編輯素材 - ${m.name}` : '🧱 創造新素材';
    (byId('me-id') as HTMLInputElement).value = m ? m.id : `mat_new_${Date.now().toString().slice(-4)}`;
    (byId('me-id') as HTMLInputElement).disabled = !!m;
    (byId('me-name') as HTMLInputElement).value = m ? m.name : '';
    (byId('me-tier') as HTMLSelectElement).value = m ? String(m.tier) : '1';
    (byId('me-category') as HTMLSelectElement).value = m ? (m.category || 'METAL') : 'METAL';
    (byId('me-value') as HTMLInputElement).value = m ? String(m.basePrice || 20) : '20';
    (byId('me-desc') as HTMLTextAreaElement).value = m ? (m.description || '') : '';
    (byId('me-flavor') as HTMLTextAreaElement).value = m ? (m.flavorText || '') : '';
    byId('me-icon').textContent = m ? (m.icon || '🪵') : '🪵';

    byId('modal-material-editor').style.display = 'flex';
  }

  private openItemEditor(id: string | null): void {
    this.activeEditingType = 'item';
    this.activeEditingId = id;
    const it = id ? this.items.find(item => item.id === id) : null;

    byId('ie-title').textContent = it ? `🧪 編輯道具 - ${it.name}` : '🧪 創造新道具';
    (byId('ie-id') as HTMLInputElement).value = it ? it.id : `item_new_${Date.now().toString().slice(-4)}`;
    (byId('ie-id') as HTMLInputElement).disabled = !!it;
    (byId('ie-name') as HTMLInputElement).value = it ? it.name : '';
    (byId('ie-effect-type') as HTMLSelectElement).value = it ? it.effectType : 'HEAL_HP';
    (byId('ie-effect-val') as HTMLInputElement).value = it ? String(it.effectValue || 100) : '100';
    (byId('ie-stack') as HTMLInputElement).value = it ? String(it.maxStack || 99) : '99';
    (byId('ie-desc') as HTMLTextAreaElement).value = it ? it.description : '';
    (byId('ie-flavor') as HTMLTextAreaElement).value = it ? (it.flavorText || '') : '';
    byId('ie-icon').textContent = it ? (it.icon || '🧪') : '🧪';

    byId('modal-item-editor').style.display = 'flex';
  }

  private openEquipmentEditor(id: string | null): void {
    this.activeEditingType = 'equipment';
    this.activeEditingId = id;
    const eq = id ? this.equipment.find(e => e.id === id) : null;

    byId('ee-title').textContent = eq ? `⚔️ 編輯裝備 - ${eq.name}` : '⚔️ 創造新裝備';
    (byId('ee-id') as HTMLInputElement).value = eq ? eq.id : `wpn_new_${Date.now().toString().slice(-4)}`;
    (byId('ee-id') as HTMLInputElement).disabled = !!eq;
    (byId('ee-name') as HTMLInputElement).value = eq ? eq.name : '';
    (byId('ee-slot') as HTMLSelectElement).value = eq ? eq.slot : 'WEAPON';
    (byId('ee-weapon-type') as HTMLSelectElement).value = eq ? (eq.weaponType || 'GREATSWORD') : 'GREATSWORD';
    (byId('ee-tier') as HTMLSelectElement).value = eq ? String(eq.tier) : '1';
    (byId('ee-element') as HTMLSelectElement).value = eq ? (eq.element || 'NONE') : 'NONE';

    const eff = eq?.combatEffects || {};
    (byId('ee-patk') as HTMLInputElement).value = String(eff.patk || 0);
    (byId('ee-matk') as HTMLInputElement).value = String(eff.matk || 0);
    (byId('ee-pdef') as HTMLInputElement).value = String(eff.pdef || 0);
    (byId('ee-mdef') as HTMLInputElement).value = String(eff.mdef || 0);
    (byId('ee-hp') as HTMLInputElement).value = String(eff.hp || 0);
    (byId('ee-mp') as HTMLInputElement).value = String(eff.mp || 0);
    (byId('ee-hit') as HTMLInputElement).value = String(eff.hit || 0);
    (byId('ee-crit') as HTMLInputElement).value = String(eff.crit || 5);

    const pool = eq?.affixPool || [];
    (byId('affix-sharp') as HTMLInputElement).checked = pool.includes('鋒利');
    (byId('affix-arcane') as HTMLInputElement).checked = pool.includes('奧術');
    (byId('affix-stalwart') as HTMLInputElement).checked = pool.includes('堅定');
    (byId('affix-swift') as HTMLInputElement).checked = pool.includes('疾風');
    (byId('affix-deadly') as HTMLInputElement).checked = pool.includes('致命');
    (byId('affix-vampire') as HTMLInputElement).checked = pool.includes('嗜血');

    (byId('ee-desc') as HTMLTextAreaElement).value = eq ? (eq.description || '') : '';
    (byId('ee-flavor') as HTMLTextAreaElement).value = eq ? (eq.flavorText || '') : '';
    byId('ee-icon').textContent = eq ? (eq.icon || '🗡️') : '🗡️';

    byId('modal-equipment-editor').style.display = 'flex';
  }

  private openRecipeEditor(id: string | null): void {
    this.activeEditingType = 'recipe';
    this.activeEditingId = id;
    const r = id ? this.recipes.find(rec => rec.id === id) : null;

    byId('re-title').textContent = r ? `🔨 編輯鍛造配方 - ${r.id}` : '🔨 新增鍛造配方';
    (byId('re-id') as HTMLInputElement).value = r ? r.id : `recipe_new_${Date.now().toString().slice(-4)}`;
    (byId('re-id') as HTMLInputElement).disabled = !!r;
    (byId('re-gold') as HTMLInputElement).value = r ? String(r.goldCost || 100) : '150';

    const targetSel = byId<HTMLSelectElement>('re-target-equip');
    targetSel.innerHTML = this.equipment.map(e => `<option value="${e.id}" ${r && r.targetEquipmentId === e.id ? 'selected' : ''}>${e.name} (${e.id})</option>`).join('');

    const mat1Sel = byId<HTMLSelectElement>('re-mat-1');
    const mat2Sel = byId<HTMLSelectElement>('re-mat-2');
    const matOpts = this.materials.map(m => `<option value="${m.id}">${m.name} (${m.id})</option>`).join('');

    mat1Sel.innerHTML = matOpts;
    mat2Sel.innerHTML = `<option value="">(無)</option>` + matOpts;

    const req = r ? Object.entries(r.requiredMaterials || {}) : [];
    if (req[0]) {
      mat1Sel.value = req[0][0];
      (byId('re-mat-count-1') as HTMLInputElement).value = String(req[0][1]);
    }
    if (req[1]) {
      mat2Sel.value = req[1][0];
      (byId('re-mat-count-2') as HTMLInputElement).value = String(req[1][1]);
    }

    byId('modal-recipe-editor').style.display = 'flex';
  }

  private bindSaveHandlers(): void {
    byId('btn-save-me').onclick = () => {
      const id = (byId('me-id') as HTMLInputElement).value.trim();
      const name = (byId('me-name') as HTMLInputElement).value.trim();
      if (!id || !name) return alert('請填寫素材 ID 與名稱');

      const mat: MaterialItem = {
        id,
        name,
        tier: Number((byId('me-tier') as HTMLSelectElement).value) || 1,
        category: (byId('me-category') as HTMLSelectElement).value as any,
        basePrice: Number((byId('me-value') as HTMLInputElement).value) || 20,
        description: (byId('me-desc') as HTMLTextAreaElement).value.trim(),
        flavorText: (byId('me-flavor') as HTMLTextAreaElement).value.trim(),
        icon: byId('me-icon').textContent || '🪵'
      };

      const existingIdx = this.materials.findIndex(m => m.id === id);
      if (existingIdx >= 0) this.materials[existingIdx] = mat;
      else this.materials.push(mat);

      byId('modal-material-editor').style.display = 'none';
      this.renderLeftColumn();
    };

    byId('btn-save-ie').onclick = () => {
      const id = (byId('ie-id') as HTMLInputElement).value.trim();
      const name = (byId('ie-name') as HTMLInputElement).value.trim();
      if (!id || !name) return alert('請填寫道具 ID 與名稱');

      const it: ConsumableItem = {
        id,
        name,
        category: 'CONSUMABLE',
        icon: byId('ie-icon').textContent || '🧪',
        tier: 1,
        effectType: (byId('ie-effect-type') as HTMLSelectElement).value,
        effectValue: Number((byId('ie-effect-val') as HTMLInputElement).value) || 100,
        maxStack: Number((byId('ie-stack') as HTMLInputElement).value) || 99,
        buyPrice: 30,
        sellPrice: 12,
        description: (byId('ie-desc') as HTMLTextAreaElement).value.trim(),
        flavorText: (byId('ie-flavor') as HTMLTextAreaElement).value.trim()
      };

      const existingIdx = this.items.findIndex(i => i.id === id);
      if (existingIdx >= 0) this.items[existingIdx] = it;
      else this.items.push(it);

      byId('modal-item-editor').style.display = 'none';
      this.renderLeftColumn();
    };

    byId('btn-save-ee').onclick = () => {
      const id = (byId('ee-id') as HTMLInputElement).value.trim();
      const name = (byId('ee-name') as HTMLInputElement).value.trim();
      if (!id || !name) return alert('請填寫裝備 ID 與名稱');

      const pool: string[] = [];
      if ((byId('affix-sharp') as HTMLInputElement).checked) pool.push('鋒利');
      if ((byId('affix-arcane') as HTMLInputElement).checked) pool.push('奧術');
      if ((byId('affix-stalwart') as HTMLInputElement).checked) pool.push('堅定');
      if ((byId('affix-swift') as HTMLInputElement).checked) pool.push('疾風');
      if ((byId('affix-deadly') as HTMLInputElement).checked) pool.push('致命');
      if ((byId('affix-vampire') as HTMLInputElement).checked) pool.push('嗜血');

      const eq: CustomEquipmentTemplate = {
        id,
        name,
        slot: (byId('ee-slot') as HTMLSelectElement).value as any,
        weaponType: (byId('ee-weapon-type') as HTMLSelectElement).value as any,
        tier: Number((byId('ee-tier') as HTMLSelectElement).value) || 1,
        element: (byId('ee-element') as HTMLSelectElement).value as any,
        icon: byId('ee-icon').textContent || '🗡️',
        combatEffects: {
          patk: Number((byId('ee-patk') as HTMLInputElement).value) || 0,
          matk: Number((byId('ee-matk') as HTMLInputElement).value) || 0,
          pdef: Number((byId('ee-pdef') as HTMLInputElement).value) || 0,
          mdef: Number((byId('ee-mdef') as HTMLInputElement).value) || 0,
          hp: Number((byId('ee-hp') as HTMLInputElement).value) || 0,
          mp: Number((byId('ee-mp') as HTMLInputElement).value) || 0,
          hit: Number((byId('ee-hit') as HTMLInputElement).value) || 0,
          crit: Number((byId('ee-crit') as HTMLInputElement).value) || 5
        },
        affixPool: pool,
        description: (byId('ee-desc') as HTMLTextAreaElement).value.trim(),
        flavorText: (byId('ee-flavor') as HTMLTextAreaElement).value.trim()
      };

      const existingIdx = this.equipment.findIndex(e => e.id === id);
      if (existingIdx >= 0) this.equipment[existingIdx] = eq;
      else this.equipment.push(eq);

      byId('modal-equipment-editor').style.display = 'none';
      this.renderEquipColumn();
    };

    byId('btn-save-re').onclick = () => {
      const id = (byId('re-id') as HTMLInputElement).value.trim();
      if (!id) return alert('請填寫配方 ID');

      const targetId = (byId('re-target-equip') as HTMLSelectElement).value;
      const mat1 = (byId('re-mat-1') as HTMLSelectElement).value;
      const count1 = Number((byId('re-mat-count-1') as HTMLInputElement).value) || 1;
      const mat2 = (byId('re-mat-2') as HTMLSelectElement).value;
      const count2 = Number((byId('re-mat-count-2') as HTMLInputElement).value) || 1;

      const reqMats: Record<string, number> = { [mat1]: count1 };
      if (mat2) reqMats[mat2] = count2;

      const rec: CustomCraftingRecipe = {
        id,
        targetEquipmentId: targetId,
        tier: 1,
        requiredMaterials: reqMats,
        goldCost: Number((byId('re-gold') as HTMLInputElement).value) || 100
      };

      const existingIdx = this.recipes.findIndex(r => r.id === id);
      if (existingIdx >= 0) this.recipes[existingIdx] = rec;
      else this.recipes.push(rec);

      byId('modal-recipe-editor').style.display = 'none';
      this.renderRecipeColumn();
    };
  }

  // ── 通用圖標選擇器 ──
  private openIconPicker(callback: (icon: string) => void): void {
    this.iconPickerCallback = callback;
    const candidates = [
      '🪵', '🪨', '⛓️', '🧵', '🧶', '🪙', '💎', '🩸', '🦴', '🧪', '💧', '🌿', '🍃', '🔥', '❄️', '⚡', '☀️', '🌑',
      '🗡️', '⚔️', '🏹', '🪄', '🛡️', '👑', '💍', '📿', '📜', '📖', '🪓', '🔨', '⚙️', '💨', '🎯', '✨'
    ];
    const grid = byId('icon-picker-grid');
    grid.innerHTML = '';

    candidates.forEach(ic => {
      const btn = document.createElement('div');
      btn.style.cssText = 'padding: 6px; border: 1px solid var(--es-panel-border); border-radius: 6px; cursor: pointer; font-size: 1.8rem;';
      btn.textContent = ic;
      btn.onmouseenter = () => btn.style.borderColor = 'var(--es-gold)';
      btn.onmouseleave = () => btn.style.borderColor = 'var(--es-panel-border)';
      btn.onclick = () => {
        if (this.iconPickerCallback) this.iconPickerCallback(ic);
        byId('modal-icon-picker').style.display = 'none';
      };
      grid.appendChild(btn);
    });

    byId('modal-icon-picker').style.display = 'flex';
  }

  private getMaterialDefaultIcon(id: string): string {
    if (id.includes('iron') || id.includes('ore') || id.includes('metal')) return '🪨';
    if (id.includes('wood')) return '🪵';
    if (id.includes('cloth')) return '🧵';
    if (id.includes('leather')) return '🧶';
    if (id.includes('gem') || id.includes('crystal')) return '💎';
    return '🧱';
  }

  private getEquipDefaultIcon(slot: EquipmentSlot, weaponType?: WeaponType): string {
    if (slot === EquipmentSlot.ARMOR) return '🛡️';
    if (slot === EquipmentSlot.ACCESSORY) return '💍';
    if (weaponType === WeaponType.BOW || weaponType === WeaponType.MAGIC_BOW) return '🏹';
    if (weaponType === WeaponType.STAFF) return '🪄';
    if (weaponType === WeaponType.HOLY_BOOK) return '📖';
    if (weaponType === WeaponType.HAMMER) return '🔨';
    return '⚔️';
  }
}

// 啟動裝備素材工坊
window.addEventListener('DOMContentLoaded', () => {
  const controller = new EquipmentStudioController();
  controller.init();
});
