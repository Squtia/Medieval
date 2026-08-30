import { describe, it, expect } from 'vitest';
import { createDefaultFactionProfile } from '../../models/FactionProfile';
import { FactionDecisionAI } from './FactionDecisionAI';
import { FactionType, FactionPersonality, NodeLevel, NodeFeature, WeatherType, TerrainType, MapNode } from '../../models/types';

describe('FactionDecisionAI', () => {
  const dummyAttacker = {
    id: 'f_warmonger',
    factionName: '鐵血好戰國',
    description: '好戰大公國',
    factionType: FactionType.GREAT_HOUSE,
    color: '#ff0000',
    resources: 6000,
    controlledNodes: ['node_atk'],
    capitalNodeId: 'node_atk',
    playerFavor: 0,
    relations: {},
    atWarWith: ['f_victim'],
    personality: FactionPersonality.WARMONGER,
  };

  const dummyVictim = {
    id: 'f_victim',
    factionName: '受害平原公國',
    description: '平原小國',
    factionType: FactionType.GREAT_HOUSE,
    color: '#00ff00',
    resources: 4000,
    controlledNodes: ['node_vic'],
    capitalNodeId: 'node_vic',
    playerFavor: 0,
    relations: {},
    atWarWith: ['f_warmonger'],
    personality: FactionPersonality.PEACEFUL,
  };

  const dummyNodes: MapNode[] = [
    {
      id: 'node_atk',
      name: '好戰堡壘',
      description: '好戰要塞',
      x: 20,
      y: 20,
      population: 100,
      prosperity: 50,
      isPlayerBase: false,
      isDiscovered: true,
      feature: NodeFeature.OCCUPIABLE,
      isScouted: true,
      scoutExpiryDate: 0,
      terrain: TerrainType.PLAINS,
      nodeLevel: NodeLevel.CAPITAL,
      ownerFactionId: 'f_warmonger',
      currentWeather: WeatherType.CLEAR,
      weatherDuration: 5,
    },
    {
      id: 'node_vic',
      name: '受害要塞',
      description: '受害防禦城鎮',
      x: 30,
      y: 30,
      population: 100,
      prosperity: 50,
      isPlayerBase: false,
      isDiscovered: true,
      feature: NodeFeature.OCCUPIABLE,
      isScouted: true,
      scoutExpiryDate: 0,
      terrain: TerrainType.PLAINS,
      nodeLevel: NodeLevel.TOWN,
      ownerFactionId: 'f_victim',
      currentWeather: WeatherType.CLEAR,
      weatherDuration: 5,
    },
  ];

  it('triggers DEFENSIVE_HOLD when treasury is depleted (Circuit Breaker 1)', () => {
    const profile = createDefaultFactionProfile(dummyAttacker);
    profile.economy.treasury = 500; // 國庫見底

    const decision = FactionDecisionAI.evaluateDecision(profile, [profile], dummyNodes);
    expect(decision.type).toBe('DEFENSIVE_HOLD');
  });

  it('triggers SEEK_TRUCE when war weariness is excessively high (Circuit Breaker 2)', () => {
    const profile = createDefaultFactionProfile(dummyAttacker);
    profile.warWeariness = 80;

    const victimProfile = createDefaultFactionProfile(dummyVictim);
    const decision = FactionDecisionAI.evaluateDecision(profile, [profile, victimProfile], dummyNodes);
    expect(decision.type).toBe('SEEK_TRUCE');
    expect(decision.targetFactionId).toBe('f_victim');
  });

  it('prohibits attacking factions covered by truce protection', () => {
    const profile = createDefaultFactionProfile(dummyAttacker);
    profile.truceWith = { f_victim: 120 }; // 120 天停戰協議

    const victimProfile = createDefaultFactionProfile(dummyVictim);
    const decision = FactionDecisionAI.evaluateDecision(profile, [profile, victimProfile], dummyNodes);
    expect(decision.type).not.toBe('LAUNCH_SIEGE');
    expect(decision.type).not.toBe('BORDER_RAID');
  });

  it('chooses to raid or siege enemy node when well equipped and at war', () => {
    const profile = createDefaultFactionProfile(dummyAttacker);
    profile.military.infantry = 120;
    profile.military.siegeRams = 2;

    const victimProfile = createDefaultFactionProfile(dummyVictim);
    const decision = FactionDecisionAI.evaluateDecision(profile, [profile, victimProfile], dummyNodes);
    expect(['LAUNCH_SIEGE', 'BORDER_RAID']).toContain(decision.type);
    expect(decision.targetFactionId).toBe('f_victim');
    expect(decision.targetNodeId).toBe('node_vic');
  });
});
