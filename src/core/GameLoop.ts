import { GameState } from './GameState';
import { SaveManager } from './SaveManager';

import { EventSystem } from '../systems/EventSystem';

export function startGameLoop(updateUICallback: () => void) {
  if ((window as any).gameLoop) {
    clearInterval((window as any).gameLoop);
  }
  if ((window as any).autoSaveLoop) {
    clearInterval((window as any).autoSaveLoop);
  }
  if ((window as any).eventLoop) {
    clearInterval((window as any).eventLoop);
  }

  (window as any).gameLoop = setInterval(() => {
    if (GameState.system && GameState.mapSystem) {
      GameState.system.update(Date.now());
      GameState.mapSystem.simulateMapDynamics(1000);
      updateUICallback();
    }
  }, 1000);

  // 隨機事件迴圈：每 10 秒檢查一次
  (window as any).eventLoop = setInterval(() => {
    if (GameState.system && GameState.mapSystem) {
      EventSystem.triggerRandomEvent();
    }
  }, 10000);

  // 每 60 秒自動存檔
  (window as any).autoSaveLoop = setInterval(() => {
    if (GameState.currentSaveSlot !== null) {
      SaveManager.saveGame(GameState.currentSaveSlot);
      console.log(`[系統] 🔄 背景自動儲存完畢 (欄位 ${GameState.currentSaveSlot})`);
    }
  }, 60000);
}

export function stopGameLoop() {
  if ((window as any).gameLoop) clearInterval((window as any).gameLoop);
  if ((window as any).autoSaveLoop) clearInterval((window as any).autoSaveLoop);
  if ((window as any).eventLoop) clearInterval((window as any).eventLoop);
}
