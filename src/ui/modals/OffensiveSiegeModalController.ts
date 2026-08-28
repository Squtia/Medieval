import { GameState } from '../../core/GameState';
import { FormationDB } from '../../systems/FormationDB';
import { renderAdventurerCard, getAdventurerTooltipHtml } from '../components/AdventurerCard';
import { positionFloatingElement } from '../FloatingPosition';
import { ToastManager } from '../ToastManager';
import { InteractiveCombatSession } from '../../systems/combat/InteractiveCombatSession';
import { CombatUIManager } from '../CombatUIManager';
import { CombatSystem } from '../../systems/CombatSystem';
import { 
  NobleTitle, 
  SIEGE_ENGINE_CONFIGS, 
  SiegeEngineType, 
  MapNode, 
  MonsterInstance, 
  TerrainType, 
  ElementType, 
  MonsterRace, 
  FormationRow, 
  AdventurerState,
  SiegeBattleMode,
  SiegeRole
} from '../../models/types';
import { LordCommanderSystem } from '../../systems/combat/LordCommanderSystem';
import { advanceDay } from '../../core/GameLoop';
import { UIManager } from '../UIManager';
import { DataStore } from '../../systems/DataStore';
import monstersJson from '../../data/monsters.json';

export interface OffensiveSquadConfig {
  formationId: string;
  gridMap: Record<string, string>;
  selectedIds: Set<string>;
}

export class OffensiveSiegeModalController {
  private static isInitialized = false;
  private static targetNode: MapNode | null = null;
  private static currentTabIndex: number = 0; // 0, 1, 2 對應 3 個梯隊

  // 3 個先鋒/後續作戰梯隊
  private static squads: OffensiveSquadConfig[] = [
    { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() },
    { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() },
    { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() }
  ];

  // 全局唯一出征軍團兵力 (跨梯隊共享，絕不重複發放或重置)
  private static assignedTroops = {
    infantry: 0,
    archer: 0,
    cavalry: 0
  };

  // 全局攜帶攻城器械 (從領地庫存調派，各限帶 1 台)
  private static carryEngines = {
    ram: false,
    trebuchet: false
  };

  private static dragAdvId: string | null = null;
  private static dragSourceSlot: string | null = null;

