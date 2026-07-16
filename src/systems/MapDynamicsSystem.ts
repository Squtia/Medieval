import { Faction, MapNode, NodeLevel, NodeFeature } from '../models/types';
import { Territory } from '../models/Territory';

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
  public simulateMapDynamics(deltaTime: number): void {
    // 1. 繁榮度自然變化與升降級檢定
    for (const node of this.mapNodes) {
      // 只有 5% 的機率在每次 tick 發生自然成長，大幅降低節奏
      const shouldTick = Math.random() < 0.05;
      
      if (shouldTick) {
        if (node.ownerFactionId !== null || node.isPlayerBase) {
          // 有派系或玩家佔領的節點，繁榮度自然成長
          node.prosperity += 1;
        }

        // 檢查相鄰高危險節點 (距離 15 內的荒野或巢穴)
        const hasAdjacentDanger = this.mapNodes.some(other => 
          other.id !== node.id && 
          (other.nodeLevel === NodeLevel.WILDERNESS || other.feature === NodeFeature.MONSTER_NEST) && 
          this.getDistance(node, other) < 15
        );

        if (hasAdjacentDanger && (node.ownerFactionId !== null || node.isPlayerBase)) {
          node.prosperity -= 1; // 受怪物威脅下降
        }

        // 確保繁榮度不小於 0
        node.prosperity = Math.max(0, node.prosperity);
      }

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

  public getFactions(): Faction[] {
    return this.factions;
  }
}
