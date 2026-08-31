import { Adventurer } from '../models/Adventurer';
import { Territory } from '../models/Territory';
import { DispatchSystem } from '../systems/DispatchSystem';
import { MapDynamicsSystem } from '../systems/MapDynamicsSystem';
import { Faction, MapNode, NodeLevel, TerrainType, NodeFeature, getTitleConfig, FormationPreset, ThreatType, Gender } from '../models/types';
import { DataStore } from '../systems/DataStore';
import { NameGenerator } from '../systems/NameGenerator';
import { INITIAL_FACTIONS } from '../data/FactionData';
import { INITIAL_MAP_NODES } from '../data/MapData';
import { TownManagementSystem } from '../systems/TownManagementSystem';
import { HeroSystem } from '../systems/HeroSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ThreatSystem } from '../systems/ThreatSystem';
import { MapGenerator } from '../systems/MapGenerator';
import { MarketSystem } from '../systems/MarketSystem';
import { EventBus } from './EventBus';
import { GameDifficulty, NewGameOptions, WorldGenerationMeta } from '../models/WorldGeneration';
import { getDifficultyConfig } from '../data/DifficultyData';
import { ExplorationSystem } from '../systems/ExplorationSystem';
import { RoadSystem } from '../systems/RoadSystem';
import { getDifficultyModifiers } from '../data/BalanceData';
import { createEmptyNarrativeState } from '../models/Narrative';

import { FactionManager } from '../systems/FactionManager';
import { FactionProfile, createDefaultFactionProfile } from '../models/FactionProfile';
import { FactionCampaign } from '../systems/faction/FactionCampaignSystem';

export const factions: Faction[] = INITIAL_FACTIONS;
export const mapNodes: MapNode[] = INITIAL_MAP_NODES;

export const GameState = {
  currentViewNode: null as MapNode | null,
  myTerritory: new Territory('流浪傭兵團', null),
  system: null as unknown as DispatchSystem,
  mapSystem: null as unknown as MapDynamicsSystem,
  adventurers: [] as Adventurer[],
  retiredAdventurers: [] as Adventurer[],
  playTime: 0,
  sessionStartTime: Date.now(),
  currentSaveSlot: null as number | null,
  currentDay: 1,
  currentMonth: 1,
  currentYear: 1,
  totalDays: 1,
  restedExpPool: 0,
  threat: {
    name: '凜冬寒流',
    type: ThreatType.NATURAL_DISASTER,
    severity: 5,
    daysRemaining: 10,
    warningIssued: false,
    prepared: false
  },
  lastDailySummary: null as null | {
    day: number;
    goldDelta: number;
    foodDelta: number;
    woodDelta: number;
    stoneDelta: number;
    ironDelta: number;
    populationDelta: number;
    missionsCompleted: number;
  },
  milestones: [] as string[],
  pendingMilestones: [] as string[],
  worldGeneration: null as WorldGenerationMeta | null,
  explorationSystem: null as unknown as ExplorationSystem,
  roadSystem: null as unknown as RoadSystem,
  unlockedFormations: ['DEFAULT'] as string[],
  formationPresets: [] as FormationPreset[],
  bounties: [] as any[],
  narrativeState: createEmptyNarrativeState(),
  factionProfiles: [] as FactionProfile[],
  campaigns: [] as FactionCampaign[]
};

