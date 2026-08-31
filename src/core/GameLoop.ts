import { GameState } from './GameState';
import { SaveManager } from './SaveManager';
import { AdventurerState, WorkerJob } from '../models/types';
import { EventSystem } from '../systems/EventSystem';
import { MarketSystem } from '../systems/MarketSystem';
import { TavernSystem } from '../systems/TavernSystem';
import { EventBus } from './EventBus';
import { GameEventType } from './GameEvents';
import { ToastManager } from '../ui/ToastManager';
import { Random } from './Random';
import { TaskType } from '../models/DispatchTask';
import { getDifficultyModifiers } from '../data/BalanceData';
import { BountySystem } from '../systems/BountySystem';
import { NarrativeSystem } from '../systems/NarrativeSystem';
import { OffensiveSiegeModalController } from '../ui/modals/OffensiveSiegeModalController';

import { FactionEconomyEngine } from '../systems/faction/FactionEconomyEngine';
import { FactionCampaignSystem } from '../systems/faction/FactionCampaignSystem';
import { FactionDecisionAI } from '../systems/faction/FactionDecisionAI';

export function startGameLoop(updateUICallback: () => void) {
  if ((window as any).autoSaveLoop) {
    clearInterval((window as any).autoSaveLoop);
  }

  (window as any).updateUICallback = updateUICallback;

  (window as any).autoSaveLoop = setInterval(() => {
    if (GameState.currentSaveSlot !== null) {
      SaveManager.saveGame(GameState.currentSaveSlot);
    }
  }, 60000);
}

export function stopGameLoop() {
  if ((window as any).autoSaveLoop) clearInterval((window as any).autoSaveLoop);
}

