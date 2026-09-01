import type { NarrativeCondition, NarrativeEffect, NarrativeNode, NarrativeStory } from '../../models/Narrative';

export type GraphEdgeType = 'fact' | 'schedule' | 'victory' | 'defeat' | 'journey';

export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
  label?: string;
}

export interface FactRegistryEntry {
  fact: string;
  writers: { storyId: string; storyTitle: string; nodeId: string; nodeTitle: string }[];
  readers: { storyId: string; storyTitle: string; nodeId: string; nodeTitle: string; conditionType: string }[];
  warnings: ('UNUSED_WRITE' | 'MISSING_WRITER' | 'CROSS_STORY' | 'DUPLICATE_WRITER')[];
}

export const GRAPH_NODE_W = 210;
export const GRAPH_NODE_H = 96;
export const GRAPH_H_GAP = 264;
export const GRAPH_V_GAP = 128;
export const GRAPH_COLS = 4;
export const GRAPH_POS_KEY = 'MEDIEVAL_STORY_GRAPH_POS';
export const DRAFT_STORAGE_KEY = 'MEDIEVAL_STORY_STUDIO_DRAFT';
export const TEST_STORAGE_KEY = 'MEDIEVAL_STORY_TEST_PAYLOAD';
export const SVG_NS = 'http://www.w3.org/2000/svg';

export const CONDITION_LABELS: Record<NarrativeCondition['type'], string> = {
  DAY_AT_LEAST: '最早遊戲日',
  TAVERN_LEVEL_AT_LEAST: '最低酒館等級',
  PRESTIGE_AT_LEAST: '最低聲望',
  GOLD_AT_LEAST: '最低金幣',
  FACTION_FAVOR_AT_LEAST: '派系好感度 ≥',
  FACTION_FAVOR_AT_MOST: '派系好感度 ≤',
  FACT_EXISTS: '需要線索',
  FACT_MISSING: '必須尚無線索',
  DAYS_SINCE_FACT: '取得線索後等待',
  NODE_EXPLORED: '需要已發現據點',
  SUBJUGATION_COUNT_AT_LEAST: '動態討伐累積數',
  NODE_OWNER_IS: '🏰 沙盒：據點控制權為',
  FACTION_AT_WAR: '⚔️ 沙盒：派系處於交戰狀態',
  FACTION_STARVING: '🌾 沙盒：派系陷入糧荒',
  HERO_EXISTS: '👤 英雄：已擁有指定英雄 (HERO_EXISTS)',
  HERO_MISSING: '👤 英雄：尚未擁有指定英雄 (HERO_MISSING)'
};

export const EFFECT_LABELS: Record<NarrativeEffect['type'], string> = {
  SET_FACT: '線索：新增線索 (SET_FACT)',
  ADD_GOLD: '資源：金幣變化 (ADD_GOLD)',
  ADD_PRESTIGE: '資源：聲望變化 (ADD_PRESTIGE)',
  ADD_RESTED_EXP: '資源：經驗池獎勵 (ADD_RESTED_EXP)',
  CHANGE_FACTION_FAVOR: '外交：派系好感度 (CHANGE_FACTION_FAVOR)',
  GRANT_HERO: '👥 招募：贈送/加入英雄 (GRANT_HERO)',
  GRANT_EQUIPMENT: '物品：裝備獎勵 (GRANT_EQUIPMENT)',
  GRANT_MATERIAL: '物品：素材獎勵 (GRANT_MATERIAL)',
  GRANT_TRADE_GOOD: '物品：貿易特產 (GRANT_TRADE_GOOD)',
  SCHEDULE_NODE: '流程：延遲排程節點 (SCHEDULE_NODE)',
  PRESENT_NODE: '流程：立即前往下一節點 (PRESENT_NODE)',
  UNLOCK_MAP_NODE: '地圖：解鎖預設地圖據點 (UNLOCK_MAP_NODE)',
  REMOVE_MAP_NODE: '地圖：移除／銷毀地圖據點 (REMOVE_MAP_NODE)',
  CREATE_SUBJUGATION_NODE: '討伐：創造故事討伐據點 (CREATE_SUBJUGATION_NODE)',
  REDUCE_POPULATION_PERCENT: '懲罰：隨機扣減人口百分比 (?%~?%)',
  REDUCE_RESOURCE_PERCENT: '懲罰：扣減資源庫存百分比 (?%~?%)',
  REDUCE_PRESTIGE_PERCENT: '懲罰：扣減聲望百分比 (?%~?%)',
  REDUCE_BUILDING_LEVEL: '懲罰：建築/設施受損降級 (REDUCE_BUILDING_LEVEL)',
  TRIGGER_RAID: '戰役：觸發領地攻城/襲擊戰役 (TRIGGER_RAID)'
};

