import { describe, expect, it } from 'vitest';
import { INITIAL_MAP_NODES } from '../data/MapData';
import { MapMaskData } from '../data/MapMaskData';
import { GameDifficulty } from '../models/WorldGeneration';
import { NodeLevel, TerrainType, NodeFeature } from '../models/types';
import { MapGenerator } from './MapGenerator';

describe('MapGenerator', () => {
  it('replays the same world for the same seed', () => {
    const first = MapGenerator.generateWorld(INITIAL_MAP_NODES, 'replayable-seed', GameDifficulty.NORMAL);
    const second = MapGenerator.generateWorld(INITIAL_MAP_NODES, 'replayable-seed', GameDifficulty.NORMAL);

    expect(second.nodes.map(node => [node.id, node.x, node.y])).toEqual(
      first.nodes.map(node => [node.id, node.x, node.y])
    );
    expect(second.meta).toEqual(first.meta);
  });

  it('keeps world positions stable when only difficulty changes', () => {
    const normal = MapGenerator.generateWorld(INITIAL_MAP_NODES, 'shared-world', GameDifficulty.NORMAL);
    const hard = MapGenerator.generateWorld(INITIAL_MAP_NODES, 'shared-world', GameDifficulty.HARD);

    expect(hard.nodes.map(node => [node.id, node.x, node.y])).toEqual(
      normal.nodes.map(node => [node.id, node.x, node.y])
    );
    expect(hard.playerBase.nodeLevel).toBe(NodeLevel.WILDERNESS);
    expect(normal.playerBase.nodeLevel).toBe(NodeLevel.WILDERNESS);
  });

  it('promotes one original settlement to player base and keeps every node on valid terrain', () => {
    const generated = MapGenerator.generateWorld(INITIAL_MAP_NODES, 'valid-land', GameDifficulty.HARD);
    const originalNode = INITIAL_MAP_NODES.find(node => node.id === generated.playerBase.id);

    expect(generated.nodes.filter(node => node.isPlayerBase)).toHaveLength(1);
    expect(generated.nodes).toHaveLength(INITIAL_MAP_NODES.length);
    expect(originalNode).toBeDefined();
    expect(generated.playerBase.name).toBe(originalNode?.name);
    expect(INITIAL_MAP_NODES.some(node => node.isPlayerBase)).toBe(false);
    expect(generated.nodes.every(node => MapMaskData.getTerrainAt(node.x, node.y) !== null)).toBe(true);
    expect(MapGenerator.validateWorld(generated.nodes)).toEqual([]);
  });

  it('keeps the original settlement name when it becomes the player base', () => {
    const generated = MapGenerator.generateWorld(
      INITIAL_MAP_NODES,
      'default-base-name',
      GameDifficulty.NORMAL
    );

    const originalNode = INITIAL_MAP_NODES.find(node => node.id === generated.playerBase.id);
    expect(originalNode).toBeDefined();
    expect(generated.playerBase.name).toBe(originalNode?.name);
  });

  it('changes the layout for a different seed', () => {
    const first = MapGenerator.generateWorld(INITIAL_MAP_NODES, 'first-seed', GameDifficulty.NORMAL);
    const second = MapGenerator.generateWorld(INITIAL_MAP_NODES, 'second-seed', GameDifficulty.NORMAL);

    expect(second.nodes.map(node => [node.x, node.y])).not.toEqual(
      first.nodes.map(node => [node.x, node.y])
    );
  });

  it('produces valid layouts across a representative seed sample', () => {
    for (let index = 0; index < 25; index += 1) {
      const generated = MapGenerator.generateWorld(
        INITIAL_MAP_NODES,
        `sample-seed-${index}`,
        GameDifficulty.NORMAL
      );
      expect(MapGenerator.validateWorld(generated.nodes), `sample-seed-${index}`).toEqual([]);
    }
  });

  it('支援包含 RUINS / CAVE / WILDERNESS 概念地形據點的世界生成與驗證', () => {
    const customNodes: any[] = [
      ...INITIAL_MAP_NODES,
      {
        id: 'test_ruins_stronghold',
        name: '失落遺跡',
        description: '測試遺跡',
        terrain: TerrainType.RUINS,
        feature: NodeFeature.SUBJUGATION,
        nodeLevel: NodeLevel.WILDERNESS,
        ownerFactionId: null,
        isPlayerBase: false,
        isDiscovered: false,
        isHidden: false,
        baseDifficulty: 3
      },
      {
        id: 'test_cave_stronghold',
        name: '幽暗洞窟',
        description: '測試洞窟',
        terrain: TerrainType.CAVE,
        feature: NodeFeature.SUBJUGATION,
        nodeLevel: NodeLevel.WILDERNESS,
        ownerFactionId: null,
        isPlayerBase: false,
        isDiscovered: false,
        isHidden: true,
        baseDifficulty: 4
      }
    ];

    const generated = MapGenerator.generateWorld(customNodes, 'concept-terrain-seed', GameDifficulty.NORMAL);
    expect(MapGenerator.validateWorld(generated.nodes)).toEqual([]);
    const ruinsNode = generated.nodes.find(n => n.id === 'test_ruins_stronghold');
    const caveNode = generated.nodes.find(n => n.id === 'test_cave_stronghold');
    expect(ruinsNode).toBeDefined();
    expect(ruinsNode!.x).toBeGreaterThan(0);
    expect(caveNode).toBeDefined();
    expect(caveNode!.y).toBeGreaterThan(0);
  });
});
