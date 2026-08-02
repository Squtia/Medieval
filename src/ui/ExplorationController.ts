import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { TaskType } from '../models/DispatchTask';
import { AdventurerState } from '../models/types';
import { ExplorationTargetCheck } from '../models/Exploration';
import { isRoutePlanningMode, renderMap } from './MapController';
import { ToastManager } from './ToastManager';
import { renderAdventurerCard } from './components/AdventurerCard';
import { positionFloatingElement } from './FloatingPosition';

let initialized = false;
let isSelectingTarget = false;

function setSelectingTarget(active: boolean): void {
  isSelectingTarget = active;
  document.dispatchEvent(new CustomEvent('exploration-selection-changed', {
    detail: { active }
  }));
}

export function initExplorationController(): void {
  if (initialized) return;
  initialized = true;

  document.getElementById('btn-toggle-exploration')?.addEventListener('click', () => {
    if (isRoutePlanningMode) {
      ToastManager.show('請先關閉修路模式再進行迷霧探索。');
      return;
    }
    setSelectingTarget(!isSelectingTarget);
    if (isSelectingTarget) {
      ToastManager.show('🗺️ 已開啟迷霧探索模式，請在戰略地圖點擊迷霧邊緣。');
    }
  });

  document.addEventListener('phaser-map-clicked', handleMapClick);
  EventBus.getInstance().subscribe(GameEventType.DAY_PASSED, () => {
    refreshExplorationUI();
  });
}

function handleMapClick(e: Event): void {
  if (!isSelectingTarget) return;
  const detail = (e as CustomEvent).detail;
  if (!detail) return;

  const origin = GameState.mapSystem?.getNodes().find(n => n.isPlayerBase);
  const idleAdventurers = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE);

  if (!origin || idleAdventurers.length === 0) {
    ToastManager.show('找不到據點或可派遣的待命冒險者。', 'error');
    setSelectingTarget(false);
    refreshExplorationUI();
    return;
  }

  const { x, y } = detail;
  const check = GameState.explorationSystem.checkTarget(origin, x, y);
  if (!check.valid || !check.requiredDays) {
    ToastManager.show(check.reason ?? '這個位置不能作為探索目標。', 'warning');
    return;
  }

  showDispatchModal(check, idleAdventurers, (explorerId, isExpedited) => {
    const explorer = GameState.adventurers.find(a => a.id === explorerId);
    if (!explorer) return;

    const goldCost = isExpedited ? (check.expeditedGoldCost ?? 0) : (check.goldCost ?? 0);
    const foodCost = isExpedited ? (check.expeditedFoodCost ?? 0) : (check.foodCost ?? 0);

    if (GameState.myTerritory.gold < goldCost) {
      ToastManager.show(`金幣不足！需要 ${goldCost} 金幣 (目前 ${GameState.myTerritory.gold})。`, 'error');
      return;
    }
    if (GameState.myTerritory.food < foodCost) {
      ToastManager.show(`糧食不足！需要 ${foodCost} 糧食 (目前 ${GameState.myTerritory.food})。`, 'error');
      return;
    }

    GameState.myTerritory.gold -= goldCost;
    GameState.myTerritory.food -= foodCost;

    const expedition = GameState.explorationSystem.startExpedition(origin, explorer.id, x, y, isExpedited);
    explorer.currentState = AdventurerState.DISPATCHED;
    setSelectingTarget(false);

    EventBus.getInstance().publish({
      type: GameEventType.MISSIONS_CHANGED,
      payload: { reason: 'DISPATCHED', missionType: TaskType.EXPLORE }
    });
    renderMap();
    refreshExplorationUI();
    ToastManager.show(`👁️ ${explorer.name} 已指派出發！(消耗 ${goldCost}金 / ${foodCost}糧)`, 'success');
  });
}

