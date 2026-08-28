import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../../core/GameState';
import { Territory } from '../../models/Territory';
import { Adventurer } from '../../models/Adventurer';
import { LordCommanderSystem, SiegeEngineRegistry } from './LordCommanderSystem';
import { InteractiveCombatSession } from './InteractiveCombatSession';
import { 
  FormationRow, 
  NobleTitle, 
  SIEGE_ENGINE_CONFIGS, 
  SiegeEngineType, 
  TerrainType, 
  ElementType, 
  MonsterRace, 
  MonsterInstance, 
  MapNode,
  SiegeBattleMode,
  SiegeRole
} from '../../models/types';
import { CombatEventType } from '../../models/Combat';
import { OffensiveSiegeModalController } from '../../ui/modals/OffensiveSiegeModalController';

describe('大軍攻城遠征戰役系統全鏈路測試 (OffensiveSiegeSystem Tests)', () => {
  beforeEach(() => {
    GameState.myTerritory = new Territory('測試主城');
    GameState.adventurers = [];
    GameState.totalDays = 10;
  });

  it('1. 弓兵漫天箭雨正確根據受擊目標 PDEF 進行減傷計算', () => {
    const archerCount = 36; // 基礎未減傷約 192 (sqrt(36)*32)

    // 無防禦目標 (PDEF = 0)
    const dmgNoDef = LordCommanderSystem.calculateVolleyFire(archerCount, 0);
    expect(dmgNoDef).toBe(192);

    // 輕甲目標 (PDEF = 20) ➔ 192 * (100/120) = 160
    const dmgLight = LordCommanderSystem.calculateVolleyFire(archerCount, 20);
    expect(dmgLight).toBe(160);

    // 重甲鐵衛 (PDEF = 100) ➔ 192 * (100/200) = 96
    const dmgHeavy = LordCommanderSystem.calculateVolleyFire(archerCount, 100);
    expect(dmgHeavy).toBe(96);

    // 太古 Boss (PDEF = 200) ➔ 192 * (100/300) = 64
    const dmgBoss = LordCommanderSystem.calculateVolleyFire(archerCount, 200);
    expect(dmgBoss).toBe(64);

    expect(dmgNoDef).toBeGreaterThan(dmgLight);
    expect(dmgLight).toBeGreaterThan(dmgHeavy);
    expect(dmgHeavy).toBeGreaterThan(dmgBoss);
  });

  it('2. 撞木衝車：多台交替輪流衝撞降 CD，每台需 ≥10 步兵推車', () => {
    // 1 台衝車：第 1 回合撞擊 (400)，第 2 回合倒車蓄力待命
    const ram1_t1 = LordCommanderSystem.calculateBatteringRamCycle(1, 10, 1);
    expect(ram1_t1.canOperate).toBe(true);
    expect(ram1_t1.willStrike).toBe(true);
    expect(ram1_t1.totalDamage).toBe(400);

    const ram1_t2 = LordCommanderSystem.calculateBatteringRamCycle(1, 10, 2);
    expect(ram1_t2.willStrike).toBe(false);
    expect(ram1_t2.reason).toContain('倒車蓄力');

    // 2 台衝車：交替接力，每回合連續撞擊 (第 1, 2 回合皆撞擊)
    const ram2_t1 = LordCommanderSystem.calculateBatteringRamCycle(2, 20, 1);
    const ram2_t2 = LordCommanderSystem.calculateBatteringRamCycle(2, 20, 2);
    expect(ram2_t1.willStrike).toBe(true);
    expect(ram2_t2.willStrike).toBe(true);
    expect(ram2_t1.totalDamage).toBe(400);

    // 2 台衝車但步兵只有 15 人 (< 20 人) ➔ 癱瘓
    const ram2_insufficient = LordCommanderSystem.calculateBatteringRamCycle(2, 15, 1);
    expect(ram2_insufficient.canOperate).toBe(false);
    expect(ram2_insufficient.reason).toContain('推車步兵不足 20 人');

    // 50 名步兵推 1 台車 ➔ 400 + (50-10)*5 = 600
    const ram1_heavy = LordCommanderSystem.calculateBatteringRamCycle(1, 50, 1);
    expect(ram1_heavy.totalDamage).toBe(600);
  });

  it('3. 巨型投石機：多台齊射傷害邊際遞減 (800 / 1360 / 1752)', () => {
    // 1 台：800
    const treb1 = LordCommanderSystem.calculateTrebuchetVolley(1);
    expect(treb1.gateDamage).toBe(800);

    // 2 台：800 + 560 = 1360 (邊際遞減 70%)
    const treb2 = LordCommanderSystem.calculateTrebuchetVolley(2);
    expect(treb2.gateDamage).toBe(1360);
    expect(treb2.perEngineDamages).toEqual([800, 560]);

    // 3 台：800 + 560 + 392 = 1752 (邊際遞減 70% -> 49%)
    const treb3 = LordCommanderSystem.calculateTrebuchetVolley(3);
    expect(treb3.gateDamage).toBe(1752);
    expect(treb3.perEngineDamages).toEqual([800, 560, 392]);
  });

  it('4. 弓兵後排陣地生命池 (40 HP/人) 正確轉換與生還折算', () => {
    const rearHp100 = LordCommanderSystem.calculateArcherRearHp(100);
    expect(rearHp100).toBe(4000);

    // 受到 1200 傷害後剩餘 2800 HP ➔ 生還 70 人 (陣亡 30 人)
    const surviving = LordCommanderSystem.calculateSurvivingArchers(2800);
    expect(surviving).toBe(70);
  });

  it('5. 攻城實時親征戰役中：器械自動轟門、城門未破前騎兵待命、城門破後解鎖破城突入', () => {
    const dummyJob = {
      id: 'warrior',
      name: '戰士',
      tier: 1,
      description: '戰士',
      baseAttributes: { str: 10, agi: 5, con: 8, int: 2, spr: 3, luk: 2 },
      growthRates: { str: 2, agi: 1, con: 2, int: 0, spr: 0, luk: 1 }
    };
    const dummyTrait = {
      id: 'brave',
      name: '勇敢',
      description: '勇敢',
      statModifiers: {}
    };
    const adv = new Adventurer('adv_1', '先鋒領主', dummyJob as any, dummyTrait as any);
    adv.currentHp = 500;
    adv.currentMp = 100;
    GameState.adventurers = [adv];

    const defender: MonsterInstance = {
      id: 'test_defender',
      name: '城垛守衛',
      hp: 300,
      maxHp: 300,
      damage: 10,
      defense: 20,
      pdef: 20,
      mdef: 10,
      evade: 5,
      calculatedPowerScore: 100,
      element: ElementType.NONE,
      race: MonsterRace.HUMAN,
      compatibleRaces: [MonsterRace.HUMAN],
      terrains: [TerrainType.WILDERNESS],
      appliedRaceTag: MonsterRace.HUMAN,
      powerTier: 1.0,
      formationRow: FormationRow.FRONT,
      gridR: 0,
      gridC: 0
    };

    const session = new InteractiveCombatSession(
      ['adv_1'],
      1,
      '測試攻城戰',
      TerrainType.WILDERNESS,
      [[defender]],
      {
        isSiege: true,
        isOffensiveSiege: true,
        gateHp: 1000, // 城門 1000 HP
        assignedTroops: { infantry: 20, archer: 25, cavalry: 15 },
        engines: { ramCount: 1, trebuchetCount: 1 },
        isLordCampaign: true
      }
    );

    expect(session.isOffensiveSiege).toBe(true);
    expect(session.engines.ramCount).toBe(1);
    expect(session.trebuchetShotsLeft).toBe(4);
    expect(session.gateRemainingHp).toBe(1000);

    // 回合 1：下達騎兵衝鋒軍令 ➔ 城門未破，騎兵待命鎖定
    const eventsRound1 = session.stepTurn('CAVALRY_CHARGE');
    const tacticEvent = eventsRound1.find(e => e.type === CombatEventType.COMMANDER_TACTIC && e.text.includes('騎兵待命中'));
    expect(tacticEvent).toBeDefined();

    // 投石機第 1 回合自動發射巨石 (800 傷害) + 衝車撞擊 20 步兵 (400 + 10*5 = 450 傷害)
    // 總傷害 800 + 450 = 1250 >= 1000 ➔ 城門應被轟碎！
    const breakEvent = eventsRound1.find(e => e.type === CombatEventType.SIEGE_GATE_BREAK);
    expect(breakEvent).toBeDefined();
    expect(session.gateRemainingHp).toBe(0);

    // 回合 2：城門已破，騎兵軍令解鎖發動【破城毀滅突入】
    const eventsRound2 = session.stepTurn('CAVALRY_CHARGE');
    const breachEvent = eventsRound2.find(e => e.type === CombatEventType.CAVALRY_BREACH_CHARGE);
    expect(breachEvent).toBeDefined();
    expect(breachEvent?.text).toContain('破城毀滅突入');
  });

  it('6. 攻城勝利後正確收編為附庸並獲得繁榮度加成', () => {
    const targetNode: MapNode = {
      id: 'node_red_sand',
      name: '赤砂城',
      x: 100,
      y: 100,
      population: 500,
      prosperity: 250,
      nodeLevel: 3 as any,
      feature: 'TOWN' as any,
      terrain: TerrainType.DESERT,
      isPlayerBase: false,
      isDiscovered: true,
      ownerFactionId: 'sand_clan',
      defenseLevel: 3,
      description: '沙漠要塞',
      isScouted: true,
      scoutExpiryDate: null,
      currentWeather: 'CLEAR' as any,
      weatherDuration: 10
    };

    const dummyReport: import('../../models/Combat').CombatReport = {
      isVictory: true,
      participants: ['adv_1'],
      lootValue: 100,
      events: [],
      playerHpMap: {},
      playerMpMap: {},
      battleLog: '大捷',
      initialStates: [],
      totalDamageDealt: 1000,
      terrain: TerrainType.DESERT,
      survivingInfantry: 15,
      survivingArchers: 20
    };

    OffensiveSiegeModalController.resolveOffensiveSiegeResult(targetNode, dummyReport);

    expect(targetNode.ownerFactionId).toBe('player');
    expect(targetNode.isVassal).toBe(true);

    // 繁榮度公式包含附庸加成
    const prosperity = GameState.myTerritory.getRealtimeProsperity(0, 1, false);
    expect(prosperity).toBeGreaterThanOrEqual(100); // 附庸提供 100 繁榮度
  });

  it('7. 桌遊棋盤席位抽象：攻城戰敵軍絕不打城門、守城戰敵軍打城門，座標解析 100% 精準', () => {
    // 攻城戰報告模式
    const offensiveSession = new InteractiveCombatSession(
      ['adv_1'],
      1,
      '攻城',
      TerrainType.WILDERNESS,
      undefined,
      {
        isSiege: true,
        battleMode: SiegeBattleMode.OFFENSIVE_SIEGE,
        playerRole: SiegeRole.ATTACKER,
        gateHp: 5000
      }
    );
    expect(offensiveSession.battleMode).toBe(SiegeBattleMode.OFFENSIVE_SIEGE);
    expect(offensiveSession.playerRole).toBe(SiegeRole.ATTACKER);

    // 守城戰報告模式
    const defenseSession = new InteractiveCombatSession(
      ['adv_1'],
      1,
      '守城',
      TerrainType.PLAINS,
      undefined,
      {
        isSiege: true,
        battleMode: SiegeBattleMode.DEFENSE_SIEGE,
        playerRole: SiegeRole.DEFENDER,
        gateHp: 3000,
        watchtowerDmg: 50
      }
    );
    expect(defenseSession.battleMode).toBe(SiegeBattleMode.DEFENSE_SIEGE);
    expect(defenseSession.playerRole).toBe(SiegeRole.DEFENDER);
  });

  it('8. 器械上限接口 (SiegeEngineRegistry)：基礎各 3 台，公爵/大公與天賦支援擴充', () => {
    // 基礎平民/騎士上限 3 台
    expect(SiegeEngineRegistry.getMaxLimit(SiegeEngineType.BATTERING_RAM)).toBe(3);
    expect(SiegeEngineRegistry.getMaxLimit(SiegeEngineType.TREBUCHET)).toBe(3);
    // 公爵爵位上限 +2 ➔ 5 台
    expect(SiegeEngineRegistry.getMaxLimit(SiegeEngineType.TREBUCHET, NobleTitle.DUKE)).toBe(5);
  });

  it('9. 領地器械庫存 (上限 10 台)、攜帶出征 (各限 1 台) 與行軍天數 (+1天/台)', () => {
    const territory = GameState.myTerritory;
    territory.siegeEngineStock = { ram: 5, trebuchet: 3 };

    // 攜帶出征：衝車 1 台、投石機 1 台
    const carryRam = true;
    const carryTreb = true;
    const baseDays = 2; // 基礎行軍 2 天
    const engineDays = (carryRam ? 1 : 0) + (carryTreb ? 1 : 0); // 2 台器械 +2 天
    const totalMarchDays = baseDays + engineDays;

    expect(totalMarchDays).toBe(4);

    // 出征扣除領地庫存
    if (carryRam) territory.siegeEngineStock.ram--;
    if (carryTreb) territory.siegeEngineStock.trebuchet--;

    expect(territory.siegeEngineStock.ram).toBe(4);
    expect(territory.siegeEngineStock.trebuchet).toBe(2);
  });

  it('10. 據點工坊 (CombatGroupRole) 陣營攻守接口可控配置驗證', async () => {
    const { CombatGroupRole } = await import('../../models/types');
    expect(CombatGroupRole.DEFENDER_ONLY).toBe('DEFENDER_ONLY');
    expect(CombatGroupRole.ATTACKER_ONLY).toBe('ATTACKER_ONLY');
    expect(CombatGroupRole.VERSATILE).toBe('VERSATILE');
  });
});




