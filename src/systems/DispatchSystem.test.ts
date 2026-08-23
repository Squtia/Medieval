import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';
import { Adventurer } from '../models/Adventurer';
import { DispatchTask, EnemyFeature, TaskType, TradePhase } from '../models/DispatchTask';
import { Territory } from '../models/Territory';
import { DataStore } from './DataStore';
import { DispatchSystem } from './DispatchSystem';
import { RoadSystem } from './RoadSystem';

describe('trade mission lifecycle', () => {
  beforeEach(() => {
    EventBus.getInstance().clearAll();
    GameState.roadSystem = new RoadSystem();
  });

  it('advances through outbound legs and completes only after returning home', () => {
    const territory = new Territory('測試領地', 'home');
    const adventurer = new Adventurer('a1', '測試者', DataStore.JobDB.WARRIOR, DataStore.TraitDB.BRAVE);
    const nodes = [
      { id: 'home', name: '領地', x: 0, y: 0, isPlayerBase: true, currentWeather: 'CLEAR' },
      { id: 'town-a', name: '城鎮 A', x: 15, y: 0, isPlayerBase: false, currentWeather: 'CLEAR' },
      { id: 'town-b', name: '城鎮 B', x: 30, y: 0, isPlayerBase: false, currentWeather: 'CLEAR' }
    ];
    GameState.mapSystem = {
      getNodeById: (id: string) => nodes.find(node => node.id === id),
      getNodes: () => nodes
    } as any;

    const system = new DispatchSystem(territory);
    const task = new DispatchTask('雙城商隊', TaskType.TRADE, 1, 0, 0, 0, 0, EnemyFeature.BALANCED);
    task.tradeItineraryNodeIds = ['town-a', 'town-b'];
    task.tradeInstructions = [];
    task.caravanCargo = {};
    task.caravanGold = 100;
    task.initialCaravanGold = 100;

    const changes: string[] = [];
    EventBus.getInstance().subscribe(GameEventType.MISSIONS_CHANGED, payload => changes.push(payload.reason));
    system.dispatchAdventurers([adventurer], task);
    system.updateDays(1);
    expect(task.currentLegIndex).toBe(1);
    expect(task.tradePhase).toBe(TradePhase.OUTBOUND);

    system.updateDays(1);
    expect(task.tradePhase).toBe(TradePhase.RETURNING);
    expect(system.getActiveMissionsCount()).toBe(1);

    system.updateDays(2);
    expect(system.getActiveMissionsCount()).toBe(0);
    expect(changes).toEqual(['DISPATCHED', 'PROGRESSED', 'PROGRESSED', 'COMPLETED']);
  });

  it('blocks dispatch when team contains more than 1 UR quality adventurer', () => {
    const territory = new Territory('測試領地', 'home');
    const advUR1 = new Adventurer('ur1', '英雄1', DataStore.JobDB.WARRIOR, DataStore.TraitDB.BRAVE, 'UR');
    const advUR2 = new Adventurer('ur2', '英雄2', DataStore.JobDB.MAGE, DataStore.TraitDB.BRAVE, 'UR');
    const advSSR = new Adventurer('ssr1', '英雄3', DataStore.JobDB.ARCHER, DataStore.TraitDB.BRAVE, 'SSR');

    const system = new DispatchSystem(territory);
    const task = new DispatchTask('討伐魔王', TaskType.COMBAT, 1, 10, 100, 10, 10, EnemyFeature.BALANCED);

    // 超過 1 位 UR 派遣失敗
    system.dispatchAdventurers([advUR1, advUR2, advSSR], task);
    expect(system.getActiveMissions().length).toBe(0);

    // 只有 1 位 UR + 其他品質 派遣成功
    system.dispatchAdventurers([advUR1, advSSR], task);
    expect(system.getActiveMissions().length).toBe(1);
  });

  it('uses completed roads for outbound and return travel time', () => {
    const territory = new Territory('道路測試領', 'home');
    const adventurer = new Adventurer(
      'a1',
      '道路測試者',
      DataStore.JobDB.WARRIOR,
      DataStore.TraitDB.BRAVE
    );
    const nodes = [
      { id: 'home', name: '本據點', x: 0, y: 0, isPlayerBase: true, currentWeather: 'CLEAR' },
      {
        id: 'town',
        name: '遠方城鎮',
        x: 45,
        y: 0,
        isPlayerBase: false,
        isScouted: true,
        currentWeather: 'CLEAR',
        marketData: {
          goods: [{ goodId: 'grain', buyPrice: 100, sellPrice: 100, stock: 10 }]
        }
      }
    ];
    GameState.mapSystem = {
      getNodeById: (id: string) => nodes.find(node => node.id === id),
      getNodes: () => nodes
    } as any;
    GameState.roadSystem = new RoadSystem({
      roads: [{
        id: 'road_1',
        originNodeId: 'home',
        targetNodeId: 'town',
        lengthPixels: 720,
        completedDay: 1
      }],
      projects: [],
      nextRoadId: 2
    });

    const timing = GameState.roadSystem.getTravelDays(nodes[0] as any, nodes[1] as any);
    expect(timing).toEqual({ baseDays: 3, adjustedDays: 2, hasRoad: true });

    const system = new DispatchSystem(territory);
    const task = new DispatchTask('道路商隊', TaskType.TRADE, timing.adjustedDays, 0, 0, 0, 0);
    task.tradeItineraryNodeIds = ['town'];
    task.tradeInstructions = [{
      nodeId: 'town',
      buy: [{ goodId: 'grain', maxAmount: 1 }],
      sell: []
    }];
    task.caravanCargo = {};
    task.caravanGold = 100;
    task.initialCaravanGold = 100;

    system.dispatchAdventurers([adventurer], task);
    system.updateDays(2);
    expect(task.tradePhase).toBe(TradePhase.RETURNING);
    expect(system.getActiveMissions()[0].remainingDays).toBe(2);
    const negotiationBonus = adventurer.getTradeStats().negotiationBonus;
    const roadBuyPrice = Math.max(1, Math.round(100 * (1 - negotiationBonus) * 0.95));
    expect(task.caravanGold).toBe(100 - roadBuyPrice);
    expect(task.caravanCargo?.grain).toBe(1);
    system.updateDays(2);
    expect(system.getActiveMissionsCount()).toBe(0);
  });
});
