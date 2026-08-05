import { MapNode } from '../../models/types';

export class MapUtils {
  public static getDistance(nodeA: MapNode, nodeB: MapNode): number {
    const dx = nodeA.x - nodeB.x;
    const dy = nodeA.y - nodeB.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
