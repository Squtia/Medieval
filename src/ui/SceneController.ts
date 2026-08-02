import { GameState } from '../core/GameState';
import { MapNode, NodeLevel, getNodeMaxFacilityLevel } from '../models/types';
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
        <span style="font-size:0.8em; color:#94a3b8;">${adv.currentClass} | ${adv.trait.name}</span>
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
    const btnEnterTavern = document.getElementById('btn-enter-tavern');
    const btnEnterWeaponShop = document.getElementById('btn-enter-weapon-shop');
    const btnEnterArmorShop = document.getElementById('btn-enter-armor-shop');
    const btnEnterForge = document.getElementById('btn-enter-forge');
    const btnEnterDefense = document.getElementById('btn-enter-defense');
    const btnMigrate = document.getElementById('btn-migrate')!;
    const btnEnterHall = document.getElementById('btn-enter-hall')!;
    
    btnEnterBase.style.display = isMyHome ? 'block' : 'none';
    btnMigrate.style.display = isMyHome ? 'none' : 'block';
    updateStreetBuildingsVisibility(node, isMyHome, myTerritory);
    
    
    btnEnterHall.style.display = ((isMyHome && myTerritory.title !== 'COMMONER') || (node.nodeLevel === NodeLevel.CAPITAL && node.ownerFactionId !== null)) ? 'block' : 'none';
    
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
}

/** 帶黑屏轉場動畫的 enterScene，供事件監聽器直接呼叫（非 playTransition callback 內）使用 */
export function enterSceneWithTransition(node: MapNode) {
  UIManager.playTransition(() => enterScene(node));
}

