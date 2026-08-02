export interface ExplorationMapData {
  width: number;
  height: number;
  cells: number[];
  expeditions?: ExplorationExpedition[];
  nextExpeditionId?: number;
}

export interface ExplorationExpedition {
  id: string;
  originNodeId: string;
  explorerId: string;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  totalDays: number;
  elapsedDays: number;
  visionRadius: number;
  status: 'ACTIVE' | 'COMPLETED';
  isExpedited?: boolean;
}

export interface ExplorationTargetCheck {
  valid: boolean;
  reason?: string;
  requiredDays?: number;
  goldCost?: number;
  foodCost?: number;
  isLongDistance?: boolean;
  expeditedDays?: number;
  expeditedGoldCost?: number;
  expeditedFoodCost?: number;
}

export interface ExplorationTargetPreview {
  width: number;
  height: number;
  cells: number[];
}
