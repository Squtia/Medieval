import {
  RoadConnection,
  RoadConstructionProject,
  RoadNetworkData,
  RoadTargetCheck
} from '../models/Road';
import { MapNode } from '../models/types';
import { ExplorationSystem } from './ExplorationSystem';
import { MapMaskData } from '../data/MapMaskData';
import { GameState } from '../core/GameState';

const MAP_WIDTH_PX = 1600;
const MAP_HEIGHT_PX = 900;
const ROAD_PIXELS_PER_DAY = 200;

export interface Point2D {
  x: number;
  y: number;
}

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

  /**
   * 檢查網絡連通性：起點與目標是否可透過已完成的道路網絡相連
   */
  public hasNetworkConnection(originNodeId: string, targetNodeId: string): boolean {
    if (originNodeId === targetNodeId) return true;
    const direct = this.getRoadBetween(originNodeId, targetNodeId);
    if (direct) return true;

    const adjacency = new Map<string, Set<string>>();
    const addEdge = (u: string, v: string) => {
      if (!adjacency.has(u)) adjacency.set(u, new Set());
      if (!adjacency.has(v)) adjacency.set(v, new Set());
      adjacency.get(u)!.add(v);
      adjacency.get(v)!.add(u);
    };

    for (const road of this.data.roads) {
      const u = road.startNodeId ?? road.originNodeId;
      const v = road.targetNodeId;
      addEdge(u, v);
      addEdge(road.originNodeId, road.targetNodeId);
    }

    const visited = new Set<string>([originNodeId]);
    const queue: string[] = [originNodeId];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === targetNodeId) return true;
      const neighbors = adjacency.get(curr);
      if (neighbors) {
        for (const n of neighbors) {
          if (!visited.has(n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
    }

    return false;
  }

  public getTravelDays(origin: MapNode, target: MapNode): {
    baseDays: number;
    adjustedDays: number;
    hasRoad: boolean;
  } {
    const percentageDistance = Math.hypot(target.x - origin.x, target.y - origin.y);
    const baseDays = Math.max(1, Math.ceil(percentageDistance / 15));
    const hasRoad = this.hasNetworkConnection(origin.id, target.id);
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
    const hasRoad = this.hasNetworkConnection(origin.id, target.id);
    return {
      baseDays: normalizedBaseDays,
      adjustedDays: hasRoad ? Math.max(1, Math.ceil(normalizedBaseDays * 0.75)) : normalizedBaseDays,
      hasRoad
    };
  }

  public getAmbushChance(origin: MapNode, target: MapNode, baseChance = 0.2): number {
    return this.hasNetworkConnection(origin.id, target.id) ? baseChance * 0.25 : baseChance;
  }

  public getTradeModifiers(origin: MapNode, target: MapNode): {
    hasRoad: boolean;
    buyPriceMultiplier: number;
    sellPriceMultiplier: number;
  } {
    const hasRoad = this.hasNetworkConnection(origin.id, target.id);
    return {
      hasRoad,
      buyPriceMultiplier: hasRoad ? 0.95 : 1,
      sellPriceMultiplier: hasRoad ? 1.1 : 1
    };
  }

  /**
   * 智慧判定最佳連通點（優先選擇順路的最近據點或主幹道路段中途分岔點）
   */
  public findBestConnectionPoint(
    origin: MapNode,
    target: MapNode,
    exploration: ExplorationSystem,
    allNodesInput?: MapNode[]
  ): {
    startPx: Point2D;
    startNodeId?: string;
    parentRoadId?: string;
    branchRatio?: number;
    lengthPixels: number;
  } {
    const targetPx = this.nodeToPixel(target);
    const originPx = this.nodeToPixel(origin);

    const allNodes = allNodesInput ?? GameState.mapSystem?.getNodes() ?? [origin, target];
    const nodeMap = new Map<string, MapNode>(allNodes.map(n => [n.id, n]));

    let bestResult = {
      startPx: originPx,
      startNodeId: origin.id as string | undefined,
      parentRoadId: undefined as string | undefined,
      branchRatio: undefined as number | undefined,
      lengthPixels: Math.hypot(targetPx.x - originPx.x, targetPx.y - originPx.y)
    };

    // 1. 檢索據點延伸選項 (Node Extension)
    for (const road of this.data.roads) {
      const candidateIds = [road.targetNodeId, road.startNodeId ?? road.originNodeId];
      for (const candidateId of candidateIds) {
        if (candidateId === origin.id || candidateId === target.id) continue;
        const candidateNode = nodeMap.get(candidateId);
        if (!candidateNode || !candidateNode.isDiscovered) continue;

        if (!this.hasNetworkConnection(origin.id, candidateNode.id)) continue;

        const candPx = this.nodeToPixel(candidateNode);
        const distToTarget = Math.hypot(targetPx.x - candPx.x, targetPx.y - candPx.y);

        if (distToTarget < bestResult.lengthPixels) {
          if (this.isKnownPassablePixelRoute(candPx, targetPx, exploration, `road_${candidateId}_${target.id}`)) {
            bestResult = {
              startPx: candPx,
              startNodeId: candidateNode.id,
              parentRoadId: undefined,
              branchRatio: undefined,
              lengthPixels: distToTarget
            };
          }
        }
      }
    }

    // 2. 檢索既有道路中途 Y型分岔選項 (Mid-road Curve Branching)
    for (const road of this.data.roads) {
      const sampleRatios = [0.2, 0.35, 0.5, 0.65, 0.8];
      for (const ratio of sampleRatios) {
        const branchPx = this.getPointOnRoadConnection(road, ratio, nodeMap);
        if (!branchPx) continue;

        const distToTarget = Math.hypot(targetPx.x - branchPx.x, targetPx.y - branchPx.y);
        // 如果從道路中段分岔比從據點走顯著更短（或不超過據點長度的 80%），優先選擇中途分岔
        if (distToTarget < bestResult.lengthPixels * 0.85) {
          if (this.isKnownPassablePixelRoute(branchPx, targetPx, exploration, `road_branch_${road.id}_${target.id}`)) {
            bestResult = {
              startPx: branchPx,
              startNodeId: undefined,
              parentRoadId: road.id,
              branchRatio: ratio,
              lengthPixels: distToTarget
            };
          }
        }
      }
    }

    return bestResult;
  }

  public checkTarget(
    origin: MapNode,
    target: MapNode,
    exploration: ExplorationSystem,
    allNodes?: MapNode[]
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
    if (this.hasNetworkConnection(origin.id, target.id)) {
      return { valid: false, reason: '此據點已經透過道路網絡連結。' };
    }
    if (this.getProjectBetween(origin.id, target.id)) {
      return { valid: false, reason: '這條道路正在施工。' };
    }
    if (this.getActiveProject()) {
      return { valid: false, reason: '目前已有道路正在施工；同一時間只能建造一條道路。' };
    }

    const conn = this.findBestConnectionPoint(origin, target, exploration, allNodes);
    const targetPx = this.nodeToPixel(target);

    const checkId = `road_${this.data.nextRoadId}`;
    if (!this.isKnownPassablePixelRoute(conn.startPx, targetPx, exploration, checkId)) {
      return { valid: false, reason: '道路必須完全位於已探索、可通行的陸地上。' };
    }

    const controlOffsetRatio = this.getControlOffsetRatio(checkId);

    return {
      valid: true,
      lengthPixels: conn.lengthPixels,
      requiredDays: Math.max(1, Math.ceil(conn.lengthPixels / ROAD_PIXELS_PER_DAY)),
      startNodeId: conn.startNodeId,
      parentRoadId: conn.parentRoadId,
      branchRatio: conn.branchRatio,
      controlOffsetRatio
    };
  }

  public startConstruction(
    origin: MapNode,
    target: MapNode,
    exploration: ExplorationSystem,
    allNodes?: MapNode[]
  ): RoadConstructionProject {
    const check = this.checkTarget(origin, target, exploration, allNodes);
    if (!check.valid || !check.requiredDays || !check.lengthPixels) {
      throw new Error(check.reason ?? 'Invalid road construction target.');
    }

    const project: RoadConstructionProject = {
      id: `road_${this.data.nextRoadId}`,
      originNodeId: origin.id,
      targetNodeId: target.id,
      startNodeId: check.startNodeId,
      parentRoadId: check.parentRoadId,
      branchRatio: check.branchRatio,
      controlOffsetRatio: check.controlOffsetRatio,
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
        startNodeId: project.startNodeId,
        parentRoadId: project.parentRoadId,
        branchRatio: project.branchRatio,
        controlOffsetRatio: project.controlOffsetRatio ?? this.getControlOffsetRatio(project.id),
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

  public getControlOffsetRatio(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    const val = (Math.abs(hash) % 20 - 10) / 100;
    return val === 0 ? 0.05 : val;
  }

  public nodeToPixel(node: { x: number; y: number }): Point2D {
    return {
      x: (node.x / 100) * MAP_WIDTH_PX,
      y: (node.y / 100) * MAP_HEIGHT_PX
    };
  }

  public getPointOnRoadConnection(
    road: RoadConnection,
    ratio: number,
    nodeMap: Map<string, MapNode>
  ): Point2D | null {
    const targetNode = nodeMap.get(road.targetNodeId);
    if (!targetNode) return null;

    let startPx: Point2D;
    if (road.startNodeId && nodeMap.has(road.startNodeId)) {
      startPx = this.nodeToPixel(nodeMap.get(road.startNodeId)!);
    } else if (road.parentRoadId) {
      const parent = this.data.roads.find(r => r.id === road.parentRoadId);
      if (parent) {
        startPx = this.getPointOnRoadConnection(parent, road.branchRatio ?? 0.5, nodeMap) ?? this.nodeToPixel(targetNode);
      } else {
        const originNode = nodeMap.get(road.originNodeId);
        if (!originNode) return null;
        startPx = this.nodeToPixel(originNode);
      }
    } else {
      const originNode = nodeMap.get(road.originNodeId);
      if (!originNode) return null;
      startPx = this.nodeToPixel(originNode);
    }

    const targetPx = this.nodeToPixel(targetNode);
    return this.getSmoothCurvePoint(startPx, targetPx, road.id, ratio);
  }

  /**
   * 顯著且自然的雙重山路波浪弧度演算法（35~65px 弧度 + 手繪微幅波浪）
   */
  public getSmoothCurvePoint(
    startPx: Point2D,
    targetPx: Point2D,
    roadId: string,
    t: number
  ): Point2D {
    const dx = targetPx.x - startPx.x;
    const dy = targetPx.y - startPx.y;
    const len = Math.hypot(dx, dy);

    if (len === 0) return { x: startPx.x, y: startPx.y };

    const normX = -dy / len;
    const normY = dx / len;

    let hash = 0;
    for (let i = 0; i < roadId.length; i++) {
      hash = (hash << 5) - hash + roadId.charCodeAt(i);
      hash |= 0;
    }

    const sign = (Math.abs(hash) % 2 === 0) ? 1 : -1;
    const phase = ((Math.abs(hash >> 2) % 100) / 100) * Math.PI;

    // 顯著自然弧度 (35px ~ 65px)
    const maxOffset = Math.min(65, Math.max(35, len * 0.16)) * sign;

    // 包絡線：確保 t=0 與 t=1 處偏移精準為 0（對齊據點與分岔點）
    const envelope = Math.sin(Math.PI * t);

    // 主弧線 + 輔助微幅手繪波浪
    const mainArc = envelope * maxOffset;
    const secondaryWiggle = envelope * Math.sin(2.5 * Math.PI * t + phase) * (maxOffset * 0.25);

    const offset = mainArc + secondaryWiggle;

    const baseX = startPx.x + dx * t;
    const baseY = startPx.y + dy * t;

    return {
      x: baseX + normX * offset,
      y: baseY + normY * offset
    };
  }

  public getWindingPoint(
    startPx: Point2D,
    targetPx: Point2D,
    roadId: string,
    t: number
  ): Point2D {
    return this.getSmoothCurvePoint(startPx, targetPx, roadId, t);
  }

  public getBezierPoint(
    startPx: Point2D,
    targetPx: Point2D,
    offsetRatio: number,
    t: number,
    roadId = 'road_default'
  ): Point2D {
    return this.getSmoothCurvePoint(startPx, targetPx, roadId, t);
  }

  private isKnownPassablePixelRoute(
    startPx: Point2D,
    targetPx: Point2D,
    exploration: ExplorationSystem,
    roadId = 'road_check'
  ): boolean {
    const dist = Math.hypot(targetPx.x - startPx.x, targetPx.y - startPx.y);
    const samples = Math.max(4, Math.ceil(dist / 15));

    let curvePassable = true;
    for (let index = 0; index <= samples; index += 1) {
      const progress = index / samples;
      const pt = this.getSmoothCurvePoint(startPx, targetPx, roadId, progress);
      const percX = (pt.x / MAP_WIDTH_PX) * 100;
      const percY = (pt.y / MAP_HEIGHT_PX) * 100;
      if (!MapMaskData.getTerrainAt(percX, percY) || !exploration.isPointRevealed(percX, percY)) {
        curvePassable = false;
        break;
      }
    }
    if (curvePassable) return true;

    // 備用退回判定：若彎曲擺幅觸及水體，測試直線路徑是否全段通暢
    for (let index = 0; index <= samples; index += 1) {
      const progress = index / samples;
      const percX = ((startPx.x + (targetPx.x - startPx.x) * progress) / MAP_WIDTH_PX) * 100;
      const percY = ((startPx.y + (targetPx.y - startPx.y) * progress) / MAP_HEIGHT_PX) * 100;
      if (!MapMaskData.getTerrainAt(percX, percY) || !exploration.isPointRevealed(percX, percY)) {
        return false;
      }
    }

    return true;
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
