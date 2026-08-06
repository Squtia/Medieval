import { MapNode, NodeLevel } from '../../models/types';
import { Territory } from '../../models/Territory';
import { GameState } from '../../core/GameState';
import { MapUtils } from './MapUtils';
import { FactionSystem } from './FactionSystem';
import { PROSPERITY_THRESHOLDS, calculateNodeLevel, getMonthlyProsperityGain } from '../../data/BalanceData';

export class MapNodeSystem {
  public static simulateProsperity(mapNodes: MapNode[]): void {
    for (const node of mapNodes) {
      if (node.isPlayerBase) {
        let prosperityGain = 8;
        const t = GameState.myTerritory;
        if (t) {
          const assignedWorkers =
            (t.workers['FARMER'] || 0) +
            (t.workers['WOODCUTTER'] || 0) +
            (t.workers['MINER'] || 0);
          prosperityGain = getMonthlyProsperityGain(assignedWorkers, t.getBuildingProsperityBonus());
        }

        node.prosperity += prosperityGain;
        console.log(`[MapDynamics] 📈 月底繁榮度成長 +${prosperityGain}（基礎+工人+建築）`);
      } else if (node.ownerFactionId !== null) {
        node.prosperity += 5;  // 派系改節點每月 +5
      }

      // 檢查相鄰高危險節點 (距離 15 內的荒野或巢穴)
      const hasAdjacentDanger = mapNodes.some(other => 
        other.id !== node.id && 
        (other.nodeLevel === NodeLevel.WILDERNESS || other.feature === 'MONSTER_NEST' as any) && 
        MapUtils.getDistance(node, other) < 15
      );

      if (hasAdjacentDanger && (node.ownerFactionId !== null || node.isPlayerBase)) {
        node.prosperity -= 3;
      }

      // 確保繁榮度不小於 0
      node.prosperity = Math.max(0, node.prosperity);

      const previousLevel = node.nodeLevel;
      const hasVassal = mapNodes.some(other =>
        other.id !== node.id &&
        other.ownerFactionId !== null &&
        other.ownerFactionId === node.ownerFactionId
      );
      node.nodeLevel = calculateNodeLevel(node, hasVassal);
      node.isCapital = node.nodeLevel === NodeLevel.CAPITAL;
      
      if (node.nodeLevel !== previousLevel) {
        console.log(`[MapDynamics] ${node.name} 據點等級由 ${previousLevel} 調整為 ${node.nodeLevel}。`);
        if (node.nodeLevel > previousLevel) {
          this.upgradeNode(node);
        } else {
          // 在重構的上下文中，downgradeNode 的 faction 移除邏輯交給呼叫端或這裡省略詳細實作，只保留升降級日誌
          const levelNames = ['荒野', '營地', '村莊', '城鎮', '首都'];
          console.log(`[系統] ⚠️ 隨著時間凋零，「${node.name}」從${levelNames[previousLevel]}衰退成了${levelNames[node.nodeLevel]}。`);
        }
      }

      if (node.isPlayerBase) {
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
