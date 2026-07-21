import { EquipmentTemplate, EquipmentSlot, JobConfig, TraitConfig } from '../models/types';
import { Random } from '../core/Random';

export class DataStore {
  // ============================
  // 職業庫 (JobDB)
  // ============================
  public static readonly JobDB: Record<string, JobConfig> = {
    WARRIOR: {
      name: '見習騎士',
      baseAttributes: { str: 10, agi: 5, con: 12, int: 2, spr: 3, luk: 5, charm: 1, command: 1 },
      growthRates: { str: 3, agi: 1, con: 3, int: 0, spr: 1, luk: 1, charm: 0, command: 0 }
    },
    MAGE: {
      name: '流浪法師',
      baseAttributes: { str: 2, agi: 4, con: 4, int: 12, spr: 10, luk: 5, charm: 1, command: 1 },
      growthRates: { str: 0, agi: 1, con: 1, int: 3, spr: 3, luk: 1, charm: 0, command: 0 }
    },
    ROGUE: {
      name: '盜賊',
      baseAttributes: { str: 5, agi: 12, con: 6, int: 3, spr: 3, luk: 10, charm: 1, command: 1 },
      growthRates: { str: 1, agi: 3, con: 1, int: 0, spr: 0, luk: 3, charm: 0, command: 0 }
    },
    CLERIC: {
      name: '牧師',
      baseAttributes: { str: 4, agi: 3, con: 8, int: 8, spr: 12, luk: 4, charm: 1, command: 1 },
      growthRates: { str: 1, agi: 0, con: 2, int: 2, spr: 4, luk: 0, charm: 0, command: 0 }
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
    LOYAL: { name: '忠誠', xpModifier: 1.0, statMultipliers: { con: 0.1 } },
    SCHOLAR: { name: '學者', xpModifier: 1.2, statMultipliers: { int: 0.2 } },
    BRAVE: { name: '勇敢', xpModifier: 0.9, statMultipliers: { str: 0.15 } },
    AGILE: { name: '靈動', xpModifier: 1.0, statMultipliers: { agi: 0.15 } },
    LUCKY: { name: '幸運兒', xpModifier: 1.0, statMultipliers: { luk: 0.3 } },
    LAZY: { name: '懶惰', xpModifier: 1.5, statMultipliers: { str: -0.1, agi: -0.1 } },
    GUARDIAN: { name: '誓約守衛', xpModifier: 0.8, statMultipliers: { con: 0.3, str: 0.2, command: 0.5 } }
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
  public static readonly EquipmentDB: Record<string, EquipmentTemplate> = {
    // ==========================================
    // 1 階武具 (低階 - 適合 1 級商店，價格約 150~200 金幣)
    // ==========================================
    'wpn_iron_shieldsword': {
      id: 'wpn_iron_shieldsword', name: '精鐵劍盾', slot: EquipmentSlot.WEAPON, icon: '⚔️🛡️',
      itemLevel: 10,
      baseRequirements: { str: 5, con: 5 }, 
      baseEffects: { str: 2, con: 2 }, 
      baseCombatEffects: { atk: 10, def: 5 },
      randomPool: { attributes: ['str', 'con'], combatStats: ['atk', 'def', 'hp'] }
    },
    'wpn_iron_greatsword': {
      id: 'wpn_iron_greatsword', name: '精鐵巨劍', slot: EquipmentSlot.WEAPON, icon: '⚔️',
      itemLevel: 10,
      baseRequirements: { str: 8 }, 
      baseEffects: { str: 4 }, 
      baseCombatEffects: { atk: 18 },
      randomPool: { attributes: ['str'], combatStats: ['atk', 'hit'] }
    },
    'wpn_iron_daggers': {
      id: 'wpn_iron_daggers', name: '精鐵雙短刀', slot: EquipmentSlot.WEAPON, icon: '🔪',
      itemLevel: 10,
      baseRequirements: { agi: 6 }, 
      baseEffects: { agi: 3 }, 
      baseCombatEffects: { atk: 12, evade: 2 },
      randomPool: { attributes: ['agi', 'luk'], combatStats: ['atk', 'evade'] }
    },
    'wpn_oak_staff': {
      id: 'wpn_oak_staff', name: '橡木法杖', slot: EquipmentSlot.WEAPON, icon: '🪄',
      itemLevel: 10,
      baseRequirements: { int: 6 }, 
      baseEffects: { int: 3 }, 
      baseCombatEffects: { atk: 6, mp: 15 },
      randomPool: { attributes: ['int', 'spr'], combatStats: ['mp', 'atk'] }
    },
    'wpn_rookie_tome': {
      id: 'wpn_rookie_tome', name: '初學者魔導書', slot: EquipmentSlot.WEAPON, icon: '📖',
      itemLevel: 10,
      baseRequirements: { int: 5, spr: 5 }, 
      baseEffects: { int: 2, spr: 2 }, 
      baseCombatEffects: { atk: 5, mp: 20 },
      randomPool: { attributes: ['int', 'spr'], combatStats: ['mp', 'hit'] }
    },
    'arm_cloth_robe': {
      id: 'arm_cloth_robe', name: '棉布便袍', slot: EquipmentSlot.ARMOR, icon: '🧥',
      itemLevel: 8,
      baseRequirements: { con: 3 }, 
      baseEffects: { con: 1, spr: 1 }, 
      baseCombatEffects: { def: 4, hp: 15 },
      randomPool: { attributes: ['con', 'spr'], combatStats: ['hp', 'def'] }
    },
    'arm_scout_leather': {
      id: 'arm_scout_leather', name: '學徒皮甲', slot: EquipmentSlot.ARMOR, icon: '🦺',
      itemLevel: 8,
      baseRequirements: { con: 4 }, 
      baseEffects: { con: 2, agi: 1 }, 
      baseCombatEffects: { def: 8, hp: 25 },
      randomPool: { attributes: ['con', 'agi'], combatStats: ['hp', 'def'] }
    },
    'arm_iron_cuirass': {
      id: 'arm_iron_cuirass', name: '精鐵胸甲', slot: EquipmentSlot.ARMOR, icon: '🛡️',
      itemLevel: 10,
      baseRequirements: { str: 5, con: 5 }, 
      baseEffects: { con: 3, agi: -1 }, 
      baseCombatEffects: { def: 15, hp: 40 },
      randomPool: { attributes: ['con', 'str'], combatStats: ['hp', 'def'] }
    },

    // ==========================================
    // 2 階武具 (中階 - 適合 2 級商店，價格約 500~600 金幣)
    // ==========================================
    'wpn_steel_shieldsword': {
      id: 'wpn_steel_shieldsword', name: '鍛鋼劍盾', slot: EquipmentSlot.WEAPON, icon: '⚔️🛡️',
      itemLevel: 25,
      baseRequirements: { str: 15, con: 15 }, 
      baseEffects: { str: 5, con: 5 }, 
      baseCombatEffects: { atk: 30, def: 15 },
      randomPool: { attributes: ['str', 'con'], combatStats: ['atk', 'def', 'hp'] }
    },
    'wpn_steel_greatsword': {
      id: 'wpn_steel_greatsword', name: '鍛鋼巨劍', slot: EquipmentSlot.WEAPON, icon: '⚔️',
      itemLevel: 25,
      baseRequirements: { str: 20 }, 
      baseEffects: { str: 10 }, 
      baseCombatEffects: { atk: 55 },
      randomPool: { attributes: ['str'], combatStats: ['atk', 'hit'] }
    },
    'wpn_steel_daggers': {
      id: 'wpn_steel_daggers', name: '鋼製雙短刀', slot: EquipmentSlot.WEAPON, icon: '🔪',
      itemLevel: 25,
      baseRequirements: { agi: 18 }, 
      baseEffects: { agi: 8 }, 
      baseCombatEffects: { atk: 35, evade: 5 },
      randomPool: { attributes: ['agi', 'luk'], combatStats: ['atk', 'evade'] }
    },
    'wpn_redwood_staff': {
      id: 'wpn_redwood_staff', name: '紅木法杖', slot: EquipmentSlot.WEAPON, icon: '🪄',
      itemLevel: 25,
      baseRequirements: { int: 18 }, 
      baseEffects: { int: 8 }, 
      baseCombatEffects: { atk: 18, mp: 45 },
      randomPool: { attributes: ['int', 'spr'], combatStats: ['mp', 'atk'] }
    },
    'wpn_apprentice_tome': {
      id: 'wpn_apprentice_tome', name: '見習者魔導書', slot: EquipmentSlot.WEAPON, icon: '📖',
      itemLevel: 25,
      baseRequirements: { int: 15, spr: 15 }, 
      baseEffects: { int: 5, spr: 5 }, 
      baseCombatEffects: { atk: 15, mp: 60 },
      randomPool: { attributes: ['int', 'spr'], combatStats: ['mp', 'hit'] }
    },
    'arm_magic_robe': {
      id: 'arm_magic_robe', name: '魔紋布袍', slot: EquipmentSlot.ARMOR, icon: '🧥',
      itemLevel: 22,
      baseRequirements: { con: 12 }, 
      baseEffects: { con: 4, spr: 4, int: 2 }, 
      baseCombatEffects: { def: 12, hp: 60 },
      randomPool: { attributes: ['con', 'spr', 'int'], combatStats: ['hp', 'def'] }
    },
    'arm_guardian_leather': {
      id: 'arm_guardian_leather', name: '衛士皮甲', slot: EquipmentSlot.ARMOR, icon: '🦺',
      itemLevel: 22,
      baseRequirements: { con: 15 }, 
      baseEffects: { con: 6, agi: 4 }, 
      baseCombatEffects: { def: 24, hp: 100 },
      randomPool: { attributes: ['con', 'agi'], combatStats: ['hp', 'def'] }
    },
    'arm_steel_plate': {
      id: 'arm_steel_plate', name: '精鋼板甲', slot: EquipmentSlot.ARMOR, icon: '🛡️',
      itemLevel: 25,
      baseRequirements: { str: 15, con: 15 }, 
      baseEffects: { con: 10, agi: -3 }, 
      baseCombatEffects: { def: 45, hp: 160 },
      randomPool: { attributes: ['con', 'str'], combatStats: ['hp', 'def'] }
    },

    // ==========================================
    // 3 階武具 (高階 - 適合 3 級商店，價格約 1500~1800 金幣)
    // ==========================================
    'wpn_tungsten_shieldsword': {
      id: 'wpn_tungsten_shieldsword', name: '鎢鋼劍盾', slot: EquipmentSlot.WEAPON, icon: '⚔️🛡️',
      itemLevel: 50,
      baseRequirements: { str: 32, con: 32 }, 
      baseEffects: { str: 12, con: 12 }, 
      baseCombatEffects: { atk: 80, def: 40 },
      randomPool: { attributes: ['str', 'con'], combatStats: ['atk', 'def', 'hp'] }
    },
    'wpn_tungsten_greatsword': {
      id: 'wpn_tungsten_greatsword', name: '鎢鋼巨劍', slot: EquipmentSlot.WEAPON, icon: '⚔️',
      itemLevel: 50,
      baseRequirements: { str: 40 }, 
      baseEffects: { str: 24 }, 
      baseCombatEffects: { atk: 140 },
      randomPool: { attributes: ['str'], combatStats: ['atk', 'hit'] }
    },
    'wpn_tungsten_daggers': {
      id: 'wpn_tungsten_daggers', name: '鎢鋼雙短刀', slot: EquipmentSlot.WEAPON, icon: '🔪',
      itemLevel: 50,
      baseRequirements: { agi: 36 }, 
      baseEffects: { agi: 20 }, 
      baseCombatEffects: { atk: 95, evade: 12 },
      randomPool: { attributes: ['agi', 'luk'], combatStats: ['atk', 'evade'] }
    },
    'wpn_silver_staff': {
      id: 'wpn_silver_staff', name: '白銀法杖', slot: EquipmentSlot.WEAPON, icon: '🪄',
      itemLevel: 50,
      baseRequirements: { int: 36 }, 
      baseEffects: { int: 20 }, 
      baseCombatEffects: { atk: 45, mp: 120 },
      randomPool: { attributes: ['int', 'spr'], combatStats: ['mp', 'atk'] }
    },
    'wpn_scholar_tome': {
      id: 'wpn_scholar_tome', name: '學者魔導書', slot: EquipmentSlot.WEAPON, icon: '📖',
      itemLevel: 50,
      baseRequirements: { int: 32, spr: 32 }, 
      baseEffects: { int: 12, spr: 12 }, 
      baseCombatEffects: { atk: 40, mp: 150 },
      randomPool: { attributes: ['int', 'spr'], combatStats: ['mp', 'hit'] }
    },
    'arm_silk_robe': {
      id: 'arm_silk_robe', name: '精緻絲袍', slot: EquipmentSlot.ARMOR, icon: '🧥',
      itemLevel: 45,
      baseRequirements: { con: 28 }, 
      baseEffects: { con: 10, spr: 10, int: 6 }, 
      baseCombatEffects: { def: 32, hp: 180 },
      randomPool: { attributes: ['con', 'spr', 'int'], combatStats: ['hp', 'def'] }
    },
    'arm_master_leather': {
      id: 'arm_master_leather', name: '大師皮甲', slot: EquipmentSlot.ARMOR, icon: '🦺',
      itemLevel: 45,
      baseRequirements: { con: 32 }, 
      baseEffects: { con: 14, agi: 10 }, 
      baseCombatEffects: { def: 60, hp: 260 },
      randomPool: { attributes: ['con', 'agi'], combatStats: ['hp', 'def'] }
    },
    'arm_tungsten_plate': {
      id: 'arm_tungsten_plate', name: '鎢鋼全身鎧', slot: EquipmentSlot.ARMOR, icon: '🛡️',
      itemLevel: 50,
      baseRequirements: { str: 32, con: 32 }, 
      baseEffects: { con: 24, agi: -6 }, 
      baseCombatEffects: { def: 110, hp: 420 },
      randomPool: { attributes: ['con', 'str'], combatStats: ['hp', 'def'] }
    },

    // 傳家寶劍與首發特殊裝備保留
    'wpn_heirloom_sword': {
      id: 'wpn_heirloom_sword', name: '破敗的傳家寶劍', slot: EquipmentSlot.WEAPON, icon: '🗡️',
      itemLevel: 1,
      baseRequirements: { str: 1 }, 
      baseEffects: { str: 5, con: 5 }, 
      baseCombatEffects: { atk: 15, hit: 10 },
      randomPool: { combatStats: ['hit', 'atk'] }
    },
    // 飾品 (ACCESSORY) 暫時保留
    'acc_lucky_ring': {
      id: 'acc_lucky_ring', name: '幸運戒指', slot: EquipmentSlot.ACCESSORY, icon: '💍',
      itemLevel: 5,
      baseRequirements: {}, 
      baseEffects: { luk: 5 }, 
      baseCombatEffects: { evade: 10 },
      randomPool: { attributes: ['luk', 'charm', 'command'] }
    },
    'acc_hero_badge': {
      id: 'acc_hero_badge', name: '英雄徽章', slot: EquipmentSlot.ACCESSORY, icon: '🏅',
      itemLevel: 15,
      baseRequirements: { charm: 5 }, 
      baseEffects: { command: 5, charm: 2 }, 
      baseCombatEffects: { hit: 5 },
      randomPool: { attributes: ['str', 'int', 'command'] }
    }
  };

  /** 取得裝備模板 */
  public static getEquipmentTemplate(id: string): EquipmentTemplate | null {
    return this.EquipmentDB[id] || null;
  }

  // ==========================================
  // 武具商店價格資料庫 (便於平衡與修改數值)
  // ==========================================
  public static readonly EquipmentPriceDB: Record<string, number> = {
    // 1 階
    'wpn_iron_shieldsword': 180,
    'wpn_iron_greatsword': 200,
    'wpn_iron_daggers': 180,
    'wpn_oak_staff': 180,
    'wpn_rookie_tome': 180,
    'arm_cloth_robe': 150,
    'arm_scout_leather': 150,
    'arm_iron_cuirass': 170,
    // 2 階
    'wpn_steel_shieldsword': 550,
    'wpn_steel_greatsword': 600,
    'wpn_steel_daggers': 550,
    'wpn_redwood_staff': 550,
    'wpn_apprentice_tome': 550,
    'arm_magic_robe': 500,
    'arm_guardian_leather': 500,
    'arm_steel_plate': 520,
    // 3 階
    'wpn_tungsten_shieldsword': 1600,
    'wpn_tungsten_greatsword': 1800,
    'wpn_tungsten_daggers': 1650,
    'wpn_silver_staff': 1600,
    'wpn_scholar_tome': 1600,
    'arm_silk_robe': 1500,
    'arm_master_leather': 1500,
    'arm_tungsten_plate': 1550
  };
}
