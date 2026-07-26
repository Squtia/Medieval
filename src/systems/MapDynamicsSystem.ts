import { Faction, MapNode, NodeLevel, NodeFeature, WeatherType, TerrainType, FactionPersonality, SiegeData } from '../models/types';
import { GameEventType } from '../core/GameEvents';
import { Territory } from '../models/Territory';
import { Random } from '../core/Random';
import { GameState } from '../core/GameState';

export class MapDynamicsSystem {
  private mapNodes: MapNode[];
  private factions: Faction[];

  // 升級所需的繁榮度門檻 (依據 NodeLevel)
  private readonly PROSPERITY_THRESHOLDS: Record<number, number> = {
    [NodeLevel.WILDERNESS]: 0,
    [NodeLevel.CAMP]: 40,       // B2: 降低初始門檻，讓自然成長約 4 個月可達成
    [NodeLevel.VILLAGE]: 200,
    [NodeLevel.TOWN]: 300,
    [NodeLevel.CAPITAL]: 500
  };

  // 派系擴張所需的資源閾值
  private readonly FACTION_EXPANSION_THRESHOLD = 500;
  // 每次成功擴張扣除的資源
  private readonly FACTION_EXPANSION_COST = 400;

  constructor(mapNodes: MapNode[], factions: Faction[]) {
    this.mapNodes = mapNodes;
    this.factions = factions;
  }

  /**
   * 模擬地圖動態 (繁榮度變化、節點升降級、派系擴張)
   * 預期由 Game Loop 呼叫，例如每秒/每分鐘呼叫一次
   * @param deltaTime 經過的毫秒數 (保留參數供未來時間步長計算使用)
   */
  
  public simulateDailyMapDynamics(currentDay: number): void {
    for (const node of this.mapNodes) {
      if (node.pendingScoutDays && node.pendingScoutDays > 0) {
        node.pendingScoutDays -= 1;
        if (node.pendingScoutDays <= 0) {
          this.resolveScout(node, currentDay);
          import('../ui/ToastManager').then(({ ToastManager }) => {
            ToastManager.show(`斥候傳回了「${node.name}」的情報！`);
          });
        }
      }

      if (node.siegeData) {
        node.siegeData.remainingDays -= 1;
        if (node.siegeData.remainingDays <= 0) {
          this.resolveSiege(node);
        } else {
           import('../core/EventBus').then(({ EventBus }) => {
             EventBus.getInstance().publish({ 
               type: GameEventType.SIEGE_UPDATED, 
               payload: { targetNodeId: node.id, remainingDays: node.siegeData!.remainingDays }
             });
           });
        }
      }
    }
  }

  private resolveSiege(node: MapNode): void {
    if (!node.siegeData) return;
    const attackerFactionId = node.siegeData.attackerFactionId;
    const attacker = this.factions.find(f => f.id === attackerFactionId);
    
    if (attacker) {
      if (node.isPlayerBase) {
        node.prosperity = Math.max(0, node.prosperity - 100);
        console.log(`[系統] 💥 您的據點「${node.name}」被【${attacker.factionName}】攻陷，繁榮度大幅下降！`);
        if ((window as any).toastManager) {
           (window as any).toastManager.show(`💥 據點遭到【${attacker.factionName}】攻陷！`, 'error');
        }
      } else {
        console.log(`[系統] 🏰 【${attacker.factionName}】成功攻陷了「${node.name}」。`);
        if (node.ownerFactionId) {
          this.removeNodeFromFaction(node.id, node.ownerFactionId);
        }
        node.ownerFactionId = attacker.id;
        attacker.controlledNodes.push(node.id);
      }
      
      import('../core/EventBus').then(({ EventBus }) => {
         EventBus.getInstance().publish({ 
           type: GameEventType.SIEGE_RESOLVED, 
           payload: { targetNodeId: node.id, winnerId: attacker.id, isCityFallen: true }
         });
      });
    }
    
    node.siegeData = undefined;
  }

