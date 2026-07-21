import { GameState } from '../core/GameState';
import { AdventurerState, NobleTitle } from '../models/types';
import { openAdvDetail } from './ModalController';
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
    
    // 爵位進度條計算
    const titles = [
      { title: 'COMMONER', titleCN: '平民', req: 0 },
      { title: 'KNIGHT', titleCN: '騎士', req: 100 },
      { title: 'BARON', titleCN: '男爵', req: 500 },
      { title: 'VISCOUNT', titleCN: '子爵', req: 2000 },
      { title: 'COUNT', titleCN: '伯爵', req: 5000 },
      { title: 'MARQUIS', titleCN: '侯爵', req: 15000 },
      { title: 'DUKE', titleCN: '公爵', req: 50000 }
    ];
    try {
      const currIdx = titles.findIndex(t => t.title === territory.title);
      if (currIdx >= 0 && currIdx < titles.length - 1) {
        const nextRank = titles[currIdx + 1];
        const prevReq = titles[currIdx].req;
        const progress = Math.min(100, Math.max(0, ((territory.prestige - prevReq) / (nextRank.req - prevReq)) * 100));
        if (this.uiTitleProgress) this.uiTitleProgress.style.width = `${progress}%`;
        if (this.uiTitleText) this.uiTitleText.textContent = `距離下一階 (${nextRank.titleCN}) 還需 ${nextRank.req - territory.prestige} 聲望`;

        // DEP-03: 爵位晰升通知（聲望初次超過覇間値）
        const justPromoted = territory.prestige >= nextRank.req && territory.prestige - 5 < nextRank.req;
        if (justPromoted) {
          const newTitle = titleCN;
          setTimeout(() => {
            const banner = document.getElementById('promotion-banner');
            if (banner) {
              banner.innerHTML = `🎉 恭喜晴升為「${newTitle}」！新商隊上限已提升。`;
              banner.style.display = 'block';
              setTimeout(() => { banner.style.display = 'none'; }, 4000);
            }
          }, 100);
        }
      } else {
        if (this.uiTitleProgress) this.uiTitleProgress.style.width = `100%`;
        if (this.uiTitleText) this.uiTitleText.textContent = `已達最高爵位`;
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
      GameState.adventurers.forEach(adv => {
        const card = document.createElement('div');
        card.className = 'adventurer-card';
        if (adv.trait.name === '誓約守衛') {
          card.classList.add('guardian');
        }
        
        // UI-01: 修正狀態顯示（移除錯誤的秒數計算，加入 RESTING 狀態）
        let stateText = '🟢 閒置';
        if (adv.currentState === AdventurerState.RESTING) {
          stateText = `🛌 休養中 (${adv.restingDaysLeft}天後)`;
        } else if (adv.currentState !== AdventurerState.IDLE) {
          stateText = `🔴 任務中`;
        }
        // 查詢外派任務資訊
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

        const qMap: Record<string, string> = { 'SSR': 'SSR 傳奇', 'SR': 'SR 史詩', 'R': 'R 精英', 'N': 'N 普通' };
        const qLabel = qMap[adv.quality || 'N'] || 'N 普通';

        const tooltipText = `【${adv.name}】 (${qLabel})
Lv.${adv.level} ${adv.job.name} | ${adv.trait.name}
戰力：${adv.power}
狀態：${stateText}${dispatchInfo}

【六維屬性】
力量: ${attr.str} | 敏捷: ${attr.agi} | 體質: ${attr.con}
智慧: ${attr.int} | 精神: ${attr.spr} | 幸運: ${attr.luk}

【目前裝備】${equipText}`;

        // 監聽 Hover 事件
        card.addEventListener('mouseenter', () => {
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) {
            tEl.textContent = tooltipText;
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
        
        // 卡片內部顯示
        const avatarIcon = '🦸';
        card.innerHTML = `
          <div class="adv-avatar">${avatarIcon}</div>
          <div class="adv-name">${adv.name}</div>
          <div class="adv-level" style="color: ${adv.quality === 'SSR' ? '#eab308' : adv.quality === 'SR' ? '#a855f7' : adv.quality === 'R' ? '#3b82f6' : '#cbd5e1'}; font-weight: bold;">Lv.${adv.level}</div>
        `;
        
        card.addEventListener('click', () => {
          // 點擊卡片時，隱藏浮動 Tooltip 避免殘留
          const tEl = document.getElementById('adv-tooltip');
          if (tEl) tEl.style.opacity = '0';
          openAdvDetail(adv);
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
