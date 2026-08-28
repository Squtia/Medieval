import { Territory } from '../models/Territory';
import { GameState } from '../core/GameState';
import { OfficeType, TerrainType, Gender, MonsterRace, ElementType, FormationRow, SiegeBattleMode, SiegeRole } from '../models/types';
import { CombatSystem } from './CombatSystem';
import { CombatUIManager } from '../ui/CombatUIManager';
import { InteractiveCombatSession } from './combat/InteractiveCombatSession';
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
    const territory = GameState.myTerritory;
    const pending = territory?.pendingRaids?.find(pr => pr.storyId === storyId);

    // 若已經出城迎擊過一次，且敵軍還在行軍路上 (warningDaysLeft > 0 且此處也是預警觸發)，不應重複彈出動員彈窗
    if (pending && pending.isFieldInterceptionAttempted && (pending.warningDaysLeft ?? 0) > 0 && (effect.warningDays ?? 0) > 0) {
      import('../ui/ToastManager').then(({ ToastManager }) => {
        ToastManager.show(`⚠️ 敵軍殘部正朝主城推進（尚餘 ${pending.warningDaysLeft} 天抵達），領地已處於臨戰戒備狀態！`);
      });
      return;
    }

    // 喚起守備動員部署彈窗
    import('../ui/modals/TerritoryDefenseModalController').then(({ TerritoryDefenseModalController }) => {
      TerritoryDefenseModalController.show(storyId, effect);
    });
  }

  /**
   * 建立多波次敵軍陣容 (支援繼承先前野戰留下的殘損敵軍陣容與敵方隨行軍團)
   */
  public static buildWaveEnemyLineups(
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>,
    survivingWaves?: import('../models/Narrative').SurvivingMonsterState[][]
  ): { waveEnemyLineups: import('../models/types').MonsterInstance[][]; enemyLegion?: { enabled?: boolean; infantry?: number; archer?: number; cavalry?: number } } {
    const waves = (effect.waves && effect.waves.length > 0)
      ? effect.waves
      : [{ waveIndex: 1, templateId: 'bandit_camp', customName: '敵方先鋒部隊' }];

    const monsterSys = new MonsterSystem();
    const monsterList = monstersJson as any[];
    const allTemplates = DataStore.getSubjugationTemplates();
    const waveEnemyLineups: import('../models/types').MonsterInstance[][] = [];
    let enemyLegion: { enabled?: boolean; infantry?: number; archer?: number; cavalry?: number } | undefined = undefined;

    // 若有繼承的殘存波次狀態且非空，優先 1:1 還原！
    if (survivingWaves && survivingWaves.length > 0) {
      survivingWaves.forEach((wStates) => {
        const waveMonsters: import('../models/types').MonsterInstance[] = [];
        wStates.forEach(s => {
          if (s.isDead || s.currentHp <= 0) return; // 已死亡的怪物不再登場！
          const baseDef = monsterList.find((item: any) => item.id === s.monsterId) || {
            id: s.monsterId,
            name: s.monsterId,
            baseDifficulty: 3,
            avatarIcon: `icons_monsters:${s.monsterId}`
          };
          const inst = monsterSys.createMonsterInstance(
            baseDef as any,
            (baseDef as any).appliedRaceTag || MonsterRace.MONSTER,
            s.element || ElementType.NONE,
            3
          );
          if (s.gridR !== undefined) inst.gridR = s.gridR;
          if (s.gridC !== undefined) inst.gridC = s.gridC;
          if (s.slotId) inst.slotId = s.slotId;
          inst.formationRow = s.gridR === 0 ? FormationRow.FRONT : (s.gridR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
          if (s.maxHp) inst.maxHp = s.maxHp;
          inst.hp = s.currentHp; // 殘留血量
          if (s.skills) inst.skills = s.skills;
          waveMonsters.push(inst);
        });
        if (waveMonsters.length > 0) {
          waveEnemyLineups.push(waveMonsters);
        }
      });
      return { waveEnemyLineups, enemyLegion };
    }

    // 否則依據 templateId 進行原始實例化
    waves.forEach(w => {
      const tpl = allTemplates.find(t => t.id === w.templateId);
      const diff = tpl?.difficulty || 3;
      if (tpl?.enemyLegion?.enabled) {
        enemyLegion = { ...tpl.enemyLegion };
      }

      if (tpl && tpl.waves && tpl.waves.length > 0) {
        tpl.waves.forEach(tw => {
          const waveMonsters: import('../models/types').MonsterInstance[] = [];
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

            if (m.gridR !== undefined) inst.gridR = m.gridR;
            if (m.gridC !== undefined) inst.gridC = m.gridC;
            if (m.slotId) inst.slotId = m.slotId;
            if (m.formationRow) {
              inst.formationRow = m.formationRow;
            } else if (m.gridR !== undefined) {
              inst.formationRow = m.gridR === 0 ? FormationRow.FRONT : (m.gridR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
            }
            if (m.powerTier) {
              inst.hp = Math.floor(inst.hp * m.powerTier);
              inst.damage = Math.floor(inst.damage * m.powerTier);
            }
            if (m.skills && m.skills.length > 0) {
              inst.skills = m.skills;
            }
            waveMonsters.push(inst);
          });
          if (waveMonsters.length > 0) {
            waveEnemyLineups.push(waveMonsters);
          }
        });
      } else {
        const monsters: import('../models/types').MonsterInstance[] = [];
        const banditBase = monsterList.find((item: any) => item.id === 'bandit') || { id: 'bandit', name: '攻城強盜', baseDifficulty: 2 };
        const leaderBase = monsterList.find((item: any) => item.id === 'bandit_leader') || { id: 'bandit_leader', name: '攻城頭領', baseDifficulty: 3 };
        monsters.push(monsterSys.createMonsterInstance(banditBase as any, MonsterRace.HUMAN, ElementType.NONE, 2));
        monsters.push(monsterSys.createMonsterInstance(leaderBase as any, MonsterRace.HUMAN, ElementType.NONE, 3));
        waveEnemyLineups.push(monsters);
      }
    });

    return { waveEnemyLineups, enemyLegion };
  }

  /**
   * 🏰 堅壁清野：保存待決圍城戰役狀態，進入領地臨戰戒備
   */
  public static postponeToSiege(
    storyId: string,
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>
  ): void {
    const territory = GameState.myTerritory;
    const warningDays = Number(effect.warningDays || 2);
    if (!territory.pendingRaids) territory.pendingRaids = [];

    const existingIdx = territory.pendingRaids.findIndex(pr => pr.storyId === storyId);
    const raidState: import('../models/Narrative').PendingRaidState = {
      id: `raid_${storyId}_${Date.now()}`,
      storyId,
      raidName: effect.raidName || '敵軍大軍圍城戰',
      isSiege: effect.isSiege !== false,
      warningDaysTotal: warningDays,
      warningDaysLeft: warningDays,
      effect
    };

    if (existingIdx >= 0) {
      territory.pendingRaids[existingIdx] = raidState;
    } else {
      territory.pendingRaids.push(raidState);
    }
  }

  /**
   * ⚔️ 親自出城攔截 (進入野戰舞台)
   */
  public static executeLiveFieldInterceptionWithSquads(
    storyId: string,
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>,
    squadConfigs: { formationId?: string; gridMap?: Record<string, string>; selectedIds: Set<string> }[],
    assignedTroops?: { infantry?: number; archer?: number; cavalry?: number }
  ): void {
    const territory = GameState.myTerritory;
    const pending = territory.pendingRaids?.find(pr => pr.storyId === storyId);
    const { waveEnemyLineups, enemyLegion } = this.buildWaveEnemyLineups(effect, pending?.survivingWaves);

    const primarySquad = squadConfigs[0] || { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() };
    let defenderIds = Array.from(primarySquad.selectedIds);
    if (defenderIds.length === 0 && GameState.adventurers.length > 0) {
      defenderIds = GameState.adventurers.slice(0, 5).map(a => a.id);
    }

    const infantryCount = assignedTroops?.infantry || 0;
    const archerCount = assignedTroops?.archer || 0;
    const cavalryCount = assignedTroops?.cavalry || 0;

    const troopAssignments: Record<string, { type: string; count: number }> = {};
    if (infantryCount > 0 && defenderIds.length > 0) {
      const perDefender = Math.max(1, Math.floor(infantryCount / defenderIds.length));
      defenderIds.forEach(id => {
        troopAssignments[id] = { type: 'INFANTRY', count: perDefender };
      });
    }

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

    const session = new InteractiveCombatSession(
      defenderIds,
      (effect.waves?.length || 1) * 3,
      effect.raidName || '野外大軍攔截戰',
      TerrainType.WILDERNESS,
      waveEnemyLineups,
      {
        isSiege: false,
        battleMode: SiegeBattleMode.NONE,
        playerRole: SiegeRole.ATTACKER,
        isFieldInterception: true,
        isLordCampaign: true,
        lordTitle: territory.title,
        assignedTroops: {
          infantry: infantryCount,
          archer: archerCount,
          cavalry: cavalryCount
        },
        gateHp: 0,
        cavalryCount: cavalryCount,
        infantryCount: infantryCount,
        reserveSquads: reserveSquads,
        enemyLegion: enemyLegion
      },
      primarySquad.formationId,
      primarySquad.gridMap
    );

    const currentDays = Number(pending?.warningDaysLeft ?? effect.warningDays ?? 2);
    const interceptBattleDays = Math.max(1, Math.floor(currentDays / 2));

    CombatUIManager.startInteractiveCombat(session, (report) => {
      report.isFieldInterception = true;
      this.settleFieldInterceptionResults(storyId, effect, report, {
        infantry: infantryCount,
        archer: archerCount,
        cavalry: cavalryCount
      }, false, interceptBattleDays);
    });
  }

  /**
   * 🛡️ 派遣軍團迎擊 (自動作戰模擬)
   */
  public static dispatchFieldInterception(
    storyId: string,
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>,
    squadConfigs: { formationId?: string; gridMap?: Record<string, string>; selectedIds: Set<string> }[],
    assignedTroops?: { infantry?: number; archer?: number; cavalry?: number }
  ): void {
    const territory = GameState.myTerritory;
    const pending = territory.pendingRaids?.find(pr => pr.storyId === storyId);
    const currentDays = Number(pending?.warningDaysLeft ?? effect.warningDays ?? 2);
    // 📐 雙方對進遭遇算法：在荒野中途交火 (floor(T/2))
    const battleDays = Math.max(1, Math.floor(currentDays / 2));
    const { waveEnemyLineups, enemyLegion } = this.buildWaveEnemyLineups(effect, pending?.survivingWaves);

    const primarySquad = squadConfigs[0] || { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() };
    let defenderIds = Array.from(primarySquad.selectedIds);
    if (defenderIds.length === 0 && GameState.adventurers.length > 0) {
      defenderIds = GameState.adventurers.slice(0, 5).map(a => a.id);
    }

    const infantryCount = assignedTroops?.infantry || 0;
    const archerCount = assignedTroops?.archer || 0;
    const cavalryCount = assignedTroops?.cavalry || 0;

    const troopAssignments: Record<string, { type: string; count: number }> = {};
    if (infantryCount > 0 && defenderIds.length > 0) {
      const perDefender = Math.max(1, Math.floor(infantryCount / defenderIds.length));
      defenderIds.forEach(id => {
        troopAssignments[id] = { type: 'INFANTRY', count: perDefender };
      });
    }

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

    const report = CombatSystem.simulateCombat(
      defenderIds,
      (effect.waves?.length || 1) * 3,
      effect.raidName || '野外大軍攔截戰 (派遣迎擊)',
      TerrainType.WILDERNESS,
      waveEnemyLineups.length || 1,
      troopAssignments,
      undefined,
      primarySquad.formationId,
      primarySquad.gridMap,
      undefined,
      waveEnemyLineups,
      {
        isSiege: false,
        isFieldInterception: true,
        isLordCampaign: false, // 委託派遣迎擊，無領主親征光環
        assignedTroops: {
          infantry: infantryCount,
          archer: archerCount,
          cavalry: cavalryCount
        },
        gateHp: 0,
        archerVolleyDmg: Math.floor(Math.sqrt(archerCount) * 35),
        cavalryCount: cavalryCount,
        infantryCount: infantryCount,
        reserveSquads: reserveSquads,
        enemyLegion: enemyLegion
      }
    );

    report.isFieldInterception = true;

    this.settleFieldInterceptionResults(storyId, effect, report, {
      infantry: infantryCount,
      archer: archerCount,
      cavalry: cavalryCount
    }, true, battleDays);
  }

  /**
   * 野外大軍攔截戰結算全鏈路 (戰勝保全主城，戰敗削弱敵軍並折減預警天數)
   */
  public static settleFieldInterceptionResults(
    storyId: string,
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>,
    report: import('../models/Combat').CombatReport,
    assignedTroops: { infantry: number; archer: number; cavalry: number },
    isAutoDispatch: boolean = false,
    battleDays: number = 1
  ): void {
    const territory = GameState.myTerritory;
    const pendingRaid = territory.pendingRaids?.find(pr => pr.storyId === storyId);
    const currentTotalWarningDays = Number(pendingRaid?.warningDaysLeft ?? effect.warningDays ?? 2);

    // 1. 計算兵種戰損 (野戰無城牆，步兵抵擋前線，弓兵 8%，騎兵 12%)
    let lostInfantry = 0;
    let lostArchers = 0;
    let lostCavalry = 0;

    const totalRemainingShield = Object.values(report.playerHpMap || {}).length > 0
      ? (report.events.filter(e => e.shieldRemaining !== undefined).slice(-1)[0]?.shieldRemaining || 0)
      : 0;
    const survivingInfantry = Math.min(assignedTroops.infantry, Math.floor(totalRemainingShield / 50));
    lostInfantry = Math.max(0, assignedTroops.infantry - survivingInfantry);

    const archerRate = report.isVictory ? 0.08 : 0.20;
    lostArchers = Math.min(assignedTroops.archer, Math.max(assignedTroops.archer > 0 ? 1 : 0, Math.round(assignedTroops.archer * archerRate)));

    const cavalryRate = report.isVictory ? 0.12 : 0.25;
    lostCavalry = Math.min(assignedTroops.cavalry, Math.max(assignedTroops.cavalry > 0 ? 1 : 0, Math.round(assignedTroops.cavalry * cavalryRate)));

    if (territory.workers) {
      if (lostInfantry > 0) territory.workers['INFANTRY'] = Math.max(0, (territory.workers['INFANTRY'] || 0) - lostInfantry);
      if (lostArchers > 0) territory.workers['ARCHER'] = Math.max(0, (territory.workers['ARCHER'] || 0) - lostArchers);
      if (lostCavalry > 0) territory.workers['CAVALRY'] = Math.max(0, (territory.workers['CAVALRY'] || 0) - lostCavalry);
    }

    const firstAdvId = report.participants?.[0];
    const leaderAdv = firstAdvId ? GameState.adventurers.find(a => a.id === firstAdvId) : null;
    const leaderName = leaderAdv?.name || '先鋒指揮官';
    const raidTitle = effect.raidName || '敵軍大軍';
    const combatRecordId = `combat_intercept_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    territory.addCombatRecord({
      id: combatRecordId,
      day: GameState.totalDays,
      nodeName: `🌲 野外迎擊 (${raidTitle})`,
      report: report
    });

    // 2. 戰略結果分歧
    if (report.isVictory) {
      // 🌟 大捷：主城 0 損失，成功解除圍城威脅！
      if (territory.pendingRaids) {
        territory.pendingRaids = territory.pendingRaids.filter(pr => pr.storyId !== storyId);
      }
      territory.security = Math.min(100, (territory.security ?? 100) + 8);
      territory.prestige += 20;

      // 探險日誌標準紀錄 (提供完整章節段落、戰鬥重播連結與獎勵)
      if (!territory.adventureLogs) territory.adventureLogs = [];
      territory.adventureLogs.unshift({
        id: `log_intercept_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        day: GameState.totalDays,
        squadLeaderName: leaderName,
        nodeName: `🌲 野外迎擊 (${raidTitle})`,
        segments: [
          {
            type: 'TEXT',
            content: `【出征集結】我方派遣以「${leaderName}」為首的精銳迎擊部隊，率領隨行軍團（步兵 ${assignedTroops.infantry} 人、弓兵 ${assignedTroops.archer} 人、騎兵 ${assignedTroops.cavalry} 人）緊急出城，於主城外圍攔截進逼中的「${raidTitle}」！`
          },
          {
            type: 'TEXT',
            content: `【戰況大捷】戰鬥中我方步兵盾陣固若金湯，弓兵箭雨與鐵騎突擊重創敵陣。迎擊小隊英勇作戰，成功在野外全殲敵軍先鋒部隊！領地主城毫髮無損，民心大振！（步兵戰損 ${lostInfantry} 人，弓兵戰損 ${lostArchers} 人，騎兵戰損 ${lostCavalry} 人，領地聲望 +20，治安 +8%）`
          },
          {
            type: 'COMBAT_LINK',
            content: combatRecordId
          }
        ],
        rewards: {
          gold: report.totalEarnedGold || 50,
          exp: report.totalEarnedExp || 40,
          prestige: 20,
          items: report.droppedEquipment || []
        }
      });

      if (!isAutoDispatch) {
        CombatUIManager.showSiegeDebrief({
          isVictory: true,
          isSiege: false,
          raidName: `🌲 野外攔截大捷 — ${effect.raidName || '敵軍大軍'}`,
          wallStatusText: '🛡️ 主城安然無恙 (未受任何波及)',
          gateRemaining: territory.getWallDurability(),
          gateMax: territory.getMaxWallDurability(),
          lostInfantry,
          lostArchers,
          lostCavalry,
          lostVillagers: 0,
          lostGold: 0,
          lostFood: 0,
          securityDelta: 8,
          mvpName: report.mvpName || '出征英雄隊伍',
          onClose: () => {
            if (effect.successNodeId) {
              NarrativeSystem.presentInteractiveNode(storyId, effect.successNodeId, true);
            }
          }
        });
      }
    } else {
      // ⚠️ 攔截失利：敵軍已被削弱，計算剩餘天數並繼承殘損敵軍陣容！
      const remainingDays = Math.max(1, currentTotalWarningDays - battleDays);
      if (!territory.pendingRaids) territory.pendingRaids = [];

      const existingIdx = territory.pendingRaids.findIndex(pr => pr.storyId === storyId);
      const raidState: import('../models/Narrative').PendingRaidState = {
        id: `raid_${storyId}_${Date.now()}`,
        storyId,
        raidName: effect.raidName || '敵軍大軍圍城戰',
        isSiege: effect.isSiege !== false,
        warningDaysTotal: effect.warningDays || currentTotalWarningDays,
        warningDaysLeft: remainingDays,
        effect,
        survivingWaves: report.survivingWaves,
        survivingEnemyLegion: report.survivingEnemyLegion,
        isFieldInterceptionAttempted: true
      };

      if (existingIdx >= 0) {
        territory.pendingRaids[existingIdx] = raidState;
      } else {
        territory.pendingRaids.push(raidState);
      }

      // 探險日誌標準紀錄 (失利阻擊戰況 + 戰鬥重播連結)
      if (!territory.adventureLogs) territory.adventureLogs = [];
      territory.adventureLogs.unshift({
        id: `log_intercept_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        day: GameState.totalDays,
        squadLeaderName: leaderName,
        nodeName: `🌲 野外迎擊 (${raidTitle})`,
        segments: [
          {
            type: 'TEXT',
            content: `【出征集結】我方派遣以「${leaderName}」為首的精銳迎擊部隊，率領隨行軍團（步兵 ${assignedTroops.infantry} 人、弓兵 ${assignedTroops.archer} 人、騎兵 ${assignedTroops.cavalry} 人）緊急出城，於主城外圍攔截進逼中的「${raidTitle}」！`
          },
          {
            type: 'TEXT',
            content: `【阻擊激戰】雙方在荒野展開激烈交鋒！我方迎擊小隊頑強抵抗並成功擊斃了敵方部分怪物，重創其先鋒陣容。但敵軍殘部依然強行突破，預計 ${remainingDays} 天後抵達主城！（步兵戰損 ${lostInfantry} 人，弓兵戰損 ${lostArchers} 人，騎兵戰損 ${lostCavalry} 人）`
          },
          {
            type: 'COMBAT_LINK',
            content: combatRecordId
          }
        ]
      });

      if (!isAutoDispatch) {
        CombatUIManager.showSiegeDebrief({
          isVictory: false,
          isSiege: false,
          raidName: `⚠️ 野外攔截阻擊戰 — ${effect.raidName || '敵軍大軍'}`,
          wallStatusText: `⚠️ 敵軍殘部已被重創削弱，預計 ${remainingDays} 天後抵達主城！`,
          gateRemaining: territory.getWallDurability(),
          gateMax: territory.getMaxWallDurability(),
          lostInfantry,
          lostArchers,
          lostCavalry,
          lostVillagers: 0,
          lostGold: 0,
          lostFood: 0,
          securityDelta: -5,
          mvpName: report.mvpName || '出征英雄隊伍',
          onClose: () => {
            // 確保動員部署彈窗徹底關閉，回歸大地圖臨戰戒備
            import('../ui/modals/TerritoryDefenseModalController').then(({ TerritoryDefenseModalController }) => {
              TerritoryDefenseModalController.close();
            });
          }
        });
      }
    }
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

    // 1. 構建多梯隊敵軍陣容 (若有先前野外攔截打殘的殘存波次，1:1 繼承載入！)
    const pending = territory.pendingRaids?.find(pr => pr.storyId === storyId);
    const { waveEnemyLineups, enemyLegion } = this.buildWaveEnemyLineups(effect, pending?.survivingWaves);

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

      gateHp = territory.getWallDurability();
      watchtowerDmg = this.calculateWatchtowerDamage(territory);
      archerVolleyDmg = Math.floor(Math.sqrt(archerCount) * 35);
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

    // 4. 啟動親征實時戰鬥會話 (傳入 primarySquad 的陣型與九宮格坐標 + 完整 siegeOptions)
    const session = new InteractiveCombatSession(
      defenderIds,
      (waveEnemyLineups.length || 1) * 3,
      effect.raidName || '領地圍城戰',
      TerrainType.PLAINS,
      waveEnemyLineups,
      {
        isSiege: isSiege,
        battleMode: isSiege ? SiegeBattleMode.DEFENSE_SIEGE : SiegeBattleMode.NONE,
        playerRole: isSiege ? SiegeRole.DEFENDER : SiegeRole.ATTACKER,
        isLordCampaign: true,
        lordTitle: territory.title,
        assignedTroops: {
          infantry: infantryCount,
          archer: archerCount,
          cavalry: cavalryCount
        },
        gateHp: gateHp,
        watchtowerDmg: watchtowerDmg,
        cavalryCount: cavalryCount,     // 騎兵數量供衝鋒用
        infantryCount: infantryCount,
        reserveSquads: reserveSquads,
        enemyLegion: enemyLegion
      },
      primarySquad.formationId,
      primarySquad.gridMap
    );

    // 5. 打開實時戰鬥畫面，戰後進行精準結算
    CombatUIManager.startInteractiveCombat(session, (report) => {
      report.isDefenseSiege = isSiege;
      report.gateMaxHp = isSiege ? territory.getMaxWallDurability() : 0;
      this.settleSiegeDefenseResults(storyId, effect, report, {
        infantry: infantryCount,
        archer: archerCount,
        cavalry: cavalryCount
      });
    });
  }

  /**
   * 戰後結算全鏈路：城牆耐久、民兵戰損、人口波及與戰報呈現
   */
  public static settleSiegeDefenseResults(
    storyId: string,
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>,
    report: import('../models/Combat').CombatReport,
    assignedTroops: { infantry: number; archer: number; cavalry: number }
  ): void {
    const territory = GameState.myTerritory;
    const isSiege = effect.isSiege !== false;
    const remainingGate = report.gateRemainingHp ?? 0;
    const isGateDestroyed = isSiege && remainingGate <= 0;

    // 1. 城牆耐久度與建築等級更新
    let wallStatusText = '安然無恙';
    if (isSiege) {
      if (isGateDestroyed || (!report.isVictory && remainingGate <= 0)) {
        // 城門徹底被攻破：降為 Lv.1 且耐久度為 0
        territory.defenseLevel = 1;
        territory.wallDurability = 0;
        wallStatusText = '💥 城牆徹底崩塌！建築降為 Lv.1 且耐久度為 0 (需重新修繕！)';
      } else {
        territory.wallDurability = Math.max(0, remainingGate);
        const maxDur = territory.getMaxWallDurability();
        wallStatusText = `🛡️ 剩餘耐久度 ${territory.wallDurability} / ${maxDur}`;
      }
    }

    // 2. 兵力戰損結算
    let lostInfantry = 0;
    let lostArchers = 0;
    let lostCavalry = 0;
    let lostVillagers = 0;

    if (isSiege) {
      // 步兵戰損：依剩餘護盾換算生還人數
      const totalRemainingShield = Object.values(report.playerHpMap || {}).length > 0
        ? (report.events.filter(e => e.shieldRemaining !== undefined).slice(-1)[0]?.shieldRemaining || 0)
        : 0;
      const survivingInfantry = Math.min(assignedTroops.infantry, Math.floor(totalRemainingShield / 50));
      lostInfantry = Math.max(0, assignedTroops.infantry - survivingInfantry);

      // 弓兵戰損：城門未破 5%~10%，城破 25%~35%
      const archerRate = isGateDestroyed || !report.isVictory ? 0.30 : 0.08;
      lostArchers = Math.min(assignedTroops.archer, Math.max(assignedTroops.archer > 0 ? 1 : 0, Math.round(assignedTroops.archer * archerRate)));

      // 騎兵戰損：城門未破 10%~15%，城破 30%~40%
      const cavalryRate = isGateDestroyed || !report.isVictory ? 0.35 : 0.12;
      lostCavalry = Math.min(assignedTroops.cavalry, Math.max(assignedTroops.cavalry > 0 ? 1 : 0, Math.round(assignedTroops.cavalry * cavalryRate)));

      // 扣除兵力工人
      if (territory.workers) {
        if (lostInfantry > 0) territory.workers['INFANTRY'] = Math.max(0, (territory.workers['INFANTRY'] || 0) - lostInfantry);
        if (lostArchers > 0) territory.workers['ARCHER'] = Math.max(0, (territory.workers['ARCHER'] || 0) - lostArchers);
        if (lostCavalry > 0) territory.workers['CAVALRY'] = Math.max(0, (territory.workers['CAVALRY'] || 0) - lostCavalry);
      }
    } else {
      // 遭遇戰市街波及人口
      if (report.isVictory) {
        lostVillagers = Math.min(3, Math.max(1, Math.floor(report.events.length * 0.03)));
      } else {
        lostVillagers = Math.max(2, Math.floor(territory.population * 0.15));
      }
      this.reducePopulationRandomly(territory, lostVillagers);
    }

    // 3. 資源與治安結算
    let lostGold = 0;
    let lostFood = 0;
    if (report.isVictory) {
      territory.security = Math.min(100, (territory.security ?? 100) + 5);
    } else {
      lostGold = Math.floor(territory.gold * 0.2);
      lostFood = Math.floor(territory.food * 0.2);
      territory.gold = Math.max(0, territory.gold - lostGold);
      territory.food = Math.max(0, territory.food - lostFood);
      territory.security = Math.max(0, (territory.security ?? 100) - 20);
    }

    // 4. 清理已結算的待決戰役
    if (territory.pendingRaids) {
      territory.pendingRaids = territory.pendingRaids.filter(pr => pr.storyId !== storyId);
    }

    // 5. 喚起專屬防衛戰報 Debrief 彈窗
    CombatUIManager.showSiegeDebrief({
      isVictory: report.isVictory,
      isSiege: isSiege,
      raidName: effect.raidName || '領地防衛戰',
      wallStatusText: wallStatusText,
      gateRemaining: remainingGate,
      gateMax: isSiege ? territory.getMaxWallDurability() : 0,
      lostInfantry,
      lostArchers,
      lostCavalry,
      lostVillagers,
      lostGold,
      lostFood,
      securityDelta: report.isVictory ? 5 : -20,
      mvpName: report.mvpName || '全體守衛',
      onClose: () => {
        if (report.isVictory && effect.successNodeId) {
          NarrativeSystem.presentInteractiveNode(storyId, effect.successNodeId, true);
        } else if (!report.isVictory && effect.failNodeId) {
          NarrativeSystem.presentInteractiveNode(storyId, effect.failNodeId, true);
        }
      }
    });
  }

  /**
   * 放棄抵抗直接結算掠奪損失
   */
  public static applyDefeatLosses(
    storyId: string,
    effect: Extract<import('../models/Narrative').NarrativeEffect, { type: 'TRIGGER_RAID' }>
  ): void {
    const territory = GameState.myTerritory;
    const isSiege = effect.isSiege !== false;

    if (isSiege) {
      territory.defenseLevel = 1;
      territory.wallDurability = 0;
    }

    const lostGold = Math.floor(territory.gold * 0.25);
    const lostFood = Math.floor(territory.food * 0.25);
    territory.gold = Math.max(0, territory.gold - lostGold);
    territory.food = Math.max(0, territory.food - lostFood);
    territory.security = Math.max(0, (territory.security ?? 100) - 25);
    this.reducePopulationRandomly(territory, 2);

    if (effect.failNodeId) {
      NarrativeSystem.presentInteractiveNode(storyId, effect.failNodeId, true);
    }
  }
}
