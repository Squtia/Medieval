import { EquipmentSlot, ElementType, WeaponType, MaterialItem } from '../models/types';
import { DataStore } from '../systems/DataStore';
import materialsJson from '../data/materials.json';
import equipmentWeaponsJson from '../data/equipment_weapons.json';
import equipmentArmorsJson from '../data/equipment_armors.json';
import equipmentAccessoriesJson from '../data/equipment_accessories.json';
import craftingRecipesJson from '../data/CraftingRecipes.json';
import itemsJson from '../data/items.json';
import defaultCustomDatasets from '../data/custom_icon_datasets.json';
import { renderUniversalIcon } from '../ui/IconSpriteHelper';
import { SkillRegistry } from '../systems/combat/SkillRegistry';
import '../styles/equipment-studio.css';

const byId = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as unknown as T;
const clone = <T>(data: T): T => JSON.parse(JSON.stringify(data));
export const EQUIPMENT_STUDIO_DRAFT_KEY = 'MEDIEVAL_EQUIPMENT_STUDIO_DRAFT_V1';

interface EquipmentStudioDraft {
  materials: MaterialItem[];
  items: ConsumableItem[];
  equipment: CustomEquipmentTemplate[];
  recipes: CustomCraftingRecipe[];
  timestamp: number;
}

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
  isLocked?: boolean;
}

export interface CustomEquipmentTemplate {
  id: string;
  name: string;
  slot: EquipmentSlot;
  weaponType?: WeaponType;
  armorType?: 'CLOTH' | 'LEATHER' | 'HEAVY';
  tier: number;
  allowedJobs?: string[];
  icon?: string;
  element?: ElementType;
  baseEffects?: Partial<Record<'str' | 'agi' | 'con' | 'int' | 'spr' | 'luk', number>>;
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
  combatStatRanges?: Partial<Record<string, [number, number]>>;
  randomPool?: {
    attributes?: ('str' | 'agi' | 'con' | 'int' | 'spr' | 'luk')[];
    combatStats?: string[];
  };
  affixPool?: string[];
  extraSkills?: string[];
  fixedSkill?: string;
  skillPool?: string[];
  skillRollChance?: number;
  skillRollCount?: number;
  skillTriggerChances?: number[];
  craftable?: boolean;
  droppable?: boolean;
  shopBuyable?: boolean;
  description?: string;
  flavorText?: string;
  isLocked?: boolean;
}

export interface CustomCraftingRecipe {
  id: string;
  name?: string;
  tier: number;
  targetEquipmentId: string;
  requiredMaterials: Record<string, number>;
  goldCost: number;
  isLocked?: boolean;
}

export class EquipmentStudioController {
  private materials: MaterialItem[] = [];
  private items: ConsumableItem[] = [];
  private equipment: CustomEquipmentTemplate[] = [];
  private recipes: CustomCraftingRecipe[] = [];
  private draftRevision = 0;
  private iconDatasets: Record<string, any> = defaultCustomDatasets || {};
  private currentIconPickerTab: string = 'materials';

  private leftTab: 'materials' | 'items' = 'materials';

  private activeEditingType: 'material' | 'item' | 'equipment' | 'recipe' = 'material';
  private activeEditingId: string | null = null;

  private iconPickerCallback: ((icon: string) => void) | null = null;
  private skillPickerCallback: ((skillId: string) => void) | null = null;
  private currentSkillCategoryFilter: string = 'ALL';
  private currentSkillPool: string[] = [];
  private isIconPickerFlipped: boolean = false;

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
    let loadedFromDisk = false;
    try {
      const res = await fetch('/api/get-equipment-studio-data');
      if (res.ok) {
        const data = await res.json();
        this.materials = (Array.isArray(data.materials) ? data.materials : clone(materialsJson)) as MaterialItem[];
        this.items = (Array.isArray(data.items) ? data.items : clone(itemsJson)) as ConsumableItem[];
        this.equipment = data.equipment !== undefined ? this.normalizeEquipmentList(data.equipment) : this.getFallbackEquipmentList();
        this.recipes = (Array.isArray(data.recipes) ? data.recipes : clone(craftingRecipesJson)) as CustomCraftingRecipe[];
        loadedFromDisk = true;
      }
    } catch (err) {
      console.warn('讀取裝備工坊專案資料失敗，改用內建資料:', err);
    }

    if (!loadedFromDisk) {
      this.fallbackLocalData();
    }

    this.restoreDraft();

