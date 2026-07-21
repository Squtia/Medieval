import { MapNode, NodeFeature, NodeLevel, TerrainType } from '../models/types';
import { DispatchTask, TradePhase, normalizeTradeTask } from '../models/DispatchTask';

export interface TradeRouteSegment {
  startNodeId: string;
  endNodeId: string;
  isCurrent: boolean;
}

export function buildTradeRouteSegments(task: DispatchTask, playerNodeId: string): TradeRouteSegment[] {
  normalizeTradeTask(task);
  const itinerary = task.tradeItineraryNodeIds || [];
  if (itinerary.length === 0) return [];

  const path = [playerNodeId, ...itinerary, playerNodeId];
  const currentIndex = task.tradePhase === TradePhase.RETURNING
    ? itinerary.length
    : Math.min(task.currentLegIndex ?? 0, itinerary.length - 1);

  return path.slice(0, -1).map((startNodeId, index) => ({
    startNodeId,
    endNodeId: path[index + 1],
    isCurrent: index === currentIndex
  }));
}

export function getTerrainEmoji(terrain: TerrainType): string {
  switch (terrain) {
    case TerrainType.FOREST: return '🌲';
    case TerrainType.SNOW_MOUNTAIN: return '🏔️';
    case TerrainType.VOLCANO: return '🌋';
    case TerrainType.DESERT: return '🏜️';
    case TerrainType.PLAINS: return '🌾';
    default: return '📍';
  }
}

export function getNodeIcon(node: MapNode): string {
  if (node.isPlayerBase) return '🏰';
  if (node.feature === NodeFeature.MONSTER_NEST) return '👹';
  if (node.feature === NodeFeature.SUBJUGATION) return '🏚️';
  if (node.nodeLevel === NodeLevel.CAPITAL) return '🏰';
  if (node.nodeLevel === NodeLevel.TOWN) return '🏘️';
  if (node.nodeLevel === NodeLevel.VILLAGE) return '🏡';
  if (node.nodeLevel === NodeLevel.CAMP) return '⛺';
  return getTerrainEmoji(node.terrain);
}

export function getNodeTextureKey(node: MapNode): string {
  // 1. 玩家初始/主要據點
  if (node.isPlayerBase) return 'node-castle';

  // 2. 特殊功能與危險討伐據點 (NodeFeature)
  if (node.feature === NodeFeature.MONSTER_NEST) return 'node-volcano';
  if (node.feature === NodeFeature.SUBJUGATION) return 'node-ruins';

  // 3. 依據據點等級 (NodeLevel) 匹配繪寫風建築圖樣
  switch (node.nodeLevel) {
    case NodeLevel.CAPITAL:
      return 'node-castle';
    case NodeLevel.TOWN:
      return 'node-town';
    case NodeLevel.VILLAGE:
      return 'node-village';
    case NodeLevel.CAMP:
      return 'node-forest';
    default:
      return 'node-village';
  }
}

