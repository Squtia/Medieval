import { Faction, MapNode, NodeLevel, NodeFeature, WeatherType, TerrainType, FactionPersonality, SiegeData } from '../models/types';
import { GameEventType } from '../core/GameEvents';
import { Territory } from '../models/Territory';
import { Random } from '../core/Random';
import { GameState } from '../core/GameState';

import { FactionSystem } from './map/FactionSystem';
import { MapNodeSystem } from './map/MapNodeSystem';
import { MapEventSystem } from './map/MapEventSystem';
import { MapUtils } from './map/MapUtils';

/**
 * 地圖動態系統 (Facade)
 * 此類別已重構為外觀模式，將複雜的邏輯委派給：
 * - FactionSystem: 派系與攻城邏輯
 * - SettlementSystem: 據點與繁榮度邏輯
 * - MapEventSystem: 斥候、天氣與隨機事件
 */
export class MapDynamicsSystem {
  private mapNodes: MapNode[];
  private factions: Faction[];

  constructor(mapNodes: MapNode[], factions: Faction[]) {
    this.mapNodes = mapNodes;
    this.factions = factions;
  }

  public simulateDailyMapDynamics(currentDay: number): void {
    for (const node of this.mapNodes) {
      if (node.pendingScoutDays && node.pendingScoutDays > 0) {
        node.pendingScoutDays -= 1;
        if (node.pendingScoutDays <= 0) {
          this.resolveScout(node, currentDay);
          import('../ui/ToastManager').then(({ ToastManager }) => {
            ToastManager.show(`斥候傳回了「${node.name}」的情報！`);
          });
        }
      }

      if (node.siegeData) {
        node.siegeData.remainingDays -= 1;
        if (node.siegeData.remainingDays <= 0) {
          this.resolveSiege(node);
        } else {
           import('../core/EventBus').then(({ EventBus }) => {
             EventBus.getInstance().publish({ 
               type: GameEventType.SIEGE_UPDATED, 
               payload: { targetNodeId: node.id, remainingDays: node.siegeData!.remainingDays }
             });
           });
        }
      }
    }
  }

  private resolveSiege(node: MapNode): void {
    FactionSystem.resolveSiege(node, this.factions);
  }

  public simulateMapDynamics(months: number): void {
    // 1. 繁榮度變化與升降級檢定
    MapNodeSystem.simulateProsperity(this.mapNodes);

    // 2. 派系互動
    this.processAIFactionsInteractions();

    // 3. 派系資源累積與擴張/滅亡判定
    for (const faction of this.factions) {
      if (faction.controlledNodes.length === 0) {
        continue;
      }
      faction.resources += faction.controlledNodes.length * 10;
      if (faction.resources >= FactionSystem.FACTION_EXPANSION_THRESHOLD) {
        this.attemptFactionExpansion(faction);
      }
    }
  }

  private processAIFactionsInteractions(): void {
    FactionSystem.processAIFactionsInteractions(this.factions);
  }

  private attemptFactionExpansion(faction: Faction): void {
    FactionSystem.attemptFactionExpansion(faction, this.mapNodes, this.factions);
  }

  public checkNodeUnlocks(currentDay: number, currentPrestige: number): void {
    MapEventSystem.checkNodeUnlocks(this.mapNodes, currentDay, currentPrestige);
  }

  public investProsperity(nodeId: string, territory: Territory): boolean {
    return MapNodeSystem.investProsperity(nodeId, this.mapNodes, territory);
  }

  public relocateBase(targetNodeId: string, territory: Territory): boolean {
    return MapNodeSystem.relocateBase(targetNodeId, this.mapNodes, territory);
  }

  public foundSettlement(targetNodeId: string, territory: Territory): boolean {
    return MapNodeSystem.foundSettlement(targetNodeId, this.mapNodes, territory);
  }

  public scoutNode(nodeId: string, territory: Territory, currentDay: number): boolean {
    return MapEventSystem.scoutNode(nodeId, this.mapNodes, territory);
  }

  public resolveScout(node: MapNode, currentDay: number): void {
    MapEventSystem.resolveScout(node, currentDay);
  }

  public checkScoutExpiry(currentDay: number): void {
    MapEventSystem.checkScoutExpiry(this.mapNodes, currentDay);
  }

  public updateWeather(): void {
    MapEventSystem.updateWeather(this.mapNodes);
  }

  public getNodes(): MapNode[] {
    return this.mapNodes;
  }

  public getNodeById(nodeId: string): MapNode | undefined {
    return this.mapNodes.find(n => n.id === nodeId);
  }

  public getFactions(): Faction[] {
    return this.factions;
  }

  public removeDynamicNode(nodeId: string): void {
    this.mapNodes = this.mapNodes.filter(n => n.id !== nodeId);
  }

  public spawnDynamicNode(baseNode: MapNode, radius: number = 10): MapNode | null {
    return MapEventSystem.spawnDynamicNode(this.mapNodes, baseNode, radius);
  }

  public addStoryNode(node: MapNode): MapNode {
    const existing = this.getNodeById(node.id);
    if (existing) return existing;
    this.mapNodes.push(node);
    return node;
  }
}
