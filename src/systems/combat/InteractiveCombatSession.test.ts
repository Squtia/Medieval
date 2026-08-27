import { describe, it, expect, beforeEach } from 'vitest';
import { InteractiveCombatSession } from './InteractiveCombatSession';
import { GameState } from '../../core/GameState';
import { Adventurer } from '../../models/Adventurer';
import { NobleTitle, TerrainType, MonsterInstance, ElementType, MonsterRace } from '../../models/types';
import { DataStore } from '../DataStore';
import { CombatEventType } from '../../models/Combat';

describe('InteractiveCombatSession Tests', () => {
  beforeEach(() => {
    GameState.adventurers = [];
    const hero1 = new Adventurer('adv_h1', '亞瑟', DataStore.getRandomJob(), DataStore.getRandomRecruitTrait(), 'SSR', 'MALE' as any, false);
    hero1.level = 10;
    const hero2 = new Adventurer('adv_h2', '蘭斯洛特', DataStore.getRandomJob(), DataStore.getRandomRecruitTrait(), 'SR', 'MALE' as any, false);
    hero2.level = 8;
    GameState.adventurers = [hero1, hero2];
  });

  it('1. 初始化親征實時會話並取得開局事件', () => {
    const enemy1: MonsterInstance = {
      id: 'e1',
      name: '哥布林斥候',
      hp: 150,
      maxHp: 150,
      damage: 20,
      defense: 10,
      pdef: 10,
      mdef: 5,
      speed: 12,
      evade: 5,
      calculatedPowerScore: 100,
      skills: [],
      element: ElementType.NONE,
      race: MonsterRace.MONSTER,
      appliedRaceTag: MonsterRace.MONSTER,
      compatibleRaces: [MonsterRace.MONSTER],
      terrains: [TerrainType.PLAINS],
      powerTier: 1,
      gridR: 0,
      gridC: 0
    };

    const enemy2: MonsterInstance = {
      id: 'e2',
      name: '哥布林戰士',
      hp: 200,
      maxHp: 200,
      damage: 25,
      defense: 15,
      pdef: 15,
      mdef: 5,
      speed: 10,
      evade: 5,
      calculatedPowerScore: 120,
      skills: [],
      element: ElementType.NONE,
      race: MonsterRace.MONSTER,
      appliedRaceTag: MonsterRace.MONSTER,
      compatibleRaces: [MonsterRace.MONSTER],
      terrains: [TerrainType.PLAINS],
      powerTier: 1,
      gridR: 0,
      gridC: 1
    };

    const session = new InteractiveCombatSession(
      ['adv_h1', 'adv_h2'],
      1,
      '親征平原之戰',
      TerrainType.PLAINS,
      [[enemy1, enemy2]],
      {
        isSiege: false,
        isLordCampaign: true,
        lordTitle: NobleTitle.BARON,
        assignedTroops: { infantry: 50, archer: 36, cavalry: 16 },
        gateHp: 0
      }
    );

    expect(session.lordAura).toBeDefined();
    expect(session.assignedTroops.archer).toBe(36);
    expect(session.assignedTroops.cavalry).toBe(16);

    const initEvents = session.getInitialEvents();
    expect(initEvents.some(e => e.type === CombatEventType.LORD_AURA_TRIGGER)).toBe(true);
    expect(initEvents.some(e => e.type === CombatEventType.WAVE_START)).toBe(true);
    expect(initEvents.some(e => e.type === CombatEventType.TURN_START && e.turn === 1)).toBe(true);
  });

  it('2. 單步執行【漫天箭雨】軍令，實時削弱敵軍並進入冷卻倒數', () => {
    const enemy1: MonsterInstance = {
      id: 'e1',
      name: '哥布林斥候',
      hp: 300,
      maxHp: 300,
      damage: 20,
      defense: 10,
      pdef: 10,
      mdef: 5,
      speed: 12,
      evade: 5,
      calculatedPowerScore: 100,
      skills: [],
      element: ElementType.NONE,
      race: MonsterRace.MONSTER,
      appliedRaceTag: MonsterRace.MONSTER,
      compatibleRaces: [MonsterRace.MONSTER],
      terrains: [TerrainType.PLAINS],
      powerTier: 1,
      gridR: 0,
      gridC: 0
    };

    const enemy2: MonsterInstance = {
      id: 'e2',
      name: '哥布林戰士',
      hp: 300,
      maxHp: 300,
      damage: 25,
      defense: 15,
      pdef: 15,
      mdef: 5,
      speed: 10,
      evade: 5,
      calculatedPowerScore: 120,
      skills: [],
      element: ElementType.NONE,
      race: MonsterRace.MONSTER,
      appliedRaceTag: MonsterRace.MONSTER,
      compatibleRaces: [MonsterRace.MONSTER],
      terrains: [TerrainType.PLAINS],
      powerTier: 1,
      gridR: 0,
      gridC: 1
    };

    const session = new InteractiveCombatSession(
      ['adv_h1', 'adv_h2'],
      1,
      '親征平原之戰',
      TerrainType.PLAINS,
      [[enemy1, enemy2]],
      {
        isSiege: false,
        isLordCampaign: true,
        lordTitle: NobleTitle.BARON,
        assignedTroops: { infantry: 50, archer: 36, cavalry: 16 },
        gateHp: 0
      }
    );
    session.getInitialEvents();

    // ── 第 1 回合：發動漫天箭雨 ──
    const turn1Events = session.stepTurn('VOLLEY_FIRE');
    const volleyEvent = turn1Events.find(e => e.type === CombatEventType.ARCHER_VOLLEY);
    expect(volleyEvent).toBeDefined();
    expect(volleyEvent?.text).toContain('漫天箭雨');

    // 驗證第 1 回合結束後，箭雨 CD 剛好 -1 變為 1
    expect(session.tacticCds.VOLLEY_FIRE).toBe(1);
    expect(session.turn).toBe(2);

    // ── 第 2 回合：選擇待命 ──
    const turn2Events = session.stepTurn('STANDBY');
    expect(turn2Events.some(e => e.type === CombatEventType.ARCHER_VOLLEY)).toBe(false);

    // 驗證第 2 回合結束後，箭雨 CD 歸零 (可再次使用)
    expect(session.tacticCds.VOLLEY_FIRE).toBe(0);
  });

  it('3. 全波次清剿後正確結束並產出完整戰報', () => {
    const weakEnemy: MonsterInstance = {
      id: 'e_weak',
      name: '殘血哥布林',
      hp: 10,
      maxHp: 10,
      damage: 5,
      defense: 2,
      pdef: 2,
      mdef: 2,
      speed: 5,
      evade: 5,
      calculatedPowerScore: 50,
      skills: [],
      element: ElementType.NONE,
      race: MonsterRace.MONSTER,
      appliedRaceTag: MonsterRace.MONSTER,
      compatibleRaces: [MonsterRace.MONSTER],
      terrains: [TerrainType.PLAINS],
      powerTier: 1,
      gridR: 0,
      gridC: 0
    };

    const session = new InteractiveCombatSession(
      ['adv_h1'],
      1,
      '速勝戰役',
      TerrainType.PLAINS,
      [[weakEnemy]],
      {
        isSiege: false,
        isLordCampaign: true,
        lordTitle: NobleTitle.KNIGHT,
        assignedTroops: { infantry: 10, archer: 10, cavalry: 10 },
        gateHp: 0
      }
    );
    session.getInitialEvents();

    const turn1Events = session.stepTurn('CAVALRY_CHARGE');
    expect(session.isFinished).toBe(true);
    expect(session.isVictory).toBe(true);
    expect(turn1Events.some(e => e.type === CombatEventType.END)).toBe(true);

    const report = session.generateFinalReport();
    expect(report.isVictory).toBe(true);
    expect(report.isLordCampaign).toBe(true);
    expect(report.commanderTroops?.cavalry).toBe(10);
  });
});