  public simulateMapDynamics(months: number): void {
    // 1. 繁榮度變化與升降級檢定
    for (const node of this.mapNodes) {
      // OPT-06: 繁榮度自然成長（有主化的節點每月小幅成長）
      if (node.isPlayerBase) {
        // 基礎 +10
        let prosperityGain = 10;

        // 工人貢獻（已分配的農夫 + 伐木工 + 礦工，每人 +1/月）
        const t = GameState.myTerritory;
        if (t) {
          const assignedWorkers =
            (t.workers['FARMER'] || 0) +
            (t.workers['WOODCUTTER'] || 0) +
            (t.workers['MINER'] || 0);
          prosperityGain += assignedWorkers;

          // 建築貢獻（使用現有 getBuildingProsperityBonus()，每月貢獻 1/5 的永久值）
          const buildingBonus = Math.floor(t.getBuildingProsperityBonus() / 5);
          prosperityGain += buildingBonus;
        }

        node.prosperity += prosperityGain;
        console.log(`[MapDynamics] 📈 月底繁榮度成長 +${prosperityGain}（基礎+工人+建築）`);
      } else if (node.ownerFactionId !== null) {
        node.prosperity += 5;  // 派系改節點每月 +5
      }

      // 檢查相鄰高危險節點 (距離 15 內的荒野或巢穴)
      const hasAdjacentDanger = this.mapNodes.some(other => 
        other.id !== node.id && 
        (other.nodeLevel === NodeLevel.WILDERNESS || other.feature === NodeFeature.MONSTER_NEST) && 
        this.getDistance(node, other) < 15
      );

      if (hasAdjacentDanger && (node.ownerFactionId !== null || node.isPlayerBase)) {
        node.prosperity -= 3; // B2: 降低危險懲罰（-10→-3），避免完全鎖死早期玩家繁榮度成長
      }

      // 確保繁榮度不小於 0
      node.prosperity = Math.max(0, node.prosperity);

      // 節點升級檢定 (排除玩家據點，交由 UI 與內政系統處理)
      if (!node.isPlayerBase && node.nodeLevel < NodeLevel.CAPITAL) {
        const nextLevelThreshold = this.PROSPERITY_THRESHOLDS[node.nodeLevel + 1];
        if (node.prosperity >= nextLevelThreshold) {
          this.upgradeNode(node);
        }
      }

      // C2: 玩家據點繁榮度結算後發布更新事件，供 UI 進度條監聽
      if (node.isPlayerBase) {
        const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
        const nextThresh = node.nodeLevel < NodeLevel.CAPITAL
          ? this.PROSPERITY_THRESHOLDS[node.nodeLevel + 1]
          : node.prosperity;
        import('../core/EventBus').then(({ EventBus }) => {
          import('../core/GameEvents').then(({ GameEventType }) => {
            EventBus.getInstance().publish({
              type: GameEventType.PROSPERITY_CHANGED,
              payload: {
                delta: 0, // 此處 delta 由呼叫端計算，UI 以 current 為主
                current: node.prosperity,
                nextThreshold: nextThresh,
                levelName: levelNames[node.nodeLevel] ?? '未知'
              }
            });
          });
        });
      }

      // 節點降級檢定 (排除玩家據點，交由 UI 與內政系統處理)
      if (!node.isPlayerBase && node.nodeLevel > NodeLevel.WILDERNESS) {
        const currentLevelThreshold = this.PROSPERITY_THRESHOLDS[node.nodeLevel];
        if (node.prosperity < currentLevelThreshold) {
          this.downgradeNode(node);
        }
      }
    }

    this.processAIFactionsInteractions();

    // 2. 派系資源累積與擴張/滅亡判定
    for (const faction of this.factions) {
      if (faction.controlledNodes.length === 0) {
        continue; // 已經滅亡的派系不處理
      }

      // 每個控制的節點每回合提供一定的資源
      faction.resources += faction.controlledNodes.length * 10;

      // 當派系資源超過閾值，嘗試佔領相鄰的荒野或營地
      if (faction.resources >= this.FACTION_EXPANSION_THRESHOLD) {
        this.attemptFactionExpansion(faction);
      }
    }
  }

