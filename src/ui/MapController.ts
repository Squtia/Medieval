import { GameState } from '../core/GameState';
import { TerrainType, NodeFeature, MapNode, NodeLevel, getMaxCaravansLimit } from '../models/types';
import { enterScene } from './SceneController';
import { UIManager } from './UIManager';
import { openRadialMenu, closeRadialMenu, openNodeDetailPanel, closeNodeDetailPanel, openTradePlanner } from './ModalController';
import { TaskType } from '../models/DispatchTask';

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

export function renderMap() {
  const container = document.getElementById('map-nodes-container')!;
  container.innerHTML = '';
  
  GameState.mapSystem.getNodes().forEach(node => {
    const el = document.createElement('div');
    el.className = 'map-node';
    el.style.left = `${node.x}%`;
    el.style.top = `${node.y}%`;
    
    let glowColor = 'rgba(0,0,0,0.8)';
    let zIndex = '10';
    
    if (node.isPlayerBase) {
      glowColor = '#ffd700'; // Gold glow
      zIndex = '50';
    } else if (node.ownerFactionId) {
      const f = GameState.mapSystem.getFactions().find(fac => fac.id === node.ownerFactionId);
      if (f) glowColor = f.color;
      zIndex = '30';
    } else if (node.feature === NodeFeature.MONSTER_NEST) {
      glowColor = '#dc2626'; // Red glow
      zIndex = '20';
    } else if (node.feature === NodeFeature.SUBJUGATION) {
      glowColor = '#6b7280'; // Gray glow
    }
    
    el.style.zIndex = zIndex;

    const icon = document.createElement('div');
    icon.className = 'node-icon';
    icon.textContent = getNodeIcon(node);
    // Apply glowing text shadow to the icon based on faction/type
    icon.style.filter = `drop-shadow(0 0 8px ${glowColor})`;

    const label = document.createElement('div');
    label.className = 'node-label';
    label.textContent = node.name;
    // Apply subtle glow to the label text as well
    label.style.textShadow = `1px 1px 2px #000, 0 0 5px ${glowColor}`;

    el.appendChild(icon);
    el.appendChild(label);

    // 建立懸浮提示 (Tooltip) 資訊
    let tooltipText = `【${node.name}】`;
    if (node.isPlayerBase) {
      tooltipText += '\n我的據點';
    } else if (node.ownerFactionId) {
      const f = GameState.mapSystem.getFactions().find(fac => fac.id === node.ownerFactionId);
      tooltipText += `\n歸屬：${f ? f.factionName : '未知'}`;
    } else {
      tooltipText += '\n無主之地';
    }
    
    const playerNode = GameState.mapSystem.getNodes().find(n => n.isPlayerBase);
    const isSameFaction = playerNode?.ownerFactionId && playerNode.ownerFactionId === node.ownerFactionId;
    
    if (!node.isScouted && !node.isPlayerBase && !isSameFaction) {
      tooltipText += '\n狀態：未偵查';
    } else if (node.scoutData) {
      tooltipText += `\n危險度：${node.scoutData.dangerLevel}`;
    }
    
    // 改為 JS 全域浮層 Tooltip，避免被其他節點的 DOM 覆蓋
    el.dataset.tooltipContent = tooltipText;

    el.addEventListener('mouseenter', (e) => {
      const tooltip = document.getElementById('map-tooltip');
      if (!tooltip) return;
      tooltip.textContent = (e.currentTarget as HTMLElement).dataset.tooltipContent || '';
      tooltip.style.opacity = '1';
    });

    el.addEventListener('mousemove', (e: MouseEvent) => {
      const tooltip = document.getElementById('map-tooltip');
      if (!tooltip) return;
      const padding = 12;
      let x = e.clientX + padding;
      let y = e.clientY - tooltip.offsetHeight - padding;
      // 防止超出右邊
      if (x + tooltip.offsetWidth > window.innerWidth) {
        x = e.clientX - tooltip.offsetWidth - padding;
      }
      // 防止超出上邊
      if (y < 0) {
        y = e.clientY + padding;
      }
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    });

    el.addEventListener('mouseleave', () => {
      const tooltip = document.getElementById('map-tooltip');
      if (!tooltip) return;
      tooltip.style.opacity = '0';
    });

    el.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止點擊空白處的事件觸發
      if (hasMapDragged) return; // 防止拖曳時誤觸發點擊

      if (isStartupMode) {
        if (node.feature === NodeFeature.OCCUPIABLE) {
          openNodeSelectModal(node);
        } else {
          console.log('[系統] 這裡太危險了，不適合建立初始據點！');
        }
      } else if (isRoutePlanningMode) {
        if (!plannedRouteNodeIds.includes(node.id) && plannedRouteNodeIds.length < 3) {
          plannedRouteNodeIds.push(node.id);
          updateRoutePlanningHUD();
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
    });
    container.appendChild(el);
  });

  // 點擊地圖空白處關閉選單與右側詳細面板
  container.addEventListener('click', () => {
    closeRadialMenu();
    closeNodeDetailPanel();
  });

  renderTradeRoutes();
}

function getHashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function renderTradeRoutes() {
  const container = document.getElementById('map-nodes-container');
  if (!container) return;

  // 獲取或創建 SVG 容器
  let svg = document.getElementById('trade-routes-svg') as unknown as SVGElement;
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('id', 'trade-routes-svg');
    svg.setAttribute('style', 'position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5;');
    container.appendChild(svg);
  }
  svg.innerHTML = ''; // 清空舊的線條

  const playerNode = GameState.mapSystem.getNodes().find(n => n.isPlayerBase);
  if (!playerNode) return;

  const activeMissions = GameState.system.getActiveMissions().filter(m => m.task.type === TaskType.TRADE);

  activeMissions.forEach(mission => {
    const routeIds = mission.task.tradeRouteNodeIds || [];
    if (routeIds.length === 0) return;

    // 組裝完整的節點路徑：據點 -> 中途站1 -> 中途站2 -> ... -> 據點
    const nodesPath: MapNode[] = [];
    nodesPath.push(playerNode);
    routeIds.forEach(id => {
      const n = GameState.mapSystem.getNodeById(id);
      if (n) nodesPath.push(n);
    });
    nodesPath.push(playerNode); // 返回據點

    // 繪製路徑
    for (let i = 0; i < nodesPath.length - 1; i++) {
      const startNode = nodesPath[i];
      const endNode = nodesPath[i+1];

      const x1 = startNode.x;
      const y1 = startNode.y;
      const x2 = endNode.x;
      const y2 = endNode.y;

      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      // 使用 Hash 使連線彎曲隨機且完全固定
      const hash = getHashString(startNode.id + endNode.id);
      const offsetMultiplier = 3 + (hash % 5); // 隨機偏離 3% ~ 7%
      const isPositive = (hash % 2 === 0) ? 1 : -1;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      let controlX = midX;
      let controlY = midY;

      if (len > 0) {
        const nx = -dy / len;
        const ny = dx / len;
        controlX = midX + nx * offsetMultiplier * isPositive;
        controlY = midY + ny * offsetMultiplier * isPositive;
      }

      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dAttribute = `M ${x1}% ${y1}% Q ${controlX}% ${controlY}% ${x2}% ${y2}%`;
      pathEl.setAttribute('d', dAttribute);
      pathEl.setAttribute('fill', 'none');
      pathEl.setAttribute('stroke-linecap', 'round');

      // 判斷是否為當前正在前往的線段
      const isCurrentSegment = (mission.task.currentRouteIndex !== undefined && i === mission.task.currentRouteIndex);

      if (isCurrentSegment) {
        pathEl.setAttribute('stroke', '#eab308'); // 亮黃色
        pathEl.setAttribute('stroke-width', '4');
        pathEl.setAttribute('stroke-dasharray', '6, 6');
        pathEl.setAttribute('class', 'trade-route-flow');
        pathEl.setAttribute('filter', 'drop-shadow(0px 0px 6px #eab308)');
      } else {
        pathEl.setAttribute('stroke', 'rgba(148, 163, 184, 0.4)'); // 半透明灰色
        pathEl.setAttribute('stroke-width', '2');
        pathEl.setAttribute('stroke-dasharray', '8, 8');
      }

      svg.appendChild(pathEl);
    }
  });
}

export let isStartupMode = false;