export function initGameState(options: NewGameOptions = {
  difficulty: GameDifficulty.NORMAL,
  seed: 'bootstrap'
}) {
  (window as any).GameState = GameState;
  GameState.myTerritory = new Territory('流浪傭兵團', null);
  const difficultyConfig = getDifficultyConfig(options.difficulty);
  const startingResources = difficultyConfig.startingResources;
  GameState.myTerritory.title = difficultyConfig.startingTitle;
  GameState.myTerritory.prestige = getTitleConfig(difficultyConfig.startingTitle).reqPrestige;
  GameState.myTerritory.gold = startingResources.gold;
  GameState.myTerritory.food = startingResources.food;
  GameState.myTerritory.wood = startingResources.wood;
  GameState.myTerritory.stone = startingResources.stone;
  GameState.myTerritory.iron = startingResources.iron;
  GameState.myTerritory.workers = {
    UNASSIGNED: startingResources.population,
    FARMER: 0,
    HUNTER: 0,
    WOODCUTTER: 0,
    MINER: 0
  };
  GameState.adventurers = [];
  GameState.system = new DispatchSystem(GameState.myTerritory);

  const factionsCopy = JSON.parse(JSON.stringify(FactionManager.getAllFactions()));

  // 初始化完整 AI 勢力經濟與軍事檔案
  GameState.factionProfiles = factionsCopy.map((f: Faction) => createDefaultFactionProfile(f));
  GameState.campaigns = [];

  const allTemplates = DataStore.getSubjugationTemplates();
  const templateMap = new Map(allTemplates.map(t => [t.id, t]));

  mapNodes.forEach(node => {
    const tpl = templateMap.get(node.id) || allTemplates.find(t => t.name === node.name);
    if (tpl) {
      if (tpl.icon) node.customIcon = tpl.icon;
      if (tpl.allowTroops !== undefined) node.allowTroops = tpl.allowTroops;
      if (tpl.producedGoods) node.producedGoods = tpl.producedGoods;
      if (tpl.demandedGoods) node.demandedGoods = tpl.demandedGoods;
    }
  });

  const existingNodeIds = new Set(mapNodes.map(n => n.id));
  const existingNodeNames = new Set(mapNodes.map(n => n.name));

  const secretStrongholds: MapNode[] = allTemplates
    .filter(tpl => (tpl.worldGenMode === 'WORLD_SECRET' || (tpl.isWorldSecret && tpl.worldGenMode !== 'STORY_ONLY')) && !existingNodeIds.has(tpl.id) && !existingNodeNames.has(tpl.name))
    .map(tpl => ({
      id: `secret_${tpl.id}`,
      name: tpl.name,
      description: tpl.description || '',
      x: 0,
      y: 0,
      population: 0,
      prosperity: 0,
      nodeLevel: tpl.nodeLevel ?? NodeLevel.WILDERNESS,
      ownerFactionId: tpl.factionId || null,
      isPlayerBase: false,
      isDiscovered: false,
      terrain: (TerrainType as any)[tpl.terrain] || TerrainType.RUINS,
      feature: NodeFeature.SUBJUGATION,
      isHidden: true,
      isDynamic: true,
      allowTroops: tpl.allowTroops !== false,
      baseDifficulty: tpl.difficulty || 2,
      isScouted: !tpl.requiresScouting,
      customIcon: tpl.icon,
      fogRumor: tpl.fogRumor,
      revealRumor: tpl.revealRumor,
      producedGoods: tpl.producedGoods,
      demandedGoods: tpl.demandedGoods,
      narrativeSubjugation: {
        storyId: 'world_secret',
        sourceNodeId: tpl.id,
        templateId: tpl.id,
        journeyNodeIds: [],
        removeOnVictory: tpl.removeOnVictory !== false
      }
    } as unknown as MapNode));

  const customPermanentNodes: MapNode[] = allTemplates
    .filter(tpl => (tpl.worldGenMode === 'PERMANENT_VISIBLE' || (!tpl.worldGenMode && !tpl.isWorldSecret)) && !existingNodeIds.has(tpl.id) && !existingNodeNames.has(tpl.name))
    .map(tpl => ({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description || '',
      x: 0,
      y: 0,
      population: tpl.nodeLevel ? (tpl.nodeLevel * 500) : 0,
      prosperity: tpl.nodeLevel ? (tpl.nodeLevel * 100) : 0,
      nodeLevel: tpl.nodeLevel ?? NodeLevel.WILDERNESS,
      ownerFactionId: tpl.factionId || null,
      isPlayerBase: false,
      isDiscovered: false,
      terrain: (TerrainType as any)[tpl.terrain] || TerrainType.PLAINS,
      feature: (tpl.nodeLevel && tpl.nodeLevel > 0) ? NodeFeature.OCCUPIABLE : NodeFeature.SUBJUGATION,
      isHidden: false,
      isDynamic: false,
      allowTroops: tpl.allowTroops !== false,
      baseDifficulty: tpl.difficulty || 2,
      isScouted: !tpl.requiresScouting,
      customIcon: tpl.icon,
      producedGoods: tpl.producedGoods,
      demandedGoods: tpl.demandedGoods,
      narrativeSubjugation: {
        storyId: 'custom_stronghold',
        sourceNodeId: tpl.id,
        templateId: tpl.id,
        journeyNodeIds: [],
        removeOnVictory: tpl.removeOnVictory === true
      }
    } as unknown as MapNode));

  const allWorldNodes = [...mapNodes, ...customPermanentNodes, ...secretStrongholds];
  const generatedWorld = MapGenerator.generateWorld(
    allWorldNodes,
    options.seed,
    options.difficulty
  );
  GameState.myTerritory.currentCountryId = generatedWorld.playerBase.id;
  GameState.mapSystem = new MapDynamicsSystem(generatedWorld.nodes, factionsCopy);
  GameState.worldGeneration = generatedWorld.meta;
  GameState.explorationSystem = new ExplorationSystem();
  GameState.explorationSystem.revealCircle(generatedWorld.playerBase.x, generatedWorld.playerBase.y, 90);
  GameState.roadSystem = new RoadSystem();
  GameState.currentViewNode = null;
  GameState.playTime = 0;
  GameState.sessionStartTime = Date.now();
  GameState.currentSaveSlot = null;
  GameState.currentDay = 1;
  GameState.currentMonth = 1;
  GameState.currentYear = 1;
  GameState.totalDays = 1;
  GameState.restedExpPool = 0;
  GameState.threat = {
    name: '凜冬寒流',
    type: ThreatType.NATURAL_DISASTER,
    severity: 5,
    daysRemaining: Math.max(5, Math.round(10 * getDifficultyModifiers(options.difficulty).threatInterval)),
    warningIssued: false,
    prepared: false
  };
  GameState.lastDailySummary = null;
  GameState.milestones = [];
  GameState.pendingMilestones = [];
  GameState.unlockedFormations = ['DEFAULT'];
  GameState.formationPresets = [];
  GameState.bounties = [];
  GameState.narrativeState = createEmptyNarrativeState();

  EventBus.getInstance().clearAll();

  new TownManagementSystem();
  new HeroSystem();
  new CombatSystem();
  new ThreatSystem();

  const gender = Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE;
  const startingAdv = new Adventurer(
    'p1',
    NameGenerator.generateFullName(gender),
    DataStore.JobDB.WARRIOR,
    DataStore.TraitDB.GUARDIAN,
    'R',
    gender
  );
  startingAdv.locationNodeId = generatedWorld.playerBase.id;
  GameState.adventurers.push(startingAdv);

  const startWpn = DataStore.getEquipmentTemplate('wpn_heirloom_sword');
  if (startWpn) {
    const eq = {
      uuid: 'eq_start_01', id: startWpn.id, name: startWpn.name, slot: startWpn.slot, icon: startWpn.icon,
      enhancementLevel: 0, requirements: { ...startWpn.baseRequirements }, effects: { ...startWpn.baseEffects }, combatEffects: { ...startWpn.baseCombatEffects }
    };
    try {
      GameState.adventurers[0].equip(eq);
    } catch (e: any) {
      console.error(e.message);
    }
  }

  MarketSystem.updateMarkets(GameState.mapSystem.getNodes(), GameState.totalDays);

  console.log('[系統] ⚔️ 遊戲啟動：您的冒險在 ' + GameState.myTerritory.name + ' 開始了。');
}