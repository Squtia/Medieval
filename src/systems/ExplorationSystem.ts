import {
  ExplorationExpedition,
  ExplorationMapData,
  ExplorationTargetCheck,
  ExplorationTargetPreview
} from '../models/Exploration';
import { MapNode } from '../models/types';
import { MapMaskData } from '../data/MapMaskData';

const MAP_WIDTH_PX = 1600;
const MAP_HEIGHT_PX = 900;
const DEFAULT_GRID_WIDTH = 80;
const DEFAULT_GRID_HEIGHT = 45;
const PERSPECTIVE_VISION_Y_SCALE = 0.72;

export class ExplorationSystem {
  private readonly data: ExplorationMapData;

  constructor(data?: ExplorationMapData) {
    const width = data?.width ?? DEFAULT_GRID_WIDTH;
    const height = data?.height ?? DEFAULT_GRID_HEIGHT;
    const expectedLength = width * height;
    this.data = {
      width,
      height,
      cells: data?.cells?.length === expectedLength
        ? [...data.cells]
        : new Array(expectedLength).fill(0),
      expeditions: (data?.expeditions ?? []).map(expedition => ({ ...expedition })),
      nextExpeditionId: data?.nextExpeditionId ?? 1
    };
  }

  public revealAllCells(): void {
    this.data.cells.fill(1);
  }

  public getData(): ExplorationMapData {
    return {
      width: this.data.width,
      height: this.data.height,
      cells: [...this.data.cells],
      expeditions: (this.data.expeditions ?? []).map(expedition => ({ ...expedition })),
      nextExpeditionId: this.data.nextExpeditionId
    };
  }

  private maxExpeditions: number = 1;

  public getMaxExpeditions(): number {
    return this.maxExpeditions;
  }

  public setMaxExpeditions(val: number): void {
    this.maxExpeditions = Math.max(1, val);
  }

  public getActiveExpeditions(): ExplorationExpedition[] {
    return this.data.expeditions?.filter(expedition => expedition.status === 'ACTIVE') ?? [];
  }

  public getActiveExpedition(): ExplorationExpedition | null {
    const active = this.getActiveExpeditions();
    return active.length > 0 ? active[0] : null;
  }

  public checkTarget(origin: MapNode, targetX: number, targetY: number): ExplorationTargetCheck {
    if (this.getActiveExpeditions().length >= this.maxExpeditions) {
      return { valid: false, reason: `已達同時探索隊伍上限 (${this.maxExpeditions} 隊)。` };
    }
    if (this.isPointRevealed(targetX, targetY)) return { valid: false, reason: '請選擇黑幕邊緣的未知區域。' };
    if (!MapMaskData.getTerrainAt(targetX, targetY)) return { valid: false, reason: '目標位於海域或不可通行地形。' };
    if (this.distanceToRevealedArea(targetX, targetY) > 70) {
      return { valid: false, reason: '目標離已知區域太遠，請從黑幕邊緣逐步探索。' };
    }
    if (!this.isStraightRoutePassable(origin.x, origin.y, targetX, targetY)) {
      return { valid: false, reason: '目前路線被海域阻隔，斥候無法直線抵達。' };
    }

    const distance = this.pixelDistance(origin.x, origin.y, targetX, targetY);
    const requiredDays = Math.max(1, Math.ceil(distance / 240));

    const goldCost = 100 + (requiredDays - 1) * 30;
    const foodCost = 20 + (requiredDays - 1) * 15;

    const isLongDistance = requiredDays > 6;
    let expeditedDays: number | undefined;
    let expeditedGoldCost: number | undefined;
    let expeditedFoodCost: number | undefined;

    if (isLongDistance) {
      expeditedDays = Math.max(3, Math.floor(requiredDays * 0.6));
      expeditedGoldCost = Math.round(goldCost * 1.8);
      expeditedFoodCost = Math.round(foodCost * 1.8);
    }

    return {
      valid: true,
      requiredDays,
      goldCost,
      foodCost,
      isLongDistance,
      expeditedDays,
      expeditedGoldCost,
      expeditedFoodCost
    };
  }

