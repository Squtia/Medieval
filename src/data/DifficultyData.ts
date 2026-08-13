import { DifficultyConfig, GameDifficulty } from '../models/WorldGeneration';
import { NobleTitle, NodeLevel } from '../models/types';

export const DIFFICULTY_CONFIGS: Record<GameDifficulty, DifficultyConfig> = {
  [GameDifficulty.NORMAL]: {
    difficulty: GameDifficulty.NORMAL,
    label: '普通',
    color: '#3b82f6',
    description: '從荒野白手起家，資源平衡，保留標準的發展壓力。',
    baseNodeLevels: [NodeLevel.WILDERNESS],
    startingTitle: NobleTitle.COMMONER,
    startingResources: {
      gold: 1500,
      population: 10,
      food: 500,
      wood: 100,
      stone: 50,
      iron: 10
    }
  },
  [GameDifficulty.HARD]: {
    difficulty: GameDifficulty.HARD,
    label: '困難',
    color: '#f59e0b',
    description: '從荒野白手起家，初始資源極其匯乏，維持費與斕人較強，生存壓力巨大。',
    baseNodeLevels: [NodeLevel.WILDERNESS],
    startingTitle: NobleTitle.COMMONER,
    startingResources: {
      gold: 500,
      population: 2,
      food: 100,
      wood: 20,
      stone: 10,
      iron: 0
    }
  }
};

export const DIFFICULTY_ORDER: readonly GameDifficulty[] = [
  GameDifficulty.NORMAL,
  GameDifficulty.HARD
];

export function getDifficultyConfig(difficulty: GameDifficulty): DifficultyConfig {
  return DIFFICULTY_CONFIGS[difficulty];
}
