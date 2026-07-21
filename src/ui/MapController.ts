import { ToastManager } from './ToastManager';
import Phaser from 'phaser';
import { GameState } from '../core/GameState';
import { TerrainType, NodeFeature, MapNode, NodeLevel, getMaxCaravansLimit } from '../models/types';
import { enterScene } from './SceneController';
import { UIManager } from './UIManager';
import { openRadialMenu, closeRadialMenu, openNodeDetailPanel, closeNodeDetailPanel, openTradePlanner } from './ModalController';
import { TaskType } from '../models/DispatchTask';
import { MapScene } from './MapScene';
import { getTerrainEmoji } from './MapPresentation';
export { getTerrainEmoji, getNodeIcon } from './MapPresentation';

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
  renderAccessibleMapNodes();
}

function renderAccessibleMapNodes() {
  const container = document.getElementById('map-accessible-node-list');
  if (!container || !GameState.mapSystem) return;
  container.innerHTML = '';
  GameState.mapSystem.getNodes().forEach(node => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-btn';
    button.textContent = `${getTerrainEmoji(node.terrain)} ${node.name}`;
    button.addEventListener('click', () => handlePhaserNodeClick(node));
    container.appendChild(button);
  });
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
    banner.style.display = mode ? 'flex' : 'none';
  }
}

export function hideMapTooltip() {
  const tooltip = document.getElementById('map-tooltip');
  if (tooltip) tooltip.style.opacity = '0';
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
  hideMapTooltip();
  const modal = document.getElementById('modal-node-select')!;
  document.getElementById('node-select-name')!.textContent = node.name;
  document.getElementById('node-select-terrain')!.textContent = `📍 地形：${getTerrainEmoji(node.terrain)} | 規模：${node.nodeLevel}`;
  document.getElementById('node-select-desc')!.textContent = node.description;

  // 1. 判斷難易度與起始資源說明
  let difficulty = '普通';
  let diffColor = '#ebdcb6';
  let diffDesc = '';
  
  if (node.nodeLevel === NodeLevel.CAPITAL) {
    difficulty = '簡單 (CAPITAL)';
    diffColor = '#10b981'; // 綠色
    diffDesc = '起始資金非常充裕，物資雄厚，擁有較多的初始勞動人口。\n💰3000金幣 | 👤5人口 | 🌾300糧食 | 🪵80木材 | 🪨50石材 | 🔗10鐵礦';
  } else if (node.nodeLevel === NodeLevel.TOWN) {
    difficulty = '普通 (TOWN)';
    diffColor = '#3b82f6'; // 藍色
    diffDesc = '標準開局。初始資源平衡，適合大多數玩家。\n💰1500金幣 | 👤3人口 | 🌾150糧食 | 🪵40木材 | 🪨20石材 | 🔗2鐵礦';
  } else if (node.nodeLevel === NodeLevel.VILLAGE || node.nodeLevel === NodeLevel.CAMP) {
    difficulty = '困難 (VILLAGE / CAMP)';
    diffColor = '#f59e0b'; // 橘黃色
    diffDesc = '初始資源緊繃，發展阻力較大，極具考驗。\n💰800金幣 | 👤2人口 | 🌾80糧食 | 🪵20木材 | 🪨10石材 | 🔗0鐵礦';
  } else { // WILDERNESS
    difficulty = '極難 (WILDERNESS)';
    diffColor = '#ef4444'; // 紅色
    diffDesc = '流放開局！一窮二白，資源近乎枯竭，需要在荒野中艱難求生。\n💰400金幣 | 👤1人口 | 🌾40糧食 | 🪵10木材 | 🪨5石材 | 🔗0鐵礦';
  }

  const diffLvlEl = document.getElementById('node-select-difficulty-level')!;
  const diffDescEl = document.getElementById('node-select-difficulty-desc')!;
  diffLvlEl.textContent = difficulty;
  diffLvlEl.style.color = diffColor;
  diffDescEl.textContent = diffDesc;
  diffDescEl.style.whiteSpace = 'pre-line';

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
    
    // 2. 根據據點難易度初始化起始資源
    const territory = GameState.myTerritory;
    if (node.nodeLevel === NodeLevel.CAPITAL) {
      territory.gold = 3000;
      territory.population = 5;
      territory.food = 300;
      territory.wood = 80;
      territory.stone = 50;
      territory.iron = 10;
    } else if (node.nodeLevel === NodeLevel.TOWN) {
      territory.gold = 1500;
      territory.population = 3;
      territory.food = 150;
      territory.wood = 40;
      territory.stone = 20;
      territory.iron = 2;
    } else if (node.nodeLevel === NodeLevel.VILLAGE || node.nodeLevel === NodeLevel.CAMP) {
      territory.gold = 800;
      territory.population = 2;
      territory.food = 80;
      territory.wood = 20;
      territory.stone = 10;
      territory.iron = 0;
    } else { // WILDERNESS
      territory.gold = 400;
      territory.population = 1;
      territory.food = 40;
      territory.wood = 10;
      territory.stone = 5;
      territory.iron = 0;
    }
    
    // 重置未指派流民與各工種的人數
    territory.workers = {
      'UNASSIGNED': territory.population,
      'FARMER': 0,
      'WOODCUTTER': 0,
      'MINER': 0
    };

    GameState.myTerritory.currentCountryId = node.id;
    node.isPlayerBase = true;
    const actualNode = GameState.mapSystem.getNodes().find(n => n.id === node.id);
    if (actualNode) {
      actualNode.isPlayerBase = true;
    }
    setStartupMode(false);
    
    console.log(`⚔️ 遊戲啟動：您選擇了在「${node.name}」以【${difficulty}】難度建立初始據點！`);
    document.getElementById('top-bar')!.style.display = 'flex';
    
    renderMap();
    
    // 開局即自動進入城鎮街景視圖，避免新玩家卡在世界地圖造成無法進入遊戲的疑惑
    enterScene(node);
    
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
