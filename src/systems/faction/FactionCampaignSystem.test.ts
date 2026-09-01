import { describe, it, expect } from 'vitest';
import { createDefaultFactionProfile } from '../../models/FactionProfile';
import { FactionCampaignSystem } from './FactionCampaignSystem';
import { FactionNarrativeBridge } from './FactionNarrativeBridge';
import { FactionType, FactionPersonality, NodeLevel, NodeFeature, WeatherType, TerrainType, MapNode } from '../../models/types';

describe('FactionCampaignSystem & FactionNarrativeBridge', () => {
  const dummyAttacker = {
    id: 'f_atk',
    factionName: '北境大公國',
    description: '鐵血軍閥',
    factionType: FactionType.GREAT_HOUSE,
    color: '#ff0000',
    resources: 5000,
    controlledNodes: ['n_atk'],
    capitalNodeId: 'n_atk',
    playerFavor: 0,
    relations: {},
    atWarWith: ['f_def'],
    personality: FactionPersonality.WARMONGER,
  };

  const dummyDefender = {
    id: 'f_def',
    factionName: '南方聯盟',
    description: '貿易富庶邦國',
    factionType: FactionType.GREAT_HOUSE,
    color: '#0000ff',
    resources: 8000,
    controlledNodes: ['n_def'],
    capitalNodeId: 'n_def',
    playerFavor: 0,
    relations: {},
    atWarWith: ['f_atk'],
    personality: FactionPersonality.MERCHANT,
  };

  const dummyOrigin: MapNode = {
    id: 'n_atk',
    name: '極北冰堡',
    description: '北境大本營',
    x: 10,
    y: 10,
    population: 100,
    prosperity: 50,
    isPlayerBase: false,
    isDiscovered: true,
    feature: NodeFeature.OCCUPIABLE,
    isScouted: true,
    scoutExpiryDate: 0,
    terrain: TerrainType.SNOW_MOUNTAIN,
    nodeLevel: NodeLevel.CAPITAL,
    ownerFactionId: 'f_atk',
    currentWeather: WeatherType.CLEAR,
    weatherDuration: 5,
  };

  const dummyTarget: MapNode = {
    id: 'n_def',
    name: '黃金要塞',
    description: '南方重鎮',
    x: 40,
    y: 40,
    population: 100,
    prosperity: 50,
    isPlayerBase: false,
    isDiscovered: true,
    feature: NodeFeature.OCCUPIABLE,
    isScouted: true,
    scoutExpiryDate: 0,
    terrain: TerrainType.PLAINS,
    nodeLevel: NodeLevel.TOWN,
    ownerFactionId: 'f_def',
    currentWeather: WeatherType.CLEAR,
    weatherDuration: 5,
  };

  it('correctly launches a border raid campaign and advances marching progression', () => {
    const atk = createDefaultFactionProfile(dummyAttacker);
    const def = createDefaultFactionProfile(dummyDefender);

    const campaign = FactionCampaignSystem.launchCampaign(atk, def.id, dummyOrigin, dummyTarget, 'BORDER_RAID');
    expect(campaign.status).toBe('MARCHING');
    expect(campaign.infantry).toBeGreaterThan(0);
    expect(atk.military.activeCampaignId).toBe(campaign.id);

    // 推進至抵達掠奪
    for (let i = 0; i < campaign.totalDays; i++) {
      FactionCampaignSystem.stepCampaigns([campaign], [atk, def], [dummyOrigin, dummyTarget], i + 1);
    }

    expect(campaign.status).toBe('RETURNING');
    expect(campaign.lootResult?.gold).toBeGreaterThan(0);
    expect(def.economy.treasury).toBeLessThan(8000);
  });

  it('correctly resolves siege warfare, city capture and 180-day truce', () => {
    const atk = createDefaultFactionProfile(dummyAttacker);
    const def = createDefaultFactionProfile(dummyDefender);
    atk.military.infantry = 300; // 強大攻城主力
    atk.military.siegeRams = 2;

    const campaign = FactionCampaignSystem.launchCampaign(atk, def.id, dummyOrigin, dummyTarget, 'SIEGE');
    
    // 行軍抵達
    while (campaign.status === 'MARCHING') {
      FactionCampaignSystem.stepCampaigns([campaign], [atk, def], [dummyOrigin, dummyTarget], 1);
    }
    expect(campaign.status).toBe('SIEGING');

    // 圍城決戰
    while (campaign.status === 'SIEGING') {
      FactionCampaignSystem.stepCampaigns([campaign], [atk, def], [dummyOrigin, dummyTarget], 1);
    }

    expect(dummyTarget.ownerFactionId).toBe('f_atk');
    expect(atk.truceWith['f_def']).toBe(180);
    expect(def.truceWith['f_atk']).toBe(180);
  });

  it('interpolates story tags and generates tavern rumors accurately', () => {
    const atk = createDefaultFactionProfile(dummyAttacker);
    const textTemplate = '你在【{NODE_NAME}】面見了【{NODE_OCCUPIER}】的首領【{NODE_RULER_NAME}】。{WAR_ATMOSPHERE}';

    const rendered = FactionNarrativeBridge.interpolateStoryText(textTemplate, {
      targetNode: dummyTarget,
      controllingFaction: atk,
      isWarZone: true,
    });

    expect(rendered).toContain('黃金要塞');
    expect(rendered).toContain('北境大公國');
    expect(rendered).toContain('戒備森嚴');

    const rumors = FactionNarrativeBridge.translateCampaignToRumors([
      { campaignId: 'c1', event: 'CITY_FALLEN', message: '破城' },
      { campaignId: 'c2', event: 'RAID_COMPLETED', message: '洗劫' },
    ]);

    expect(rumors.length).toBe(2);
    expect(rumors[0]).toContain('大陸捷報');
    expect(rumors[1]).toContain('商旅快訊');
  });
});
