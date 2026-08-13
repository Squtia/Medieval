import { ToastManager } from './ui/ToastManager';
import { GameState, initGameState } from './core/GameState';
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
import { initExplorationController, refreshExplorationUI } from './ui/ExplorationController';
import { initStreetScroller } from './ui/SceneController';
import { loadAllTemplates } from './ui/TemplateLoader';

// 全域 UI 事件訂閱 (只需綁定一次，不會因重新開局被清除)
export function initGlobalUIEvents() {
  EventBus.getInstance().subscribe(GameEventType.DAY_PASSED, () => {
    ToastManager.clearAll();
  }, 'ui');
  EventBus.getInstance().subscribe(GameEventType.RESOURCE_CHANGED, () => {
    UIManager.updateUI();
  }, 'ui');
  EventBus.getInstance().subscribe(GameEventType.POPULATION_STARVED, (payload) => {
    UIManager.updateUI();
    ToastManager.show(`⚠️ 飢荒警告！由於糧食不足，${payload.starvedAmount} 名人口流失了！`);
  }, 'ui');
  EventBus.getInstance().subscribe(GameEventType.THREAT_WARNING, (payload) => {
    ToastManager.show(`⚠️ ${payload.threatName} 將在 ${payload.daysRemaining} 天後抵達，請預留糧食！`, 'warning');
    UIManager.updateUI();
  }, 'ui');
  EventBus.getInstance().subscribe(GameEventType.GAME_EVENT_TRIGGERED, ({ eventId }) => {
    const event = GAME_EVENTS.find(candidate => candidate.id === eventId);
    if (event) {
      if ((window as any).isAdvancingDay) {
        if (!(window as any).eventQueue) (window as any).eventQueue = [];
        (window as any).eventQueue.push(() => openEventModal(event));
      } else {
        openEventModal(event);
      }
    }
  }, 'ui');
  EventBus.getInstance().subscribe(GameEventType.MISSIONS_CHANGED, () => {
    renderMap();
    UIManager.updateUI();
    refreshExplorationUI();
  }, 'ui');
  EventBus.getInstance().subscribe(GameEventType.ROAD_CHANGED, ({ reason, targetNodeId }) => {
    renderMap();
    refreshExplorationUI();
    if (reason === 'COMPLETED') {
      const target = GameState.mapSystem?.getNodeById(targetNodeId);
      ToastManager.show(`通往 ${target?.name ?? '目的地'} 的道路已完工。`, 'success');
    }
  }, 'ui');
}

// 重新開局或載入存檔時手動呼叫的畫面刷新邏輯
export function refreshGlobalUI() {
  refreshExplorationUI();
  CombatUIManager.init();
  UIManager.updateUI();
}

// ── 主入口：先載入所有 HTML template，再初始化遊戲 ──
async function bootstrap() {
  // 1. 載入所有 HTML 片段到 #template-root
  await loadAllTemplates();

  // 2. 重新初始化 UIManager 的 DOM 引用（template 注入後才查詢）
  UIManager.reinitDOM();

  // 3. 初始化日誌攔截（DOM 已就緒後才能取得 #game-log）
  const logContainer = document.getElementById('game-log');
  if (logContainer) {
    initLogger(logContainer);
  }

  // 4. 初始化遊戲資料與全域事件監聽
  initGameState();
  initGlobalUIEvents();

  // 5. 初始化地圖互動事件
  initMapInteraction();

  // 6. 初始化各個 UI Controller
  initMainMenuController();
  initGameFlowController();
  initFacilityController();
  initActionController();
  initRecruitController();
  initCheatController();
  initExplorationController();
  initStreetScroller();
  
  refreshGlobalUI();
}


bootstrap().catch(err => {
  console.error('[main] 遊戲啟動失敗：', err);
  document.body.innerHTML = `<div style="color:red;padding:40px;font-size:1.2em;">
    ⚠️ 遊戲初始化失敗，請重新整理頁面。<br><small>${err?.message ?? err}</small>
  </div>`;
});
