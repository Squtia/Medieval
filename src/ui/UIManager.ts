import { GameState } from '../core/GameState';
import { AdventurerState, NobleTitle, TITLE_CONFIG } from '../models/types';
import { openAdvDetail, getSelectedPartyAdventurer, selectPartyAdventurer, renderPartyUpperSection } from './ModalController';
import { renderBaseBuildings } from './SceneController';
import { isStartupMode } from './MapController';
import { SaveManager } from '../core/SaveManager';
import { positionFloatingElement } from './FloatingPosition';

class UIManagerClass {
  // 頂部資源列
  uiLocation = document.getElementById('ui-location')!;
  uiTitle = document.getElementById('ui-title')!;
  uiGold = document.getElementById('ui-gold');
  uiPrestige = document.getElementById('ui-prestige');
  uiFavor = document.getElementById('ui-favor');
  uiPopulation = document.getElementById('ui-population');
  uiFood = document.getElementById('ui-food');
  uiWood = document.getElementById('ui-wood');
  uiStone = document.getElementById('ui-stone');
  uiIron = document.getElementById('ui-iron'); // UI-02: 補加鐵礦顯示

  // 勞動力分配UI
  uiUnassignedWorkers = document.getElementById('ui-unassigned-workers');
  uiWorkerFarmer = document.getElementById('ui-worker-FARMER');
  uiWorkerWoodcutter = document.getElementById('ui-worker-WOODCUTTER');
  uiWorkerMiner = document.getElementById('ui-worker-MINER');
  uiNetProduction = document.getElementById('ui-net-production');
  uiDate = document.getElementById('ui-date');
  uiThreatDays = document.getElementById('ui-threat-days');
  dailySummaryContent = document.getElementById('daily-summary-content');
  btnPrepareThreat = document.getElementById('btn-prepare-threat') as HTMLButtonElement;

  // 儀表板與環境控制
  uiDashboardTitle = document.getElementById('ui-dashboard-title')!;
  uiDashboardGold = document.getElementById('ui-dashboard-gold')!;
  uiDashboardPrestige = document.getElementById('ui-dashboard-prestige')!;
  uiDashboardFavor = document.getElementById('ui-dashboard-favor')!;
  uiTitleProgress = document.getElementById('ui-title-progress')!;
  uiTitleText = document.getElementById('ui-title-text')!;
  
    advContainer = (document.getElementById('party-modal-container') || document.getElementById('adventurer-container'))!;

  // 國家按鈕
  btnMigrate = document.getElementById('btn-migrate') as HTMLButtonElement;
  btnExplore = document.getElementById('btn-explore') as HTMLButtonElement;
  btnTribute = document.getElementById('btn-tribute') as HTMLButtonElement;
  btnFeast = document.getElementById('btn-feast') as HTMLButtonElement;
  btnRecruit = document.getElementById('btn-recruit') as HTMLButtonElement;
  btnFoundSettlement = document.getElementById('btn-found-settlement') as HTMLButtonElement;
  btnWildQuest = document.getElementById('btn-wild-quest') as HTMLButtonElement;
  btnEnterBase = document.getElementById('btn-enter-base') as HTMLButtonElement;

  // 地圖面板
  mapInfoPanel = document.getElementById('map-info-panel')!;
  mapStatusPanel = document.getElementById('map-status-panel')!;
  statusLocation = document.getElementById('status-location')!;
  statusAdvCount = document.getElementById('status-adv-count')!;
  statusPlaytime = document.getElementById('status-playtime')!;
  infoFactions = document.getElementById('info-factions')!;
  infoNodes = document.getElementById('info-nodes')!;