function showDispatchModal(
  check: ExplorationTargetCheck,
  idleAdventurers: any[],
  onConfirm: (explorerId: string, isExpedited: boolean) => void
): void {
  const existingModal = document.getElementById('modal-exploration-dispatch');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-exploration-dispatch';
  modal.className = 'modal-overlay active';
  modal.style.zIndex = '2200';

  let selectedExplorerId = idleAdventurers[0]?.id || '';
  let isExpedited = false;

  const currentGold = GameState.myTerritory.gold;
  const currentFood = GameState.myTerritory.food;

  const hideTooltip = () => {
    const tEl = document.getElementById('adv-tooltip');
    if (tEl) tEl.style.opacity = '0';
  };

  const renderContent = () => {
    const stdDays = check.requiredDays ?? 1;
    const stdGold = check.goldCost ?? 100;
    const stdFood = check.foodCost ?? 20;

    const expDays = check.expeditedDays ?? stdDays;
    const expGold = check.expeditedGoldCost ?? stdGold;
    const expFood = check.expeditedFoodCost ?? stdFood;

    const curGoldCost = isExpedited ? expGold : stdGold;
    const curFoodCost = isExpedited ? expFood : stdFood;
    const curDays = isExpedited ? expDays : stdDays;

    const hasGold = currentGold >= curGoldCost;
    const hasFood = currentFood >= curFoodCost;
    const canAfford = hasGold && hasFood;

    if (!idleAdventurers.some(a => a.id === selectedExplorerId)) {
      selectedExplorerId = idleAdventurers[0]?.id || '';
    }

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 520px; padding: 24px; border-radius: 12px; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.15); color: #f8fafc; font-family: sans-serif; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
        <h3 style="margin-top: 0; color: #38bdf8; font-size: 1.25rem; display: flex; align-items: center; gap: 8px;">
          <span>🧭</span> 派遣迷霧探險隊
        </h3>
        
        <div style="margin: 16px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <label style="font-size: 0.9rem; color: #94a3b8; font-weight: bold;">⚔️ 可選冒險者：</label>
            <span style="font-size: 0.75rem; color: #64748b;">(點擊選擇出發斥候)</span>
          </div>
          <div id="exp-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(95px, 1fr)); gap: 10px; max-height: 220px; overflow-y: auto; padding: 8px; background: rgba(15, 23, 42, 0.7); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
          </div>
        </div>

        ${check.isLongDistance ? `
          <div style="margin: 16px 0; background: rgba(30, 41, 59, 0.7); padding: 12px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.3);">
            <div style="font-size: 0.85rem; color: #fbbf24; margin-bottom: 8px;">⚠️ 該探索目標較遠 (標準耗時 ${stdDays} 天)，可選擇加倍資源進行急行！</div>
            <div style="display: flex; gap: 10px;">
              <button id="exp-mode-std" type="button" style="flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid ${!isExpedited ? '#38bdf8' : '#475569'}; background: ${!isExpedited ? '#0284c7' : '#1e293b'}; color: #fff; cursor: pointer; font-size: 0.85rem;">
                標準行程<br><span style="font-size: 0.75rem; opacity: 0.9;">${stdDays}天 (${stdGold}金/${stdFood}糧)</span>
              </button>
              <button id="exp-mode-exp" type="button" style="flex: 1; padding: 8px 12px; border-radius: 6px; border: 1px solid ${isExpedited ? '#f59e0b' : '#475569'}; background: ${isExpedited ? '#d97706' : '#1e293b'}; color: #fff; cursor: pointer; font-size: 0.85rem;">
                ⚡ 急行探險<br><span style="font-size: 0.75rem; opacity: 0.9;">${expDays}天 (${expGold}金/${expFood}糧)</span>
              </button>
            </div>
          </div>
        ` : ''}

        <div style="margin: 16px 0; background: rgba(15, 23, 42, 0.6); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-size: 0.9rem; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">探索費時：</span>
            <span style="font-weight: bold; color: #e2e8f0;">${curDays} 天</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">金幣消耗：</span>
            <span style="font-weight: bold; color: ${hasGold ? '#4ade80' : '#f87171'};">${curGoldCost} 金 (庫存: ${currentGold})</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #94a3b8;">糧食消耗：</span>
            <span style="font-weight: bold; color: ${hasFood ? '#4ade80' : '#f87171'};">${curFoodCost} 糧 (庫存: ${currentFood})</span>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
          <button id="exp-btn-cancel" type="button" style="padding: 8px 16px; border-radius: 6px; background: #334155; color: #cbd5e1; border: none; cursor: pointer; font-size: 0.9rem;">取消</button>
          <button id="exp-btn-confirm" type="button" ${!canAfford || !selectedExplorerId ? 'disabled' : ''} style="padding: 8px 20px; border-radius: 6px; background: ${canAfford && selectedExplorerId ? '#0284c7' : '#475569'}; color: #fff; border: none; cursor: ${canAfford && selectedExplorerId ? 'pointer' : 'not-allowed'}; font-weight: bold; font-size: 0.9rem;">出發探險</button>
        </div>
      </div>
    `;

    if (!document.body.contains(modal)) {
      document.body.appendChild(modal);
    }

    const cardsGrid = document.getElementById('exp-cards-grid');
    if (cardsGrid) {
      cardsGrid.innerHTML = '';
      idleAdventurers.forEach(adv => {
        const isSelected = adv.id === selectedExplorerId;
        const card = document.createElement('div');
        card.className = 'adventurer-card';
        card.style.cursor = 'pointer';
        card.style.transition = 'all 0.15s ease';
        
        if (isSelected) {
          card.style.borderColor = '#38bdf8';
          card.style.boxShadow = '0 0 12px rgba(56, 189, 248, 0.6)';
          card.style.transform = 'scale(1.02)';
        } else {
          card.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          card.style.opacity = '0.85';
        }

        card.innerHTML = renderAdventurerCard(adv, {
          cornerLabel: isSelected ? '✓ 選擇' : undefined
        });

        const displayClass = (adv as any).currentClass || adv.job?.name || '冒險者';
        const tooltipHtml = `【${adv.name}】<br/>Lv.${adv.level ?? 1} ${displayClass}<br/>戰力：${adv.power ?? 0}`;

        card.addEventListener('mouseenter', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) {
            tEl.innerHTML = tooltipHtml;
            tEl.style.opacity = '1';
          }
        });
        card.addEventListener('mousemove', (e) => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
        });
        card.addEventListener('mouseleave', () => {
          hideTooltip();
        });

        card.addEventListener('click', () => {
          selectedExplorerId = adv.id;
          hideTooltip();
          renderContent();
        });

        cardsGrid.appendChild(card);
      });
    }

    const btnStd = document.getElementById('exp-mode-std');
    const btnExp = document.getElementById('exp-mode-exp');
    if (btnStd) {
      btnStd.onclick = () => {
        isExpedited = false;
        renderContent();
      };
    }
    if (btnExp) {
      btnExp.onclick = () => {
        isExpedited = true;
        renderContent();
      };
    }

    const btnCancel = document.getElementById('exp-btn-cancel');
    if (btnCancel) {
      btnCancel.onclick = () => {
        hideTooltip();
        modal.remove();
      };
    }

    const btnConfirm = document.getElementById('exp-btn-confirm');
    if (btnConfirm) {
      btnConfirm.onclick = () => {
        if (!canAfford || !selectedExplorerId) return;
        hideTooltip();
        modal.remove();
        onConfirm(selectedExplorerId, isExpedited);
      };
    }
  };

  renderContent();
}

export function refreshExplorationUI(): void {
  const activeExpeditions = GameState.explorationSystem.getActiveExpeditions();
  const maxExpeditions = GameState.explorationSystem.getMaxExpeditions();

  const statusText = document.getElementById('exploration-status-text');
  if (statusText) {
    if (activeExpeditions.length > 0) {
      statusText.textContent = `探險隊出發中 (${activeExpeditions.length}/${maxExpeditions})`;
    } else {
      statusText.textContent = `準備探險 (${activeExpeditions.length}/${maxExpeditions})`;
    }
  }

  const btn = document.getElementById('btn-toggle-exploration');
  if (btn) {
    if (isSelectingTarget) {
      btn.style.background = '#0284c7';
      btn.style.borderColor = '#38bdf8';
    } else {
      btn.style.background = '';
      btn.style.borderColor = '';
    }
  }
}

export function resetExplorationControllerState(): void {
  setSelectingTarget(false);
  const modal = document.getElementById('modal-exploration-dispatch');
  if (modal) modal.remove();
  const tEl = document.getElementById('adv-tooltip');
  if (tEl) tEl.style.opacity = '0';
  refreshExplorationUI();
}
