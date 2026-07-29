import {
  RoadConnection,
  RoadConstructionProject,
  RoadNetworkData,
  RoadTargetCheck
} from '../models/Road';
import { MapNode } from '../models/types';
import { ExplorationSystem } from './ExplorationSystem';
import { MapMaskData } from '../data/MapMaskData';

const MAP_WIDTH_PX = 1600;
const MAP_HEIGHT_PX = 900;
const ROAD_PIXELS_PER_DAY = 200;

export class RoadSystem {
  private readonly data: RoadNetworkData;

  constructor(data?: Partial<RoadNetworkData>) {
    this.data = {
      roads: (data?.roads ?? []).map(road => ({ ...road })),
      projects: (data?.projects ?? []).map(project => ({ ...project })),
      nextRoadId: data?.nextRoadId ?? 1
    };
  }

  public getData(): RoadNetworkData {
    return {
      roads: this.data.roads.map(road => ({ ...road })),
      projects: this.data.projects.map(project => ({ ...project })),
      nextRoadId: this.data.nextRoadId
    };
  }

  public getRoads(): readonly RoadConnection[] {
    return this.data.roads;
  }

  public getActiveProject(): RoadConstructionProject | null {
    return this.data.projects.find(project => project.status === 'ACTIVE') ?? null;
  }

  public getRoadBetween(originNodeId: string, targetNodeId: string): RoadConnection | null {
    return this.data.roads.find(road =>
      this.matchesEndpoints(road, originNodeId, targetNodeId)
    ) ?? null;
  }

  public getProjectBetween(originNodeId: string, targetNodeId: string): RoadConstructionProject | null {
    return this.data.projects.find(project =>
      project.status === 'ACTIVE' && this.matchesEndpoints(project, originNodeId, targetNodeId)
    ) ?? null;
  }

  public getTravelDays(origin: MapNode, target: MapNode): {
    baseDays: number;
    adjustedDays: number;
    hasRoad: boolean;
  } {
    const percentageDistance = Math.hypot(target.x - origin.x, target.y - origin.y);
    const baseDays = Math.max(1, Math.ceil(percentageDistance / 15));
    const hasRoad = Boolean(this.getRoadBetween(origin.id, target.id));
    return {
      baseDays,
      adjustedDays: hasRoad ? Math.max(1, Math.ceil(baseDays * 0.6)) : baseDays,
      hasRoad
    };
  }

  public getMissionDays(baseDays: number, origin: MapNode, target: MapNode): {
    baseDays: number;
    adjustedDays: number;
    hasRoad: boolean;
  } {
    const normalizedBaseDays = Math.max(1, baseDays);
    const hasRoad = Boolean(this.getRoadBetween(origin.id, target.id));
    return {
      baseDays: normalizedBaseDays,
      adjustedDays: hasRoad ? Math.max(1, Math.ceil(normalizedBaseDays * 0.75)) : normalizedBaseDays,
      hasRoad
    };
  }

  public getAmbushChance(origin: MapNode, target: MapNode, baseChance = 0.2): number {
    return this.getRoadBetween(origin.id, target.id) ? baseChance * 0.25 : baseChance;
  }

  public getTradeModifiers(origin: MapNode, target: MapNode): {
    hasRoad: boolean;
    buyPriceMultiplier: number;
    sellPriceMultiplier: number;
  } {
    const hasRoad = Boolean(this.getRoadBetween(origin.id, target.id));
    return {
      hasRoad,
      buyPriceMultiplier: hasRoad ? 0.95 : 1,
      sellPriceMultiplier: hasRoad ? 1.1 : 1
    };
  }

