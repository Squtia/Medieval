import { GameState } from './GameState';
import { SaveManager } from './SaveManager';
import { AdventurerState } from '../models/types';

import { EventSystem } from '../systems/EventSystem';
import { MarketSystem } from '../systems/MarketSystem';
import { EventBus } from './EventBus';
import { GameEventType } from './GameEvents';
import { ToastManager } from '../ui/ToastManager';
import { Random } from './Random';

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

export function advanceDay() {
  if (!GameState.system || !GameState.mapSystem) return;

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

// UI 更新改由 GameFlowController 等呼叫端根據轉場時機手動呼叫，避免畫面前後跳躍
  // if (typeof (window as any).updateUICallback === 'function') {
  //   (window as any).updateUICallback();
  // }
}

function handleRandomInvasion() {
  const territory = GameState.myTerritory;
  if (!territory) return;
  
  if (territory.invasionCooldown === undefined || territory.invasionCooldown === 0) {
    territory.invasionCooldown = Random.int(15, 25); // B3: 延長初始 CD，給早期玩家喘息空間
    return;
  }
  
  territory.invasionCooldown -= 1;
  if (territory.invasionCooldown <= 0) {
    // 觸發侵略判定
    const defenseLevel = territory.defenseLevel || 0;
    // 難度依據年份與隨機值成長，確保玩家有升級防禦的壓力
    const requiredDefense = GameState.currentYear + Random.int(0, 2); 
    
    if (defenseLevel >= requiredDefense) {
      showInvasionReport('🛡️ 防禦成功', '盜賊試圖夜襲營地，但看見堅固的木柵欄後知難而退了！\n\n領地未受任何損失。', false);
      territory.invasionCooldown = Random.int(15, 25); // B3: 防禦成功後重置 CD
    } else {
      // 戰鬥判定
      const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);
      let totalPower = idleAdvs.reduce((sum, a) => sum + a.power, 0);
      const enemyPower = Math.min(300, Random.int(10, 30 + GameState.currentYear * 15)); 
      
      if (idleAdvs.length === 0) {
        processInvasionDefeat(territory, '💥 敵襲！據點無人駐守，物資遭到嚴重洗劫！');
      } else if (totalPower >= enemyPower) {
        const goldLoot = Random.int(10, 50);
        territory.gold += goldLoot;
        showInvasionReport('⚔️ 擊退敵襲', `留守的傭兵成功擊退了來犯的敵人！\n\n戰利品：獲得 ${goldLoot} 金幣`, false);
        territory.invasionCooldown = Random.int(15, 25); // B3: 擊退後重置較長 CD
      } else {
        idleAdvs.forEach(a => {
          a.currentState = AdventurerState.RESTING;
          a.restingDaysLeft = 3; // 受重傷休息 3 天
        });
        processInvasionDefeat(territory, '💀 敵襲！留守傭兵不敵對手，據點遭到洗劫！\n\n（所有留守傭兵受重傷，需休養 3 天無法行動）');
      }
    }
  }
}

function showInvasionReport(title: string, message: string, isError: boolean) {
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
}

function processInvasionDefeat(territory: any, baseMsg: string) {
  const lostWood = Math.floor(territory.wood * 0.2);
  const lostFood = Math.floor(territory.food * 0.2);
  const lostPop = Random.int(1, 3);
  
  territory.wood -= lostWood;
  territory.food -= lostFood;
  territory.population = Math.max(1, territory.population - lostPop);
  
  // 戰敗進入 7 日絕對保護期
  territory.invasionCooldown = 7;
  
  const reportMsg = `${baseMsg}\n\n損失統計：\n🪵 木材 -${lostWood}\n🍞 糧食 -${lostFood}\n👥 人口 -${lostPop}\n\n(據點進入 7 天破敗保護期，期間不會再次遭遇侵略)`;
  showInvasionReport('慘遭洗劫', reportMsg, true);
}

