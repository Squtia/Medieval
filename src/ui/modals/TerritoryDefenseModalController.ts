import { GameState } from '../../core/GameState';
import { NarrativeEffect } from '../../models/Narrative';
import { TerritoryDefenseSystem } from '../../systems/TerritoryDefenseSystem';
import { FormationDB } from '../../systems/FormationDB';
import { renderAdventurerCard, getAdventurerTooltipHtml } from '../components/AdventurerCard';
import { positionFloatingElement } from '../FloatingPosition';
import { ToastManager } from '../ToastManager';

export interface SiegeSquadConfig {
  formationId: string;
  gridMap: Record<string, string>;
  selectedIds: Set<string>;
}

export class TerritoryDefenseModalController {
  private static isInitialized = false;
  private static currentStoryId: string = '';
  private static currentEffect: Extract<NarrativeEffect, { type: 'TRIGGER_RAID' }> | null = null;
  private static isCurrentFieldIntercept: boolean = false;
  private static currentTabIndex: number = 0; // 0, 1, 2 對應 3 個梯隊

  private static squads: SiegeSquadConfig[] = [
    { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() },
    { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() },
    { formationId: 'DEFAULT', gridMap: {}, selectedIds: new Set() }
  ];

  private static assignedTroops = {
    infantry: 0,
    archer: 0,
    cavalry: 0
  };

  private static dragAdvId: string | null = null;
  private static dragSourceSlot: string | null = null;

  public static init(): void {
    if (this.isInitialized) return;

    const modal = document.getElementById('modal-territory-defense');
    const btnCancel = document.getElementById('btn-cancel-siege-defense');
    const btnStart = document.getElementById('btn-start-siege-defense-combat');
    const formationSelect = document.getElementById('siege-formation-select') as HTMLSelectElement;

    // 梯隊頁籤切換
    const tabBtns = document.querySelectorAll('.btn-siege-tab');
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
    const infInput = document.getElementById('input-siege-infantry') as HTMLInputElement;
    const arcInput = document.getElementById('input-siege-archer') as HTMLInputElement;
    const cavInput = document.getElementById('input-siege-cavalry') as HTMLInputElement;

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
    };

    infInput?.addEventListener('input', onTroopChange);
    arcInput?.addEventListener('input', onTroopChange);
    cavInput?.addEventListener('input', onTroopChange);

    document.getElementById('btn-siege-troops-max')?.addEventListener('click', () => {
      const territory = GameState.myTerritory;
      const maxInf = territory.workers?.['INFANTRY'] || 0;
      const maxArc = territory.workers?.['ARCHER'] || 0;
      const maxCav = territory.workers?.['CAVALRY'] || 0;
      if (infInput) infInput.value = maxInf.toString();
      if (arcInput) arcInput.value = maxArc.toString();
      if (cavInput) cavInput.value = maxCav.toString();
      onTroopChange();
    });

    document.getElementById('btn-siege-troops-zero')?.addEventListener('click', () => {
      if (infInput) infInput.value = '0';
      if (arcInput) arcInput.value = '0';
      if (cavInput) cavInput.value = '0';
      onTroopChange();
    });

    // 智慧自動填補按鈕事件監聽
    document.getElementById('btn-siege-smart-fill')?.addEventListener('click', () => {
      this.smartAutoFill();
    });

    btnCancel?.addEventListener('click', () => {
      this.close();
      if (this.currentStoryId && this.currentEffect) {
        ToastManager.show('領地放棄抵抗，敵軍肆意掠奪並破壞了城防！');
        TerritoryDefenseSystem.applyDefeatLosses(this.currentStoryId, this.currentEffect);
      }
    });