  public checkTarget(
    origin: MapNode,
    target: MapNode,
    exploration: ExplorationSystem
  ): RoadTargetCheck {
    if (!origin.isPlayerBase) {
      return { valid: false, reason: '道路必須從自己的主要據點開始建造。' };
    }
    if (target.isPlayerBase || target.ownerFactionId === 'player') {
      return { valid: false, reason: '請選擇非己方據點作為道路目的地。' };
    }
    if (!target.isDiscovered) {
      return { valid: false, reason: '必須先探索並發現這個據點。' };
    }
    if (this.getRoadBetween(origin.id, target.id)) {
      return { valid: false, reason: '兩個據點之間已經有道路。' };
    }
    if (this.getProjectBetween(origin.id, target.id)) {
      return { valid: false, reason: '這條道路正在施工。' };
    }
    if (this.getActiveProject()) {
      return { valid: false, reason: '目前已有道路正在施工；同一時間只能建造一條道路。' };
    }
    if (!this.isKnownPassableRoute(origin, target, exploration)) {
      return { valid: false, reason: '道路必須完全位於已探索、可通行的陸地上。' };
    }

    const lengthPixels = this.pixelDistance(origin, target);
    return {
      valid: true,
      lengthPixels,
      requiredDays: Math.max(1, Math.ceil(lengthPixels / ROAD_PIXELS_PER_DAY))
    };
  }

  public startConstruction(
    origin: MapNode,
    target: MapNode,
    exploration: ExplorationSystem
  ): RoadConstructionProject {
    const check = this.checkTarget(origin, target, exploration);
    if (!check.valid || !check.requiredDays || !check.lengthPixels) {
      throw new Error(check.reason ?? 'Invalid road construction target.');
    }

    const project: RoadConstructionProject = {
      id: `road_${this.data.nextRoadId}`,
      originNodeId: origin.id,
      targetNodeId: target.id,
      lengthPixels: check.lengthPixels,
      totalDays: check.requiredDays,
      elapsedDays: 0,
      status: 'ACTIVE'
    };
    this.data.nextRoadId += 1;
    this.data.projects = [...this.data.projects.slice(-9), project];
    return { ...project };
  }

  public advanceDay(currentDay: number): {
    project: RoadConstructionProject;
    road?: RoadConnection;
    completed: boolean;
  } | null {
    const project = this.getActiveProject();
    if (!project) return null;

    project.elapsedDays = Math.min(project.totalDays, project.elapsedDays + 1);
    const completed = project.elapsedDays >= project.totalDays;
    let road: RoadConnection | undefined;
    if (completed) {
      project.status = 'COMPLETED';
      road = {
        id: project.id,
        originNodeId: project.originNodeId,
        targetNodeId: project.targetNodeId,
        lengthPixels: project.lengthPixels,
        completedDay: currentDay
      };
      this.data.roads.push(road);
    }

    return {
      project: { ...project },
      road: road ? { ...road } : undefined,
      completed
    };
  }

  private isKnownPassableRoute(
    origin: MapNode,
    target: MapNode,
    exploration: ExplorationSystem
  ): boolean {
    const samples = Math.max(2, Math.ceil(this.pixelDistance(origin, target) / 20));
    for (let index = 0; index <= samples; index += 1) {
      const progress = index / samples;
      const x = origin.x + (target.x - origin.x) * progress;
      const y = origin.y + (target.y - origin.y) * progress;
      if (!MapMaskData.getTerrainAt(x, y) || !exploration.isPointRevealed(x, y)) return false;
    }
    return true;
  }

  private pixelDistance(origin: MapNode, target: MapNode): number {
    return Math.hypot(
      ((target.x - origin.x) / 100) * MAP_WIDTH_PX,
      ((target.y - origin.y) / 100) * MAP_HEIGHT_PX
    );
  }

  private matchesEndpoints(
    connection: Pick<RoadConnection, 'originNodeId' | 'targetNodeId'>,
    firstNodeId: string,
    secondNodeId: string
  ): boolean {
    return (
      connection.originNodeId === firstNodeId && connection.targetNodeId === secondNodeId
    ) || (
      connection.originNodeId === secondNodeId && connection.targetNodeId === firstNodeId
    );
  }
}
