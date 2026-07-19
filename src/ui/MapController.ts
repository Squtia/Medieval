import { ToastManager } from './ToastManager';
import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { TerrainType, NodeFeature, MapNode, NodeLevel, getMaxCaravansLimit } from '../models/types';
import { enterScene } from './SceneController';
import { UIManager } from './UIManager';
import { openRadialMenu, closeRadialMenu, openNodeDetailPanel, closeNodeDetailPanel, openTradePlanner } from './ModalController';
import { TaskType } from '../models/DispatchTask';
import { MapScene } from './MapScene';

export function getTerrainEmoji(terrain: TerrainType): string {
  switch(terrain) {
    case TerrainType.FOREST: return '🌲';
    case TerrainType.SNOW_MOUNTAIN: return '🏔️';
    case TerrainType.VOLCANO: return '🌋';
    case TerrainType.DESERT: return '🏜️';
    case TerrainType.PLAINS: return '🌾';
    default: return '📍';
  }
}

export function getNodeIcon(node: MapNode): string {
  if (node.isPlayerBase) return '🏰';
  if (node.feature === NodeFeature.MONSTER_NEST) return '👹';
  if (node.feature === NodeFeature.SUBJUGATION) return '🏚️';
  
  if (node.nodeLevel === NodeLevel.CAPITAL) return '🏰';
  if (node.nodeLevel === NodeLevel.TOWN) return '🏘️';
  if (node.nodeLevel === NodeLevel.VILLAGE) return '🏡';
  if (node.nodeLevel === NodeLevel.CAMP) return '⛺';
  
  return getTerrainEmoji(node.terrain);
}

export let phaserGame: Phaser.Game | null = null;

export function initPhaserMap(parentId: string) {
  if (phaserGame) return;
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: '100%',
    height: '100%',
    parent: parentId,
    transparent: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER
    },
    scene: [MapScene]
  };
  phaserGame = new Phaser.Game(config);
}

// 監聽 Phaser 節點點擊事件
document.addEventListener('phaser-node-clicked', (e: any) => {
  const node = e.detail.node;
  handlePhaserNodeClick(node);
});

function handlePhaserNodeClick(node: MapNode) {
  if (isStartupMode) {
    if (node.feature === NodeFeature.OCCUPIABLE) {
      openNodeSelectModal(node);
    } else {
      console.log('[系統] 這裡太危險了，不適合建立初始據點！');
    }
  } else if (isRoutePlanningMode) {
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
    if (node.isPlayerBase) {
      enterScene(node);
    } else {
      openNodeDetailPanel(node);
    }
  }
}

export function renderMap() {
  if (phaserGame) {
    const scene = phaserGame.scene.getScene('MapScene') as MapScene;
    if (scene && scene.sys.isActive()) {
      scene.rebuildNodes();
      scene.updateRoutesAndCaravans();
    }
  }
}

export function renderTradeRoutes() {
  if (phaserGame) {
    const scene = phaserGame.scene.getScene('MapScene') as MapScene;
    if (scene && scene.sys.isActive()) {
      scene.updateRoutesAndCaravans();
    }
  }
}

export let isStartupMode = false;

export function setStartupMode(mode: boolean) {
  isStartupMode = mode;
  const banner = document.getElementById('startup-banner');
  if (banner) {
    banner.style.display = mode ? 'block' : 'none';
  }
}

// 掛載至全域以打破與 UIManager 的循環依賴，保障編譯與部署流暢
(window as any).renderTradeRoutes = renderTradeRoutes;

export let isRoutePlanningMode = false;
export let plannedRouteNodeIds: string[] = [];

