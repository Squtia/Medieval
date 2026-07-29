import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { TaskType } from '../models/DispatchTask';
import { AdventurerState } from '../models/types';
import { isRoutePlanningMode, renderMap } from './MapController';
import { ToastManager } from './ToastManager';

let initialized = false;
let isSelectingTarget = false;

function setSelectingTarget(active: boolean): void {
  isSelectingTarget = active;
  document.dispatchEvent(new CustomEvent('exploration-selection-changed', {
    detail: { active }
  }));
}

export function initExplorationController(): void {
  if (initialized) return;
  initialized = true;

  document.getElementById('btn-toggle-exploration')?.addEventListener('click', () => {
    if (isRoutePlanningMode) {
      ToastManager.show('請先完成或取消商隊路線規劃。', 'warning');
      return;
    }
    const expedition = GameState.explorationSystem?.getActiveExpedition();
    if (expedition) {
      ToastManager.show('目前已有斥候正在探索。', 'warning');
      return;
    }

    if (!GameState.adventurers.some(adventurer => adventurer.currentState === AdventurerState.IDLE)) {
      ToastManager.show('沒有可派遣的待命冒險者。', 'warning');
      return;
    }

    setSelectingTarget(!isSelectingTarget);
    refreshExplorationUI();
    ToastManager.show(
      isSelectingTarget ? '青色區域是本次可探索範圍，請在其中選擇陸地。' : '已取消選擇探索目標。',
      'info'
    );
  });

  document.addEventListener('phaser-map-clicked', handleMapClick as EventListener);
  document.addEventListener('cancel-exploration-selection', () => {
    if (!isSelectingTarget) return;
    setSelectingTarget(false);
    refreshExplorationUI();
  });
  refreshExplorationUI();
}

export function refreshExplorationUI(): void {
  const button = document.getElementById('btn-toggle-exploration') as HTMLButtonElement | null;
  const status = document.getElementById('exploration-status');
  const progressStatus = document.getElementById('world-progress-status');
  if (!button || !status) return;

  const nodes = GameState.mapSystem?.getNodes() ?? [];
  const discoveredNodes = nodes.filter(node => node.isPlayerBase || node.isDiscovered).length;
  const roadCount = GameState.roadSystem?.getRoads().length ?? 0;
  const roadProject = GameState.roadSystem?.getActiveProject();
  if (progressStatus) {
    progressStatus.textContent = roadProject
      ? `已發現據點 ${discoveredNodes}/${nodes.length}｜完成道路 ${roadCount}｜施工 ${roadProject.elapsedDays}/${roadProject.totalDays} 天`
      : `已發現據點 ${discoveredNodes}/${nodes.length}｜完成道路 ${roadCount}`;
  }

  const expedition = GameState.explorationSystem?.getActiveExpedition();
  if (expedition) {
    if (isSelectingTarget) setSelectingTarget(false);
    const explorer = GameState.adventurers.find(adventurer => adventurer.id === expedition.explorerId);
    button.disabled = true;
    button.setAttribute('aria-pressed', 'false');
    button.textContent = '🧭 斥候探索中';
    status.textContent =
      `${explorer?.name ?? '斥候'}：第 ${expedition.elapsedDays}/${expedition.totalDays} 天，` +
      `預計再 ${expedition.totalDays - expedition.elapsedDays} 天抵達。`;
    return;
  }

  button.disabled = false;
  button.setAttribute('aria-pressed', String(isSelectingTarget));
  button.textContent = isSelectingTarget ? '✕ 取消探索選點' : '🧭 派遣斥候';
  status.textContent = isSelectingTarget
    ? '探索模式：青色區域可探索，虛線是本次最遠界線。'
    : '從已知區域邊界選擇探索目標；同一時間只能派出一隊。';
}

function handleMapClick(event: CustomEvent<{ x: number; y: number }>): void {
  if (!isSelectingTarget || !GameState.explorationSystem || !GameState.mapSystem) return;

  const origin = GameState.mapSystem.getNodes().find(node => node.isPlayerBase);
  const explorer = GameState.adventurers.find(
    adventurer => adventurer.currentState === AdventurerState.IDLE
  );
  if (!origin || !explorer) {
    ToastManager.show('找不到據點或可派遣的冒險者。', 'error');
    setSelectingTarget(false);
    refreshExplorationUI();
    return;
  }

  const { x, y } = event.detail;
  const check = GameState.explorationSystem.checkTarget(origin, x, y);
  if (!check.valid || !check.requiredDays) {
    ToastManager.show(check.reason ?? '這個位置不能作為探索目標。', 'warning');
    return;
  }

  const accepted = window.confirm(
    `派遣 ${explorer.name} 前往此處探索？\n` +
    `預計需要 ${check.requiredDays} 天，途中會逐日揭開視野。`
  );
  if (!accepted) return;

  GameState.explorationSystem.startExpedition(origin, explorer.id, x, y);
  explorer.currentState = AdventurerState.DISPATCHED;
  setSelectingTarget(false);

  EventBus.getInstance().publish({
    type: GameEventType.MISSIONS_CHANGED,
    payload: { reason: 'DISPATCHED', missionType: TaskType.EXPLORE }
  });
  renderMap();
  refreshExplorationUI();
  ToastManager.show(`${explorer.name} 已出發探索。`, 'success');
}
