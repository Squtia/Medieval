import { ToastManager } from './ui/ToastManager';
import { GameState, initGameState } from './core/GameState';
import { startGameLoop, advanceDay } from './core/GameLoop';
import { initLogger, clearGameLog } from './utils/Logger';
import { UIManager } from './ui/UIManager';
import { CombatUIManager } from './ui/CombatUIManager';
import { renderMap, setStartupMode, initMapInteraction, startRoutePlanning, initPhaserMap } from './ui/MapController';
import { SaveManager } from './core/SaveManager';
import { enterScene, returnToMap, renderBaseBuildings } from './ui/SceneController';
import { openWarehouse, openTodoModal, openCombatHistory } from './ui/ModalController';
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
rebindGlobalUIEvents();

export function rebindGlobalUIEvents() {
  EventBus.getInstance().subscribe(GameEventType.RESOURCE_CHANGED, () => {
    UIManager.updateUI();
  });
  EventBus.getInstance().subscribe(GameEventType.POPULATION_STARVED, (payload) => {
    UIManager.updateUI();
    ToastManager.show(`⚠️ 飢荒警告！由於糧食不足，${payload.starvedAmount} 名人口流失了！`);
  });
  CombatUIManager.init();
}

// ==========================================
// 3. 事件綁定
// ==========================================
initPhaserMap('map-nodes-container');
initMapInteraction();

// 返回地圖按鈕
const btnBackMap = document.getElementById('btn-back-map');
if (btnBackMap) btnBackMap.addEventListener('click', returnToMap);
document.getElementById('btn-wild-back')!.addEventListener('click', returnToMap);

// 戰鬥歷史紀錄按鈕
document.getElementById('btn-combat-history')!.addEventListener('click', openCombatHistory);
document.getElementById('btn-close-combat-history')!.addEventListener('click', () => {
  document.getElementById('modal-combat-history')!.style.display = 'none';
});

// 點擊建築物效果
const enterFacility = (viewId: string) => {
  document.getElementById(viewId)!.classList.add('active');
  UIManager.updateUI();
};
document.getElementById('btn-enter-base')!.addEventListener('click', () => enterFacility('view-base'));
document.getElementById('btn-enter-hall')!.addEventListener('click', () => enterFacility('view-hall'));
document.getElementById('btn-enter-tavern')!.addEventListener('click', () => enterFacility('view-camp'));
document.getElementById('btn-enter-weapon-shop')!.addEventListener('click', () => {
  enterFacility('view-weapon-shop');
  if (typeof (window as any).renderWeaponShop === 'function') {
    (window as any).renderWeaponShop();
  }
});
document.getElementById('btn-enter-armor-shop')!.addEventListener('click', () => {
  enterFacility('view-armor-shop');
  if (typeof (window as any).renderArmorShop === 'function') {
    (window as any).renderArmorShop();
  }
});
document.getElementById('btn-enter-forge')!.addEventListener('click', () => enterFacility('view-forge'));

// 退出建築按鈕
document.querySelectorAll('.btn-exit-facility').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById('view-base')!.classList.remove('active');
    document.getElementById('view-hall')!.classList.remove('active');
    document.getElementById('view-camp')!.classList.remove('active');
    document.getElementById('view-forge')!.classList.remove('active');
    document.getElementById('view-weapon-shop')!.classList.remove('active');
    document.getElementById('view-armor-shop')!.classList.remove('active');
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

// 監聽資源與人口事件移至 rebindGlobalUIEvents

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

