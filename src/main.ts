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
import { NarrativeSystem } from './systems/NarrativeSystem';
import { NpcDialogueModalController } from './ui/modals/NpcDialogueModalController';

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
  EventBus.getInstance().subscribe(GameEventType.NARRATIVE_NODE_TRIGGERED, ({ storyId, nodeId }) => {
    const ref = NarrativeSystem.findNode(storyId, nodeId);
    if (!ref) return;

    // 優先判斷是否含有 NPC 對話分頁或為街道事件
    if (ref.node.dialoguePages && ref.node.dialoguePages.length > 0) {
      const showDialogue = () => {
        NpcDialogueModalController.getInstance().open(ref);
      };
      if ((window as any).isAdvancingDay) {
        if (!(window as any).eventQueue) (window as any).eventQueue = [];
        (window as any).eventQueue.push(showDialogue);
      } else {
        showDialogue();
      }
      return;
    }

    const choices = ref.node.choices.length > 0
      ? ref.node.choices
      : [{ id: 'continue', text: '繼續', effects: [], resultText: '' }];
    const showNode = () => openEventModal({
      title: ref.node.title,
      description: ref.node.description,
      options: choices.map(choice => ({
        text: choice.text,
        onSelect: () => {
          NarrativeSystem.resolveChoice(storyId, nodeId, choice);
          if (choice.resultText) console.log(choice.resultText);
        }
      }))
    });
    if ((window as any).isAdvancingDay) {
      if (!(window as any).eventQueue) (window as any).eventQueue = [];
      (window as any).eventQueue.push(showNode);
    } else {
      showNode();
    }
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
  NarrativeSystem.reloadDefinitions();
  const searchParams = new URLSearchParams(location.search);
  if (searchParams.has('storyTest') || searchParams.has('testStory') || searchParams.has('story')) {
    const { initNarrativeTestController } = await import('./ui/NarrativeTestController');
    await initNarrativeTestController();
    return;
  }
  NarrativeSystem.processDailyTick();
  
  refreshGlobalUI();
}


bootstrap().catch(err => {
  console.error('[main] 遊戲啟動失敗：', err);
  document.body.innerHTML = `<div style="color:#ef4444;background:#18181b;padding:30px;font-family:monospace;border:1px solid #7f1d1d;border-radius:8px;margin:20px;">
    <h3 style="margin-top:0;">⚠️ 遊戲初始化失敗</h3>
    <div style="font-size:1.1em;font-weight:bold;margin-bottom:10px;">${err?.message ?? err}</div>
    <pre style="background:#09090b;padding:15px;border-radius:4px;overflow:auto;color:#fca5a5;font-size:0.85em;line-height:1.4;">${err?.stack ?? '無堆疊資訊'}</pre>
    <button onclick="location.reload()" style="margin-top:15px;padding:8px 16px;background:#ef4444;color:white;border:none;border-radius:4px;cursor:pointer;">重新載入</button>
  </div>`;
});
