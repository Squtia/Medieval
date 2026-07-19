export enum GameEventType {
  DAY_PASSED = 'DAY_PASSED',
  HERO_DIED = 'HERO_DIED',
  NODE_EXPLORED = 'NODE_EXPLORED',
  COMBAT_REQUESTED = 'COMBAT_REQUESTED',
  COMBAT_FINISHED = 'COMBAT_FINISHED',
  THREAT_ARRIVED = 'THREAT_ARRIVED',
  RESOURCE_CHANGED = 'RESOURCE_CHANGED',
  WORKER_ASSIGNED = 'WORKER_ASSIGNED',
  POPULATION_STARVED = 'POPULATION_STARVED',
}

export interface GameEventPayloads {
  [GameEventType.DAY_PASSED]: { daysPassed: number; currentTimestamp: number };
  [GameEventType.HERO_DIED]: { heroId: string; reason: string };
  [GameEventType.NODE_EXPLORED]: { nodeId: string; explorerId: string };
  [GameEventType.COMBAT_REQUESTED]: { attackerIds: string[]; targetId: string; taskType?: string; taskDifficulty?: number; enemyFeature?: string };
  [GameEventType.COMBAT_FINISHED]: { isVictory: boolean; participants: string[]; lootValue: number; battleLog: string; report?: import('../models/Combat').CombatReport };
  [GameEventType.THREAT_ARRIVED]: { threatName: string; severity: number };
  [GameEventType.RESOURCE_CHANGED]: { resourceType: string; amount: number; currentTotal: number };
  [GameEventType.WORKER_ASSIGNED]: { job: string; currentCount: number; unassignedCount: number };
  [GameEventType.POPULATION_STARVED]: { starvedAmount: number; currentPopulation: number };
}

export interface GameEvent<T extends GameEventType = GameEventType> {
  type: T;
  payload: GameEventPayloads[T];
}
