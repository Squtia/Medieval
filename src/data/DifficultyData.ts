import { DifficultyConfig, GameDifficulty } from '../models/WorldGeneration';
import { NobleTitle, NodeLevel } from '../models/types';

export const DIFFICULTY_CONFIGS: Record<GameDifficulty, DifficultyConfig> = {
  [GameDifficulty.EASY]: {
    difficulty: GameDifficulty.EASY,
    label: '簡單',
    color: '#10b981',
    description: '以首都規模起步，資金與人口充裕，適合熟悉經營與探索系統。',
    baseNodeLevels: [NodeLevel.CAPITAL],
    startingTitle: NobleTitle.BARON,
    startingResources: {
      gold: 4000,
      population: 80,
      food: 1000,
      wood: 200,
      stone: 100,
      iron: 20
    }
  },
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
    description: '從村莊規模起步，初始資源極其匯乏，維持費與敵人較強，生存壓力巨大。',
    baseNodeLevels: [NodeLevel.VILLAGE],
    startingTitle: NobleTitle.COMMONER,
    startingResources: {
      gold: 500,
      population: 2,
      food: 100,
      wood: 20,
      stone: 10,
      iron: 0
    }
  },
  [GameDifficulty.EXTREME]: {
    difficulty: GameDifficulty.EXTREME,
    label: '極難',
    color: '#ef4444',
    description: '從荒野立足，生產與探索收益最低，敵襲頻繁且敵人最強。',
    baseNodeLevels: [NodeLevel.WILDERNESS],
    startingTitle: NobleTitle.COMMONER,
    startingResources: {
      gold: 200,
      population: 1,
      food: 40,
      wood: 5,
      stone: 0,
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
