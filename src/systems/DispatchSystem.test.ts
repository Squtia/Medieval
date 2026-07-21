import { beforeEach, describe, expect, it } from 'vitest';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';
import { Adventurer } from '../models/Adventurer';
import { DispatchTask, EnemyFeature, TaskType, TradePhase } from '../models/DispatchTask';
import { Territory } from '../models/Territory';
import { DataStore } from './DataStore';
import { DispatchSystem } from './DispatchSystem';

describe('trade mission lifecycle', () => {
  beforeEach(() => EventBus.getInstance().clearAll());

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
});
