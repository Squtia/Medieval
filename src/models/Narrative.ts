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
  waves?: SubjugationWave[];
  rewards?: {
    gold?: number;
    exp?: number;
    prestige?: number;
    items?: { id: string; amount: number }[];
  };
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
  defeatNodeId?: string;
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
  | { type: 'SUBJUGATION_COUNT_AT_LEAST'; value: number };

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
  | { type: 'SCHEDULE_NODE'; nodeId: string; delayDays: number }
  | { type: 'UNLOCK_MAP_NODE'; nodeId: string }
  | { type: 'CREATE_SUBJUGATION_NODE'; definition: NarrativeSubjugationDefinition };

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