  public getTargetPreview(origin: MapNode): ExplorationTargetPreview {
    const cells = new Array(this.data.width * this.data.height).fill(0);
    for (let row = 0; row < this.data.height; row += 1) {
      for (let column = 0; column < this.data.width; column += 1) {
        const targetX = ((column + 0.5) / this.data.width) * 100;
        const targetY = ((row + 0.5) / this.data.height) * 100;
        if (this.checkTarget(origin, targetX, targetY).valid) {
          cells[row * this.data.width + column] = 1;
        }
      }
    }
    return { width: this.data.width, height: this.data.height, cells };
  }

  public startExpedition(
    origin: MapNode,
    explorerId: string,
    targetX: number,
    targetY: number,
    isExpedited: boolean = false
  ): ExplorationExpedition {
    const check = this.checkTarget(origin, targetX, targetY);
    if (!check.valid || !check.requiredDays) throw new Error(check.reason ?? 'Invalid exploration target.');

    const totalDays = (isExpedited && check.expeditedDays) ? check.expeditedDays : check.requiredDays;

    const expedition: ExplorationExpedition = {
      id: `explore_${this.data.nextExpeditionId ?? 1}`,
      originNodeId: origin.id,
      explorerId,
      startX: origin.x,
      startY: origin.y,
      targetX,
      targetY,
      currentX: origin.x,
      currentY: origin.y,
      totalDays,
      elapsedDays: 0,
      visionRadius: 35,
      status: 'ACTIVE',
      isExpedited
    };
    this.data.nextExpeditionId = (this.data.nextExpeditionId ?? 1) + 1;
    this.data.expeditions = [...(this.data.expeditions ?? []).slice(-19), expedition];
    return expedition;
  }

  public advanceDay(nodes: readonly MapNode[]): {
    expedition: ExplorationExpedition;
    discoveredNodeIds: string[];
    completed: boolean;
  }[] {
    const activeExpeditions = this.getActiveExpeditions();
    if (activeExpeditions.length === 0) return [];

    const results: {
      expedition: ExplorationExpedition;
      discoveredNodeIds: string[];
      completed: boolean;
    }[] = [];

    for (const expedition of activeExpeditions) {
      const previousX = expedition.currentX;
      const previousY = expedition.currentY;
      expedition.elapsedDays = Math.min(expedition.totalDays, expedition.elapsedDays + 1);
      const progress = expedition.elapsedDays / expedition.totalDays;
      expedition.currentX = expedition.startX + (expedition.targetX - expedition.startX) * progress;
      expedition.currentY = expedition.startY + (expedition.targetY - expedition.startY) * progress;
      this.revealCorridor(previousX, previousY, expedition.currentX, expedition.currentY, expedition.visionRadius);
      const discoveredNodeIds = this.discoverRevealedNodes(nodes);
      const completed = expedition.elapsedDays >= expedition.totalDays;
      if (completed) expedition.status = 'COMPLETED';

      results.push({
        expedition: { ...expedition },
        discoveredNodeIds,
        completed
      });
    }

    return results;
  }

  public isCellRevealed(column: number, row: number): boolean {
    if (column < 0 || row < 0 || column >= this.data.width || row >= this.data.height) return false;
    return this.data.cells[row * this.data.width + column] === 1;
  }

  public isPointRevealed(xPercent: number, yPercent: number): boolean {
    const column = Math.min(this.data.width - 1, Math.max(0, Math.floor((xPercent / 100) * this.data.width)));
    const row = Math.min(this.data.height - 1, Math.max(0, Math.floor((yPercent / 100) * this.data.height)));
    return this.isCellRevealed(column, row);
  }

