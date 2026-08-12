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

  const explorationResults = GameState.explorationSystem?.advanceDay(GameState.mapSystem.getNodes()) ?? [];
  for (const explorationProgress of explorationResults) {
    explorationProgress.discoveredNodeIds.forEach(nodeId => {
      EventBus.getInstance().publish({
        type: GameEventType.NODE_EXPLORED,
        payload: { nodeId, explorerId: explorationProgress.expedition.explorerId }
      });
    });

    if (explorationProgress.completed) {
      const explorer = GameState.adventurers.find(
        adventurer => adventurer.id === explorationProgress.expedition.explorerId
      );
      if (explorer) {
        explorer.currentState = AdventurerState.IDLE;
        
        // 原先的探險日誌引擎呼叫已移至 DispatchSystem.ts 作為討伐日誌
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

  // 處理隨機侵略事件
  handleRandomInvasion();

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

// UI 更新改由 GameFlowController 等呼叫端根據轉場時機手動呼叫，避免畫面前後跳躍
  // if (typeof (window as any).updateUICallback === 'function') {
  //   (window as any).updateUICallback();
  // }
  
  if (GameState.myTerritory.population <= 0 && GameState.myTerritory.food <= 0) {
    stopGameLoop();
    import('../ui/GameOverModalController').then(({ GameOverModalController }) => {
      GameOverModalController.getInstance().show();
    });
    return true;
  }
  
  return false;
}

function handleRandomInvasion() {
  const territory = GameState.myTerritory;
  if (!territory) return;
  const difficulty = getDifficultyModifiers(GameState.worldGeneration?.difficulty);
  const nextCooldown = () => Math.max(5, Math.round(Random.int(15, 25) * difficulty.threatInterval));
  
  if (territory.invasionCooldown === undefined || territory.invasionCooldown === 0) {
    territory.invasionCooldown = nextCooldown();
    return;
  }
  
  territory.invasionCooldown -= 1;
  if (territory.invasionCooldown <= 0) {
    const defenseLevel = territory.defenseLevel || 0;
    const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);
    const advPower = idleAdvs.reduce((sum, a) => sum + a.power, 0);

    // 哨所/衛兵戰力計算
    const workers = territory.workers || {};
    const watchtowerTroops = (workers[WorkerJob.INFANTRY] || 0) + (workers[WorkerJob.CAVALRY] || 0) + (workers[WorkerJob.ARCHER] || 0);
    const security = (territory.security === null || territory.security === undefined) ? 100 : territory.security;
    const watchtowerPower = Math.round(watchtowerTroops * 15 * (1 + security / 100));

    const totalDefensePower = advPower + watchtowerPower;

    const topThreePower = [...GameState.adventurers]
      .sort((left, right) => right.power - left.power)
      .slice(0, 3)
      .reduce((sum, adventurer) => sum + adventurer.power, 0);
    const baseEnemyPower =
      20 +
      GameState.currentYear * 10 +
      Math.sqrt(Math.max(0, territory.population)) * 4 +
      topThreePower * 0.45;
    const defenseReduction = Math.min(0.6, defenseLevel * 0.08);
    const randomFactor = Random.int(85, 115) / 100;
    const enemyPower = Math.max(
      10,
      Math.round(baseEnemyPower * difficulty.enemyStrength * randomFactor * (1 - defenseReduction))
    );

    if (idleAdvs.length === 0 && watchtowerTroops === 0) {
      // 據點完全空虛（無傭兵且無哨所守衛）
      processInvasionDefeat(territory, '💥 敵襲！據點無人駐守，物資遭到嚴重洗劫！', 0);
    } else if (totalDefensePower >= enemyPower) {
      // 哨所與留守傭兵成功擊退敵襲
      import('../systems/MilestoneSystem').then(({ MilestoneSystem }) => MilestoneSystem.trigger('first_invasion_repelled'));
      const goldLoot = Random.int(10, 50);
      const prestigeReward = Math.max(10, Math.round(enemyPower / 10));
      territory.gold += goldLoot;
      territory.prestige += prestigeReward;
      
      let defenderDesc = '留守傭兵在防禦設施支援下擊退敵軍！';
      if (watchtowerTroops > 0 && idleAdvs.length > 0) {
        defenderDesc = `哨所守衛與留守傭兵聯手擊退敵軍！(我方戰力: ${totalDefensePower})`;
      } else if (watchtowerTroops > 0) {
        defenderDesc = `🏰 哨所守衛及時反擊，成功抵禦敵軍！(哨所戰力: ${watchtowerPower})`;
      }

      showInvasionReport(
        '⚔️ 擊退敵襲',
        `${defenderDesc}\n\n敵軍戰力：${enemyPower}\n戰利品：${goldLoot} 金幣、${prestigeReward} 聲望`,
        false
      );
      territory.invasionCooldown = nextCooldown();
    } else {
      // 戰力不敵，但哨所守衛與留守傭兵進行抵抗，獲得減傷
      idleAdvs.forEach(a => {
        a.currentState = AdventurerState.RESTING;
        a.restingDaysLeft = 4; // 原本是 3，依需求加上一回合(天)恢復時間
      });

      // 計算哨所涵蓋減傷率 (最高 80% 減傷)
      const mitigationRatio = Math.min(0.8, (security / 100) * 0.6 + (watchtowerTroops > 0 ? 0.2 : 0));
      
      let defeatMsg = `💀 敵襲！我方戰力 ${totalDefensePower} 不敵敵軍 ${enemyPower}。`;
      if (idleAdvs.length > 0) {
        defeatMsg += '\n（所有留守傭兵受重傷，需休養 4 天）';
      }
      if (watchtowerTroops > 0 || security > 0) {
        defeatMsg += `\n🛡️ 哨所守衛誓死抵抗，成功保護了大部分物資！（洗劫損失降低 ${Math.round(mitigationRatio * 100)}%）`;
      }

      processInvasionDefeat(territory, defeatMsg, mitigationRatio);
    }
  }
}

function showInvasionReport(title: string, message: string, isError: boolean) {
  const showFn = () => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0'; overlay.style.left = '0';
    overlay.style.width = '100vw'; overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.85)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center'; overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '99999';

    const modal = document.createElement('div');
    modal.className = 'glass-panel';
    modal.style.padding = '40px';
    modal.style.maxWidth = '500px';
    modal.style.textAlign = 'center';
    modal.style.border = isError ? '2px solid #ef4444' : '2px solid #22c55e';
    
    const titleEl = document.createElement('h2');
    titleEl.innerText = title;
    titleEl.style.color = isError ? '#ef4444' : '#22c55e';
    titleEl.style.fontSize = '2em';
    titleEl.style.marginTop = '0';

    const msgEl = document.createElement('p');
    msgEl.innerText = message;
    msgEl.style.fontSize = '1.2em';
    msgEl.style.whiteSpace = 'pre-wrap';
    msgEl.style.lineHeight = '1.6';
    msgEl.style.color = '#cbd5e1';
    msgEl.style.margin = '30px 0';

    const btn = document.createElement('button');
    btn.className = 'action-btn';
    btn.innerText = '確認並結算';
    btn.style.fontSize = '1.2em';
    btn.onclick = () => document.body.removeChild(overlay);

    modal.appendChild(titleEl);
    modal.appendChild(msgEl);
    modal.appendChild(btn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  };

  // 若正在進行每日結算轉場，加入事件佇列等確認後顯示
  if ((window as any).isAdvancingDay) {
    if (!(window as any).eventQueue) (window as any).eventQueue = [];
    (window as any).eventQueue.push(showFn);
  } else {
    showFn();
  }
}

