import { describe, expect, it } from 'vitest';
import { ExplorationSystem } from './ExplorationSystem';
import { MapMaskData } from '../data/MapMaskData';
import { MapNode } from '../models/types';

describe('ExplorationSystem', () => {
  it('starts hidden and reveals a bounded circle', () => {
    const system = new ExplorationSystem();
    expect(system.isPointRevealed(50, 50)).toBe(false);

    system.revealCircle(50, 50, 90);

    expect(system.isPointRevealed(50, 50)).toBe(true);
    expect(system.isPointRevealed(5, 5)).toBe(false);
    const revealed = system.getData().cells.filter(Boolean).length;
    expect(revealed).toBeGreaterThan(0);
    expect(revealed).toBeLessThan(system.getData().cells.length);
  });

  it('uses a vertically compressed reveal footprint for map perspective', () => {
    const system = new ExplorationSystem();
    system.revealCircle(50, 50, 100);

    expect(system.isPointRevealed(55, 50)).toBe(true);
    expect(system.isPointRevealed(50, 59)).toBe(false);
  });

  it('reveals a continuous corridor between turn positions', () => {
    const system = new ExplorationSystem();
    system.revealCorridor(20, 50, 80, 50, 30);

    expect(system.isPointRevealed(20, 50)).toBe(true);
    expect(system.isPointRevealed(50, 50)).toBe(true);
    expect(system.isPointRevealed(80, 50)).toBe(true);
    expect(system.isPointRevealed(50, 20)).toBe(false);
  });

  it('round-trips its persistent grid without sharing mutable cells', () => {
    const first = new ExplorationSystem();
    first.revealCircle(30, 40, 70);
    const saved = first.getData();
    const restored = new ExplorationSystem(saved);

    expect(restored.getData()).toEqual(saved);
    restored.revealCircle(80, 80, 70);
    expect(first.getData()).not.toEqual(restored.getData());
  });

  it('builds its target preview from the same validation used for clicks', () => {
    const setup = findLegalExpedition();
    expect(setup).not.toBeNull();
    const { system, origin, targetX, targetY } = setup!;
    const preview = system.getTargetPreview(origin);
    const column = Math.floor((targetX / 100) * preview.width);
    const row = Math.floor((targetY / 100) * preview.height);
    const cellX = ((column + 0.5) / preview.width) * 100;
    const cellY = ((row + 0.5) / preview.height) * 100;

    expect(preview.cells).toHaveLength(preview.width * preview.height);
    expect(preview.cells[row * preview.width + column])
      .toBe(Number(system.checkTarget(origin, cellX, cellY).valid));
    expect(preview.cells.some(Boolean)).toBe(true);
  });

  it('validates, persists, and completes an expedition while discovering nodes', () => {
    const setup = findLegalExpedition();
    expect(setup).not.toBeNull();
    const { system, origin, targetX, targetY } = setup!;

    expect(system.checkTarget(origin, origin.x, origin.y).valid).toBe(false);
    const expedition = system.startExpedition(origin, 'hero_scout', targetX, targetY);
    expect(system.checkTarget(origin, targetX, targetY).valid).toBe(false);

    const restored = new ExplorationSystem(system.getData());
    expect(restored.getActiveExpedition()).toEqual(expedition);

    const hiddenNode = {
      id: 'hidden_node',
      x: targetX,
      y: targetY,
      isDiscovered: false
    } as MapNode;
    let progress = restored.advanceDay([origin, hiddenNode]);
    while (progress && !progress.completed) {
      progress = restored.advanceDay([origin, hiddenNode]);
    }

    expect(progress?.completed).toBe(true);
    expect(progress?.discoveredNodeIds).toContain('hidden_node');
    expect(hiddenNode.isDiscovered).toBe(true);
    expect(restored.isPointRevealed(targetX, targetY)).toBe(true);
    expect(restored.getActiveExpedition()).toBeNull();
  });
});

function findLegalExpedition(): {
  system: ExplorationSystem;
  origin: MapNode;
  targetX: number;
  targetY: number;
} | null {
  for (let originY = 10; originY <= 90; originY += 4) {
    for (let originX = 10; originX <= 90; originX += 4) {
      if (!MapMaskData.getTerrainAt(originX, originY)) continue;
      const origin = { id: 'player_base', x: originX, y: originY, isDiscovered: true } as MapNode;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
        const targetX = originX + (Math.cos(angle) * 130 / 1600) * 100;
        const targetY = originY + (Math.sin(angle) * 130 / 900) * 100;
        const system = new ExplorationSystem();
        system.revealCircle(originX, originY, 90);
        if (system.checkTarget(origin, targetX, targetY).valid) {
          return { system, origin, targetX, targetY };
        }
      }
    }
  }
  return null;
}