  private processAIFactionsInteractions(): void {
    for (const faction of this.factions) {
      if (faction.controlledNodes.length === 0) continue;

      if (!faction.relations) faction.relations = {};
      if (!faction.atWarWith) faction.atWarWith = [];

      for (const other of this.factions) {
        if (faction.id === other.id || other.controlledNodes.length === 0) continue;
        
        const relation = faction.relations[other.id] || 0;
        const rand = (Math.random() * 5) | 0;
        if (faction.personality === FactionPersonality.WARMONGER) {
          faction.relations[other.id] = Math.max(-100, relation - rand);
        } else if (faction.personality === FactionPersonality.PEACEFUL) {
          faction.relations[other.id] = Math.min(100, relation + rand);
        }

        if (faction.relations[other.id] < -50 && !faction.atWarWith.includes(other.id)) {
          faction.atWarWith.push(other.id);
          if (!other.atWarWith) other.atWarWith = [];
          if (!other.atWarWith.includes(faction.id)) other.atWarWith.push(faction.id);
          console.log(`[系統] ⚔️ 派系動態：【${faction.factionName}】對【${other.factionName}】宣戰了！`);
        }
        
        if (faction.relations[other.id] > -20 && faction.atWarWith.includes(other.id)) {
          faction.atWarWith = faction.atWarWith.filter(id => id !== other.id);
          if (other.atWarWith) other.atWarWith = other.atWarWith.filter(id => id !== faction.id);
          console.log(`[系統] 🕊️ 派系動態：【${faction.factionName}】與【${other.factionName}】達成了停戰協議。`);
        }
      }

      if (faction.playerFavor < -50 && !faction.atWarWith.includes('player')) {
        faction.atWarWith.push('player');
        console.log(`[系統] ⚠️ 警告：【${faction.factionName}】對您的好感度過低，已對您正式宣戰！`);
        if ((window as any).toastManager) {
           (window as any).toastManager.show(`⚠️ 【${faction.factionName}】對您宣戰了！`, 'error');
        }
      }
    }
  }

  /**
   * 每日檢查未解鎖節點是否達成條件
   */
  public checkNodeUnlocks(currentDay: number, currentPrestige: number): void {
    let unlockedAny = false;
    for (const node of this.mapNodes) {
      if (node.isHidden && node.unlockCondition) {
        const meetsDay = !node.unlockCondition.minDay || currentDay >= node.unlockCondition.minDay;
        const meetsPrestige = !node.unlockCondition.minPrestige || currentPrestige >= node.unlockCondition.minPrestige;

        if (meetsDay && meetsPrestige) {
          node.isHidden = false;
          unlockedAny = true;
          console.log(`🗺️ [情報解鎖] 發現了新的據點：${node.name}！`);

          if ((window as any).toastManager) {
            (window as any).toastManager.show(`🗺️ 發現了新區域：${node.name}！`, 'info');
          }
        }
      }
    }

    if (unlockedAny) {
      Promise.all([
        import('../core/EventBus'),
        import('../core/GameEvents')
      ]).then(([{ EventBus }, { GameEventType }]) => {
        EventBus.getInstance().publish({
          type: GameEventType.MISSIONS_CHANGED,
          payload: { reason: 'PROGRESSED' }
        });
      });
    }
  }

  /**
   * 玩家手動投資城鎮繁榮度
   */
  public investProsperity(nodeId: string, territory: Territory): boolean {
    const node = this.mapNodes.find(n => n.id === nodeId);
    if (!node) return false;

    const cost = 500;
    const gain = 50;

    if (territory.gold >= cost) {
      territory.gold -= cost;
      node.prosperity += gain;
      console.log(`[系統] 💰 您花費了 ${cost} 金幣投資「${node.name}」，繁榮度上升了 ${gain}！`);

      if (node.nodeLevel < NodeLevel.CAPITAL) {
        const nextLevelThreshold = this.PROSPERITY_THRESHOLDS[node.nodeLevel + 1];
        if (node.prosperity >= nextLevelThreshold) {
          this.upgradeNode(node);
        }
      }
      return true;
    } else {
      console.log(`[系統] ⚠️ 金幣不足，無法投資！(需要 ${cost} 金幣)`);
      return false;
    }
  }

  /**
   * 節點升級
   */
  private upgradeNode(node: MapNode): void {
    node.nodeLevel += 1;
    const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
    const newLevelName = levelNames[node.nodeLevel];
    console.log(`[系統] 🗺️ 傳聞「${node.name}」已經發展成了繁華的${newLevelName}！`);
  }

