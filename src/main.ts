import { GameState, initGameState } from './core/GameState';
import { startGameLoop, advanceDay } from './core/GameLoop';
import { initLogger, clearGameLog } from './utils/Logger';
import { UIManager } from './ui/UIManager';
import { renderMap, setStartupMode, initMapInteraction, startRoutePlanning, initPhaserMap } from './ui/MapController';
import { SaveManager } from './core/SaveManager';
import { enterScene, returnToMap } from './ui/SceneController';
import { openWarehouse, openTodoModal } from './ui/ModalController';
import { DispatchTask, EnemyFeature, TaskType } from './models/DispatchTask';
import { Adventurer } from './models/Adventurer';
import { NodeLevel } from './models/types';
import { DataStore } from './systems/DataStore';
import { NameGenerator } from './systems/NameGenerator';
import { EventBus } from './core/EventBus';
import { GameEventType } from './core/GameEvents';

// 1. 初始化日誌攔截
const logContainer = document.getElementById('game-log')!;
initLogger(logContainer);

// 2. 初始化遊戲資料
initGameState();

// ==========================================
// 3. 事件綁定
// ==========================================
initPhaserMap('map-nodes-container');
initMapInteraction();

// 返回地圖按鈕
document.getElementById('btn-back-map')!.addEventListener('click', returnToMap);
document.getElementById('btn-wild-back')!.addEventListener('click', returnToMap);

// 街道視圖拖曳滑動邏輯
const streetScrollArea = document.getElementById('street-scroll-area')!;
let isDragging = false;
let startX: number;
let scrollLeft: number;

streetScrollArea.addEventListener('mousedown', (e) => {
  isDragging = true;
  startX = e.pageX - streetScrollArea.offsetLeft;
  scrollLeft = streetScrollArea.scrollLeft;
});
streetScrollArea.addEventListener('mouseleave', () => isDragging = false);
streetScrollArea.addEventListener('mouseup', () => isDragging = false);
streetScrollArea.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  e.preventDefault();
  const x = e.pageX - streetScrollArea.offsetLeft;
  const walk = (x - startX) * 2;
  streetScrollArea.scrollLeft = scrollLeft - walk;
});

// 點擊建築物效果
const enterFacility = (viewId: string) => {
  document.getElementById(viewId)!.classList.add('active');
  UIManager.updateUI();
};
document.getElementById('btn-enter-base')!.addEventListener('click', () => enterFacility('view-base'));
document.getElementById('btn-enter-hall')!.addEventListener('click', () => enterFacility('view-hall'));
document.getElementById('btn-enter-camp')!.addEventListener('click', () => enterFacility('view-camp'));
document.getElementById('btn-enter-forge')!.addEventListener('click', () => enterFacility('view-forge'));

// 退出建築按鈕
document.querySelectorAll('.btn-exit-facility').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('view-base')!.classList.remove('active');
    document.getElementById('view-hall')!.classList.remove('active');
    document.getElementById('view-camp')!.classList.remove('active');
    document.getElementById('view-forge')!.classList.remove('active');
    UIManager.updateUI();
  });
});

// 工作分配按鈕
document.querySelectorAll('.btn-assign').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const job = target.getAttribute('data-job')!;
    const amount = parseInt(target.getAttribute('data-amount')!);
    
    if (GameState.myTerritory.assignWorker(job, amount)) {
      EventBus.getInstance().publish({
        type: GameEventType.WORKER_ASSIGNED,
        payload: { job, currentCount: GameState.myTerritory.workers[job], unassignedCount: GameState.myTerritory.workers['UNASSIGNED'] }
      });
      UIManager.updateUI();
    }
  });
});

// 監聽資源與人口事件
EventBus.getInstance().subscribe(GameEventType.RESOURCE_CHANGED, () => {
  UIManager.updateUI();
});
EventBus.getInstance().subscribe(GameEventType.POPULATION_STARVED, (payload) => {
  UIManager.updateUI();
  alert(`⚠️ 飢荒警告！由於糧食不足，${payload.starvedAmount} 名人口流失了！`);
});

// 野外討伐
document.getElementById('btn-wild-quest')!.addEventListener('click', () => {
  const node = GameState.currentViewNode;
  if (!node) return;
  const features = Object.values(EnemyFeature);
  const randomFeature = features[Math.floor(Math.random() * features.length)];
  const task = new DispatchTask(`掃蕩${node.name}`, TaskType.COMBAT, 0, 20, 200, 20, 100, randomFeature);
  GameState.system.dispatchAdventurers(GameState.adventurers, task);
  
  let featureMsg = '';
  if (randomFeature === EnemyFeature.HIGH_DEF) featureMsg = ' (情報指出該區域有高防禦的重裝魔物)';
  else if (randomFeature === EnemyFeature.HIGH_EVADE) featureMsg = ' (情報指出該區域有高閃避的敏捷魔物)';
  
  console.log(`🚀 [任務派發] 小隊已出發前往「${node.name}」進行掃蕩！${featureMsg}`);
  UIManager.updateUI();
});

