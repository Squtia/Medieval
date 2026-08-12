import { GameState } from '../core/GameState';
import { Random } from '../core/Random';
import { Adventurer } from '../models/Adventurer';
import { AdventureLogEntry, AdventureLogSegment, SegmentType, AdventureLogRewards } from '../models/AdventureLog';
import { EXPLORATION_EVENTS, getRandomNarrativePool } from '../data/NarrativeData';
import { CombatSystem } from './CombatSystem';
import { EnemyFeature, SubjugationMode, TaskType } from '../models/DispatchTask';
import { MapNode, NodeLevel } from '../models/types';
import { getDifficultyModifiers, getCombatPrestigeReward } from '../data/BalanceData';
import { monsterSystem } from './MonsterSystem';
import { EventBus } from '../core/EventBus';
import { EquipmentGenerator } from './EquipmentGenerator';
import { GameEventType } from '../core/GameEvents';

export class ExplorationNarrativeEngine {
  
  /**
   * 討伐敘事引擎入口
   * 專門處理節點討伐的敘事化日誌生成與底層戰鬥結算
   */
  public static generateSubjugationLog(adventurers: Adventurer[], node: MapNode, baseDiff: number, enemyFeature: EnemyFeature, formationId?: string, gridMap?: Record<string, string>): boolean {
    const territory = GameState.myTerritory;
    const segments: AdventureLogSegment[] = [];
    
    if (adventurers.length === 0) return false;
    const leader = adventurers[0];

    // 1. 出發描述
    const startTexts = [
      `以 ${leader.name} 為首的隊伍奉命前往討伐 ${node.name}...`,
      `${leader.name} 帶領著小隊，朝著 ${node.name} 的方向前進，準備展開討伐。`,
      `討伐 ${node.name} 的命令下達，${leader.name} 與隊員們全副武裝踏上了旅途。`,
    ];
    segments.push({ type: 'TEXT', content: Random.pick(startTexts) });

    let currentHpOverrides: Record<string, number> = {};
    let currentMpOverrides: Record<string, number> = {};
    
    const maxSteps = Random.int(2, 3);
    let overallVictory = true;
    
    let totalGold = 0;
    let totalExp = 0;
    let totalPrestige = 0;
    let totalItems: string[] = [];

    // 2. 順序探索流 (節點推進)
    for (let step = 1; step <= maxSteps; step++) {
      // 30% 事件, 70% 戰鬥 (最後一步必定是戰鬥)
      const isEvent = (step < maxSteps) && (Random.next() < 0.3);
      
      if (isEvent && EXPLORATION_EVENTS.length > 0) {
        const event = Random.pick(EXPLORATION_EVENTS);
        segments.push({ type: 'TEXT', content: event.introText });

        let matchedBranch = event.branches.find(b => 
          b.targetTraits.some(t => leader.trait?.id === t)
        );
        
        if (!matchedBranch) {
          matchedBranch = event.defaultBranch;
        }

        segments.push({ type: 'TEXT', content: matchedBranch.narrativeText });
        matchedBranch.onResolve();
      } else {
        if (step === 1 && !isEvent) {
          const encounterTexts = [
            `剛進入目標區域，隊伍就遭到敵人的伏擊！`,
            `路途不平靜，一隊魔物擋住了去路！`
          ];
          segments.push({ type: 'TEXT', content: Random.pick(encounterTexts) });
        } else if (step === maxSteps) {
          segments.push({ type: 'TEXT', content: `隊伍終於抵達了核心區域，與駐紮在此的主力部隊發生了激戰！` });
        } else {
          segments.push({ type: 'TEXT', content: `繼續推進時，又遭遇了另一波敵軍的阻撓。` });
        }

        const combatResult = this.runCombat(adventurers, node, baseDiff, enemyFeature, 1, currentHpOverrides, currentMpOverrides, formationId, gridMap);
        
        if (combatResult && combatResult.combatId) {
          segments.push({ type: 'COMBAT_LINK', content: combatResult.combatId });
          
          if (combatResult.rewards) {
             totalGold += combatResult.rewards.gold;
             totalExp += combatResult.rewards.exp;
             totalPrestige += combatResult.rewards.prestige;
             if (combatResult.rewards.items) {
               totalItems.push(...combatResult.rewards.items);
             }
          }
          
          if (combatResult.playerHpMap) currentHpOverrides = combatResult.playerHpMap;
          if (combatResult.playerMpMap) currentMpOverrides = combatResult.playerMpMap;
          
          if (!combatResult.isVictory) {
             overallVictory = false;
             segments.push({ type: 'TEXT', content: `隊伍傷亡慘重，${leader.name} 下令立刻撤退，討伐任務宣告失敗...` });
             break; // 戰敗立即中斷
          }
        }
      }
    }

    if (overallVictory) {
      const returnTexts = [
        `討伐任務圓滿完成，${leader.name} 帶領隊伍稍作休整，帶著戰利品踏上歸途。`,
        `雖然經歷了連番激戰，但隊伍成功肅清了敵人，凱旋而歸。`,
      ];
      segments.push({ type: 'TEXT', content: Random.pick(returnTexts) });
      
      // 清除據點 (若為動態節點)
      if (node.isDynamic && GameState.mapSystem) {
         GameState.mapSystem.removeDynamicNode(node.id);
      }
    }

    // 寫入日誌
    const entry: AdventureLogEntry = {
      id: "log_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      day: GameState.totalDays,
      squadLeaderName: leader.name,
      nodeName: node.name,
      segments,
      rewards: {
        gold: totalGold,
        exp: totalExp,
        prestige: totalPrestige,
        items: totalItems
      }
    };

    territory.addAdventureLog(entry);
    
    EventBus.getInstance().publish({
      type: GameEventType.GAME_EVENT_TRIGGERED,
      payload: { eventId: entry.id, isExploration: false }
    });
    
    return overallVictory;
  }