function processInvasionDefeat(territory: any, baseMsg: string, mitigationRatio: number = 0) {
  const lossMultiplier = Math.max(0.2, 1 - mitigationRatio);
  const rawLostWood = Math.floor(territory.wood * 0.2);
  const rawLostFood = Math.floor(territory.food * 0.2);
  const rawLostPop = Random.int(1, 3);

  const lostWood = Math.floor(rawLostWood * lossMultiplier);
  const lostFood = Math.floor(rawLostFood * lossMultiplier);
  const lostPop = Math.max(0, Math.floor(rawLostPop * lossMultiplier));
  
  territory.wood -= lostWood;
  territory.food -= lostFood;
  const actualLostPop = lostPop > 0 ? territory.removeWorkers(lostPop, true) : 0;
  
  if (actualLostPop > 0) {
    EventBus.getInstance().publish({
      type: GameEventType.POPULATION_CHANGED,
      payload: { delta: -actualLostPop, currentPopulation: territory.population, reason: 'INVASION_DEFEAT' }
    });
  }
  
  // 戰敗進入 7 日絕對保護期
  territory.invasionCooldown = 7;
  
  const reportMsg = `${baseMsg}\n\n損失統計：\n🪵 木材 -${lostWood}\n🍞 糧食 -${lostFood}\n👥 人口 -${actualLostPop}\n\n(據點進入 7 天破敗保護期，期間不會再次遭遇侵略)`;
  showInvasionReport(mitigationRatio > 0 ? '⚔️ 哨所抵抗（遭強敵突破）' : '慘遭洗劫', reportMsg, true);
}

