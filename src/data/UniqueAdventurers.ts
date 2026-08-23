import { Adventurer } from '../models/Adventurer';
import { DataStore } from '../systems/DataStore';
import { ElementType, EquipmentSlot, Gender } from '../models/types';
import { EquipmentGenerator } from '../systems/EquipmentGenerator';

export interface UniqueHeroDef {
  id: string;
  name: string;
  title: string;
  quality: 'UR' | 'SSR';
  jobKey: string;
  traitKey: string;
  gender: Gender;
  isGuardian: boolean;
  avatarIndex: number;
  avatarIcon?: string;
  level: number;
  biography: string;
  customAttributes: {
    str: number;
    agi: number;
    con: number;
    int: number;
    spr: number;
    luk: number;
    charm?: number;
    command?: number;
  };
  equipment: {
    weaponTemplateId: string;
    weaponEnhance: number;
    weaponElement?: ElementType;
    armorTemplateId: string;
    armorEnhance: number;
    accessoryId: string;
  };
}

export const UNIQUE_HEROES: Record<string, UniqueHeroDef> = {
  reyn: {
    id: 'unique_reyn_valentine',
    name: '雷恩·瓦倫泰',
    title: '【赤焰戰神】',
    quality: 'UR',
    jobKey: 'WARRIOR',
    traitKey: 'BRAVE',
    gender: Gender.MALE,
    isGuardian: false,
    avatarIndex: 0,
    avatarIcon: 'heroes:reyn',
    level: 10,
    biography: '昔日瓦倫泰王國的護國大將軍，曾於北方焦土隻身斬殺炎魔，巨劍揮舞之處化為熔岩火海。',
    customAttributes: {
      str: 45,
      con: 30,
      agi: 15,
      spr: 10,
      int: 3,
      luk: 2,
      charm: 8,
      command: 12
    },
    equipment: {
      weaponTemplateId: 'wpn_meteoric_greatsword',
      weaponEnhance: 7,
      weaponElement: ElementType.FIRE,
      armorTemplateId: 'arm_heavy_t4',
      armorEnhance: 7,
      accessoryId: 'acc_berserk_badge'
    }
  },
  luna: {
    id: 'unique_luna_starfall',
    name: '露娜·星輝',
    title: '【霜語大魔導】',
    quality: 'SSR',
    jobKey: 'MAGE',
    traitKey: 'METICULOUS',
    gender: Gender.FEMALE,
    isGuardian: false,
    avatarIndex: 12,
    avatarIcon: 'heroes:luna',
    level: 10,
    biography: '星界方尖碑的首席守護者，掌握著精確引導極寒魔力的新星魔法，被譽為冰封萬物的霜語者。',
    customAttributes: {
      int: 42,
      spr: 26,
      con: 12,
      agi: 6,
      str: 2,
      luk: 2,
      charm: 10,
      command: 6
    },
    equipment: {
      weaponTemplateId: 'wpn_archmage_staff',
      weaponEnhance: 5,
      weaponElement: ElementType.ICE,
      armorTemplateId: 'arm_cloth_robe_t4',
      armorEnhance: 4,
      accessoryId: 'acc_scholar_pendant'
    }
  },
  oath: {
    id: 'unique_oath_guardian_champion',
    name: '神聖誓約騎士',
    title: '【不滅誓約】',
    quality: 'UR',
    jobKey: 'KNIGHT',
    traitKey: 'GUARDIAN_LOYAL',
    gender: Gender.MALE,
    isGuardian: true,
    avatarIndex: 1, // Row 0 col 1: 銀髮雄獅誓約騎士
    avatarIcon: 'guardian_m_1',
    level: 10,
    biography: '領主身旁最忠誠的守護者，立下神聖誓約的鋼鐵壁壘，其盾牌能抵禦一切黑暗衝擊。',
    customAttributes: {
      con: 38,
      str: 25,
      spr: 22,
      agi: 10,
      int: 5,
      luk: 5,
      charm: 15,
      command: 15
    },
    equipment: {
      weaponTemplateId: 'wpn_royal_paladin_sword',
      weaponEnhance: 7,
      weaponElement: ElementType.HOLY,
      armorTemplateId: 'arm_heavy_t4',
      armorEnhance: 7,
      accessoryId: 'acc_holy_cross'
    }
  }
};

/**
 * 創建唯一傳奇冒險者實例
 */
export function createUniqueAdventurer(heroKey: string): Adventurer | null {
  const def = UNIQUE_HEROES[heroKey.toLowerCase()];
  if (!def) return null;

  const job = DataStore.JobDB[def.jobKey] || DataStore.JobDB.WARRIOR;
  const trait = DataStore.TraitDB[def.traitKey] || DataStore.TraitDB.BRAVE;

  const adv = new Adventurer(
    def.id,
    `${def.title}${def.name}`,
    job,
    trait,
    def.quality,
    def.gender,
    def.isGuardian
  );

  adv.avatarIndex = def.avatarIndex;
  adv.level = def.level;
  adv.isAdvanced = true; // 唯一英雄預設滿等轉職

  // 覆寫指定屬性
  adv.baseAttributes = {
    str: def.customAttributes.str,
    agi: def.customAttributes.agi,
    con: def.customAttributes.con,
    int: def.customAttributes.int,
    spr: def.customAttributes.spr,
    luk: def.customAttributes.luk,
    charm: def.customAttributes.charm ?? 5,
    command: def.customAttributes.command ?? 5
  };
  adv.unspentStatPoints = 0;

  // 生成並穿戴專屬裝備
  const weapon = EquipmentGenerator.generate(def.equipment.weaponTemplateId);
  if (weapon) {
    weapon.enhancementLevel = def.equipment.weaponEnhance;
    if (def.equipment.weaponElement) weapon.element = def.equipment.weaponElement;
    adv.equipment[EquipmentSlot.WEAPON] = weapon;
  }

  const armor = EquipmentGenerator.generate(def.equipment.armorTemplateId);
  if (armor) {
    armor.enhancementLevel = def.equipment.armorEnhance;
    adv.equipment[EquipmentSlot.ARMOR] = armor;
  }

  const acc = EquipmentGenerator.generate(def.equipment.accessoryId);
  if (acc) {
    adv.equipment[EquipmentSlot.ACCESSORY] = acc;
  }

  return adv;
}