  private static runCombat(
    adventurers: Adventurer[], 
    node: MapNode, 
    baseDiff: number, 
    feature: EnemyFeature, 
    waves: number = 1,
    initialHpMap?: Record<string, number>,
    initialMpMap?: Record<string, number>,
    formationId?: string,
    gridMap?: Record<string, string>
  ): { combatId: string; rewards?: AdventureLogRewards; isVictory: boolean; playerHpMap?: Record<string, number>; playerMpMap?: Record<string, number> } | null {
    let enemyLineup = undefined;
    if (monsterSystem) {
      enemyLineup = (node.scoutData?.garrisonEncounter && node.scoutData.garrisonEncounter.length > 0)
        ? node.scoutData.garrisonEncounter
        : monsterSystem.generateNodeEncounter(node);
    }
    
    const initialHpMpOverride = (initialHpMap || initialMpMap) ? { hp: initialHpMap || {}, mp: initialMpMap || {} } : undefined;

    const finalReport = CombatSystem.simulateCombat(
      adventurers.map(a => a.id),
      baseDiff,
      feature,
      node.terrain,
      waves,
      undefined,
      enemyLineup,
      formationId,
      gridMap,
      initialHpMpOverride
    );

    const expectedPrestige = getCombatPrestigeReward(baseDiff, false, node.nodeLevel);
    
    // 將實際結算的聲望數值覆蓋回戰報，讓 UI (CombatUIManager) 顯示正確的聲望
    if (finalReport.isVictory) {
      finalReport.lootValue = expectedPrestige;
    }

    const combatId = "combat_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    GameState.myTerritory.addCombatRecord({
      id: combatId,
      day: GameState.totalDays,
      nodeName: `討伐: ${node.name}`,
      report: finalReport
    });

    let rewards: AdventureLogRewards | undefined;

    if (finalReport.isVictory) {
      // 1. 取得底層累積的金幣與經驗
      const expectedGold = finalReport.totalEarnedGold || 0;
      
      GameState.myTerritory.addGold(expectedGold);
      GameState.myTerritory.prestige += expectedPrestige;

      // 2. 經驗值與 restedExpPool 處理
      let heroXpReward = finalReport.totalEarnedExp || 0;
      if (GameState.restedExpPool > 0) {
         const bonus = Math.min(GameState.restedExpPool, heroXpReward);
         GameState.restedExpPool -= bonus;
         heroXpReward += bonus;
      }
      
      // 3. 戰俘判定 (Dungeon System)
      if (enemyLineup && enemyLineup.length > 0) {
        const bosses = enemyLineup.filter(e => (e as any).isBoss && (e as any).factionId);
        for (const boss of bosses) {
          const bossAny = boss as any;
          const faction = GameState.mapSystem.getFactions().find(f => f.id === bossAny.factionId);
          if (faction) {
            if (!faction.capturedChampionIds) faction.capturedChampionIds = [];
            if (!faction.capturedChampionIds.includes(bossAny.id)) {
              faction.capturedChampionIds.push(bossAny.id);
              import('../ui/ToastManager').then(({ ToastManager }) => {
                ToastManager.show(`🏆 戰鬥勝利！你俘虜了【傳奇騎士】${bossAny.name}，已押送至領地地牢。`, 'success');
              });
            }
          }
        }
      }
      for (const adv of adventurers) {
        adv.gainXP(heroXpReward);
      }

      // 3. 取得戰場中掉落的裝備名稱 (已在 CombatSystem 中入庫)
      const droppedItems: string[] = finalReport.droppedEquipment || [];

      rewards = {
        gold: expectedGold,
        prestige: expectedPrestige,
        exp: heroXpReward,
        items: droppedItems
      };
    }

    return { 
      combatId, 
      rewards, 
      isVictory: finalReport.isVictory,
      playerHpMap: finalReport.playerHpMap,
      playerMpMap: finalReport.playerMpMap
    };
  }
}
