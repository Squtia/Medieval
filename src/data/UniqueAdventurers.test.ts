import { describe, expect, it } from 'vitest';
import { createUniqueAdventurer, getSelectableHeroes, UNIQUE_HEROES } from './UniqueAdventurers';
import { EquipmentSlot, Gender } from '../models/types';

describe('Unique Adventurers System', () => {
  it('creates UR Berserker Reyn Valentine with valid stats and god-tier equipment', () => {
    const reyn = createUniqueAdventurer('reyn');
    expect(reyn).not.toBeNull();
    if (!reyn) return;

    expect(reyn.quality).toBe('UR');
    expect(reyn.level).toBe(10);
    expect(reyn.isAdvanced).toBe(true);
    expect(reyn.baseAttributes.str).toBe(60);
    expect(reyn.baseAttributes.con).toBe(60);
    expect(reyn.equipment[EquipmentSlot.WEAPON]).toBeDefined();
    expect(reyn.equipment[EquipmentSlot.WEAPON]?.enhancementLevel).toBeGreaterThanOrEqual(0);
    expect(reyn.equipment[EquipmentSlot.ARMOR]).toBeDefined();
    expect(reyn.equipment[EquipmentSlot.ACCESSORY]).toBeDefined();
  });

  it('creates SSR Archmage Luna Starfall with valid magic stats', () => {
    const luna = createUniqueAdventurer('luna');
    expect(luna).not.toBeNull();
    if (!luna) return;

    expect(luna.quality).toBe('SSR');
    expect(luna.level).toBe(5);
    expect(luna.isAdvanced).toBe(false);
    expect(luna.baseAttributes.int).toBe(45);
    expect(luna.baseAttributes.spr).toBe(27);
    expect(luna.equipment[EquipmentSlot.WEAPON]).toBeDefined();
    expect(luna.equipment[EquipmentSlot.ACCESSORY]?.id).toBe('acc_scholar_pendant');
  });

  it('creates UR Sacred Oath Guardian with isGuardian flag and holy equipment', () => {
    const oath = createUniqueAdventurer('oath');
    expect(oath).not.toBeNull();
    if (!oath) return;

    expect(oath.quality).toBe('UR');
    expect(oath.isGuardian).toBe(true);
    expect(oath.level).toBe(10);
    expect(oath.isAdvanced).toBe(true);
    expect(oath.baseAttributes.con).toBe(38);
    expect(oath.equipment[EquipmentSlot.WEAPON]?.element).toBe('HOLY');
  });

  it('returns null for unknown hero key', () => {
    const unknown = createUniqueAdventurer('non_existent_hero');
    expect(unknown).toBeNull();
  });

  it('supports custom hero with customized skills and partial empty equipment slots', () => {
    const customHeroKey = 'test_custom';
    UNIQUE_HEROES[customHeroKey] = {
      id: 'unique_custom_test',
      name: '測試自訂勇士',
      title: '【風暴之刃】',
      quality: 'SR',
      jobKey: 'WARRIOR',
      traitKey: 'BRAVE',
      gender: Gender.MALE,
      isGuardian: false,
      avatarIndex: 0,
      level: 10,
      customSkills: ['MAGE_ARCANE_MISSILES', 'FIGHTER_ARMOR_BREAK', 'SNIPER_FATAL_SNIPE'],
      biography: '測試生平',
      customAttributes: { str: 20, agi: 20, con: 20, int: 10, spr: 10, luk: 10 },
      equipment: {
        weaponTemplateId: 'wpn_meteoric_greatsword',
        weaponEnhance: 5,
        armorTemplateId: undefined, // 空防具
        accessoryId: undefined     // 空飾品
      }
    };

    const hero = createUniqueAdventurer(customHeroKey);
    expect(hero).not.toBeNull();
    if (!hero) return;

    expect(hero.customSkills).toEqual(['MAGE_ARCANE_MISSILES', 'FIGHTER_ARMOR_BREAK', 'SNIPER_FATAL_SNIPE']);
    expect(hero.equipment[EquipmentSlot.WEAPON]).toBeDefined();
    expect(hero.equipment[EquipmentSlot.ARMOR]).toBeUndefined();
    expect(hero.equipment[EquipmentSlot.ACCESSORY]).toBeUndefined();

    delete UNIQUE_HEROES[customHeroKey];
  });

  it('getSelectableHeroes 嚴格過濾排除內部測試英雄 isTestOnly', () => {
    const selectable = getSelectableHeroes();
    expect(selectable.some(h => h.id === 'test_guardian_hero')).toBe(false);
    expect(selectable.some(h => h.id.includes('reyn'))).toBe(true);
    expect(selectable.some(h => h.id.includes('luna'))).toBe(true);
  });
});