export function startRoutePlanning(startNode?: MapNode) {
  const activeCaravansCount = GameState.system.getActiveMissions().filter(m => m.task.type === TaskType.TRADE).length;
  const maxAllowed = getMaxCaravansLimit(GameState.myTerritory.title);
  if (activeCaravansCount >= maxAllowed) {
    ToastManager.show(`行商序列已達上限！當前爵位【${GameState.myTerritory.title}】最多同時派遣 ${maxAllowed} 個商隊。`);
    return;
  }

  if (startNode) {
    const playerNode = GameState.mapSystem.getNodes().find(n => n.isPlayerBase);
    if (playerNode) {
      const dist = Math.sqrt(Math.pow(playerNode.x - startNode.x, 2) + Math.pow(playerNode.y - startNode.y, 2));
      const maxDist = 30;
      if (dist > maxDist) {
        ToastManager.show(`⚠️ 無法從此城市開始行商！該城市距離本鎮太遠 (${dist.toFixed(1)} 里)，第一個停靠站距離不能超過 ${maxDist} 里。`);
        return;
      }
    }
  }

  isRoutePlanningMode = true;
  plannedRouteNodeIds = startNode ? [startNode.id] : [];
  const hud = document.getElementById('route-planning-hud')!;
  hud.style.display = 'block';
  updateRoutePlanningHUD();

  const btnFinish = document.getElementById('btn-finish-route')!;
  const btnCancel = document.getElementById('btn-cancel-route')!;
  
  const finishClone = btnFinish.cloneNode(true) as HTMLButtonElement;
  btnFinish.parentNode!.replaceChild(finishClone, btnFinish);
  finishClone.addEventListener('click', () => {
    if (plannedRouteNodeIds.length === 0) {
      ToastManager.show('請至少在地圖上點選 1 個城市作為商隊中途站！');
      return;
    }
    isRoutePlanningMode = false;
    hud.style.display = 'none';
    openTradePlanner([...plannedRouteNodeIds]);
  });

  const cancelClone = btnCancel.cloneNode(true) as HTMLButtonElement;
  btnCancel.parentNode!.replaceChild(cancelClone, btnCancel);
  cancelClone.addEventListener('click', () => {
    isRoutePlanningMode = false;
    hud.style.display = 'none';
  });
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

export function openNodeSelectModal(node: MapNode) {
  const modal = document.getElementById('modal-node-select')!;
  document.getElementById('node-select-name')!.textContent = node.name;
  document.getElementById('node-select-terrain')!.textContent = `📍 地形：${getTerrainEmoji(node.terrain)} | 規模：${node.nodeLevel}`;
  document.getElementById('node-select-desc')!.textContent = node.description;

  const factionBox = document.getElementById('node-select-faction-box')!;
  if (node.ownerFactionId) {
    factionBox.style.display = 'block';
    const factionData = GameState.mapSystem.getFactions().find(f => f.id === node.ownerFactionId);
    if (factionData) {
      document.getElementById('node-select-faction-name')!.textContent = `👑 隸屬：${factionData.factionName}`;
      document.getElementById('node-select-faction-desc')!.textContent = factionData.description;
    }
  } else {
    factionBox.style.display = 'none';
  }

  const btnConfirm = document.getElementById('btn-confirm-node')!;
  
  const newBtn = btnConfirm.cloneNode(true) as HTMLButtonElement;
  btnConfirm.parentNode!.replaceChild(newBtn, btnConfirm);
  
  newBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    
    GameState.myTerritory.currentCountryId = node.id;
    node.isPlayerBase = true;
    setStartupMode(false);
    
    console.log(`⚔️ 遊戲啟動：您選擇了在「${node.name}」建立初始據點。`);
    document.getElementById('top-bar')!.style.display = 'flex';
    
    renderMap();
    UIManager.updateUI();

    document.dispatchEvent(new Event('game-started'));
  });

  const btnClose = document.getElementById('btn-close-node-select')!;
  btnClose.addEventListener('click', () => modal.classList.remove('active'), { once: true });

  modal.classList.add('active');
}

export let hasMapDragged = false;

export function initMapInteraction() {
  // 由於改由 Phaser 處理相機，此處改為空實作
}