  public static init(): void {
    if (this.isInitialized) return;

    const modal = document.getElementById('modal-offensive-siege');
    if (!modal) return;

    const btnCancel = document.getElementById('btn-cancel-off-siege');
    const btnLordStart = document.getElementById('btn-start-off-siege-lord');
    const btnAutoStart = document.getElementById('btn-start-off-siege-auto');
    const formationSelect = document.getElementById('off-siege-formation-select') as HTMLSelectElement;

    // 梯隊頁籤切換
    const tabBtns = document.querySelectorAll('.btn-off-siege-tab');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const tabIdx = parseInt(target.dataset.squadTab || '0', 10);
        this.switchTab(tabIdx);
      });
    });

    // 陣型選擇下拉選單
    if (formationSelect) {
      formationSelect.innerHTML = Object.values(FormationDB.Formations).map((f: import('../../systems/FormationDB').FormationConfig) =>
        `<option value="${f.id}">${f.icon} ${f.name}</option>`
      ).join('');

      formationSelect.addEventListener('change', () => {
        const currentSquad = this.squads[this.currentTabIndex];
        currentSquad.formationId = formationSelect.value;
        this.renderGrid();
      });
    }

    // 兵力調派輸入監聽
    const infInput = document.getElementById('input-off-infantry') as HTMLInputElement;
    const arcInput = document.getElementById('input-off-archer') as HTMLInputElement;
    const cavInput = document.getElementById('input-off-cavalry') as HTMLInputElement;

    const onTroopChange = () => {
      const territory = GameState.myTerritory;
      const maxInf = territory.workers?.['INFANTRY'] || 0;
      const maxArc = territory.workers?.['ARCHER'] || 0;
      const maxCav = territory.workers?.['CAVALRY'] || 0;

      let inf = parseInt(infInput?.value || '0', 10);
      let arc = parseInt(arcInput?.value || '0', 10);
      let cav = parseInt(cavInput?.value || '0', 10);

      inf = Math.max(0, Math.min(maxInf, isNaN(inf) ? 0 : inf));
      arc = Math.max(0, Math.min(maxArc, isNaN(arc) ? 0 : arc));
      cav = Math.max(0, Math.min(maxCav, isNaN(cav) ? 0 : cav));

      if (infInput) infInput.value = inf.toString();
      if (arcInput) arcInput.value = arc.toString();
      if (cavInput) cavInput.value = cav.toString();

      this.assignedTroops = { infantry: inf, archer: arc, cavalry: cav };
      this.updateTroopPreviews();
      this.updateProvisions();
    };

    infInput?.addEventListener('input', onTroopChange);
    arcInput?.addEventListener('input', onTroopChange);
    cavInput?.addEventListener('input', onTroopChange);

    document.getElementById('btn-off-troops-max')?.addEventListener('click', () => {
      const territory = GameState.myTerritory;
      const maxInf = territory.workers?.['INFANTRY'] || 0;
      const maxArc = territory.workers?.['ARCHER'] || 0;
      const maxCav = territory.workers?.['CAVALRY'] || 0;
      if (infInput) infInput.value = maxInf.toString();
      if (arcInput) arcInput.value = maxArc.toString();
      if (cavInput) cavInput.value = maxCav.toString();
      onTroopChange();
    });

    document.getElementById('btn-off-troops-zero')?.addEventListener('click', () => {
      if (infInput) infInput.value = '0';
      if (arcInput) arcInput.value = '0';
      if (cavInput) cavInput.value = '0';
      onTroopChange();
    });

    // 攻城器械攜帶勾選 (從庫存調派各限帶 1 台)
    const checkRam = document.getElementById('check-off-carry-ram') as HTMLInputElement;
    const checkTreb = document.getElementById('check-off-carry-trebuchet') as HTMLInputElement;

    checkRam?.addEventListener('change', () => {
      this.carryEngines.ram = checkRam.checked;
      this.updateProvisions();
    });

    checkTreb?.addEventListener('change', () => {
      this.carryEngines.trebuchet = checkTreb.checked;
      this.updateProvisions();
    });

    // 智慧自動填補按鈕
    document.getElementById('btn-off-siege-smart-fill')?.addEventListener('click', () => {
      this.smartAutoFill();
    });

    btnCancel?.addEventListener('click', () => {
      this.close();
    });

    // 👑 領主親征實時攻城按鈕
    btnLordStart?.addEventListener('click', () => {
      this.launchCampaign(true);
    });

    // ⚔️ 委託先鋒軍團進攻按鈕
    btnAutoStart?.addEventListener('click', () => {
      this.launchCampaign(false);
    });

    this.isInitialized = true;
  }

  public static show(targetNode: MapNode): void {
    this.init();
    this.targetNode = targetNode;
    this.currentTabIndex = 0;

    const modal = document.getElementById('modal-offensive-siege');
    if (!modal) return;

    const territory = GameState.myTerritory;
    if (!territory.siegeEngineStock) {
      territory.siegeEngineStock = { ram: 0, trebuchet: 0 };
    }

    // 設置標題與目標資訊
    const titleEl = document.getElementById('off-siege-modal-title');
    const gateHpEl = document.getElementById('off-siege-gate-hp-val');
    const targetBadgeEl = document.getElementById('off-siege-target-badge');

    if (titleEl) titleEl.innerHTML = `<span>⚔️ 大軍攻城遠征部署 ── 【${targetNode.name}】</span>`;
    if (targetBadgeEl) targetBadgeEl.textContent = `🏰 目標：${targetNode.name}`;

    // 依據 SSOT：優先從據點工坊 (SubjugationTemplate) 讀取城牆設定
    const { template, gateHp } = this.getFortressTemplateAndGateHp(targetNode);
    if (gateHpEl) gateHpEl.textContent = gateHp.toLocaleString();

    // 初始化兵力
    const infInput = document.getElementById('input-off-infantry') as HTMLInputElement;
    const arcInput = document.getElementById('input-off-archer') as HTMLInputElement;
    const cavInput = document.getElementById('input-off-cavalry') as HTMLInputElement;

    const maxInf = territory.workers?.['INFANTRY'] || 0;
    const maxArc = territory.workers?.['ARCHER'] || 0;
    const maxCav = territory.workers?.['CAVALRY'] || 0;

    const infTotalEl = document.getElementById('off-infantry-total');
    const arcTotalEl = document.getElementById('off-archer-total');
    const cavTotalEl = document.getElementById('off-cavalry-total');

    if (infTotalEl) infTotalEl.textContent = `${maxInf}`;
    if (arcTotalEl) arcTotalEl.textContent = `${maxArc}`;
    if (cavTotalEl) cavTotalEl.textContent = `${maxCav}`;

    if (infInput) { infInput.max = maxInf.toString(); infInput.value = maxInf.toString(); }
    if (arcInput) { arcInput.max = maxArc.toString(); arcInput.value = maxArc.toString(); }
    if (cavInput) { cavInput.max = maxCav.toString(); cavInput.value = maxCav.toString(); }

    this.assignedTroops = { infantry: maxInf, archer: maxArc, cavalry: maxCav };
    this.carryEngines = { ram: false, trebuchet: false };

    // 器械庫存與 Checkbox 狀態
    const checkRam = document.getElementById('check-off-carry-ram') as HTMLInputElement;
    const checkTreb = document.getElementById('check-off-carry-trebuchet') as HTMLInputElement;
    const ramStatusEl = document.getElementById('off-ram-stock-status');
    const trebStatusEl = document.getElementById('off-treb-stock-status');

    const ramStock = territory.siegeEngineStock.ram || 0;
    const trebStock = territory.siegeEngineStock.trebuchet || 0;

    if (checkRam) {
      checkRam.checked = false;
      checkRam.disabled = ramStock <= 0;
    }
    if (checkTreb) {
      checkTreb.checked = false;
      checkTreb.disabled = trebStock <= 0;
    }

    if (ramStatusEl) {
      ramStatusEl.textContent = ramStock > 0 ? `庫存: ${ramStock} 台 (可攜帶 1 台)` : '⚠️ 領地無庫存 (請至鍛造屋打造)';
      ramStatusEl.style.color = ramStock > 0 ? '#4ade80' : '#ef4444';
    }

    if (trebStatusEl) {
      trebStatusEl.textContent = trebStock > 0 ? `庫存: ${trebStock} 台 (可攜帶 1 台)` : '⚠️ 領地無庫存 (請至鍛造屋打造)';
      trebStatusEl.style.color = trebStock > 0 ? '#4ade80' : '#ef4444';
    }

    // 清空梯隊配置並智慧填補第 1 梯隊
    this.squads = [
      { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() },
      { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() },
      { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() }
    ];

    this.smartAutoFill();
    this.updateTroopPreviews();
    this.updateProvisions();

    this.switchTab(0);
    modal.style.display = 'flex';
  }

  public static close(): void {
    const modal = document.getElementById('modal-offensive-siege');
    if (modal) modal.style.display = 'none';
  }

  private static switchTab(tabIndex: number): void {
    this.currentTabIndex = tabIndex;

    const tabBtns = document.querySelectorAll('.btn-off-siege-tab');
    tabBtns.forEach((btn, idx) => {
      if (idx === tabIndex) {
        btn.classList.add('active');
        (btn as HTMLElement).style.background = '#ea580c';
        (btn as HTMLElement).style.borderColor = '#f97316';
        (btn as HTMLElement).style.color = '#fff';
      } else {
        btn.classList.remove('active');
        (btn as HTMLElement).style.background = '#334155';
        (btn as HTMLElement).style.borderColor = '#475569';
        (btn as HTMLElement).style.color = '#cbd5e1';
      }
    });

    const currentSquad = this.squads[this.currentTabIndex];
    const formationSelect = document.getElementById('off-siege-formation-select') as HTMLSelectElement;
    if (formationSelect) {
      formationSelect.value = currentSquad.formationId || 'DEFAULT';
    }

    this.renderAdvList();
    this.renderGrid();
  }

  private static updateTroopPreviews(): void {
    const infShieldEl = document.getElementById('off-infantry-shield-preview');
    const arcDmgEl = document.getElementById('off-archer-dmg-preview');

    if (infShieldEl) infShieldEl.textContent = (this.assignedTroops.infantry * 50).toLocaleString();
    if (arcDmgEl) arcDmgEl.textContent = Math.floor(Math.sqrt(this.assignedTroops.archer) * 32).toLocaleString();
  }

  /**
   * 計算行軍天數與隨軍口糧消耗
   */
  private static calculateMarchDays(): { totalDays: number; baseDays: number; engineDays: number } {
    const targetNode = this.targetNode;
    let baseDays = 1;

    if (targetNode) {
      // 依曼哈頓距離或據點距離計算基礎天數
      const allNodes = GameState.mapSystem ? GameState.mapSystem.getNodes() : [];
      const homeNode = allNodes.find(n => n.isCapital || n.id === GameState.myTerritory.currentCountryId) || allNodes[0];
      if (homeNode && targetNode.x !== undefined && targetNode.y !== undefined) {
        const dist = Math.abs((targetNode.x || 0) - (homeNode.x || 0)) + Math.abs((targetNode.y || 0) - (homeNode.y || 0));
        baseDays = Math.max(1, Math.ceil(dist / 8));
      }
    }

    // 重型器械每帶 1 台行軍 +1 天
    const engineDays = (this.carryEngines.ram ? 1 : 0) + (this.carryEngines.trebuchet ? 1 : 0);
    const totalDays = baseDays + engineDays;

    return { totalDays, baseDays, engineDays };
  }

  private static updateProvisions(): void {
    const territory = GameState.myTerritory;
    const { totalDays, baseDays, engineDays } = this.calculateMarchDays();

    // 更新行軍天數顯示
    const marchValEl = document.getElementById('off-siege-march-days-val');
    const baseDaysEl = document.getElementById('off-siege-base-days');
    const engineDaysEl = document.getElementById('off-siege-engine-days');

    if (marchValEl) marchValEl.textContent = totalDays.toString();
    if (baseDaysEl) baseDaysEl.textContent = baseDays.toString();
    if (engineDaysEl) engineDaysEl.textContent = engineDays.toString();

    // 隨軍口糧：隨行人員 * 行軍天數 * 2 (往返)
    const totalAdvCount = this.squads.reduce((acc, s) => acc + s.selectedIds.size, 0);
    const totalTroops = this.assignedTroops.infantry + this.assignedTroops.archer + this.assignedTroops.cavalry;
    const reqFood = Math.max(10, Math.ceil((totalAdvCount * 3 + totalTroops * 0.2) * totalDays * 2));

    const provValEl = document.getElementById('off-siege-provisions-val');
    const foodOwnedEl = document.getElementById('off-siege-food-owned');

    if (provValEl) {
      provValEl.textContent = reqFood.toString();
      provValEl.style.color = territory.food >= reqFood ? '#4ade80' : '#ef4444';
    }
    if (foodOwnedEl) foodOwnedEl.textContent = territory.food.toLocaleString();

    this.updateResourceStatusValidation(reqFood, totalDays);
  }

  private static updateResourceStatusValidation(reqFood: number, marchDays: number): void {
    const territory = GameState.myTerritory;
    const statusMsgEl = document.getElementById('off-siege-status-msg');
    if (!statusMsgEl) return;

    const errors: string[] = [];

    // 1. 糧草檢查
    if (territory.food < reqFood) {
      errors.push(`糧草不足 (需 ${reqFood} / 現有 ${territory.food})`);
    }

    // 2. 器械庫存調派檢查
    const stock = territory.siegeEngineStock || { ram: 0, trebuchet: 0 };
    if (this.carryEngines.ram && (stock.ram || 0) < 1) {
      errors.push('撞木衝車庫存不足 (請至鍛造屋打造)');
    }
    if (this.carryEngines.trebuchet && (stock.trebuchet || 0) < 1) {
      errors.push('重型投石機庫存不足 (請至鍛造屋打造)');
    }

    // 3. 梯隊檢查
    if (this.squads[0].selectedIds.size === 0) {
      errors.push('第 1 梯隊未配置先鋒傭兵');
    }

    if (errors.length > 0) {
      statusMsgEl.style.color = '#f87171';
      statusMsgEl.style.borderColor = '#ef4444';
      statusMsgEl.style.background = 'rgba(239,68,68,0.2)';
      statusMsgEl.innerHTML = `⚠️ ${errors.join(' | ')}`;
    } else {
      statusMsgEl.style.color = '#4ade80';
      statusMsgEl.style.borderColor = 'rgba(74,222,128,0.4)';
      statusMsgEl.style.background = 'rgba(74,222,128,0.1)';
      statusMsgEl.innerHTML = `✅ 遠征物資與軍備就緒 (預計單程行軍 ${marchDays} 天)，隨時可出征`;
    }
  }

  private static renderAdvList(): void {
    const listEl = document.getElementById('off-siege-adv-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const currentSquad = this.squads[this.currentTabIndex];
    const otherSquadsSelectedIds = new Set<string>();
    this.squads.forEach((sq, idx) => {
      if (idx !== this.currentTabIndex) {
        sq.selectedIds.forEach(id => otherSquadsSelectedIds.add(id));
      }
    });

    const availableAdvs = (GameState.adventurers || []).filter(a => {
      return !a.isWounded && a.currentState !== AdventurerState.CAPTURED;
    });

    availableAdvs.forEach(adv => {
      const isSelectedInCurrent = currentSquad.selectedIds.has(adv.id);
      const isSelectedInOther = otherSquadsSelectedIds.has(adv.id);

      const cardWrapper = document.createElement('div');
      cardWrapper.className = 'adventurer-card';
      cardWrapper.style.transform = 'scale(0.88)';
      cardWrapper.style.transformOrigin = 'center';
      cardWrapper.style.margin = '-4px';
      cardWrapper.style.cursor = isSelectedInOther ? 'not-allowed' : 'pointer';
      cardWrapper.style.opacity = isSelectedInOther ? '0.35' : (isSelectedInCurrent ? '0.5' : '1');
      cardWrapper.style.border = isSelectedInCurrent ? '2px solid #ea580c' : '';
      cardWrapper.style.boxShadow = isSelectedInCurrent ? '0 0 10px rgba(234, 88, 12, 0.5)' : '';

      cardWrapper.innerHTML = renderAdventurerCard(adv);

      if (isSelectedInOther) {
        const badge = document.createElement('div');
        badge.style.position = 'absolute';
        badge.style.top = '4px';
        badge.style.right = '4px';
        badge.style.background = 'rgba(239,68,68,0.85)';
        badge.style.color = '#fff';
        badge.style.fontSize = '0.65rem';
        badge.style.padding = '1px 4px';
        badge.style.borderRadius = '3px';
        badge.textContent = '已在其他梯隊';
        cardWrapper.appendChild(badge);
      }

      if (!isSelectedInOther && !isSelectedInCurrent) {
        cardWrapper.draggable = true;
        cardWrapper.addEventListener('dragstart', (e) => {
          this.dragAdvId = adv.id;
          this.dragSourceSlot = 'pool';
          e.dataTransfer?.setData('text/plain', adv.id);
          const tEl = document.getElementById('adv-tooltip') || document.getElementById('common-tooltip');
          if (tEl) tEl.style.display = 'none';
        });
      }

      const tooltipHtml = getAdventurerTooltipHtml(adv);
      cardWrapper.addEventListener('mouseenter', () => {
        const tEl = document.getElementById('adv-tooltip') || document.getElementById('common-tooltip');
        if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.display = 'block'; }
      });
      cardWrapper.addEventListener('mousemove', (e) => {
        const tEl = document.getElementById('adv-tooltip') || document.getElementById('common-tooltip');
        if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
      });
      cardWrapper.addEventListener('mouseleave', () => {
        const tEl = document.getElementById('adv-tooltip') || document.getElementById('common-tooltip');
        if (tEl) tEl.style.display = 'none';
      });

      cardWrapper.addEventListener('click', () => {
        const tEl = document.getElementById('adv-tooltip') || document.getElementById('common-tooltip');
        if (tEl) tEl.style.display = 'none';

        if (isSelectedInOther) {
          ToastManager.show('該傭兵已被指派至其他梯隊！');
          return;
        }

        if (isSelectedInCurrent) {
          this.removeAdvFromCurrentSquad(adv.id);
        } else {
          this.autoPlaceAdvInCurrentSquad(adv.id);
        }
      });

      listEl.appendChild(cardWrapper);
    });
  }

  /**
   * 攻城戰九宮格渲染 (標準進攻席位視角：左側後排 -> 中間中排 -> 右側前排衝鋒線)
   */
  private static renderGrid(): void {
    const gridEl = document.getElementById('off-siege-grid');
    if (!gridEl) return;

    gridEl.innerHTML = '';
    const currentSquad = this.squads[this.currentTabIndex];
    const activeFormation = FormationDB.getFormation(currentSquad.formationId);
    const isFormationActive = FormationDB.isFormationActive(currentSquad.gridMap, currentSquad.formationId);

    // 進攻席位九宮格映射：
    // 欄 vc=0 ➔ 最左欄 (後排, r=2), vc=1 ➔ 中間欄 (中排, r=1), vc=2 ➔ 最右欄 (前排, r=0, 迎敵衝鋒線)
    // 列 vr=0 ➔ 上路 (c=0), vr=1 ➔ 中路 (c=1), vr=2 ➔ 下路 (c=2)
    for (let vr = 0; vr < 3; vr++) {
      for (let vc = 0; vc < 3; vc++) {
        const r = 2 - vc; // 0=前排 (在最右欄 vc=2), 1=中排 (vc=1), 2=後排 (在最左欄 vc=0)
        const c = vr;     // 0, 1, 2
        const slotId = `${r}_${c}`;
        const advId = currentSquad.gridMap[slotId];
        const adv = advId ? GameState.adventurers.find(a => a.id === advId) : null;

        const isRequired = activeFormation?.requiredSlots?.some(s => s.row === r && s.col === c);

        const slot = document.createElement('div');
        slot.className = 'grid-slot';
        slot.style.width = '100px';
        slot.style.height = '110px';
        slot.style.border = '2px dashed ' + (isRequired ? (isFormationActive ? '#10b981' : '#f97316') : 'rgba(234,88,12,0.3)');
        slot.style.borderRadius = '6px';
        slot.style.background = isFormationActive && isRequired ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.45)';
        slot.style.position = 'relative';
        slot.style.display = 'flex';
        slot.style.alignItems = 'center';
        slot.style.justifyContent = 'center';
        slot.dataset.slotId = slotId;

        slot.addEventListener('dragover', (e) => { e.preventDefault(); });
        slot.addEventListener('drop', (e) => this.handleDrop(e, slotId));

        if (adv) {
          const cardDiv = document.createElement('div');
          cardDiv.className = 'adventurer-card';
          cardDiv.style.transform = 'scale(0.88)';
          cardDiv.style.transformOrigin = 'center';
          cardDiv.style.pointerEvents = 'auto';
          cardDiv.draggable = true;

          cardDiv.innerHTML = renderAdventurerCard(adv, {
            showDismissBtn: true,
            dismissId: adv.id
          });

          const tooltipHtml = getAdventurerTooltipHtml(adv);
          cardDiv.addEventListener('mouseenter', () => {
            const tEl = document.getElementById('adv-tooltip') || document.getElementById('common-tooltip');
            if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.display = 'block'; }
          });
          cardDiv.addEventListener('mousemove', (e) => {
            const tEl = document.getElementById('adv-tooltip') || document.getElementById('common-tooltip');
            if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
          });
          cardDiv.addEventListener('mouseleave', () => {
            const tEl = document.getElementById('adv-tooltip') || document.getElementById('common-tooltip');
            if (tEl) tEl.style.display = 'none';
          });

          cardDiv.addEventListener('dragstart', (e) => {
            this.dragAdvId = adv.id;
            this.dragSourceSlot = slotId;
            e.dataTransfer?.setData('text/plain', adv.id);
          });

          // 點擊卡片右上角 ✕ 移除
          const dismissBtn = cardDiv.querySelector('.dismiss-btn');
          dismissBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            delete currentSquad.gridMap[slotId];
            currentSquad.selectedIds.delete(adv.id);
            this.renderAdvList();
            this.renderGrid();
            this.updateProvisions();
          });

          slot.appendChild(cardDiv);
        } else {
          slot.innerHTML = `<span style="color: #64748b; font-size: 0.75rem;">${vc === 0 ? '+ 後排' : (vc === 1 ? '+ 中排' : '+ 前排')}</span>`;
        }

        gridEl.appendChild(slot);
      }
    }
  }

  private static handleDrop(e: DragEvent, targetSlotId: string): void {
    e.preventDefault();
    if (!this.dragAdvId) return;

    const currentSquad = this.squads[this.currentTabIndex];
    const targetAdvId = currentSquad.gridMap[targetSlotId];

    if (this.dragSourceSlot && this.dragSourceSlot !== 'pool') {
      // 在九宮格內部交換位置
      if (targetAdvId) {
        currentSquad.gridMap[this.dragSourceSlot] = targetAdvId;
      } else {
        delete currentSquad.gridMap[this.dragSourceSlot];
      }
      currentSquad.gridMap[targetSlotId] = this.dragAdvId;
    } else {
      // 從傭兵池拖入
      if (!targetAdvId && currentSquad.selectedIds.size >= 5) {
        ToastManager.show('每個梯隊最多只能編入 5 名傭兵！');
        return;
      }

      if (targetAdvId) {
        currentSquad.selectedIds.delete(targetAdvId);
      }
      currentSquad.gridMap[targetSlotId] = this.dragAdvId;
      currentSquad.selectedIds.add(this.dragAdvId);
    }

    this.dragAdvId = null;
    this.dragSourceSlot = null;
    this.renderAdvList();
    this.renderGrid();
    this.updateProvisions();
  }

  private static autoPlaceAdvInCurrentSquad(advId: string): void {
    const currentSquad = this.squads[this.currentTabIndex];
    if (currentSquad.selectedIds.size >= 5) {
      ToastManager.show('⚠️ 該梯隊已滿 (最多 5 名傭兵)！');
      return;
    }

    // 尋找第一個空格 (依前排 -> 中排 -> 後排順序)
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const slotKey = `${r}_${c}`;
        if (!currentSquad.gridMap[slotKey]) {
          this.placeAdvInSlot(advId, slotKey);
          return;
        }
      }
    }
  }

  private static placeAdvInSlot(advId: string, slotKey: string): void {
    const currentSquad = this.squads[this.currentTabIndex];

    // 清理該傭兵在當前梯隊的舊格子
    Object.entries(currentSquad.gridMap).forEach(([k, v]) => {
      if (v === advId) delete currentSquad.gridMap[k];
    });

    currentSquad.gridMap[slotKey] = advId;
    currentSquad.selectedIds.add(advId);

    this.renderAdvList();
    this.renderGrid();
    this.updateProvisions();
  }

  private static removeAdvFromCurrentSquad(advId: string): void {
    const currentSquad = this.squads[this.currentTabIndex];
    currentSquad.selectedIds.delete(advId);
    Object.entries(currentSquad.gridMap).forEach(([k, v]) => {
      if (v === advId) delete currentSquad.gridMap[k];
    });

    this.renderAdvList();
    this.renderGrid();
    this.updateProvisions();
  }

  private static smartAutoFill(): void {
    const availableAdvs = (GameState.adventurers || [])
      .filter(a => !a.isWounded && a.currentState !== AdventurerState.CAPTURED)
      .sort((a, b) => ((b as any).power || 10) - ((a as any).power || 10));

    if (availableAdvs.length === 0) {
      ToastManager.show('⚠️ 沒有可用傭兵！');
      return;
    }

    const currentSquad = this.squads[this.currentTabIndex];
    currentSquad.gridMap = {};
    currentSquad.selectedIds.clear();

    const otherSquadsSelectedIds = new Set<string>();
    this.squads.forEach((sq, idx) => {
      if (idx !== this.currentTabIndex) {
        sq.selectedIds.forEach(id => otherSquadsSelectedIds.add(id));
      }
    });

    const fillAdvs = availableAdvs.filter(a => !otherSquadsSelectedIds.has(a.id)).slice(0, 5);

    fillAdvs.forEach((adv, idx) => {
      const row = idx % 3;
      const col = Math.floor(idx / 3);
      const slotKey = `${row}_${col}`;
      currentSquad.gridMap[slotKey] = adv.id;
      currentSquad.selectedIds.add(adv.id);
    });

    this.renderAdvList();
    this.renderGrid();
    this.updateProvisions();
    ToastManager.show(`⚡ 已為第 ${this.currentTabIndex + 1} 梯隊填入最高戰力成員！`);
  }

  private static launchCampaign(isLordCampaign: boolean): void {
    const territory = GameState.myTerritory;
    const targetNode = this.targetNode;
    if (!targetNode) return;

    const primarySquad = this.squads[0];
    if (primarySquad.selectedIds.size === 0) {
      ToastManager.show('⚠️ 請至少在第 1 梯隊中配置 1 名先鋒傭兵！');
      return;
    }

    const { totalDays, baseDays, engineDays } = this.calculateMarchDays();

    // 1. 隨軍糧草檢查
    const totalAdvCount = this.squads.reduce((acc, s) => acc + s.selectedIds.size, 0);
    const totalTroops = this.assignedTroops.infantry + this.assignedTroops.archer + this.assignedTroops.cavalry;
    const reqFood = Math.max(10, Math.ceil((totalAdvCount * 3 + totalTroops * 0.2) * totalDays * 2));

    if (territory.food < reqFood) {
      ToastManager.show(`⚠️ 領地存糧不足！遠征行軍需 ${reqFood} 糧食 (現有 ${territory.food})！`);
      return;
    }

    // 2. 器械庫存調派檢查與扣除
    if (!territory.siegeEngineStock) {
      territory.siegeEngineStock = { ram: 0, trebuchet: 0 };
    }

    if (this.carryEngines.ram && territory.siegeEngineStock.ram < 1) {
      ToastManager.show('⚠️ 領地衝車庫存不足！請先至鍛造屋打造！');
      return;
    }

    if (this.carryEngines.trebuchet && territory.siegeEngineStock.trebuchet < 1) {
      ToastManager.show('⚠️ 領地投石機庫存不足！請先至鍛造屋打造！');
      return;
    }

    // 3. 正式扣除糧食與器械庫存 (出征調派)
    territory.food -= reqFood;
    if (this.carryEngines.ram) territory.siegeEngineStock.ram--;
    if (this.carryEngines.trebuchet) territory.siegeEngineStock.trebuchet--;

    // 4. 鎖定並標記所有參戰梯隊傭兵為 DISPATCHED
    const allSelectedIds: string[] = [];
    this.squads.forEach(s => s.selectedIds.forEach(id => allSelectedIds.push(id)));
    allSelectedIds.forEach(id => {
      const adv = GameState.adventurers.find(a => a.id === id);
      if (adv) adv.currentState = AdventurerState.DISPATCHED;
    });

    const reserveSquadConfigs = this.squads.slice(1).filter(s => s.selectedIds.size > 0).map(s => ({
      defenderIds: Array.from(s.selectedIds),
      formationId: s.formationId,
      gridMap: s.gridMap
    }));

    // 5. 建立真實行軍任務 (LordSiegeCampaignMission)
    const mission: import('../../models/types').LordSiegeCampaignMission = {
      id: `siege_mission_${Date.now()}`,
      targetNodeId: targetNode.id,
      targetNodeName: targetNode.name,
      targetTerrain: targetNode.terrain,
      daysTotal: totalDays,
      daysRemaining: totalDays,
      assignedTroops: { ...this.assignedTroops },
      engines: {
        ramCount: this.carryEngines.ram ? 1 : 0,
        trebuchetCount: this.carryEngines.trebuchet ? 1 : 0
      },
      primarySquadIds: Array.from(primarySquad.selectedIds),
      reserveSquadConfigs,
      primaryFormationId: primarySquad.formationId,
      primaryGridMap: primarySquad.gridMap,
      provisionPerDay: Math.ceil(reqFood / totalDays),
      isLordCampaign,
      state: 'MARCHING'
    };

    territory.lordCampaignMission = mission;

    UIManager.updateUI();
    this.close();

    ToastManager.show(
      `🚩 【${isLordCampaign ? '👑 領主親征軍團' : '⚔️ 先鋒遠征軍團'}】已拔營出發！正在行軍前往【${targetNode.name}】（預計 ${totalDays} 天抵達城下）！`,
      'info'
    );
  }

  /**
   * 🐎 當過日行軍天數歸零、兵臨城下時由主迴圈呼叫啟動攻城戰役
   */
  public static triggerArrivedSiegeCombat(mission: import('../../models/types').LordSiegeCampaignMission): void {
    const targetNode = GameState.mapSystem?.getNodes().find(n => n.id === mission.targetNodeId) || {
      id: mission.targetNodeId,
      name: mission.targetNodeName,
      terrain: mission.targetTerrain || TerrainType.WILDERNESS
    } as MapNode;

    const { template, gateHp: targetGateHp } = this.getFortressTemplateAndGateHp(targetNode);
    const enemyWaves = this.generateFortressDefenders(targetNode);

    const siegeOptions = {
      isSiege: true,
      battleMode: SiegeBattleMode.OFFENSIVE_SIEGE,
      playerRole: SiegeRole.ATTACKER,
      isOffensiveSiege: true,
      gateHp: targetGateHp,
      assignedTroops: { ...mission.assignedTroops },
      engines: { ...mission.engines },
      reserveSquadConfigs: mission.reserveSquadConfigs,
      lordTitle: GameState.myTerritory.title || NobleTitle.COMMONER,
      isLordCampaign: mission.isLordCampaign
    };

    if (mission.isLordCampaign) {
      ToastManager.show(`🐎 【👑 領主親征】大軍已兵臨【${mission.targetNodeName}】城下！發動總攻！`, 'warning');

      const session = new InteractiveCombatSession(
        mission.primarySquadIds,
        enemyWaves.length,
        `⚔️ 攻城戰役：${mission.targetNodeName}`,
        mission.targetTerrain || TerrainType.WILDERNESS,
        enemyWaves,
        siegeOptions,
        mission.primaryFormationId,
        mission.primaryGridMap
      );

      CombatUIManager.startInteractiveCombat(session, (report) => {
        this.resolveOffensiveSiegeResult(targetNode, report, mission);
      });
    } else {
      const report = CombatSystem.simulateCombat(
        mission.primarySquadIds,
        (targetNode.defenseLevel || 2) * 10,
        'OFFENSIVE_SIEGE',
        mission.targetTerrain || TerrainType.WILDERNESS,
        enemyWaves.length,
        undefined,
        undefined,
        mission.primaryFormationId,
        mission.primaryGridMap,
        undefined,
        enemyWaves,
        siegeOptions
      );

      CombatUIManager.replayCombat(report, () => {
        this.resolveOffensiveSiegeResult(targetNode, report, mission);
      });
    }
  }

  public static getFortressTemplateAndGateHp(targetNode: MapNode): { template?: any; gateHp: number } {
    const templates = DataStore.getSubjugationTemplates();
    const template = templates.find(t => t.id === targetNode.id || t.id === (targetNode as any).subjugationId || t.name === targetNode.name);
    const gateHp = (template as any)?.defenderConfig?.gateMaxHp || (targetNode.defenseLevel || 2) * 2000 + 1000;
    return { template, gateHp };
  }

  private static generateFortressDefenders(targetNode: MapNode): MonsterInstance[][] {
    const { template } = this.getFortressTemplateAndGateHp(targetNode);
    if (template && Array.isArray(template.waves) && template.waves.length > 0) {
      const allMonsterDefs: any[] = monstersJson;
      const waves: MonsterInstance[][] = [];

      template.waves.forEach((w: any, wIdx: number) => {
        const waveMonsters: MonsterInstance[] = [];
        (w.monsters || []).forEach((mRef: any, mIdx: number) => {
          const mDef = allMonsterDefs.find(m => m.id === mRef.monsterId);
          const powerTier = Number(mRef.powerTier ?? mDef?.powerTier ?? 1.0);
          const diff = Math.max(1, template.difficulty || targetNode.defenseLevel || 2);
          const baseHp = Math.round((mDef?.baseHp || 100) * powerTier * (1 + diff * 0.25));
          const baseAtk = Math.round((mDef?.damage || mDef?.baseDamage || 20) * powerTier * (1 + diff * 0.2));
          const baseDef = Math.round((mDef?.defense || 15) * powerTier * (1 + diff * 0.15));

          const r = mRef.gridR !== undefined ? mRef.gridR : (mRef.slotId ? Number(mRef.slotId.split('_')[0]) : 0);
          const c = mRef.gridC !== undefined ? mRef.gridC : (mRef.slotId ? Number(mRef.slotId.split('_')[1]) : 0);
          const fRow = r === 0 ? FormationRow.FRONT : (r === 1 ? FormationRow.MIDDLE : FormationRow.BACK);

          const monInst: MonsterInstance = {
            id: `fortress_${wIdx}_${mIdx}_${mRef.monsterId}`,
            name: mRef.affix ? `${mRef.affix} ${mDef?.name || mRef.monsterId}` : (mDef?.name || mRef.monsterId),
            avatarIcon: mDef?.avatarIcon || (mDef?.icon ? mDef.icon : `icons_monsters:${mRef.monsterId}`),
            damage: baseAtk,
            hp: baseHp,
            maxHp: baseHp,
            defense: baseDef,
            pdef: baseDef,
            mdef: Math.round(baseDef * 0.8),
            speed: mDef?.speed || 10,
            evade: mDef?.evade || 5,
            calculatedPowerScore: Math.round(baseHp * 0.5 + baseAtk * 2),
            element: mRef.element || mDef?.defaultElement || ElementType.NONE,
            race: mDef?.race || MonsterRace.HUMAN,
            compatibleRaces: mDef?.compatibleRaces || [MonsterRace.HUMAN],
            terrains: mDef?.terrains || [TerrainType.WILDERNESS],
            appliedRaceTag: mDef?.race || MonsterRace.HUMAN,
            powerTier: powerTier,
            formationRow: fRow,
            gridR: r,
            gridC: c,
            isBoss: wIdx === template.waves.length - 1 && template.waves.length > 1 && mIdx === 0,
            skills: mRef.skills || mDef?.skills || []
          };
          waveMonsters.push(monInst);
        });
        if (waveMonsters.length > 0) {
          waves.push(waveMonsters);
        }
      });

      if (waves.length > 0) return waves;
    }

    const diff = (targetNode.defenseLevel || 2) * 8 + 10;
    const wave1: MonsterInstance[] = [
      {
        id: 'faction_infantry_1',
        name: `【${targetNode.name}】前鋒守衛`,
        damage: 18 + diff,
        hp: 120 + diff * 10,
        maxHp: 120 + diff * 10,
        defense: 25 + diff * 2,
        pdef: 25 + diff * 2,
        mdef: 15 + diff,
        evade: 10,
        calculatedPowerScore: 80 + diff * 5,
        element: ElementType.NONE,
        race: MonsterRace.HUMAN,
        compatibleRaces: [MonsterRace.HUMAN],
        terrains: [TerrainType.WILDERNESS],
        appliedRaceTag: MonsterRace.HUMAN,
        powerTier: 1.0,
        formationRow: FormationRow.FRONT,
        gridR: 0,
        gridC: 0
      },
      {
        id: 'faction_infantry_2',
        name: `【${targetNode.name}】盾衛隊長`,
        damage: 22 + diff,
        hp: 150 + diff * 12,
        maxHp: 150 + diff * 12,
        defense: 35 + diff * 2,
        pdef: 35 + diff * 2,
        mdef: 20 + diff,
        evade: 8,
        calculatedPowerScore: 100 + diff * 6,
        element: ElementType.NONE,
        race: MonsterRace.HUMAN,
        compatibleRaces: [MonsterRace.HUMAN],
        terrains: [TerrainType.WILDERNESS],
        appliedRaceTag: MonsterRace.HUMAN,
        powerTier: 1.2,
        formationRow: FormationRow.FRONT,
        gridR: 0,
        gridC: 1
      },
      {
        id: 'faction_archer_1',
        name: `【${targetNode.name}】城垛弩手`,
        damage: 28 + diff * 2,
        hp: 90 + diff * 6,
        maxHp: 90 + diff * 6,
        defense: 12 + diff,
        pdef: 12 + diff,
        mdef: 18 + diff,
        evade: 18,
        calculatedPowerScore: 90 + diff * 5,
        element: ElementType.NONE,
        race: MonsterRace.HUMAN,
        compatibleRaces: [MonsterRace.HUMAN],
        terrains: [TerrainType.WILDERNESS],
        appliedRaceTag: MonsterRace.HUMAN,
        powerTier: 1.1,
        formationRow: FormationRow.BACK,
        gridR: 2,
        gridC: 1
      }
    ];

    const wave2: MonsterInstance[] = [
      {
        id: 'fortress_champion',
        name: `👑 【${targetNode.name}】守城大將·重裝總管`,
        damage: 38 + diff * 2,
        hp: 350 + diff * 25,
        maxHp: 350 + diff * 25,
        defense: 45 + diff * 3,
        pdef: 45 + diff * 3,
        mdef: 30 + diff * 2,
        evade: 12,
        calculatedPowerScore: 220 + diff * 10,
        element: ElementType.NONE,
        race: MonsterRace.HUMAN,
        compatibleRaces: [MonsterRace.HUMAN],
        terrains: [TerrainType.WILDERNESS],
        appliedRaceTag: MonsterRace.HUMAN,
        powerTier: 2.0,
        isBoss: true,
        formationRow: FormationRow.FRONT,
        gridR: 0,
        gridC: 1
      }
    ];

    return [wave1, wave2];
  }

  public static resolveOffensiveSiegeResult(
    targetNode: MapNode,
    report: import('../../models/Combat').CombatReport,
    mission?: import('../../models/types').LordSiegeCampaignMission
  ): void {
    const territory = GameState.myTerritory;

    // 1. 折算隨行兵種戰損
    const initialTroops = mission?.assignedTroops || this.assignedTroops;
    if (report.survivingInfantry !== undefined && territory.workers?.['INFANTRY']) {
      const lostInf = Math.max(0, initialTroops.infantry - report.survivingInfantry);
      territory.workers['INFANTRY'] = Math.max(0, territory.workers['INFANTRY'] - lostInf);
    }
    if (report.survivingArchers !== undefined && territory.workers?.['ARCHER']) {
      const lostArc = Math.max(0, initialTroops.archer - report.survivingArchers);
      territory.workers['ARCHER'] = Math.max(0, territory.workers['ARCHER'] - lostArc);
    }

    // 2. 釋放任務中的所有傭兵回 IDLE 狀態
    if (mission) {
      const allIds = [...mission.primarySquadIds];
      mission.reserveSquadConfigs.forEach(r => (r.defenderIds || []).forEach(id => allIds.push(id)));
      allIds.forEach(id => {
        const adv = GameState.adventurers.find(a => a.id === id);
        if (adv && adv.currentState === AdventurerState.DISPATCHED) {
          adv.currentState = AdventurerState.IDLE;
        }
      });
      territory.lordCampaignMission = undefined;
    }

    // 3. 勝負判定
    if (report.isVictory) {
      // 🚩 攻陷要塞！收編為附庸！
      targetNode.ownerFactionId = 'player';
      targetNode.isVassal = true;

      if (!territory.vassalGovernors) territory.vassalGovernors = {};

      if (typeof document !== 'undefined') {
        ToastManager.show(`🎉 攻城大捷！成功攻陷【${targetNode.name}】並收編為附庸據點！領地繁榮度 +100！`, 'success');

        // 觸發俘虜敵將處理彈窗
        const prisonerModal = document.getElementById('modal-prisoner-action');
        if (prisonerModal) {
          const pNameEl = document.getElementById('prisoner-name');
          if (pNameEl) pNameEl.textContent = `【${targetNode.name}】守將`;
          prisonerModal.style.display = 'flex';
        }
      }
    } else {
      if (typeof document !== 'undefined') {
        ToastManager.show(`💀 攻城失利！我方部隊在【${targetNode.name}】城下遭受重創被迫撤退！`, 'error');
      }
    }

    if (typeof document !== 'undefined') {
      UIManager.updateUI();
    }
  }
}
