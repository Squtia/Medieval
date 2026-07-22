import { GameState } from '../core/GameState';
import { MapNode, NodeLevel, getMaxFacilityLevel } from '../models/types';
import { UIManager } from './UIManager';
import { renderMap } from './MapController';

export function renderCampTraining() {
  const campTrainList = document.getElementById('camp-train-list')!;
  campTrainList.innerHTML = '';
  const myTerritory = GameState.myTerritory;

  GameState.adventurers.forEach(adv => {
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '15px';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';

    const cost = adv.level * 100 + 100; // BAL-04: Lv.1=200金、Lv.5=600金，避免战鬥就能马上升满等
    card.innerHTML = `
      <div>
        <strong>${adv.name}</strong> (Lv.${adv.level})<br/>
        <span style="font-size:0.8em; color:#94a3b8;">${adv.job.name} | ${adv.trait.name}</span>
      </div>
      <button class="action-btn btn-train-adv" style="font-size: 0.9em; padding: 8px 15px;" data-id="${adv.id}" ${myTerritory.gold < cost ? 'disabled' : ''}>
        💪 特訓 (${cost} 金幣)
      </button>
    `;
    
    const btnTrain = card.querySelector('.btn-train-adv') as HTMLButtonElement;
    btnTrain.addEventListener('click', () => {
      if (myTerritory.gold >= cost) {
        myTerritory.gold -= cost;
        const xpNeeded = adv.getRequiredXP();
        adv.gainXP(xpNeeded);
        console.log(`[系統] 💪 訓練所花費了 ${cost} 金幣對 ${adv.name} 進行全面特訓！`);
        UIManager.updateUI();
      }
    });

    campTrainList.appendChild(card);
  });
}

export function enterScene(node: MapNode) {
  UIManager.playTransition(() => {
    GameState.currentViewNode = node;
    
    const mapView = document.getElementById('map-view')!;
    const sceneView = document.getElementById('scene-view')!;
    const wildernessView = document.getElementById('wilderness-view')!;
    const uiLocation = document.getElementById('ui-location')!;
    
    mapView.classList.remove('active');
    uiLocation.textContent = node.name;

    const nodeDetailPanel = document.getElementById('node-detail-panel');
    if (nodeDetailPanel) {
      nodeDetailPanel.style.display = 'none';
    }

    if (node.nodeLevel > NodeLevel.WILDERNESS || node.isPlayerBase) {
      sceneView.classList.add('active');
      document.getElementById('scene-country-name')!.textContent = node.name;
      const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
      document.getElementById('scene-country-state')!.textContent = `規模：${levelNames[node.nodeLevel]} | ${node.description}`;
      
      const streetParallaxBg = document.getElementById('street-parallax-bg')!;
      if (node.nodeLevel >= NodeLevel.TOWN) {
        streetParallaxBg.style.backgroundImage = `url('./bg_street_prosperous_1784087131344.png')`;
      } else if (node.nodeLevel >= NodeLevel.CAMP) {
        streetParallaxBg.style.backgroundImage = `url('./bg_street_village_1784087142427.png')`;
      } else {
        streetParallaxBg.style.backgroundImage = `url('./bg_street_ruins_1784087152568.png')`;
      }
      
      const isMyHome = node.isPlayerBase;
      const myTerritory = GameState.myTerritory;

      const btnEnterBase = document.getElementById('btn-enter-base')!;
      const btnEnterTavern = document.getElementById('btn-enter-tavern')!;
      const btnEnterWeaponShop = document.getElementById('btn-enter-weapon-shop')!;
      const btnEnterArmorShop = document.getElementById('btn-enter-armor-shop')!;
      const btnEnterForge = document.getElementById('btn-enter-forge')!;
      const btnMigrate = document.getElementById('btn-migrate')!;
      const btnEnterHall = document.getElementById('btn-enter-hall')!;
      
      btnEnterBase.style.display = isMyHome ? 'block' : 'none';
      btnEnterTavern.style.display = (isMyHome && (myTerritory.tavernLevel || 0) > 0) ? 'block' : 'none';
      btnEnterWeaponShop.style.display = (isMyHome && (myTerritory.weaponShopLevel || 0) > 0) ? 'block' : 'none';
      btnEnterArmorShop.style.display = (isMyHome && (myTerritory.armorShopLevel || 0) > 0) ? 'block' : 'none';
      btnEnterForge.style.display = (isMyHome && (myTerritory.forgeLevel || 0) > 0) ? 'block' : 'none';
      btnMigrate.style.display = isMyHome ? 'none' : 'block';
      
      btnEnterHall.style.display = (node.nodeLevel === NodeLevel.CAPITAL && node.ownerFactionId !== null) ? 'block' : 'none';
      
      setTimeout(() => {
        if ((window as any).__updateStreetScrollArrows) {
          (window as any).__updateStreetScrollArrows();
        }
      }, 100);
    } else {
      wildernessView.classList.add('active');
      document.getElementById('wild-name')!.textContent = node.name;
      document.getElementById('wild-desc')!.textContent = node.description;
      
      const btnFoundSettlement = document.getElementById('btn-found-settlement')!;
      btnFoundSettlement.style.display = (node.ownerFactionId === null && !node.isPlayerBase) ? 'block' : 'none';
    }
    
    UIManager.updateUI();
  });
}

