import { MapNode, NodeFeature, NodeLevel } from '../models/types';
import { GeneratedWorld, GameDifficulty } from '../models/WorldGeneration';
import { MapMaskData } from '../data/MapMaskData';
import { getDifficultyConfig } from '../data/DifficultyData';
import { createSeededRandom, Random, RandomSource } from '../core/Random';

const MIN_NODE_DISTANCE = 6;
const MAP_EDGE_MARGIN = 5;
const MAX_PLACEMENT_ATTEMPTS = 1200;
const GENERATION_VERSION = 1;

interface Point {
  x: number;
  y: number;
}

export class MapGenerator {
  /**
   * 使用彼此隔離的 Seed 串流生成世界，確保難度不會改變 NPC 世界配置。
   */
  public static generateWorld(
    nodeTemplates: readonly MapNode[],
    seed: string,
    difficulty: GameDifficulty
  ): GeneratedWorld {
    const normalizedSeed = seed.trim();
    if (!normalizedSeed) throw new Error('World seed cannot be empty.');

    const nodePositionRandom = createSeededRandom(`${normalizedSeed}:npc-nodes`);
    const difficultyConfig = getDifficultyConfig(difficulty);
    const nodes = nodeTemplates.map(template => ({
      ...template,
      x: 0,
      y: 0,
      minimumNodeLevel: template.minimumNodeLevel ?? template.nodeLevel,
      isPlayerBase: false,
      isDiscovered: false,
      scoutData: template.scoutData ? { ...template.scoutData } : undefined,
      marketData: template.marketData
        ? {
            ...template.marketData,
            goods: template.marketData.goods.map(good => ({ ...good })),
            demandEvent: template.marketData.demandEvent ? { ...template.marketData.demandEvent } : undefined
          }
        : undefined
    }));

    this.assignDynamicCoordinates(nodes, nodePositionRandom);
    const playerBase = this.findOriginalPlayerBase(nodes, normalizedSeed, difficulty);
    if (!playerBase) throw new Error('No original map node can serve as the player base.');
    Object.assign(playerBase, {
      ownerFactionId: 'player',
      isPlayerBase: true,
      isDiscovered: true,
      isScouted: true,
      scoutExpiryDate: null,
      population: difficultyConfig.startingResources.population
    });

    const validationErrors = this.validateWorld(nodes);
    if (validationErrors.length > 0) {
      throw new Error(`World generation failed: ${validationErrors.join(' ')}`);
    }

    return {
      nodes,
      playerBase,
      meta: {
        seed: normalizedSeed,
        generationVersion: GENERATION_VERSION,
        difficulty
      }
    };
  }

  public static findOriginalPlayerBase(
    nodes: readonly MapNode[],
    seed: string,
    difficulty: GameDifficulty
  ): MapNode | null {
    const difficultyConfig = getDifficultyConfig(difficulty);
    const random = createSeededRandom(`${seed.trim()}:base-variant`);
    const levelIndex = Math.floor(random.next() * difficultyConfig.baseNodeLevels.length);
    const nodeLevel = difficultyConfig.baseNodeLevels[levelIndex] ?? difficultyConfig.baseNodeLevels[0];
    const eligibleBases = nodes.filter(node =>
      node.id !== 'player_base' &&
      !node.isPlayerBase &&
      node.nodeLevel === nodeLevel &&
      node.feature === NodeFeature.OCCUPIABLE &&
      !node.isHidden
    );
    if (eligibleBases.length === 0) return null;
    return eligibleBases[Math.floor(random.next() * eligibleBases.length)] ?? eligibleBases[0];
  }