document.getElementById('btn-explore')!.addEventListener('click', () => {
  const territory = GameState.myTerritory;
  if (territory.exploredToday >= territory.maxExplorationsPerDay) {
    ToastManager.show(`本回合已探索過周邊（上限：${territory.maxExplorationsPerDay}次），請推進回合後再試！`);
    return;
  }
  
  territory.exploredToday++;
  territory.exploreCount = (territory.exploreCount || 0) + 1;
  
  let recruitedAdv: Adventurer | null = null;
  let qLabel = '';
  
  // 1. 判斷首 3 次保底與機率
  if (!territory.hasRecruitedFromFirstExplorations && territory.exploreCount <= 3) {
    // 初始 3 次內探索，若是第 3 次且尚未招募過，則必定成功招募 (品質固定為 N)
    // 或者是前 2 次以 20% 機率成功招募
    const forceRecruit = territory.exploreCount === 3;
    const luckyRecruit = Math.random() < 0.20;
    
    if (forceRecruit || luckyRecruit) {
      recruitedAdv = new Adventurer(`adv_explore_${Date.now()}`, NameGenerator.generateFullName(), DataStore.getRandomJob(), DataStore.getRandomTrait(), 'N');
      territory.hasRecruitedFromFirstExplorations = true;
      qLabel = 'N 普通';
    }
  } else {
    // 已經保底過或超過 3 次後，每次探索有 10% 機率招募！
    if (Math.random() < 0.10) {
      // 隨機抽取品質：N極大、R低、SR極低、SSR最低
      let q: 'N' | 'R' | 'SR' | 'SSR' = 'N';
      const randQ = Math.random() * 100;
      if (randQ < 0.2) { q = 'SSR'; qLabel = 'SSR 傳奇'; }
      else if (randQ < 3.0) { q = 'SR'; qLabel = 'SR 史詩'; }
      else if (randQ < 10.0) { q = 'R'; qLabel = 'R 精英'; }
      else { q = 'N'; qLabel = 'N 普通'; }
      
      recruitedAdv = new Adventurer(`adv_explore_${Date.now()}`, NameGenerator.generateFullName(), DataStore.getRandomJob(), DataStore.getRandomTrait(), q);
    }
  }
  
  // 2. 結算獎勵
  let msg = '🗺️ [探索] 領主親自巡視周邊，獲得了 20 金幣與少量物資！';
  territory.addGold(20);
  territory.wood += 2;
  territory.stone += 1;
  
  if (recruitedAdv) {
    GameState.adventurers.push(recruitedAdv);
    msg = `🗺️ [探索] 領主親自巡視周邊，獲得了 20 金幣，並幸運地遇到一位流浪冒險者【${recruitedAdv.name}】(${qLabel}) 願意效忠您！已加入隊伍。`;
    ToastManager.show(`招募到了冒險者【${recruitedAdv.name}】！`);
  }
  
  console.log(msg);
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
  const territory = GameState.myTerritory;
  const tavernLvl = territory.tavernLevel || 0;
  if (tavernLvl <= 0) {
    ToastManager.show('⚠️ 請先至領主自宅（書房）建造冒險者酒館！');
    return;
  }
  
  if (territory.gold >= 500) {
    recruitCardsContainer.innerHTML = '';
    
    // 品質隨機抽取算法
    const getQuality = (lvl: number): 'N' | 'R' | 'SR' | 'SSR' => {
      const r = Math.random();
      if (lvl === 1) {
        return r < 0.1 ? 'R' : 'N';
      } else if (lvl === 2) {
        if (r < 0.1) return 'SR';
        if (r < 0.4) return 'R';
        return 'N';
      } else { // 3級
        if (r < 0.1) return 'SSR';
        if (r < 0.3) return 'SR';
        if (r < 0.7) return 'R';
        return 'N';
      }
    };

    const getQualityLabel = (q: string) => {
      if (q === 'SSR') return { label: 'SSR 傳奇', color: '#eab308' };
      if (q === 'SR') return { label: 'SR 史詩', color: '#a855f7' };
      if (q === 'R') return { label: 'R 精英', color: '#3b82f6' };
      return { label: 'N 普通', color: '#94a3b8' };
    };

    for (let i = 0; i < 3; i++) {
      const quality = getQuality(tavernLvl);
      const qInfo = getQualityLabel(quality);
      
      const adv = new Adventurer(`adv_${Date.now()}_${i}`, NameGenerator.generateFullName(), DataStore.getRandomJob(), DataStore.getRandomTrait(), quality);
      
      const card = document.createElement('div');
      card.className = 'recruit-card';
      card.style.border = `2px solid ${qInfo.color}`;
      card.style.boxShadow = `0 4px 15px ${qInfo.color}40`;
      
      card.innerHTML = `
        <div style="font-size:2em; margin-bottom:10px;">🦸</div>
        <strong>${adv.name}</strong><br/>
        <span style="color: ${qInfo.color}; font-weight: bold; font-size: 0.95em;">${qInfo.label}</span><br/>
        <span style="color:#cbd5e1; font-size:0.85em;">${adv.job.name} | ${adv.trait.name}</span><br/>
        <div style="margin-top:10px; font-size:0.85em; color:#94a3b8; line-height: 1.4; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 4px;">
          力:${adv.baseAttributes.str} 敏:${adv.baseAttributes.agi} 體:${adv.baseAttributes.con}<br/>
          智:${adv.baseAttributes.int} 精:${adv.baseAttributes.spr} 幸:${adv.baseAttributes.luk}
        </div>
      `;
      const btnConfirm = document.createElement('button');
      btnConfirm.className = 'action-btn';
      btnConfirm.style.marginTop = '15px';
      btnConfirm.style.width = '100%';
      btnConfirm.style.fontSize = '0.9em';
      btnConfirm.style.background = 'linear-gradient(135deg, #059669, #047857)';
      btnConfirm.innerText = '✅ 招募此人 (500金)';
      card.appendChild(btnConfirm);
      
      btnConfirm.addEventListener('click', (e) => {
        e.stopPropagation();
        if (territory.gold >= 500) {
          territory.gold -= 500;
          GameState.adventurers.push(adv);
          console.log(`🍻 [酒館] 花費 500 金幣招募了新夥伴「${adv.name}」(${qInfo.label}) 加入冒險者行列！`);
          modalRecruit.classList.remove('active');
          UIManager.updateUI();
        } else {
          ToastManager.show('⚠️ 金幣不足！');
        }
      });
      recruitCardsContainer.appendChild(card);
    }
    modalRecruit.classList.add('active');
  } else {
    ToastManager.show('⚠️ 金幣不足 500，無法進行招募！');
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
            rebindGlobalUIEvents();
            GameState.currentSaveSlot = s.slot; // 設定存檔欄位
            renderMap();
          });
        }
      } else {
        if (confirm(`確定要進入欄位 ${s.slot} 的旅程嗎？`)) {
          document.getElementById('modal-load-game')!.classList.remove('active');
          clearGameLog(); // 清除日誌，確保讀取的存檔從空白開始
          if (SaveManager.loadGame(s.slot)) {
            rebindGlobalUIEvents();
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
    ToastManager.show('遊戲進度已手動儲存！');
  }
});

