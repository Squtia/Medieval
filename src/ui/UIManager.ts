import { GameState } from '../core/GameState';
import { AdventurerState, NobleTitle, TITLE_CONFIG, NodeLevel, NodeFeature, getNodeMaxFacilityLevel } from '../models/types';
import { openAdvDetail, getSelectedPartyAdventurer, selectPartyAdventurer, renderPartyUpperSection } from './ModalController';
import { renderAdventurerCard, getAdventurerTooltipHtml } from './components/AdventurerCard';
import { renderBaseBuildings, renderStreetNpcEvents } from './SceneController';
import { isStartupMode } from './MapController';
import { SaveManager } from '../core/SaveManager';
import { positionFloatingElement } from './FloatingPosition';
import { PROSPERITY_THRESHOLDS, calculateNodeLevel } from '../data/BalanceData';
import { ToastManager } from './ToastManager';
import { resetExplorationControllerState } from './ExplorationController';
import { DataStore } from '../systems/DataStore';
import { InventoryUIController } from './components/InventoryUIController';
import { PrisonerModalController } from './modals/PrisonerModalController';
import { BountyModalController } from './modals/BountyModalController';
import { TownManagementSystem } from '../systems/TownManagementSystem';

class UIManagerClass {
  // 頂部資源列 — 延遲到 reinitDOM() 時才初始化，避免 template 注入前取得 null
  uiLocation: HTMLElement | null = null;
  uiTitle: HTMLElement | null = null;
  uiGold: HTMLElement | null = null;
  uiPrestige: HTMLElement | null = null;
  uiFavor: HTMLElement | null = null;
  uiPopulation: HTMLElement | null = null;
  uiFood: HTMLElement | null = null;
  uiWood: HTMLElement | null = null;
  uiStone: HTMLElement | null = null;
  uiIron: HTMLElement | null = null; // UI-02: 補加鐵礦顯示
  uiHide: HTMLElement | null = null;
  uiCotton: HTMLElement | null = null;
  uiSecurity: HTMLElement | null = null;

  // 勞動力分配UI
  uiUnassignedWorkers: HTMLElement | null = null;
  uiWorkerFarmer: HTMLElement | null = null;
  uiWorkerWoodcutter: HTMLElement | null = null;
  uiWorkerMiner: HTMLElement | null = null;
  uiWorkerInfantry: HTMLElement | null = null;
  uiWorkerCavalry: HTMLElement | null = null;
  uiWorkerArcher: HTMLElement | null = null;
  uiNetProduction: HTMLElement | null = null;
  uiDate: HTMLElement | null = null;
  uiThreatDays: HTMLElement | null = null;
  dailySummaryContent: HTMLElement | null = null;
  btnPrepareThreat: HTMLButtonElement | null = null;

  // 儀表板與環境控制
  uiDashboardTitle: HTMLElement | null = null;
  uiDashboardGold: HTMLElement | null = null;
  uiDashboardPrestige: HTMLElement | null = null;
  uiDashboardFavor: HTMLElement | null = null;
  uiTitleProgress: HTMLElement | null = null;
  uiTitleText: HTMLElement | null = null;
  
  advContainer: HTMLElement | null = null;

  // 國家按鈕
  btnMigrate: HTMLButtonElement | null = null;
  btnExplore: HTMLButtonElement | null = null;
  btnFeast: HTMLButtonElement | null = null;
  btnFoundSettlement: HTMLButtonElement | null = null;
  btnWildQuest: HTMLButtonElement | null = null;
  btnEnterBase: HTMLButtonElement | null = null;

  // 地圖面板
  mapInfoPanel: HTMLElement | null = null;
  mapStatusPanel: HTMLElement | null = null;
  statusLocation: HTMLElement | null = null;
  statusAdvCount: HTMLElement | null = null;
  statusPlaytime: HTMLElement | null = null;
  infoFactions: HTMLElement | null = null;
  infoNodes: HTMLElement | null = null;

