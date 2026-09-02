import { GameState } from '../core/GameState';
import { Random } from '../core/Random';
import { Adventurer } from '../models/Adventurer';
import { AdventureLogEntry, AdventureLogSegment, SegmentType, AdventureLogRewards } from '../models/AdventureLog';
import { EXPLORATION_EVENTS, getRandomNarrativePool } from '../data/NarrativeData';
import { CombatSystem } from './CombatSystem';
import { EnemyFeature, SubjugationMode, TaskType } from '../models/DispatchTask';
import { MapNode, NodeLevel, MonsterRace } from '../models/types';
import { getDifficultyModifiers, getCombatPrestigeReward } from '../data/BalanceData';
import { monsterSystem } from './MonsterSystem';
import { EventBus } from '../core/EventBus';
import { EquipmentGenerator } from './EquipmentGenerator';
import { GameEventType } from '../core/GameEvents';
import { findHeroDef } from '../data/UniqueAdventurers';

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

    // 判斷是否為「自訂/固定設計據點」（非動態生成、具備 templateId 或自訂守軍配置）
    const isAuthoredStronghold = !node.isDynamic || Boolean(node.narrativeSubjugation?.templateId) || Boolean(node.scoutData?.garrisonEncounter && node.scoutData.garrisonEncounter.length > 0);

    if (isAuthoredStronghold) {
      // 🏰 固定/設計據點：直接發動據點攻堅戰（100% 依據點波次 Waves 進行一次性決戰，杜絕外層隨機遇敵干擾）
      segments.push({ 
        type: 'TEXT', 
        content: `${leader.name} 率領討伐小隊抵達 ${node.name}，全員列陣完畢，正式發動據點攻堅戰！` 
      });

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
        
        if (!combatResult.isVictory) {
          overallVictory = false;
          segments.push({ type: 'TEXT', content: `❌ 敵方防線過於頑強，${leader.name} 傷亡慘重被迫撤退，攻堅任務宣告失敗...` });
        }
      }
    } else {
      // 🗺️ 野外探索 / 動態漫遊據點：保留 2~3 步順序探索流 (隨機事件與遭遇)
      for (let step = 1; step <= maxSteps; step++) {
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
    }

    if (overallVictory) {
      const returnTexts = [
        `討伐任務圓滿完成，${leader.name} 帶領隊伍稍作休整，帶著戰利品踏上歸途。`,
        `雖然經歷了連番激戰，但隊伍成功肅清了敵人，凱旋而歸。`,
      ];
      segments.push({ type: 'TEXT', content: Random.pick(returnTexts) });
      
      // 清除據點 (若為動態節點)
      if (node.isDynamic && GameState.mapSystem && (node.narrativeSubjugation?.removeOnVictory ?? true)) {
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
      
      // 3. 戰俘判定 (Dungeon System - 以英雄名單 UniqueHeroDef 為 SSOT 資格)
      if (enemyLineup && enemyLineup.length > 0) {
        for (const captive of enemyLineup) {
          const captiveAny = captive as any;
          
          // 查詢是否具備英雄名冊資格 (或派系將領)
          const heroDef = findHeroDef(captiveAny.id) || 
                          (captiveAny.characterKey ? findHeroDef(captiveAny.characterKey) : null);
          
          const faction = captiveAny.factionId ? GameState.mapSystem?.getFactions().find(f => f.id === captiveAny.factionId) : undefined;
          const isFactionChampion = Boolean(faction && faction.champions?.some(c => c.id === captiveAny.id));

          // 只有匹配到英雄名單，或是派系名將者，才具備被俘虜資格！
          if (!heroDef && !isFactionChampion) {
            continue;
          }

          // 若該單位已被副將替換，或其本尊英雄已在玩家麾下/已在地牢中，禁止再次俘虜！
          if (captiveAny.name && captiveAny.name.includes('【代理副將】')) {
            continue;
          }

          if (heroDef) {
            const alreadyInParty = GameState.adventurers.some(a => 
              a.id === heroDef.id || 
              (a as any).characterKey === heroDef.characterKey ||
              (a as any).boundMonsterId === heroDef.boundMonsterId ||
              a.name.includes(heroDef.name)
            );
            const alreadyInDungeon = GameState.myTerritory?.dungeonPrisonerHeroIds?.includes(heroDef.id);
            if (alreadyInParty || alreadyInDungeon) {
              continue;
            }
          }

          // 判定情境：若派系所屬城池 <= 1 (最後一城/滅國戰)，則為滅國絕境
          const controlledCount = faction?.controlledNodes ? faction.controlledNodes.length : 0;
          const isLastStand = faction ? (controlledCount <= 1) : false;
          const isSiege = Boolean(faction && controlledCount > 1);

          const candidateCaptureRate = heroDef?.captureRate ?? captiveAny.captureRate;
          const finalCaptureRate = ExplorationNarrativeEngine.calculateCaptureRate(
            candidateCaptureRate,
            isLastStand,
            isSiege
          );

          const roll = Math.random() * 100;
          if (roll < finalCaptureRate) {
            // 俘虜成功：押送至領地地牢
            if (heroDef) {
              if (!GameState.myTerritory.dungeonPrisonerHeroIds) {
                GameState.myTerritory.dungeonPrisonerHeroIds = [];
              }
              if (!GameState.myTerritory.dungeonPrisonerHeroIds.includes(heroDef.id)) {
                GameState.myTerritory.dungeonPrisonerHeroIds.push(heroDef.id);
              }
            }

            if (faction) {
              if (!faction.capturedChampionIds) faction.capturedChampionIds = [];
              if (!faction.capturedChampionIds.includes(captiveAny.id)) {
                faction.capturedChampionIds.push(captiveAny.id);
              }
            }

            const heroName = heroDef ? `${heroDef.title || ''}${heroDef.name}` : captiveAny.name;
            import('../ui/ToastManager').then(({ ToastManager }) => {
              ToastManager.show(`🏆 戰鬥勝利！你成功生擒俘虜了【傳奇名將】${heroName}，已押送至領地地牢！`, 'success');
            });
          } else {
            // 未被俘虜：敵將負傷突圍逃脫
            const heroName = heroDef ? `${heroDef.title || ''}${heroDef.name}` : captiveAny.name;
            import('../ui/ToastManager').then(({ ToastManager }) => {
              ToastManager.show(`💨【突圍】敵將 ${heroName} 在親衛掩護下負傷突圍逃脫！`, 'info');
            });
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

  /**
   * 計算將領在當前情境下的最終被俘虜機率 (0~100)
   * 1. 滅國絕境 (isLastStand)：100%
   * 2. 自訂機率 (customRate !== undefined)：優先採用自訂設定 (0~100)
   * 3. 多城守城 (isSiege)：預設 40%
   * 4. 野外遭遇/討伐據點：預設 25%
   */
  public static calculateCaptureRate(
    customRate?: number,
    isLastStand: boolean = false,
    isSiege: boolean = false
  ): number {
    if (isLastStand) {
      return 100;
    }
    if (customRate !== undefined && customRate !== null && !isNaN(customRate)) {
      return Math.max(0, Math.min(100, customRate));
    }
    if (isSiege) {
      return 40;
    }
    return 25;
  }
}
