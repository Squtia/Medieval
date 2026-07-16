import { EquipmentTemplate, EquipmentSlot, JobConfig, TraitConfig } from '../models/types';

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
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
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
    LAZY: { name: '懶惰', xpModifier: 1.5, statMultipliers: { str: -0.1, agi: -0.1 } }
  };

  /** 取得隨機性格 */
  public static getRandomTrait(): TraitConfig {
    const keys = Object.keys(this.TraitDB);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    return this.TraitDB[randomKey];
  }

  // ============================
  // 裝備模板庫 (EquipmentTemplateDB)
  // ============================
  public static readonly EquipmentDB: Record<string, EquipmentTemplate> = {
    // 武器 (WEAPON)
    'wpn_iron_sword': {
      id: 'wpn_iron_sword', name: '生鏽的鐵劍', slot: EquipmentSlot.WEAPON, icon: '🗡️',
      itemLevel: 10,
      baseRequirements: { str: 5 }, 
      baseEffects: { str: 3 }, 
      baseCombatEffects: { atk: 10 },
      randomPool: { combatStats: ['hit', 'atk'] }
    },
    'wpn_oak_staff': {
      id: 'wpn_oak_staff', name: '橡木法杖', slot: EquipmentSlot.WEAPON, icon: '🪄',
      itemLevel: 10,
      baseRequirements: { int: 5 }, 
      baseEffects: { int: 3 }, 
      baseCombatEffects: { atk: 5, mp: 10 },
      randomPool: { combatStats: ['mp', 'hit'] }
    },
    // 防具 (ARMOR)
    'arm_leather': {
      id: 'arm_leather', name: '破舊皮甲', slot: EquipmentSlot.ARMOR, icon: '🦺',
      itemLevel: 8,
      baseRequirements: { con: 3 }, 
      baseEffects: { con: 2 }, 
      baseCombatEffects: { def: 5, hp: 20 },
      randomPool: { attributes: ['con', 'agi'], combatStats: ['hp', 'def'] }
    },
    'arm_iron': {
      id: 'arm_iron', name: '厚重鐵甲', slot: EquipmentSlot.ARMOR, icon: '🛡️',
      itemLevel: 12,
      baseRequirements: { str: 8, con: 5 }, 
      baseEffects: { con: 4, agi: -1 }, 
      baseCombatEffects: { def: 12, hp: 30 },
      randomPool: { attributes: ['con', 'str'], combatStats: ['def', 'hp'] }
    },
    // 飾品 (ACCESSORY)
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
}