export function returnToMap() {
  UIManager.playTransition(() => {
    GameState.currentViewNode = null;
    // 強制關閉所有建築視圖，避免切換場景後殘留
    ['view-base', 'view-hall', 'view-camp', 'view-forge', 'view-weapon-shop', 'view-armor-shop', 'scene-view', 'wilderness-view'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.classList.remove('active');
        // CSS .facility-view { display:none } 確保隱藏，不需 inline style
      }
    });
    
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

export function getDynamicFacilityName(type: 'tavern' | 'weapon' | 'armor' | 'forge' | 'defense', level: number): { name: string, desc: string, icon: string } {
  if (type === 'tavern') {
    if (level === 1) return { name: '露天營火', desc: '吸引荒野流浪者歇腳，提供最基礎的招募與休息', icon: '🔥' };
    if (level === 2) return { name: '聚落帳篷', desc: '由多個帳篷組成的簡易交易與休息處', icon: '⛺' };
    if (level === 3) return { name: '簡陋酒館', desc: '開始供應劣質麥酒，能吸引傭兵前來', icon: '🍻' };
    return { name: '豪華酒館', desc: '正規的傭兵公會駐點與情報中心', icon: '🏰' };
  } else if (type === 'weapon') {
    if (level === 1) return { name: '拾荒者交易點', desc: '吸引流浪商人來交易粗糙的武器與石器', icon: '🪨' };
    if (level === 2) return { name: '流浪武商營帳', desc: '有拉車的武商駐點，能買到勉強可用的鐵器', icon: '🏕️' };
    if (level === 3) return { name: '武器鋪', desc: '正規的城鎮武器鋪，提供精良的制式武器', icon: '⚔️' };
    return { name: '皇家武器庫', desc: '提供頂尖武器的軍事設施', icon: '🗡️' };
  } else if (type === 'armor') {
    if (level === 1) return { name: '獸皮交易鋪', desc: '能跟獵人買到粗糙的破爛皮甲', icon: '🪵' };
    if (level === 2) return { name: '流浪防具商', desc: '販售修補過的皮甲與二手盾牌', icon: '🛡️' };
    if (level === 3) return { name: '防具鋪', desc: '提供堅固鎖子甲與制式防具的店舖', icon: '🛡️' };
    return { name: '皇家防具庫', desc: '提供最頂尖護甲的軍事設施', icon: '🛡️' };
  } else if (type === 'forge') {
    if (level === 1) return { name: '初級鍛造屋', desc: '最基礎的高溫火窯與鐵砧，提供裝備強化與基礎合成', icon: '⚒️' };
    if (level === 2) return { name: '進階鍛造屋', desc: '擁有精良熔爐與淬火池，支援高階裝備鍛造與元素附魔', icon: '⚒️' };
    if (level === 3) return { name: '皇家鍛造屋', desc: '擁有專業鐵砧與高溫熔爐，支援 T4 專屬神兵裝備重鑄', icon: '⚒️' };
    return { name: '頂級鍛造屋', desc: '機能齊全的頂級鍛造工坊', icon: '⚒️' };
  } else { // defense
    if (level === 1) return { name: '木柵欄', desc: '用削尖的圓木圍成，能抵禦野獸與零星流寇', icon: '🪵' };
    if (level === 2) return { name: '拒馬與壕溝', desc: '強化的營地防禦，能有效阻擋強盜集團', icon: '🚧' };
    if (level === 3) return { name: '瞭望塔', desc: '能提早發現敵人並提供弓箭手射擊視野', icon: '🗼' };
    return { name: '護城要塞', desc: '堅不可摧的石頭城牆，足以應付正規軍隊', icon: '🏰' };
  }
}

export function renderBaseBuildings() {
  const listEl = document.getElementById('base-upgrade-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  
  const territory = GameState.myTerritory;
  const node = GameState.mapSystem.getNodeById(territory.currentCountryId!);
  if (!node) return;
  const bldTypes: { key: 'tavern' | 'weapon' | 'armor' | 'forge' | 'defense' }[] = [
    { key: 'defense' },
    { key: 'tavern' },
    { key: 'weapon' },
    { key: 'armor' },
    { key: 'forge' }
  ];
  
  bldTypes.forEach(bld => {
    const lvl = territory.getBuildingLevel(bld.key);
    const nextLvl = lvl + 1;
    const isMax = lvl >= 3; // TODO: 未來實裝更高階建築
    
    // 動態獲取名稱與描述 (若尚未建造，顯示 Lv1 的預期名稱)
    const displayLvl = lvl === 0 ? 1 : lvl;
    const dynamicInfo = getDynamicFacilityName(bld.key, displayLvl);
    
    const card = document.createElement('div');
    card.className = 'glass-panel';
    card.style.padding = '10px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '6px';
    card.style.background = 'rgba(0,0,0,0.4)';
    card.style.borderRadius = '6px';
    
    let actionBtnHtml = '';
    const maxAllowed = getNodeMaxFacilityLevel(node.nodeLevel);
    
    if (isMax) {
      actionBtnHtml = `<button class="action-btn" disabled style="width: 100%; font-size: 0.85em; margin-top: 5px;">已達當前最高等級</button>`;
    } else if (nextLvl > maxAllowed) {
      actionBtnHtml = `<button class="action-btn" disabled style="width: 100%; font-size: 0.85em; margin-top: 5px; color: #f87171;">需擴張據點規模解鎖 Lv.${nextLvl}</button>`;
    } else {
      const cost = territory.getUpgradeCost(bld.key, nextLvl);
      const canUpgrade = territory.canUpgradeBuilding(bld.key, node.nodeLevel);
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
          <span style="font-size: 1em; font-weight: bold; color: #fff;">${dynamicInfo.icon} ${dynamicInfo.name}</span>
          <span style="font-size: 0.85em; color: #eab308; font-weight: bold; margin-left: 5px;">Lv.${lvl}</span>
        </div>
      </div>
      <div style="font-size: 0.8em; color: #cbd5e1; line-height: 1.3;">${dynamicInfo.desc}</div>
      ${actionBtnHtml}
    `;
    
    const btn = card.querySelector('.btn-upgrade-bld') as HTMLButtonElement | null;
    if (btn) {
      btn.addEventListener('click', () => {
        if (territory.upgradeBuilding(bld.key, node.nodeLevel)) {
          renderBaseBuildings();
          UIManager.updateUI();
        }
      });
    }
    
    listEl.appendChild(card);
  });
  
  // 同步更新街道上的建築按鈕顯示狀態
  updateStreetBuildingsVisibility(node, node.isPlayerBase, territory);
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

export function updateStreetBuildingsVisibility(node: MapNode, isMyHome: boolean, myTerritory: any) {
  const btnEnterTavern = document.getElementById('btn-enter-tavern');
  const btnEnterWeaponShop = document.getElementById('btn-enter-weapon-shop');
  const btnEnterArmorShop = document.getElementById('btn-enter-armor-shop');
  const btnEnterForge = document.getElementById('btn-enter-forge');
  const btnEnterDefense = document.getElementById('btn-enter-defense');

  if (btnEnterTavern) {
    btnEnterTavern.style.display = (isMyHome && (myTerritory.tavernLevel || 0) > 0) ? 'block' : 'none';
    const label = btnEnterTavern.querySelector('.building-label');
    if (label && myTerritory.tavernLevel > 0) {
      const info = getDynamicFacilityName('tavern', myTerritory.tavernLevel);
      label.textContent = `${info.icon} ${info.name}`;
    }
  }
  if (btnEnterWeaponShop) {
    btnEnterWeaponShop.style.display = (isMyHome && (myTerritory.weaponShopLevel || 0) > 0) ? 'block' : 'none';
    const label = btnEnterWeaponShop.querySelector('.building-label');
    if (label && myTerritory.weaponShopLevel > 0) {
      const info = getDynamicFacilityName('weapon', myTerritory.weaponShopLevel);
      label.textContent = `${info.icon} ${info.name}`;
    }
  }
  if (btnEnterArmorShop) {
    btnEnterArmorShop.style.display = (isMyHome && (myTerritory.armorShopLevel || 0) > 0) ? 'block' : 'none';
    const label = btnEnterArmorShop.querySelector('.building-label');
    if (label && myTerritory.armorShopLevel > 0) {
      const info = getDynamicFacilityName('armor', myTerritory.armorShopLevel);
      label.textContent = `${info.icon} ${info.name}`;
    }
  }
  if (btnEnterForge) {
    btnEnterForge.style.display = (isMyHome && (myTerritory.forgeLevel || 0) > 0) ? 'block' : 'none';
    const label = btnEnterForge.querySelector('.building-label');
    if (label && myTerritory.forgeLevel > 0) {
      const info = getDynamicFacilityName('forge', myTerritory.forgeLevel);
      label.textContent = `${info.icon} ${info.name}`;
    }
  }
  if (btnEnterDefense) {
    btnEnterDefense.style.display = (isMyHome && (myTerritory.defenseLevel || 0) > 0) ? 'block' : 'none';
    const label = btnEnterDefense.querySelector('.building-label');
    if (label && myTerritory.defenseLevel > 0) {
      const info = getDynamicFacilityName('defense', myTerritory.defenseLevel);
      label.textContent = `${info.icon} ${info.name}`;
    }
  }
}
