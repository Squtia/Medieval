import { MapNode, NodeLevel } from '../models/types';
import { TERRAIN_BOUNDS, RegionBounds } from '../data/MapRegions';
import { Random } from '../core/Random';

export class MapGenerator {
  /**
   * 為所有沒有座標（或座標為 0,0）的節點動態分配位置
   */
  public static assignDynamicCoordinates(nodes: MapNode[]): void {
    const MIN_DISTANCE = 8; // 節點之間的最小距離百分比
    const MAX_ATTEMPTS = 50;

    // 先將節點按照級別排序，確保首都先放置
    const sortedNodes = [...nodes].sort((a, b) => b.nodeLevel - a.nodeLevel);
    
    // 紀錄各家族的首都位置，用作群聚依據
    const capitalPositions: Record<string, { x: number; y: number }> = {};

    for (const node of sortedNodes) {
      if (node.x !== 0 && node.y !== 0) continue; // 已有座標則跳過

      const boundsList = TERRAIN_BOUNDS[node.terrain];
      if (!boundsList || boundsList.length === 0) {
        console.warn(`No bounds defined for terrain ${node.terrain}, using default center.`);
        node.x = 50;
        node.y = 50;
        continue;
      }

      let placed = false;
      let bestPoint = { x: 50, y: 50 };
      let maxDistSoFar = 0;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        // 隨機選擇一個該地形的 Bound
        const bounds = Random.pick(boundsList);
        
        let tx: number, ty: number;
        
        // 如果是首都，盡量放在區塊中心偏一點
        if (node.nodeLevel === NodeLevel.CAPITAL) {
           tx = bounds.xMin + (bounds.xMax - bounds.xMin) / 2 + (Random.next() - 0.5) * 5;
           ty = bounds.yMin + (bounds.yMax - bounds.yMin) / 2 + (Random.next() - 0.5) * 5;
        } else if (node.ownerFactionId && capitalPositions[node.ownerFactionId]) {
           // 如果有首都，盡量靠近首都 (距離 10~25 內)
           const cap = capitalPositions[node.ownerFactionId];
           const angle = Random.next() * Math.PI * 2;
           const dist = 5 + Random.next() * 15;
           tx = cap.x + Math.cos(angle) * dist;
           ty = cap.y + Math.sin(angle) * dist;
           
           // 限制在地形邊界內
           tx = Math.max(bounds.xMin, Math.min(bounds.xMax, tx));
           ty = Math.max(bounds.yMin, Math.min(bounds.yMax, ty));
        } else {
           tx = bounds.xMin + Random.next() * (bounds.xMax - bounds.xMin);
           ty = bounds.yMin + Random.next() * (bounds.yMax - bounds.yMin);
        }

        // 碰撞檢測
        let tooClose = false;
        let minDistToOthers = 999;
        
        for (const other of sortedNodes) {
          if (other.id !== node.id && (other.x !== 0 || other.y !== 0)) {
            const dx = other.x - tx;
            const dy = other.y - ty;
            const dist = Math.sqrt(dx * dx + dy * dy);
            minDistToOthers = Math.min(minDistToOthers, dist);
            if (dist < MIN_DISTANCE) {
              tooClose = true;
            }
          }
        }

        if (!tooClose) {
          node.x = tx;
          node.y = ty;
          placed = true;
          break;
        }

        // 紀錄如果找不到完美位置，至少拿一個最不擠的
        if (minDistToOthers > maxDistSoFar) {
          maxDistSoFar = minDistToOthers;
          bestPoint = { x: tx, y: ty };
        }
      }

      if (!placed) {
        // 如果 50 次嘗試都失敗（太擠），就用最好的
        node.x = bestPoint.x;
        node.y = bestPoint.y;
      }

      // 如果是首都，記錄下來
      if (node.nodeLevel === NodeLevel.CAPITAL && node.ownerFactionId) {
        capitalPositions[node.ownerFactionId] = { x: node.x, y: node.y };
      }
    }
  }
}