  /** 在所有 HTML template 注入完成後呼叫，重新綁定所有 DOM 引用 */
  reinitDOM() {
    this.uiLocation            = document.getElementById('ui-location');
    this.uiTitle               = document.getElementById('ui-title');
    this.uiGold                = document.getElementById('ui-gold');
    this.uiPrestige            = document.getElementById('ui-prestige');
    this.uiFavor               = document.getElementById('ui-favor');
    this.uiPopulation          = document.getElementById('ui-population');
    this.uiFood                = document.getElementById('ui-food');
    this.uiWood                = document.getElementById('ui-wood');
    this.uiStone               = document.getElementById('ui-stone');
    this.uiIron                = document.getElementById('ui-iron');
    this.uiHide                = document.getElementById('ui-hide');
    this.uiCotton              = document.getElementById('ui-cotton');
    this.uiSecurity            = document.getElementById('ui-security');
    this.uiUnassignedWorkers   = document.getElementById('ui-unassigned-workers');

    this.uiNetProduction       = document.getElementById('ui-net-production');
    this.uiDate                = document.getElementById('ui-date');
    this.uiThreatDays          = document.getElementById('ui-threat-days');
    this.dailySummaryContent   = document.getElementById('daily-summary-content');
    this.btnPrepareThreat      = document.getElementById('btn-prepare-threat') as HTMLButtonElement;
    this.uiDashboardTitle      = document.getElementById('ui-dashboard-title');
    this.uiDashboardGold       = document.getElementById('ui-dashboard-gold');
    this.uiDashboardPrestige   = document.getElementById('ui-dashboard-prestige');
    this.uiDashboardFavor      = document.getElementById('ui-dashboard-favor');
    this.uiTitleProgress       = document.getElementById('ui-title-progress');
    this.uiTitleText           = document.getElementById('ui-title-text');
    this.advContainer          = (document.getElementById('party-modal-container') || document.getElementById('adventurer-container'));
    this.btnMigrate            = document.getElementById('btn-migrate') as HTMLButtonElement;
    this.btnExplore            = document.getElementById('btn-explore') as HTMLButtonElement;
    this.btnFeast              = document.getElementById('btn-feast') as HTMLButtonElement;
    this.btnFoundSettlement    = document.getElementById('btn-found-settlement') as HTMLButtonElement;
    this.btnWildQuest          = document.getElementById('btn-wild-quest') as HTMLButtonElement;
    this.btnEnterBase          = document.getElementById('btn-enter-base') as HTMLButtonElement;
    this.mapInfoPanel          = document.getElementById('map-info-panel');
    this.mapStatusPanel        = document.getElementById('map-status-panel');
    this.statusLocation        = document.getElementById('status-location');
    this.statusAdvCount        = document.getElementById('status-adv-count');
    this.statusPlaytime        = document.getElementById('status-playtime');
    this.infoFactions          = document.getElementById('info-factions');
    this.infoNodes             = document.getElementById('info-nodes');
    
    // 初始化全域倉庫 UI
    new InventoryUIController(this);
    PrisonerModalController.getInstance().init();
    BountyModalController.getInstance();
  }