    // 1. 正規守城進入戰鬥按鈕
    btnStart?.addEventListener('click', () => {
      const totalAssigned = this.squads.reduce((acc, s) => acc + s.selectedIds.size, 0);
      if (totalAssigned === 0) {
        ToastManager.show('⚠️ 請至少在第 1 梯隊中配置 1 名傭兵出戰！');
        return;
      }

      this.saveLastSquads();
      this.close();
      if (this.currentStoryId && this.currentEffect) {
        TerritoryDefenseSystem.executeLiveSiegeDefenseWithSquads(
          this.currentStoryId,
          this.currentEffect,
          this.squads,
          this.assignedTroops
        );
      }
    });

    // 2. 野外攔截：親自出城攔截 (進入野戰舞台)
    document.getElementById('btn-start-field-interception')?.addEventListener('click', () => {
      const totalAssigned = this.squads.reduce((acc, s) => acc + s.selectedIds.size, 0);
      if (totalAssigned === 0) {
        ToastManager.show('⚠️ 請至少在第 1 梯隊中配置 1 名傭兵出戰！');
        return;
      }

      this.saveLastSquads();
      this.close();
      if (this.currentStoryId && this.currentEffect) {
        TerritoryDefenseSystem.executeLiveFieldInterceptionWithSquads(
          this.currentStoryId,
          this.currentEffect,
          this.squads,
          this.assignedTroops
        );
      }
    });

    // 3. 野外攔截：派遣軍團迎擊 (自動作戰模擬)
    document.getElementById('btn-dispatch-field-interception')?.addEventListener('click', () => {
      const totalAssigned = this.squads.reduce((acc, s) => acc + s.selectedIds.size, 0);
      if (totalAssigned === 0) {
        ToastManager.show('⚠️ 請至少在第 1 梯隊中配置 1 名傭兵出戰！');
        return;
      }

      this.saveLastSquads();
      this.close();
      if (this.currentStoryId && this.currentEffect) {
        TerritoryDefenseSystem.dispatchFieldInterception(
          this.currentStoryId,
          this.currentEffect,
          this.squads,
          this.assignedTroops
        );
      }
    });

    // 4. 野外攔截：堅壁清野 (等待守城)
    document.getElementById('btn-wait-siege-defense')?.addEventListener('click', () => {
      this.close();
      if (this.currentStoryId && this.currentEffect) {
        TerritoryDefenseSystem.postponeToSiege(this.currentStoryId, this.currentEffect);
        ToastManager.show('🏰 領地進入臨戰戒備狀態，各防禦設施全力準備迎接圍城戰！');
      }
    });

