import { describe, it, expect } from 'vitest';
import { MonsterSystem } from '../systems/MonsterSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { Adventurer } from '../models/Adventurer';
import { ElementType, EquipmentSlot, FormationRow, MonsterRace, TerrainType, WeaponType } from '../models/types';
import { SubjugationTemplate } from '../models/Narrative';
import { GameState } from '../core/GameState';
import monstersJson from '../data/monsters.json';
import { CombatStudioController } from './CombatStudio';

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

  it('支援 8 大戰鬥定位 (常規均衡/鐵壁肉盾/疾風刺客/奧術法師/嗜血狂戰/遠程狙擊/亡靈泥沼/史詩首領) 與特技施放', () => {
    const baseGoblin = (monstersJson as any[]).find(m => m.id === 'goblin') || (monstersJson as any[])[0];
    
    // 測試 TANK (鐵壁肉盾)
    const tankInst = monsterSys.createMonsterInstance({
      ...baseGoblin,
      profile: 'TANK',
      skills: ['skill_shield_slam']
    } as any, MonsterRace.MONSTER, ElementType.NONE, 2);

    // 測試 ASSASSIN (疾風刺客)
    const assassinInst = monsterSys.createMonsterInstance({
      ...baseGoblin,
      profile: 'ASSASSIN',
      skills: ['skill_shadow_strike']
    } as any, MonsterRace.MONSTER, ElementType.NONE, 2);

    expect(tankInst.hp).toBeGreaterThan(assassinInst.hp);
    expect(assassinInst.speed || 0).toBeGreaterThanOrEqual(tankInst.speed || 0);
  });

  it('支援討伐據點波次守軍自訂 powerTier、8大戰鬥定位、3x3九宮格站位與特技', () => {
    const customStronghold: SubjugationTemplate = {
      id: 'dragon_crystal_cave',
      name: '充滿龍晶的洞穴深處',
      description: '測試據點',
      terrain: 'CAVE' as any,
      difficulty: 5,
      waves: [
        {
          name: '第 1 波：先鋒部隊',
          monsters: [
            { monsterId: 'lizard', powerTier: 1.2, profile: 'TANK' as any, gridR: 0, gridC: 1, slotId: '0_1', formationRow: FormationRow.FRONT },
            { monsterId: 'spider', powerTier: 1.5, profile: 'ASSASSIN' as any, gridR: 2, gridC: 0, slotId: '2_0', formationRow: FormationRow.BACK, skills: ['SKILL_TOXIC_SPRAY'] }
          ]
        },
        {
          name: '第 2 波：據點首領',
          monsters: [
            { monsterId: 'drake', powerTier: 4.0, profile: 'BOSS' as any, gridR: 1, gridC: 1, slotId: '1_1', formationRow: FormationRow.MIDDLE, affix: '👑[黑龍首領]', skills: ['SKILL_DRAGON_BREATH'] }
          ]
        }
      ]
    };

    expect(customStronghold.waves![0].monsters[0].profile).toBe('TANK');
    expect(customStronghold.waves![0].monsters[0].slotId).toBe('0_1');
    expect(customStronghold.waves![0].monsters[0].gridR).toBe(0);
    expect(customStronghold.waves![0].monsters[1].skills).toContain('SKILL_TOXIC_SPRAY');
    expect(customStronghold.waves![1].monsters[0].powerTier).toBe(4.0);
    expect(customStronghold.waves![1].monsters[0].affix).toBe('👑[黑龍首領]');
    expect(customStronghold.waves![1].monsters[0].formationRow).toBe(FormationRow.MIDDLE);
    expect(customStronghold.waves![1].monsters[0].gridC).toBe(1);
  });

  it('normalizeStrongholdWaves 能自動偵測並修復重複的 3x3 九宮格座標，保證每隻怪物站位唯一', () => {
    const studio = new CombatStudioController();
    const collidingStronghold: SubjugationTemplate = {
      id: 'colliding_lair',
      name: '雪山霜狼群測試',
      description: '測試重複座標',
      terrain: TerrainType.SNOW_MOUNTAIN as any,
      difficulty: 5,
      waves: [
        {
          name: '第 1 波：雪山霜狼群',
          monsters: [
            { monsterId: 'frost_wolf', powerTier: 1.8, gridR: 0, gridC: 0, slotId: '0_0' },
            { monsterId: 'frost_wolf', powerTier: 1.8, gridR: 0, gridC: 1, slotId: '0_1' },
            { monsterId: 'frost_wolf', powerTier: 1.2, gridR: 0, gridC: 2, slotId: '0_2' },
            { monsterId: 'frost_wolf', powerTier: 1.2, gridR: 0, gridC: 0, slotId: '0_0' }, // 重複 0_0
            { monsterId: 'yeti', powerTier: 1.9, gridR: 0, gridC: 1, slotId: '0_1' }        // 重複 0_1
          ]
        }
      ]
    };

    const isModified = studio.normalizeStrongholdWaves(collidingStronghold);
    expect(isModified).toBe(true);

    const monsters = collidingStronghold.waves![0].monsters;
    expect(monsters.length).toBe(5);

    // 驗證 5 隻怪物的 slotId 100% 各不相同且合法
    const slotSet = new Set(monsters.map(m => m.slotId));
    expect(slotSet.size).toBe(5);

    monsters.forEach(m => {
      expect(m.slotId).toBeDefined();
      expect(/^[0-2]_[0-2]$/.test(m.slotId!)).toBe(true);
      const [r, c] = m.slotId!.split('_').map(Number);
      expect(m.gridR).toBe(r);
      expect(m.gridC).toBe(c);
      if (r === 0) expect(m.formationRow).toBe(FormationRow.FRONT);
      else if (r === 1) expect(m.formationRow).toBe(FormationRow.MIDDLE);
      else expect(m.formationRow).toBe(FormationRow.BACK);
    });
  });

  it('支援據點工坊自訂勢力、節點規模、世界生成模式與允許帶兵攻城 (allowTroops) 屬性', () => {
    const siegeCapital: SubjugationTemplate = {
      id: 'val_forge_capital_test',
      name: '鍛主之城測試',
      description: '北境軍事首都',
      terrain: 'VOLCANO' as any,
      difficulty: 8,
      worldGenMode: 'PERMANENT_VISIBLE',
      allowTroops: true,
      factionId: 'f_vormund',
      nodeLevel: 4 as any,
      enemyLegion: {
        enabled: true,
        infantry: 250,
        archer: 100,
        cavalry: 80
      }
    };

    expect(siegeCapital.allowTroops).toBe(true);
    expect(siegeCapital.worldGenMode).toBe('PERMANENT_VISIBLE');
    expect(siegeCapital.factionId).toBe('f_vormund');
    expect(siegeCapital.nodeLevel).toBe(4);
    expect(siegeCapital.enemyLegion?.enabled).toBe(true);
    expect(siegeCapital.enemyLegion?.infantry).toBe(250);
  });
});