export function returnToMap() {
  UIManager.playTransition(() => {
    GameState.currentViewNode = null;
    // 強制關閉所有建築視圖，避免切換場景後殘留
    document.getElementById('view-base')!.classList.remove('active');
    document.getElementById('view-hall')!.classList.remove('active');
    document.getElementById('view-camp')!.classList.remove('active');
    document.getElementById('view-forge')!.classList.remove('active');
    document.getElementById('view-weapon-shop')!.classList.remove('active');
    document.getElementById('view-armor-shop')!.classList.remove('active');
    document.getElementById('scene-view')!.classList.remove('active');
    document.getElementById('wilderness-view')!.classList.remove('active');
    
    // 返回地圖後，重新顯示 map-view
    document.getElementById('map-view')!.classList.add('active');
    document.getElementById('ui-location')!.textContent = '世界地圖';
    
    const nodeDetailPanel = document.getElementById('node-detail-panel');
    if (nodeDetailPanel) {
      nodeDetailPanel.style.display = 'none';
    }
    
    renderMap();
    UIManager.updateUI();
  });
}

export function switchFacilityView(facilityId: string) {
  UIManager.playTransition(() => {
    const sceneView = document.getElementById('scene-view')!;
    const facilityView = document.getElementById('facility-view')!;
    
    sceneView.classList.remove('active');
    facilityView.classList.add('active');
    
    // 根據設施切換背景
    facilityView.id = `view-${facilityId}`;
    
    UIManager.updateUI();
  });
}

export function backToScene() {
  UIManager.playTransition(() => {
    const sceneView = document.getElementById('scene-view')!;
    const facilityView = document.getElementById('facility-view')!;
    
    sceneView.classList.add('active');
    facilityView.classList.remove('active');
    
    UIManager.updateUI();
  });
}

