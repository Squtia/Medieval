import { GameState } from '../core/GameState';
import { Random } from '../core/Random';
import { Adventurer } from '../models/Adventurer';
import { AdventureLogEntry, AdventureLogSegment, SegmentType } from '../models/AdventureLog';
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
  public static generateSubjugationLog(adventurers: Adventurer[], node: MapNode, baseDiff: number, enemyFeature: EnemyFeature): void {
    const territory = GameState.myTerritory;
    const segments: AdventureLogSegment[] = [];
    
    if (adventurers.length === 0) return;
    const leader = adventurers[0];

    // 1. 出發描述
    const startTexts = [
      `以 ${leader.name} 為首的隊伍奉命前往討伐 ${node.name}...`,
      `${leader.name} 帶領著小隊，朝著 ${node.name} 的方向前進，準備展開討伐。`,
      `討伐 ${node.name} 的命令下達，${leader.name} 與隊員們全副武裝踏上了旅途。`,
    ];
    segments.push({ type: 'TEXT', content: Random.pick(startTexts) });

    // 2. 隨機事件 (過渡用，採用 EXPLORATION_EVENTS 庫)
    if (EXPLORATION_EVENTS.length > 0 && Random.next() > 0.3) {
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
    }

    // 3. 抵達與遭遇描述
    const encounterTexts = [
      `經過跋涉，隊伍終於抵達了目標區域，並與駐紮在此的怪物發生了激戰！`,
      `抵達 ${node.name} 後，敵人立刻發起了猛烈的攻勢！`,
      `${leader.name} 揮舞著武器，一聲令下，隊伍與 ${node.name} 的敵軍展開了對決。`,
    ];
    segments.push({ type: 'TEXT', content: Random.pick(encounterTexts) });

    // 4. 進行主戰鬥
    const combatId = this.runCombat(adventurers, node, baseDiff, enemyFeature);
    if (combatId) {
      segments.push({ type: 'COMBAT_LINK', content: combatId });
    }

    // 5. 歸途描述
    const returnTexts = [
      `戰鬥結束後，${leader.name} 帶領隊伍稍作休整，帶著戰利品踏上歸途。`,
      `雖然經歷了激烈的戰鬥，但隊伍完成了討伐任務，凱旋而歸。`,
      `清理完戰場後，隊員們互相攙扶著，朝著據點的方向返回。`,
    ];
    segments.push({ type: 'TEXT', content: Random.pick(returnTexts) });

    // 6. 寫入日誌
    const entry: AdventureLogEntry = {
      id: "log_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      day: GameState.totalDays,
      squadLeaderName: leader.name,
      nodeName: node.name,
      segments
    };

    territory.addAdventureLog(entry);
    
    EventBus.getInstance().publish({
      type: GameEventType.GAME_EVENT_TRIGGERED,
      payload: { eventId: entry.id, isExploration: false }
    });
  }

  private static runCombat(adventurers: Adventurer[], node: MapNode, baseDiff: number, feature: EnemyFeature): string | null {
    let enemyLineup = undefined;
    if (monsterSystem) {
      enemyLineup = (node.scoutData?.garrisonEncounter && node.scoutData.garrisonEncounter.length > 0)
        ? node.scoutData.garrisonEncounter
        : monsterSystem.generateNodeEncounter(node);
    }
    
    const finalReport = CombatSystem.simulateCombat(
      adventurers.map(a => a.id),
      baseDiff,
      feature,
      node.terrain,
      1,
      undefined,
      enemyLineup
    );

    const combatId = "combat_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    GameState.myTerritory.addCombatRecord({
      id: combatId,
      day: GameState.totalDays,
      nodeName: `討伐: ${node.name}`,
      report: finalReport
    });

    if (finalReport.isVictory) {
      // 1. 金幣與聲望
      const expectedGold = 100 + node.nodeLevel * 50;
      const expectedPrestige = getCombatPrestigeReward(baseDiff, false, node.nodeLevel);
      
      GameState.myTerritory.addGold(expectedGold);
      GameState.myTerritory.prestige += expectedPrestige;

      // 2. 經驗值與 restedExpPool 處理
      let heroXpReward = Math.max(10, expectedPrestige * 2);
      if (GameState.restedExpPool > 0) {
         const bonus = Math.min(GameState.restedExpPool, heroXpReward);
         GameState.restedExpPool -= bonus;
         heroXpReward += bonus;
      }
      for (const adv of adventurers) {
        adv.gainXP(heroXpReward);
      }

      // 3. 裝備掉落
      if (Random.next() * 100 <= baseDiff + 20) {
        const maxLevel = Math.max(5, Math.floor(baseDiff / 2));
        const droppedEq = EquipmentGenerator.dropRandomEquipment(maxLevel);
        if (droppedEq) {
          GameState.myTerritory.addEquipmentToWarehouse(droppedEq);
        }
      }

      // 4. 清除據點 (若為動態節點)
      if (node.isDynamic && GameState.mapSystem) {
         GameState.mapSystem.removeDynamicNode(node.id);
      }
    }

    return combatId;
  }
}