  updateUI() {
    const territory = GameState.myTerritory;
    // UI-12: 爵位顯示中文化轉換函數
    const nobleTitleChinese: Record<string, string> = {
      COMMONER: '平民', KNIGHT: '騎士', BARON: '男爵',
      VISCOUNT: '子爵', COUNT: '伯爵', MARQUIS: '侯爵', DUKE: '公爵'
    };
    const titleCN = nobleTitleChinese[territory.title] ?? territory.title;
    // UI-11: 移除重複賍値（原代碼第 59~60 行重複了兩次）
    if (this.uiTitle) this.uiTitle.textContent = `爵位：${titleCN}`;
    if (this.uiGold) this.uiGold.textContent = territory.gold.toString();
    if (this.uiPrestige) this.uiPrestige.textContent = territory.prestige.toString();
    if (this.uiFavor) this.uiFavor.textContent = territory.royalFavor.toString();
    if (this.uiPopulation) {
      this.uiPopulation.textContent = `${territory.population}`;
    }
    if (this.uiFood) this.uiFood.textContent = territory.food.toString();
    if (this.uiWood) this.uiWood.textContent = territory.wood.toString();
    if (this.uiStone) this.uiStone.textContent = territory.stone.toString();
    if (this.uiIron) this.uiIron.textContent = (territory.iron || 0).toString(); // UI-02
    if (this.uiHide) this.uiHide.textContent = (territory.tradeInventory && territory.tradeInventory['tg_hide'] || 0).toString();
    if (this.uiCotton) this.uiCotton.textContent = (territory.tradeInventory && territory.tradeInventory['tg_cotton'] || 0).toString();
    
    // UI-03: 更新治安度並套用顏色提示
    if (this.uiSecurity) {
      const secValue = (territory.security === null || territory.security === undefined || isNaN(territory.security)) ? 100 : territory.security;
      this.uiSecurity.textContent = secValue.toString();
      if (secValue >= 80) this.uiSecurity.style.color = '#10b981'; // 綠色
      else if (secValue < 30) this.uiSecurity.style.color = '#ef4444'; // 紅色
      else this.uiSecurity.style.color = '#e2e8f0'; // 正常
    }

    // 更新日期與雙倍經驗池 (Rested EXP)
    if (this.uiDate) {
      let dateText = `第 ${GameState.currentYear} 年 ${GameState.currentMonth} 月 ${GameState.currentDay} 日`;
      if (GameState.restedExpPool > 0) {
        dateText += ` (💤${GameState.restedExpPool})`;
      }
      this.uiDate.textContent = dateText;
    }
    if (this.uiThreatDays) {
      this.uiThreatDays.textContent = `${GameState.threat.daysRemaining}天`;
      this.uiThreatDays.parentElement!.setAttribute('data-tip', `${GameState.threat.name}，嚴重度 ${GameState.threat.severity}`);
    }
    if (this.btnPrepareThreat) {
      const canPrepare = GameState.threat.daysRemaining <= 3 && GameState.threat.daysRemaining > 0 && !GameState.threat.prepared;
      this.btnPrepareThreat.style.display = canPrepare ? 'block' : 'none';
      this.btnPrepareThreat.disabled = territory.wood < 20;
    }
    if (this.dailySummaryContent) {
      const summary = GameState.lastDailySummary;
      this.dailySummaryContent.textContent = summary
        ? `第${summary.day}天｜金 ${formatDelta(summary.goldDelta)}｜糧 ${formatDelta(summary.foodDelta)}｜木 ${formatDelta(summary.woodDelta)}｜石 ${formatDelta(summary.stoneDelta)}｜鐵 ${formatDelta(summary.ironDelta)}｜完成任務 ${summary.missionsCompleted}`
        : '尚未結束第一天。';
    }

    // 更新勞動力面板
    if (this.uiUnassignedWorkers) this.uiUnassignedWorkers.textContent = (territory.workers['UNASSIGNED'] || 0).toString();
    document.querySelectorAll<HTMLElement>('.ui-worker-count').forEach(el => {
      const job = el.getAttribute('data-job');
      if (job) {
        el.textContent = (territory.workers[job] || 0).toString();
      }
    });

    // 動態更新哨所/衛兵卡片名稱
    const currentNode = GameState.mapSystem?.getNodes().find(n => n.id === territory.currentCountryId);
    const nodeLevel = currentNode?.nodeLevel ?? NodeLevel.VILLAGE;
    const isWatchtowerPhase = (nodeLevel === NodeLevel.CAMP || nodeLevel === NodeLevel.VILLAGE || nodeLevel === NodeLevel.WILDERNESS);
    
    const labelElem = document.getElementById('ui-worker-job-label-INFANTRY');
    const descElem = document.getElementById('ui-worker-job-desc-INFANTRY');
    if (labelElem) labelElem.textContent = isWatchtowerPhase ? '🏰 哨所' : '⚔️ 衛兵';
    if (descElem) descElem.textContent = isWatchtowerPhase ? '維持治安，提升敵意掠奪抵禦成功率' : '維持治安與都市防衛';
    
    // 同步滑桿 max 與當前數值 (防呆：最高為當前人數 + 閒置人數)
    const unassigned = territory.workers['UNASSIGNED'] || 0;
    document.querySelectorAll<HTMLInputElement>('.worker-slider').forEach(slider => {
      const job = slider.getAttribute('data-job')!;
      const current = territory.workers[job] || 0;
      slider.max = (current + unassigned).toString();
      slider.value = current.toString();
    });
    
    // 更新四大生產設施等級、倍率與升級按鈕
    const facilities: ('farmland' | 'lumberMill' | 'quarry' | 'huntingGround')[] = ['farmland', 'lumberMill', 'quarry', 'huntingGround'];
    const maxFacAllowed = getNodeMaxFacilityLevel(nodeLevel);

    facilities.forEach(fac => {
      const lvl = territory.getFacilityLevel(fac);
      const mult = territory.getFacilityMultiplier(fac);
      const nextLvl = lvl + 1;
      const lvlLabel = document.getElementById(`ui-facility-lvl-${fac}`);
      if (lvlLabel) lvlLabel.textContent = `Lv.${lvl}`;

      const btn = document.getElementById(`btn-upgrade-${fac}`) as HTMLButtonElement | null;
      if (btn) {
        if (nextLvl > maxFacAllowed) {
          btn.textContent = `需擴建規模`;
          btn.disabled = true;
          btn.style.opacity = '0.5';
        } else {
          const cost = territory.getFacilityUpgradeCost(fac, nextLvl);
          const hasRes = territory.gold >= cost.gold && territory.wood >= cost.wood && territory.stone >= cost.stone && territory.iron >= cost.iron;
          btn.textContent = `🔨 升級 (${cost.gold}G)`;
          btn.disabled = !hasRes;
          btn.style.opacity = hasRes ? '1.0' : '0.6';
          btn.title = `升級消耗：💰${cost.gold}金幣 🌲${cost.wood}木材 🧱${cost.stone}石材 ${cost.iron > 0 ? `🔗${cost.iron}鐵礦` : ''}`;
          
          btn.onclick = () => {
            if (territory.gold >= cost.gold && territory.wood >= cost.wood && territory.stone >= cost.stone && territory.iron >= cost.iron) {
              territory.gold -= cost.gold;
              territory.wood -= cost.wood;
              territory.stone -= cost.stone;
              territory.iron -= cost.iron;
              if (fac === 'farmland') territory.farmlandLevel = nextLvl;
              else if (fac === 'lumberMill') territory.lumberMillLevel = nextLvl;
              else if (fac === 'quarry') territory.quarryLevel = nextLvl;
              else territory.huntingGroundLevel = nextLvl;

              ToastManager.show(`🎉 設施升級成功！${fac === 'farmland' ? '🌾 農田' : fac === 'lumberMill' ? '🪓 伐木場' : fac === 'quarry' ? '⛏️ 採石場' : '🏹 獵場'} 已達 Lv.${nextLvl}！`, 'success');
              this.updateUI();
            } else {
              ToastManager.show('資源或金幣不足，無法升級設施！', 'warning');
            }
          };
        }
      }
    });

    if (this.uiNetProduction) {
      const productionMultiplier = TownManagementSystem.getProductionMultiplier();
      const farmMult = territory.getFacilityMultiplier('farmland');
      const lumberMult = territory.getFacilityMultiplier('lumberMill');
      const quarryMult = territory.getFacilityMultiplier('quarry');
      const huntMult = territory.getFacilityMultiplier('huntingGround');

      const foodProduced = Math.floor((territory.workers['FARMER'] || 0) * 3 * farmMult * productionMultiplier);
      const woodProduced = Math.floor((territory.workers['WOODCUTTER'] || 0) * 2 * lumberMult * productionMultiplier);
      const stoneProduced = Math.floor((territory.workers['MINER'] || 0) * 1 * quarryMult * productionMultiplier);
      const ironProduced = Math.floor((territory.workers['MINER'] || 0) * 0.2 * quarryMult * productionMultiplier);
      const hideProduced = Math.floor((territory.workers['HUNTER'] || 0) * 1 * huntMult * productionMultiplier);

      const totalPeople = territory.population + GameState.adventurers.length;
      let foodConsumed = totalPeople * 1;
      foodConsumed += (territory.workers['INFANTRY'] || 0) * 1;
      foodConsumed += (territory.workers['ARCHER'] || 0) * 1;
      foodConsumed += (territory.workers['CAVALRY'] || 0) * 2;
      const netFood = foodProduced - foodConsumed;
      
      let prodText = `預期產量：🍞糧食 ${netFood > 0 ? '+' : ''}${netFood}/天 ｜ 🌲木材 +${woodProduced}/天 ｜ 🧱石材 +${stoneProduced}/天`;
      if (ironProduced > 0) prodText += ` ｜ 🔗鐵礦 +${ironProduced}/天`;
      if (hideProduced > 0) prodText += ` ｜ 🦬生皮 +${hideProduced}/天`;

      this.uiNetProduction.innerHTML = prodText;
      this.uiNetProduction.style.color = netFood >= 0 ? '#10b981' : '#ef4444';
    }
  
    // UI-12: 改用中文爵位顯示儀表板
    if (this.uiDashboardTitle) this.uiDashboardTitle.textContent = `爵位：${titleCN}`;
    if (this.uiDashboardGold) this.uiDashboardGold.textContent = territory.gold.toString();
    if (this.uiDashboardPrestige) this.uiDashboardPrestige.textContent = territory.prestige.toString();
    if (this.uiDashboardFavor) this.uiDashboardFavor.textContent = territory.royalFavor.toString();
    
    // 爵位進度條計算與晉升邏輯
    try {
      const currIdx = TITLE_CONFIG.findIndex(t => t.title === territory.title);
      const btnPromote = document.getElementById('btn-promote-title');
      
      if (currIdx >= 0 && currIdx < TITLE_CONFIG.length - 1) {
        const currentRank = TITLE_CONFIG[currIdx];
        const nextRank = TITLE_CONFIG[currIdx + 1];
        const prevReq = currentRank.reqPrestige;
        const progress = Math.min(100, Math.max(0, ((territory.prestige - prevReq) / (nextRank.reqPrestige - prevReq)) * 100));
        
        if (this.uiTitleProgress) this.uiTitleProgress.style.width = `${progress}%`;
        
        const playerNode = GameState.mapSystem?.getNodes().find(n => n.isPlayerBase);
        const currentProsperity = playerNode ? playerNode.prosperity : (territory.getRealtimeProsperity ? territory.getRealtimeProsperity() : territory.population);

        const condPrestige = territory.prestige >= nextRank.reqPrestige;
        const condProsperity = currentProsperity >= nextRank.reqProsperity;
        const condGold = territory.gold >= nextRank.reqGold;
        const canPromote = condPrestige && condProsperity && condGold;

        if (canPromote) {
          if (this.uiTitleText) this.uiTitleText.innerHTML = `<span style="color:#10b981;">條件已達成，準備晉升！</span>`;
          if (btnPromote) {
            btnPromote.style.display = 'block';
            btnPromote.innerText = `🎉 舉辦晉升大典 (${nextRank.titleCN})`;
            // 防止重複綁定
            btnPromote.onclick = () => {
              if (confirm(`確定要花費 ${nextRank.reqGold} 金幣舉辦晉升大典，成為【${nextRank.titleCN}】嗎？`)) {
                if (territory.gold >= nextRank.reqGold) {
                  territory.gold -= nextRank.reqGold;
                  territory.title = nextRank.title;
                  alert(`恭喜！您已正式晉升為【${nextRank.titleCN}】！\n新特權：商隊上限 ${nextRank.maxCaravans}、英雄上限 ${nextRank.maxRoster}`);
                  this.updateUI();
                } else {
                  alert('金幣不足！');
                }
              }
            };
          }
        } else {
          let missingText = `距離下一階 (${nextRank.titleCN}) 還需: `;
          let reqs = [];
          if (!condPrestige) reqs.push(`${nextRank.reqPrestige - territory.prestige} 聲望`);
          if (!condProsperity) reqs.push(`${nextRank.reqProsperity - currentProsperity} 領地繁榮度`);
          if (!condGold) reqs.push(`${nextRank.reqGold - territory.gold} 金幣`);
          if (this.uiTitleText) this.uiTitleText.textContent = missingText + reqs.join(', ');
          if (btnPromote) btnPromote.style.display = 'none';
        }
      } else {
        if (this.uiTitleProgress) this.uiTitleProgress.style.width = `100%`;
        if (this.uiTitleText) this.uiTitleText.textContent = `已達最高爵位`;
        if (btnPromote) btnPromote.style.display = 'none';
      }
    } catch(e: any) {
      console.error('Error updating title progress:', e);
    }
  
    // 更新傭兵名單
    let allIdle = true;
    if (this.advContainer) {
      const activeTooltip = document.getElementById('adv-tooltip');
      if (activeTooltip) activeTooltip.style.opacity = '0';
      this.advContainer.innerHTML = '';
      
      const partyCountTag = document.getElementById('party-count-tag');
      if (partyCountTag) partyCountTag.textContent = `${GameState.adventurers.length} 人`;

      let selectedAdv = getSelectedPartyAdventurer();
      if (!selectedAdv || !GameState.adventurers.includes(selectedAdv)) {
        selectedAdv = GameState.adventurers[0] || null;
        selectPartyAdventurer(selectedAdv);
      } else {
        renderPartyUpperSection();
      }

      GameState.adventurers.forEach(adv => {
        const card = document.createElement('div');
        card.className = 'adventurer-card';
        card.style.cursor = 'pointer';
        
        if (selectedAdv && adv.id === selectedAdv.id) {
          card.style.border = '2px solid #eab308';
          card.style.background = 'rgba(234, 179, 8, 0.2)';
        }

        if (adv.trait.name === '誓約守衛') {
          card.classList.add('guardian');
        }
        
        let stateText = '🟢 閒置';
        if (adv.currentState === AdventurerState.RESTING) {
          stateText = `🛌 休養中 (${adv.restingDaysLeft}天後)`;
        } else if (adv.currentState !== AdventurerState.IDLE) {
          stateText = `🔴 任務中`;
        }
        
        let dispatchInfo = '';
        if (adv.currentState !== AdventurerState.IDLE && adv.currentState !== AdventurerState.RESTING) {
          const activeMissions = GameState.system?.getActiveMissions() || [];
          const mission = activeMissions.find(m => m.adventurers.some(a => a.id === adv.id));
          if (mission) {
            const targetNode = GameState.mapSystem.getNodes().find(n => n.id === mission.task.targetNodeId);
            dispatchInfo = `\n派遣據點：${targetNode ? targetNode.name : '未知'}\n任務名稱：${mission.task.name}`;
          }
        }

        const attr = adv.getEffectiveAttributes();
        let equipText = '';
        if (adv.equipment.WEAPON) equipText += `\n- ⚔️ ${adv.equipment.WEAPON.name}`;
        if (adv.equipment.ARMOR) equipText += `\n- 🛡️ ${adv.equipment.ARMOR.name}`;
        if (adv.equipment.ACCESSORY) equipText += `\n- 💍 ${adv.equipment.ACCESSORY.name}`;
        if (!equipText) equipText = '\n- 無裝備';

        const tooltipHtml = getAdventurerTooltipHtml(adv);

        card.addEventListener('mouseenter', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) {
            tEl.innerHTML = tooltipHtml;
            tEl.style.opacity = '1';
          }
        });

        card.addEventListener('mousemove', (e) => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) {
            positionFloatingElement(tEl, e.clientX, e.clientY);
          }
        });