export function channelName(channel: NarrativeNode['channel']): string {
  return ({
    BOUNTY_BOARD: '懸賞板',
    STREET_EVENT: '街道訪客',
    TAVERN_RUMOR: '酒館傳聞',
    TERRITORY_EVENT: '領地事件',
    TODO_LIST: '待辦清單',
    EXPLORATION: '發現據點時',
    SUBJUGATION: '討伐後',
    SUBJUGATION_JOURNEY: '討伐途中',
    STORY_NODE: '解鎖預設據點'
  } as const)[channel] ?? channel;
}

export function escapeHtml(text: string): string {
  const span = document.createElement('span');
  span.textContent = text || '';
  return span.innerHTML;
}

export function safeId(text: string): string {
  return text.trim().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

export function uniqueId(prefix: string, used: string[]): string {
  let id = prefix;
  let index = 2;
  while (used.includes(id)) id = `${prefix}_${index++}`;
  return id;
}

export function makeNode(id: string): NarrativeNode {
  return {
    id,
    title: '新故事節點',
    description: '',
    channel: 'TERRITORY_EVENT',
    conditions: [],
    choices: [],
    completionEffects: []
  };
}

export function defaultCondition(type: NarrativeCondition['type'] = 'FACT_EXISTS'): NarrativeCondition {
  switch (type) {
    case 'DAY_AT_LEAST': case 'TAVERN_LEVEL_AT_LEAST': case 'PRESTIGE_AT_LEAST': return { type, value: 1 };
    case 'GOLD_AT_LEAST': return { type, value: 100 };
    case 'FACTION_FAVOR_AT_LEAST': case 'FACTION_FAVOR_AT_MOST': return { type, factionId: 'f_vormund', value: 30 };
    case 'FACT_EXISTS': case 'FACT_MISSING': return { type, fact: 'new_fact' };
    case 'DAYS_SINCE_FACT': return { type, fact: 'new_fact', value: 1 };
    case 'NODE_EXPLORED': return { type, nodeId: '' };
    case 'SUBJUGATION_COUNT_AT_LEAST': return { type, value: 1 };
    case 'NODE_OWNER_IS': return { type, nodeId: 'n_royal_1', factionId: 'f_lothgar' };
    case 'FACTION_AT_WAR': return { type, factionId: 'f_vormund' };
    case 'FACTION_STARVING': return { type, factionId: 'f_vormund' };
    case 'HERO_EXISTS': case 'HERO_MISSING': return { type, heroIds: ['reyn'], matchMode: 'ANY' };
  }
}

export function defaultEffect(type: NarrativeEffect['type'] = 'SET_FACT'): NarrativeEffect {
  switch (type) {
    case 'SET_FACT': return { type, fact: 'new_fact', value: true };
    case 'ADD_GOLD': return { type, value: 100 };
    case 'ADD_PRESTIGE': return { type, value: 10 };
    case 'ADD_RESTED_EXP': return { type, value: 50 };
    case 'CHANGE_FACTION_FAVOR': return { type, factionId: 'f_vormund', value: 10 };
    case 'GRANT_HERO': return { type, heroId: 'reyn' };
    case 'GRANT_MATERIAL': return { type, itemId: 'mat_iron_ingot', quantity: 1, mode: 'FIXED' };
    case 'GRANT_TRADE_GOOD': return { type, itemId: 'tg_spice', quantity: 1, mode: 'FIXED' };
    case 'GRANT_EQUIPMENT': return { type, templateId: 'wpn_iron_greatsword', mode: 'FIXED', slot: 'ANY', tier: 'ANY', quantity: 1 };
    case 'SCHEDULE_NODE': return { type, nodeId: '', delayDays: 1 };
    case 'PRESENT_NODE': return { type, nodeId: '' };
    case 'UNLOCK_MAP_NODE': return { type, nodeId: '' };
    case 'REMOVE_MAP_NODE': return { type, nodeId: '' };
    case 'REDUCE_POPULATION_PERCENT': return { type, minPercent: 10, maxPercent: 20 };
    case 'REDUCE_RESOURCE_PERCENT': return { type, resource: 'GOLD', minPercent: 15, maxPercent: 30 };
    case 'REDUCE_PRESTIGE_PERCENT': return { type, minPercent: 10, maxPercent: 20 };
    case 'REDUCE_BUILDING_LEVEL': return { type, buildingId: 'defense', levels: 1 };
    case 'TRIGGER_RAID': return {
      type,
      raidName: '黑狼軍團圍城戰',
      warningDays: 3,
      waves: [
        { waveIndex: 1, templateId: 'bandit_camp', customName: '敵方先鋒部隊' }
      ],
      successNodeId: '',
      failNodeId: ''
    };
    case 'CREATE_SUBJUGATION_NODE': return {
      type,
      definition: {
        nodeId: 'story_encounter',
        name: '新的討伐據點',
        description: '故事所揭露的危險據點。',
        placement: 'NEAR_PLAYER',
        radius: 8,
        terrain: 'RUINS',
        difficulty: 2,
        enemyFeature: 'BALANCED',
        requiresScouting: true,
        removeOnVictory: true,
        journeyNodeIds: [],
        victoryDelayDays: 0,
        defeatDelayDays: 0
      }
    };
  }
}
