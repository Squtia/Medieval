import { ElementType, FormationRow, MonsterProfile } from './types';

export type NarrativeChannel =
  | 'BOUNTY_BOARD'
  | 'TAVERN_RUMOR'
  | 'TERRITORY_EVENT'
  | 'STREET_EVENT'
  | 'TODO_LIST'
  | 'EXPLORATION'
  | 'SUBJUGATION'
  | 'SUBJUGATION_JOURNEY'
  | 'STORY_NODE';

export interface NarrativeDialoguePage {
  speakerType: 'NPC' | 'PLAYER_GUARDIAN';
  speakerName?: string;
  speakerTitle?: string;
  speakerAvatar?: string; // 如 "npc:npc_0" 或自訂圖標
  text: string;
}

export interface SubjugationWaveMonster {
  monsterId: string;
  count?: number;
  powerTier?: number;
  profile?: MonsterProfile;
  skills?: string[];
  formationRow?: FormationRow;
  gridR?: number; // 0: 前排 (迎敵第一線), 1: 中排, 2: 後排
  gridC?: number; // 0: 上路, 1: 中路, 2: 下路
  slotId?: string; // e.g. "0_0", "1_1"
  affix?: string;
  element?: ElementType;
}

export interface SubjugationWave {
  name?: string;
  monsters: SubjugationWaveMonster[];
}

export interface SubjugationTemplate {
  id: string;
  name: string;
  description: string;
  terrain: 'PLAINS' | 'FOREST' | 'SNOW_MOUNTAIN' | 'VOLCANO' | 'DESERT' | 'CAVE' | 'RUINS' | 'WILDERNESS';
  icon?: string;
  difficulty: number;
  requiresScouting?: boolean;
  removeOnVictory?: boolean;
  isWorldSecret?: boolean;
  fogRumor?: string;
  revealRumor?: string;
  allowTroops?: boolean;
  worldGenMode?: 'PERMANENT_VISIBLE' | 'WORLD_SECRET' | 'STORY_ONLY';
  factionId?: string;
  producedGoods?: string[];
  demandedGoods?: string[];
  nodeLevel?: import('./types').NodeLevel;
  waves?: SubjugationWave[];
  enemyLegion?: {
    enabled?: boolean;
    infantry?: number;
    archer?: number;
    cavalry?: number;
  };
  rewards?: {
    gold?: number;
    exp?: number;
    prestige?: number;
    items?: { id: string; amount: number }[];
  };
}

export interface SurvivingMonsterState {
  monsterId: string;
  currentHp: number;
  maxHp: number;
  isDead: boolean;
  gridR?: number;
  gridC?: number;
  slotId?: string;
  powerTier?: number;
  profile?: MonsterProfile;
  skills?: string[];
  affix?: string;
  element?: ElementType;
}

export interface PendingRaidState {
  id: string;
  storyId: string;
  raidName: string;
  isSiege: boolean;
  warningDaysTotal: number;
  warningDaysLeft: number;
  effect: Extract<NarrativeEffect, { type: 'TRIGGER_RAID' }>;
  survivingWaves?: SurvivingMonsterState[][];
  survivingEnemyLegion?: {
    infantry: number;
    archer: number;
    cavalry: number;
  };
  isFieldInterceptionAttempted?: boolean;
}

export interface NarrativeSubjugationDefinition {
  nodeId: string;
  templateId?: string;
  name: string;
  description: string;
  placement: 'NEAR_PLAYER' | 'NEAR_NODE' | 'FIXED';
  anchorNodeId?: string;
  radius?: number;
  x?: number;
  y?: number;
  terrain: 'PLAINS' | 'FOREST' | 'SNOW_MOUNTAIN' | 'VOLCANO' | 'DESERT' | 'CAVE' | 'RUINS' | 'WILDERNESS';
  difficulty: number;
  enemyFeature?: 'BALANCED' | 'HIGH_DEF' | 'HIGH_EVADE';
  monsterId?: string;
  requiresScouting: boolean;
  removeOnVictory: boolean;
  journeyNodeIds: string[];
  victoryNodeId?: string;
  victoryDelayDays?: number;
  defeatNodeId?: string;
  defeatDelayDays?: number;
}

