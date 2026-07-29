import { describe, expect, it } from 'vitest';
import { INITIAL_MAP_NODES } from '../data/MapData';
import { GameDifficulty } from '../models/WorldGeneration';
import { restoreOriginalPlayerBaseInSave } from './SaveManager';

describe('legacy player base restoration', () => {
  it('promotes the seeded original node and rewrites saved node references', () => {
    const data = {
      worldGeneration: { seed: 'legacy-base', difficulty: GameDifficulty.NORMAL },
      territory: { currentCountryId: 'player_base' },
      mapNodes: [
        {
          id: 'player_base',
          name: '流浪傭兵團',
          nodeLevel: 3,
          isPlayerBase: true,
          population: 30,
          prosperity: 400
        },
        ...INITIAL_MAP_NODES.map(node => ({ ...node }))
      ],
      adventurers: [{ locationNodeId: 'player_base' }],
      activeMissions: [],
      roads: {
        roads: [{ originNodeId: 'player_base', targetNodeId: 'n_wild_1' }],
        projects: []
      },
      exploration: {
        expeditions: [{ originNodeId: 'player_base' }]
      }
    };

    expect(restoreOriginalPlayerBaseInSave(data)).toBe(true);
    const base = data.mapNodes.find(node => node.isPlayerBase);
    expect(base?.id).not.toBe('player_base');
    expect(base?.name).not.toBe('流浪傭兵團');
    expect(data.territory.currentCountryId).toBe(base?.id);
    expect(data.adventurers[0].locationNodeId).toBe(base?.id);
    expect(data.roads.roads[0].originNodeId).toBe(base?.id);
    expect(data.exploration.expeditions[0].originNodeId).toBe(base?.id);
  });
});
