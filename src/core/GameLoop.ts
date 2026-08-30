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

export function startGameLoop(updateUICallback: () => void) {
  if ((window as any).autoSaveLoop) {
    clearInterval((window as any).autoSaveLoop);
  }

  // 將 updateUI 綁定到 window 以便 advanceDay 呼叫
  (window as any).updateUICallback = updateUICallback;

  // 每 60 秒自動存檔 (保留放置期間的資料安全)
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

  // OPT-02: 每日檢查 RESTING 狀態的决陽者，倒數恢復
  GameState.adventurers.forEach(adv => {
    if (adv.currentState === AdventurerState.RESTING) {
      adv.restingDaysLeft = Math.max(0, adv.restingDaysLeft - 1);
      if (adv.restingDaysLeft <= 0) {
        adv.currentState = AdventurerState.IDLE;
        console.log(`[HeroSystem] 🌞 ${adv.name} 已恢復健康，可以再次出動！`);
      }
    }
  });
  
  // 每日更新天氣
  GameState.mapSystem.updateWeather();
  
  // 每日更新市場 (MarketSystem 內部會控制 7 天更新一次物價)
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

  // 1. 推進派遣系統 (以天數為基礎)
  GameState.system.updateDays(1);

  // 2. 推進故事敘事系統每日排程與事件結算
  NarrativeSystem.processDailyTick();

  // 3. 推進領主攻城遠征行軍任務 (Lord Siege Campaign)
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
  
  // 1.2 每日地圖動態 (圍城倒數等)
  GameState.mapSystem.simulateDailyMapDynamics(GameState.totalDays);

  // 1.5 每日檢查地圖據點解鎖條件
  GameState.mapSystem.checkNodeUnlocks(GameState.totalDays, GameState.myTerritory.prestige);

  // 2. 每天結算一次隨機事件壓力，滿了自動觸發
  EventSystem.triggerRandomEvent();
  
  // 3. 發送天數流逝事件，觸發各系統 (如 SettlementSystem 的資源產出)
  EventBus.getInstance().publish({ 
    type: GameEventType.DAY_PASSED, 
    payload: { daysPassed: 1, currentTimestamp: Date.now() } 
  });

  if (GameState.totalDays % 7 === 0) {
    GameState.system.resolvePayday();
  }

  // 處理懸賞系統的每日推進
  BountySystem.processDailyTick(GameState);

  // 4. 月底大結算 (世界地圖)
  if (monthEnded) {
    GameState.mapSystem.simulateMapDynamics(1);
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

  // 若當日有兵臨城下之攻城遠征，延遲觸發攻城戰役
  if (arrivedSiegeMission) {
    const m = arrivedSiegeMission;
    setTimeout(() => {
      OffensiveSiegeModalController.triggerArrivedSiegeCombat(m);
    }, 450);
  }

  return false;
}
