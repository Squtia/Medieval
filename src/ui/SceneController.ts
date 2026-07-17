import { GameState } from '../core/GameState';
import { MapNode, NodeLevel } from '../models/types';
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

    const cost = adv.level * 50;
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
  GameState.currentViewNode = node;
  
  const mapView = document.getElementById('map-view')!;
  const sceneView = document.getElementById('scene-view')!;
  const wildernessView = document.getElementById('wilderness-view')!;
  const uiLocation = document.getElementById('ui-location')!;
  
  mapView.classList.remove('active');
  uiLocation.textContent = node.name;

  if (node.nodeLevel > NodeLevel.WILDERNESS || node.isPlayerBase) {
    sceneView.classList.add('active');
    document.getElementById('scene-country-name')!.textContent = node.name;
    const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
    document.getElementById('scene-country-state')!.textContent = `規模：${levelNames[node.nodeLevel]} | ${node.description}`;
    
    const streetParallaxBg = document.getElementById('street-parallax-bg')!;
    if (node.nodeLevel >= NodeLevel.TOWN) {
      streetParallaxBg.style.backgroundImage = `url('${import.meta.env.BASE_URL}bg_street_prosperous_1784087131344.png')`;
    } else if (node.nodeLevel >= NodeLevel.CAMP) {
      streetParallaxBg.style.backgroundImage = `url('${import.meta.env.BASE_URL}bg_street_village_1784087142427.png')`;
    } else {
      streetParallaxBg.style.backgroundImage = `url('${import.meta.env.BASE_URL}bg_street_ruins_1784087152568.png')`;
    }
    
    const isMyHome = node.isPlayerBase;
    const btnEnterBase = document.getElementById('btn-enter-base')!;
    const btnEnterCamp = document.getElementById('btn-enter-camp')!;
    const btnEnterForge = document.getElementById('btn-enter-forge')!;
    const btnMigrate = document.getElementById('btn-migrate')!;
    const btnEnterHall = document.getElementById('btn-enter-hall')!;
    
    btnEnterBase.style.display = isMyHome ? 'block' : 'none';
    btnEnterCamp.style.display = isMyHome ? 'block' : 'none';
    btnEnterForge.style.display = isMyHome ? 'block' : 'none';
    btnMigrate.style.display = isMyHome ? 'none' : 'block';
    
    btnEnterHall.style.display = (node.nodeLevel === NodeLevel.CAPITAL && node.ownerFactionId !== null) ? 'block' : 'none';
    
    const visibleBuildings = [];
    if (btnEnterHall.style.display !== 'none') visibleBuildings.push(btnEnterHall);
    if (btnEnterBase.style.display !== 'none') visibleBuildings.push(btnEnterBase);
    if (btnEnterCamp.style.display !== 'none') visibleBuildings.push(btnEnterCamp);
    if (btnEnterForge.style.display !== 'none') visibleBuildings.push(btnEnterForge);

    visibleBuildings.forEach((bld, idx) => {
      bld.style.left = `${200 + idx * 400}px`;
      bld.style.bottom = `${50 + (idx % 2) * 20}px`;
    });
    
    document.getElementById('street-scroll-area')!.scrollLeft = 0;
  } else {
    wildernessView.classList.add('active');
    document.getElementById('wild-name')!.textContent = node.name;
    document.getElementById('wild-desc')!.textContent = node.description;
    
    const btnFoundSettlement = document.getElementById('btn-found-settlement')!;
    btnFoundSettlement.style.display = (node.ownerFactionId === null && !node.isPlayerBase) ? 'block' : 'none';
  }
  
  UIManager.updateUI();
}

export function returnToMap() {
  GameState.currentViewNode = null;
  // 強制關閉所有建築視圖，避免切換場景後殘留
  document.getElementById('view-base')!.classList.remove('active');
  document.getElementById('view-hall')!.classList.remove('active');
  document.getElementById('view-camp')!.classList.remove('active');
  document.getElementById('view-forge')!.classList.remove('active');
  document.getElementById('scene-view')!.classList.remove('active');
  document.getElementById('wilderness-view')!.classList.remove('active');
  document.getElementById('map-view')!.classList.add('active');
  document.getElementById('ui-location')!.textContent = '世界地圖';
  renderMap();
  UIManager.updateUI();
}
