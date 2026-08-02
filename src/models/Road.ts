export interface RoadNetworkData {
  roads: RoadConnection[];
  projects: RoadConstructionProject[];
  nextRoadId: number;
}

export interface RoadConnection {
  id: string;
  originNodeId: string; // 最終邏輯源頭（通常為玩家主城）
  targetNodeId: string; // 目標據點
  startNodeId?: string; // 實體線段起始據點（若從現有據點延伸）
  parentRoadId?: string; // 實體線段分岔的父道路 ID（若從現有道路中途分岔）
  branchRatio?: number; // 分岔點在父道路上的比例 (0~1)
  controlOffsetRatio?: number; // 貝茲曲線垂直彎曲比例，確保重繪時曲線形狀固定
  lengthPixels: number; // 此線段之實體長度（像素）
  completedDay: number;
}

export interface RoadConstructionProject {
  id: string;
  originNodeId: string;
  targetNodeId: string;
  startNodeId?: string;
  parentRoadId?: string;
  branchRatio?: number;
  controlOffsetRatio?: number;
  lengthPixels: number;
  totalDays: number;
  elapsedDays: number;
  status: 'ACTIVE' | 'COMPLETED';
}

export interface RoadTargetCheck {
  valid: boolean;
  reason?: string;
  requiredDays?: number;
  lengthPixels?: number;
  startNodeId?: string;
  parentRoadId?: string;
  branchRatio?: number;
  controlOffsetRatio?: number;
}
