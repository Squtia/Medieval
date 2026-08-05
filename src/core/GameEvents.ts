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
  THREAT_WARNING = 'THREAT_WARNING',
  GAME_EVENT_TRIGGERED = 'GAME_EVENT_TRIGGERED',
  MISSIONS_CHANGED = 'MISSIONS_CHANGED',
  DIPLOMACY_EVENT = 'DIPLOMACY_EVENT',
  SIEGE_STARTED = 'SIEGE_STARTED',
  SIEGE_UPDATED = 'SIEGE_UPDATED',
  SIEGE_RESOLVED = 'SIEGE_RESOLVED',
  FACTION_DEMAND = 'FACTION_DEMAND',
  ROAD_CHANGED = 'ROAD_CHANGED',
  PROSPERITY_CHANGED = 'PROSPERITY_CHANGED', // C1: 月底繁榮度結算通知
  POPULATION_CHANGED = 'POPULATION_CHANGED',
}

export interface GameEventPayloads {
  [GameEventType.DAY_PASSED]: { daysPassed: number; currentTimestamp: number };
  [GameEventType.HERO_DIED]: { heroId: string; reason: string };
  [GameEventType.NODE_EXPLORED]: { nodeId: string; explorerId: string };
  [GameEventType.COMBAT_REQUESTED]: { attackerIds: string[]; targetId: string; taskType?: string; taskDifficulty?: number; enemyFeature?: string };
  [GameEventType.COMBAT_FINISHED]: { isVictory: boolean; participants: string[]; lootValue: number; battleLog: string; xpReward?: number; report?: import('../models/Combat').CombatReport };
  [GameEventType.THREAT_ARRIVED]: { threatName: string; severity: number };
  [GameEventType.RESOURCE_CHANGED]: { resourceType: string; amount: number; currentTotal: number };
  [GameEventType.WORKER_ASSIGNED]: { job: string; currentCount: number; unassignedCount: number };
  [GameEventType.POPULATION_STARVED]: { starvedAmount: number; currentPopulation: number };
  [GameEventType.THREAT_WARNING]: { threatName: string; daysRemaining: number; severity: number };
  [GameEventType.GAME_EVENT_TRIGGERED]: { eventId: string; isExploration?: boolean };
  [GameEventType.MISSIONS_CHANGED]: {
    reason: 'DISPATCHED' | 'PROGRESSED' | 'COMPLETED' | 'LOADED';
    missionType?: import('../models/DispatchTask').TaskType;
  };
  [GameEventType.DIPLOMACY_EVENT]: { actionType: string; targetFactionId: string; resultMsg: string; newRelation?: number };
  [GameEventType.SIEGE_STARTED]: { targetNodeId: string; attackerFactionId: string };
  [GameEventType.SIEGE_UPDATED]: { targetNodeId: string; remainingDays: number };
  [GameEventType.SIEGE_RESOLVED]: { targetNodeId: string; winnerId: string; isCityFallen: boolean };
  [GameEventType.FACTION_DEMAND]: { factionId: string; demandType: string; amount: number; message: string };
  [GameEventType.ROAD_CHANGED]: {
    reason: 'STARTED' | 'PROGRESSED' | 'COMPLETED' | 'LOADED';
    roadId: string;
    targetNodeId: string;
  };
  [GameEventType.PROSPERITY_CHANGED]: { delta: number; current: number; nextThreshold: number; levelName: string };
  [GameEventType.POPULATION_CHANGED]: { delta: number; currentPopulation: number; reason: string };
}

export interface GameEvent<T extends GameEventType = GameEventType> {
  type: T;
  payload: GameEventPayloads[T];
}