// 遷移與建立據點
document.getElementById('btn-migrate')!.addEventListener('click', () => {
  const node = GameState.currentViewNode;
  if (node && node.nodeLevel > NodeLevel.WILDERNESS) {
    if (GameState.mapSystem.relocateBase(node.id, GameState.myTerritory)) {
      document.getElementById('btn-migrate')!.style.display = 'none';
      enterScene(node);
      UIManager.updateUI();
    }
  }
});

document.getElementById('btn-found-settlement')!.addEventListener('click', () => {
  const node = GameState.currentViewNode;
  if (node && node.nodeLevel === NodeLevel.WILDERNESS) {
    if (GameState.mapSystem.foundSettlement(node.id, GameState.myTerritory)) {
      returnToMap();
      enterScene(node);
    }
  }
});

// 設施按鈕事件
document.getElementById('btn-explore')!.addEventListener('click', () => {
  if (GameState.myTerritory.exploredToday >= GameState.myTerritory.maxExplorationsPerDay) {
    alert(`本回合已探索過周邊（上限：${GameState.myTerritory.maxExplorationsPerDay}次），請推進回合後再試！`);
    return;
  }
  
  GameState.myTerritory.exploredToday++;
  console.log('🗺️ [探索] 領主親自巡視周邊，發現了 20 金幣與微量資源！');
  GameState.myTerritory.addGold(20);
  UIManager.updateUI();
});

document.getElementById('btn-tribute')!.addEventListener('click', () => {
  if (GameState.myTerritory.gold >= 100) {
    GameState.myTerritory.gold -= 100;
    GameState.myTerritory.royalFavor += 10;
    console.log(`🎁 [謁見廳] 您向${GameState.currentViewNode?.name || '皇家'}獻上了 100 金幣，好感度提升了！`);
    UIManager.updateUI();
  }
});

document.getElementById('btn-feast')!.addEventListener('click', () => {
  if (GameState.myTerritory.gold >= 300) {
    GameState.myTerritory.gold -= 300;
    GameState.myTerritory.prestige += 50;
    console.log('[系統] 🍷 [謁見廳] 您舉辦了盛大的宴會！消耗 300 金幣，聲望大幅提升！');
    UIManager.updateUI();
  }
});

const modalRecruit = document.getElementById('modal-recruit')!;
const recruitCardsContainer = document.getElementById('recruit-cards-container')!;

document.getElementById('btn-recruit')!.addEventListener('click', () => {
  if (GameState.myTerritory.gold >= 500) {
    recruitCardsContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const adv = new Adventurer(`p${Date.now()}_${i}`, NameGenerator.generateFullName(), DataStore.getRandomJob(), DataStore.getRandomTrait());
      
      const card = document.createElement('div');
      card.className = 'recruit-card';
      card.innerHTML = `
        <div style="font-size:2em; margin-bottom:10px;">🦸</div>
        <strong>${adv.name}</strong><br/>
        <span style="color:#94a3b8; font-size:0.9em;">${adv.job.name} | ${adv.trait.name}</span><br/>
        <div style="margin-top:10px; font-size:0.85em; color:#cbd5e1;">
          力:${adv.baseAttributes.str} 敏:${adv.baseAttributes.agi} 體:${adv.baseAttributes.con}<br/>
          智:${adv.baseAttributes.int} 精:${adv.baseAttributes.spr} 幸:${adv.baseAttributes.luk}
        </div>
      `;
      card.addEventListener('click', () => {
        GameState.myTerritory.gold -= 500;
        GameState.adventurers.push(adv);
        console.log(`🍻 [訓練所] 花費 500 金幣招募了新夥伴「${adv.name}」加入冒險者行列！`);
        modalRecruit.classList.remove('active');
        UIManager.updateUI();
      });
      recruitCardsContainer.appendChild(card);
    }
    modalRecruit.classList.add('active');
  } else {
    console.log('[系統] ⚠️ 金幣不足，無法招募！');
  }
});

document.getElementById('btn-base-warehouse')!.addEventListener('click', () => openWarehouse(false));
document.getElementById('btn-todo-list')!.addEventListener('click', () => openTodoModal());
document.getElementById('btn-forge-warehouse')!.addEventListener('click', () => openWarehouse(true));

