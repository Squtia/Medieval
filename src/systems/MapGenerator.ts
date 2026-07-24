import { MapNode, NodeLevel } from '../models/types';
import { MapMaskData } from '../data/MapMaskData';
import { Random } from '../core/Random';

export class MapGenerator {
  /**
   * 為所有沒有座標（或座標為 0,0）的節點動態分配位置
   */
  public static assignDynamicCoordinates(nodes: MapNode[]): void {
    const MIN_DISTANCE = 8; // 節點之間的最小距離百分比
    const MAX_ATTEMPTS = 500; // 因為全圖隨機，增加嘗試次數

    // 先將節點按照級別排序，確保首都先放置
    const sortedNodes = [...nodes].sort((a, b) => b.nodeLevel - a.nodeLevel);
    
    // 紀錄各家族的首都位置，用作群聚依據
    const capitalPositions: Record<string, { x: number; y: number }> = {};

    for (const node of sortedNodes) {
      if (node.x !== 0 && node.y !== 0) continue; // 已有座標則跳過

      let placed = false;
      let bestPoint = { x: 50, y: 50 };
      let maxDistSoFar = 0;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        let tx: number, ty: number;
        
        // 如果有首都，盡量靠近首都 (距離 5~20 內)
        if (node.nodeLevel !== NodeLevel.CAPITAL && node.ownerFactionId && capitalPositions[node.ownerFactionId]) {
           const cap = capitalPositions[node.ownerFactionId];
           const angle = Random.next() * Math.PI * 2;
           const dist = 5 + Random.next() * 15;
           tx = cap.x + Math.cos(angle) * dist;
           ty = cap.y + Math.sin(angle) * dist;
        } else {
           // 否則全圖隨機
           tx = Random.next() * 100;
           ty = Random.next() * 100;
        }

        tx = Math.max(0, Math.min(100, tx));
        ty = Math.max(0, Math.min(100, ty));

        // 核心遮罩檢測：檢查隨機點的地形是否與據點設定的地形一致
        const terrainAtPoint = MapMaskData.getTerrainAt(tx, ty);
        if (terrainAtPoint !== node.terrain) {
            continue; // 落在海域 (null) 或錯誤地形，重新骰一次
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
        // 確保這個「最不擠的」點依然是在合法地形上
        if (minDistToOthers > maxDistSoFar) {
          maxDistSoFar = minDistToOthers;
          bestPoint = { x: tx, y: ty };
        }
      }

      if (!placed) {
        // 如果 500 次嘗試都失敗（太擠），就用最好的
        node.x = bestPoint.x;
        node.y = bestPoint.y;
        console.warn(`Could not find perfect spot for ${node.name} (${node.terrain}), fallback to best distance.`);
      }

      // 如果是首都，記錄下來
      if (node.nodeLevel === NodeLevel.CAPITAL && node.ownerFactionId) {
        capitalPositions[node.ownerFactionId] = { x: node.x, y: node.y };
      }
    }
  }
}
