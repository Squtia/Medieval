import { GameState } from './GameState';
import { SaveManager } from './SaveManager';

import { EventSystem } from '../systems/EventSystem';
import { MarketSystem } from '../systems/MarketSystem';
import { EventBus } from './EventBus';
import { GameEventType } from './GameEvents';

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

  GameState.currentDay += 1;
  GameState.totalDays += 1;
  
  // 檢查情報是否過期
  GameState.mapSystem.checkScoutExpiry(GameState.totalDays);
  
  // 推進領地屬性重置
  GameState.myTerritory.exploredToday = 0;
  
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

  // 2. 每天結算一次隨機事件壓力，滿了自動觸發
  EventSystem.triggerRandomEvent();
  
  // 3. 發送天數流逝事件，觸發各系統 (如 SettlementSystem 的資源產出)
  EventBus.getInstance().publish({ 
    type: GameEventType.DAY_PASSED, 
    payload: { daysPassed: 1, currentTimestamp: Date.now() } 
  });

  // 3. 月底大結算 (內政與世界地圖)
  if (monthEnded) {
    GameState.system.resolveMonth();
    GameState.mapSystem.simulateMapDynamics(1);
    
    console.log(`📅 [系統] 月底結算：目前時間為第 ${GameState.currentYear} 年 ${GameState.currentMonth} 月。`);
  }

  // 更新 UI
  if (typeof (window as any).updateUICallback === 'function') {
    (window as any).updateUICallback();
  }
}