document.getElementById('btn-exit-game')!.addEventListener('click', () => {
  if (GameState.currentSaveSlot) {
    SaveManager.saveGame(GameState.currentSaveSlot);
  }
  stopGameLoop();
  
  // 隱藏地圖與其他視圖
  document.querySelectorAll('.view, .facility-view').forEach(v => v.classList.remove('active'));
  const sysMenu = document.getElementById('modal-system-menu');
  if (sysMenu) sysMenu.classList.remove('active');
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
    ToastManager.show('您尚未建立據點！');
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


// 系統選單
document.getElementById('btn-system-menu')!.addEventListener('click', () => {
  document.getElementById('modal-system-menu')!.classList.add('active');
});

const closeSystemMenu = () => {
  document.getElementById('modal-system-menu')!.classList.remove('active');
};
document.getElementById('btn-close-system-menu')!.addEventListener('click', closeSystemMenu);
document.getElementById('btn-cancel-system-menu')!.addEventListener('click', closeSystemMenu);

// ============================================================================
// === CHEAT_CODES_START ===
// 【測試用密技 - 未來發布前必須將此區塊整段刪除】
// ============================================================================

// 全域控制台後門資源修改器
(window as any).cheatGold = (amount: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的金幣數量！');
  GameState.myTerritory.gold = amount;
  UIManager.updateUI();
  console.log(`🧙‍♂️ [密技] 金幣已修改為 ${amount}`);
};

(window as any).cheatWood = (amount: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的木材數量！');
  GameState.myTerritory.wood = amount;
  UIManager.updateUI();
  console.log(`🧙‍♂️ [密技] 木材已修改為 ${amount}`);
};

(window as any).cheatStone = (amount: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的石材數量！');
  GameState.myTerritory.stone = amount;
  UIManager.updateUI();
  console.log(`🧙‍♂️ [密技] 石材已修改為 ${amount}`);
};

(window as any).cheatIron = (amount: number) => {
  if (typeof amount !== 'number' || isNaN(amount)) return console.log('❌ 請輸入有效的鐵礦數量！');
  GameState.myTerritory.iron = amount;
  UIManager.updateUI();
  console.log(`🧙‍♂️ [密技] 鐵礦已修改為 ${amount}`);
};

// 鍵盤輸入彩蛋密技 (輸入 gold, wood, rock, iron 觸發)
let cheatSequence: string[] = [];
const CHEAT_MAP: { [key: string]: { name: string, setter: (val: number) => void } } = {
  'gold': { name: '金幣', setter: (v) => GameState.myTerritory.gold = v },
  'wood': { name: '木材', setter: (v) => GameState.myTerritory.wood = v },
  'rock': { name: '石材', setter: (v) => GameState.myTerritory.stone = v },
  'iron': { name: '鐵礦', setter: (v) => GameState.myTerritory.iron = v }
};

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
    return;
  }
  const key = e.key.toLowerCase();
  // 僅快取 26 個英文字母，最大長度限制為 6
  if (/^[a-z]$/.test(key)) {
    cheatSequence.push(key);
    if (cheatSequence.length > 6) {
      cheatSequence.shift();
    }
    
    const currentStr = cheatSequence.join('');
    for (const code in CHEAT_MAP) {
      if (currentStr.endsWith(code)) {
        cheatSequence = []; // 觸發後清空
        const target = CHEAT_MAP[code];
        const input = prompt(`🧙‍♂️ 偵測到領主祕密指令【${code}】。\n請輸入想要修改或設定的【${target.name}】數值：`);
        if (input !== null) {
          const val = parseInt(input.trim(), 10);
          if (!isNaN(val)) {
            const prev = (GameState.myTerritory as any)[code === 'rock' ? 'stone' : code === 'gold' ? 'gold' : code === 'wood' ? 'wood' : 'iron'];
            target.setter(val);
            UIManager.updateUI();
            
            // 如果此時玩家在自宅內部升級面板，則重新渲染升級按鈕狀態
            const basePanel = document.getElementById('panel-enter-base');
            if (basePanel && basePanel.style.display !== 'none') {
              renderBaseBuildings();
            }
            
            ToastManager.show(`✨ 領地【${target.name}】已變更為 ${val}！`);
            console.log(`🧙‍♂️ [密技] 領主手動將【${target.name}】修改為 ${val}。`);
          } else {
            ToastManager.show('⚠️ 請輸入正確的整數！');
          }
        }
        break;
      }
    }
  }
});

// ============================================================================
// === CHEAT_CODES_END ===
// ============================================================================

