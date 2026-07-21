import { GameState, initGameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import { UIManager } from './UIManager';
import { setStartupMode, renderMap } from './MapController';
import { clearGameLog } from '../utils/Logger';
import { enterScene } from './SceneController';
import { startGameLoop } from '../core/GameLoop';

export function renderSaveSlots(rebindUIEvents: () => void): void {
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

    btn.addEventListener('click', () => {
      if (s.isEmpty) {
        if (confirm(`確定要在欄位 ${s.slot} 開始新旅程嗎？`)) {
          UIManager.playTransition(() => {
            document.getElementById('modal-load-game')?.classList.remove('active');
            mainMenu.classList.remove('active');
            mapView.classList.add('active');
            setStartupMode(true);
            clearGameLog(); // 清除日誌，確保新旅程從空白開始
            initGameState(); // 重新初始化資料
            rebindUIEvents();
            GameState.currentSaveSlot = s.slot; // 設定存檔欄位
            renderMap();
          });
        }
      } else {
        if (confirm(`確定要進入欄位 ${s.slot} 的旅程嗎？`)) {
          document.getElementById('modal-load-game')?.classList.remove('active');
          clearGameLog(); // 清除日誌，確保讀取的存檔從空白開始
          if (SaveManager.loadGame(s.slot)) {
            rebindUIEvents();
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
          renderSaveSlots(rebindUIEvents);
        }
      });
      btnWrapper.appendChild(deleteBtn);
    }

    container.appendChild(btnWrapper);
  });
}

export function initMainMenuController(rebindUIEvents: () => void): void {
  const btnEnterJourney = document.getElementById('btn-enter-journey');
  const btnCloseLoadGame = document.getElementById('btn-close-load-game');
  const modalLoadGame = document.getElementById('modal-load-game');

  if (btnEnterJourney && modalLoadGame) {
    btnEnterJourney.addEventListener('click', () => {
      renderSaveSlots(rebindUIEvents);
      modalLoadGame.classList.add('active');
    });
  }

  if (btnCloseLoadGame && modalLoadGame) {
    btnCloseLoadGame.addEventListener('click', () => {
      modalLoadGame.classList.remove('active');
    });
  }
}
