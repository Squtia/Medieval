import { MapNode, NodeLevel } from '../../models/types';
import { Territory } from '../../models/Territory';
import { GameState } from '../../core/GameState';
import { MapUtils } from './MapUtils';
import { FactionSystem } from './FactionSystem';
import { PROSPERITY_THRESHOLDS, calculateNodeLevel, getMonthlyProsperityGain } from '../../data/BalanceData';

export class MapNodeSystem {
  public static simulateProsperity(mapNodes: MapNode[]): void {
    for (const node of mapNodes) {
      // 僅針對玩家主據點進行繁榮度即時計算與等級晉升，NPC 各國據點與險地保持其預設固定規模等級
      if (!node.isPlayerBase) continue;

      // 檢查相鄰高危險動態節點 (距離 15 內的探索動態巢穴/荒野)
      const hasAdjacentDanger = mapNodes.some(other => 
        other.id !== node.id && 
        other.isDynamic &&
        (other.nodeLevel === NodeLevel.WILDERNESS || other.feature === 'MONSTER_NEST' as any) && 
        MapUtils.getDistance(node, other) < 15
      );

      const t = GameState.myTerritory;
      if (t) {
        const roadCount = GameState.roadSystem ? GameState.roadSystem.getRoads().length : 0;
        const vassalCount = mapNodes.filter(n => n.ownerFactionId === 'player' && !n.isPlayerBase).length;
        node.prosperity = t.getRealtimeProsperity(roadCount, vassalCount, hasAdjacentDanger);
        console.log(`[MapDynamics] 📊 玩家據點即時繁榮度評分：${node.prosperity}（人口+設施+建築）`);
      }

      node.prosperity = Math.max(0, node.prosperity);

      const previousLevel = node.nodeLevel;
      const hasVassal = mapNodes.some(other =>
        other.id !== node.id &&
        other.ownerFactionId === 'player' &&
        !other.isPlayerBase
      );
      node.nodeLevel = calculateNodeLevel(node, hasVassal);
      node.isCapital = node.nodeLevel === NodeLevel.CAPITAL;
      
      if (node.nodeLevel !== previousLevel) {
        console.log(`[MapDynamics] 玩家據點規模由等級 ${previousLevel} 晉升為等級 ${node.nodeLevel}。`);
      }

      const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
      const nextThresh = node.nodeLevel < NodeLevel.CAPITAL
        ? PROSPERITY_THRESHOLDS[node.nodeLevel + 1 as NodeLevel]
        : node.prosperity;
      import('../../core/EventBus').then(({ EventBus }) => {
        import('../../core/GameEvents').then(({ GameEventType }) => {
          EventBus.getInstance().publish({
            type: GameEventType.PROSPERITY_CHANGED,
            payload: {
              delta: 0,
              current: node.prosperity,
              nextThreshold: nextThresh,
              levelName: levelNames[node.nodeLevel] ?? '未知'
            }
          });
        });
      });
    }
  }

  public static investProsperity(nodeId: string, mapNodes: MapNode[], territory: Territory): boolean {
    const node = mapNodes.find(n => n.id === nodeId);
    if (!node) return false;

    const cost = 500;
    const gain = 50;

    if (territory.gold >= cost) {
      territory.gold -= cost;
      node.prosperity += gain;
      console.log(`[系統] 💰 您花費了 ${cost} 金幣投資「${node.name}」，繁榮度上升了 ${gain}！`);

      const hasVassal = mapNodes.some(other =>
        other.id !== node.id &&
        other.ownerFactionId !== null &&
        other.ownerFactionId === node.ownerFactionId
      );
      node.nodeLevel = calculateNodeLevel(node, hasVassal);
      node.isCapital = node.nodeLevel === NodeLevel.CAPITAL;
      return true;
    } else {
      console.log(`[系統] ⚠️ 金幣不足，無法投資！(需要 ${cost} 金幣)`);
      return false;
    }
  }

  public static relocateBase(targetNodeId: string, mapNodes: MapNode[], territory: Territory): boolean {
    const targetNode = mapNodes.find(n => n.id === targetNodeId);
    if (!targetNode) return false;

    const cost = 1000;
    if (territory.gold >= cost) {
      territory.gold -= cost;
      
      const currentBase = mapNodes.find(n => n.isPlayerBase);
      if (currentBase) {
        currentBase.isPlayerBase = false;
      }

      targetNode.isPlayerBase = true;
      territory.currentCountryId = targetNode.id;

      console.log(`[系統] 🚚 [遷徙] 花費 ${cost} 金幣，您的據點已正式搬遷至「${targetNode.name}」！`);
      return true;
    } else {
      console.log(`[系統] ⚠️ 金幣不足，無法遷徙！(需要 ${cost} 金幣)`);
      return false;
    }
  }

  public static foundSettlement(targetNodeId: string, mapNodes: MapNode[], territory: Territory): boolean {
    const targetNode = mapNodes.find(n => n.id === targetNodeId);
    if (!targetNode) return false;

    if (targetNode.ownerFactionId !== null) {
      console.log(`[系統] ⚠️ 該節點已被其他派系佔領，無法建立據點！`);
      return false;
    }

    if (targetNode.nodeLevel > NodeLevel.WILDERNESS) {
      console.log(`[系統] ⚠️ 該節點已不是荒野，無法建立新據點！`);
      return false;
    }

    const cost = 500;
    if (territory.gold >= cost) {
      territory.gold -= cost;

      const currentBase = mapNodes.find(n => n.isPlayerBase);
      if (currentBase) {
        currentBase.isPlayerBase = false;
      }

      targetNode.nodeLevel = NodeLevel.CAMP;
      targetNode.prosperity = PROSPERITY_THRESHOLDS[NodeLevel.CAMP];
      targetNode.isPlayerBase = true;
      territory.currentCountryId = targetNode.id;

      console.log(`[系統] 🏕️ [開拓] 花費 ${cost} 金幣，您在「${targetNode.name}」建立了全新的營地據點！`);
      return true;
    } else {
      console.log(`[系統] ⚠️ 金幣不足，無法建立據點！(需要 ${cost} 金幣)`);
      return false;
    }
  }

  private static upgradeNode(node: MapNode): void {
    const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
    const newLevelName = levelNames[node.nodeLevel];
    console.log(`[系統] 🗺️ 傳聞「${node.name}」已經發展成了繁華的${newLevelName}！`);
  }
}
