import { AdventureLogModalController } from './modals/AdventureLogModalController';
import { GameState } from '../core/GameState';
import { SaveManager } from '../core/SaveManager';
import { ToastManager } from './ToastManager';
import { UIManager } from './UIManager';
import { advanceDay, startGameLoop, stopGameLoop } from '../core/GameLoop';
import { enterScene, returnToMap } from './SceneController';
import { enterSceneWithTransition } from './SceneController';
import { positionFloatingElement } from './FloatingPosition';
import { setPartyTab } from './ModalController';
import { showDailySummaryModal } from './DailySummaryModal';
import { DiplomacyController } from './DiplomacyController';
import { renderSaveSlots } from './MainMenuController';

export function initGameFlowController(rebindUIEvents: () => void): void {
  // 三個側邊抽屜面板的輔助取得函式（提前宣告供互斥邏輯共用）
  const partyModal = () => document.getElementById('modal-party-list');
  const combatHistoryPanel = () => document.getElementById('combat-history-panel');

  // 綁定傭兵小隊頁籤切換按鈕
  const tabBtnStats = document.getElementById('tab-btn-stats');
  if (tabBtnStats) {
    tabBtnStats.addEventListener('click', () => setPartyTab('stats'));
  }
  const tabBtnEquip = document.getElementById('tab-btn-equip');
  if (tabBtnEquip) {
    tabBtnEquip.addEventListener('click', () => setPartyTab('equip'));
  }
  const tabBtnSkills = document.getElementById('tab-btn-skills');
  if (tabBtnSkills) {
    tabBtnSkills.addEventListener('click', () => setPartyTab('skills'));
  }

  
  const btnWildBack = document.getElementById('btn-wild-back');
  if (btnWildBack) btnWildBack.addEventListener('click', returnToMap);

  // 戰鬥紀錄關閉按鈕
  const btnCloseCombatHistory = document.getElementById('btn-close-combat-history');
  if (btnCloseCombatHistory) {
    btnCloseCombatHistory.addEventListener('click', () => {
      document.getElementById('combat-history-panel')?.classList.remove('active');
    });
  }

  // 開啟戰鬥紀錄按鈕（互斥：開啟時關閉其他兩個側邊面板）
  
  const btnDockAdventureLog = document.getElementById('btn-adventure-log');
  if (btnDockAdventureLog) {
    btnDockAdventureLog.addEventListener('click', () => {
      AdventureLogModalController.show();
    });
  }

const btnDockCombatHistory = document.getElementById('btn-dock-combat-history');
  if (btnDockCombatHistory) {
    btnDockCombatHistory.addEventListener('click', () => {
      const combatPanel = document.getElementById('combat-history-panel');
      if (!combatPanel) return;
      if (combatPanel.classList.contains('active')) {
        combatPanel.classList.remove('active');
      } else {
        // 關閉其他兩個面板
        partyModal()?.classList.remove('active');
        DiplomacyController.close();
        import('./ModalController').then(m => m.openCombatHistory());
      }
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

      UIManager.playTransition(() => {
        // 黑幕完全覆蓋後才切換視圖，徹底清理隱藏全遊戲視圖、Modal與子面板
        UIManager.clearAllUIOverlays();

        const mainMenu = document.getElementById('main-menu-view');
        if (mainMenu) {
          mainMenu.classList.add('active');
          // 重新渲染存檔欄位，確保退出後看到最新的存檔資訊
          renderSaveSlots(rebindUIEvents);
        }
      });
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
            enterSceneWithTransition(baseNode);
          }
        } else {
          ToastManager.show('您尚未建立據點！');
        }
      } else {
        returnToMap();
      }
    });
  }

  // 快捷 Dock 按鈕與 Modal 綁定 (互斥邏輯：三個側邊面板同時只能開一個)

  const btnDockParty = document.getElementById('btn-dock-party');
  if (btnDockParty) {
    btnDockParty.addEventListener('click', () => {
      const modal = partyModal();
      if (!modal) return;
      const willOpen = !modal.classList.contains('active');
      if (willOpen) {
        // 關閉其他兩個面板後再開傭兵面板
        DiplomacyController.close();
        combatHistoryPanel()?.classList.remove('active');
        modal.classList.add('active');
        const detailsPane = document.getElementById('party-details-pane');
        if (detailsPane) detailsPane.style.display = 'none'; // 每次打開預設只顯示列表
        const equipSelectPane = document.getElementById('party-equip-select-pane');
        if (equipSelectPane) equipSelectPane.style.display = 'none';
        UIManager.updateUI();
      } else {
        modal.classList.remove('active');
        const detailsPane = document.getElementById('party-details-pane');
        if (detailsPane) detailsPane.style.display = 'none';
        const equipSelectPane = document.getElementById('party-equip-select-pane');
        if (equipSelectPane) equipSelectPane.style.display = 'none';
      }
    });
  }

  const btnDockDiplomacy = document.getElementById('btn-dock-diplomacy');
  if (btnDockDiplomacy) {
    btnDockDiplomacy.addEventListener('click', () => {
      if (DiplomacyController.isOpen()) {
        DiplomacyController.close();
      } else {
        // 關閉其他兩個面板後再開外交面板
        partyModal()?.classList.remove('active');
        combatHistoryPanel()?.classList.remove('active');
        DiplomacyController.open();
      }
    });
  }

  const btnClosePartyList = document.getElementById('btn-close-party-list');
  if (btnClosePartyList) {
    btnClosePartyList.addEventListener('click', () => {
      partyModal()?.classList.remove('active');
      const detailsPane = document.getElementById('party-details-pane');
      if (detailsPane) detailsPane.style.display = 'none';
      const equipSelectPane = document.getElementById('party-equip-select-pane');
      if (equipSelectPane) equipSelectPane.style.display = 'none';
    });
  }

  const btnClosePartyDetails = document.getElementById('btn-close-party-details');
  if (btnClosePartyDetails) {
    btnClosePartyDetails.addEventListener('click', () => {
      const detailsPane = document.getElementById('party-details-pane');
      if (detailsPane) detailsPane.style.display = 'none';
      const equipSelectPane = document.getElementById('party-equip-select-pane');
      if (equipSelectPane) equipSelectPane.style.display = 'none';
    });
  }

  const btnCloseEquipSelectPane = document.getElementById('btn-close-equip-select-pane');
  if (btnCloseEquipSelectPane) {
    btnCloseEquipSelectPane.addEventListener('click', () => {
      const equipSelectPane = document.getElementById('party-equip-select-pane');
      if (equipSelectPane) equipSelectPane.style.display = 'none';
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
        if (baseNode) enterSceneWithTransition(baseNode);
      } else if (!isMapViewActive) {
        returnToMap();
      }
    }
  });

  // 手動結束本日 (先計算並顯示結算，確認後才帶 0.5s 質感黑屏過渡轉場)
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement)?.closest('#btn-end-day');
    if (target) {
      // 標記正在結算中，攔截事件彈窗
      (window as any).isAdvancingDay = true;
      (window as any).eventQueue = [];

      // 計算本日資源與推演
      advanceDay();
      
      // 直接顯示每日結算面板，此時不黑屏，等待玩家確認
      showDailySummaryModal(() => {
        // 玩家確認結算後，才播放轉場動畫進入下一天
        UIManager.playTransition(() => {
          (window as any).isAdvancingDay = false;
          UIManager.updateUI();
          
          // 轉場結束後，依序釋放佇列中的事件彈窗
          const queue = (window as any).eventQueue || [];
          if (queue.length > 0) {
            queue.forEach((cb: () => void) => cb());
            (window as any).eventQueue = [];
          }
        });
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