    try {
      const iconRes = await fetch('/api/get-icon-config');
      if (iconRes.ok) {
        const iconData = await iconRes.json();
        if (iconData.datasets) {
          this.iconDatasets = { ...(defaultCustomDatasets || {}), ...iconData.datasets };
        }
      }
    } catch {}
  }

  private getFallbackEquipmentList(): CustomEquipmentTemplate[] {
    const list: any[] = [];
    if (Array.isArray(equipmentWeaponsJson)) list.push(...clone(equipmentWeaponsJson));
    if (Array.isArray(equipmentArmorsJson)) list.push(...clone(equipmentArmorsJson));
    if (Array.isArray(equipmentAccessoriesJson)) list.push(...clone(equipmentAccessoriesJson));
    return this.normalizeEquipmentList(list);
  }

  private normalizeEquipmentList(raw: any): CustomEquipmentTemplate[] {
    let list: any[] = [];
    if (Array.isArray(raw)) {
      list = clone(raw);
    } else if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.weapons)) list.push(...clone(raw.weapons));
      if (Array.isArray(raw.armors)) list.push(...clone(raw.armors));
      if (Array.isArray(raw.accessories)) list.push(...clone(raw.accessories));
      if (list.length === 0) {
        list = Object.values(raw).filter(v => v && typeof v === 'object' && !Array.isArray(v));
      }
    }
    return list.map(e => ({
      id: e.id || `eq_${Date.now()}`,
      name: e.name || '未知裝備',
      slot: e.slot || (e.weaponType ? EquipmentSlot.WEAPON : EquipmentSlot.ARMOR),
      weaponType: e.weaponType,
      armorType: e.armorType,
      tier: Number(e.tier) || 1,
      icon: e.icon || '',
      element: e.element || ElementType.NONE,
      baseEffects: e.baseEffects || e.effects || {},
      combatEffects: {
        patk: e.combatEffects?.patk ?? e.baseCombatEffects?.patk ?? 0,
        matk: e.combatEffects?.matk ?? e.baseCombatEffects?.matk ?? 0,
        pdef: e.combatEffects?.pdef ?? e.baseCombatEffects?.pdef ?? 0,
        mdef: e.combatEffects?.mdef ?? e.baseCombatEffects?.mdef ?? 0,
        hp: e.combatEffects?.hp ?? e.baseCombatEffects?.hp ?? 0,
        mp: e.combatEffects?.mp ?? e.baseCombatEffects?.mp ?? 0,
        hit: e.combatEffects?.hit ?? e.baseCombatEffects?.hit ?? 0,
        evade: e.combatEffects?.evade ?? e.baseCombatEffects?.evade ?? 0,
        crit: e.combatEffects?.crit ?? e.baseCombatEffects?.crit ?? (e.slot === EquipmentSlot.WEAPON ? 5 : 0)
      },
      combatStatRanges: e.combatStatRanges || {},
      randomPool: e.randomPool || {},
      affixPool: e.affixPool || ['鋒利', '堅定'],
      extraSkills: e.extraSkills || [],
      skillTriggerChances: e.skillTriggerChances || [],
      allowedJobs: (e.allowedJobs && e.allowedJobs.length > 0)
        ? e.allowedJobs
        : DataStore.getDefaultAllowedJobs(e.slot || (e.weaponType ? EquipmentSlot.WEAPON : EquipmentSlot.ARMOR), e.weaponType, e.armorType),
      craftable: e.craftable !== false,
      droppable: e.droppable !== false,
      shopBuyable: e.shopBuyable !== false,
      description: e.description || '',
      flavorText: e.flavorText || '',
      isLocked: !!e.isLocked
    }));
  }

  private fallbackLocalData(): void {
    this.materials = clone(materialsJson) as any;
    this.items = clone(itemsJson) as ConsumableItem[];
    this.equipment = this.getFallbackEquipmentList();
    this.recipes = clone(craftingRecipesJson) as any;
  }

  private restoreDraft(): void {
    try {
      const raw = localStorage.getItem(EQUIPMENT_STUDIO_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<EquipmentStudioDraft>;
      if (!Array.isArray(draft.materials) || !Array.isArray(draft.items) || !Array.isArray(draft.equipment) || !Array.isArray(draft.recipes)) {
        throw new Error('草稿格式不完整');
      }
      this.materials = draft.materials;
      this.items = draft.items;
      this.equipment = this.normalizeEquipmentList(draft.equipment);
      this.recipes = draft.recipes;
      console.info('📝 已恢復裝備工坊本機草稿');
    } catch (err) {
      console.warn('讀取裝備工坊草稿失敗，保留專案磁碟資料:', err);
    }
  }

  private saveDraft(): void {
    try {
      this.draftRevision += 1;
      const draft: EquipmentStudioDraft = {
        materials: this.materials,
        items: this.items,
        equipment: this.equipment,
        recipes: this.recipes,
        timestamp: Date.now()
      };
      localStorage.setItem(EQUIPMENT_STUDIO_DRAFT_KEY, JSON.stringify(draft));
    } catch (err) {
      console.warn('寫入裝備工坊草稿失敗:', err);
    }
  }

  private clearDraft(): void {
    try {
      localStorage.removeItem(EQUIPMENT_STUDIO_DRAFT_KEY);
    } catch (err) {
      console.warn('清除裝備工坊草稿失敗:', err);
    }
  }

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
              <div class="es-card-avatar" data-open-icon-mat="${m.id}" title="點擊切換圖標">${renderUniversalIcon(icon, 36)}</div>
              <div>
                <div style="font-size: 0.85rem; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                  <span>${m.name}</span>
                  ${m.isLocked ? '<span title="已上鎖保護" style="font-size: 0.75rem;">🔒</span>' : ''}
                </div>
                <div style="font-size: 0.7rem; color: var(--es-text-muted);">${m.id}</div>
              </div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <span class="es-badge es-badge-t${m.tier}">T${m.tier}</span>
              <button class="es-btn es-btn-sm" data-toggle-lock-mat="${m.id}" title="${m.isLocked ? '🔒 已上鎖保護 (點擊解鎖)' : '🔓 未上鎖 (點擊上鎖防誤刪)'}">${m.isLocked ? '🔒' : '🔓'}</button>
              <button class="es-btn es-btn-sm" data-edit-mat="${m.id}">✎</button>
              <button class="es-btn es-btn-sm es-btn-danger" data-del-mat="${m.id}" ${m.isLocked ? 'style="opacity: 0.35; cursor: not-allowed;" title="🔒 已上鎖保護，請先解鎖再刪除"' : ''}>✕</button>
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
        const icon = it.icon || '🧪';
        card.innerHTML = `
          <div class="es-card-header">
            <div class="es-card-title">
              <div class="es-card-avatar" data-open-icon-item="${it.id}" title="點擊切換圖標">${renderUniversalIcon(icon, 36)}</div>
              <div>
                <div style="font-size: 0.85rem; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                  <span>${it.name}</span>
                  ${it.isLocked ? '<span title="已上鎖保護" style="font-size: 0.75rem;">🔒</span>' : ''}
                </div>
                <div style="font-size: 0.7rem; color: var(--es-text-muted);">${it.id}</div>
              </div>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <span class="es-badge es-badge-t${it.tier}">T${it.tier}</span>
              <button class="es-btn es-btn-sm" data-toggle-lock-item="${it.id}" title="${it.isLocked ? '🔒 已上鎖保護 (點擊解鎖)' : '🔓 未上鎖 (點擊上鎖防誤刪)'}">${it.isLocked ? '🔒' : '🔓'}</button>
              <button class="es-btn es-btn-sm" data-edit-item="${it.id}">✎</button>
              <button class="es-btn es-btn-sm es-btn-danger" data-del-item="${it.id}" ${it.isLocked ? 'style="opacity: 0.35; cursor: not-allowed;" title="🔒 已上鎖保護，請先解鎖再刪除"' : ''}>✕</button>
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
      const icon = eq.icon || this.getEquipDefaultIcon(eq.slot, eq.weaponType, eq.tier);
      const elemText = eq.element && eq.element !== ElementType.NONE ? `<span style="color: var(--es-gold);">[${eq.element}]</span>` : '';

      const patk = eff.patk ?? (eq.slot === EquipmentSlot.WEAPON ? eq.tier * 15 : 0);
      const matk = eff.matk ?? 0;
      const pdef = eff.pdef ?? (eq.slot === EquipmentSlot.ARMOR ? eq.tier * 10 : 0);
      const mdef = eff.mdef ?? 0;
      const hp = eff.hp ?? (eq.slot === EquipmentSlot.ARMOR ? eq.tier * 30 : 0);
      const crit = eff.crit ?? (eq.slot === EquipmentSlot.WEAPON ? 5 : 0);

      const effAtk10 = Math.max(patk, matk) + 40;
      const avgDef10 = Math.floor((pdef + mdef) / 2) + 30;
      const maxHp10 = hp + 50;
      const power10 = effAtk10 + Math.floor(avgDef10 * 0.6) + Math.floor(maxHp10 * 0.2);

      const sourceBadges = [];
      if (eq.craftable !== false) sourceBadges.push(`<span style="background: rgba(230,180,34,0.15); color: var(--es-gold); padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">🔨鍛造</span>`);
      if (eq.droppable !== false) sourceBadges.push(`<span style="background: rgba(168,85,247,0.15); color: #c084fc; padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">👾掉落</span>`);
      if (eq.shopBuyable !== false) sourceBadges.push(`<span style="background: rgba(59,130,246,0.15); color: #60a5fa; padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">🏪商店</span>`);

      const sixEffects = eq.baseEffects || {};
      const sixBadges = Object.entries(sixEffects)
        .filter(([_, val]) => Number(val) > 0)
        .map(([k, val]) => `<span style="background: #1c2128; color: #58a6ff; padding: 1px 4px; border-radius: 3px; font-size: 0.65rem; border: 1px solid rgba(88,166,255,0.3);">${k.toUpperCase()}+${val}</span>`)
        .join(' ');

      const AFFIX_META_MAP: Record<string, { name: string; desc: string }> = {
        AFFIX_SHARP: { name: '鋒利', desc: '物理攻擊力加成 (+PATK)' },
        AFFIX_ARCANE: { name: '奧術', desc: '魔法攻擊力加成 (+MATK)' },
        AFFIX_DEADLY: { name: '致命', desc: '暴擊率加成 (+Crit Rate)' },
        AFFIX_ARMOR_PIERCING: { name: '破甲', desc: '無視部分防禦與提升命中 (+Hit)' },
        AFFIX_BLOODTHIRSTY: { name: '嗜血', desc: '物理吸血與傷害加成' },
        AFFIX_STALWART: { name: '堅定', desc: '生命上限與耐力加成 (+HP)' },
        AFFIX_STURDY: { name: '堅定', desc: '生命上限與防禦加成 (+HP/PDEF)' },
        AFFIX_IRON_WALL: { name: '鐵壁', desc: '物理防禦力加成 (+PDEF)' },
        AFFIX_MAGIC_RESIST: { name: '抗魔', desc: '魔法防禦力加成 (+MDEF)' },
        AFFIX_BLOCK: { name: '格擋', desc: '格擋率與減傷加成' },
        AFFIX_SWIFT: { name: '疾風', desc: '命中率與閃避率加成 (+Hit/Evade)' },
        AFFIX_MEDITATION: { name: '冥想', desc: '魔力上限與魔力回復 (+MP)' },
        AFFIX_ALMIGHTY: { name: '全能', desc: '全基礎六維屬性小幅加成' },
        '鋒利': { name: '鋒利', desc: '物理攻擊力加成 (+PATK)' },
        '奧術': { name: '奧術', desc: '魔法攻擊力加成 (+MATK)' },
        '致命': { name: '致命', desc: '暴擊率加成 (+Crit Rate)' },
        '破甲': { name: '破甲', desc: '無視部分防禦與提升命中 (+Hit)' },
        '嗜血': { name: '嗜血', desc: '物理吸血與傷害加成' },
        '堅定': { name: '堅定', desc: '生命上限與耐力加成 (+HP)' },
        '鐵壁': { name: '鐵壁', desc: '物理防禦力加成 (+PDEF)' },
        '抗魔': { name: '抗魔', desc: '魔法防禦力加成 (+MDEF)' },
        '格擋': { name: '格擋', desc: '格擋率與減傷加成' },
        '疾風': { name: '疾風', desc: '命中率與閃避率加成 (+Hit/Evade)' },
        '冥想': { name: '冥想', desc: '魔力上限與魔力回復 (+MP)' },
        '全能': { name: '全能', desc: '全基礎六維屬性小幅加成' }
      };

      const affixesHtml = (eq.affixPool && eq.affixPool.length > 0)
        ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
            ${eq.affixPool.map(af => {
              const meta = AFFIX_META_MAP[af] || { name: af, desc: af };
              return `<span class="es-affix-tag" title="${meta.name}: ${meta.desc}" style="cursor: help;">🎲 ${meta.name}</span>`;
            }).join('')}
           </div>`
        : '';

      const fixedSkillMeta = eq.fixedSkill ? SkillRegistry.getSkill(eq.fixedSkill) : null;
      const fixedSkillBadge = eq.fixedSkill
        ? `<span style="background: rgba(234,179,8,0.15); color: #fde047; padding: 1px 5px; border-radius: 3px; font-size: 0.68rem; border: 1px solid rgba(234,179,8,0.4);">✨ ${fixedSkillMeta?.name || eq.fixedSkill}</span>`
        : '';
      const poolBadge = (eq.skillPool && eq.skillPool.length > 0)
        ? `<span style="background: rgba(168,85,247,0.15); color: #d8b4fe; padding: 1px 5px; border-radius: 3px; font-size: 0.68rem; border: 1px solid rgba(168,85,247,0.4);" title="${eq.skillPool.join(', ')}">🎲 隨機池: ${eq.skillPool.length}款 (${eq.skillRollChance ?? 100}%抽${eq.skillRollCount || 1})</span>`
        : '';
      const legacySkillsBadge = (!eq.fixedSkill && !eq.skillPool && eq.extraSkills && eq.extraSkills.length > 0)
        ? eq.extraSkills.filter(Boolean).map(s => `<span style="background: rgba(234,179,8,0.15); color: #fde047; padding: 1px 5px; border-radius: 3px; font-size: 0.68rem; border: 1px solid rgba(234,179,8,0.4);">✨ ${s}</span>`).join('')
        : '';

      const skillsHtml = (fixedSkillBadge || poolBadge || legacySkillsBadge)
        ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
            ${fixedSkillBadge}
            ${poolBadge}
            ${legacySkillsBadge}
           </div>`
        : '';

      card.innerHTML = `
        <div class="es-card-header">
          <div class="es-card-title">
            <div class="es-card-avatar" data-open-icon-equip="${eq.id}" title="點擊切換圖標">${renderUniversalIcon(icon, 36)}</div>
            <div>
              <div style="font-size: 0.88rem; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                <span>${elemText} ${eq.name}</span>
                ${eq.isLocked ? '<span title="已上鎖保護" style="font-size: 0.75rem;">🔒</span>' : ''}
              </div>
              <div style="font-size: 0.7rem; color: var(--es-text-muted); display: flex; gap: 4px; align-items: center;">
                <span>${eq.weaponType || eq.slot} · ${eq.id}</span>
                ${sourceBadges.join('')}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 4px; align-items: center;">
            <span class="es-badge es-badge-t${eq.tier}">T${eq.tier}</span>
            <button class="es-btn es-btn-sm" data-toggle-lock-equip="${eq.id}" title="${eq.isLocked ? '🔒 已上鎖保護 (點擊解鎖)' : '🔓 未上鎖 (點擊上鎖防誤刪)'}">${eq.isLocked ? '🔒' : '🔓'}</button>
            <button class="es-btn es-btn-sm" data-edit-equip="${eq.id}">✎</button>
            <button class="es-btn es-btn-sm es-btn-danger" data-del-equip="${eq.id}" ${eq.isLocked ? 'style="opacity: 0.35; cursor: not-allowed;" title="🔒 已上鎖保護，請先解鎖再刪除"' : ''}>✕</button>
          </div>
        </div>

        ${sixBadges ? `<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px;">${sixBadges}</div>` : ''}

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
        ${skillsHtml}
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
      const targetMat = !targetEq ? this.materials.find(m => m.id === r.targetEquipmentId) : null;
      const targetIt = !targetEq && !targetMat ? this.items.find(i => i.id === r.targetEquipmentId) : null;
      const name = r.name || targetEq?.name || targetMat?.name || targetIt?.name || r.id;
      return name.toLowerCase().includes(search) || r.id.toLowerCase().includes(search);
    });

    filtered.forEach(r => {
      const card = document.createElement('div');
      card.className = 'es-card';

      // 🧠 全庫智慧自動判讀 (裝備 ➔ 素材 ➔ 道具)
      const targetEq = this.equipment.find(e => e.id === r.targetEquipmentId);
      const targetMat = !targetEq ? this.materials.find(m => m.id === r.targetEquipmentId) : null;
      const targetIt = !targetEq && !targetMat ? this.items.find(i => i.id === r.targetEquipmentId) : null;

      let eqName = r.targetEquipmentId;
      let eqIcon = '📦';
      let typeBadge = '';

      if (targetEq) {
        eqName = targetEq.name || r.name || r.targetEquipmentId;
        eqIcon = targetEq.icon || this.getEquipDefaultIcon(targetEq.slot, targetEq.weaponType, targetEq.tier);
        typeBadge = `<span style="background: rgba(230,180,34,0.15); color: var(--es-gold); padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">⚔️裝備</span>`;
      } else if (targetMat) {
        eqName = targetMat.name || r.name || r.targetEquipmentId;
        eqIcon = targetMat.icon || this.getMaterialDefaultIcon(targetMat.id);
        typeBadge = `<span style="background: rgba(16,185,129,0.15); color: #34d399; padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">🧱素材提煉</span>`;
      } else if (targetIt) {
        eqName = targetIt.name || r.name || r.targetEquipmentId;
        eqIcon = targetIt.icon || '🧪';
        typeBadge = `<span style="background: rgba(59,130,246,0.15); color: #60a5fa; padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">🧪道具</span>`;
      }

      const matsHtml = Object.entries(r.requiredMaterials || {}).map(([matId, count]) => {
        const mat = this.materials.find(m => m.id === matId);
        const matName = mat?.name || matId;
        const matIcon = mat?.icon || this.getMaterialDefaultIcon(matId);
        return `<span style="background: #161b22; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; border: 1px solid var(--es-panel-border); display: inline-flex; align-items: center; gap: 4px;">${renderUniversalIcon(matIcon, 16)} ${matName} x${count}</span>`;
      }).join(' ');

      card.innerHTML = `
        <div class="es-card-header">
          <div class="es-card-title">
            <div class="es-card-avatar" data-open-icon-recipe="${r.id}" title="點擊切換產出目標圖標">${renderUniversalIcon(eqIcon, 36)}</div>
            <div>
              <div style="font-size: 0.85rem; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                <span>${eqName} 配方</span>
                ${typeBadge}
                ${r.isLocked ? '<span title="已上鎖保護" style="font-size: 0.75rem;">🔒</span>' : ''}
              </div>
              <div style="font-size: 0.7rem; color: var(--es-text-muted);">${r.id} ➔ ${eqName}</div>
            </div>
          </div>
          <div style="display: flex; gap: 4px; align-items: center;">
            <span class="es-badge es-badge-t${r.tier || 1}">T${r.tier || 1}</span>
            <button class="es-btn es-btn-sm" data-toggle-lock-recipe="${r.id}" title="${r.isLocked ? '🔒 已上鎖保護 (點擊解鎖)' : '🔓 未上鎖 (點擊上鎖防誤刪)'}">${r.isLocked ? '🔒' : '🔓'}</button>
            <button class="es-btn es-btn-sm" data-edit-recipe="${r.id}">✎</button>
            <button class="es-btn es-btn-sm es-btn-danger" data-del-recipe="${r.id}" ${r.isLocked ? 'style="opacity: 0.35; cursor: not-allowed;" title="🔒 已上鎖保護，請先解鎖再刪除"' : ''}>✕</button>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px;">
          ${matsHtml}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; color: var(--es-gold); margin-top: 4px; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 4px;">
          <span>💰 消耗金幣: <b>${r.goldCost || 100}</b></span>
          <button class="es-btn es-btn-sm" data-simulate-craft="${r.id}" style="padding: 1px 6px;">🔨 模擬製作</button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  private async saveAllToDisk(): Promise<boolean> {
    this.saveDraft();
    const savingRevision = this.draftRevision;
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      if (this.draftRevision === savingRevision) this.clearDraft();
      alert(`💾 成功永久寫入專案磁碟！快照版本：${data.snapshot}`);
      return true;
    } catch (err: any) {
      alert(`⚠️ 寫入專案磁碟失敗：${err.message}\n你的修改已保存在本機草稿，重開工坊仍可恢復。`);
      return false;
    }
  }

  private bindEvents(): void {
    byId('btn-nav-combat').onclick = () => window.open('combat-studio.html', '_blank');
    byId('btn-nav-skill').onclick = () => window.open('skill-workshop.html', '_blank');
    byId('btn-nav-icon').onclick = () => window.open('icon-studio.html', '_blank');
    byId('btn-nav-story').onclick = () => window.open('story-studio.html', '_blank');

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

    byId('es-search-left').oninput = () => this.renderLeftColumn();
    byId('es-filter-left-tier').onchange = () => this.renderLeftColumn();
    byId('es-search-equip').oninput = () => this.renderEquipColumn();
    byId('es-filter-equip-slot').onchange = () => this.renderEquipColumn();
    byId('es-filter-equip-tier').onchange = () => this.renderEquipColumn();
    byId('es-search-recipe').oninput = () => this.renderRecipeColumn();

    byId('btn-create-mat-or-item').onclick = () => {
      if (this.leftTab === 'materials') {
        this.openMaterialEditor(null);
      } else {
        this.openItemEditor(null);
      }
    };

    byId('btn-create-equipment').onclick = () => this.openEquipmentEditor(null);
    byId('btn-create-recipe').onclick = () => this.openRecipeEditor(null);

    byId('btn-save-all-disk').onclick = () => { void this.saveAllToDisk(); };

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

    byId('btn-close-me').onclick = () => byId('modal-material-editor').style.display = 'none';
    byId('btn-cancel-me').onclick = () => byId('modal-material-editor').style.display = 'none';
    byId('btn-close-ie').onclick = () => byId('modal-item-editor').style.display = 'none';
    byId('btn-cancel-ie').onclick = () => byId('modal-item-editor').style.display = 'none';
    byId('btn-close-ee').onclick = () => byId('modal-equipment-editor').style.display = 'none';
    byId('btn-cancel-ee').onclick = () => byId('modal-equipment-editor').style.display = 'none';
    byId('btn-close-re').onclick = () => byId('modal-recipe-editor').style.display = 'none';
    byId('btn-cancel-re').onclick = () => byId('modal-recipe-editor').style.display = 'none';
    byId('btn-close-icon-picker').onclick = () => byId('modal-icon-picker').style.display = 'none';

    const btnPickerFlip = byId('btn-icon-picker-flip');
    if (btnPickerFlip) {
      btnPickerFlip.onclick = () => {
        this.isIconPickerFlipped = !this.isIconPickerFlipped;
        this.updateIconPickerFlipBtnState();
        this.renderIconPickerItems(this.currentIconPickerTab);
      };
    }

    byId('btn-re-add-mat').onclick = () => this.addRecipeMatRow();

    this.bindSaveHandlers();

    document.addEventListener('click', async (e) => {
      const target = (e.target as HTMLElement).closest('[data-toggle-lock-mat], [data-toggle-lock-item], [data-toggle-lock-equip], [data-toggle-lock-recipe], [data-edit-mat], [data-del-mat], [data-edit-item], [data-del-item], [data-edit-equip], [data-del-equip], [data-edit-recipe], [data-del-recipe], [data-simulate-craft], [data-open-icon-mat], [data-open-icon-item], [data-open-icon-equip], [data-restore-snap], [data-del-recipe-mat-row]') as HTMLElement;
      if (!target) return;

      if (target.dataset.toggleLockMat) {
        const id = target.dataset.toggleLockMat;
        const m = this.materials.find(mat => mat.id === id);
        if (m) { m.isLocked = !m.isLocked; this.saveDraft(); this.renderLeftColumn(); }
        return;
      }
      if (target.dataset.toggleLockItem) {
        const id = target.dataset.toggleLockItem;
        const it = this.items.find(item => item.id === id);
        if (it) { it.isLocked = !it.isLocked; this.saveDraft(); this.renderLeftColumn(); }
        return;
      }
      if (target.dataset.toggleLockEquip) {
        const id = target.dataset.toggleLockEquip;
        const eq = this.equipment.find(e => e.id === id);
        if (eq) { eq.isLocked = !eq.isLocked; this.saveDraft(); this.renderEquipColumn(); }
        return;
      }
      if (target.dataset.toggleLockRecipe) {
        const id = target.dataset.toggleLockRecipe;
        const r = this.recipes.find(rec => rec.id === id);
        if (r) { r.isLocked = !r.isLocked; this.saveDraft(); this.renderRecipeColumn(); }
        return;
      }

      if (target.dataset.delRecipeMatRow !== undefined) {
        const row = target.closest('.es-recipe-mat-row');
        if (row) row.remove();
        return;
      }

      if (target.dataset.editMat) this.openMaterialEditor(target.dataset.editMat);
      if (target.dataset.delMat) {
        const id = target.dataset.delMat;
        const m = this.materials.find(mat => mat.id === id);
        if (m?.isLocked) { alert(`🔒 素材 [${m.name}] 已上鎖保護，請解鎖後再刪除。`); return; }
        if (confirm(`確定要刪除素材 [${id}] 嗎？`)) {
          this.materials = this.materials.filter(m => m.id !== id);
          this.saveDraft();
          this.renderLeftColumn();
        }
      }

      if (target.dataset.editItem) this.openItemEditor(target.dataset.editItem);
      if (target.dataset.delItem) {
        const id = target.dataset.delItem;
        const it = this.items.find(item => item.id === id);
        if (it?.isLocked) { alert(`🔒 道具 [${it.name}] 已上鎖保護，請解鎖後再刪除。`); return; }
        if (confirm(`確定要刪除道具 [${id}] 嗎？`)) {
          this.items = this.items.filter(it => it.id !== id);
          this.saveDraft();
          this.renderLeftColumn();
        }
      }

      if (target.dataset.editEquip) this.openEquipmentEditor(target.dataset.editEquip);
      if (target.dataset.delEquip) {
        const id = target.dataset.delEquip;
        const eq = this.equipment.find(e => e.id === id);
        if (eq?.isLocked) { alert(`🔒 裝備 [${eq.name}] 已上鎖保護，請解鎖後再刪除。`); return; }
        if (confirm(`確定要刪除裝備 [${id}] 嗎？`)) {
          this.equipment = this.equipment.filter(eq => eq.id !== id);
          this.saveDraft();
          this.renderEquipColumn();
        }
      }

      if (target.dataset.editRecipe) this.openRecipeEditor(target.dataset.editRecipe);
      if (target.dataset.delRecipe) {
        const id = target.dataset.delRecipe;
        const r = this.recipes.find(rec => rec.id === id);
        if (r?.isLocked) { alert(`🔒 鍛造配方 [${r.name || id}] 已上鎖保護，請解鎖後再刪除。`); return; }
        if (confirm(`確定要刪除配方 [${id}] 嗎？`)) {
          this.recipes = this.recipes.filter(r => r.id !== id);
          this.saveDraft();
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
            this.saveDraft();
            this.renderLeftColumn();
          });
        }
      }

      if (target.dataset.openIconItem) {
        const it = this.items.find(item => item.id === target.dataset.openIconItem);
        if (it) {
          this.openIconPicker(ic => {
            it.icon = ic;
            this.saveDraft();
            this.renderLeftColumn();
          });
        }
      }

      if (target.dataset.openIconEquip) {
        const eq = this.equipment.find(e => e.id === target.dataset.openIconEquip);
        if (eq) {
          this.openIconPicker(ic => {
            eq.icon = ic;
            this.saveDraft();
            this.renderEquipColumn();
          });
        }
      }

      if (target.dataset.openIconRecipe) {
        const r = this.recipes.find(rec => rec.id === target.dataset.openIconRecipe);
        if (r) {
          const eq = this.equipment.find(e => e.id === r.targetEquipmentId);
          const mat = !eq ? this.materials.find(m => m.id === r.targetEquipmentId) : null;
          const it = !eq && !mat ? this.items.find(i => i.id === r.targetEquipmentId) : null;

          this.openIconPicker(ic => {
            if (eq) { eq.icon = ic; this.renderEquipColumn(); }
            else if (mat) { mat.icon = ic; this.renderLeftColumn(); }
            else if (it) { it.icon = ic; this.renderLeftColumn(); }
            this.saveDraft();
            this.renderRecipeColumn();
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
            this.equipment = this.normalizeEquipmentList(data.equipment);
            this.recipes = data.recipes;
            this.clearDraft();
            byId('modal-history-backups').style.display = 'none';
            alert('已成功還原快照！');
            this.render();
          }
        }
      }
    });

    byId('me-icon').onclick = () => this.openIconPicker(ic => {
      byId('me-icon').innerHTML = renderUniversalIcon(ic, 40);
      byId('me-icon').dataset.iconVal = ic;
    });
    byId('ie-icon').onclick = () => this.openIconPicker(ic => {
      byId('ie-icon').innerHTML = renderUniversalIcon(ic, 40);
      byId('ie-icon').dataset.iconVal = ic;
    });
    byId('ee-icon').onclick = () => this.openIconPicker(ic => {
      byId('ee-icon').innerHTML = renderUniversalIcon(ic, 40);
      byId('ee-icon').dataset.iconVal = ic;
    });

    // 適用職業勾選事件
    byId('job-all').onchange = (e) => {
      const isAll = (e.target as HTMLInputElement).checked;
      document.querySelectorAll<HTMLInputElement>('.es-job-chk').forEach(chk => { chk.checked = isAll; });
    };

    document.querySelectorAll<HTMLInputElement>('.es-job-chk').forEach(chk => {
      chk.onchange = () => {
        const allChks = Array.from(document.querySelectorAll<HTMLInputElement>('.es-job-chk'));
        const allChecked = allChks.every(c => c.checked);
        const allJobChk = byId<HTMLInputElement>('job-all');
        if (allJobChk) allJobChk.checked = allChecked;
      };
    });

    byId('btn-es-job-preset').onclick = () => {
      const slotVal = (byId('ee-slot') as HTMLSelectElement).value as any;
      const wpnTypeVal = (byId('ee-weapon-type') as HTMLSelectElement).value as any;
      const preset = DataStore.getDefaultAllowedJobs(slotVal, wpnTypeVal);
      if (!preset || preset.length === 0) {
        (byId('job-all') as HTMLInputElement).checked = true;
        document.querySelectorAll<HTMLInputElement>('.es-job-chk').forEach(chk => { chk.checked = true; });
      } else {
        (byId('job-all') as HTMLInputElement).checked = false;
        document.querySelectorAll<HTMLInputElement>('.es-job-chk').forEach(chk => {
          chk.checked = preset.includes(chk.value);
        });
      }
    };

    // 技能挑選器事件
    byId('btn-es-pick-fixed-skill').onclick = () => this.openSkillPicker(id => this.updateFixedSkillUI(id));
    byId('btn-es-clear-fixed-skill').onclick = () => this.updateFixedSkillUI('');
    byId('btn-es-add-pool-skill').onclick = () => this.openSkillPicker(id => this.addSkillToPool(id));
    byId('btn-close-es-skill-picker').onclick = () => byId('modal-es-skill-picker').style.display = 'none';
    byId('inp-es-skill-search').oninput = () => this.renderSkillPickerGrid();
    byId('sel-es-skill-category').onchange = (e) => {
      this.currentSkillCategoryFilter = (e.target as HTMLSelectElement).value;
      this.renderSkillPickerGrid();
    };
  }

  private openMaterialEditor(id: string | null): void {
    this.activeEditingType = 'material';
    this.activeEditingId = id;
    const m = id ? this.materials.find(mat => mat.id === id) : null;
    const icon = m ? (m.icon || this.getMaterialDefaultIcon(m.id)) : 'materials:mat_iron_ingot';

    byId('me-title').textContent = m ? `🧱 編輯素材 - ${m.name}` : '🧱 創造新素材';
    (byId('me-id') as HTMLInputElement).value = m ? m.id : `mat_new_${Date.now().toString().slice(-4)}`;
    (byId('me-id') as HTMLInputElement).disabled = !!m;
    (byId('me-name') as HTMLInputElement).value = m ? m.name : '';
    (byId('me-tier') as HTMLSelectElement).value = m ? String(m.tier) : '1';
    (byId('me-category') as HTMLSelectElement).value = m ? (m.category || 'METAL') : 'METAL';
    (byId('me-value') as HTMLInputElement).value = m ? String(m.basePrice || 20) : '20';
    (byId('me-desc') as HTMLTextAreaElement).value = m ? (m.description || '') : '';
    (byId('me-flavor') as HTMLTextAreaElement).value = m ? (m.flavorText || '') : '';
    byId('me-icon').innerHTML = renderUniversalIcon(icon, 40);
    byId('me-icon').dataset.iconVal = icon;

    byId('modal-material-editor').style.display = 'flex';
  }

  private openItemEditor(id: string | null): void {
    this.activeEditingType = 'item';
    this.activeEditingId = id;
    const it = id ? this.items.find(item => item.id === id) : null;
    const icon = it ? (it.icon || '🧪') : '🧪';

    byId('ie-title').textContent = it ? `🧪 編輯道具 - ${it.name}` : '🧪 創造新道具';
    (byId('ie-id') as HTMLInputElement).value = it ? it.id : `item_new_${Date.now().toString().slice(-4)}`;
    (byId('ie-id') as HTMLInputElement).disabled = !!it;
    (byId('ie-name') as HTMLInputElement).value = it ? it.name : '';
    (byId('ie-effect-type') as HTMLSelectElement).value = it ? it.effectType : 'HEAL_HP';
    (byId('ie-effect-val') as HTMLInputElement).value = it ? String(it.effectValue || 100) : '100';
    (byId('ie-stack') as HTMLInputElement).value = it ? String(it.maxStack || 99) : '99';
    (byId('ie-desc') as HTMLTextAreaElement).value = it ? it.description : '';
    (byId('ie-flavor') as HTMLTextAreaElement).value = it ? (it.flavorText || '') : '';
    byId('ie-icon').innerHTML = renderUniversalIcon(icon, 40);
    byId('ie-icon').dataset.iconVal = icon;

    byId('modal-item-editor').style.display = 'flex';
  }

  private formatStatInput(val?: number, range?: [number, number]): string {
    if (range && range.length === 2 && range[0] !== range[1]) {
      return `${range[0]}~${range[1]}`;
    }
    return String(val || 0);
  }

  private parseStatInput(raw: string): { base: number; range?: [number, number] } {
    const trimmed = raw.trim();
    if (trimmed.includes('~') || trimmed.includes('-')) {
      const parts = trimmed.split(/[~-]/).map(p => Number(p.trim())).filter(n => !isNaN(n));
      if (parts.length >= 2) {
        const min = Math.min(parts[0], parts[1]);
        const max = Math.max(parts[0], parts[1]);
        return { base: min, range: [min, max] };
      }
    }
    const num = Number(trimmed) || 0;
    return { base: num };
  }

  private openEquipmentEditor(id: string | null): void {
    this.activeEditingType = 'equipment';
    this.activeEditingId = id;
    const eq = id ? this.equipment.find(e => e.id === id) : null;
    const icon = eq ? (eq.icon || this.getEquipDefaultIcon(eq.slot, eq.weaponType, eq.tier)) : 'weapons:GREATSWORD';

    byId('ee-title').textContent = eq ? `⚔️ 編輯裝備 - ${eq.name}` : '⚔️ 創造新裝備';
    (byId('ee-id') as HTMLInputElement).value = eq ? eq.id : `wpn_new_${Date.now().toString().slice(-4)}`;
    (byId('ee-id') as HTMLInputElement).disabled = !!eq;
    (byId('ee-name') as HTMLInputElement).value = eq ? eq.name : '';
    (byId('ee-slot') as HTMLSelectElement).value = eq ? eq.slot : 'WEAPON';
    (byId('ee-weapon-type') as HTMLSelectElement).value = eq ? (eq.weaponType || 'GREATSWORD') : 'GREATSWORD';
    (byId('ee-tier') as HTMLSelectElement).value = eq ? String(eq.tier) : '1';
    (byId('ee-element') as HTMLSelectElement).value = eq ? (eq.element || 'NONE') : 'NONE';

    (byId('ee-craftable') as HTMLInputElement).checked = eq ? (eq.craftable !== false) : true;
    (byId('ee-droppable') as HTMLInputElement).checked = eq ? (eq.droppable !== false) : true;
    (byId('ee-shop-buyable') as HTMLInputElement).checked = eq ? (eq.shopBuyable !== false) : true;

    // 載入適用職業
    const allowed = eq?.allowedJobs;
    const isAllJobs = !allowed || allowed.length === 0 || allowed.length >= 6;
    (byId('job-all') as HTMLInputElement).checked = isAllJobs;
    document.querySelectorAll<HTMLInputElement>('.es-job-chk').forEach(chk => {
      chk.checked = isAllJobs ? true : allowed.includes(chk.value);
    });

    const six = eq?.baseEffects || {};
    const rndPoolAttrs = eq?.randomPool?.attributes || [];
    (byId('ee-str') as HTMLInputElement).value = String(six.str || 0);
    (byId('ee-agi') as HTMLInputElement).value = String(six.agi || 0);
    (byId('ee-con') as HTMLInputElement).value = String(six.con || 0);
    (byId('ee-int') as HTMLInputElement).value = String(six.int || 0);
    (byId('ee-spr') as HTMLInputElement).value = String(six.spr || 0);
    (byId('ee-luk') as HTMLInputElement).value = String(six.luk || 0);

    (byId('rnd-str') as HTMLInputElement).checked = rndPoolAttrs.includes('str');
    (byId('rnd-agi') as HTMLInputElement).checked = rndPoolAttrs.includes('agi');
    (byId('rnd-con') as HTMLInputElement).checked = rndPoolAttrs.includes('con');
    (byId('rnd-int') as HTMLInputElement).checked = rndPoolAttrs.includes('int');
    (byId('rnd-spr') as HTMLInputElement).checked = rndPoolAttrs.includes('spr');
    (byId('rnd-luk') as HTMLInputElement).checked = rndPoolAttrs.includes('luk');

    const eff = eq?.combatEffects || {};
    const ranges = eq?.combatStatRanges || {};
    (byId('ee-patk') as HTMLInputElement).value = this.formatStatInput(eff.patk, ranges.patk);
    (byId('ee-matk') as HTMLInputElement).value = this.formatStatInput(eff.matk, ranges.matk);
    (byId('ee-pdef') as HTMLInputElement).value = this.formatStatInput(eff.pdef, ranges.pdef);
    (byId('ee-mdef') as HTMLInputElement).value = this.formatStatInput(eff.mdef, ranges.mdef);
    (byId('ee-hp') as HTMLInputElement).value = this.formatStatInput(eff.hp, ranges.hp);
    (byId('ee-mp') as HTMLInputElement).value = this.formatStatInput(eff.mp, ranges.mp);
    (byId('ee-hit') as HTMLInputElement).value = this.formatStatInput(eff.hit, ranges.hit);
    (byId('ee-crit') as HTMLInputElement).value = this.formatStatInput(eff.crit ?? (eq?.slot === EquipmentSlot.WEAPON ? 5 : 0), ranges.crit);

    const pool = eq?.affixPool || [];
    (byId('affix-sharp') as HTMLInputElement).checked = pool.includes('鋒利');
    (byId('affix-arcane') as HTMLInputElement).checked = pool.includes('奧術');
    (byId('affix-deadly') as HTMLInputElement).checked = pool.includes('致命');
    (byId('affix-pierce') as HTMLInputElement).checked = pool.includes('破甲');
    (byId('affix-vampire') as HTMLInputElement).checked = pool.includes('嗜血');
    (byId('affix-stalwart') as HTMLInputElement).checked = pool.includes('堅定');
    (byId('affix-ironwall') as HTMLInputElement).checked = pool.includes('鐵壁');
    (byId('affix-antimagic') as HTMLInputElement).checked = pool.includes('抗魔');
    (byId('affix-block') as HTMLInputElement).checked = pool.includes('格擋');
    (byId('affix-swift') as HTMLInputElement).checked = pool.includes('疾風');
    (byId('affix-meditation') as HTMLInputElement).checked = pool.includes('冥想');
    (byId('affix-allround') as HTMLInputElement).checked = pool.includes('全能');

    const fixedSkill = eq?.fixedSkill || (eq?.extraSkills && eq.extraSkills.length > 0 ? eq.extraSkills[0] : '');
    this.updateFixedSkillUI(fixedSkill);

    this.currentSkillPool = eq?.skillPool ? [...eq.skillPool] : (eq?.extraSkills && eq.extraSkills.length > 1 ? eq.extraSkills.slice(1) : []);
    (byId('ee-skill-roll-chance') as HTMLInputElement).value = String(eq?.skillRollChance !== undefined ? eq.skillRollChance : 100);
    (byId('ee-skill-roll-count') as HTMLSelectElement).value = String(eq?.skillRollCount || 1);
    this.renderSkillPoolBadges();

    (byId('ee-desc') as HTMLTextAreaElement).value = eq ? (eq.description || '') : '';
    (byId('ee-flavor') as HTMLTextAreaElement).value = eq ? (eq.flavorText || '') : '';
    byId('ee-icon').innerHTML = renderUniversalIcon(icon, 40);
    byId('ee-icon').dataset.iconVal = icon;

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
    const targetEquipOpts = this.equipment.map(e => `<option value="${e.id}" ${r && r.targetEquipmentId === e.id ? 'selected' : ''}>⚔️ ${e.name} (${e.id})</option>`).join('');
    const targetMatOpts = this.materials.map(m => `<option value="${m.id}" ${r && r.targetEquipmentId === m.id ? 'selected' : ''}>🧱 ${m.name} (${m.id})</option>`).join('');
    const targetItemOpts = this.items.map(i => `<option value="${i.id}" ${r && r.targetEquipmentId === i.id ? 'selected' : ''}>🧪 ${i.name} (${i.id})</option>`).join('');

    targetSel.innerHTML = `
      <optgroup label="⚔️ 裝備與武器 (${this.equipment.length} 款)">
        ${targetEquipOpts}
      </optgroup>
      <optgroup label="🧱 素材與錠材 (素材提煉/加工) (${this.materials.length} 種)">
        ${targetMatOpts}
      </optgroup>
      <optgroup label="🧪 消耗道具 (${this.items.length} 款)">
        ${targetItemOpts}
      </optgroup>
    `;

    const container = byId('re-mats-container');
    container.innerHTML = '';

    const mats = r ? Object.entries(r.requiredMaterials || {}) : [];
    if (mats.length === 0) {
      this.addRecipeMatRow(this.materials[0]?.id || 'mat_iron_ingot', 3);
    } else {
      mats.forEach(([matId, count]) => this.addRecipeMatRow(matId, count));
    }

    byId('modal-recipe-editor').style.display = 'flex';
  }

  private addRecipeMatRow(selectedMatId: string = '', defaultCount: number = 1): void {
    const container = byId('re-mats-container');
    const row = document.createElement('div');
    row.className = 'es-recipe-mat-row';

    const matOpts = this.materials.map(m => `<option value="${m.id}" ${m.id === selectedMatId ? 'selected' : ''}>${m.name} (${m.id})</option>`).join('');

    row.innerHTML = `
      <select class="es-select es-re-mat-select" style="flex: 1;">
        ${matOpts}
      </select>
      <input type="number" class="es-input es-re-mat-count" value="${defaultCount}" min="1" style="width: 70px;">
      <button class="es-btn es-btn-sm es-btn-danger" data-del-recipe-mat-row="1">✕</button>
    `;
    container.appendChild(row);
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
        icon: byId('me-icon').dataset.iconVal || 'materials:mat_iron_ingot'
      };

      const existingIdx = this.materials.findIndex(m => m.id === (this.activeEditingId || id));
      if (existingIdx >= 0) this.materials[existingIdx] = { ...this.materials[existingIdx], ...mat };
      else this.materials.push(mat);
      this.saveDraft();

      byId('modal-material-editor').style.display = 'none';
      this.renderLeftColumn();
      void this.saveAllToDisk();
    };

    byId('btn-save-ie').onclick = () => {
      const id = (byId('ie-id') as HTMLInputElement).value.trim();
      const name = (byId('ie-name') as HTMLInputElement).value.trim();
      if (!id || !name) return alert('請填寫道具 ID 與名稱');

      const it: ConsumableItem = {
        id,
        name,
        category: 'CONSUMABLE',
        icon: byId('ie-icon').dataset.iconVal || '🧪',
        tier: 1,
        effectType: (byId('ie-effect-type') as HTMLSelectElement).value,
        effectValue: Number((byId('ie-effect-val') as HTMLInputElement).value) || 100,
        maxStack: Number((byId('ie-stack') as HTMLInputElement).value) || 99,
        buyPrice: 30,
        sellPrice: 12,
        description: (byId('ie-desc') as HTMLTextAreaElement).value.trim(),
        flavorText: (byId('ie-flavor') as HTMLTextAreaElement).value.trim()
      };

      const existingIdx = this.items.findIndex(i => i.id === (this.activeEditingId || id));
      if (existingIdx >= 0) this.items[existingIdx] = { ...this.items[existingIdx], ...it };
      else this.items.push(it);
      this.saveDraft();

      byId('modal-item-editor').style.display = 'none';
      this.renderLeftColumn();
      void this.saveAllToDisk();
    };

    byId('btn-save-ee').onclick = () => {
      const id = (byId('ee-id') as HTMLInputElement).value.trim();
      const name = (byId('ee-name') as HTMLInputElement).value.trim();
      if (!id || !name) return alert('請填寫裝備 ID 與名稱');

      const pool: string[] = [];
      if ((byId('affix-sharp') as HTMLInputElement).checked) pool.push('鋒利');
      if ((byId('affix-arcane') as HTMLInputElement).checked) pool.push('奧術');
      if ((byId('affix-deadly') as HTMLInputElement).checked) pool.push('致命');
      if ((byId('affix-pierce') as HTMLInputElement).checked) pool.push('破甲');
      if ((byId('affix-vampire') as HTMLInputElement).checked) pool.push('嗜血');
      if ((byId('affix-stalwart') as HTMLInputElement).checked) pool.push('堅定');
      if ((byId('affix-ironwall') as HTMLInputElement).checked) pool.push('鐵壁');
      if ((byId('affix-antimagic') as HTMLInputElement).checked) pool.push('抗魔');
      if ((byId('affix-block') as HTMLInputElement).checked) pool.push('格擋');
      if ((byId('affix-swift') as HTMLInputElement).checked) pool.push('疾風');
      if ((byId('affix-meditation') as HTMLInputElement).checked) pool.push('冥想');
      if ((byId('affix-allround') as HTMLInputElement).checked) pool.push('全能');

      const baseEffects: Partial<Record<'str' | 'agi' | 'con' | 'int' | 'spr' | 'luk', number>> = {};
      const str = Number((byId('ee-str') as HTMLInputElement).value) || 0;
      const agi = Number((byId('ee-agi') as HTMLInputElement).value) || 0;
      const con = Number((byId('ee-con') as HTMLInputElement).value) || 0;
      const int = Number((byId('ee-int') as HTMLInputElement).value) || 0;
      const spr = Number((byId('ee-spr') as HTMLInputElement).value) || 0;
      const luk = Number((byId('ee-luk') as HTMLInputElement).value) || 0;
      if (str) baseEffects.str = str;
      if (agi) baseEffects.agi = agi;
      if (con) baseEffects.con = con;
      if (int) baseEffects.int = int;
      if (spr) baseEffects.spr = spr;
      if (luk) baseEffects.luk = luk;

      const rndAttrs: ('str' | 'agi' | 'con' | 'int' | 'spr' | 'luk')[] = [];
      if ((byId('rnd-str') as HTMLInputElement).checked) rndAttrs.push('str');
      if ((byId('rnd-agi') as HTMLInputElement).checked) rndAttrs.push('agi');
      if ((byId('rnd-con') as HTMLInputElement).checked) rndAttrs.push('con');
      if ((byId('rnd-int') as HTMLInputElement).checked) rndAttrs.push('int');
      if ((byId('rnd-spr') as HTMLInputElement).checked) rndAttrs.push('spr');
      if ((byId('rnd-luk') as HTMLInputElement).checked) rndAttrs.push('luk');

      const patkParsed = this.parseStatInput((byId('ee-patk') as HTMLInputElement).value);
      const matkParsed = this.parseStatInput((byId('ee-matk') as HTMLInputElement).value);
      const pdefParsed = this.parseStatInput((byId('ee-pdef') as HTMLInputElement).value);
      const mdefParsed = this.parseStatInput((byId('ee-mdef') as HTMLInputElement).value);
      const hpParsed = this.parseStatInput((byId('ee-hp') as HTMLInputElement).value);
      const mpParsed = this.parseStatInput((byId('ee-mp') as HTMLInputElement).value);
      const hitParsed = this.parseStatInput((byId('ee-hit') as HTMLInputElement).value);
      const critParsed = this.parseStatInput((byId('ee-crit') as HTMLInputElement).value);

      const combatStatRanges: Partial<Record<string, [number, number]>> = {};
      if (patkParsed.range) combatStatRanges.patk = patkParsed.range;
      if (matkParsed.range) combatStatRanges.matk = matkParsed.range;
      if (pdefParsed.range) combatStatRanges.pdef = pdefParsed.range;
      if (mdefParsed.range) combatStatRanges.mdef = mdefParsed.range;
      if (hpParsed.range) combatStatRanges.hp = hpParsed.range;
      if (mpParsed.range) combatStatRanges.mp = mpParsed.range;
      if (hitParsed.range) combatStatRanges.hit = hitParsed.range;
      if (critParsed.range) combatStatRanges.crit = critParsed.range;

      const fixedSkill = ((byId('ee-fixed-skill') as HTMLInputElement)?.value || '').trim();
      const skillPool = [...this.currentSkillPool];
      const skillRollChance = Number((byId('ee-skill-roll-chance') as HTMLInputElement)?.value ?? 100);
      const skillRollCount = Number((byId('ee-skill-roll-count') as HTMLSelectElement)?.value ?? 1);
      const extraSkills: string[] = [fixedSkill, ...skillPool].filter(Boolean);

      const slotVal = (byId('ee-slot') as HTMLSelectElement).value as any;
      const wpnTypeVal = (byId('ee-weapon-type') as HTMLSelectElement).value as any;
      
      const isJobAll = (byId('job-all') as HTMLInputElement).checked;
      const selectedJobs = Array.from(document.querySelectorAll<HTMLInputElement>('.es-job-chk'))
        .filter(chk => chk.checked)
        .map(chk => chk.value);
      
      const ALL_JOBS = ['戰士', '法師', '弓箭手', '騎士', '盜賊', '祈禱者'];
      const finalAllowedJobs = (isJobAll || selectedJobs.length === 0 || selectedJobs.length >= 6)
        ? ALL_JOBS
        : selectedJobs;

      const eq: CustomEquipmentTemplate = {
        id,
        name,
        slot: slotVal,
        weaponType: wpnTypeVal,
        tier: Number((byId('ee-tier') as HTMLSelectElement).value) || 1,
        element: (byId('ee-element') as HTMLSelectElement).value as any,
        allowedJobs: finalAllowedJobs,
        icon: byId('ee-icon').dataset.iconVal || 'weapons:GREATSWORD',
        craftable: (byId('ee-craftable') as HTMLInputElement).checked,
        droppable: (byId('ee-droppable') as HTMLInputElement).checked,
        shopBuyable: (byId('ee-shop-buyable') as HTMLInputElement).checked,
        baseEffects,
        combatEffects: {
          patk: patkParsed.base,
          matk: matkParsed.base,
          pdef: pdefParsed.base,
          mdef: mdefParsed.base,
          hp: hpParsed.base,
          mp: mpParsed.base,
          hit: hitParsed.base,
          crit: critParsed.base
        },
        combatStatRanges,
        randomPool: {
          attributes: rndAttrs,
          combatStats: ['patk', 'matk', 'pdef', 'mdef', 'hit', 'crit']
        },
        affixPool: pool,
        fixedSkill: fixedSkill || undefined,
        skillPool: skillPool.length > 0 ? skillPool : undefined,
        skillRollChance,
        skillRollCount,
        extraSkills,
        description: (byId('ee-desc') as HTMLTextAreaElement).value.trim(),
        flavorText: (byId('ee-flavor') as HTMLTextAreaElement).value.trim()
      };

      const existingIdx = this.equipment.findIndex(e => e.id === (this.activeEditingId || id));
      if (existingIdx >= 0) this.equipment[existingIdx] = { ...this.equipment[existingIdx], ...eq };
      else this.equipment.push(eq);
      this.saveDraft();

      byId('modal-equipment-editor').style.display = 'none';
      this.renderEquipColumn();
      void this.saveAllToDisk();
    };

    byId('btn-save-re').onclick = () => {
      const id = (byId('re-id') as HTMLInputElement).value.trim();
      if (!id) return alert('請填寫配方 ID');

      const targetId = (byId('re-target-equip') as HTMLSelectElement).value;

      // 遍歷動態素材列
      const rows = document.querySelectorAll('#re-mats-container .es-recipe-mat-row');
      const reqMats: Record<string, number> = {};

      rows.forEach(row => {
        const matSel = row.querySelector('.es-re-mat-select') as HTMLSelectElement;
        const countInp = row.querySelector('.es-re-mat-count') as HTMLInputElement;
        if (matSel && countInp) {
          const matId = matSel.value;
          const count = Number(countInp.value) || 1;
          if (matId) {
            reqMats[matId] = (reqMats[matId] || 0) + count;
          }
        }
      });

      if (Object.keys(reqMats).length === 0) {
        return alert('請至少加入一種所需素材');
      }

      const rec: CustomCraftingRecipe = {
        id,
        targetEquipmentId: targetId,
        tier: 1,
        requiredMaterials: reqMats,
        goldCost: Number((byId('re-gold') as HTMLInputElement).value) || 100
      };

      const existingIdx = this.recipes.findIndex(r => r.id === (this.activeEditingId || id));
      if (existingIdx >= 0) this.recipes[existingIdx] = { ...this.recipes[existingIdx], ...rec };
      else this.recipes.push(rec);
      this.saveDraft();

      byId('modal-recipe-editor').style.display = 'none';
      this.renderRecipeColumn();
      void this.saveAllToDisk();
    };
  }

  private updateIconPickerFlipBtnState(): void {
    const btn = byId('btn-icon-picker-flip');
    if (btn) {
      if (this.isIconPickerFlipped) {
        btn.textContent = '↔️ 水平翻轉: 開';
        btn.style.background = 'rgba(245, 158, 11, 0.35)';
        btn.style.borderColor = '#f59e0b';
        btn.style.fontWeight = 'bold';
      } else {
        btn.textContent = '↔️ 水平翻轉: 關';
        btn.style.background = 'rgba(245, 158, 11, 0.15)';
        btn.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        btn.style.fontWeight = 'normal';
      }
    }
  }

  // ── 全圖集通用圖標選擇器 ──
  private openIconPicker(callback: (icon: string) => void): void {
    this.iconPickerCallback = callback;
    const tabsContainer = byId('icon-picker-tabs');
    const customInput = byId('icon-picker-custom-input') as HTMLInputElement;
    
    tabsContainer.innerHTML = '';
    customInput.value = '';

    this.updateIconPickerFlipBtnState();

    const datasets = this.iconDatasets || {};
    const catKeys = Object.keys(datasets);

    // 動態標籤清單：所有圖集 + Emoji
    const allTabs = [
      ...catKeys.map(k => ({ key: k, title: datasets[k]?.title || k })),
      { key: 'emoji', title: '😀 常用 Emoji' }
    ];

    if (!this.currentIconPickerTab || !allTabs.some(t => t.key === this.currentIconPickerTab)) {
      this.currentIconPickerTab = allTabs[0]?.key || 'materials';
    }

    allTabs.forEach(tab => {
      const tabBtn = document.createElement('button');
      tabBtn.className = `es-icon-picker-tab ${tab.key === this.currentIconPickerTab ? 'active' : ''}`;
      tabBtn.textContent = tab.title;
      tabBtn.onclick = () => {
        this.currentIconPickerTab = tab.key;
        tabsContainer.querySelectorAll('.es-icon-picker-tab').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        this.renderIconPickerItems(tab.key);
      };
      tabsContainer.appendChild(tabBtn);
    });

    byId('btn-icon-picker-apply-custom').onclick = () => {
      let val = customInput.value.trim();
      if (val && this.isIconPickerFlipped && !val.includes('?flip')) {
        val = `${val}?flip`;
      }
      if (val && this.iconPickerCallback) {
        this.iconPickerCallback(val);
        byId('modal-icon-picker').style.display = 'none';
      }
    };

    this.renderIconPickerItems(this.currentIconPickerTab);
    byId('modal-icon-picker').style.display = 'flex';
  }

  private renderIconPickerItems(tabKey: string): void {
    const grid = byId('icon-picker-grid');
    grid.innerHTML = '';

    if (tabKey === 'emoji') {
      const candidates = [
        '🪵', '🪨', '⛓️', '🧵', '🧶', '🪙', '💎', '🩸', '🦴', '🧪', '💧', '🌿', '🍃', '🔥', '❄️', '⚡', '☀️', '🌑',
        '🗡️', '⚔️', '🏹', '🪄', '🛡️', '👑', '💍', '📿', '📜', '📖', '🪓', '🔨', '⚙️', '💨', '🎯', '✨'
      ];
      candidates.forEach(emoji => {
        const item = document.createElement('div');
        item.className = 'es-icon-picker-item';
        const flipStyle = this.isIconPickerFlipped ? 'transform: scaleX(-1);' : '';
        item.innerHTML = `<div style="font-size: 1.8rem; line-height: 1.2; ${flipStyle}">${emoji}</div>`;
        item.onclick = () => {
          const finalId = this.isIconPickerFlipped ? `${emoji}?flip` : emoji;
          if (this.iconPickerCallback) this.iconPickerCallback(finalId);
          byId('modal-icon-picker').style.display = 'none';
        };
        grid.appendChild(item);
      });
      return;
    }

    const catData = this.iconDatasets[tabKey];
    if (!catData || !catData.items) return;

    catData.items.forEach((it: any) => {
      const rawFullId = `${tabKey}:${it.id}`;
      const displayId = this.isIconPickerFlipped ? `${rawFullId}?flip` : rawFullId;
      const item = document.createElement('div');
      item.className = 'es-icon-picker-item';
      item.innerHTML = `
        ${renderUniversalIcon(displayId, 44)}
        <div class="es-icon-picker-item-label">${it.name || it.id}</div>
      `;
      item.onclick = () => {
        if (this.iconPickerCallback) this.iconPickerCallback(displayId);
        byId('modal-icon-picker').style.display = 'none';
      };
      grid.appendChild(item);
    });
  }

  private getMaterialDefaultIcon(id: string): string {
    const matCat = this.iconDatasets['materials'];
    if (matCat && matCat.items && matCat.items.some((i: any) => i.id === id)) {
      return `materials:${id}`;
    }
    if (id.includes('iron') || id.includes('ore') || id.includes('metal')) return '🪨';
    if (id.includes('wood')) return '🪵';
    if (id.includes('cloth')) return '🧵';
    if (id.includes('leather')) return '🧶';
    if (id.includes('gem') || id.includes('crystal')) return '💎';
    return '🧱';
  }

  private updateFixedSkillUI(skillId: string): void {
    const hiddenInp = byId<HTMLInputElement>('ee-fixed-skill');
    const nameEl = byId('ee-fixed-skill-name');
    const clearBtn = byId('btn-es-clear-fixed-skill');

    if (hiddenInp) hiddenInp.value = skillId || '';

    if (skillId) {
      const sk = SkillRegistry.getSkill(skillId);
      const iconHtml = renderUniversalIcon(sk?.icon || '🔮', 20);
      const displayName = sk ? `${sk.name} (${sk.id})` : skillId;
      if (nameEl) {
        nameEl.innerHTML = `<div style="display: flex; align-items: center; gap: 6px;">${iconHtml} <strong style="color: #fde047; font-size: 0.8rem;">${displayName}</strong></div>`;
      }
      if (clearBtn) clearBtn.style.display = 'inline-block';
    } else {
      if (nameEl) {
        nameEl.innerHTML = '<span style="color: var(--es-text-muted);">尚未配置固定特技 (若無則純隨機抽取)</span>';
      }
      if (clearBtn) clearBtn.style.display = 'none';
    }
  }

  private addSkillToPool(skillId: string): void {
    if (!skillId) return;
    if (!this.currentSkillPool.includes(skillId)) {
      this.currentSkillPool.push(skillId);
      this.renderSkillPoolBadges();
    }
  }

  private removeSkillFromPool(skillId: string): void {
    this.currentSkillPool = this.currentSkillPool.filter(s => s !== skillId);
    this.renderSkillPoolBadges();
  }

  private renderSkillPoolBadges(): void {
    const container = byId('ee-skill-pool-container');
    if (!container) return;
    container.innerHTML = '';

    if (this.currentSkillPool.length === 0) {
      container.innerHTML = '<span style="color: var(--es-text-muted); font-size: 0.75rem;">隨機池目前為空（點擊右上角「➕ 挑選加入隨機池」新增技能）</span>';
      return;
    }

    this.currentSkillPool.forEach(skId => {
      const sk = SkillRegistry.getSkill(skId);
      const badge = document.createElement('div');
      badge.style.cssText = 'display: inline-flex; align-items: center; gap: 5px; background: rgba(168,85,247,0.18); border: 1px solid rgba(168,85,247,0.45); border-radius: 4px; padding: 2px 6px; font-size: 0.75rem; color: #e9d5ff;';
      badge.innerHTML = `
        <span>${renderUniversalIcon(sk?.icon || '🔮', 18)}</span>
        <span style="font-weight: 500;">${sk ? sk.name : skId}</span>
        <span style="font-size: 0.65rem; color: #a855f7; font-family: monospace;">(${skId})</span>
        <button type="button" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 0.75rem; padding: 0 2px; line-height: 1;" title="從隨機池移除">✕</button>
      `;
      badge.querySelector('button')!.onclick = () => this.removeSkillFromPool(skId);
      container.appendChild(badge);
    });
  }

  private openSkillPicker(callback: (skillId: string) => void): void {
    this.skillPickerCallback = callback;
    const searchInp = byId<HTMLInputElement>('inp-es-skill-search');
    if (searchInp) searchInp.value = '';
    const catSel = byId<HTMLSelectElement>('sel-es-skill-category');
    if (catSel) catSel.value = this.currentSkillCategoryFilter || 'ALL';

    this.renderSkillPickerGrid();
    byId('modal-es-skill-picker').style.display = 'flex';
  }

  private renderSkillPickerGrid(): void {
    const grid = byId('es-skill-picker-grid');
    const countEl = byId('es-skill-picker-count');
    if (!grid) return;
    grid.innerHTML = '';

    const query = (byId<HTMLInputElement>('inp-es-skill-search')?.value || '').toLowerCase().trim();
    const allSkills = SkillRegistry.getAllSkills();

    const filtered = allSkills.filter(sk => {
      const cat = SkillRegistry.resolveCategory(sk);
      if (this.currentSkillCategoryFilter !== 'ALL' && cat !== this.currentSkillCategoryFilter) {
        return false;
      }
      if (query) {
        const text = `${sk.id} ${sk.name} ${sk.description || ''}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });

    if (countEl) countEl.textContent = `共 ${filtered.length} 個技能`;

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--es-text-muted); padding: 40px 0;">無符合條件的技能</div>';
      return;
    }

    filtered.forEach(sk => {
      const card = document.createElement('div');
      card.style.cssText = 'background: #141b2d; border: 1px solid var(--es-panel-border); border-radius: 8px; padding: 10px 12px; cursor: pointer; display: flex; gap: 10px; align-items: center; transition: all 0.15s ease; box-shadow: 0 2px 4px rgba(0,0,0,0.3);';
      card.onmouseenter = () => {
        card.style.borderColor = 'var(--es-primary)';
        card.style.background = '#1e293b';
        card.style.transform = 'translateY(-2px)';
      };
      card.onmouseleave = () => {
        card.style.borderColor = 'var(--es-panel-border)';
        card.style.background = '#141b2d';
        card.style.transform = 'none';
      };

      const cat = SkillRegistry.resolveCategory(sk);

      card.innerHTML = `
        <div style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); border-radius: 6px; flex-shrink: 0; font-size: 1.4rem;">
          ${renderUniversalIcon(sk.icon || '🔮', 32)}
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
            <span style="font-weight: bold; font-size: 0.88rem; color: #fde047; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sk.name}</span>
            <span style="font-size: 0.68rem; padding: 1px 5px; border-radius: 3px; background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4);">${cat}</span>
          </div>
          <div style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">${sk.id} ｜ 💧 ${sk.mpCost || 0} MP</div>
          ${sk.description ? `<div style="font-size: 0.72rem; color: #64748b; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${sk.description}</div>` : ''}
        </div>
      `;

      card.onclick = () => {
        if (this.skillPickerCallback) {
          this.skillPickerCallback(sk.id);
        }
        byId('modal-es-skill-picker').style.display = 'none';
      };

      grid.appendChild(card);
    });
  }

  private getEquipDefaultIcon(slot: EquipmentSlot, weaponType?: WeaponType, tier: number = 1): string {
    if (slot === EquipmentSlot.WEAPON) {
      const cat = tier === 2 ? 'weapons_t2' : tier === 3 ? 'weapons_t3' : tier === 4 ? 'weapons_t4' : 'weapons';
      return `${cat}:${weaponType || 'GREATSWORD'}`;
    }
    if (slot === EquipmentSlot.ARMOR) {
      const safeTier = Math.min(4, Math.max(1, tier));
      return `armors:CLOTH_T${safeTier}`;
    }
    return '💍';
  }
}

// 啟動裝備素材工坊
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const controller = new EquipmentStudioController();
    controller.init();
  });
}