  /**
   * 節點降級
   */
  private downgradeNode(node: MapNode): void {
    const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
    const oldLevelName = levelNames[node.nodeLevel];
    node.nodeLevel -= 1;
    const newLevelName = levelNames[node.nodeLevel];
    console.log(`[系統] ⚠️ 隨著時間凋零，「${node.name}」從${oldLevelName}衰退成了${newLevelName}。`);

    if (node.nodeLevel === NodeLevel.WILDERNESS) {
      if (node.ownerFactionId) {
        this.removeNodeFromFaction(node.id, node.ownerFactionId);
        node.ownerFactionId = null;
      }
    }
  }

  /**
   * 嘗試派系擴張 (含攻城戰發起)
   */
  private attemptFactionExpansion(faction: Faction): void {
    // 1. 若處於交戰狀態，優先嘗試發起攻城
    if (faction.atWarWith && faction.atWarWith.length > 0 && faction.resources >= this.FACTION_EXPANSION_COST * 2) {
      const enemyNodes = this.mapNodes.filter(node =>
        !node.siegeData && (
          (node.isPlayerBase && faction.atWarWith.includes('player')) ||
          (node.ownerFactionId && faction.atWarWith.includes(node.ownerFactionId))
        )
      );

      if (enemyNodes.length > 0) {
        const factionNodes = this.mapNodes.filter(n => faction.controlledNodes.includes(n.id));
        let siegeTarget: MapNode | null = null;
        let minSiegeDist = Infinity;

        for (const target of enemyNodes) {
          for (const fn of factionNodes) {
            const dist = this.getDistance(fn, target);
            if (dist < 20 && dist < minSiegeDist) {
              minSiegeDist = dist;
              siegeTarget = target;
            }
          }
        }

        if (siegeTarget) {
          faction.resources -= this.FACTION_EXPANSION_COST * 2;
          const remainingDays = Random.int(3, 6);
          siegeTarget.siegeData = {
            attackerFactionId: faction.id,
            remainingDays: remainingDays,
            attackerPower: faction.resources + 500
          };

          console.log(`[系統] ⚔️ 攻城戰發起！【${faction.factionName}】開始圍攻「${siegeTarget.name}」（剩餘 ${remainingDays} 天）。`);

          if (siegeTarget.isPlayerBase && (window as any).toastManager) {
            (window as any).toastManager.show(`🚨 警告！【${faction.factionName}】開始圍攻您的據點「${siegeTarget.name}」！`, 'error');
          }

          import('../core/EventBus').then(({ EventBus }) => {
            EventBus.getInstance().publish({
              type: GameEventType.SIEGE_STARTED,
              payload: { targetNodeId: siegeTarget!.id, attackerFactionId: faction.id }
            });
          });
          return;
        }
      }
    }

    // 2. 尋找可佔領的空白目標
    const availableTargets = this.mapNodes.filter(node =>
      node.ownerFactionId === null &&
      !node.isPlayerBase &&
      node.feature === NodeFeature.OCCUPIABLE
    );

    if (availableTargets.length > 0) {
      let bestTarget: MapNode | null = null;
      let minDistance = Infinity;

      for (const target of availableTargets) {
        const factionNodes = this.mapNodes.filter(n => faction.controlledNodes.includes(n.id));
        for (const fn of factionNodes) {
          const dist = this.getDistance(fn, target);
          if (dist < minDistance) {
            minDistance = dist;
            bestTarget = target;
          }
        }
      }

      if (bestTarget) {
        if (minDistance < 15) {
          faction.resources -= this.FACTION_EXPANSION_COST;
          faction.controlledNodes.push(bestTarget.id);
          bestTarget.ownerFactionId = faction.id;
          console.log(`[系統] 🛡️ 派系動態：【${faction.factionName}】的勢力穩步擴張，佔領了「${bestTarget.name}」。`);
        } else if (faction.resources >= this.FACTION_EXPANSION_COST * 5) {
          faction.resources -= this.FACTION_EXPANSION_COST * 5;
          faction.controlledNodes.push(bestTarget.id);
          bestTarget.ownerFactionId = faction.id;
          console.log(`[系統] 🛡️ 派系動態：【${faction.factionName}】發動了遠征，耗費鉅資佔領了「${bestTarget.name}」。`);
        }
      }
    }
  }

