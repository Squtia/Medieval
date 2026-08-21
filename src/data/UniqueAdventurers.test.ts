import { describe, expect, it } from 'vitest';
import { createUniqueAdventurer, UNIQUE_HEROES } from './UniqueAdventurers';
import { EquipmentSlot } from '../models/types';

describe('Unique Adventurers System', () => {
  it('creates UR Berserker Reyn Valentine with valid stats and god-tier equipment', () => {
    const reyn = createUniqueAdventurer('reyn');
    expect(reyn).not.toBeNull();
    if (!reyn) return;

    expect(reyn.quality).toBe('UR');
    expect(reyn.level).toBe(10);
    expect(reyn.isAdvanced).toBe(true);
    expect(reyn.baseAttributes.str).toBe(45);
    expect(reyn.baseAttributes.con).toBe(30);
    expect(reyn.equipment[EquipmentSlot.WEAPON]).toBeDefined();
    expect(reyn.equipment[EquipmentSlot.WEAPON]?.enhancementLevel).toBe(7);
    expect(reyn.equipment[EquipmentSlot.ARMOR]).toBeDefined();
    expect(reyn.equipment[EquipmentSlot.ACCESSORY]).toBeDefined();
  });

  it('creates SSR Archmage Luna Starfall with valid magic stats', () => {
    const luna = createUniqueAdventurer('luna');
    expect(luna).not.toBeNull();
    if (!luna) return;

    expect(luna.quality).toBe('SSR');
    expect(luna.level).toBe(10);
    expect(luna.isAdvanced).toBe(true);
    expect(luna.baseAttributes.int).toBe(42);
    expect(luna.baseAttributes.spr).toBe(26);
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
});
