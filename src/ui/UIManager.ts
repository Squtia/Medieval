import { GameState } from '../core/GameState';
import { AdventurerState, NobleTitle } from '../models/types';
import { openAdvDetail } from './ModalController';
import { renderCampTraining } from './SceneController';
import { isStartupMode } from './MapController';
import { SaveManager } from '../core/SaveManager';

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

  // 勞動力分配UI
  uiUnassignedWorkers = document.getElementById('ui-unassigned-workers');
  uiWorkerFarmer = document.getElementById('ui-worker-FARMER');
  uiWorkerWoodcutter = document.getElementById('ui-worker-WOODCUTTER');
  uiWorkerMiner = document.getElementById('ui-worker-MINER');
  uiNetProduction = document.getElementById('ui-net-production');
  uiDate = document.getElementById('ui-date');

  // 儀表板與環境控制
  uiDashboardTitle = document.getElementById('ui-dashboard-title')!;
  uiDashboardGold = document.getElementById('ui-dashboard-gold')!;
  uiDashboardPrestige = document.getElementById('ui-dashboard-prestige')!;
  uiDashboardFavor = document.getElementById('ui-dashboard-favor')!;
  uiTitleProgress = document.getElementById('ui-title-progress')!;
  uiTitleText = document.getElementById('ui-title-text')!;
  
  advContainer = document.getElementById('adventurer-container')!;

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
    this.uiTitle.textContent = `爵位：${territory.title}`;
    this.uiTitle.textContent = `爵位：${territory.title}`;
    if (this.uiGold) this.uiGold.textContent = territory.gold.toString();
    if (this.uiPrestige) this.uiPrestige.textContent = territory.prestige.toString();
    if (this.uiFavor) this.uiFavor.textContent = territory.royalFavor.toString();
    if (this.uiPopulation) this.uiPopulation.textContent = territory.population.toString();
    if (this.uiFood) this.uiFood.textContent = territory.food.toString();
    if (this.uiWood) this.uiWood.textContent = territory.wood.toString();
    if (this.uiStone) this.uiStone.textContent = territory.stone.toString();

    // 更新日期與雙倍經驗池 (Rested EXP)
    if (this.uiDate) {
      let dateText = `第 ${GameState.currentYear} 年 ${GameState.currentMonth} 月 ${GameState.currentDay} 日`;
      if (GameState.restedExpPool > 0) {
        dateText += ` (💤${GameState.restedExpPool})`;
      }
      this.uiDate.textContent = dateText;
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
  
    // 儀表板資源更新
    this.uiDashboardTitle.textContent = `爵位：${territory.title}`;
    this.uiDashboardGold.textContent = territory.gold.toString();
    this.uiDashboardPrestige.textContent = territory.prestige.toString();
    this.uiDashboardFavor.textContent = territory.royalFavor.toString();
    
    // 爵位進度條計算
    const titles = [
      { title: NobleTitle.COMMONER, req: 0 },
      { title: NobleTitle.KNIGHT, req: 100 },
      { title: NobleTitle.BARON, req: 500 },
      { title: NobleTitle.VISCOUNT, req: 2000 },
      { title: NobleTitle.COUNT, req: 5000 },
      { title: NobleTitle.MARQUIS, req: 15000 },
      { title: NobleTitle.DUKE, req: 50000 }
    ];
    try {
      const currIdx = titles.findIndex(t => t.title === territory.title);
      if (currIdx >= 0 && currIdx < titles.length - 1) {
        const nextRank = titles[currIdx + 1];
        const prevReq = titles[currIdx].req;
        const progress = Math.min(100, Math.max(0, ((territory.prestige - prevReq) / (nextRank.req - prevReq)) * 100));
        if (this.uiTitleProgress) this.uiTitleProgress.style.width = `${progress}%`;
        if (this.uiTitleText) this.uiTitleText.textContent = `距離下一階 (${nextRank.title}) 還需 ${nextRank.req - territory.prestige} 聲望`;
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
      this.advContainer.innerHTML = '';
      GameState.adventurers.forEach(adv => {
        const card = document.createElement('div');
        card.className = 'adventurer-card';
        if (adv.trait.name === '誓約守衛') {
          card.classList.add('guardian');
        }
        
        const stateText = adv.currentState === AdventurerState.IDLE ? '🟢 閒置' : `🔴 派遣中 (${Math.ceil(((adv.dispatchEndTime || 0) - Date.now())/1000)}s)`;
        
        // Tooltip內容
        const tooltip = `【${adv.name}】\nLv.${adv.level} ${adv.job.name} | ${adv.trait.name}\n戰力：${adv.power}\n狀態：${stateText}`;
        card.setAttribute('data-tooltip', tooltip);
        
        // 卡片內部顯示
        // We use the job's icon if available, otherwise default to 🦸
        const avatarIcon = '🦸'; // We can change this later if Job has icon
        
        card.innerHTML = `
          <div class="adv-avatar">${avatarIcon}</div>
          <div class="adv-name">${adv.name}</div>
          <div class="adv-level">Lv.${adv.level}</div>
        `;
        
        card.addEventListener('click', () => openAdvDetail(adv));
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
    this.btnWildQuest.textContent = !allIdle ? '🚫 冒險者忙碌中' : '⚔️ 派遣小隊討伐 (0秒)';
    
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

    // 更新訓練所清單
    renderCampTraining();

    // 更新地圖面板與共用右側欄位
    const sharedRightPanel = document.getElementById('shared-right-panel');
    const sceneDashboard = document.getElementById('scene-dashboard-content');
    
    if (document.getElementById('map-view')?.classList.contains('active') && !isStartupMode) {
      if (sharedRightPanel) sharedRightPanel.style.display = 'flex';
      if (sceneDashboard) sceneDashboard.style.display = 'none';
      this.mapInfoPanel.style.display = 'flex';
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
    } else if (document.getElementById('scene-view')?.classList.contains('active')) {
      if (sharedRightPanel) sharedRightPanel.style.display = 'flex';
      if (sceneDashboard) sceneDashboard.style.display = 'flex';
      this.mapInfoPanel.style.display = 'none';
      this.mapStatusPanel.style.display = 'none';
    } else {
      if (sharedRightPanel) sharedRightPanel.style.display = 'none';
      if (sceneDashboard) sceneDashboard.style.display = 'none';
      this.mapInfoPanel.style.display = 'none';
      this.mapStatusPanel.style.display = 'none';
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