        card.addEventListener('mouseleave', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) {
            tEl.style.opacity = '0';
          }
        });
        
        card.innerHTML = renderAdventurerCard(adv, {
          cornerLabel: adv.office ? '👑 ' + stateText : stateText
        });
        
        card.addEventListener('click', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
          const detailsPane = document.getElementById('party-details-pane');
          if (detailsPane) detailsPane.style.display = 'flex';
          selectPartyAdventurer(adv);
          this.updateUI();
        });
        if (this.advContainer) this.advContainer.appendChild(card);
        if (adv.currentState !== AdventurerState.IDLE) allIdle = false;
      });
    }
  
    const isAtHome = GameState.currentViewNode?.isPlayerBase === true;
    if (this.btnEnterBase) this.btnEnterBase.disabled = !isAtHome;
    if (this.btnExplore) this.btnExplore.disabled = !isAtHome;
    if (this.btnFeast) this.btnFeast.disabled = territory.gold < 300;
    if (this.btnMigrate) this.btnMigrate.disabled = territory.gold < 1000;
    if (this.btnFoundSettlement) this.btnFoundSettlement.disabled = territory.gold < 500;
  
    if (this.btnWildQuest) {
      this.btnWildQuest.disabled = !allIdle;
      this.btnWildQuest.textContent = !allIdle ? '🚫 傭兵忙碌中' : '⚔️ 編制討伐小隊';
    }
    
    // 更新待辦事項徽章
    const todoBadge = document.getElementById('todo-badge');
    if (todoBadge) {
      const pendingLegacy = territory.pendingEvents?.length || 0;
      const pendingNarrative = (territory as any).pendingNarrativeNodes?.length || 0;
      const totalPending = pendingLegacy + pendingNarrative;

      if (totalPending > 0) {
        todoBadge.style.display = 'flex';
        todoBadge.textContent = totalPending.toString();
      } else {
        todoBadge.style.display = 'none';
      }
    }

    // 更新領地建築升級清單
    renderBaseBuildings();

    // 更新地圖面板與共用右側欄位
    const sharedRightPanel = document.getElementById('shared-right-panel');
    const sceneDashboard = document.getElementById('scene-dashboard-content');
    const nodeDetailPanel = document.getElementById('node-detail-panel');
    
    if (document.getElementById('map-view')?.classList.contains('active') && !isStartupMode) {
      if (sharedRightPanel) sharedRightPanel.style.display = 'flex';
      if (sceneDashboard) sceneDashboard.style.display = 'none';
      
      const isNodeDetailOpen = nodeDetailPanel && nodeDetailPanel.style.display === 'flex';
      if (this.mapInfoPanel) {
        if (isNodeDetailOpen) {
          this.mapInfoPanel.style.display = 'none';
        } else {
          this.mapInfoPanel.style.display = 'flex';
        }
      }
      if (this.mapStatusPanel) this.mapStatusPanel.style.display = 'block';

      // 傭兵隊伍功能：在大陸地圖時隱藏按鈕並關閉面板
      const btnDockParty = document.getElementById('btn-dock-party');
      const btnDockInventory = document.getElementById('btn-dock-inventory');
      const btnDockDungeon = document.getElementById('btn-dock-dungeon');
      const modalPartyList = document.getElementById('modal-party-list');
      const inventoryPanel = document.getElementById('inventory-panel');
      if (btnDockParty) btnDockParty.style.display = 'none';
      if (btnDockInventory) btnDockInventory.style.display = 'none';
      if (btnDockDungeon) btnDockDungeon.style.display = 'none';
      if (modalPartyList) modalPartyList.classList.remove('active');
      if (inventoryPanel) inventoryPanel.classList.remove('active');

      // 狀態
      const baseNode = GameState.mapSystem?.getNodes().find(n => n.id === territory.currentCountryId);
      if (this.statusLocation) this.statusLocation.textContent = baseNode ? baseNode.name : '無';
      if (this.statusAdvCount) this.statusAdvCount.textContent = GameState.adventurers.length.toString();
      const currentPlayTime = GameState.playTime + (Date.now() - GameState.sessionStartTime);
      if (this.statusPlaytime) this.statusPlaytime.textContent = SaveManager.formatPlayTime(currentPlayTime);

      // 世界資訊
      if (this.infoFactions) this.infoFactions.textContent = GameState.mapSystem?.getFactions().length.toString() || '0';
      if (this.infoNodes) this.infoNodes.textContent = GameState.mapSystem?.getNodes().length.toString() || '0';

      // 重新繪製活躍商隊商路連線
      if (typeof (window as any).renderTradeRoutes === 'function') {
        (window as any).renderTradeRoutes();
      }
    } else if (document.getElementById('scene-view')?.classList.contains('active')) {
      if (sharedRightPanel) sharedRightPanel.style.display = 'flex';
      if (sceneDashboard) sceneDashboard.style.display = 'flex';
      if (this.mapInfoPanel) this.mapInfoPanel.style.display = 'none';
      if (this.mapStatusPanel) this.mapStatusPanel.style.display = 'none';
      if (nodeDetailPanel) nodeDetailPanel.style.display = 'none';

      // 在據點街道視圖時顯示傭兵隊伍按鈕
      const btnDockParty = document.getElementById('btn-dock-party');
      const btnDockInventory = document.getElementById('btn-dock-inventory');
      const btnDockDungeon = document.getElementById('btn-dock-dungeon');
      if (btnDockParty) btnDockParty.style.display = 'flex';
      if (btnDockInventory) btnDockInventory.style.display = 'flex';
      if (btnDockDungeon) btnDockDungeon.style.display = 'flex';
    } else {
      if (sharedRightPanel) sharedRightPanel.style.display = 'none';
      if (sceneDashboard) sceneDashboard.style.display = 'none';
      if (this.mapInfoPanel) this.mapInfoPanel.style.display = 'none';
      if (this.mapStatusPanel) this.mapStatusPanel.style.display = 'none';
      if (nodeDetailPanel) nodeDetailPanel.style.display = 'none';
    }

    const isRightPanelShown = sharedRightPanel && sharedRightPanel.style.display !== 'none';
    document.body.classList.toggle('has-right-panel', !!isRightPanelShown);

    // 更新 Command Crest Hub 與返回據點懸浮按鈕的顯示/隱藏與標籤
    const commandCrest = document.getElementById('command-crest-container');
    const btnReturnBase = document.getElementById('btn-return-base');
    const endDayTag = document.getElementById('end-day-tag');
    const isMainMenuViewActive = document.getElementById('main-menu-view')?.classList.contains('active');

    if (commandCrest) {
      if (isMainMenuViewActive || isStartupMode) {
        commandCrest.style.display = 'none';
      } else {
        commandCrest.style.display = 'flex';
      }
    }

    if (endDayTag) {
      endDayTag.textContent = `第 ${GameState.totalDays} 天`;
    }

    if (btnReturnBase) {
      const isMapViewActive = document.getElementById('map-view')?.classList.contains('active');
      const hasBase = !!territory.currentCountryId;
      if (isMapViewActive && !isStartupMode && hasBase) {
        btnReturnBase.style.display = 'block';
        btnReturnBase.setAttribute('data-tip', '切換至 我的據點');
      } else if (!isMapViewActive && !isStartupMode && hasBase) {
        btnReturnBase.style.display = 'block';
        btnReturnBase.setAttribute('data-tip', '切換至 世界地圖');
      } else {
        btnReturnBase.style.display = 'none';
      }
    }

    // 重新整理繁榮度進度條 UI
    this.refreshProsperityBar();

    // 更新「探索周邊」按鈕狀態：本回合已使用則灰掉
    const btnExplore = document.getElementById('btn-explore') as HTMLButtonElement | null;
    if (btnExplore) {
      const explored = territory.exploredToday >= territory.maxExplorationsPerDay;
      btnExplore.disabled = explored;
      if (explored) {
        btnExplore.classList.add('explored-today');
        btnExplore.title = `本回合已探索（上限：${territory.maxExplorationsPerDay} 次），請推進回合後再試！`;
      } else {
        btnExplore.classList.remove('explored-today');
        btnExplore.title = '';
      }
    }

    // 隨全域 UI 即時刷新街道訪客 NPC 事件列
    import('./SceneController').then(({ renderStreetNpcEvents }) => {
      renderStreetNpcEvents();
    });
  }

  /**
   * 徹底清理並隱藏遊戲中所有開啟的彈窗、抽屜面板與子視窗
   */
  clearAllUIOverlays(): void {
    resetExplorationControllerState();
    document.querySelectorAll('.view:not(#main-menu-view), .facility-view, .modal-overlay, .side-panel-left, .side-panel-right').forEach(v => {
      v.classList.remove('active');
    });
    document.querySelectorAll('#modal-exploration-dispatch').forEach(v => v.remove());

    const detailsPane = document.getElementById('party-details-pane');
    if (detailsPane) detailsPane.style.display = 'none';

    const equipSelectPane = document.getElementById('party-equip-select-pane');
    if (equipSelectPane) equipSelectPane.style.display = 'none';

    const advTooltip = document.getElementById('adv-tooltip');
    if (advTooltip) advTooltip.style.opacity = '0';

    const topBar = document.getElementById('top-bar');
    if (topBar) topBar.style.display = 'none';

    const sharedRightPanel = document.getElementById('shared-right-panel');
    if (sharedRightPanel) sharedRightPanel.style.display = 'none';

    const commandCrest = document.getElementById('command-crest-container');
    if (commandCrest) commandCrest.style.display = 'none';
  }

  closeAllLeftPanels(): void {
    document.querySelectorAll('.side-panel-left').forEach(el => el.classList.remove('active'));
  }

  // 播放黑屏轉場動畫
  playTransition(callback: () => void) {
    const overlay = document.getElementById('transition-overlay');
    if (!overlay) {
      callback();
      return;
    }
    overlay.classList.add('active');
    setTimeout(() => {
      callback();
      // 在下一個 frame 移除，確保畫面已經渲染完成
      requestAnimationFrame(() => {
        setTimeout(() => {
          overlay.classList.remove('active');
        }, 100);
      });
    }, 500); // 對應 CSS transition 0.5s
  }

  // 重新整理並更新繁榮度進度條
  refreshProsperityBar(): void {
    if (!GameState.mapSystem) return;
    const playerNode = GameState.mapSystem.getNodes().find(n => n.isPlayerBase) ||
      (GameState.myTerritory.currentCountryId ? GameState.mapSystem.getNodeById(GameState.myTerritory.currentCountryId) : null);
    if (!playerNode) return;

    const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
    const levelIcons = ['🏚️', '🏕️', '🏡', '🏘️', '🏰'];
    const vassalNodesCount = GameState.mapSystem.getNodes().filter(n => n.ownerFactionId === 'player' && !n.isPlayerBase).length;
    const roadCount = GameState.roadSystem ? GameState.roadSystem.getRoads().length : 0;

    const hasAdjacentDanger = GameState.mapSystem.getNodes().some(other =>
      other.id !== playerNode.id &&
      other.isDynamic &&
      (other.nodeLevel === NodeLevel.WILDERNESS || other.feature === NodeFeature.MONSTER_NEST) &&
      Math.sqrt((other.x - playerNode.x) ** 2 + (other.y - playerNode.y) ** 2) < 15
    );

    const t = GameState.myTerritory;
    if (t && t.getRealtimeProsperity) {
      playerNode.prosperity = t.getRealtimeProsperity(roadCount, vassalNodesCount, hasAdjacentDanger);
    }

    const previousLevel = playerNode.nodeLevel;
    const computedLevel = calculateNodeLevel(playerNode, vassalNodesCount > 0);

    // Prosperity can change outside the monthly map simulation (events, milestones,
    // cheats, etc.). Reconcile the tier whenever the UI refreshes so the stored
    // node level cannot lag behind the value shown by the prosperity bar.
    if (computedLevel !== previousLevel) {
      playerNode.nodeLevel = computedLevel;
      playerNode.isCapital = computedLevel === NodeLevel.CAPITAL;

      const newLevelName = levelNames[computedLevel] || '新階段';
      const isUpgrade = computedLevel > previousLevel;
      if (isUpgrade) {
        console.log(`[系統] 🎉 恭喜！「${playerNode.name}」規模擴張為【${newLevelName}】！`);
        ToastManager.show(`🎉 據點擴張！「${playerNode.name}」已成為【${newLevelName}】！`, 'success');
      } else {
        console.log(`[系統] ⚠️ 警告！「${playerNode.name}」因繁榮度下降，退化為【${newLevelName}】！`);
        ToastManager.show(`⚠️ 據點衰退！「${playerNode.name}」已退化為【${newLevelName}】！`, 'warning');
      }

      // Building availability is tier-dependent, so refresh it after the tier
      // has been reconciled rather than waiting for the next full UI update.
      renderBaseBuildings();

      if (GameState.currentViewNode?.id === playerNode.id) {
        const sceneState = document.getElementById('scene-country-state');
        if (sceneState) {
          sceneState.textContent = `規模：${newLevelName} | ${playerNode.description}`;
        }

        const streetBackground = document.getElementById('street-parallax-bg') as HTMLDivElement | null;
        if (streetBackground) {
          const baseUrl = import.meta.env.BASE_URL || './';
          const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
          streetBackground.style.backgroundImage = computedLevel >= NodeLevel.TOWN
            ? `url('${cleanBase}bg_street_prosperous_1784087131344.png')`
            : computedLevel >= NodeLevel.CAMP
              ? `url('${cleanBase}bg_street_village_1784087142427.png')`
              : `url('${cleanBase}bg_street_ruins_1784087152568.png')`;
        }
      }
    }

    const current = playerNode.prosperity;
    let nextThreshold = current;
    if (playerNode.nodeLevel < NodeLevel.CAPITAL) {
      nextThreshold = PROSPERITY_THRESHOLDS[playerNode.nodeLevel + 1 as NodeLevel] ?? 40;
    }

    const levelLabelText = `${levelIcons[playerNode.nodeLevel] || '🏕️'} ${levelNames[playerNode.nodeLevel] || '據點'}`;
    const nextLevelName = playerNode.nodeLevel === NodeLevel.TOWN && vassalNodesCount === 0
      ? `${levelNames[NodeLevel.CAPITAL]}（需附庸）`
      : levelNames[playerNode.nodeLevel + 1] || '';

    this.updateProsperityBar(current, nextThreshold, levelLabelText, nextLevelName);
    this.updateActiveMissions();
    if (document.getElementById('scene-view')?.classList.contains('active')) {
      renderStreetNpcEvents();
    }
  }

  // 更新活躍任務面板
  updateActiveMissions(): void {
    const container = document.getElementById('active-missions-container');
    if (!container) return;
    
    // 檢查是否在街道視圖，且沒有開啟任何 facility-view
    const isSceneActive = document.getElementById('scene-view')?.classList.contains('active');
    const isFacilityOpen = Array.from(document.querySelectorAll('.facility-view')).some(v => v.classList.contains('active'));
    
    if (!isSceneActive || isFacilityOpen) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = '';
    const missions = GameState.system?.getActiveMissions() || [];
    if (missions.length === 0) return;

    missions.forEach(mission => {
      const el = document.createElement('div');
      el.style.background = 'rgba(0, 0, 0, 0.7)';
      el.style.border = '1px solid rgba(251, 191, 36, 0.4)';
      el.style.borderRadius = '6px';
      el.style.padding = '8px 12px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.gap = '8px';
      el.style.backdropFilter = 'blur(4px)';
      el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
      
      let icon = '⚔️';
      if ((mission.task.type as string) === 'TRADE') icon = '🐫';
      else if ((mission.task.type as string) === 'BOUNTY') icon = '📜';

      el.innerHTML = `
        <div style="font-size: 1.2rem;">${icon}</div>
        <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
          <div style="color: #fbbf24; font-size: 0.85rem; font-weight: bold; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">${mission.task.name}</div>
          <div style="color: #cbd5e1; font-size: 0.75rem;">剩餘 ${mission.remainingDays} 回合</div>
        </div>
      `;
      container.appendChild(el);
    });
  }

  // C4: 更新繁榮度進度條
  updateProsperityBar(current: number, nextThreshold: number, levelLabelText: string, nextLevelName?: string): void {
    const levelLabel = document.getElementById('prosperity-level-label');
    const valueLabel = document.getElementById('prosperity-value-label');
    const barFill = document.getElementById('prosperity-bar-fill') as HTMLDivElement | null;
    const nextLabel = document.getElementById('prosperity-next-label');
    const dangerBadge = document.getElementById('prosperity-danger-badge');

    if (levelLabel) levelLabel.textContent = levelLabelText;
    if (valueLabel) valueLabel.textContent = `${current} / ${nextThreshold}`;

    const pct = nextThreshold > 0 ? Math.min(100, Math.round((current / nextThreshold) * 100)) : 100;
    if (barFill) {
      barFill.style.width = `${pct}%`;
      // 顏色反饋：接近升級時轉綠色
      if (pct >= 80) barFill.style.background = 'linear-gradient(90deg, #16a34a, #4ade80)';
      else if (pct >= 50) barFill.style.background = 'linear-gradient(90deg, #d97706, #fbbf24)';
      else barFill.style.background = 'linear-gradient(90deg, #7c3aed, #a78bfa)';
    }

    const diff = nextThreshold - current;
    if (nextLabel) {
      if (diff <= 0 && nextLevelName?.includes('需附庸')) {
        nextLabel.textContent = '繁榮度已達標；取得至少一個附庸據點後可升為首都';
      } else if (diff > 0) {
        const targetStr = nextLevelName ? `至 ${nextLevelName} ` : '';
        nextLabel.textContent = `距升級${targetStr}還差 ${diff} 點繁榮度`;
      } else {
        nextLabel.textContent = '✨ 繁榮度已達最高等級';
      }
    }

    // 檢查相鄰危險並顯示警告徽章
    if (dangerBadge && GameState.mapSystem) {
      const playerNode = GameState.mapSystem.getNodes().find(n => n.isPlayerBase) ||
        (GameState.myTerritory.currentCountryId ? GameState.mapSystem.getNodeById(GameState.myTerritory.currentCountryId) : null);
      if (playerNode) {
        const hasDanger = GameState.mapSystem.getNodes().some(other =>
          other.id !== playerNode.id &&
          other.isDynamic &&
          (other.nodeLevel === NodeLevel.WILDERNESS || other.feature === NodeFeature.MONSTER_NEST) &&
          Math.sqrt((other.x - playerNode.x) ** 2 + (other.y - playerNode.y) ** 2) < 15
        );
        dangerBadge.style.display = hasDanger ? 'inline' : 'none';
      }
    }
  }
}

export const UIManager = new UIManagerClass();

// C4: 在 UIManager 初始化後，訂閱 PROSPERITY_CHANGED 事件更新進度條
import('../core/EventBus').then(({ EventBus }) => {
  import('../core/GameEvents').then(({ GameEventType }) => {
    EventBus.getInstance().subscribe(GameEventType.PROSPERITY_CHANGED, (payload) => {
      UIManager.refreshProsperityBar();
    }, 'ui');
  });
});

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