  public relocateBase(targetNodeId: string, territory: Territory): boolean {
    const targetNode = this.mapNodes.find(n => n.id === targetNodeId);
    if (!targetNode) return false;

    // 遷徙費用 (假設固定 1000 金幣，可由 Territory 的 migrateTo 處理，但在此我們統一管理邏輯)
    const cost = 1000;
    if (territory.gold >= cost) {
      territory.gold -= cost;
      
      // 取消原本的據點標記
      const currentBase = this.mapNodes.find(n => n.isPlayerBase);
      if (currentBase) {
        currentBase.isPlayerBase = false;
      }

      // 設定新據點
      targetNode.isPlayerBase = true;
      territory.currentCountryId = targetNode.id; // 保持向後相容

      console.log(`[系統] 🚚 [遷徙] 花費 ${cost} 金幣，您的據點已正式搬遷至「${targetNode.name}」！`);
      return true;
    } else {
      console.log(`[系統] ⚠️ 金幣不足，無法遷徙！(需要 ${cost} 金幣)`);
      return false;
    }
  }

  /**
   * 玩家在荒野建立新據點 (營地)
   */
  public foundSettlement(targetNodeId: string, territory: Territory): boolean {
    const targetNode = this.mapNodes.find(n => n.id === targetNodeId);
    if (!targetNode) return false;

    if (targetNode.ownerFactionId !== null) {
      console.log(`[系統] ⚠️ 該節點已被其他派系佔領，無法建立據點！`);
      return false;
    }

    if (targetNode.nodeLevel > NodeLevel.WILDERNESS) {
      console.log(`[系統] ⚠️ 該節點已不是荒野，無法建立新據點！`);
      return false;
    }

    const cost = 500; // 建國/建村費用
    if (territory.gold >= cost) {
      territory.gold -= cost;

      // 取消原本的據點標記
      const currentBase = this.mapNodes.find(n => n.isPlayerBase);
      if (currentBase) {
        currentBase.isPlayerBase = false;
      }

      // 升級為營地並設定為玩家據點
      targetNode.nodeLevel = NodeLevel.CAMP;
      targetNode.prosperity = this.PROSPERITY_THRESHOLDS[NodeLevel.CAMP];
      targetNode.isPlayerBase = true;
      territory.currentCountryId = targetNode.id;

      console.log(`[系統] 🏕️ [開拓] 花費 ${cost} 金幣，您在「${targetNode.name}」建立了全新的營地據點！`);
      return true;
    } else {
      console.log(`[系統] ⚠️ 金幣不足，無法建立據點！(需要 ${cost} 金幣)`);
      return false;
    }
  }