export function setStartupMode(mode: boolean) {
  isStartupMode = mode;
  const banner = document.getElementById('startup-banner');
  if (banner) {
    banner.style.display = mode ? 'block' : 'none';
  }
}

export let isRoutePlanningMode = false;
export let plannedRouteNodeIds: string[] = [];

export function startRoutePlanning(startNode?: MapNode) {
  const activeCaravansCount = GameState.system.getActiveMissions().filter(m => m.task.type === TaskType.TRADE).length;
  const maxAllowed = getMaxCaravansLimit(GameState.myTerritory.title);
  if (activeCaravansCount >= maxAllowed) {
    alert(`行商序列已達上限！當前爵位【${GameState.myTerritory.title}】最多同時派遣 ${maxAllowed} 個商隊。`);
    return;
  }

  isRoutePlanningMode = true;
  // 若有傳入起始節點（從市場規劃路線），預填第一站；否則（從書房建立商隊）讓玩家自由選擇
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
      alert('請至少在地圖上點選 1 個城市作為商隊中途站！');
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
  
  // 先移除舊的 listener 避免重複綁定
  const newBtn = btnConfirm.cloneNode(true) as HTMLButtonElement;
  btnConfirm.parentNode!.replaceChild(newBtn, btnConfirm);
  
  newBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    
    // 初始化據點
    GameState.myTerritory.currentCountryId = node.id;
    node.isPlayerBase = true;
    setStartupMode(false);
    
    console.log(`⚔️ 遊戲啟動：您選擇了在「${node.name}」建立初始據點。`);
    document.getElementById('top-bar')!.style.display = 'flex';
    
    renderMap();
    UIManager.updateUI();

    // 觸發自定義事件通知 main.ts 啟動迴圈
    document.dispatchEvent(new Event('game-started'));
  });

  const btnClose = document.getElementById('btn-close-node-select')!;
  btnClose.addEventListener('click', () => modal.classList.remove('active'), { once: true });

  modal.classList.add('active');
}

// 移除原本的 initStartup

export let hasMapDragged = false;

export function initMapInteraction() {
  const container = document.getElementById('map-nodes-container');
  if (!container) return;
  const wrapper = container.parentElement!;
  
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const updateTransform = () => {
    // 取得容器實際顯示尺寸
    const cw = container.offsetWidth;
    const ch = container.offsetHeight;
    
    // 計算可移動最大距離 (當 scale = 1 時為 0)
    const maxX = (scale - 1) * cw / 2;
    const maxY = (scale - 1) * ch / 2;
    
    // 限制 translateX 與 translateY 在 [-maxX, maxX] 與 [-maxY, maxY] 之間
    translateX = Math.max(-maxX, Math.min(maxX, translateX));
    translateY = Math.max(-maxY, Math.min(maxY, translateY));

    // 套用變形於地圖容器
    container.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    // 同步逆縮放變數，供 .map-node 的 CSS 使用
    container.style.setProperty('--inv-scale', (1 / scale).toString());
  };

  // 滾輪縮放
  wrapper.addEventListener('wheel', (e) => {
    e.preventDefault(); // 避免畫面捲動
    const zoomIntensity = 0.1;
    if (e.deltaY < 0) {
      scale = Math.min(scale + zoomIntensity, 3);
    } else {
      scale = Math.max(scale - zoomIntensity, 1);
    }
    updateTransform();
  });

  // 左鍵拖曳
  wrapper.addEventListener('mousedown', (e) => {
    // 只有左鍵才允許拖曳
    if (e.button !== 0) return;
    
    isDragging = true;
    hasMapDragged = false;
    startX = e.pageX - translateX;
    startY = e.pageY - translateY;
    wrapper.style.cursor = 'grabbing';
  });

  wrapper.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newX = e.pageX - startX;
    const newY = e.pageY - startY;
    
    // 若移動超過 5px，則視為拖曳，避免與點擊事件衝突
    if (Math.abs(newX - translateX) > 5 || Math.abs(newY - translateY) > 5) {
      hasMapDragged = true;
    }
    
    translateX = newX;
    translateY = newY;
    updateTransform();
  });

  const stopDrag = () => {
    isDragging = false;
    wrapper.style.cursor = 'default';
  };

  wrapper.addEventListener('mouseup', stopDrag);
  wrapper.addEventListener('mouseleave', stopDrag);
}