export type NarrativeCondition =
  | { type: 'DAY_AT_LEAST'; value: number }
  | { type: 'TAVERN_LEVEL_AT_LEAST'; value: number }
  | { type: 'PRESTIGE_AT_LEAST'; value: number }
  | { type: 'GOLD_AT_LEAST'; value: number }
  | { type: 'FACTION_FAVOR_AT_LEAST'; factionId: string; value: number }
  | { type: 'FACTION_FAVOR_AT_MOST'; factionId: string; value: number }
  | { type: 'FACT_EXISTS'; fact: string }
  | { type: 'FACT_MISSING'; fact: string }
  | { type: 'DAYS_SINCE_FACT'; fact: string; value: number }
  | { type: 'NODE_EXPLORED'; nodeId: string }
  | { type: 'SUBJUGATION_COUNT_AT_LEAST'; value: number }
  | { type: 'NODE_OWNER_IS'; nodeId: string; factionId: string }
  | { type: 'FACTION_AT_WAR'; factionId: string }
  | { type: 'FACTION_STARVING'; factionId: string }
  | { type: 'HERO_EXISTS'; heroIds: string[]; matchMode?: 'ANY' | 'ALL' }
  | { type: 'HERO_MISSING'; heroIds: string[]; matchMode?: 'ANY' | 'ALL' };

export type NarrativeEquipmentSlot = 'ANY' | 'WEAPON' | 'ARMOR' | 'ACCESSORY';
export type NarrativeEquipmentTier = 'ANY' | 1 | 2 | 3 | 4;

export type NarrativeEffect =
  | { type: 'SET_FACT'; fact: string; value?: string | number | boolean }
  | { type: 'ADD_GOLD'; value: number }
  | { type: 'ADD_PRESTIGE'; value: number }
  | { type: 'ADD_RESTED_EXP'; value: number }
  | { type: 'CHANGE_FACTION_FAVOR'; factionId: string; value: number }
  | { type: 'GRANT_MATERIAL'; itemId: string; quantity: number; mode?: 'FIXED' | 'RANDOM' }
  | { type: 'GRANT_TRADE_GOOD'; itemId: string; quantity: number; mode?: 'FIXED' | 'RANDOM' }
  | { type: 'GRANT_EQUIPMENT'; templateId?: string; mode?: 'FIXED' | 'RANDOM'; slot?: NarrativeEquipmentSlot; tier?: NarrativeEquipmentTier; quantity: number }
  | { type: 'GRANT_HERO'; heroId: string }
  | { type: 'SCHEDULE_NODE'; nodeId: string; delayDays: number }
  | { type: 'UNLOCK_MAP_NODE'; nodeId: string }
  | { type: 'REMOVE_MAP_NODE'; nodeId: string }
  | { type: 'CREATE_SUBJUGATION_NODE'; definition: NarrativeSubjugationDefinition }
  | { type: 'REDUCE_POPULATION_PERCENT'; minPercent: number; maxPercent: number }
  | { type: 'REDUCE_RESOURCE_PERCENT'; resource: 'GOLD' | 'FOOD' | 'WOOD' | 'STONE' | 'IRON' | 'ALL'; minPercent: number; maxPercent: number }
  | { type: 'REDUCE_PRESTIGE_PERCENT'; minPercent: number; maxPercent: number }
  | { type: 'REDUCE_BUILDING_LEVEL'; buildingId: string; levels?: number }
  | {
      type: 'TRIGGER_RAID';
      raidName: string;
      isSiege?: boolean; // 是否為正規攻城戰 (true=城牆/箭塔/兵種支援, false=街巷/室內遭遇防衛戰)
      threatPower?: number;
      warningDays?: number;
      waves?: SiegeWaveConfig[];
      successNodeId?: string;
      failNodeId?: string;
    };

export interface SiegeWaveConfig {
  waveIndex: number;
  templateId: string;
  customName?: string;
}

export interface NarrativeChoice {
  id: string;
  text: string;
  resultText?: string;
  effects: NarrativeEffect[];
}

export interface NarrativeNode {
  id: string;
  title: string;
  description: string;
  channel: NarrativeChannel;
  conditions: NarrativeCondition[];
  choices: NarrativeChoice[];
  completionEffects: NarrativeEffect[];
  targetNodeId?: string;
  repeatable?: boolean;
  cooldownDays?: number;
  npcAvatar?: string;
  npcName?: string;
  dialoguePages?: NarrativeDialoguePage[];
  bounty?: {
    duration: number;
    expireDays: number;
    gold: number;
    exp: number;
    type?: 'NORMAL' | 'BANDIT';
    items?: { id: string; amount: number }[];
  };
}

export interface NarrativeStory {
  id: string;
  title: string;
  summary: string;
  version: number;
  enabled: boolean;
  nodes: NarrativeNode[];
}

export interface NarrativeFactValue {
  value: string | number | boolean;
  day: number;
}

export interface NarrativeRuntimeState {
  facts: Record<string, NarrativeFactValue>;
  completedNodeIds: string[];
  presentedNodeIds: string[];
  scheduledNodes: Record<string, number>;
  exploredNodeIds: string[];
  nodeLastCompletedDay?: Record<string, number>;
}

export function createEmptyNarrativeState(): NarrativeRuntimeState {
  return {
    facts: {},
    completedNodeIds: [],
    presentedNodeIds: [],
    scheduledNodes: {},
    exploredNodeIds: [],
    nodeLastCompletedDay: {}
  };
}
