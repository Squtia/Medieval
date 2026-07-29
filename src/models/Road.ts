export interface RoadNetworkData {
  roads: RoadConnection[];
  projects: RoadConstructionProject[];
  nextRoadId: number;
}

export interface RoadConnection {
  id: string;
  originNodeId: string;
  targetNodeId: string;
  lengthPixels: number;
  completedDay: number;
}

export interface RoadConstructionProject {
  id: string;
  originNodeId: string;
  targetNodeId: string;
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
}
