import { describe, expect, it } from 'vitest';
import { MapMaskData } from '../data/MapMaskData';
import { MapNode } from '../models/types';
import { ExplorationSystem } from './ExplorationSystem';
import { RoadSystem } from './RoadSystem';

describe('RoadSystem', () => {
  it('requires a discovered non-player target and a known passable route', () => {
    const setup = findLegalRoad();
    expect(setup).not.toBeNull();
    const { roads, exploration, origin, target } = setup!;

    const hiddenTarget = { ...target, id: 'hidden', isDiscovered: false } as MapNode;
    expect(roads.checkTarget(origin, hiddenTarget, exploration).valid).toBe(false);

    const ownTarget = { ...target, id: 'own', ownerFactionId: 'player' } as MapNode;
    expect(roads.checkTarget(origin, ownTarget, exploration).valid).toBe(false);
    expect(roads.checkTarget(origin, target, exploration).valid).toBe(true);
  });

  it('persists construction, advances once per day, and creates one connection', () => {
    const setup = findLegalRoad();
    expect(setup).not.toBeNull();
    const { roads, exploration, origin, target } = setup!;
    const project = roads.startConstruction(origin, target, exploration);
    expect(project.totalDays).toBeGreaterThan(1);

    const restored = new RoadSystem(roads.getData());
    expect(restored.getActiveProject()).toEqual(project);
    expect(restored.checkTarget(origin, target, exploration).valid).toBe(false);

    let progress = restored.advanceDay(10);
    expect(progress?.project.elapsedDays).toBe(1);
    while (progress && !progress.completed) {
      progress = restored.advanceDay(10 + progress.project.elapsedDays);
    }

    expect(progress?.completed).toBe(true);
    expect(restored.getActiveProject()).toBeNull();
    expect(restored.getRoadBetween(origin.id, target.id)?.targetNodeId).toBe(target.id);
    expect(restored.getRoads()).toHaveLength(1);
    expect(restored.checkTarget(origin, target, exploration).valid).toBe(false);

    const travel = restored.getTravelDays(origin, target);
    expect(travel.hasRoad).toBe(true);
    expect(travel.adjustedDays).toBeLessThanOrEqual(travel.baseDays);
    expect(restored.getMissionDays(4, origin, target).adjustedDays).toBe(3);
    expect(restored.getAmbushChance(origin, target)).toBeCloseTo(0.05);
    expect(restored.getTradeModifiers(origin, target)).toEqual({
      hasRoad: true,
      buyPriceMultiplier: 0.95,
      sellPriceMultiplier: 1.1
    });
  });

  it('correctly handles network connectivity and smart node branching', () => {
    const roads = new RoadSystem();
    const origin: MapNode = {
      id: 'base',
      x: 45,
      y: 50,
      isPlayerBase: true,
      isDiscovered: true,
      ownerFactionId: 'player'
    } as any;

    const nodeA: MapNode = {
      id: 'node_a',
      x: 55,
      y: 50,
      isPlayerBase: false,
      isDiscovered: true,
      ownerFactionId: 'neutral'
    } as any;

    const nodeB: MapNode = {
      id: 'node_b',
      x: 65,
      y: 50,
      isPlayerBase: false,
      isDiscovered: true,
      ownerFactionId: 'neutral'
    } as any;

    const exploration = new ExplorationSystem();
    exploration.revealCorridor(40, 50, 70, 50, 100);

    // 建造 base -> nodeA
    const projA = roads.startConstruction(origin, nodeA, exploration, [origin, nodeA, nodeB]);
    expect(projA.startNodeId).toBe('base');
    
    // 快速完成工程 A
    while (roads.getActiveProject()) {
      roads.advanceDay(1);
    }

    expect(roads.hasNetworkConnection('base', 'node_a')).toBe(true);

    // 建造延伸工程到 nodeB，應自動判定從 nodeA 延伸
    const checkB = roads.checkTarget(origin, nodeB, exploration, [origin, nodeA, nodeB]);
    expect(checkB.valid).toBe(true);
    expect(checkB.startNodeId).toBe('node_a');

    const projB = roads.startConstruction(origin, nodeB, exploration, [origin, nodeA, nodeB]);
    expect(projB.startNodeId).toBe('node_a');

    while (roads.getActiveProject()) {
      roads.advanceDay(2);
    }

    expect(roads.hasNetworkConnection('base', 'node_b')).toBe(true);
    expect(roads.getTravelDays(origin, nodeB).hasRoad).toBe(true);
  });
});

function findLegalRoad(): {
  roads: RoadSystem;
  exploration: ExplorationSystem;
  origin: MapNode;
  target: MapNode;
} | null {
  for (let originY = 12; originY <= 88; originY += 4) {
    for (let originX = 12; originX <= 88; originX += 4) {
      if (!MapMaskData.getTerrainAt(originX, originY)) continue;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
        const distance = 320;
        const targetX = originX + (Math.cos(angle) * distance / 1600) * 100;
        const targetY = originY + (Math.sin(angle) * distance / 900) * 100;
        if (!MapMaskData.getTerrainAt(targetX, targetY)) continue;

        const origin = {
          id: 'player_base',
          x: originX,
          y: originY,
          isPlayerBase: true,
          isDiscovered: true,
          ownerFactionId: 'player'
        } as MapNode;
        const target = {
          id: 'foreign_node',
          x: targetX,
          y: targetY,
          isPlayerBase: false,
          isDiscovered: true,
          ownerFactionId: 'foreign'
        } as MapNode;
        const exploration = new ExplorationSystem();
        exploration.revealCorridor(origin.x, origin.y, target.x, target.y, 60);
        const roads = new RoadSystem();
        if (roads.checkTarget(origin, target, exploration).valid) {
          return { roads, exploration, origin, target };
        }
      }
    }
  }
  return null;
}
