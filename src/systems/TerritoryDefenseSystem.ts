import { Territory } from '../models/Territory';
import { GameState } from '../core/GameState';
import { OfficeType, TerrainType, Gender, MonsterRace, ElementType } from '../models/types';
import { CombatSystem } from './CombatSystem';
import { CombatUIManager } from '../ui/CombatUIManager';
import { DataStore } from './DataStore';
import { Adventurer } from '../models/Adventurer';
import { NarrativeSystem } from './NarrativeSystem';
import { MonsterSystem } from './MonsterSystem';
import monstersJson from '../data/monsters.json';

export interface RaidResult {
  raidName: string;
  threatPower: number;
  defenseRating: number;
  isSuccess: boolean;
  lostPopulation: number;
  lostGold: number;
  lostFood: number;
  damagedBuilding?: string;
  securityDelta: number;
  summary: string;
}

export class TerritoryDefenseSystem {
  /**
   * 計算領地當前客觀量化防衛力 (Defense Rating)
   * 公式：(哨所等級 * 40) + ⌊治安 * 0.6⌋ + 官職防衛加成 (隊長+50, 方旗騎士+40, 扈從+20)
   */
  public static calculateTerritoryDefense(territory: Territory): number {
    const defenseLevelBonus = (territory.defenseLevel || 0) * 40;
    const securityBonus = Math.floor((territory.security ?? 100) * 0.6);

    let officeBonus = 0;
    if (GameState.adventurers) {
      for (const adv of GameState.adventurers) {
        if (!adv.office) continue;
        if (adv.office === OfficeType.CAPTAIN) officeBonus += 50;
        if (adv.office === OfficeType.BANNERET) officeBonus += 40;
        if (adv.office === OfficeType.RETAINER) officeBonus += 20;
      }
    }

    return defenseLevelBonus + securityBonus + officeBonus;
  }

  /**
   * 計算守城戰城門/城牆防禦工事基礎 HP (Gate HP)
   * 依照城牆等級階梯配置：
   * LV0: 0, LV1: 1000, LV2: 2500, LV3: 5000, LV4: 7000, LV5: 9000
   */
  public static calculateSiegeGateHp(territory: Territory): number {
    const defenseLevel = territory.defenseLevel || 0;
    const hpTable: Record<number, number> = {
      0: 0,
      1: 1000,
      2: 2500,
      3: 5000,
      4: 7000,
      5: 9000
    };
    return hpTable[defenseLevel] ?? (9000 + (defenseLevel - 5) * 2000);
  }

  /**
   * 計算守城戰城牆箭塔每回合火力支援傷害
   * 公式：(哨所等級 * 25) + 官職隊長加成(30)
   */
  public static calculateWatchtowerDamage(territory: Territory): number {
    const defenseLevel = territory.defenseLevel || 0;
    if (defenseLevel <= 0) return 0;
    let captainBonus = 0;
    if (GameState.adventurers) {
      if (GameState.adventurers.some(a => a.office === OfficeType.CAPTAIN)) {
        captainBonus = 30;
      }
    }
    return (defenseLevel * 25) + captainBonus;
  }

  /**
   * 計算步兵提供的軍團護盾值
   * 1 名步兵 = 50 點軍團護盾 (免暴擊)
   */
  public static calculateLegionShield(infantryCount: number): number {
    return Math.max(0, (infantryCount || 0) * 50);
  }

  /**
   * 戰後根據剩餘護盾計算生還步兵數
   */
  public static calculateSurvivingInfantry(remainingShield: number): number {
    return Math.max(0, Math.floor((remainingShield || 0) / 50));
  }

  /**
   * 執行襲擊對抗判定
   */
  public static resolveRaid(territory: Territory, threatPower: number, raidName: string = '未知襲擊者'): RaidResult {
    const defenseRating = this.calculateTerritoryDefense(territory);
    const isSuccess = defenseRating >= threatPower;

    if (isSuccess) {
      // 防禦完全成功
      territory.security = Math.min(100, (territory.security ?? 100) + 3);
      return {
        raidName,
        threatPower,
        defenseRating,
        isSuccess: true,
        lostPopulation: 0,
        lostGold: 0,
        lostFood: 0,
        securityDelta: 3,
        summary: `🛡️【防守大捷】領地城防部隊成功擊潰了「${raidName}」（威脅值 ${threatPower} vs 領地防衛力 ${defenseRating}），領地安然無恙，治安提升！`
      };
    }

    // 防衛失守：依照防衛缺口計算損失
    const gap = threatPower - defenseRating;
    const lossRatio = Math.min(0.45, Math.max(0.1, gap / threatPower));

    // 1. 人口損失（隨機扣除）
    const totalPop = territory.population;
    const lostPop = Math.min(totalPop, Math.max(1, Math.round(totalPop * lossRatio * 0.4)));
    if (lostPop > 0) {
      this.reducePopulationRandomly(territory, lostPop);
    }

    // 2. 資源掠奪
    const lostGold = Math.min(territory.gold, Math.round(territory.gold * lossRatio));
    const lostFood = Math.min(territory.food, Math.round(territory.food * lossRatio));
    territory.gold = Math.max(0, territory.gold - lostGold);
    territory.food = Math.max(0, territory.food - lostFood);

    // 3. 治安大幅下降
    const securityLoss = Math.min(territory.security, Math.round(15 + lossRatio * 30));
    territory.security = Math.max(0, territory.security - securityLoss);

    // 4. 建築受損降級（防衛缺口嚴重時機率發生）
    let damagedBuilding: string | undefined = undefined;
    if (lossRatio >= 0.25 && territory.defenseLevel > 0 && Math.random() < 0.4) {
      territory.defenseLevel = Math.max(0, territory.defenseLevel - 1);
      damagedBuilding = '哨所/城防設施 (降低 1 級)';
    }

    return {
      raidName,
      threatPower,
      defenseRating,
      isSuccess: false,
      lostPopulation: lostPop,
      lostGold,
      lostFood,
      damagedBuilding,
      securityDelta: -securityLoss,
      summary: `🔥【防禦失守】「${raidName}」突破了領地防線（威脅值 ${threatPower} vs 領地防衛力 ${defenseRating}）！損失領民 ${lostPop} 人、掠奪金幣 ${lostGold}、糧食 ${lostFood}，治安下降 ${securityLoss} 點${damagedBuilding ? `，${damagedBuilding}` : ''}。請至書房重新檢視防衛與人口指派！`
    };
  }

