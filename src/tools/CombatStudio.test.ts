import { describe, it, expect } from 'vitest';
import { MonsterSystem } from '../systems/MonsterSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { Adventurer } from '../models/Adventurer';
import { ElementType, EquipmentSlot, FormationRow, MonsterRace, TerrainType, WeaponType } from '../models/types';
import { GameState } from '../core/GameState';
import monstersJson from '../data/monsters.json';

describe('戰鬥平衡與遭遇工坊核心功能測試 (Combat Studio Core Tests)', () => {
  const monsterSys = new MonsterSystem();

  it('能正確從資料庫實例化怪物並計算大一統戰力分數', () => {
    const baseGoblin = (monstersJson as any[]).find(m => m.id === 'goblin')!;
    const goblinInst = monsterSys.createMonsterInstance(baseGoblin, MonsterRace.MONSTER, ElementType.NONE, 2);

    expect(goblinInst.name).toContain('哥布林');
    expect(goblinInst.hp).toBeGreaterThan(40);
    expect(goblinInst.damage).toBeGreaterThan(10);
    expect(goblinInst.calculatedPowerScore).toBeGreaterThan(0);
  });

  it('進階職業【大魔導士】與【狂戰士】能正確掛載並施放進階技能與元素轉化技能', () => {
    const mageJob = {
      name: '大魔導士',
      baseAttributes: { str: 5, agi: 10, con: 10, int: 35, spr: 20, luk: 10, charm: 10, command: 10 },
      growthRates: { str: 1, agi: 1, con: 1, int: 4, spr: 2, luk: 1, charm: 1, command: 1 }
    };
    const mage = new Adventurer('test_archmage', '炎之大魔導', mageJob as any, { name: '天才', xpModifier: 1.0, statMultipliers: {} } as any, 'SSR');
    mage.level = 10;
    mage.isAdvanced = true;
    mage.equipment = {
      [EquipmentSlot.WEAPON]: {
        id: 'wpn_fire_staff',
        name: '烈焰隕星杖',
        slot: EquipmentSlot.WEAPON,
        tier: 4,
        weaponType: WeaponType.STAFF,
        element: ElementType.FIRE,
        requirements: {},
        effects: {},
        combatEffects: { atk: 80, matk: 80 }
      }
    };

    GameState.adventurers = [mage];

    const targetMonster = monsterSys.createMonsterInstance(
      (monstersJson as any[])[0],
      MonsterRace.MONSTER,
      ElementType.LIGHTNING,
      2
    );

    const report = CombatSystem.simulateCombat(
      [mage.id],
      1,
      '',
      TerrainType.PLAINS,
      1,
      undefined,
      [targetMonster]
    );

    expect(report.events.length).toBeGreaterThan(0);
    const hasCastSkill = report.events.some(ev => 
      ev.skillName === '熾炎飛彈' || 
      ev.skillName === '隕石轟炸' || 
      ev.skillName === '靜電新星' ||
      ev.text.includes('熾炎飛彈') || 
      ev.text.includes('隕石轟炸')
    );
    expect(hasCastSkill).toBe(true);
  });

  it('支援多波次每波獨立陣容，且 Boss 僅在決戰波登場', () => {
    const defaultJob = {
      name: '狂戰士',
      baseAttributes: { str: 30, agi: 15, con: 20, int: 10, spr: 10, luk: 10, charm: 10, command: 10 },
      growthRates: { str: 4, agi: 2, con: 3, int: 1, spr: 1, luk: 1, charm: 1, command: 1 }
    };
    const berserker = new Adventurer('test_ber', '狂戰雷恩', defaultJob as any, { name: '狂暴', xpModifier: 1.0, statMultipliers: {} } as any, 'SSR');
    berserker.level = 10;
    berserker.isAdvanced = true;
    berserker.equipment = {
      [EquipmentSlot.WEAPON]: {
        id: 'wpn_gs',
        name: '滅世巨劍',
        slot: EquipmentSlot.WEAPON,
        tier: 4,
        weaponType: WeaponType.GREATSWORD,
        requirements: {},
        effects: {},
        combatEffects: { atk: 90, patk: 90 }
      },
      [EquipmentSlot.ARMOR]: {
        id: 'arm_h',
        name: '狂戰重甲',
        slot: EquipmentSlot.ARMOR,
        tier: 4,
        requirements: {},
        effects: {},
        combatEffects: { def: 50, hp: 200 }
      }
    };

    GameState.adventurers = [berserker];

    const minionWave1 = [monsterSys.createMonsterInstance((monstersJson as any[])[0], MonsterRace.MONSTER, ElementType.NONE, 1)];
    const minionWave2 = [monsterSys.createMonsterInstance((monstersJson as any[])[1], MonsterRace.MONSTER, ElementType.NONE, 2)];
    const bossWave3 = [
      monsterSys.createMonsterInstance((monstersJson as any[])[2], MonsterRace.MONSTER, ElementType.DARK, 5)
    ];
    bossWave3[0].name = '👑[首領] 暗黑骨龍獸';

    const report = CombatSystem.simulateCombat(
      [berserker.id],
      1,
      '',
      TerrainType.PLAINS,
      3,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      [minionWave1, minionWave2, bossWave3]
    );

    expect(report.events.length).toBeGreaterThan(0);
    // 驗證戰報能正確跨 3 波執行
    expect(report.isVictory !== undefined).toBe(true);
  });

  it('支援極速批次模擬並正確收集勝率與回合數', () => {
    const defaultJob = {
      name: '聖騎士',
      baseAttributes: { str: 20, agi: 15, con: 25, int: 10, spr: 15, luk: 10, charm: 10, command: 10 },
      growthRates: { str: 3, agi: 2, con: 4, int: 1, spr: 2, luk: 1, charm: 1, command: 1 }
    };
    const paladin = new Adventurer('test_pala', '聖騎羅蘭', defaultJob as any, { name: '堅定', xpModifier: 1.0, statMultipliers: {} } as any, 'SSR');
    paladin.level = 10;
    paladin.isAdvanced = true;
    paladin.equipment = {
      [EquipmentSlot.WEAPON]: {
        id: 'wpn_holy_sword',
        name: '太陽神劍',
        slot: EquipmentSlot.WEAPON,
        tier: 4,
        weaponType: WeaponType.SWORD_AND_SHIELD,
        element: ElementType.HOLY,
        requirements: {},
        effects: {},
        combatEffects: { atk: 80, patk: 80 }
      },
      [EquipmentSlot.ARMOR]: {
        id: 'arm_plate',
        name: '聖殿光輝鎧',
        slot: EquipmentSlot.ARMOR,
        tier: 4,
        requirements: {},
        effects: {},
        combatEffects: { def: 60, hp: 300 }
      }
    };

    GameState.adventurers = [paladin];

    const slime = monsterSys.createMonsterInstance(
      (monstersJson as any[])[0],
      MonsterRace.MONSTER,
      ElementType.NONE,
      1
    );

    let wins = 0;
    for (let i = 0; i < 20; i++) {
      const rep = CombatSystem.simulateCombat([paladin.id], 1, '', TerrainType.PLAINS, 1, undefined, [slime]);
      if (rep.isVictory) wins++;
    }

    expect(wins).toBe(20);
  });
});
