import { MapNode, NodeLevel, NobleTitle } from './types';

export enum GameDifficulty {
  NORMAL = 'NORMAL',
  HARD = 'HARD'
}

export interface StartingResources {
  gold: number;
  population: number;
  food: number;
  wood: number;
  stone: number;
  iron: number;
}

export interface DifficultyConfig {
  difficulty: GameDifficulty;
  label: string;
  color: string;
  description: string;
  baseNodeLevels: readonly NodeLevel[];
  startingTitle: NobleTitle;
  startingResources: StartingResources;
}

export interface WorldGenerationMeta {
  seed: string;
  generationVersion: number;
  difficulty: GameDifficulty;
}

export interface NewGameOptions {
  difficulty: GameDifficulty;
  seed: string;
}

export interface GeneratedWorld {
  nodes: MapNode[];
  playerBase: MapNode;
  meta: WorldGenerationMeta;
}
