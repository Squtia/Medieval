import { Adventurer } from '../models/Adventurer';
import { DataStore } from '../systems/DataStore';
import { ElementType, EquipmentSlot, Gender } from '../models/types';
import { EquipmentGenerator } from '../systems/EquipmentGenerator';

export interface UniqueHeroDef {
  id: string;
  name: string;
  title: string;
  quality: 'UR' | 'SSR' | 'SR' | 'R' | 'N';
  jobKey: string;
  traitKey: string;
  gender: Gender;
  isGuardian: boolean;
  isTestOnly?: boolean;
  avatarIndex: number;
  avatarIcon?: string;
  characterKey?: string;
  boundMonsterId?: string;
  captureRate?: number;
  level: number;
  isAdvanced?: boolean;
  biography: string;
  customSkills?: string[];
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
    weaponTemplateId?: string;
    weaponEnhance?: number;
    weaponElement?: ElementType;
    armorTemplateId?: string;
    armorEnhance?: number;
    accessoryId?: string;
  };
}

import uniqueHeroesJson from './unique_heroes.json';

export const UNIQUE_HEROES: Record<string, UniqueHeroDef> = (uniqueHeroesJson as UniqueHeroDef[]).reduce((acc, h) => {
  if (h.id === 'unique_reyn_valentine') acc['reyn'] = h;
  else if (h.id === 'unique_luna_starfall') acc['luna'] = h;
  else if (h.id === 'unique_oath_guardian_champion') acc['oath'] = h;
  else if (h.id === 'test_guardian_hero') acc['test_guardian_hero'] = h;
  else acc[h.id] = h;
  return acc;
}, {} as Record<string, UniqueHeroDef>);

/**
 * 取得故事與遊戲內所有可選取的英雄定義（工坊實體 JSON 即為唯一權威 SSOT）
 */
export function getSelectableHeroes(): UniqueHeroDef[] {
  const heroMap = new Map<string, UniqueHeroDef>();

  // 1. 載入實體 JSON 資料庫 (SSOT)
  (uniqueHeroesJson as UniqueHeroDef[]).forEach(h => {
    if (!h.isTestOnly) {
      heroMap.set(h.id, h);
    }
  });

  // 2. 載入英雄工坊本機暫存 (若有未同步的新英雄)
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('MEDIEVAL_CUSTOM_HEROES') || localStorage.getItem('MEDIEVAL_CUSTOM_HEROES_V2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((h: UniqueHeroDef) => {
            if (!h.isTestOnly) {
              heroMap.set(h.id, h);
            }
          });
        }
      }
    } catch {}
  }

  return Array.from(heroMap.values());
}

/**
 * 依據 ID、key、characterKey、boundMonsterId 或姓名精確查詢英雄定義
 */
export function findHeroDef(identifier: string): UniqueHeroDef | null {
  if (!identifier) return null;
  const lower = identifier.toLowerCase();

  // 1. 依據 key 查詢 (如 'reyn', 'luna', 'oath')
  if (UNIQUE_HEROES[lower]) {
    const rawDef = UNIQUE_HEROES[lower];
    const selectable = getSelectableHeroes();
    const overridden = selectable.find(h => h.id === rawDef.id);
    return overridden || rawDef;
  }

  // 2. 檢索實體資料庫與最新名冊 (SSOT)
  const heroes = getSelectableHeroes();
  const matched = heroes.find(h => 
    h.id === identifier ||
    h.id.toLowerCase() === lower ||
    h.characterKey === identifier ||
    (h.characterKey && h.characterKey.toLowerCase() === lower) ||
    h.boundMonsterId === identifier ||
    (h.boundMonsterId && h.boundMonsterId.toLowerCase() === lower) ||
    h.name === identifier ||
    h.name.toLowerCase() === lower ||
    `${h.title || ''}${h.name}` === identifier
  );
  if (matched) return matched;

  // 3. 測試專用英雄或未在可選名單中者
  return (uniqueHeroesJson as UniqueHeroDef[]).find(h => h.id === identifier || h.id.toLowerCase() === lower) || null;
}

/**
 * 創建唯一傳奇冒險者實例（支援 key、ID 與工坊自訂英雄，以 findHeroDef 為 SSOT）
 */
export function createUniqueAdventurer(heroKeyOrDef: string | UniqueHeroDef): Adventurer | null {
  if (!heroKeyOrDef) return null;
  const def = typeof heroKeyOrDef === 'string' ? findHeroDef(heroKeyOrDef) : heroKeyOrDef;
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
  adv.isAdvanced = def.level >= 10 ? (def.isAdvanced !== false) : false; // 滿等 10 級且開啟進階方可轉職
  if (def.customSkills && def.customSkills.length > 0) {
    adv.customSkills = [...def.customSkills];
  }
  if (def.avatarIcon) {
    adv.avatarIcon = def.avatarIcon;
  }
  if (def.characterKey) {
    (adv as any).characterKey = def.characterKey;
  }
  if (def.boundMonsterId) {
    (adv as any).boundMonsterId = def.boundMonsterId;
  }

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
  // 出廠等級若大於 1 等，給予對應等級的自由配點 (每級 2 點)，讓玩家招募英雄後可自由客製化強化
  adv.unspentStatPoints = Math.max(0, (def.level - 1) * 2);

  // 生成並穿戴專屬裝備 (若有指定)
  if (def.equipment.weaponTemplateId) {
    const weapon = EquipmentGenerator.generate(def.equipment.weaponTemplateId);
    if (weapon) {
      weapon.enhancementLevel = def.equipment.weaponEnhance ?? 0;
      if (def.equipment.weaponElement) weapon.element = def.equipment.weaponElement;
      adv.equipment[EquipmentSlot.WEAPON] = weapon;
    }
  }

  if (def.equipment.armorTemplateId) {
    const armor = EquipmentGenerator.generate(def.equipment.armorTemplateId);
    if (armor) {
      armor.enhancementLevel = def.equipment.armorEnhance ?? 0;
      adv.equipment[EquipmentSlot.ARMOR] = armor;
    }
  }

  if (def.equipment.accessoryId) {
    const acc = EquipmentGenerator.generate(def.equipment.accessoryId);
    if (acc) {
      adv.equipment[EquipmentSlot.ACCESSORY] = acc;
    }
  }

  return adv;
}
