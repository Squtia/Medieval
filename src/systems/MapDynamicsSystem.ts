import { Faction, MapNode, NodeLevel, NodeFeature, WeatherType, TerrainType } from '../models/types';
import { Territory } from '../models/Territory';
import { Random } from '../core/Random';

export class MapDynamicsSystem {
  private mapNodes: MapNode[];
  private factions: Faction[];

  // 升級所需的繁榮度門檻 (依據 NodeLevel)
  private readonly PROSPERITY_THRESHOLDS: Record<number, number> = {
    [NodeLevel.WILDERNESS]: 0,
    [NodeLevel.CAMP]: 100,
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
  public simulateMapDynamics(months: number): void {
    // 1. 繁榮度變化與升降級檢定
    for (const node of this.mapNodes) {
      // OPT-06: 繁榮度自然成長（有主化的節點每月小幅成長）
      if (node.isPlayerBase) {
        node.prosperity += 10; // 玩家據點每月 +10
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
        node.prosperity -= 10; // 每個月受怪物威脅大幅下降
      }

      // 確保繁榮度不小於 0
      node.prosperity = Math.max(0, node.prosperity);

      // 節點升級檢定
      if (node.nodeLevel < NodeLevel.CAPITAL) {
        const nextLevelThreshold = this.PROSPERITY_THRESHOLDS[node.nodeLevel + 1];
        if (node.prosperity >= nextLevelThreshold) {
          this.upgradeNode(node);
        }
      }

      // 節點降級檢定
      if (node.nodeLevel > NodeLevel.WILDERNESS) {
        const currentLevelThreshold = this.PROSPERITY_THRESHOLDS[node.nodeLevel];
        if (node.prosperity < currentLevelThreshold) {
          // TODO: 這是暫時的絕對安全設計，未來需加入 AI 攻城機制，目前玩家據點絕對不降級、不消失
          if (node.isPlayerBase) {
             node.prosperity = currentLevelThreshold; // 鎖定在當前門檻
          } else {
             this.downgradeNode(node);
          }
        }
      }
    }

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
          
          // 可在此發送通知或事件給玩家
          if ((window as any).toastManager) {
            (window as any).toastManager.show(`🗺️ 發現了新區域：${node.name}！`, 'info');
          }
        }
      }
    }
    
    // 如果有解鎖新節點，觸發事件要求重繪地圖
    if (unlockedAny) {
      Promise.all([
        import('../core/EventBus'),
        import('../core/GameEvents')
      ]).then(([{ EventBus }, { GameEventType }]) => {
        EventBus.getInstance().publish({ 
          type: GameEventType.MISSIONS_CHANGED, // 借用此事件強制更新地圖
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

    // 每次投資固定花費 500 金，增加 50 繁榮度
    const cost = 500;
    const gain = 50;

    if (territory.gold >= cost) {
      territory.gold -= cost;
      node.prosperity += gain;
      console.log(`[系統] 💰 您花費了 ${cost} 金幣投資「${node.name}」，繁榮度上升了 ${gain}！`);
      
      // 立即檢查是否能升級
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
    
    // 若降為荒野，失去擁有者
    if (node.nodeLevel === NodeLevel.WILDERNESS) {
      if (node.ownerFactionId) {
        this.removeNodeFromFaction(node.id, node.ownerFactionId);
        node.ownerFactionId = null;
      }
    }
  }

  /**
   * 嘗試派系擴張
   */
  private attemptFactionExpansion(faction: Faction): void {
    // 尋找可佔領的目標 (且沒有被其他派系佔領，也不是玩家據點)
    const availableTargets = this.mapNodes.filter(node => 
      node.ownerFactionId === null && 
      !node.isPlayerBase &&
      node.feature === NodeFeature.OCCUPIABLE
    );

    if (availableTargets.length > 0) {
      // 找出距離當前派系最近的節點
      let bestTarget = null;
      let minDistance = Infinity;

      for (const target of availableTargets) {
        // 從該派系的所有已知節點尋找最近距離
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
        // 只有相鄰(距離 < 15)才允許擴張，避免跨越半個地圖
        if (minDistance < 15) {
          faction.resources -= this.FACTION_EXPANSION_COST;
          faction.controlledNodes.push(bestTarget.id);
          bestTarget.ownerFactionId = faction.id;
          console.log(`[系統] 🛡️ 派系動態：【${faction.factionName}】的勢力穩步擴張，佔領了「${bestTarget.name}」。`);
        } else if (faction.resources >= this.FACTION_EXPANSION_COST * 5) {
          // 遠征：距離較遠，需付出五倍代價
          faction.resources -= this.FACTION_EXPANSION_COST * 5;
          faction.controlledNodes.push(bestTarget.id);
          bestTarget.ownerFactionId = faction.id;
          console.log(`[系統] 🛡️ 派系動態：【${faction.factionName}】發動了遠征，耗費鉅資佔領了「${bestTarget.name}」。`);
        }
      }
    }
  }

  /**
   * 玩家遷徙據點
   */
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

    const cost = 100; // 偵查花費
    if (territory.gold >= cost) {
      territory.gold -= cost;
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

      console.log(`[系統] 👁️ 花費 ${cost} 金幣，成功偵查「${node.name}」，獲得最新情報！(有效期限 30 天)`);
      return true;
    } else {
      console.log(`[系統] ⚠️ 金幣不足，無法派遣斥候！(需要 ${cost} 金幣)`);
      return false;
    }
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
