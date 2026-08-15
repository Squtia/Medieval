import { describe, it, expect } from 'vitest';
import { EnhancementSystem } from './EnhancementSystem';
import { Territory } from '../models/Territory';
import { Equipment, EquipmentSlot, WeaponType } from '../models/types';

describe('EnhancementSystem Facility Caps & Mechanics', () => {
  const createMockEquipment = (enhancementLevel: number = 0): Equipment => ({
    uuid: 'mock_eq_1',
    id: 'wpn_iron_greatsword',
    name: '鐵大劍',
    slot: EquipmentSlot.WEAPON,
    weaponType: WeaponType.GREATSWORD,
    tier: 1,
    enhancementLevel,
    baseCombatEffects: { patk: 12 },
    combatEffects: { patk: 12 }
  });

  it('should return correct max enhancement levels based on forge facility level', () => {
    expect(EnhancementSystem.getMaxEnhancementLevel(0)).toBe(3);
    expect(EnhancementSystem.getMaxEnhancementLevel(1)).toBe(3);
    expect(EnhancementSystem.getMaxEnhancementLevel(2)).toBe(6);
    expect(EnhancementSystem.getMaxEnhancementLevel(3)).toBe(10);
  });

  it('should block enhancement when exceeding facility max level', () => {
    const territory = new Territory('領地');
    territory.gold = 5000;
    territory.forgeLevel = 1; // Lv1 鐵匠鋪，上限 +3

    const eq = createMockEquipment(3);
    const result = EnhancementSystem.enhance(territory, eq);
    expect(result).toContain('設施等級不足');
    expect(eq.enhancementLevel).toBe(3);
  });

  it('should allow enhancement when upgrading forgeLevel', () => {
    const territory = new Territory('領地');
    territory.gold = 5000;
    territory.forgeLevel = 2; // Lv2 工藝坊，上限 +6

    const eq = createMockEquipment(3);
    const result = EnhancementSystem.enhance(territory, eq);
    // 成功或失敗但不會被設施阻斷
    expect(result).not.toContain('設施等級不足');
  });
});
