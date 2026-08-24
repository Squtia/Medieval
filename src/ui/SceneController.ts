import { GameState } from '../core/GameState';
import { MapNode, NodeLevel, getNodeMaxFacilityLevel } from '../models/types';
import { UIManager } from './UIManager';
import { renderMap } from './MapController';
import { renderFacilitySpriteHtml, renderUniversalIcon, renderUniversalPortrait } from './IconSpriteHelper';
import { NarrativeSystem } from '../systems/NarrativeSystem';
import { NpcDialogueModalController } from './modals/NpcDialogueModalController';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';

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
  
  const mapView = document.getElementById('map-view');
  const sceneView = document.getElementById('scene-view');
  const wildernessView = document.getElementById('wilderness-view');
  const uiLocation = document.getElementById('ui-location');
  
  if (mapView) {
    mapView.classList.remove('active');
    mapView.style.display = '';
  }
  if (uiLocation) uiLocation.textContent = node.name;

  // 關閉所有可能殘留的建築設施視圖
  document.querySelectorAll('.facility-view').forEach(el => {
    el.classList.remove('active');
  });

  const nodeDetailPanel = document.getElementById('node-detail-panel');
  if (nodeDetailPanel) {
    nodeDetailPanel.style.display = 'none';
  }

  if (node.nodeLevel > NodeLevel.WILDERNESS || node.isPlayerBase) {
    sceneView?.classList.add('active');
    const sceneCountryName = document.getElementById('scene-country-name');
    if (sceneCountryName) sceneCountryName.textContent = node.name;
    const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
    const sceneCountryState = document.getElementById('scene-country-state');
    if (sceneCountryState) sceneCountryState.textContent = `規模：${levelNames[node.nodeLevel]} | ${node.description}`;
    
    const streetParallaxBg = document.getElementById('street-parallax-bg');
    if (streetParallaxBg) {
      const baseUrl = import.meta.env.BASE_URL || './';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
      if (node.nodeLevel >= NodeLevel.TOWN) {
        streetParallaxBg.style.backgroundImage = `url('${cleanBase}bg_street_prosperous_1784087131344.png')`;
      } else if (node.nodeLevel >= NodeLevel.CAMP) {
        streetParallaxBg.style.backgroundImage = `url('${cleanBase}bg_street_village_1784087142427.png')`;
      } else {
        streetParallaxBg.style.backgroundImage = `url('${cleanBase}bg_street_ruins_1784087152568.png')`;
      }
    }
    
    const isMyHome = node.isPlayerBase;
    const myTerritory = GameState.myTerritory;

    const btnEnterBase = document.getElementById('btn-enter-base');
    const btnMigrate = document.getElementById('btn-migrate');
    const btnEnterHall = document.getElementById('btn-enter-hall');
    
    if (btnEnterBase) btnEnterBase.style.display = isMyHome ? 'block' : 'none';
    if (btnMigrate) btnMigrate.style.display = isMyHome ? 'none' : 'block';
    updateStreetBuildingsVisibility(node, isMyHome, myTerritory);
    
    if (btnEnterHall) {
      btnEnterHall.style.display = ((isMyHome && myTerritory.title !== 'COMMONER') || (node.nodeLevel === NodeLevel.CAPITAL && node.ownerFactionId !== null)) ? 'block' : 'none';
    }
    
    renderStreetNpcEvents();

    setTimeout(() => {
      if ((window as any).__updateStreetScrollArrows) {
        (window as any).__updateStreetScrollArrows();
      }
    }, 100);
  } else {
    wildernessView?.classList.add('active');
    const wildName = document.getElementById('wild-name');
    if (wildName) wildName.textContent = node.name;
    const wildDesc = document.getElementById('wild-desc');
    if (wildDesc) wildDesc.textContent = node.description;
    
    const btnFoundSettlement = document.getElementById('btn-found-settlement');
    if (btnFoundSettlement) {
      btnFoundSettlement.style.display = (node.ownerFactionId === null && !node.isPlayerBase) ? 'block' : 'none';
    }
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
    // 強制關閉所有建築設施視圖與場景視圖，避免切換場景後殘留
    document.querySelectorAll('.facility-view, #scene-view, #wilderness-view').forEach(el => {
      el.classList.remove('active');
    });
    
    // 返回地圖後，重新顯示 map-view
    document.getElementById('map-view')?.classList.add('active');
    const uiLoc = document.getElementById('ui-location');
    if (uiLoc) uiLoc.textContent = '世界地圖';
    
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
    const sceneView = document.getElementById('scene-view');
    const facilityView = document.getElementById('facility-view');
    
    sceneView?.classList.remove('active');
    facilityView?.classList.add('active');
    
    // 根據設施切換背景
    if (facilityView) facilityView.id = `view-${facilityId}`;
    
    UIManager.updateUI();
  });
}

