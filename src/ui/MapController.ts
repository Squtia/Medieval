import { ToastManager } from './ToastManager';
import { GameState } from '../core/GameState';
import { TerrainType, MapNode, getMaxCaravansLimit } from '../models/types';
import { enterSceneWithTransition } from './SceneController';
import { openNodeDetailPanel, closeNodeDetailPanel, openTradePlanner } from './ModalController';
import { TaskType } from '../models/DispatchTask';
import { getTerrainEmoji } from './MapPresentation';
export { getTerrainEmoji, getNodeIcon } from './MapPresentation';

let phaserManagerModule: typeof import('./PhaserManager') | null = null;

export async function getPhaserManager() {
  if (!phaserManagerModule) {
    phaserManagerModule = await import('./PhaserManager');
  }
  return phaserManagerModule;
}

export async function ensurePhaserLoaded() {
  const pm = await getPhaserManager();
  pm.initPhaserMap('map-nodes-container');
  return pm;
}

export async function initPhaserMap(parentId: string) {
  const pm = await getPhaserManager();
  pm.initPhaserMap(parentId);
}

// 監聽 Phaser 節點點擊事件
if (typeof document !== 'undefined') {
  document.addEventListener('phaser-node-clicked', (e: any) => {
    const node = e.detail.node;
    handlePhaserNodeClick(node);
  });
}

function handlePhaserNodeClick(node: MapNode, clientX?: number, clientY?: number) {
  if (isRoutePlanningMode) {
    if (!plannedRouteNodeIds.includes(node.id) && plannedRouteNodeIds.length < 3) {
      if (plannedRouteNodeIds.length === 0) {
        const playerNode = GameState.mapSystem.getNodes().find(n => n.isPlayerBase);
        if (playerNode) {
          const dist = Math.sqrt(Math.pow(playerNode.x - node.x, 2) + Math.pow(playerNode.y - node.y, 2));
          const maxDist = 30;
          if (dist > maxDist) {
            ToastManager.show(`⚠️ 行商起點太遠了！第一個停靠站距離本鎮不能超過 ${maxDist} 里 (當前距離: ${dist.toFixed(1)} 里)。`);
            return;
          }
        }
      }
      plannedRouteNodeIds.push(node.id);
      updateRoutePlanningHUD();
      renderTradeRoutes();
    } else if (plannedRouteNodeIds.includes(node.id)) {
      console.log('[系統] 已經選擇過這個節點了！');
    } else {
      console.log('[系統] 最多只能選擇 3 個中途站！');
    }
  } else {
    document.dispatchEvent(new CustomEvent('cancel-exploration-selection'));
    if (node.isPlayerBase) {
      enterSceneWithTransition(node);
    } else {
      openNodeDetailPanel(node);
    }
  }
}

export function renderMap() {
  if (phaserManagerModule) {
    phaserManagerModule.renderMap();
  }
  renderAccessibleMapNodes();
}

function renderAccessibleMapNodes() {
  const container = document.getElementById('map-accessible-node-list');
  if (!container || !GameState.mapSystem) return;
  container.innerHTML = '';
  GameState.mapSystem.getNodes()
    .filter(node => node.isPlayerBase || node.isDiscovered)
    .forEach(node => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-btn';
    button.textContent = `${getTerrainEmoji(node.terrain)} ${node.name}`;
    button.addEventListener('click', () => handlePhaserNodeClick(node));
      container.appendChild(button);
    });
}

export function renderTradeRoutes() {
  if (phaserManagerModule) {
    phaserManagerModule.renderTradeRoutes();
  }
}

export let isStartupMode = false;

export function setStartupMode(mode: boolean) {
  isStartupMode = mode;
  const banner = document.getElementById('startup-banner');
  if (banner) {
    banner.style.display = mode ? 'flex' : 'none';
  }
}

export function hideMapTooltip() {
  const tooltip = document.getElementById('map-tooltip');
  if (tooltip) tooltip.style.opacity = '0';
}

// 掛載至全域以打破與 UIManager 的循環依賴，保障編譯與部署流暢
if (typeof window !== 'undefined') {
  (window as any).renderTradeRoutes = renderTradeRoutes;
}

export let isRoutePlanningMode = false;
export let plannedRouteNodeIds: string[] = [];

export function startRoutePlanning(startNode?: MapNode) {
  document.dispatchEvent(new CustomEvent('cancel-exploration-selection'));
  const activeCaravansCount = GameState.system.getActiveMissions().filter(m => m.task.type === TaskType.TRADE).length;
  const maxAllowed = getMaxCaravansLimit(GameState.myTerritory.title);
  if (activeCaravansCount >= maxAllowed) {
    ToastManager.show(`行商序列已達上限！當前爵位【${GameState.myTerritory.title}】最多同時派遣 ${maxAllowed} 個商隊。`);
    return;
  }

  if (startNode) {
    openTradePlanner([startNode.id]);
  } else {
    ToastManager.show('請先在地圖上點選已建交的城鎮以發起商隊。');
  }
}


function updateRoutePlanningHUD() {
  const mapSystem = GameState.mapSystem;
  if (plannedRouteNodeIds.length === 0) {
    document.getElementById('route-planning-status')!.textContent = '請點擊地圖上的城市加入路線（最多 3 個）';
  } else {
    const names = plannedRouteNodeIds
      .map((id, i) => {
        const node = mapSystem?.getNodeById(id);
        return `${i + 1}. ${node?.name ?? id}`;
      })
      .join(' ➔ ');
    document.getElementById('route-planning-status')!.textContent = `已選擇 ${plannedRouteNodeIds.length}/3：${names}`;
  }
}

export let hasMapDragged = false;

export function initMapInteraction() {
  // 由於改由 Phaser 處理相機，此處改為空實作
}
