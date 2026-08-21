import { EquipmentTemplate, EquipmentSlot, JobConfig, TraitConfig, WeaponType, MaterialItem } from '../models/types';
import { Random } from '../core/Random';
import equipmentWeaponsJson from '../data/equipment_weapons.json';
import equipmentArmorsJson from '../data/equipment_armors.json';
import equipmentAccessoriesJson from '../data/equipment_accessories.json';
import materialsJson from '../data/materials.json';
import craftingRecipesJson from '../data/CraftingRecipes.json';
import modificationRecipesJson from '../data/ModificationRecipes.json';
import secondHandShopDataJson from '../data/SecondHandShopData.json';

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
  // 裝備改造配方庫 (ModificationRecipeDB)
  // ============================
  public static readonly ModificationRecipeDB = modificationRecipesJson;

  // ============================
  // 二手商人與飾品庫 (SecondHandShopDB - 動態對齊 equipment_accessories.json 唯一真實來源)
  // ============================
  public static readonly SecondHandShopDB = (() => {
    const raw = secondHandShopDataJson;
    const accList = (raw.accessories || []).map((secAcc: any) => {
      const authAcc = (equipmentAccessoriesJson as any[]).find(a => a.id === secAcc.id);
      return authAcc ? { ...authAcc, basePrice: secAcc.basePrice ?? authAcc.basePrice } : secAcc;
    });
    return {
      ...raw,
      accessories: accList
    };
  })();

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
    LOYAL: { id: 'LOYAL', name: '忠誠', xpModifier: 1.0, statMultipliers: { con: 0.1 }, recruitmentModifier: 0.9, recruitDialogue: '能夠為您效勞是我的榮幸！' },
    SCHOLAR: { id: 'SCHOLAR', name: '學者', xpModifier: 1.2, statMultipliers: { int: 0.2 }, recruitmentModifier: 1.0, recruitDialogue: '知識就是力量，希望能在此派上用場。' },
    BRAVE: { id: 'BRAVE', name: '勇敢', xpModifier: 0.9, statMultipliers: { str: 0.15 }, recruitmentModifier: 1.0, recruitDialogue: '又有怪物要討伐了嗎？算我一個！' },
    AGILE: { id: 'AGILE', name: '靈動', xpModifier: 1.0, statMultipliers: { agi: 0.15 }, recruitmentModifier: 1.0, recruitDialogue: '沒人能跟得上我的腳步！' },
    LUCKY: { id: 'LUCKY', name: '幸運兒', xpModifier: 1.0, statMultipliers: { luk: 0.3 }, recruitmentModifier: 1.0, recruitDialogue: '跟著我，保證能撿到好東西！' },
    LAZY: { id: 'LAZY', name: '懶惰', xpModifier: 1.5, statMultipliers: { str: -0.1, agi: -0.1 }, recruitmentModifier: 0.8, recruitDialogue: '哈啊...如果可以的話，我想在酒館裡多睡一下...' },
    GREEDY: { id: 'GREEDY', name: '貪婪', xpModifier: 1.0, statMultipliers: { luk: 0.1 }, recruitmentModifier: 1.2, recruitDialogue: '要我賣命可以，得加錢！' },
    
    // 🌟 誓約守衛 5 大專屬性格
    GUARDIAN: { id: 'GUARDIAN', name: '誓約守衛', xpModifier: 0.9, statMultipliers: { con: 0.2, str: 0.15, command: 0.3 }, recruitmentModifier: 0.9, recruitDialogue: '我的盾牌將會化為守護您的鐵壁。' },
    GUARDIAN_LOYAL: { id: 'GUARDIAN_LOYAL', name: '忠誠護衛', xpModifier: 0.9, statMultipliers: { con: 0.2, str: 0.1 }, recruitmentModifier: 0.9, recruitDialogue: '誓死護衛領主大人，我的劍與盾與您同在！' },
    GUARDIAN_PRUDENT: { id: 'GUARDIAN_PRUDENT', name: '沉著參謀', xpModifier: 0.9, statMultipliers: { agi: 0.15, int: 0.15 }, recruitmentModifier: 0.9, recruitDialogue: '保持冷靜與縝密，方能在亂世中奪回屬於我們的領地。' },
    GUARDIAN_VALIANT: { id: 'GUARDIAN_VALIANT', name: '熱血戰魂', xpModifier: 0.9, statMultipliers: { str: 0.2, luk: 0.1 }, recruitmentModifier: 0.9, recruitDialogue: '敵人的數量越多，只會讓我手中的武器燃燒得更熾烈！' },
    GUARDIAN_DEVOUT: { id: 'GUARDIAN_DEVOUT', name: '堅毅信仰', xpModifier: 0.9, statMultipliers: { spr: 0.2, con: 0.1 }, recruitmentModifier: 0.9, recruitDialogue: '榮光終將降臨，我會將受傷的您引領向復興之路。' },
    GUARDIAN_SCOUT: { id: 'GUARDIAN_SCOUT', name: '敏銳斥候', xpModifier: 0.9, statMultipliers: { agi: 0.2, luk: 0.1 }, recruitmentModifier: 0.9, recruitDialogue: '荒野的陰影由我來掃清，沒有任何人能偷襲我們！' }
  };

  /** 取得隨機性格 */
  public static getRandomTrait(): TraitConfig {
    const keys = Object.keys(this.TraitDB);
    const randomKey = Random.pick(keys);
    return this.TraitDB[randomKey];
  }

  /** 一般招募專用；誓約守衛性格只保留給初始角色。 */
  public static getRandomRecruitTrait(): TraitConfig {
    const keys = Object.keys(this.TraitDB).filter(key => !key.startsWith('GUARDIAN'));
    return this.TraitDB[Random.pick(keys)];
  }

  // ============================
  // 裝備模板庫 (EquipmentTemplateDB)
  // ============================
  public static readonly EquipmentDB: Record<string, EquipmentTemplate> = (() => {
    const db: Record<string, EquipmentTemplate> = {};
    const allLists = [
      equipmentWeaponsJson,
      equipmentArmorsJson,
      equipmentAccessoriesJson || []
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
          randomPool: item.randomPool || {},
          scalingRules: item.scalingRules
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
      randomPool: { combatStats: ['hit', 'patk'] },
      scalingRules: {
        patk: {
          guaranteed: { str: ['B', 'S'] },
          randomPool: { possibleAttributes: ['con', 'luk'], rankRange: ['E', 'B'], count: [0, 1] }
        }
      }
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
