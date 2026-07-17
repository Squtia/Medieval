import { TerrainType } from '../models/types';

export interface RegionBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

// 定義每種地形在地圖上的合法生成範圍 (百分比)
export const TERRAIN_BOUNDS: Record<TerrainType, RegionBounds[]> = {
  [TerrainType.SNOW_MOUNTAIN]: [
    { xMin: 35, xMax: 60, yMin: 8, yMax: 25 } // 北方雪山
  ],
  [TerrainType.FOREST]: [
    { xMin: 65, xMax: 85, yMin: 30, yMax: 50 }, // 東方大森林
    { xMin: 50, xMax: 65, yMin: 35, yMax: 45 }  // 中央偏東的森林邊緣
  ],
  [TerrainType.VOLCANO]: [
    { xMin: 40, xMax: 58, yMin: 58, yMax: 78 } // 南方火山區
  ],
  [TerrainType.DESERT]: [
    { xMin: 62, xMax: 85, yMin: 68, yMax: 85 } // 東南方沙漠
  ],
  [TerrainType.PLAINS]: [
    { xMin: 18, xMax: 40, yMin: 35, yMax: 65 }, // 西方廣闊平原
    { xMin: 40, xMax: 55, yMin: 38, yMax: 55 }  // 中央王畿平原
  ]
};
