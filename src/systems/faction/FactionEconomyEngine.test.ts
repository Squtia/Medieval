import { describe, it, expect } from 'vitest';
import { createDefaultFactionProfile } from '../../models/FactionProfile';
import { FactionEconomyEngine } from './FactionEconomyEngine';
import { FactionType, FactionPersonality, NodeLevel, NodeFeature, WeatherType, TerrainType, MapNode } from '../../models/types';

describe('FactionEconomyEngine', () => {
  const dummyFaction = {
    id: 'f_test',
    factionName: '測試大公國',
    description: '測試用勢力',
    factionType: FactionType.GREAT_HOUSE,
    color: '#ff0000',
    resources: 3000,
    controlledNodes: ['node_1', 'node_2'],
    capitalNodeId: 'node_1',
    playerFavor: 0,
    relations: {},
    atWarWith: [],
    personality: FactionPersonality.WARMONGER,
  };

  const dummyNodes: MapNode[] = [
    {
      id: 'node_1',
      name: '測試王都',
      description: '測試王都',
      x: 50,
      y: 50,
      population: 100,
      prosperity: 50,
      isPlayerBase: false,
      isDiscovered: true,
      feature: NodeFeature.OCCUPIABLE,
      isScouted: true,
      scoutExpiryDate: 0,
      terrain: TerrainType.PLAINS,
      nodeLevel: NodeLevel.CAPITAL,
      ownerFactionId: 'f_test',
      currentWeather: WeatherType.CLEAR,
      weatherDuration: 5,
    },
    {
      id: 'node_2',
      name: '測試糧村',
      description: '測試糧村',
      x: 55,
      y: 55,
      population: 100,
      prosperity: 50,
      isPlayerBase: false,
      isDiscovered: true,
      feature: NodeFeature.OCCUPIABLE,
      isScouted: true,
      scoutExpiryDate: 0,
      terrain: TerrainType.PLAINS,
      nodeLevel: NodeLevel.VILLAGE,
      ownerFactionId: 'f_test',
      currentWeather: WeatherType.CLEAR,
      weatherDuration: 5,
    },
  ];

  it('correctly initializes FactionProfile with default personality traits and economic profiles', () => {
    const profile = createDefaultFactionProfile(dummyFaction);
    expect(profile.economy.treasury).toBe(3000);
    expect(profile.economy.grainDays).toBe(60);
    expect(profile.military.infantry).toBeGreaterThan(0);
    expect(profile.traits.aggression).toBe(85);
    expect(profile.stabilityIndex).toBe(75);
  });

  it('accurately calculates daily taxes, grain consumption and net profit', () => {
    const profile = createDefaultFactionProfile(dummyFaction);
    const initialTreasury = profile.economy.treasury;

    const summaries = FactionEconomyEngine.stepDailyEconomy([profile], dummyNodes, 1);
    expect(summaries.length).toBe(1);
    expect(summaries[0].factionId).toBe('f_test');
    expect(profile.economy.treasury).toBeGreaterThan(initialTreasury);
    expect(profile.economy.grainDays).toBeGreaterThan(0);
    expect(summaries[0].isStarving).toBe(false);
  });

  it('triggers starvation penalties and desertions when grain runs out', () => {
    const profile = createDefaultFactionProfile(dummyFaction);
    profile.economy.grainDays = 0; // 陷入飢荒
    const initialInfantry = profile.military.infantry;
    const initialStability = profile.stabilityIndex;

    const summaries = FactionEconomyEngine.stepDailyEconomy([profile], dummyNodes, 2);
    expect(summaries[0].isStarving).toBe(true);
    expect(profile.stabilityIndex).toBeLessThan(initialStability);
    expect(profile.military.infantry).toBeLessThan(initialInfantry);
    expect(summaries[0].logMessages.some(m => m.includes('糧荒'))).toBe(true);
  });

  it('decrements truce days and purges expired memories', () => {
    const profile = createDefaultFactionProfile(dummyFaction);
    profile.truceWith = { f_enemy: 2 };
    profile.memoryLedger = [
      {
        id: 'mem_1',
        type: 'TRADE_RAIDED',
        impactScore: -20,
        timestampDay: 1,
        durationDays: 10,
        note: '商隊被劫',
      },
      {
        id: 'mem_expired',
        type: 'TRADE_RAIDED',
        impactScore: -20,
        timestampDay: 1,
        durationDays: 3,
        note: '過期記憶',
      },
    ];

    // Day 5
    FactionEconomyEngine.stepDailyEconomy([profile], dummyNodes, 5);
    expect(profile.truceWith['f_enemy']).toBe(1);
    expect(profile.memoryLedger.some(m => m.id === 'mem_1')).toBe(true);
    expect(profile.memoryLedger.some(m => m.id === 'mem_expired')).toBe(false);
  });
});