  /**
   * 隨機從領地各工作崗位中扣除人口
   */
  public static reducePopulationRandomly(territory: Territory, countToReduce: number): void {
    if (!territory.workers) return;
    let remaining = countToReduce;

    const availableJobs = Object.keys(territory.workers).filter(job => (territory.workers[job] || 0) > 0);
    while (remaining > 0 && availableJobs.length > 0) {
      const randomJob = availableJobs[Math.floor(Math.random() * availableJobs.length)];
      if ((territory.workers[randomJob] || 0) > 0) {
        territory.workers[randomJob]--;
        remaining--;
        if (territory.workers[randomJob] <= 0) {
          const idx = availableJobs.indexOf(randomJob);
          if (idx >= 0) availableJobs.splice(idx, 1);
        }
      } else {
        const idx = availableJobs.indexOf(randomJob);
        if (idx >= 0) availableJobs.splice(idx, 1);
      }
    }
  }

  /**
   * 啟動守城戰鬥流程 (Live Siege Combat)
   * 先喚起領地守備動員彈窗，讓領主編排守軍梯隊與配置兵種，確認後才進入戰鬥
   */
  public static startLiveSiegeDefense(
    storyId: string,
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>
  ): void {
    // 喚起守備動員部署彈窗
    import('../ui/modals/TerritoryDefenseModalController').then(({ TerritoryDefenseModalController }) => {
      TerritoryDefenseModalController.show(storyId, effect);
    });
  }

