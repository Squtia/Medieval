import { GameDifficulty } from '../models/WorldGeneration';
import { MapNode, NodeLevel } from '../models/types';

export const PROSPERITY_THRESHOLDS: Readonly<Record<NodeLevel, number>> = {
  [NodeLevel.WILDERNESS]: 0,
  [NodeLevel.CAMP]: 40,
  [NodeLevel.VILLAGE]: 200,
  [NodeLevel.TOWN]: 1000,
  [NodeLevel.CAPITAL]: 5000
};

export interface DifficultyModifiers {
  enemyStrength: number;
  production: number;
  upkeep: number;
  explorationReward: number;
  refugeeChance: number;
  threatInterval: number;
}

export const DIFFICULTY_MODIFIERS: Readonly<Record<GameDifficulty, DifficultyModifiers>> = {
  [GameDifficulty.EASY]: {
    enemyStrength: 0.8,
    production: 1.2,
    upkeep: 0.8,
    explorationReward: 1.15,
    refugeeChance: 1.15,
    threatInterval: 1.25
  },
  [GameDifficulty.NORMAL]: {
    enemyStrength: 1,
    production: 1,
    upkeep: 1,
    explorationReward: 1,
    refugeeChance: 1,
    threatInterval: 1
  },
  [GameDifficulty.HARD]: {
    enemyStrength: 1.15,
    production: 0.9,
    upkeep: 1.15,
    explorationReward: 0.85,
    refugeeChance: 0.85,
    threatInterval: 0.85
  },
  [GameDifficulty.EXTREME]: {
    enemyStrength: 1.3,
    production: 0.8,
    upkeep: 1.3,
    explorationReward: 0.7,
    refugeeChance: 0.7,
    threatInterval: 0.7
  }
};

export function getDifficultyModifiers(difficulty?: GameDifficulty | null): DifficultyModifiers {
  return DIFFICULTY_MODIFIERS[difficulty ?? GameDifficulty.NORMAL];
}

export function calculateNodeLevel(
  node: Pick<MapNode, 'prosperity' | 'minimumNodeLevel'>,
  hasVassal: boolean
): NodeLevel {
  let level = NodeLevel.WILDERNESS;
  if (node.prosperity >= PROSPERITY_THRESHOLDS[NodeLevel.CAPITAL] && hasVassal) {
    level = NodeLevel.CAPITAL;
  } else if (node.prosperity >= PROSPERITY_THRESHOLDS[NodeLevel.TOWN]) {
    level = NodeLevel.TOWN;
  } else if (node.prosperity >= PROSPERITY_THRESHOLDS[NodeLevel.VILLAGE]) {
    level = NodeLevel.VILLAGE;
  } else if (node.prosperity >= PROSPERITY_THRESHOLDS[NodeLevel.CAMP]) {
    level = NodeLevel.CAMP;
  }

  return Math.max(level, node.minimumNodeLevel ?? NodeLevel.WILDERNESS) as NodeLevel;
}

export function getMonthlyProsperityGain(
  productiveWorkers: number,
  buildingProsperityBonus: number
): number {
  const workerContribution = Math.min(
    80,
    Math.floor(Math.pow(Math.max(0, productiveWorkers), 0.75) * 3)
  );
  const buildingContribution = Math.min(40, Math.floor(Math.max(0, buildingProsperityBonus) / 5));
  return 8 + workerContribution + buildingContribution;
}

export function getCombatPrestigeReward(
  difficulty: number,
  isWar: boolean,
  nodeLevel: NodeLevel
): number {
  const baseReward = Math.max(15, Math.round(difficulty * 1.25));
  if (!isWar) return baseReward;

  const conquestBonus: Record<NodeLevel, number> = {
    [NodeLevel.WILDERNESS]: 100,
    [NodeLevel.CAMP]: 150,
    [NodeLevel.VILLAGE]: 250,
    [NodeLevel.TOWN]: 600,
    [NodeLevel.CAPITAL]: 1500
  };
  return baseReward + conquestBonus[nodeLevel];
}