export function renderBaseBuildings() {
  const listEl = document.getElementById('base-upgrade-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  
  const territory = GameState.myTerritory;
  const bldTypes: { key: 'tavern' | 'weapon' | 'armor' | 'forge', name: string, desc: string, icon: string }[] = [
    { key: 'tavern', name: '冒險者酒館', desc: '解鎖招募並提高招募高品質英雄機率', icon: '🍻' },
    { key: 'weapon', name: '皇家武器店', desc: '解鎖並購買 1~3 階強力武器', icon: '⚔️' },
    { key: 'armor', name: '皇家防具店', desc: '解鎖並購買 1~3 階精美防具', icon: '🛡️' },
    { key: 'forge', name: '工坊鍛造屋', desc: '解鎖並提供強化武具火爐', icon: '⚒️' }
  ];
  
  bldTypes.forEach(bld => {
    const lvl = territory.getBuildingLevel(bld.key);
    const nextLvl = lvl + 1;
    const isMax = lvl >= 3;
    
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '10px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '6px';
    card.style.background = 'rgba(0,0,0,0.4)';
    card.style.borderRadius = '6px';
    
    let actionBtnHtml = '';
    const maxAllowed = getMaxFacilityLevel(territory.title);
    if (isMax) {
      actionBtnHtml = `<button class="action-btn" disabled style="width: 100%; font-size: 0.85em; margin-top: 5px;">已達最高等級 (3等)</button>`;
    } else if (nextLvl > maxAllowed) {
      actionBtnHtml = `<button class="action-btn" disabled style="width: 100%; font-size: 0.85em; margin-top: 5px; color: #f87171;">需晉升爵位解鎖 Lv.${nextLvl}</button>`;
    } else {
      const cost = territory.getUpgradeCost(bld.key, nextLvl);
      const canUpgrade = territory.canUpgradeBuilding(bld.key);
      const btnText = lvl === 0 ? `🔨 建造 (${cost.gold}金)` : `🔺 升級 (${cost.gold}金)`;
      
      const costStr = `
        <div style="font-size: 0.82em; color: #cbd5e1; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; margin-top: 4px; font-weight: bold; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 4px;">
          <span>🌲 木材: ${cost.wood}</span>
          <span>🧱 石材: ${cost.stone}</span>
          ${cost.iron > 0 ? `<span>🔗 鐵礦: ${cost.iron}</span>` : ''}
        </div>
      `;
      
      actionBtnHtml = `
        ${costStr}
        <button class="action-btn btn-upgrade-bld" data-bld="${bld.key}" ${canUpgrade ? '' : 'disabled'} style="width: 100%; font-size: 0.85em; padding: 5px 0; margin-top: 4px; background: ${canUpgrade ? 'linear-gradient(135deg, #059669, #047857)' : 'rgba(255,255,255,0.05)'};">
          ${btnText}
        </button>
      `;
    }
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
        <div>
          <span style="font-size: 1em; font-weight: bold; color: #fff;">${bld.icon} ${bld.name}</span>
          <span style="font-size: 0.85em; color: #eab308; font-weight: bold; margin-left: 5px;">Lv.${lvl}</span>
        </div>
      </div>
      <div style="font-size: 0.8em; color: #cbd5e1; line-height: 1.3;">${bld.desc}</div>
      ${actionBtnHtml}
    `;
    
    const btn = card.querySelector('.btn-upgrade-bld') as HTMLButtonElement | null;
    if (btn) {
      btn.addEventListener('click', () => {
        if (territory.upgradeBuilding(bld.key)) {
          renderBaseBuildings();
          UIManager.updateUI();
        }
      });
    }
    
    listEl.appendChild(card);
  });
}

/**
 * 初始化街道滾動區域 (支援手動拖曳與左右箭頭輔助)
 */
export function initStreetScroller(): void {
  const scrollArea = document.getElementById('street-scroll-area');
  const arrowLeft = document.getElementById('street-arrow-left');
  const arrowRight = document.getElementById('street-arrow-right');

  if (!scrollArea || !arrowLeft || !arrowRight) return;

  const updateArrows = () => {
    const maxScroll = scrollArea.scrollWidth - scrollArea.clientWidth;
    if (maxScroll <= 10) {
      arrowLeft.style.display = 'none';
      arrowRight.style.display = 'none';
      return;
    }
    arrowLeft.style.display = scrollArea.scrollLeft > 10 ? 'flex' : 'none';
    arrowRight.style.display = scrollArea.scrollLeft < maxScroll - 10 ? 'flex' : 'none';
  };

  let isDragging = false;
  let startX = 0;
  let scrollLeftStart = 0;
  let hasMoved = false;

  scrollArea.addEventListener('mousedown', (e) => {
    isDragging = true;
    hasMoved = false;
    startX = e.pageX - scrollArea.offsetLeft;
    scrollLeftStart = scrollArea.scrollLeft;
    scrollArea.style.cursor = 'grabbing';
  });

  scrollArea.addEventListener('mouseleave', () => {
    isDragging = false;
    scrollArea.style.cursor = 'grab';
  });

  scrollArea.addEventListener('mouseup', () => {
    isDragging = false;
    scrollArea.style.cursor = 'grab';
  });

  scrollArea.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = e.pageX - scrollArea.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 5) {
      hasMoved = true;
    }
    scrollArea.scrollLeft = scrollLeftStart - walk;
    updateArrows();
  });

  // 防止拖曳釋放時誤觸建築點擊事件
  scrollArea.addEventListener('click', (e) => {
    if (hasMoved) {
      e.stopPropagation();
      e.preventDefault();
    }
  }, true);

  scrollArea.addEventListener('scroll', updateArrows);

  arrowLeft.addEventListener('click', () => {
    scrollArea.scrollBy({ left: -250, behavior: 'smooth' });
  });

  arrowRight.addEventListener('click', () => {
    scrollArea.scrollBy({ left: 250, behavior: 'smooth' });
  });

  window.addEventListener('resize', updateArrows);
  (window as any).__updateStreetScrollArrows = updateArrows;

  setTimeout(updateArrows, 100);
}
