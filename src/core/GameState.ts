import { Adventurer } from '../models/Adventurer';
import { Territory } from '../models/Territory';
import { DispatchSystem } from '../systems/DispatchSystem';
import { MapDynamicsSystem } from '../systems/MapDynamicsSystem';
import { Faction, MapNode, NodeLevel, TerrainType, NodeFeature } from '../models/types';
import { DataStore } from '../systems/DataStore';
import { NameGenerator } from '../systems/NameGenerator';
import { INITIAL_FACTIONS } from '../data/FactionData';
import { INITIAL_MAP_NODES } from '../data/MapData';
import { SettlementSystem } from '../systems/SettlementSystem';
import { HeroSystem } from '../systems/HeroSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ThreatSystem } from '../systems/ThreatSystem';
import { MapGenerator } from '../systems/MapGenerator';

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
  restedExpPool: 0
};

export function initGameState() {
  GameState.myTerritory = new Territory('流浪傭兵團', null);
  GameState.myTerritory.gold = 500;
  GameState.adventurers = [];
  GameState.system = new DispatchSystem(GameState.myTerritory);
  
  const mapNodesCopy = JSON.parse(JSON.stringify(mapNodes));
  const factionsCopy = JSON.parse(JSON.stringify(factions));
  
  // 動態分配地圖節點的座標
  MapGenerator.assignDynamicCoordinates(mapNodesCopy);
  
  GameState.mapSystem = new MapDynamicsSystem(mapNodesCopy, factionsCopy);
  GameState.playTime = 0;
  GameState.sessionStartTime = Date.now();
  GameState.currentSaveSlot = null;
  GameState.currentDay = 1;
  GameState.currentMonth = 1;
  GameState.currentYear = 1;
  GameState.totalDays = 1;
  GameState.restedExpPool = 0;
  
  // 初始化 EventBus 關聯的新系統
  new SettlementSystem();
  new HeroSystem();
  new CombatSystem();
  new ThreatSystem();

  GameState.adventurers.push(
    new Adventurer('p1', NameGenerator.generateFullName(), DataStore.JobDB.WARRIOR, DataStore.TraitDB.GUARDIAN)
  );

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

  console.log('[系統] ⚔️ 遊戲啟動：您的冒險在 ' + GameState.myTerritory.name + ' 開始了。');
}
