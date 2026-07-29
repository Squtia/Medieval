import { Adventurer } from '../models/Adventurer';
import { Territory } from '../models/Territory';
import { DispatchSystem } from '../systems/DispatchSystem';
import { MapDynamicsSystem } from '../systems/MapDynamicsSystem';
import { Faction, MapNode, NodeLevel, TerrainType, NodeFeature, getTitleConfig, FormationPreset } from '../models/types';
import { DataStore } from '../systems/DataStore';
import { NameGenerator } from '../systems/NameGenerator';
import { INITIAL_FACTIONS } from '../data/FactionData';
import { INITIAL_MAP_NODES } from '../data/MapData';
import { SettlementSystem } from '../systems/SettlementSystem';
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

export const factions: Faction[] = INITIAL_FACTIONS;
export const mapNodes: MapNode[] = INITIAL_MAP_NODES;

export const GameState = {
  currentViewNode: null as MapNode | null,
  myTerritory: new Territory('流浪傭兵團', null),
  system: null as unknown as DispatchSystem,
  mapSystem: null as unknown as MapDynamicsSystem,
  adventurers: [] as Adventurer[],
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
  milestones: [] as string[],         // 已達成的里程碑 ID 列表
  pendingMilestones: [] as string[],  // 當日待顯示的里程碑（每日摘要後清空）
  worldGeneration: null as WorldGenerationMeta | null,
  explorationSystem: null as unknown as ExplorationSystem,
  roadSystem: null as unknown as RoadSystem,
  unlockedFormations: ['DEFAULT'] as string[],
  formationPresets: [] as FormationPreset[]
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
    WOODCUTTER: 0,
    MINER: 0
  };
  GameState.adventurers = [];
  GameState.system = new DispatchSystem(GameState.myTerritory);
  
  const factionsCopy = JSON.parse(JSON.stringify(factions));
  const generatedWorld = MapGenerator.generateWorld(
    mapNodes,
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
  
  // ⚠️ 關鍵：清除所有舊的 EventBus 訂閱，防止重新開局/讀檔時事件被觸發多次
  EventBus.getInstance().clearAll();

  // 初始化 EventBus 關聯的新系統
  new SettlementSystem();
  new HeroSystem();
  new CombatSystem();
  new ThreatSystem();

  const startingAdv = new Adventurer('p1', NameGenerator.generateFullName(), DataStore.JobDB.WARRIOR, DataStore.TraitDB.GUARDIAN);
  startingAdv.locationNodeId = generatedWorld.playerBase.id;
  GameState.adventurers.push(startingAdv);

  const startWpn = DataStore.getEquipmentTemplate('wpn_heirloom_sword');
  if (startWpn) {
    const eq = {
      uuid: 'eq_start_01', id: startWpn.id, name: startWpn.name, slot: startWpn.slot, icon: startWpn.icon,
      enhancementLevel: 0, requirements: {...startWpn.baseRequirements}, effects: {...startWpn.baseEffects}, combatEffects: {...startWpn.baseCombatEffects}
    };
    try {
      GameState.adventurers[0].equip(eq);
    } catch (e: any) {
      console.error(e.message);
    }
  }

  // 初始化所有節點的市場資料
  MarketSystem.updateMarkets(GameState.mapSystem.getNodes(), GameState.totalDays);

  console.log('[系統] ⚔️ 遊戲啟動：您的冒險在 ' + GameState.myTerritory.name + ' 開始了。');
}