  /**
   * 執行守城戰鬥運算與播放戰鬥畫面 (支援九宮格與陣型光環)
   */
  public static executeLiveSiegeDefenseWithSquads(
    storyId: string,
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>,
    squadConfigs: { formationId?: string; gridMap?: Record<string, string>; selectedIds: Set<string> }[],
    assignedTroops?: { infantry?: number; archer?: number; cavalry?: number }
  ): void {
    const territory = GameState.myTerritory;
    const isSiege = effect.isSiege !== false; // 預設為 true (正規攻城戰)

    // 1. 構建多梯隊敵軍陣容 (WaveEnemyLineups)
    const waves = (effect.waves && effect.waves.length > 0)
      ? effect.waves
      : [{ waveIndex: 1, templateId: 'bandit_camp', customName: '敵方先鋒部隊' }];

    const monsterSys = new MonsterSystem();
    const monsterList = monstersJson as any[];
    const allTemplates = DataStore.getSubjugationTemplates();
    const waveEnemyLineups: import('../models/types').MonsterInstance[][] = [];

    waves.forEach(w => {
      const tpl = allTemplates.find(t => t.id === w.templateId);
      const monsters: import('../models/types').MonsterInstance[] = [];
      const diff = tpl?.difficulty || 3;

      if (tpl && tpl.waves && tpl.waves.length > 0) {
        tpl.waves.forEach(tw => {
          (tw.monsters || []).forEach(m => {
            const baseDef = monsterList.find((item: any) => item.id === m.monsterId) || {
              id: m.monsterId,
              name: m.monsterId,
              baseDifficulty: diff,
              avatarIcon: `icons_monsters:${m.monsterId}`
            };
            const inst = monsterSys.createMonsterInstance(
              baseDef as any,
              (baseDef as any).appliedRaceTag || MonsterRace.MONSTER,
              m.element || ElementType.NONE,
              diff
            );
            if (m.formationRow) inst.formationRow = m.formationRow;
            monsters.push(inst);
          });
        });
      } else {
        const banditBase = monsterList.find((item: any) => item.id === 'bandit') || { id: 'bandit', name: '攻城強盜', baseDifficulty: 2 };
        const leaderBase = monsterList.find((item: any) => item.id === 'bandit_leader') || { id: 'bandit_leader', name: '攻城頭領', baseDifficulty: 3 };
        monsters.push(monsterSys.createMonsterInstance(banditBase as any, MonsterRace.HUMAN, ElementType.NONE, 2));
        monsters.push(monsterSys.createMonsterInstance(leaderBase as any, MonsterRace.HUMAN, ElementType.NONE, 3));
      }
      waveEnemyLineups.push(monsters);
    });

    // 2. 提取我方守軍陣容與九宮格
    const primarySquad = squadConfigs[0] || { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() };
    let defenderIds = Array.from(primarySquad.selectedIds);
    if (defenderIds.length === 0) {
      if (GameState.adventurers && GameState.adventurers.length > 0) {
        defenderIds = GameState.adventurers.slice(0, 5).map(a => a.id);
      } else {
        const guard = new Adventurer('adv_temp_guard', '領地城防守衛', DataStore.getRandomJob(), DataStore.getRandomRecruitTrait(), 'R', Gender.MALE, false);
        guard.level = 3;
        GameState.adventurers = [guard];
        defenderIds = [guard.id];
      }
    }

    // 3. 兵種軍團調派與護盾計算 (非攻城戰則無軍事支援)
    let infantryCount = 0;
    let archerCount = 0;
    let cavalryCount = 0;
    let gateHp = 0;
    let watchtowerDmg = 0;
    let archerVolleyDmg = 0;
    const troopAssignments: Record<string, { type: string; count: number }> = {};

    if (isSiege) {
      infantryCount = assignedTroops?.infantry !== undefined
        ? assignedTroops.infantry
        : (territory.workers?.['INFANTRY'] || 0);
      archerCount = assignedTroops?.archer !== undefined
        ? assignedTroops.archer
        : (territory.workers?.['ARCHER'] || 0);
      cavalryCount = assignedTroops?.cavalry !== undefined
        ? assignedTroops.cavalry
        : (territory.workers?.['CAVALRY'] || 0);

      // 步兵護盾平均分配給第一梯隊出戰守軍
      if (infantryCount > 0 && defenderIds.length > 0) {
        const perDefender = Math.max(1, Math.floor(infantryCount / defenderIds.length));
        defenderIds.forEach(id => {
          troopAssignments[id] = { type: 'INFANTRY', count: perDefender };
        });
      }

      gateHp = this.calculateSiegeGateHp(territory);
      watchtowerDmg = this.calculateWatchtowerDamage(territory);
      archerVolleyDmg = Math.floor(archerCount * 3);
    }

    // 預備梯隊 (梯隊 2 與 梯隊 3 接力增援)
    const reserveSquads: { defenderIds: string[]; formationId?: string; gridMap?: Record<string, string> }[] = [];
    for (let i = 1; i < squadConfigs.length; i++) {
      const sq = squadConfigs[i];
      if (sq && sq.selectedIds.size > 0) {
        reserveSquads.push({
          defenderIds: Array.from(sq.selectedIds),
          formationId: sq.formationId,
          gridMap: sq.gridMap
        });
      }
    }

    // 4. 執行戰鬥運算 (傳入 primarySquad 的陣型與九宮格坐標 + 完整 siegeOptions)
    const report = CombatSystem.simulateCombat(
      defenderIds,
      waves.length * 3,
      effect.raidName || '領地圍城戰',
      TerrainType.PLAINS,
      waves.length,
      troopAssignments,
      undefined,
      primarySquad.formationId,
      primarySquad.gridMap,
      undefined,
      waveEnemyLineups,
      {
        isSiege: true,
        gateHp: gateHp,
        watchtowerDmg: watchtowerDmg,
        archerVolleyDmg: archerVolleyDmg,
        cavalryCount: cavalryCount,     // 騎兵數量供衝鋒用
        reserveSquads: reserveSquads
      }
    );

    // 標記為守城戰鏡像模式
    report.isDefenseSiege = true;
    report.gateMaxHp = gateHp;

    // 5. 打開戰鬥畫面並播放
    CombatUIManager.replayCombat(report, () => {
      if (report.isVictory) {
        territory.security = Math.min(100, (territory.security ?? 100) + 5);
        if (effect.successNodeId) {
          NarrativeSystem.presentInteractiveNode(storyId, effect.successNodeId, true);
        }
      } else {
        this.applyDefeatLosses(storyId, effect);
      }
    });
  }

  /**
   * 城破戰損結算
   */
  public static applyDefeatLosses(
    storyId: string,
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>
  ): void {
    const territory = GameState.myTerritory;
    const lostGold = Math.floor(territory.gold * 0.2);
    const lostFood = Math.floor(territory.food * 0.2);
    territory.gold = Math.max(0, territory.gold - lostGold);
    territory.food = Math.max(0, territory.food - lostFood);
    territory.security = Math.max(0, (territory.security ?? 100) - 20);
    this.reducePopulationRandomly(territory, 1);

    if (effect.failNodeId) {
      NarrativeSystem.presentInteractiveNode(storyId, effect.failNodeId, true);
    }
  }
}
