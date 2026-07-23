import { GameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import { ToastManager } from './ToastManager';
import { UIManager } from './UIManager';
import { advanceDay, startGameLoop, stopGameLoop } from '../core/GameLoop';
import { enterScene, returnToMap } from './SceneController';
import { positionFloatingElement } from './FloatingPosition';
import { setPartyTab } from './ModalController';

export function initGameFlowController(): void {
  // 綁定傭兵小隊頁籤切換按鈕
  const tabBtnStats = document.getElementById('tab-btn-stats');
  if (tabBtnStats) {
    tabBtnStats.addEventListener('click', () => setPartyTab('stats'));
  }
  const tabBtnEquip = document.getElementById('tab-btn-equip');
  if (tabBtnEquip) {
    tabBtnEquip.addEventListener('click', () => setPartyTab('equip'));
  }

  
  const btnWildBack = document.getElementById('btn-wild-back');
  if (btnWildBack) btnWildBack.addEventListener('click', returnToMap);

  // 戰鬥歷史紀錄關閉按鈕
  const btnCloseCombatHistory = document.getElementById('btn-close-combat-history');
  if (btnCloseCombatHistory) {
    btnCloseCombatHistory.addEventListener('click', () => {
      const modal = document.getElementById('modal-combat-history');
      if (modal) modal.style.display = 'none';
    });
  }

  // 手動儲存與退出
  const btnManualSave = document.getElementById('btn-manual-save');
  if (btnManualSave) {
    btnManualSave.addEventListener('click', () => {
      if (GameState.currentSaveSlot) {
        SaveManager.saveGame(GameState.currentSaveSlot);
        ToastManager.show('遊戲進度已手動儲存！');
      }
    });
  }

  const btnExitGame = document.getElementById('btn-exit-game');
  if (btnExitGame) {
    btnExitGame.addEventListener('click', () => {
      if (GameState.currentSaveSlot) {
        SaveManager.saveGame(GameState.currentSaveSlot);
      }
      stopGameLoop();
      
      // 隱藏地圖與其他視圖
      document.querySelectorAll('.view, .facility-view').forEach(v => v.classList.remove('active'));
      const sysMenu = document.getElementById('modal-system-menu');
      if (sysMenu) sysMenu.classList.remove('active');
      
      const topBar = document.getElementById('top-bar');
      if (topBar) topBar.style.display = 'none';
      
      const sharedRightPanel = document.getElementById('shared-right-panel');
      if (sharedRightPanel) sharedRightPanel.style.display = 'none';
      
      // 顯示主選單
      const mainMenu = document.getElementById('main-menu-view');
      if (mainMenu) mainMenu.classList.add('active');
    });
  }

  const btnReturnBase = document.getElementById('btn-return-base');
  if (btnReturnBase) {
    btnReturnBase.addEventListener('click', () => {
      const isMapViewActive = document.getElementById('map-view')?.classList.contains('active');
      if (isMapViewActive) {
        if (GameState.myTerritory.currentCountryId) {
          const baseNode = GameState.mapSystem.getNodes().find(n => n.id === GameState.myTerritory.currentCountryId);
          if (baseNode) {
            enterScene(baseNode);
          }
        } else {
          ToastManager.show('您尚未建立據點！');
        }
      } else {
        returnToMap();
      }
    });
  }

  // 快捷 Dock 按鈕與 Modal 綁定
  const btnDockParty = document.getElementById('btn-dock-party');
  if (btnDockParty) {
    btnDockParty.addEventListener('click', () => {
      const modal = document.getElementById('modal-party-list');
      if (modal) {
        modal.classList.toggle('active');
        UIManager.updateUI();
      }
    });
  }

  const btnClosePartyList = document.getElementById('btn-close-party-list');
  if (btnClosePartyList) {
    btnClosePartyList.addEventListener('click', () => {
      const modal = document.getElementById('modal-party-list');
      if (modal) modal.classList.remove('active');
    });
  }

  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement)?.closest('#btn-system-menu') || (e.target as HTMLElement)?.closest('#btn-dock-menu');
    if (target) {
      const modal = document.getElementById('modal-system-menu');
      if (modal) modal.classList.add('active');
    }
  });

  // 全域 data-tip 懸浮提示邏輯
  document.addEventListener('mouseover', (e) => {
    const target = (e.target as HTMLElement)?.closest('[data-tip]') as HTMLElement;
    if (target) {
      const tipEl = document.getElementById('global-tooltip');
      if (tipEl) {
        tipEl.textContent = target.getAttribute('data-tip') || '';
        tipEl.style.opacity = '1';
      }
    }
  });
  document.addEventListener('mousemove', (e) => {
    const target = (e.target as HTMLElement)?.closest('[data-tip]');
    if (target) {
      const tipEl = document.getElementById('global-tooltip');
      if (tipEl) {
        positionFloatingElement(tipEl, e.clientX, e.clientY);
      }
    }
  });
  document.addEventListener('mouseout', (e) => {
    const target = (e.target as HTMLElement)?.closest('[data-tip]');
    const related = (e.relatedTarget as HTMLElement)?.closest('[data-tip]');
    if (target && target !== related) {
      const tipEl = document.getElementById('global-tooltip');
      if (tipEl) {
        tipEl.style.opacity = '0';
      }
    }
  });

  // 頂部資源列據點/位置標籤點擊切換
  document.addEventListener('click', (e) => {
    const locItem = (e.target as HTMLElement)?.closest('#ui-location')?.closest('.resource-item');
    if (locItem) {
      const isMapViewActive = document.getElementById('map-view')?.classList.contains('active');
      if (isMapViewActive && GameState.myTerritory.currentCountryId) {
        const baseNode = GameState.mapSystem.getNodes().find(n => n.id === GameState.myTerritory.currentCountryId);
        if (baseNode) enterScene(baseNode);
      } else if (!isMapViewActive) {
        returnToMap();
      }
    }
  });

  // 手動結束本日 (帶 0.5s 質感黑屏過渡轉場)
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement)?.closest('#btn-end-day');
    if (target) {
      UIManager.playTransition(() => {
        advanceDay();
      });
    }
  });

  // 防災準備
  const btnPrepareThreat = document.getElementById('btn-prepare-threat');
  if (btnPrepareThreat) {
    btnPrepareThreat.addEventListener('click', () => {
      if (GameState.threat.prepared) return;
      if (GameState.myTerritory.wood < 20) {
        ToastManager.show('木材不足，需要 20 木材才能完成防災準備。', 'warning');
        return;
      }
      GameState.myTerritory.wood -= 20;
      GameState.threat.prepared = true;
      ToastManager.show(`已為${GameState.threat.name}完成防災準備，災害損失將減半。`, 'success');
      UIManager.updateUI();
    });
  }

  // 當玩家在新旅程中選擇了據點後觸發
  document.addEventListener('game-started', () => {
    startGameLoop(() => {
      UIManager.updateUI();
    });
    // 存下初始狀態
    if (GameState.currentSaveSlot) {
      SaveManager.saveGame(GameState.currentSaveSlot);
    }
  });

  // 系統選單
  const btnSystemMenu = document.getElementById('btn-system-menu');
  if (btnSystemMenu) {
    btnSystemMenu.addEventListener('click', () => {
      document.getElementById('modal-system-menu')?.classList.add('active');
    });
  }

  const closeSystemMenu = () => {
    document.getElementById('modal-system-menu')?.classList.remove('active');
  };

  document.getElementById('btn-close-system-menu')?.addEventListener('click', closeSystemMenu);
  document.getElementById('btn-cancel-system-menu')?.addEventListener('click', closeSystemMenu);

  // 模態框關閉事件 (傭兵詳情, 倉庫, 裝備選擇)
  document.getElementById('btn-close-adv-detail')?.addEventListener('click', () => {
    document.getElementById('modal-adv-detail')?.classList.remove('active');
  });
  document.getElementById('btn-close-warehouse')?.addEventListener('click', () => {
    document.getElementById('modal-warehouse')?.classList.remove('active');
  });
  document.getElementById('btn-close-equip-select')?.addEventListener('click', () => {
    document.getElementById('modal-equip-select')?.classList.remove('active');
  });

  // 綁定日誌頁籤切換
  const logContainer = document.getElementById('game-log');
  const logTabs = document.querySelectorAll('.log-tab');
  if (logContainer) {
    logTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        logTabs.forEach(t => t.classList.remove('active'));
        const target = e.target as HTMLElement;
        target.classList.add('active');
        logContainer.setAttribute('data-filter', target.getAttribute('data-filter') || 'all');
        setTimeout(() => {
          logContainer.scrollTop = logContainer.scrollHeight;
        }, 0);
      });
    });
  }
}
