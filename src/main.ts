import { ToastManager } from './ui/ToastManager';
import { initGameState } from './core/GameState';
import { initLogger } from './utils/Logger';
import { UIManager } from './ui/UIManager';
import { CombatUIManager } from './ui/CombatUIManager';
import { renderMap, initMapInteraction } from './ui/MapController';
import { openEventModal } from './ui/ModalController';
import { GAME_EVENTS } from './data/EventData';
import { EventBus } from './core/EventBus';
import { GameEventType } from './core/GameEvents';

import { initMainMenuController } from './ui/MainMenuController';
import { initGameFlowController } from './ui/GameFlowController';
import { initFacilityController } from './ui/FacilityController';
import { initActionController } from './ui/ActionController';
import { initRecruitController } from './ui/RecruitController';
import { initCheatController } from './ui/CheatController';

// 1. 初始化日誌攔截
const logContainer = document.getElementById('game-log');
if (logContainer) {
  initLogger(logContainer);
}

// 2. 全域 UI 事件訂閱
export function rebindGlobalUIEvents() {
  EventBus.getInstance().subscribe(GameEventType.RESOURCE_CHANGED, () => {
    UIManager.updateUI();
  });
  EventBus.getInstance().subscribe(GameEventType.POPULATION_STARVED, (payload) => {
    UIManager.updateUI();
    ToastManager.show(`⚠️ 飢荒警告！由於糧食不足，${payload.starvedAmount} 名人口流失了！`);
  });
  EventBus.getInstance().subscribe(GameEventType.THREAT_WARNING, (payload) => {
    ToastManager.show(`⚠️ ${payload.threatName} 將在 ${payload.daysRemaining} 天後抵達，請預留糧食！`, 'warning');
    UIManager.updateUI();
  });
  EventBus.getInstance().subscribe(GameEventType.GAME_EVENT_TRIGGERED, ({ eventId }) => {
    const event = GAME_EVENTS.find(candidate => candidate.id === eventId);
    if (event) openEventModal(event);
  });
  EventBus.getInstance().subscribe(GameEventType.MISSIONS_CHANGED, () => {
    renderMap();
    UIManager.updateUI();
  });
  CombatUIManager.init();
}

// 3. 初始化遊戲資料與全域事件監聽
initGameState();
rebindGlobalUIEvents();

// 4. 初始化地圖互動事件
initMapInteraction();

// 5. 初始化各個 UI Controller
initMainMenuController(rebindGlobalUIEvents);
initGameFlowController();
initFacilityController();
initActionController();
initRecruitController();
initCheatController();