export function backToScene() {
  UIManager.playTransition(() => {
    const sceneView = document.getElementById('scene-view');
    const facilityView = document.getElementById('facility-view');
    
    sceneView?.classList.add('active');
    facilityView?.classList.remove('active');
    
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
    if (level === 1) return { name: '簡易打磨台', desc: '工匠搭建的露天工作台，提供基礎裝備數值打磨與改造', icon: '🔧' };
    if (level === 2) return { name: '工匠改造坊', desc: '引進精良工具與附魔台，支援進階屬性追加與配重調整', icon: '🔧' };
    if (level === 3) return { name: '皇家改造所', desc: '具備頂尖車床與銘刻工藝的皇家級裝備改造中心', icon: '🔧' };
    return { name: '頂級改造所', desc: '機能齊全的頂級裝備改造工坊', icon: '🔧' };
  } else if (type === 'armor') {
    if (level === 1) return { name: '雜貨回收攤', desc: '流浪行商開設的二手物資收購攤，提供基礎飾品出售與舊裝備典當', icon: '⚖️' };
    if (level === 2) return { name: '典當行商營帳', desc: '流通各類二手軍備物資與稀有護符飾品', icon: '⚖️' };
    if (level === 3) return { name: '皇家珍寶典當閣', desc: '高價回收各階神兵，定期陳列古代修道院與黑市流出的稀有飾品', icon: '⚖️' };
    return { name: '頂級典當商行', desc: '信譽卓著的頂級二手軍備商行', icon: '⚖️' };
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
    
    const facilityIconHtml = renderFacilitySpriteHtml(bld.key, 44);

    card.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 2px;">
        ${facilityIconHtml}
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 1em; font-weight: bold; color: #fff;">${dynamicInfo.name}</span>
            <span style="font-size: 0.85em; color: #eab308; font-weight: bold;">Lv.${lvl}</span>
          </div>
          <div style="font-size: 0.78em; color: #cbd5e1; line-height: 1.3; margin-top: 2px;">${dynamicInfo.desc}</div>
        </div>
      </div>
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

/**
 * 🏰 渲染街道訪客 NPC 事件按鈕列 (紅框區域：無事件時 100% 透明無痕，支援拖曳左右滑動)
 */
export function renderStreetNpcEvents() {
  const container = document.getElementById('street-npc-events-bar');
  const tooltip = document.getElementById('street-npc-floating-tooltip');
  const ttName = document.getElementById('street-npc-tt-name');
  const ttDesc = document.getElementById('street-npc-tt-desc');
  if (!container) return;

  container.innerHTML = '';
  const events = NarrativeSystem.getEligibleStreetEvents();

  if (events.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  // 綁定拖曳滑動支援 (Drag to scroll)
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  let isDragging = false;

  container.onmousedown = (e) => {
    isDown = true;
    isDragging = false;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
  };

  container.onmouseleave = () => {
    isDown = false;
    if (tooltip) tooltip.style.display = 'none';
  };

  container.onmouseup = () => {
    isDown = false;
  };

  container.onmousemove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - startX) * 1.5;
    if (Math.abs(walk) > 3) isDragging = true;
    container.scrollLeft = scrollLeft - walk;
  };

  // 支援滑輪橫向捲動
  container.onwheel = (e) => {
    if (e.deltaY !== 0) {
      container.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  };

  events.forEach(ref => {
    const btn = document.createElement('div');
    btn.className = 'street-npc-btn';
    btn.style.cssText = `
      width: 88px;
      height: 164px;
      min-width: 88px;
      border-radius: 6px;
      border: 2px solid #d97706;
      box-shadow: 0 6px 18px rgba(0,0,0,0.85), 0 0 10px rgba(217,119,6,0.4);
      cursor: pointer;
      overflow: hidden;
      flex-shrink: 0;
      background-color: #0c0a09;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      position: relative;
    `;

    const avatar = ref.node.npcAvatar || 'npc:npc_0';
    btn.innerHTML = renderUniversalPortrait(avatar, 88);

    // 滑鼠懸停與跟隨 Tooltip
    btn.onmouseenter = (e) => {
      if (tooltip && ttName && ttDesc) {
        ttName.textContent = ref.node.npcName || ref.node.title || '神秘訪客';
        ttDesc.textContent = ref.node.title || ref.node.description || '點擊展開對話';
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY}px`;
      }
      btn.style.transform = 'translateY(-2px) scale(1.05)';
      btn.style.borderColor = '#fbbf24';
    };

    btn.onmousemove = (e) => {
      if (tooltip) {
        tooltip.style.left = `${e.clientX}px`;
        tooltip.style.top = `${e.clientY}px`;
      }
    };

    btn.onmouseleave = () => {
      if (tooltip) tooltip.style.display = 'none';
      btn.style.transform = 'translateY(0) scale(1)';
      btn.style.borderColor = '#d97706';
    };

    btn.onclick = () => {
      if (isDragging) return;
      if (tooltip) tooltip.style.display = 'none';
      NpcDialogueModalController.getInstance().open(ref);
    };

    container.appendChild(btn);
  });
}

// 監聽任務/劇情狀態變更，即時刷新街道訪客按鈕 (設定為 'ui' scope，防止被 clearAll('system') 意外清除)
EventBus.getInstance().subscribe(GameEventType.MISSIONS_CHANGED, () => {
  renderStreetNpcEvents();
}, 'ui');