    this.isInitialized = true;
  }

  private static saveLastSquads(): void {
    // 記憶本次守備動員編制
    (GameState as any).lastDefenseSquads = this.squads.map(s => ({
      formationId: s.formationId,
      gridMap: { ...s.gridMap },
      selectedIds: Array.from(s.selectedIds)
    }));
  }

  /**
   * ⚡ 智慧自動填補：以留守領地的最高戰力冒險者自動依序填滿 3 梯隊
   */
  private static smartAutoFill(): void {
    const allAdv = GameState.adventurers || [];
    // 排除外出派遣者
    const availableAdv = allAdv.filter(a => !(a as any).isDispatched && !(a as any).onExpedition);
    // 依據戰鬥力排序
    const sortedAdv = [...availableAdv].sort((a, b) => {
      const statsA = a.getCombatStats();
      const statsB = b.getCombatStats();
      return (statsB.patk + statsB.matk + statsB.pdef + statsB.hp) - (statsA.patk + statsA.matk + statsA.pdef + statsA.hp);
    });

    // 清空現有梯隊
    this.squads = [
      { formationId: this.squads[0]?.formationId || 'DEFAULT', gridMap: {}, selectedIds: new Set() },
      { formationId: this.squads[1]?.formationId || 'DEFAULT', gridMap: {}, selectedIds: new Set() },
      { formationId: this.squads[2]?.formationId || 'DEFAULT', gridMap: {}, selectedIds: new Set() }
    ];

    let advIndex = 0;
    for (let sqIdx = 0; sqIdx < 3; sqIdx++) {
      const currentSquad = this.squads[sqIdx];
      // 每個梯隊填入最多 5 人（優先前排 0_0, 0_1, 0_2，再中排 1_0, 1_1）
      const defaultSlots = ['0_0', '0_1', '0_2', '1_0', '1_1'];
      for (const slotId of defaultSlots) {
        if (advIndex < sortedAdv.length) {
          const adv = sortedAdv[advIndex];
          currentSquad.gridMap[slotId] = adv.id;
          currentSquad.selectedIds.add(adv.id);
          advIndex++;
        }
      }
    }

    this.renderAdvList();
    this.renderGrid();
    ToastManager.show('⚡ 已為您自動以最高戰力守軍填補梯隊！');
  }

  private static updateTroopPreviews(): void {
    const infShieldEl = document.getElementById('siege-infantry-shield-preview');
    const arcDmgEl = document.getElementById('siege-archer-dmg-preview');
    const cavSlowEl = document.getElementById('siege-cavalry-slow-preview');

    if (infShieldEl) infShieldEl.textContent = (this.assignedTroops.infantry * 50).toLocaleString();
    if (arcDmgEl) arcDmgEl.textContent = Math.floor(Math.sqrt(this.assignedTroops.archer) * 35).toLocaleString();
    if (cavSlowEl) cavSlowEl.textContent = Math.floor(Math.sqrt(this.assignedTroops.cavalry) * 28).toLocaleString();
  }

  public static show(storyId: string, effect: Extract<NarrativeEffect, { type: 'TRIGGER_RAID' }>, isFieldInterceptOverride?: boolean): void {
    this.init();
    this.currentStoryId = storyId;
    this.currentEffect = effect;
    this.currentTabIndex = 0;

    const modal = document.getElementById('modal-territory-defense');
    if (!modal) return;

    const territory = GameState.myTerritory;
    const isSiege = effect.isSiege !== false; // 預設為 true (攻城戰)
    const warningDays = Number(effect.warningDays || 0);
    const pending = territory.pendingRaids?.find(pr => pr.storyId === storyId);
    const isFieldIntercept = isFieldInterceptOverride !== undefined ? isFieldInterceptOverride : (warningDays > 0);
    this.isCurrentFieldIntercept = isFieldIntercept;
    const alreadyIntercepted = !!pending?.isFieldInterceptionAttempted;

    // 1. 切換模式按鈕與提示
    const fieldActionsEl = document.getElementById('field-intercept-actions');
    const siegeActionsEl = document.getElementById('siege-defense-actions');
    const warningBadgeEl = document.getElementById('siege-modal-warning-badge');
    const titleEl = document.getElementById('siege-modal-title');
    const fortInfoEl = document.getElementById('siege-modal-fort-info');
    const encounterInfoEl = document.getElementById('siege-modal-encounter-info');
    const troopsDeployPanel = document.getElementById('siege-troops-deploy-panel');
    const troopsDisabledPanel = document.getElementById('siege-troops-disabled-panel');
    const footerHintEl = document.getElementById('siege-modal-footer-hint');

    const btnStartField = document.getElementById('btn-start-field-interception');
    const btnDispatchField = document.getElementById('btn-dispatch-field-interception');

    if (isFieldIntercept) {
      if (fieldActionsEl) fieldActionsEl.style.display = 'flex';
      if (siegeActionsEl) siegeActionsEl.style.display = 'none';
      const currentDaysLeft = pending?.warningDaysLeft ?? warningDays;
      const interceptDay = Math.max(1, Math.floor(currentDaysLeft / 2));
      const remainingDays = Math.max(1, currentDaysLeft - interceptDay);

      if (warningBadgeEl) {
        warningBadgeEl.textContent = `⚠️ 敵軍進逼中 (距離主城 ${currentDaysLeft} 天)`;
        warningBadgeEl.style.background = 'rgba(234, 88, 12, 0.2)';
        warningBadgeEl.style.borderColor = '#f97316';
        warningBadgeEl.style.color = '#fdba74';
      }
      if (titleEl) {
        titleEl.innerHTML = alreadyIntercepted
          ? `<span>🏰 領地臨戰戒備 —— 敵軍殘部進逼中 (${effect.raidName || '敵軍大軍'})</span>`
          : `<span>⚔️ 敵軍逼近預警 —— 野外迎擊作戰部署 (${effect.raidName || '敵軍大軍'})</span>`;
      }
      if (fortInfoEl) fortInfoEl.style.display = 'none'; // 野戰無城牆箭塔掩護
      if (encounterInfoEl) {
        encounterInfoEl.style.display = 'flex';
        encounterInfoEl.innerHTML = alreadyIntercepted
          ? '<span>🛡️ 我方部隊已在野外與敵軍交戰並削弱其戰力，守軍已回防主城戒備。</span>'
          : `<span>🌲 野外遭遇攔截戰（預計在第 ${interceptDay} 天於荒野中途交火；若戰敗，敵軍殘部需花費剩餘 ${remainingDays} 天抵達主城）</span>`;
      }
      if (footerHintEl) {
        footerHintEl.innerHTML = alreadyIntercepted
          ? '💡 提示：出城迎擊已結束，敵軍殘部正朝主城推進，請全力修繕城防準備迎接圍城戰。'
          : `💡 提示：出城攔截戰勝可保主城 0 受損；若戰敗，殘存敵軍將在 ${remainingDays} 天後抵達主城開打守城戰。`;
      }

      // 若已經出城迎擊過，禁用再次出城迎戰按鈕，僅保留堅壁清野等待守城
      if (alreadyIntercepted) {
        if (btnStartField) btnStartField.style.display = 'none';
        if (btnDispatchField) btnDispatchField.style.display = 'none';
      } else {
        if (btnStartField) btnStartField.style.display = 'inline-block';
        if (btnDispatchField) btnDispatchField.style.display = 'inline-block';
      }
    } else {
      if (fieldActionsEl) fieldActionsEl.style.display = 'none';
      if (siegeActionsEl) siegeActionsEl.style.display = 'flex';
      if (warningBadgeEl) {
        warningBadgeEl.textContent = '⚠️ 敵軍兵臨城下';
        warningBadgeEl.style.background = 'rgba(239, 68, 68, 0.2)';
        warningBadgeEl.style.borderColor = '#ef4444';
        warningBadgeEl.style.color = '#fca5a5';
      }
      if (titleEl) {
        titleEl.innerHTML = isSiege
          ? `<span>🛡️ 領地守備動員部署 —— ${effect.raidName || '敵軍圍城戰'}</span>`
          : `<span>⚔️ 領地防衛動員部署（街巷／室內遭遇戰）—— ${effect.raidName || '突襲遭遇戰'}</span>`;
      }
      if (isSiege) {
        if (fortInfoEl) fortInfoEl.style.display = 'flex';
        if (encounterInfoEl) encounterInfoEl.style.display = 'none';
      } else {
        if (fortInfoEl) fortInfoEl.style.display = 'none';
        if (encounterInfoEl) {
          encounterInfoEl.style.display = 'flex';
          encounterInfoEl.innerHTML = '<span>🚫 街巷／室內遭遇戰（無城防掩體）</span>';
        }
      }
      if (footerHintEl) {
        footerHintEl.innerHTML = '💡 提示：誓死守城將依託城牆與箭塔阻擊敵軍，城破將導致建築降級與村民傷亡。';
      }
    }

    if (troopsDeployPanel) troopsDeployPanel.style.display = 'block';
    if (troopsDisabledPanel) troopsDisabledPanel.style.display = 'none';

    if (isSiege && !isFieldIntercept) {
      const gateHpEl = document.getElementById('siege-gate-hp-val');
      if (gateHpEl) gateHpEl.textContent = territory.getWallDurability().toLocaleString();

      const towerDmgEl = document.getElementById('siege-tower-dmg-val');
      if (towerDmgEl) towerDmgEl.textContent = `${TerritoryDefenseSystem.calculateWatchtowerDamage(territory)}/T`;
    }

    if (isSiege || isFieldIntercept) {
      if (troopsDeployPanel) troopsDeployPanel.style.display = 'block';
      if (troopsDisabledPanel) troopsDisabledPanel.style.display = 'none';

      // 填入可調派兵種總數，並預設全出戰
      const infantryCount = territory.workers?.['INFANTRY'] || 0;
      const archerCount = territory.workers?.['ARCHER'] || 0;
      const cavalryCount = territory.workers?.['CAVALRY'] || 0;

      const infTotalEl = document.getElementById('siege-infantry-total');
      const arcTotalEl = document.getElementById('siege-archer-total');
      const cavTotalEl = document.getElementById('siege-cavalry-total');
      if (infTotalEl) infTotalEl.textContent = `${infantryCount}`;
      if (arcTotalEl) arcTotalEl.textContent = `${archerCount}`;
      if (cavTotalEl) cavTotalEl.textContent = `${cavalryCount}`;

      const infInput = document.getElementById('input-siege-infantry') as HTMLInputElement;
      const arcInput = document.getElementById('input-siege-archer') as HTMLInputElement;
      const cavInput = document.getElementById('input-siege-cavalry') as HTMLInputElement;
      if (infInput) { infInput.max = infantryCount.toString(); infInput.value = infantryCount.toString(); }
      if (arcInput) { arcInput.max = archerCount.toString(); arcInput.value = archerCount.toString(); }
      if (cavInput) { cavInput.max = cavalryCount.toString(); cavInput.value = cavalryCount.toString(); }

      this.assignedTroops = { infantry: infantryCount, archer: archerCount, cavalry: cavalryCount };
      this.updateTroopPreviews();
    } else {
      // 街巷突襲遭遇戰模式：隱藏城牆/箭塔/兵種調派
      if (fortInfoEl) fortInfoEl.style.display = 'none';
      if (encounterInfoEl) encounterInfoEl.style.display = 'flex';
      if (troopsDeployPanel) troopsDeployPanel.style.display = 'none';
      if (troopsDisabledPanel) troopsDisabledPanel.style.display = 'block';

      this.assignedTroops = { infantry: 0, archer: 0, cavalry: 0 };
    }

    // 3. 檢查是否有上次動員記憶，若有且合法則優先還原
    const savedSquads = (GameState as any).lastDefenseSquads;
    const allAdv = GameState.adventurers || [];
    const validAdvIds = new Set(allAdv.map(a => a.id));

    if (savedSquads && Array.isArray(savedSquads) && savedSquads.length === 3) {
      this.squads = savedSquads.map((s: any) => {
        const validGridMap: Record<string, string> = {};
        const validSelected = new Set<string>();
        for (const [slot, advId] of Object.entries(s.gridMap || {})) {
          if (validAdvIds.has(advId as string)) {
            validGridMap[slot] = advId as string;
            validSelected.add(advId as string);
          }
        }
        return {
          formationId: s.formationId || 'DEFAULT',
          gridMap: validGridMap,
          selectedIds: validSelected
        };
      });
      // 若記憶還原後第 1 梯隊完全沒人，則執行智慧填補
      if (this.squads[0].selectedIds.size === 0) {
        this.smartAutoFill();
      }
    }

    this.switchTab(0);

    modal.style.display = 'flex';
    modal.classList.add('active');
  }

  public static close(): void {
    const modal = document.getElementById('modal-territory-defense');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  private static switchTab(tabIdx: number): void {
    this.currentTabIndex = tabIdx;

    // 更新頁籤樣式
    const tabBtns = document.querySelectorAll('.btn-siege-tab');
    tabBtns.forEach((btn, idx) => {
      const el = btn as HTMLElement;
      if (idx === tabIdx) {
        el.style.background = 'rgba(59,130,246,0.5)';
        el.style.borderColor = '#3b82f6';
        el.style.color = '#fff';
      } else {
        el.style.background = 'rgba(255,255,255,0.08)';
        el.style.borderColor = 'transparent';
        el.style.color = '#94a3b8';
      }
    });

    const currentSquad = this.squads[tabIdx];
    const select = document.getElementById('siege-formation-select') as HTMLSelectElement;
    if (select) select.value = currentSquad.formationId;

    this.renderAdvList();
    this.renderGrid();
  }

  private static renderAdvList(): void {
    const container = document.getElementById('siege-adv-list');
    if (!container) return;
    container.innerHTML = '';

    const availableAdv = GameState.adventurers || [];
    const currentSquad = this.squads[this.currentTabIndex];

    // 計算已被其他梯隊佔用的傭兵
    const usedInOtherSquads = new Set<string>();
    this.squads.forEach((sq, sIdx) => {
      if (sIdx !== this.currentTabIndex) {
        sq.selectedIds.forEach(id => usedInOtherSquads.add(id));
      }
    });

    availableAdv.forEach(adv => {
      const isSelectedInCurrent = currentSquad.selectedIds.has(adv.id);
      const isUsedElsewhere = usedInOtherSquads.has(adv.id);

      const card = document.createElement('div');
      card.className = 'adventurer-card';
      card.style.transform = 'scale(0.88)';
      card.style.transformOrigin = 'center';
      card.style.margin = '-4px';
      card.style.cursor = isUsedElsewhere ? 'not-allowed' : 'pointer';
      card.style.opacity = isUsedElsewhere ? '0.35' : (isSelectedInCurrent ? '0.5' : '1');
      card.style.border = isSelectedInCurrent ? '2px solid #3b82f6' : '';
      card.style.boxShadow = isSelectedInCurrent ? '0 0 10px rgba(59, 130, 246, 0.5)' : '';

      if (!isUsedElsewhere && !isSelectedInCurrent) {
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
          this.dragAdvId = adv.id;
          this.dragSourceSlot = 'pool';
          e.dataTransfer?.setData('text/plain', adv.id);
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
        });
      }

      card.innerHTML = renderAdventurerCard(adv);

      const tooltipHtml = getAdventurerTooltipHtml(adv);
      card.addEventListener('mouseenter', () => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.opacity = '1'; }
      });
      card.addEventListener('mousemove', (e) => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
      });
      card.addEventListener('mouseleave', () => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';
      });

      card.addEventListener('click', () => {
        const tEl = document.getElementById('adv-tooltip');
        if (tEl) tEl.style.opacity = '0';

        if (isUsedElsewhere) {
          ToastManager.show('該傭兵已被指派至其他梯隊！');
          return;
        }

        if (isSelectedInCurrent) {
          // 從九宮格中移除
          for (const [k, v] of Object.entries(currentSquad.gridMap)) {
            if (v === adv.id) delete currentSquad.gridMap[k];
          }
          currentSquad.selectedIds.delete(adv.id);
        } else {
          if (currentSquad.selectedIds.size >= 5) {
            ToastManager.show('每個梯隊最多只能編入 5 名傭兵！');
            return;
          }

          // 尋找第一個空位放入
          let placed = false;
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              const k = `${r}_${c}`;
              if (!currentSquad.gridMap[k]) {
                currentSquad.gridMap[k] = adv.id;
                currentSquad.selectedIds.add(adv.id);
                placed = true;
                break;
              }
            }
            if (placed) break;
          }
        }

        this.renderAdvList();
        this.renderGrid();
      });

      container.appendChild(card);
    });
  }

  private static renderGrid(): void {
    const gridEl = document.getElementById('siege-team-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    const currentSquad = this.squads[this.currentTabIndex];
    const activeFormation = FormationDB.getFormation(currentSquad.formationId);

    const descEl = document.getElementById('siege-formation-desc');
    if (descEl) descEl.textContent = activeFormation.description;

    const isFormationActive = FormationDB.isFormationActive(currentSquad.gridMap, currentSquad.formationId);

    // 依據野外迎擊 vs 守城防衛，智能動態自適應棋盤方向
    const isField = this.isCurrentFieldIntercept;
    const labelLeft = document.getElementById('siege-grid-label-left');
    const labelMid = document.getElementById('siege-grid-label-mid');
    const labelRight = document.getElementById('siege-grid-label-right');

    if (labelLeft && labelMid && labelRight) {
      if (isField) {
        // 🌲 野戰出征：玩家在左面向右推進（左後 ➔ 右前）
        labelLeft.textContent = '🏰 後排 (後備)';
        labelLeft.style.color = '#60a5fa';
        labelMid.textContent = '🛡️ 中排';
        labelMid.style.color = '#fbbf24';
        labelRight.textContent = '⚔️ 前排 (衝鋒)';
        labelRight.style.color = '#f87171';
      } else {
        // 🏰 守城戰役：守軍在右面向左守門（左前 ➔ 右後）
        labelLeft.textContent = '⚔️ 前排 (守門)';
        labelLeft.style.color = '#f87171';
        labelMid.textContent = '🛡️ 中排';
        labelMid.style.color = '#fbbf24';
        labelRight.textContent = '🏰 後排 (城內)';
        labelRight.style.color = '#60a5fa';
      }
    }

    // 棋盤格子映射
    for (let vr = 0; vr < 3; vr++) {
      for (let vc = 0; vc < 3; vc++) {
        // 野戰：vc=0 是後排(r=2)，vc=2 是前排(r=0)
        // 守城：vc=0 是前排(r=0)，vc=2 是後排(r=2)
        const r = isField ? (2 - vc) : vc;
        const c = vr; // 0, 1, 2
        const slotId = `${r}_${c}`;
        const advId = currentSquad.gridMap[slotId];
        const adv = advId ? GameState.adventurers.find(a => a.id === advId) : null;

        const isRequired = activeFormation.requiredSlots.some(s => s.row === r && s.col === c);

        const slot = document.createElement('div');
        slot.className = 'grid-slot';
        slot.style.width = '100px';
        slot.style.height = '110px';
        slot.style.border = '2px dashed ' + (isRequired ? (isFormationActive ? '#10b981' : '#eab308') : 'rgba(255,255,255,0.2)');
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
            const tEl = document.getElementById('adv-tooltip');
            if (tEl) { tEl.innerHTML = tooltipHtml; tEl.style.opacity = '1'; }
          });
          cardDiv.addEventListener('mousemove', (e) => {
            const tEl = document.getElementById('adv-tooltip');
            if (tEl) positionFloatingElement(tEl, e.clientX, e.clientY);
          });
          cardDiv.addEventListener('mouseleave', () => {
            const tEl = document.getElementById('adv-tooltip');
            if (tEl) tEl.style.opacity = '0';
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
          });

          slot.appendChild(cardDiv);
        } else {
          const slotText = isField
            ? (vc === 0 ? '+ 後排' : (vc === 1 ? '+ 中排' : '+ 前排'))
            : (vc === 0 ? '+ 前排' : (vc === 1 ? '+ 中排' : '+ 後排'));
          slot.innerHTML = `<span style="color: #64748b; font-size: 0.75rem;">${slotText}</span>`;
        }

        gridEl.appendChild(slot);
      }
    }

    // 計算當前梯隊戰力
    let power = 0;
    currentSquad.selectedIds.forEach(id => {
      const a = GameState.adventurers.find(adv => adv.id === id);
      if (a) power += a.power || 10;
    });
    const powerEl = document.getElementById('siege-squad-power');
    if (powerEl) powerEl.textContent = power.toString();
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
  }
}