export function advanceDay(): boolean {
  if (!GameState.system || !GameState.mapSystem) return false;

  const before = {
    gold: GameState.myTerritory.gold,
    food: GameState.myTerritory.food,
    wood: GameState.myTerritory.wood,
    stone: GameState.myTerritory.stone,
    iron: GameState.myTerritory.iron,
    population: GameState.myTerritory.population,
    activeMissions: GameState.system.getActiveMissionsCount()
  };

  GameState.currentDay += 1;
  GameState.totalDays += 1;

  // 檢查情報是否過期
  GameState.mapSystem.checkScoutExpiry(GameState.totalDays);

  // 推進領地屬性重置
  GameState.myTerritory.exploredToday = 0;
  GameState.myTerritory.refugeeDiscoveryCooldownDays = Math.max(
    0,
    GameState.myTerritory.refugeeDiscoveryCooldownDays - 1
  );

  // 每日檢查 RESTING 狀態的冒險者
  GameState.adventurers.forEach(adv => {
    if (adv.currentState === AdventurerState.RESTING) {
      adv.restingDaysLeft = Math.max(0, adv.restingDaysLeft - 1);
      if (adv.restingDaysLeft <= 0) {
        adv.currentState = AdventurerState.IDLE;
        console.log(`[HeroSystem] 🌞 ${adv.name} 已恢復健康，可以再次出動！`);
      }
    }
  });

  // 每日更新天氣與市場
  GameState.mapSystem.updateWeather();
  MarketSystem.updateMarkets(GameState.mapSystem.getNodes(), GameState.totalDays);

  // 每日更新酒館旅客
  TavernSystem.updateTavernGuests(GameState.myTerritory);

  // 滿 30 天換月
  let monthEnded = false;
  if (GameState.currentDay > 30) {
    GameState.currentDay = 1;
    GameState.currentMonth += 1;
    monthEnded = true;

    if (GameState.currentMonth > 12) {
      GameState.currentMonth = 1;
      GameState.currentYear += 1;
    }
  }

  // 1. 推進派遣系統
  GameState.system.updateDays(1);

  // 2. 推進故事敘事系統每日排程
  NarrativeSystem.processDailyTick();

  // 3. 推進領主攻城遠征任務
  let arrivedSiegeMission: import('../models/types').LordSiegeCampaignMission | null = null;
  const campaignMission = GameState.myTerritory?.lordCampaignMission;
  if (campaignMission && campaignMission.state === 'MARCHING') {
    campaignMission.daysRemaining -= 1;
    if (campaignMission.provisionPerDay > 0) {
      GameState.myTerritory.food = Math.max(0, GameState.myTerritory.food - campaignMission.provisionPerDay);
    }
    if (campaignMission.daysRemaining <= 0) {
      campaignMission.state = 'ARRIVED';
      arrivedSiegeMission = campaignMission;
    }
  }

  // 4. 推進地圖探索
  const explorationResults = GameState.explorationSystem?.advanceDay(GameState.mapSystem.getNodes()) ?? [];
  for (const explorationProgress of explorationResults) {
    explorationProgress.discoveredNodeIds.forEach(nodeId => {
      EventBus.getInstance().publish({
        type: GameEventType.NODE_EXPLORED,
        payload: { nodeId, explorerId: explorationProgress.expedition.explorerId }
      });
      NarrativeSystem.handleNodeExplored(nodeId);
    });

    if (explorationProgress.completed) {
      const explorer = GameState.adventurers.find(
        adventurer => adventurer.id === explorationProgress.expedition.explorerId
      );
      if (explorer) {
        explorer.currentState = AdventurerState.IDLE;
      }
    }

    EventBus.getInstance().publish({
      type: GameEventType.MISSIONS_CHANGED,
      payload: {
        reason: explorationProgress.completed ? 'COMPLETED' : 'PROGRESSED',
        missionType: TaskType.EXPLORE
      }
    });
  }

  // 5. 推進道路建造
  const roadProgress = GameState.roadSystem?.advanceDay(GameState.totalDays);
  if (roadProgress) {
    EventBus.getInstance().publish({
      type: GameEventType.ROAD_CHANGED,
      payload: {
        reason: roadProgress.completed ? 'COMPLETED' : 'PROGRESSED',
        roadId: roadProgress.project.id,
        targetNodeId: roadProgress.project.targetNodeId
      }
    });
  }

  // 6. 每日地圖動態 (斥候偵查等)
  GameState.mapSystem.simulateDailyMapDynamics(GameState.totalDays);

  // ── 7. 每日 AI 勢力自主推演與軍事行動推進 ──
  if (GameState.factionProfiles && GameState.factionProfiles.length > 0) {
    // (1) 每日經濟結算 (稅收、軍餉、糧食消耗、逃兵與動員)
    FactionEconomyEngine.stepDailyEconomy(
      GameState.factionProfiles,
      GameState.mapSystem.getNodes(),
      GameState.totalDays
    );

    // (2) 每日推進進行中的軍事戰役 (行軍進度、圍城倒數、戰利品結算)
    if (!GameState.campaigns) GameState.campaigns = [];
    const campaignResults = FactionCampaignSystem.stepCampaigns(
      GameState.campaigns,
      GameState.factionProfiles,
      GameState.mapSystem.getNodes(),
      GameState.totalDays
    );

    campaignResults.forEach(res => {
      if (res.event === 'CITY_FALLEN' || res.event === 'RAID_COMPLETED' || res.event === 'ARRIVED_AT_TARGET') {
        console.log(`[派系動態] ${res.message}`);
        ToastManager.show(res.message, res.isCityFallen ? 'warning' : 'info');
      }
    });

    // (3) 每 7 天進行一次宏觀戰略 AI 決策評估
    if (GameState.totalDays % 7 === 0) {
      for (const faction of GameState.factionProfiles) {
        if (!faction.controlledNodes || faction.controlledNodes.length === 0) continue;
        if (faction.military.activeCampaignId) continue;

        const decision = FactionDecisionAI.evaluateDecision(
          faction,
          GameState.factionProfiles,
          GameState.mapSystem.getNodes()
        );

        if (decision.type === 'LAUNCH_SIEGE' || decision.type === 'BORDER_RAID') {
          const originNode = GameState.mapSystem.getNodeById(faction.controlledNodes[0]);
          const targetNode = decision.targetNodeId ? GameState.mapSystem.getNodeById(decision.targetNodeId) : null;
          if (originNode && targetNode && decision.targetFactionId) {
            const newCamp = FactionCampaignSystem.launchCampaign(
              faction,
              decision.targetFactionId,
              originNode,
              targetNode,
              decision.type === 'LAUNCH_SIEGE' ? 'SIEGE' : 'BORDER_RAID'
            );
            GameState.campaigns.push(newCamp);
            console.log(`[派系戰略] ⚔️ 【${faction.factionName}】發起了戰略行動：${decision.reason}`);
          }
        } else if (decision.type === 'SEEK_TRUCE' && decision.targetFactionId) {
          const enemy = GameState.factionProfiles.find(f => f.id === decision.targetFactionId);
          if (enemy) {
            const truceMsg = FactionCampaignSystem.executeTruce(faction, enemy, GameState.mapSystem.getNodes());
            console.log(`[派系外交] ${truceMsg}`);
            ToastManager.show(truceMsg, 'info');
          }
        }
      }
    }
  }

  // 8. 每日檢查據點解鎖
  GameState.mapSystem.checkNodeUnlocks(GameState.totalDays, GameState.myTerritory.prestige);

  // 9. 隨機事件壓力結算
  EventSystem.triggerRandomEvent();

  // 10. 發送天數流逝事件
  EventBus.getInstance().publish({
    type: GameEventType.DAY_PASSED,
    payload: { daysPassed: 1, currentTimestamp: Date.now() }
  });

  if (GameState.totalDays % 7 === 0) {
    GameState.system.resolvePayday();
  }

  // 推進懸賞告示板
  BountySystem.processDailyTick(GameState);

  // 11. 月底大結算 (據點繁榮度推演)
  if (monthEnded) {
    import('../systems/map/MapNodeSystem').then(({ MapNodeSystem }) => {
      MapNodeSystem.simulateProsperity(GameState.mapSystem.getNodes());
    });
    console.log(`📅 [系統] 月底結算：目前時間為第 ${GameState.currentYear} 年 ${GameState.currentMonth} 月。`);
  }

  GameState.lastDailySummary = {
    day: GameState.totalDays,
    goldDelta: GameState.myTerritory.gold - before.gold,
    foodDelta: GameState.myTerritory.food - before.food,
    woodDelta: GameState.myTerritory.wood - before.wood,
    stoneDelta: GameState.myTerritory.stone - before.stone,
    ironDelta: GameState.myTerritory.iron - before.iron,
    populationDelta: GameState.myTerritory.population - before.population,
    missionsCompleted: Math.max(0, before.activeMissions - GameState.system.getActiveMissionsCount())
  };

  // 每日檢查里程碑觸發
  import('../systems/MilestoneSystem').then(({ MilestoneSystem }) => {
    MilestoneSystem.checkAll();
  });

  if (GameState.myTerritory.gold < 0) {
    GameState.myTerritory.consecutiveDaysInDebt = (GameState.myTerritory.consecutiveDaysInDebt || 0) + 1;
  } else {
    GameState.myTerritory.consecutiveDaysInDebt = 0;
  }

  if (GameState.myTerritory.consecutiveDaysInDebt >= 14) {
    stopGameLoop();
    import('../ui/GameOverModalController').then(({ GameOverModalController }) => {
      GameOverModalController.getInstance().show('bankruptcy');
    });
    return true;
  }

  if (GameState.myTerritory.population <= 0 && GameState.myTerritory.food <= 0) {
    stopGameLoop();
    import('../ui/GameOverModalController').then(({ GameOverModalController }) => {
      GameOverModalController.getInstance().show('starvation');
    });
    return true;
  }

  if (arrivedSiegeMission) {
    const m = arrivedSiegeMission;
    setTimeout(() => {
      OffensiveSiegeModalController.triggerArrivedSiegeCombat(m);
    }, 450);
  }

  return false;
}