  /**
   * 為所有沒有座標的節點分配位置。保留公開方法供動態地圖工具使用。
   */
  public static assignDynamicCoordinates(
    nodes: MapNode[],
    random: RandomSource = Random,
    occupiedNodes: readonly MapNode[] = []
  ): void {
    const sortedNodes = [...nodes].sort((a, b) => b.nodeLevel - a.nodeLevel);
    const capitalPositions: Record<string, Point> = {};
    const placedNodes: MapNode[] = [...occupiedNodes];

    for (const node of sortedNodes) {
      if (node.x !== 0 || node.y !== 0) {
        placedNodes.push(node);
        this.recordCapital(node, capitalPositions);
        continue;
      }

      let acceptedPoint: Point | null = null;
      let bestPoint: Point | null = null;
      let bestClearance = -1;

      for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
        const candidate = this.createCandidate(node, capitalPositions, random, attempt);
        if (MapMaskData.getTerrainAt(candidate.x, candidate.y) !== node.terrain) continue;

        const clearance = this.getMinimumDistance(candidate, placedNodes);
        if (clearance > bestClearance) {
          bestClearance = clearance;
          bestPoint = candidate;
        }

        if (clearance >= MIN_NODE_DISTANCE) {
          acceptedPoint = candidate;
          break;
        }
      }

      const point = acceptedPoint ?? bestPoint;
      if (!point) {
        throw new Error(`Unable to place map node ${node.id} on terrain ${node.terrain}.`);
      }

      node.x = point.x;
      node.y = point.y;
      placedNodes.push(node);
      this.recordCapital(node, capitalPositions);
    }
  }

  public static validateWorld(nodes: readonly MapNode[]): string[] {
    const errors: string[] = [];
    const ids = new Set<string>();
    const playerBases = nodes.filter(node => node.isPlayerBase);

    if (playerBases.length !== 1) {
      errors.push(`Expected exactly one player base, received ${playerBases.length}.`);
    }

    for (const node of nodes) {
      if (ids.has(node.id)) errors.push(`Duplicate node id: ${node.id}.`);
      ids.add(node.id);

      const terrain = MapMaskData.getTerrainAt(node.x, node.y);
      if (!terrain) {
        errors.push(`Node ${node.id} is outside valid land.`);
      } else if (!node.isPlayerBase && terrain !== node.terrain) {
        errors.push(`Node ${node.id} is on ${terrain}, expected ${node.terrain}.`);
      }
    }

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const distance = this.distance(nodes[leftIndex], nodes[rightIndex]);
        if (distance < MIN_NODE_DISTANCE - 0.001) {
          errors.push(
            `Nodes ${nodes[leftIndex].id} and ${nodes[rightIndex].id} are too close (${distance.toFixed(2)}).`
          );
        }
      }
    }

    return errors;
  }

  private static createCandidate(
    node: MapNode,
    capitalPositions: Readonly<Record<string, Point>>,
    random: RandomSource,
    attempt: number
  ): Point {
    const capital = node.ownerFactionId ? capitalPositions[node.ownerFactionId] : undefined;
    const shouldTryFactionCluster = attempt < Math.floor(MAX_PLACEMENT_ATTEMPTS * 0.65);
    if (node.nodeLevel !== NodeLevel.CAPITAL && capital && shouldTryFactionCluster) {
      const angle = random.next() * Math.PI * 2;
      const distance = 5 + random.next() * 15;
      return {
        x: Math.max(MAP_EDGE_MARGIN, Math.min(100 - MAP_EDGE_MARGIN, capital.x + Math.cos(angle) * distance)),
        y: Math.max(MAP_EDGE_MARGIN, Math.min(100 - MAP_EDGE_MARGIN, capital.y + Math.sin(angle) * distance))
      };
    }

    return {
      x: MAP_EDGE_MARGIN + random.next() * (100 - MAP_EDGE_MARGIN * 2),
      y: MAP_EDGE_MARGIN + random.next() * (100 - MAP_EDGE_MARGIN * 2)
    };
  }

  private static getMinimumDistance(point: Point, nodes: readonly MapNode[]): number {
    if (nodes.length === 0) return Number.POSITIVE_INFINITY;
    return nodes.reduce((minimum, node) => Math.min(minimum, this.distance(point, node)), Number.POSITIVE_INFINITY);
  }

  private static distance(left: Point, right: Point): number {
    return Math.hypot(left.x - right.x, left.y - right.y);
  }

  private static recordCapital(node: MapNode, capitals: Record<string, Point>): void {
    if (node.nodeLevel === NodeLevel.CAPITAL && node.ownerFactionId) {
      capitals[node.ownerFactionId] = { x: node.x, y: node.y };
    }
  }
}
