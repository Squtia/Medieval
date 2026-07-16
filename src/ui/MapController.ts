import { GameState } from '../core/GameState';
import { TerrainType, NodeFeature, MapNode } from '../models/types';
import { enterScene } from './SceneController';
import { UIManager } from './UIManager';
import { openRadialMenu, closeRadialMenu } from './ModalController';

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
    label.textContent = node.name + (node.isPlayerBase ? ' (據點)' : '');
    el.appendChild(label);

    el.addEventListener('click', (e) => {
      e.stopPropagation(); // 防止點擊空白處的事件觸發
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
          openRadialMenu(node, el);
        }
      }
    });
    container.appendChild(el);
  });

  // 點擊地圖空白處關閉選單
  container.addEventListener('click', () => {
    closeRadialMenu();
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
