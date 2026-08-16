if (typeof (globalThis as any).document === 'undefined') {
  (globalThis as any).document = {
    addEventListener: () => {},
    getElementById: () => null,
    createElement: () => ({ style: {}, appendChild: () => {} })
  };
}

import { describe, it, expect } from 'vitest';
import { getEquipComparisonTooltipHtml, renderSingleEquipCardHtml } from './ShopController';
import { Adventurer } from '../models/Adventurer';
import { EquipmentSlot, WeaponType } from '../models/types';

describe('Equip Comparison Tooltip', () => {
  const createMockAdventurer = () => {
    const job = {
      name: '戰士',
      baseAttributes: { str: 10, agi: 8, con: 10, int: 4, spr: 6, luk: 6, charm: 5, command: 5 },
      growthRates: { str: 2, agi: 1, con: 2, int: 0, spr: 1, luk: 1 }
    };
    const trait = {
      id: 'brave',
      name: '勇敢',
      description: '物理攻擊力提升',
      xpModifier: 1.0,
      statMultipliers: { str: 0.1 }
    };
    return new Adventurer('adv_1', '加雷斯·葛雷夫', job as any, trait as any);
  };

  const swordA: any = {
    uuid: 'sword_a',
    id: 'wpn_zanbato',
    name: '斬馬劍',
    slot: EquipmentSlot.WEAPON,
    weaponType: WeaponType.GREATSWORD,
    tier: 2,
    enhancementLevel: 2,
    requirements: {},
    effects: {},
    baseCombatEffects: { patk: 25, pdef: 10 },
    combatEffects: { patk: 25, pdef: 10 }
  };

  const swordB: any = {
    uuid: 'sword_b',
    id: 'wpn_heirloom_sword',
    name: '破敗的傳家寶劍',
    slot: EquipmentSlot.WEAPON,
    weaponType: WeaponType.GREATSWORD,
    tier: 1,
    enhancementLevel: 0,
    requirements: {},
    effects: { str: 5, con: 5 },
    baseCombatEffects: { patk: 15, hit: 10 },
    combatEffects: { patk: 15, hit: 10 }
  };

  it('renders single equipment card correctly when equipped or empty', () => {
    const emptyHtml = renderSingleEquipCardHtml(null, '🛡️【當前穿戴】', true);
    expect(emptyHtml).toContain('(未穿戴任何裝備)');

    const equippedHtml = renderSingleEquipCardHtml(swordA, '🛡️【當前穿戴】', true);
    expect(equippedHtml).toContain('斬馬劍 +2 (T2)');
    expect(equippedHtml).toContain('物攻+25');
  });

  it('generates comparison tooltip with power differential calculation', () => {
    const adv = createMockAdventurer();
    adv.equipment[EquipmentSlot.WEAPON] = swordA;

    const tooltipHtml = getEquipComparisonTooltipHtml(adv, EquipmentSlot.WEAPON, swordB);
    expect(tooltipHtml).toContain('加雷斯·葛雷夫');
    expect(tooltipHtml).toContain('戰力評估');
    expect(tooltipHtml).toContain('【當前穿戴】');
    expect(tooltipHtml).toContain('【選中裝備】');
    expect(tooltipHtml).toContain('斬馬劍');
    expect(tooltipHtml).toContain('破敗的傳家寶劍');
  });

  it('handles empty equipment slot in comparison', () => {
    const adv = createMockAdventurer();
    delete adv.equipment[EquipmentSlot.WEAPON];

    const tooltipHtml = getEquipComparisonTooltipHtml(adv, EquipmentSlot.WEAPON, swordB);
    expect(tooltipHtml).toContain('(未穿戴任何裝備)');
    expect(tooltipHtml).toContain('破敗的傳家寶劍');
    expect(tooltipHtml).toContain('戰力提升');
  });
});
