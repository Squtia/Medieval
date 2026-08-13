import { ToastManager } from './ToastManager';
import { refreshGlobalUI } from '../main';
import { GameState, initGameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import { UIManager } from './UIManager';
import { setStartupMode, renderMap, ensurePhaserLoaded } from './MapController';
import { clearGameLog } from '../utils/Logger';
import { enterScene } from './SceneController';
import { startGameLoop } from '../core/GameLoop';
import { DIFFICULTY_ORDER, getDifficultyConfig } from '../data/DifficultyData';
import { GameDifficulty } from '../models/WorldGeneration';
import { NodeLevel } from '../models/types';

function createWorldSeed(): string {
  const randomPart = typeof crypto !== 'undefined' && 'getRandomValues' in crypto
    ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
    : Math.floor(Math.random() * 0xffffffff).toString(36);
  return `${Date.now().toString(36)}-${randomPart}`;
}

function getNodeLevelLabel(level: NodeLevel): string {
  switch (level) {
    case NodeLevel.CAPITAL: return '首都';
    case NodeLevel.TOWN: return '城鎮';
    case NodeLevel.VILLAGE: return '村莊';
    case NodeLevel.CAMP: return '營地';
    case NodeLevel.WILDERNESS: return '荒野';
  }
}

function openNewGameSetup(slot: number): void {
  const modal = document.getElementById('modal-new-game');
  const loadModal = document.getElementById('modal-load-game');
  const difficultyList = document.getElementById('new-game-difficulty-list');
  const difficultyTitle = document.getElementById('new-game-difficulty-title');
  const difficultyDesc = document.getElementById('new-game-difficulty-desc');
  const resources = document.getElementById('new-game-resources');
  const seedInput = document.getElementById('new-game-seed') as HTMLInputElement | null;
  const confirmButton = document.getElementById('btn-confirm-new-game') as HTMLButtonElement | null;
  const closeButton = document.getElementById('btn-close-new-game') as HTMLButtonElement | null;
  const randomizeButton = document.getElementById('btn-randomize-seed') as HTMLButtonElement | null;

  if (
    !modal || !loadModal || !difficultyList || !difficultyTitle || !difficultyDesc ||
    !resources || !seedInput || !confirmButton || !closeButton || !randomizeButton
  ) return;

  let selectedDifficulty = GameDifficulty.NORMAL;
  seedInput.value = createWorldSeed();
  difficultyList.innerHTML = '';

  const renderDifficulty = () => {
    const config = getDifficultyConfig(selectedDifficulty);
    difficultyTitle.textContent = `${config.label}｜${config.baseNodeLevels.map(getNodeLevelLabel).join('／')}`;
    difficultyTitle.style.color = config.color;
    difficultyDesc.textContent = config.description;
    const start = config.startingResources;
    resources.textContent =
      `爵位：${config.startingTitle}｜金幣 ${start.gold}｜人口 ${start.population}｜` +
      `糧食 ${start.food}｜木材 ${start.wood}｜石材 ${start.stone}｜鐵礦 ${start.iron}`;

    difficultyList.querySelectorAll<HTMLButtonElement>('button[data-difficulty]').forEach(button => {
      const active = button.dataset.difficulty === selectedDifficulty;
      button.style.background = active ? 'rgba(234,179,8,0.22)' : 'rgba(255,255,255,0.06)';
      button.style.borderColor = active ? '#eab308' : 'rgba(255,255,255,0.16)';
      button.setAttribute('aria-pressed', String(active));
    });
  };

  DIFFICULTY_ORDER.forEach(difficulty => {
    const config = getDifficultyConfig(difficulty);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-btn';
    button.dataset.difficulty = difficulty;
    button.style.padding = '12px';
    button.innerHTML =
      `<strong style="color:${config.color}">${config.label}</strong><br>` +
      `<span style="font-size:0.8em;color:#94a3b8">${config.baseNodeLevels.map(getNodeLevelLabel).join('／')}開局</span>`;
    button.addEventListener('click', () => {
      selectedDifficulty = difficulty;
      renderDifficulty();
    });
    difficultyList.appendChild(button);
  });

  renderDifficulty();
  loadModal.classList.remove('active');
  modal.classList.add('active');

  randomizeButton.onclick = () => {
    seedInput.value = createWorldSeed();
  };
  closeButton.onclick = () => {
    modal.classList.remove('active');
    loadModal.classList.add('active');
  };
  confirmButton.onclick = async () => {
    const seed = seedInput.value.trim();
    if (!seed) {
      ToastManager.show('請輸入世界種子，或按下「隨機」產生一組種子。', 'warning');
      seedInput.focus();
      return;
    }

    confirmButton.disabled = true;
    ToastManager.show('🗺️ 正在生成新的大陸配置...', 'info');
    try {
      clearGameLog();
      initGameState({ difficulty: selectedDifficulty, seed });
      refreshGlobalUI();
      GameState.currentSaveSlot = slot;
      await ensurePhaserLoaded();

      const mainMenu = document.getElementById('main-menu-view');
      const mapView = document.getElementById('map-view');
      const topBar = document.getElementById('top-bar');
      const playerBase = GameState.mapSystem.getNodes().find(node => node.isPlayerBase);
      if (!mainMenu || !mapView || !topBar || !playerBase) {
        throw new Error('New game UI could not find the generated player base.');
      }

      modal.classList.remove('active');
      setStartupMode(false);
      UIManager.playTransition(() => {
        mainMenu.classList.remove('active');
        mapView.classList.add('active');
        topBar.style.display = 'flex';
        renderMap();
        enterScene(playerBase);
        UIManager.updateUI();
        SaveManager.saveGame(slot);
        document.dispatchEvent(new Event('game-started'));
      });
    } catch (error) {
      console.error(error);
      ToastManager.show('世界生成失敗，請更換種子後再試一次。', 'error');
    } finally {
      confirmButton.disabled = false;
    }
  };
}

export function renderSaveSlots(): void {
  const container = document.getElementById('save-slots-container');
  const modalTitle = document.getElementById('modal-save-title');
  const mainMenu = document.getElementById('main-menu-view');
  const mapView = document.getElementById('map-view');
  const topBar = document.getElementById('top-bar');

  if (!container || !modalTitle || !mainMenu || !mapView || !topBar) return;

  container.innerHTML = '';
  modalTitle.textContent = '選擇旅程';
  
  const slots = SaveManager.getSaveSlots();

  slots.forEach(s => {
    const btnWrapper = document.createElement('div');
    btnWrapper.style.display = 'flex';
    btnWrapper.style.gap = '10px';
    btnWrapper.style.alignItems = 'stretch';
    btnWrapper.style.width = '100%';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', s.isEmpty ? `在欄位 ${s.slot} 建立新旅程` : `載入欄位 ${s.slot}：${s.territoryName}`);
    btn.className = 'glass-panel';
    btn.style.padding = '15px';
    btn.style.cursor = 'pointer';
    btn.style.display = 'flex';
    btn.style.justifyContent = 'space-between';
    btn.style.alignItems = 'center';
    btn.style.flex = '1';
    btn.style.textAlign = 'left';

    if (s.isEmpty) {
      btn.innerHTML = `<span style="color:#94a3b8;">欄位 ${s.slot} - 尚無紀錄</span>`;
    } else {
      const dateStr = new Date(s.timestamp!).toLocaleString();
      const timeStr = SaveManager.formatPlayTime(s.playTime!);
      btn.innerHTML = `
        <div>
          <strong style="color:#eab308; font-size:1.1em;">${s.territoryName}</strong> (爵位: ${s.title})<br/>
          <span style="font-size:0.85em; color:#cbd5e1;">存檔時間: ${dateStr}</span>
        </div>
        <div style="text-align: right; font-size: 0.9em; color:#94a3b8;">
          金幣: <span style="color:#fbbf24;">${s.gold}</span><br/>
          遊玩時長: ${timeStr}
        </div>
      `;
    }

    btn.addEventListener('click', async () => {
      if (s.isEmpty) {
        openNewGameSetup(s.slot);
      } else {
        if (confirm(`確定要進入欄位 ${s.slot} 的旅程嗎？`)) {
          document.getElementById('modal-load-game')?.classList.remove('active');
          clearGameLog(); // 清除日誌，確保讀取的存檔從空白開始
          ToastManager.show('🗺️ 正在加載地圖與遊戲資源...', 'info');
          await ensurePhaserLoaded();
          if (SaveManager.loadGame(s.slot)) {
            setStartupMode(false);
            refreshGlobalUI();
            UIManager.playTransition(() => {
              mainMenu.classList.remove('active');
              topBar.style.display = 'flex';
              
              if (GameState.currentViewNode) {
                enterScene(GameState.currentViewNode);
              } else {
                mapView.classList.add('active');
                renderMap();
              }
              
              UIManager.updateUI();
              startGameLoop(() => UIManager.updateUI());
            });
          }
        }
      }
    });

    btnWrapper.appendChild(btn);

    if (!s.isEmpty) {
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'action-btn';
      deleteBtn.style.padding = '0 15px';
      deleteBtn.style.background = 'rgba(220, 38, 38, 0.2)';
      deleteBtn.style.borderColor = 'rgba(220, 38, 38, 0.5)';
      deleteBtn.style.color = '#fca5a5';
      deleteBtn.style.width = 'auto';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = '刪除存檔';
      
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`確定要刪除欄位 ${s.slot} 的存檔嗎？此動作無法復原！`)) {
          SaveManager.deleteGame(s.slot);
          renderSaveSlots();
        }
      });
      btnWrapper.appendChild(deleteBtn);
    }

    container.appendChild(btnWrapper);
  });
}

export function initMainMenuController(): void {
  const btnEnterJourney = document.getElementById('btn-enter-journey');
  const btnCloseLoadGame = document.getElementById('btn-close-load-game');
  const modalLoadGame = document.getElementById('modal-load-game');

  if (btnEnterJourney && modalLoadGame) {
    btnEnterJourney.addEventListener('click', () => {
      renderSaveSlots();
      modalLoadGame.classList.add('active');
    });
  }

  if (btnCloseLoadGame && modalLoadGame) {
    btnCloseLoadGame.addEventListener('click', () => {
      modalLoadGame.classList.remove('active');
    });
  }
}
