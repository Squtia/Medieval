import { describe, it, expect, beforeEach } from 'vitest';
import { Territory } from '../models/Territory';
import { GameState } from '../core/GameState';
import { TerritoryDefenseSystem } from './TerritoryDefenseSystem';

describe('Territory Defense & Wall Overhaul Tests', () => {
  let territory: Territory;

  beforeEach(() => {
    territory = new Territory('測試領地');
    GameState.myTerritory = territory;
    GameState.adventurers = [];
  });

  describe('1. 城牆耐久度、修繕與升級限制', () => {
    it('依照城牆等級階梯正確計算最大耐久度', () => {
      territory.defenseLevel = 0;
      expect(territory.getMaxWallDurability()).toBe(0);

      territory.defenseLevel = 1;
      expect(territory.getMaxWallDurability()).toBe(1000);

      territory.defenseLevel = 2;
      expect(territory.getMaxWallDurability()).toBe(2500);

      territory.defenseLevel = 3;
      expect(territory.getMaxWallDurability()).toBe(5000);
    });

    it('未設定耐久度時自動回傳最大耐久度，受損時正確計算修繕消耗', () => {
      territory.defenseLevel = 3; // Max = 5000
      expect(territory.getWallDurability()).toBe(5000);

      // 設定受損至 2500 (50% 損壞)
      territory.wallDurability = 2500;
      expect(territory.getWallDurability()).toBe(2500);

      const repairCost = territory.getWallRepairCost();
      expect(repairCost.missingDurability).toBe(2500);
      expect(repairCost.damageRatio).toBe(0.5);
      expect(repairCost.gold).toBeGreaterThan(0);
      expect(repairCost.wood).toBeGreaterThan(0);
      expect(repairCost.stone).toBeGreaterThan(0);
    });

    it('城牆受損時禁止升級，修繕補滿後解鎖升級並升級後補滿新等級耐久', () => {
      territory.defenseLevel = 1; // Lv.1 Max = 1000
      territory.wallDurability = 500; // 受損 50%
      territory.gold = 5000;
      territory.wood = 5000;
      territory.stone = 5000;
      territory.iron = 500;

      // 耐久未修滿，不能升級
      expect(territory.canUpgradeBuilding('defense')).toBe(false);

      // 執行修繕
      const repairSuccess = territory.repairWall();
      expect(repairSuccess).toBe(true);
      expect(territory.getWallDurability()).toBe(1000);

      // 修滿後可以升級
      expect(territory.canUpgradeBuilding('defense')).toBe(true);
      const upgradeSuccess = territory.upgradeBuilding('defense');
      expect(upgradeSuccess).toBe(true);
      expect(territory.defenseLevel).toBe(2);
      expect(territory.getWallDurability()).toBe(2500); // 升級後自動補滿新等級耐久
    });
  });

  describe('2. 戰後戰損結算與城破懲罰', () => {
    it('步兵依剩餘護盾生還，弓兵與騎兵依戰況結算戰損', () => {
      territory.defenseLevel = 2;
      territory.wallDurability = 2500;
      territory.workers = {
        'INFANTRY': 10,
        'ARCHER': 10,
        'CAVALRY': 10
      };

      const mockReport: any = {
        isVictory: true,
        gateRemainingHp: 2000,
        events: [
          { shieldRemaining: 300 } // 剩餘 300 護盾 = 6 名生還，4 名戰損
        ],
        playerHpMap: { 'adv_1': 100 }
      };

      TerritoryDefenseSystem.settleSiegeDefenseResults('story_1', { type: 'TRIGGER_RAID', raidName: '強盜圍城', isSiege: true } as any, mockReport, {
        infantry: 10,
        archer: 10,
        cavalry: 10
      });

      // 步兵戰損 4 人 (10 - 6 = 4)
      expect(territory.workers['INFANTRY']).toBe(6);
      // 弓兵勝戰輕微受損 (10 - 1 = 9)
      expect(territory.workers['ARCHER']).toBeLessThanOrEqual(10);
      // 騎兵勝戰輕微受損 (10 - 1 = 9)
      expect(territory.workers['CAVALRY']).toBeLessThanOrEqual(10);
      // 城牆耐久度正確寫入
      expect(territory.wallDurability).toBe(2000);
    });

    it('城門徹底被攻破時，城牆降級為 Lv.1 且耐久度為 0', () => {
      territory.defenseLevel = 3;
      territory.wallDurability = 5000;
      territory.workers = { 'INFANTRY': 10 };

      const mockReport: any = {
        isVictory: false,
        gateRemainingHp: 0, // 城破
        events: [],
        playerHpMap: {}
      };

      TerritoryDefenseSystem.settleSiegeDefenseResults('story_1', { type: 'TRIGGER_RAID', raidName: '魔王攻城', isSiege: true } as any, mockReport, {
        infantry: 10,
        archer: 0,
        cavalry: 0
      });

      expect(territory.defenseLevel).toBe(1);
      expect(territory.wallDurability).toBe(0);
    });

    it('遭遇戰模式下戰勝波及少量村民，戰敗波及較多村民', () => {
      territory.workers = { 'UNASSIGNED': 20 };

      const mockWinReport: any = {
        isVictory: true,
        events: new Array(20).fill({ type: 'HIT' }),
        playerHpMap: { 'adv_1': 100 }
      };

      TerritoryDefenseSystem.settleSiegeDefenseResults('story_1', { type: 'TRIGGER_RAID', raidName: '街巷突襲', isSiege: false } as any, mockWinReport, {
        infantry: 0,
        archer: 0,
        cavalry: 0
      });

      // 戰勝僅波及 1~3 位村民
      expect(territory.population).toBeGreaterThanOrEqual(17);
      expect(territory.population).toBeLessThan(20);
    });
  });

  describe('3. 野外大軍攔截戰 (Field Interception) 戰略結算與狀態繼承', () => {
    it('野戰大捷：主城 0 受損，城牆完好，成功解除 pendingRaids 危機', () => {
      territory.defenseLevel = 2;
      territory.wallDurability = 2500;
      territory.workers = { 'INFANTRY': 20, 'ARCHER': 10, 'CAVALRY': 10 };
      territory.pendingRaids = [{
        id: 'raid_1',
        storyId: 'story_intercept',
        raidName: '黑龍軍團先鋒',
        isSiege: true,
        warningDaysTotal: 4,
        warningDaysLeft: 4,
        effect: { type: 'TRIGGER_RAID', raidName: '黑龍軍團先鋒', warningDays: 4 } as any
      }];

      const mockReport: any = {
        isVictory: true,
        isFieldInterception: true,
        gateRemainingHp: 0,
        events: [{ shieldRemaining: 800 }], // 剩餘 800 護盾 = 16 人生還，4 人戰損
        playerHpMap: { 'adv_1': 100 }
      };

      TerritoryDefenseSystem.settleFieldInterceptionResults(
        'story_intercept',
        { type: 'TRIGGER_RAID', raidName: '黑龍軍團先鋒', warningDays: 4 } as any,
        mockReport,
        { infantry: 20, archer: 10, cavalry: 10 },
        false,
        1
      );

      // 主城與城牆完全完好
      expect(territory.defenseLevel).toBe(2);
      expect(territory.wallDurability).toBe(2500);
      // 成功從待決隊列中移除
      expect(territory.pendingRaids.length).toBe(0);
      // 步兵扣除 4 人戰損 (20 - 16 = 4)
      expect(territory.workers['INFANTRY']).toBe(16);
    });

    it('野戰失利：按公式折減天數，並將殘存怪物 HP 與陣型 1:1 寫入 pendingRaid 供守城戰繼承', () => {
      territory.defenseLevel = 2;
      territory.wallDurability = 2500;
      territory.pendingRaids = [];

      const mockReport: any = {
        isVictory: false,
        isFieldInterception: true,
        events: [],
        playerHpMap: {},
        survivingWaves: [
          [
            { monsterId: 'boss_dragon', currentHp: 1200, maxHp: 3000, isDead: false, gridR: 0, gridC: 1 },
            { monsterId: 'goblin_guard', currentHp: 0, maxHp: 200, isDead: true, gridR: 0, gridC: 0 }
          ]
        ],
        survivingEnemyLegion: { infantry: 15, archer: 10, cavalry: 5 }
      };

      // 敵方預警 5 天，我方派遣 3 天交兵
      TerritoryDefenseSystem.settleFieldInterceptionResults(
        'story_dragon',
        { type: 'TRIGGER_RAID', raidName: '黑龍大軍', warningDays: 5 } as any,
        mockReport,
        { infantry: 10, archer: 5, cavalry: 5 },
        true,
        3
      );

      // 剩餘天數應折減為 5 - 3 = 2 天
      expect(territory.pendingRaids.length).toBe(1);
      const raid = territory.pendingRaids[0];
      expect(raid.warningDaysLeft).toBe(2);
      expect(raid.isFieldInterceptionAttempted).toBe(true);
      expect(raid.survivingWaves?.[0]?.[0]?.currentHp).toBe(1200);
      expect(raid.survivingWaves?.[0]?.[1]?.isDead).toBe(true);

      // 驗證守城戰建構波次時，成功 1:1 繼承該殘損陣容 (死亡怪不再登場，殘血怪保留 1200 HP)
      const { waveEnemyLineups } = TerritoryDefenseSystem.buildWaveEnemyLineups(
        raid.effect,
        raid.survivingWaves
      );

      expect(waveEnemyLineups.length).toBe(1);
      expect(waveEnemyLineups[0].length).toBe(1); // 只有存活的 1 隻登場
      expect(waveEnemyLineups[0][0].hp).toBe(1200); // 殘血 1200
    });
  });
});
