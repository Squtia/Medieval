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
}

export interface ExplorationTargetCheck {
  valid: boolean;
  reason?: string;
  requiredDays?: number;
}

export interface ExplorationTargetPreview {
  width: number;
  height: number;
  cells: number[];
}