// 建立商隊：這下讓玩家從書房就能啟動從市場跟蹤商圖的流程
document.getElementById('btn-base-trade')!.addEventListener('click', () => {
  // 1. 關閉所有設施視圖
  document.getElementById('view-base')!.classList.remove('active');
  document.getElementById('view-hall')!.classList.remove('active');
  document.getElementById('view-camp')!.classList.remove('active');
  document.getElementById('view-forge')!.classList.remove('active');
  // 2. 返回地圖
  returnToMap();
  // 3. 進入路線規劃模式（不傳起始節點，玩家自由選擇最多 3 個中途站）
  console.log('[系統] 🐪 請在地圖上依序點選最多 3 個城市作為商隊中途站，然後點擊「完成規劃」。');
  startRoutePlanning();
});

// 模態框關閉事件
document.getElementById('btn-close-recruit')!.addEventListener('click', () => modalRecruit.classList.remove('active'));
document.getElementById('btn-close-adv-detail')!.addEventListener('click', () => document.getElementById('modal-adv-detail')!.classList.remove('active'));
document.getElementById('btn-close-warehouse')!.addEventListener('click', () => document.getElementById('modal-warehouse')!.classList.remove('active'));
document.getElementById('btn-close-equip-select')!.addEventListener('click', () => document.getElementById('modal-equip-select')!.classList.remove('active'));

// 綁定日誌頁籤切換
const logTabs = document.querySelectorAll('.log-tab');
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

// ==========================================
// 4. 主選單與遊戲啟動
// ==========================================

const mainMenu = document.getElementById('main-menu-view')!;
const mapView = document.getElementById('map-view')!;
const topBar = document.getElementById('top-bar')!;

function renderSaveSlots() {
  const container = document.getElementById('save-slots-container')!;
  const modalTitle = document.getElementById('modal-save-title')!;
  container.innerHTML = '';
  modalTitle.textContent = '選擇旅程';
  
  const slots = SaveManager.getSaveSlots();

  slots.forEach(s => {
    const btnWrapper = document.createElement('div');
    btnWrapper.style.display = 'flex';
    btnWrapper.style.gap = '10px';
    btnWrapper.style.alignItems = 'stretch';
    btnWrapper.style.width = '100%';

    const btn = document.createElement('div');
    btn.className = 'glass-panel';
    btn.style.padding = '15px';
    btn.style.cursor = 'pointer';
    btn.style.display = 'flex';
    btn.style.justifyContent = 'space-between';
    btn.style.alignItems = 'center';
    btn.style.flex = '1';

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
            document.getElementById('modal-load-game')!.classList.remove('active');
            mainMenu.classList.remove('active');
            mapView.classList.add('active');
            setStartupMode(true);
            clearGameLog(); // 清除日誌，確保新旅程從空白開始
            initGameState(); // 重新初始化資料
            GameState.currentSaveSlot = s.slot; // 設定存檔欄位
            renderMap();
          });
        }
      } else {
        if (confirm(`確定要進入欄位 ${s.slot} 的旅程嗎？`)) {
          document.getElementById('modal-load-game')!.classList.remove('active');
          clearGameLog(); // 清除日誌，確保讀取的存檔從空白開始
          if (SaveManager.loadGame(s.slot)) {
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

document.getElementById('btn-enter-journey')!.addEventListener('click', () => {
  renderSaveSlots();
  document.getElementById('modal-load-game')!.classList.add('active');
});

document.getElementById('btn-close-load-game')!.addEventListener('click', () => {
  document.getElementById('modal-load-game')!.classList.remove('active');
});

// 手動儲存與退出
import { stopGameLoop } from './core/GameLoop';

document.getElementById('btn-manual-save')!.addEventListener('click', () => {
  if (GameState.currentSaveSlot) {
    SaveManager.saveGame(GameState.currentSaveSlot);
    alert('遊戲進度已手動儲存！');
  }
});

document.getElementById('btn-exit-game')!.addEventListener('click', () => {
  if (GameState.currentSaveSlot) {
    SaveManager.saveGame(GameState.currentSaveSlot);
  }
  stopGameLoop();
  
  // 隱藏地圖與其他視圖
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('top-bar')!.style.display = 'none';
  document.getElementById('shared-right-panel')!.style.display = 'none';
  
  // 顯示主選單
  mainMenu.classList.add('active');
});

document.getElementById('btn-return-base')!.addEventListener('click', () => {
  if (GameState.myTerritory.currentCountryId) {
    const baseNode = GameState.mapSystem.getNodes().find(n => n.id === GameState.myTerritory.currentCountryId);
    if (baseNode) {
      enterScene(baseNode);
    }
  } else {
    alert('您尚未建立據點！');
  }
});

// 手動結束本日
document.getElementById('btn-end-day')!.addEventListener('click', () => {
  UIManager.playTransition(() => {
    advanceDay();
  });
});

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

