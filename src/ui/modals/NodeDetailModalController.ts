import { MapNode, NodeLevel, AdventurerState } from '../../models/types';
import { ToastManager } from '../ToastManager';
import { UIManager } from '../UIManager';
import { EventBus } from '../../core/EventBus';
import { GameEventType } from '../../core/GameEvents';
import { GameState } from '../../core/GameState';
import { openDispatchSetup } from '../ModalController';
import { OffensiveSiegeModalController } from './OffensiveSiegeModalController';


export class NodeDetailModalController {
  private static instance: NodeDetailModalController;
  public static getInstance() {
    if (!this.instance) this.instance = new NodeDetailModalController();
    return this.instance;
  }

  // == Node Detail Panel ==
  
  public closeNodeDetailPanel() {
    const panel = document.getElementById('node-detail-panel');
    if (panel) {
      panel.style.display = 'none';
    }
    const mapInfoPanel = document.getElementById('map-info-panel');
    if (mapInfoPanel) {
      mapInfoPanel.style.display = 'flex'; // 預設為 flex，還原顯示
    }
  }
  
  public openNodeDetailPanel(node: MapNode) {
    const panel = document.getElementById('node-detail-panel')!;
    const mapInfoPanel = document.getElementById('map-info-panel')!;
    
    // 隱藏預設的世界地圖資訊
    mapInfoPanel.style.display = 'none';
    
    document.getElementById('nd-name')!.textContent = node.name;
    
    let typeStr = '';
    if (node.nodeLevel === NodeLevel.WILDERNESS) typeStr = '荒野';
    else if (node.nodeLevel === NodeLevel.CAMP) typeStr = '營地';
    else if (node.nodeLevel === NodeLevel.VILLAGE) typeStr = '村莊';
    else if (node.nodeLevel === NodeLevel.TOWN) typeStr = '城鎮';
    else if (node.nodeLevel === NodeLevel.CAPITAL) typeStr = '首都';
    
    document.getElementById('nd-type')!.textContent = `📍 規模：${typeStr}`;
    
    const weatherEl = document.getElementById('nd-weather')!;
    let weatherStr = '';
    let weatherColor = '#e2e8f0';
    switch(node.currentWeather) {
      case 'CLEAR': weatherStr = '☀️ 晴朗'; weatherColor = '#eab308'; break;
      case 'RAIN': weatherStr = '🌧️ 雨天'; weatherColor = '#60a5fa'; break;
      case 'SNOW': weatherStr = '❄️ 下雪'; weatherColor = '#bae6fd'; break;
      case 'SANDSTORM': weatherStr = '🌪️ 沙暴'; weatherColor = '#d97706'; break;
      case 'FOG': weatherStr = '🌫️ 濃霧'; weatherColor = '#94a3b8'; break;
      default: weatherStr = '☀️ 晴朗'; weatherColor = '#eab308'; break;
    }
    weatherEl.textContent = `${weatherStr} (剩餘 ${node.weatherDuration} 天)`;
    weatherEl.style.color = weatherColor;
  
    document.getElementById('nd-desc')!.textContent = node.description;
  
    const scoutInfoBox = document.getElementById('nd-scout-info')!;
    const unscoutedBox = document.getElementById('nd-unscouted-info')!;
    
    const btnScout = document.getElementById('btn-scout-node')!;
    const btnAction = document.getElementById('btn-nd-action')!;
    
    // 清除舊的事件監聽器
    const newBtnScout = btnScout.cloneNode(true) as HTMLButtonElement;
    btnScout.parentNode!.replaceChild(newBtnScout, btnScout);
    
    const newBtnAction = btnAction.cloneNode(true) as HTMLButtonElement;
    btnAction.parentNode!.replaceChild(newBtnAction, btnAction);
  
    if (node.isScouted) {
      scoutInfoBox.style.display = 'block';
      unscoutedBox.style.display = 'none';
      
      if (node.scoutData) {
        document.getElementById('nd-danger')!.textContent = node.scoutData.dangerLevel;
        document.getElementById('nd-treasure')!.textContent = node.scoutData.treasureTier;
        
        const garrisonBox = document.getElementById('nd-garrison-box')!;
        if (node.scoutData.garrisonEncounter && node.scoutData.garrisonEncounter.length > 0) {
          garrisonBox.style.display = 'block';
          const names = node.scoutData.garrisonEncounter.map(m => m.name).join('、');
          
          const elemMap: Record<string, string> = {
            'NONE': '無屬性', 'FIRE': '🔥火焰', 'ICE': '❄️冰霜', 'LIGHTNING': '⚡雷電', 'HOLY': '☀️聖光', 'DARK': '🌑黑暗'
          };
          const affixMap: Record<string, string> = {
            'MIASMA': '瘴氣之森 (持續中毒)',
            'VOLCANIC_HEAT': '灼熱熔岩 (持續灼燒)',
            'BLIZZARD': '極寒暴雪 (速度降低)',
            'FORTIFIED': '堅不可摧 (護甲提升)',
            'BERSERK_AURA': '狂暴光環 (攻擊提升)'
          };

          const filteredElems = (node.scoutData.mainElements || []).filter(e => e !== 'NONE');
          const elemDisplay = filteredElems.length > 0 ? filteredElems.map(e => elemMap[e] || e).join('/') : '無屬性';
          const elemInfo = ` | ⚡元素: ${elemDisplay}`;
          const affixInfo = node.scoutData.affix ? ` | ☠️詞綴: ${affixMap[node.scoutData.affix] || node.scoutData.affix}` : '';
          const roundedPower = Math.round(node.scoutData.garrisonPower || 0);
          document.getElementById('nd-garrison')!.textContent = `【${names}】(戰力:${roundedPower})${elemInfo}${affixInfo}`;
        } else if (node.scoutData.garrisonPower !== undefined) {
          garrisonBox.style.display = 'block';
          document.getElementById('nd-garrison')!.textContent = Math.round(node.scoutData.garrisonPower).toString();
        } else {
          garrisonBox.style.display = 'none';
        }
      }
      
      document.getElementById('nd-expiry')!.textContent = node.scoutExpiryDate ? `第 ${node.scoutExpiryDate} 天` : '-';
    } else {
      scoutInfoBox.style.display = 'none';
      unscoutedBox.style.display = 'block';
      
      if (node.pendingScoutDays && node.pendingScoutDays > 0) {
        newBtnScout.style.display = 'none';
        const pendingMsg = document.createElement('div');
        pendingMsg.style.color = '#fbbf24';
        pendingMsg.style.fontWeight = 'bold';
        pendingMsg.style.marginTop = '10px';
        pendingMsg.style.textAlign = 'center';
        pendingMsg.textContent = `👁️ 斥候偵查中... (預計剩餘 ${node.pendingScoutDays} 回合)`;
        
        // 移除舊的提示訊息，避免重複
        const oldMsg = unscoutedBox.querySelector('.pending-scout-msg');
        if (oldMsg) oldMsg.remove();
        
        pendingMsg.className = 'pending-scout-msg';
        unscoutedBox.appendChild(pendingMsg);
      } else {
        newBtnScout.style.display = 'inline-block';
        const oldMsg = unscoutedBox.querySelector('.pending-scout-msg');
        if (oldMsg) oldMsg.remove();
        
        newBtnScout.addEventListener('click', () => {
          if (GameState.mapSystem.scoutNode(node.id, GameState.myTerritory, GameState.totalDays)) {
            UIManager.updateUI(); // 更新金幣顯示
            this.openNodeDetailPanel(node); // 重新渲染面板
          }
        });
      }
    }
  
    // 市場按鈕
    const marketBtn = document.getElementById('nd-btn-market') as HTMLButtonElement;
    if (node.nodeLevel >= NodeLevel.VILLAGE && node.isScouted && node.marketData && node.ownerFactionId !== null && node.ownerFactionId !== 'player' && !node.isPlayerBase) {
      marketBtn.style.display = 'block';
      marketBtn.onclick = () => {
        this.openTradeModal(node);
      };
    } else {
      marketBtn.style.display = 'none';
    }
  
    // 代官 UI (僅限玩家佔領的附庸地)
    const oldRoadButton = document.getElementById('btn-build-road') as HTMLButtonElement;
    const roadButton = oldRoadButton.cloneNode(true) as HTMLButtonElement;
    oldRoadButton.parentNode!.replaceChild(roadButton, oldRoadButton);
    const playerBase = GameState.mapSystem.getNodes().find(candidate => candidate.isPlayerBase);
    const isNonPlayerTarget = !node.isPlayerBase && node.ownerFactionId !== 'player' && !node.isDynamic;
  
    if (isNonPlayerTarget && playerBase && GameState.roadSystem) {
      roadButton.style.display = 'block';
      const existingRoad = GameState.roadSystem.getRoadBetween(playerBase.id, node.id);
      const project = GameState.roadSystem.getProjectBetween(playerBase.id, node.id);
      const check = GameState.roadSystem.checkTarget(
        playerBase,
        node,
        GameState.explorationSystem
      );
  
      if (existingRoad) {
        roadButton.textContent = '✅ 道路已完成';
        roadButton.disabled = true;
        roadButton.title = '旅行路段縮短 40%、伏擊率降低，市場買價 -5%、賣價 +10%。';
      } else if (project) {
        roadButton.textContent = `🚧 道路施工中（${project.elapsedDays}/${project.totalDays} 天）`;
        roadButton.disabled = true;
      } else {
        roadButton.disabled = !check.valid;
        roadButton.textContent = check.valid
          ? `🛤️ 建造道路（${check.requiredDays} 天）`
          : '🛤️ 暫時無法建造';
        roadButton.title = check.reason ?? '';
        roadButton.onclick = () => {
          if (!check.valid || !check.requiredDays) {
            ToastManager.show(check.reason ?? '目前無法建造這條道路。', 'warning');
            return;
          }
          if (!window.confirm(
            `從 ${playerBase.name} 向 ${node.name} 建造道路？\n` +
            `預計需要 ${check.requiredDays} 天，同一時間只能施工一條道路。`
          )) return;
  
          const startedProject = GameState.roadSystem.startConstruction(
            playerBase,
            node,
            GameState.explorationSystem
          );
          EventBus.getInstance().publish({
            type: GameEventType.ROAD_CHANGED,
            payload: {
              reason: 'STARTED',
              roadId: startedProject.id,
              targetNodeId: node.id
            }
          });
          ToastManager.show(`通往 ${node.name} 的道路開始施工。`, 'success');
          this.openNodeDetailPanel(node);
        };
      }
    } else {
      roadButton.style.display = 'none';
    }
  
    const govBox = document.getElementById('nd-governor-box')!;
    if (node.ownerFactionId === 'player' && !node.isPlayerBase) {
      govBox.style.display = 'block';
      const govNameEl = document.getElementById('nd-governor-name')!;
      const govSelect = document.getElementById('nd-governor-select') as HTMLSelectElement;
      const btnAssign = document.getElementById('btn-assign-governor')!;
  
      if (node.governorId) {
        const govAdv = GameState.adventurers.find(a => a.id === node.governorId);
        govNameEl.textContent = govAdv ? govAdv.name : '未知的代官';
      } else {
        govNameEl.textContent = '無';
      }
  
      // 填充閒置傭兵
      govSelect.innerHTML = '<option value="">選擇閒置傭兵...</option>';
      const idleAdvs = GameState.adventurers.filter(a => a.currentState === AdventurerState.IDLE && !a.office && a.id !== node.governorId);
      idleAdvs.forEach(adv => {
        const intAttr = adv.getEffectiveAttributes().int;
        govSelect.innerHTML += `<option value="${adv.id}">${adv.name} (INT: ${intAttr})</option>`;
      });
  
      // 替換新的 assign 按鈕清除舊事件
      const newBtnAssign = btnAssign.cloneNode(true) as HTMLButtonElement;
      btnAssign.parentNode!.replaceChild(newBtnAssign, btnAssign);
      newBtnAssign.onclick = () => {
        const selId = govSelect.value;
        if (!selId) {
          ToastManager.show('請選擇一名傭兵！');
          return;
        }
        
        // 如果原本有代官，卸任
        if (node.governorId) {
          const oldGov = GameState.adventurers.find(a => a.id === node.governorId);
          if (oldGov) oldGov.currentState = AdventurerState.IDLE;
        }
        
        const newGov = GameState.adventurers.find(a => a.id === selId);
        if (newGov) {
          newGov.currentState = AdventurerState.DISPATCHED; // 指派出去當代官
          node.governorId = newGov.id;
          ToastManager.show(`已指派 ${newGov.name} 為 ${node.name} 的代官！`);
          this.openNodeDetailPanel(node); // 重新渲染 UI
        }
      };
    } else {
      govBox.style.display = 'none';
    }
  


    // 設定底部操作按鈕 (例如討伐/攻城)
    if (node.ownerFactionId === null) {
      newBtnAction.textContent = '🛡️ 討伐該區';
      newBtnAction.onclick = () => {
        if (!node.isScouted) {
          if (!confirm('⚠️ 【警告】您尚未偵查該區域，敵方戰力未知，貿然進軍將面臨極大風險！是否確定要盲目討伐？')) {
            return;
          }
        }
        openDispatchSetup(node, 'subjugation');
        this.closeNodeDetailPanel();
      };
    } else {
      if (node.ownerFactionId === 'player') {
        newBtnAction.textContent = '🔒 您的領地';
        newBtnAction.onclick = () => ToastManager.show('這是您自己的領地！');
      } else {
        newBtnAction.textContent = '⚔️ 發動攻城戰';
        newBtnAction.onclick = () => {
          this.closeNodeDetailPanel();
          OffensiveSiegeModalController.show(node);
        };
      }
    }
  
    // 關閉按鈕
    document.getElementById('btn-close-node-detail')!.onclick = () => {
      this.closeNodeDetailPanel();
      mapInfoPanel.style.display = 'flex';
    };
  
    panel.style.display = 'flex';
  }
  
  
  /**
   * 開啟市場交易與商隊派遣視窗
   */
  public async openTradeModal(node: MapNode) {
    const { openTradeModal: impl } = await import('../TradeController');
    impl(node);
  }
}
