import { EquipmentTemplate, EquipmentSlot, JobConfig, TraitConfig, WeaponType, MaterialItem } from '../models/types';
import { Random } from '../core/Random';
import equipmentTemplatesJson from '../data/EquipmentTemplates.json';
import materialsJson from '../data/materials.json';
import craftingRecipesJson from '../data/CraftingRecipes.json';

export class DataStore {
  // ============================
  // 素材庫 (MaterialDB)
  // ============================
  public static readonly MaterialDB: Record<string, MaterialItem> = (() => {
    const db: Record<string, MaterialItem> = {};
    (materialsJson as MaterialItem[]).forEach(mat => {
      db[mat.id] = mat;
    });
    return db;
  })();

  // ============================
  // 重鑄/鍛造配方庫 (CraftingRecipeDB)
  // ============================
  public static readonly CraftingRecipeDB = craftingRecipesJson;

  // ============================
  // 職業庫 (JobDB)
  // ============================
  public static readonly JobDB: Record<string, JobConfig> = {
    WARRIOR: {
      name: '戰士',
      baseAttributes: { str: 10, agi: 5, con: 12, int: 2, spr: 3, luk: 5, charm: 1, command: 1 },
      growthRates: { str: 3, agi: 1, con: 3, int: 0, spr: 1, luk: 1, charm: 0, command: 0 }
    },
    MAGE: {
      name: '法師',
      baseAttributes: { str: 2, agi: 4, con: 4, int: 12, spr: 10, luk: 5, charm: 1, command: 1 },
      growthRates: { str: 0, agi: 1, con: 1, int: 3, spr: 3, luk: 1, charm: 0, command: 0 }
    },
    ROGUE: {
      name: '盜賊',
      baseAttributes: { str: 5, agi: 12, con: 6, int: 3, spr: 3, luk: 10, charm: 1, command: 1 },
      growthRates: { str: 1, agi: 3, con: 1, int: 0, spr: 0, luk: 3, charm: 0, command: 0 }
    },
    CLERIC: {
      name: '祈禱者',
      baseAttributes: { str: 4, agi: 3, con: 8, int: 8, spr: 12, luk: 4, charm: 1, command: 1 },
      growthRates: { str: 1, agi: 0, con: 2, int: 2, spr: 4, luk: 0, charm: 0, command: 0 }
    },
    KNIGHT: {
      name: '騎士',
      baseAttributes: { str: 8, agi: 4, con: 15, int: 2, spr: 5, luk: 4, charm: 2, command: 3 },
      growthRates: { str: 2, agi: 1, con: 4, int: 0, spr: 1, luk: 1, charm: 1, command: 1 }
    },
    ARCHER: {
      name: '弓箭手',
      baseAttributes: { str: 6, agi: 10, con: 6, int: 4, spr: 4, luk: 8, charm: 1, command: 1 },
      growthRates: { str: 1, agi: 4, con: 1, int: 1, spr: 1, luk: 2, charm: 0, command: 0 }
    }
  };

  /** 取得隨機職業 */
  public static getRandomJob(): JobConfig {
    const keys = Object.keys(this.JobDB);
    const randomKey = Random.pick(keys);
    return this.JobDB[randomKey];
  }

  // ============================
  // 性格庫 (TraitDB)
  // ============================
  public static readonly TraitDB: Record<string, TraitConfig> = {
    LOYAL: { id: 'LOYAL', name: '忠誠', xpModifier: 1.0, statMultipliers: { con: 0.1 } },
    SCHOLAR: { id: 'SCHOLAR', name: '學者', xpModifier: 1.2, statMultipliers: { int: 0.2 } },
    BRAVE: { id: 'BRAVE', name: '勇敢', xpModifier: 0.9, statMultipliers: { str: 0.15 } },
    AGILE: { id: 'AGILE', name: '靈動', xpModifier: 1.0, statMultipliers: { agi: 0.15 } },
    LUCKY: { id: 'LUCKY', name: '幸運兒', xpModifier: 1.0, statMultipliers: { luk: 0.3 } },
    LAZY: { id: 'LAZY', name: '懶惰', xpModifier: 1.5, statMultipliers: { str: -0.1, agi: -0.1 } },
    GUARDIAN: { id: 'GUARDIAN', name: '誓約守衛', xpModifier: 0.8, statMultipliers: { con: 0.3, str: 0.2, command: 0.5 } }
  };

  /** 取得隨機性格 */
  public static getRandomTrait(): TraitConfig {
    const keys = Object.keys(this.TraitDB);
    const randomKey = Random.pick(keys);
    return this.TraitDB[randomKey];
  }

  /** 一般招募專用；誓約守衛只保留給初始角色。 */
  public static getRandomRecruitTrait(): TraitConfig {
    const keys = Object.keys(this.TraitDB).filter(key => key !== 'GUARDIAN');
    return this.TraitDB[Random.pick(keys)];
  }

  // ============================
  // 裝備模板庫 (EquipmentTemplateDB)
  // ============================
  public static readonly EquipmentDB: Record<string, EquipmentTemplate> = (() => {
    const db: Record<string, EquipmentTemplate> = {};
    const allLists = [
      equipmentTemplatesJson.weapons,
      equipmentTemplatesJson.armors,
      (equipmentTemplatesJson as any).accessories || []
    ];
    allLists.forEach(list => {
      (list as any[]).forEach(item => {
        db[item.id] = {
          id: item.id,
          name: item.name,
          slot: item.slot as EquipmentSlot,
          weaponType: item.weaponType as any,
          armorType: item.armorType as any,
          tier: item.tier,
          allowedJobs: item.allowedJobs,
          icon: item.icon,
          itemLevel: item.itemLevel,
          baseRequirements: item.baseRequirements || {},
          baseEffects: item.baseEffects || {},
          baseCombatEffects: item.baseCombatEffects || {},
          randomPool: item.randomPool || {}
        };
      });
    });

    // 傳家寶劍保留
    db['wpn_heirloom_sword'] = {
      id: 'wpn_heirloom_sword', name: '破敗的傳家寶劍', slot: EquipmentSlot.WEAPON, weaponType: WeaponType.GREATSWORD, allowedJobs: ['戰士', '騎士'], icon: '🗡️',
      itemLevel: 1, tier: 1,
      baseRequirements: { str: 1 }, 
      baseEffects: { str: 5, con: 5 }, 
      baseCombatEffects: { patk: 15, hit: 10 },
      randomPool: { combatStats: ['hit', 'patk'] }
    };

    return db;
  })();

  /** 取得裝備模板 */
  public static getEquipmentTemplate(id: string): EquipmentTemplate | null {
    return this.EquipmentDB[id] || null;
  }

  // ==========================================
  // 武具商店價格資料庫 (依據 Tier 自動算出與配置)
  // ==========================================
  public static readonly EquipmentPriceDB: Record<string, number> = (() => {
    const prices: Record<string, number> = {
      'wpn_heirloom_sword': 100
    };
    Object.values(DataStore.EquipmentDB).forEach(eq => {
      const tier = eq.tier || 1;
      if (tier === 1) prices[eq.id] = 180;
      else if (tier === 2) prices[eq.id] = 550;
      else if (tier === 3) prices[eq.id] = 1500;
      else prices[eq.id] = 4000;
    });
    return prices;
  })();
}
