import { GameState } from '../core/GameState';
import { TerrainType, NodeFeature, MapNode } from '../models/types';
import { enterScene } from './SceneController';
import { UIManager } from './UIManager';
import { openRadialMenu, closeRadialMenu, openNodeDetailPanel, closeNodeDetailPanel } from './ModalController';

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

export function renderMap() {
  const container = document.getElementById('map-nodes-container')!;
  container.innerHTML = '';
  
  GameState.mapSystem.getNodes().forEach(node => {
    const el = document.createElement('div');
    el.className = 'map-node';
    el.style.left = `${node.x}%`;
    el.style.top = `${node.y}%`;
    
    let borderColor = '#555';
    let bgColor = 'rgba(0, 0, 0, 0.4)';
    let boxShadow = '0 0 5px rgba(0,0,0,0.5)';
    
    if (node.isPlayerBase) {
      borderColor = '#ffd700';
      bgColor = 'rgba(255, 215, 0, 0.3)';
      boxShadow = '0 0 15px rgba(255, 215, 0, 0.8)';
      el.style.zIndex = '50';
    } else if (node.ownerFactionId) {
      const f = GameState.mapSystem.getFactions().find(fac => fac.id === node.ownerFactionId);
      if (f) {
        borderColor = f.color;
        bgColor = 'rgba(0, 0, 0, 0.6)';
        boxShadow = `0 0 8px ${f.color}88`;
      }
    } else {
      if (node.feature === NodeFeature.MONSTER_NEST) {
        borderColor = '#dc2626';
        bgColor = 'rgba(69, 10, 10, 0.6)';
        boxShadow = '0 0 8px rgba(220, 38, 38, 0.5)';
      } else if (node.feature === NodeFeature.SUBJUGATION) {
        borderColor = '#6b7280';
        bgColor = 'rgba(31, 41, 55, 0.6)';
      } else {
        borderColor = '#444';
        bgColor = 'transparent';
        el.style.borderStyle = 'dashed';
        boxShadow = 'none';
      }
    }

    el.style.backgroundColor = bgColor;
    el.style.borderColor = borderColor;
    el.style.boxShadow = boxShadow;

    const label = document.createElement('div');
    label.className = 'node-label';
    
    // 依據是否偵查顯示不同精簡資訊
    let labelText = `${getTerrainEmoji(node.terrain)} ${node.name}`;
    if (node.isPlayerBase) {
      labelText += '\n[我的據點]';
    } else if (node.ownerFactionId) {
      const f = GameState.mapSystem.getFactions().find(fac => fac.id === node.ownerFactionId);
      labelText += `\n[${f ? f.factionName : '未知'}]`;
    } else {
      labelText += '\n[無主之地]';
    }
    
    if (!node.isScouted && !node.isPlayerBase) {
      labelText += '\n(未偵查)';
    } else if (node.scoutData) {
      labelText += `\n危險度: ${node.scoutData.dangerLevel}`;
    }
    
    label.textContent = labelText;
    el.appendChild(label);

    el.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止點擊空白處的事件觸發
      if (hasMapDragged) return; // 防止拖曳時誤觸發點擊

      if (isStartupMode) {
        if (node.feature === NodeFeature.OCCUPIABLE) {
          openNodeSelectModal(node);
        } else {
          console.log('[系統] 這裡太危險了，不適合建立初始據點！');
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
}

export let isStartupMode = false;

export function setStartupMode(mode: boolean) {
  isStartupMode = mode;
  const banner = document.getElementById('startup-banner');
  if (banner) {
    banner.style.display = mode ? 'block' : 'none';
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