  public revealCircle(xPercent: number, yPercent: number, radiusPixels: number): void {
    const centerX = (xPercent / 100) * MAP_WIDTH_PX;
    const centerY = (yPercent / 100) * MAP_HEIGHT_PX;
    this.forEachCell((column, row, cellX, cellY) => {
      const normalizedX = (cellX - centerX) / radiusPixels;
      const normalizedY = (cellY - centerY) / (radiusPixels * PERSPECTIVE_VISION_Y_SCALE);
      if (Math.hypot(normalizedX, normalizedY) <= 1) {
        this.revealCell(column, row);
      }
    });
  }

  public revealCorridor(
    startXPercent: number,
    startYPercent: number,
    endXPercent: number,
    endYPercent: number,
    radiusPixels: number
  ): void {
    const startX = (startXPercent / 100) * MAP_WIDTH_PX;
    const startY = ((startYPercent / 100) * MAP_HEIGHT_PX) / PERSPECTIVE_VISION_Y_SCALE;
    const endX = (endXPercent / 100) * MAP_WIDTH_PX;
    const endY = ((endYPercent / 100) * MAP_HEIGHT_PX) / PERSPECTIVE_VISION_Y_SCALE;
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

    this.forEachCell((column, row, cellX, rawCellY) => {
      const cellY = rawCellY / PERSPECTIVE_VISION_Y_SCALE;
      const projection = segmentLengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((cellX - startX) * segmentX + (cellY - startY) * segmentY) / segmentLengthSquared));
      const closestX = startX + segmentX * projection;
      const closestY = startY + segmentY * projection;
      if (Math.hypot(cellX - closestX, cellY - closestY) <= radiusPixels) {
        this.revealCell(column, row);
      }
    });
  }

  public discoverRevealedNodes(nodes: readonly MapNode[]): string[] {
    const discovered: string[] = [];
    nodes.forEach(node => {
      if (!node.isDiscovered && this.isPointRevealed(node.x, node.y)) {
        node.isDiscovered = true;
        discovered.push(node.id);
      }
    });
    return discovered;
  }

  private revealCell(column: number, row: number): void {
    this.data.cells[row * this.data.width + column] = 1;
  }

  private distanceToRevealedArea(xPercent: number, yPercent: number): number {
    const targetX = (xPercent / 100) * MAP_WIDTH_PX;
    const targetY = (yPercent / 100) * MAP_HEIGHT_PX;
    const cellWidth = MAP_WIDTH_PX / this.data.width;
    const cellHeight = MAP_HEIGHT_PX / this.data.height;
    let minimum = Number.POSITIVE_INFINITY;
    for (let row = 0; row < this.data.height; row += 1) {
      for (let column = 0; column < this.data.width; column += 1) {
        if (!this.isCellRevealed(column, row)) continue;
        minimum = Math.min(
          minimum,
          Math.hypot((column + 0.5) * cellWidth - targetX, (row + 0.5) * cellHeight - targetY)
        );
      }
    }
    return minimum;
  }

  private isStraightRoutePassable(startX: number, startY: number, endX: number, endY: number): boolean {
    const samples = Math.max(2, Math.ceil(this.pixelDistance(startX, startY, endX, endY) / 20));
    for (let index = 0; index <= samples; index += 1) {
      const progress = index / samples;
      const x = startX + (endX - startX) * progress;
      const y = startY + (endY - startY) * progress;
      if (!MapMaskData.getTerrainAt(x, y)) return false;
    }
    return true;
  }

  private pixelDistance(startX: number, startY: number, endX: number, endY: number): number {
    return Math.hypot(
      ((endX - startX) / 100) * MAP_WIDTH_PX,
      ((endY - startY) / 100) * MAP_HEIGHT_PX
    );
  }

  private forEachCell(
    visitor: (column: number, row: number, centerX: number, centerY: number) => void
  ): void {
    const cellWidth = MAP_WIDTH_PX / this.data.width;
    const cellHeight = MAP_HEIGHT_PX / this.data.height;
    for (let row = 0; row < this.data.height; row += 1) {
      for (let column = 0; column < this.data.width; column += 1) {
        visitor(column, row, (column + 0.5) * cellWidth, (row + 0.5) * cellHeight);
      }
    }
  }
}