  updateUI() {
    const territory = GameState.myTerritory;
    // UI-12: 爵位顯示中文化轉換函數
    const nobleTitleChinese: Record<string, string> = {
      COMMONER: '平民', KNIGHT: '騎士', BARON: '男爵',
      VISCOUNT: '子爵', COUNT: '伯爵', MARQUIS: '侯爵', DUKE: '公爵'
    };
    const titleCN = nobleTitleChinese[territory.title] ?? territory.title;
    // UI-11: 移除重複賍値（原代碼第 59~60 行重複了兩次）
    this.uiTitle.textContent = `爵位：${titleCN}`;
    if (this.uiGold) this.uiGold.textContent = territory.gold.toString();
    if (this.uiPrestige) this.uiPrestige.textContent = territory.prestige.toString();
    if (this.uiFavor) this.uiFavor.textContent = territory.royalFavor.toString();
    if (this.uiPopulation) this.uiPopulation.textContent = territory.population.toString();
    if (this.uiFood) this.uiFood.textContent = territory.food.toString();
    if (this.uiWood) this.uiWood.textContent = territory.wood.toString();
    if (this.uiStone) this.uiStone.textContent = territory.stone.toString();
    if (this.uiIron) this.uiIron.textContent = (territory.iron || 0).toString(); // UI-02

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
      this.uiThreatDays.parentElement!.setAttribute('title', `${GameState.threat.name}，嚴重度 ${GameState.threat.severity}`);
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
    if (this.uiWorkerFarmer) this.uiWorkerFarmer.textContent = (territory.workers['FARMER'] || 0).toString();
    if (this.uiWorkerWoodcutter) this.uiWorkerWoodcutter.textContent = (territory.workers['WOODCUTTER'] || 0).toString();
    if (this.uiWorkerMiner) this.uiWorkerMiner.textContent = (territory.workers['MINER'] || 0).toString();
    
    // 同步滑桿 max 與當前數值 (防呆：最高為當前人數 + 閒置人數)
    const unassigned = territory.workers['UNASSIGNED'] || 0;
    document.querySelectorAll<HTMLInputElement>('.worker-slider').forEach(slider => {
      const job = slider.getAttribute('data-job')!;
      const current = territory.workers[job] || 0;
      slider.max = (current + unassigned).toString();
      slider.value = current.toString();
    });
    
    if (this.uiNetProduction) {
      const foodProduced = (territory.workers['FARMER'] || 0) * 3;
      const totalPeople = territory.population + GameState.adventurers.length;
      const foodConsumed = totalPeople * 1;
      const netFood = foodProduced - foodConsumed;
      this.uiNetProduction.textContent = `預期糧食淨產量：${netFood > 0 ? '+' : ''}${netFood} /天`;
      this.uiNetProduction.style.color = netFood >= 0 ? '#10b981' : '#ef4444';
    }
  
    // UI-12: 改用中文爵位顯示儀表板
    this.uiDashboardTitle.textContent = `爵位：${titleCN}`;
    this.uiDashboardGold.textContent = territory.gold.toString();
    this.uiDashboardPrestige.textContent = territory.prestige.toString();
    this.uiDashboardFavor.textContent = territory.royalFavor.toString();
    
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
        
        const condPrestige = territory.prestige >= nextRank.reqPrestige;
        const condPop = territory.population >= nextRank.reqPopulation;
        const condGold = territory.gold >= nextRank.reqGold;
        const canPromote = condPrestige && condPop && condGold;

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
                  alert(`恭喜！您已正式晉升為【${nextRank.titleCN}】！\n新特權：商隊上限 ${nextRank.maxCaravans}、英雄上限 ${nextRank.maxRoster}、建築上限 Lv.${nextRank.maxFacilityLevel}`);
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
          if (!condPop) reqs.push(`${nextRank.reqPopulation - territory.population} 人口`);
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
  
    // 更新冒險者名單
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

        const tooltipHtml = `【${adv.name}】<br/>Lv.${adv.level} ${adv.job.name}<br/>狀態：${stateText}`;

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
        
        const avatarIcon = '🦸';
        card.innerHTML = `
          <div class="adv-avatar-wrapper">${avatarIcon}</div>
          <div class="adv-card-gradient"></div>
          <div class="adv-card-info">
            <div class="adv-name">${adv.name}</div>
            <div class="adv-level" style="color: ${adv.quality === 'SSR' ? '#eab308' : adv.quality === 'SR' ? '#c084fc' : adv.quality === 'R' ? '#60a5fa' : '#cbd5e1'}; font-weight: bold;">Lv.${adv.level}</div>
          </div>
        `;
        
        card.addEventListener('click', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
          selectPartyAdventurer(adv);
          this.updateUI();
        });
        this.advContainer.appendChild(card);
        if (adv.currentState !== AdventurerState.IDLE) allIdle = false;
      });
    }
  
    const isAtHome = GameState.currentViewNode?.isPlayerBase === true;
    this.btnEnterBase.disabled = !isAtHome;
    this.btnExplore.disabled = !isAtHome;
    this.btnTribute.disabled = territory.gold < 100;
    this.btnFeast.disabled = territory.gold < 300;
    this.btnRecruit.disabled = territory.gold < 500;
    this.btnMigrate.disabled = territory.gold < 1000;
    this.btnFoundSettlement.disabled = territory.gold < 500;
  
    this.btnWildQuest.disabled = !allIdle;
    this.btnWildQuest.textContent = !allIdle ? '🚫 冒險者忙碌中' : '⚔️ 編制討伐小隊';
    
    // 更新待辦事項徽章
    const todoBadge = document.getElementById('todo-badge');
    if (todoBadge) {
      if (territory.pendingEvents && territory.pendingEvents.length > 0) {
        todoBadge.style.display = 'flex';
        todoBadge.textContent = territory.pendingEvents.length.toString();
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
      if (isNodeDetailOpen) {
        this.mapInfoPanel.style.display = 'none';
      } else {
        this.mapInfoPanel.style.display = 'flex';
      }
      this.mapStatusPanel.style.display = 'block';

      // 冒險者隊伍功能：在大陸地圖時隱藏按鈕並關閉面板
      const btnDockParty = document.getElementById('btn-dock-party');
      const modalPartyList = document.getElementById('modal-party-list');
      if (btnDockParty) btnDockParty.style.display = 'none';
      if (modalPartyList) modalPartyList.classList.remove('active');

      // 狀態
      const baseNode = GameState.mapSystem?.getNodes().find(n => n.id === territory.currentCountryId);
      this.statusLocation.textContent = baseNode ? baseNode.name : '無';
      this.statusAdvCount.textContent = GameState.adventurers.length.toString();
      const currentPlayTime = GameState.playTime + (Date.now() - GameState.sessionStartTime);
      this.statusPlaytime.textContent = SaveManager.formatPlayTime(currentPlayTime);

      // 世界資訊
      this.infoFactions.textContent = GameState.mapSystem?.getFactions().length.toString() || '0';
      this.infoNodes.textContent = GameState.mapSystem?.getNodes().length.toString() || '0';

      // 重新繪製活躍商隊商路連線
      if (typeof (window as any).renderTradeRoutes === 'function') {
        (window as any).renderTradeRoutes();
      }
    } else if (document.getElementById('scene-view')?.classList.contains('active')) {
      if (sharedRightPanel) sharedRightPanel.style.display = 'flex';
      if (sceneDashboard) sceneDashboard.style.display = 'flex';
      this.mapInfoPanel.style.display = 'none';
      this.mapStatusPanel.style.display = 'none';
      if (nodeDetailPanel) nodeDetailPanel.style.display = 'none';

      // 在據點街道視圖時顯示冒險者隊伍按鈕
      const btnDockParty = document.getElementById('btn-dock-party');
      if (btnDockParty) btnDockParty.style.display = 'flex';
    } else {
      if (sharedRightPanel) sharedRightPanel.style.display = 'none';
      if (sceneDashboard) sceneDashboard.style.display = 'none';
      this.mapInfoPanel.style.display = 'none';
      this.mapStatusPanel.style.display = 'none';
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
}

export const UIManager = new UIManagerClass();

function formatDelta(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