  /**
   * 派遣斥候偵查節點 (解鎖情報)
   * TODO: 未來可改為消耗 Adventurer 派遣任務 (DispatchTask)
   */
  public scoutNode(nodeId: string, territory: Territory, currentDay: number): boolean {
    const node = this.mapNodes.find(n => n.id === nodeId);
    if (!node) return false;

    if (node.isScouted) {
      console.log(`[系統] ⚠️ 該節點「${node.name}」已經偵查過了！`);
      return false;
    }
    
    if (node.pendingScoutDays && node.pendingScoutDays > 0) {
      console.log(`[系統] ⚠️ 該節點「${node.name}」已經有斥候正在前往！`);
      return false;
    }

    const cost = 100; // 偵查花費
    if (territory.gold >= cost) {
      territory.gold -= cost;
      
      let scoutDays = 1;
      const baseId = territory.currentCountryId;
      if (baseId) {
        const baseNode = this.getNodeById(baseId);
        if (baseNode) {
          const dx = baseNode.x - node.x;
          const dy = baseNode.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= 70) scoutDays = 3;
          else if (dist >= 30) scoutDays = 2;
          else scoutDays = 1;
        }
      }
      
      node.pendingScoutDays = scoutDays;
      console.log(`[系統] 👁️ 花費 ${cost} 金幣派遣斥候前往「${node.name}」，預計 ${scoutDays} 天後回報情報！`);
      return true;
    } else {
      console.log(`[系統] ⚠️ 金幣不足，無法派遣斥候！(需要 ${cost} 金幣)`);
      return false;
    }
  }

  public resolveScout(node: MapNode, currentDay: number): void {
    node.isScouted = true;
    node.scoutExpiryDate = currentDay + 30; // 情報有效期限 30 天

    // 產生模擬情報資料 (scoutData)
    let danger = '安全';
    let treasure = '無';
    let garrison = 0;

    if (node.feature === NodeFeature.MONSTER_NEST) {
      danger = '極度危險';
      treasure = '史詩寶藏';
    } else if (node.feature === NodeFeature.SUBJUGATION) {
      danger = '中等危險';
      treasure = '稀有素材';
    } else if (node.ownerFactionId && !node.isPlayerBase) {
      danger = '未知軍勢';
      treasure = '豐富物資';
      garrison = node.prosperity * 2 + 500;
    }

    node.scoutData = {
      dangerLevel: danger,
      treasureTier: treasure,
      garrisonPower: garrison > 0 ? garrison : undefined
    };

    console.log(`[系統] 👁️ 斥候已傳回「${node.name}」的最新情報！(有效期限 30 天)`);
  }

  /**
   * 每日檢查情報是否過期
   */
  public checkScoutExpiry(currentDay: number): void {
    for (const node of this.mapNodes) {
      if (node.isScouted && node.scoutExpiryDate !== null) {
        if (currentDay >= node.scoutExpiryDate) {
          node.isScouted = false;
          node.scoutExpiryDate = null;
          node.scoutData = undefined;
          console.log(`[系統] 🌫️ 關於「${node.name}」的情報已經過期，節點重新陷入迷霧。`);
        }
      }
    }
  }

  /**
   * 每日更新全地圖天氣
   */
  public updateWeather(): void {
    for (const node of this.mapNodes) {
      if (node.weatherDuration > 0) {
        node.weatherDuration -= 1;
        continue; // 天氣還沒結束，維持原狀
      }

      // 天氣結束，重新骰一次天氣
      // 依據地形賦予權重
      const r = Random.next();
      
      if (node.terrain === TerrainType.SNOW_MOUNTAIN) {
        if (r < 0.6) {
          node.currentWeather = WeatherType.SNOW;
          node.weatherDuration = Random.int(2, 4);
        } else if (r < 0.8) {
          node.currentWeather = WeatherType.FOG;
          node.weatherDuration = Random.int(1, 2);
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(1, 2);
        }
      } else if (node.terrain === TerrainType.DESERT) {
        if (r < 0.3) {
          node.currentWeather = WeatherType.SANDSTORM;
          node.weatherDuration = Random.int(1, 3);
        } else if (r < 0.35) { // 異常天氣
          node.currentWeather = WeatherType.RAIN;
          node.weatherDuration = 1;
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(3, 7);
        }
      } else if (node.terrain === TerrainType.FOREST) {
        if (r < 0.4) {
          node.currentWeather = WeatherType.RAIN;
          node.weatherDuration = Random.int(1, 3);
        } else if (r < 0.6) {
          node.currentWeather = WeatherType.FOG;
          node.weatherDuration = Random.int(1, 2);
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(2, 5);
        }
      } else if (node.terrain === TerrainType.VOLCANO) {
        if (r < 0.2) {
          node.currentWeather = WeatherType.FOG;
          node.weatherDuration = Random.int(1, 3);
        } else if (r < 0.25) { // 異常天氣
          node.currentWeather = WeatherType.SNOW;
          node.weatherDuration = 1;
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(2, 7);
        }
      } else { // PLAINS 及其他
        if (r < 0.3) {
          node.currentWeather = WeatherType.RAIN;
          node.weatherDuration = Random.int(1, 3);
        } else if (r < 0.4) {
          node.currentWeather = WeatherType.FOG;
          node.weatherDuration = Random.int(1, 2);
        } else if (r < 0.45) { // 異常天氣
          node.currentWeather = WeatherType.SNOW;
          node.weatherDuration = 1;
        } else {
          node.currentWeather = WeatherType.CLEAR;
          node.weatherDuration = Random.int(2, 6);
        }
      }
    }
  }

  /**
   * 輔助方法：從派系中移除節點
   */
  private removeNodeFromFaction(nodeId: string, factionId: string): void {
    const faction = this.factions.find(f => f.id === factionId);
    if (faction) {
      faction.controlledNodes = faction.controlledNodes.filter(id => id !== nodeId);
      if (faction.controlledNodes.length === 0) {
        console.log(`[系統] 💀 派系滅亡：【${faction.factionName}】失去了最後的據點，該勢力已在歷史中消亡。`);
      }
    }
  }

  /**
   * 輔助方法：計算兩節點間的距離
   */
  private getDistance(nodeA: MapNode, nodeB: MapNode): number {
    const dx = nodeA.x - nodeB.x;
    const dy = nodeA.y - nodeB.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  public getNodes(): MapNode[] {
    return this.mapNodes;
  }

  public getNodeById(nodeId: string): MapNode | undefined {
    return this.mapNodes.find(n => n.id === nodeId);
  }

  public getFactions(): Faction[] {
    return this.factions;
  }

  /**
   * 生成隨機動態周邊節點
   */
  public spawnDynamicNode(baseNode: MapNode, radius: number = 10): MapNode | null {
    // 簡單判定目前地圖上 isDynamic 的數量
    const dynamicCount = this.mapNodes.filter(n => n.isDynamic).length;
    if (dynamicCount >= 5) {
      return null; // 超過上限，不生成
    }

    // 隨機在 baseNode 周圍找一個不會與現有節點重疊的座標
    let newX = baseNode.x;
    let newY = baseNode.y;
    let validPos = false;
    let attempts = 0;
    while (!validPos && attempts < 20) {
      const offsetX = Random.int(-radius, radius);
      const offsetY = Random.int(-radius, radius);
      // 避免太近
      if (Math.abs(offsetX) < 2 && Math.abs(offsetY) < 2) {
        attempts++;
        continue;
      }
      newX = Math.max(2, Math.min(98, baseNode.x + offsetX));
      newY = Math.max(2, Math.min(98, baseNode.y + offsetY));

      // 檢查是否太靠近其他節點
      let tooClose = false;
      for (const n of this.mapNodes) {
        const dx = n.x - newX;
        const dy = n.y - newY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 3) {
          tooClose = true;
          break;
        }
      }

      if (!tooClose) {
        validPos = true;
      }
      attempts++;
    }

    if (!validPos) {
      return null;
    }

    // 隨機決定地貌與類型
    const possibleTerrains = [TerrainType.FOREST, TerrainType.PLAINS, TerrainType.CAVE, TerrainType.RUINS, TerrainType.WILDERNESS];
    const terrain = Random.pick(possibleTerrains);
    
    let feature = NodeFeature.MONSTER_NEST;
    let namePrefix = '怪物巢穴';
    if (Random.next() < 0.3) {
      feature = NodeFeature.SUBJUGATION;
      namePrefix = '隨機事件';
    }

    // 根據玩家「最強 5 名冒險者」的戰力，隨機決定這個巢穴的難度 [5 ~ (10 + Top5Power / 40)]
    // 避免因爲閒置傭兵太多導致難度無限膨脹，超過派遣隊伍的極限
    let top5Power = 0;
    try {
       const gs = (window as any).GameState; // 繞過直接 import 避免循環依賴
       if (gs && gs.adventurers) {
          const sorted = [...gs.adventurers].sort((a: any, b: any) => b.power - a.power);
          top5Power = sorted.slice(0, 5).reduce((sum: number, a: any) => sum + a.power, 0);
       }
    } catch(e) {}
    
    // 最高難度的敵方總戰力大約是玩家 Top 5 總戰力的 1.25 倍左右，確保挑戰性但不會必敗
    const maxDiff = Math.max(10, Math.floor(10 + top5Power / 40));
    const dynamicDiff = Random.int(5, maxDiff);

    const newNode: MapNode = {
      id: `dynamic_node_${Date.now()}_${Random.int(100, 999)}`,
      name: `未知的${namePrefix}`,
      description: '這是領主親自探索時發現的神秘地點。',
      x: newX,
      y: newY,
      population: 0,
      prosperity: 0,
      nodeLevel: NodeLevel.WILDERNESS,
      ownerFactionId: null,
      isPlayerBase: false,
      terrain: terrain,
      feature: feature,
      isHidden: false,
      isDynamic: true,
      baseDifficulty: dynamicDiff,
      isScouted: false,
      scoutExpiryDate: null,
      currentWeather: WeatherType.CLEAR,
      weatherDuration: 0
    };

    this.mapNodes.push(newNode);

    // 觸發地圖更新事件
    Promise.all([
      import('../core/EventBus'),
      import('../core/GameEvents')
    ]).then(([{ EventBus }, { GameEventType }]) => {
      EventBus.getInstance().publish({ 
        type: GameEventType.MISSIONS_CHANGED, 
        payload: { reason: 'PROGRESSED' }
      });
    });

    return newNode;
  }
}
