import { describe, expect, it } from 'vitest';
import { DispatchTask, EnemyFeature, TaskType, TradePhase, normalizeTradeTask } from '../models/DispatchTask';
import { buildTradeRouteSegments } from './MapPresentation';

function tradeTask(): DispatchTask {
  return new DispatchTask('測試商隊', TaskType.TRADE, 1, 0, 0, 0, 0, EnemyFeature.BALANCED);
}

describe('trade route presentation', () => {
  it('marks the first outbound leg as current before the first waypoint', () => {
    const task = tradeTask();
    task.tradeItineraryNodeIds = ['town-a', 'town-b'];
    task.tradePhase = TradePhase.OUTBOUND;
    task.currentLegIndex = 0;

    expect(buildTradeRouteSegments(task, 'home')).toEqual([
      { startNodeId: 'home', endNodeId: 'town-a', isCurrent: true },
      { startNodeId: 'town-a', endNodeId: 'town-b', isCurrent: false },
      { startNodeId: 'town-b', endNodeId: 'home', isCurrent: false }
    ]);
  });

  it('reconstructs a legacy returning route and highlights its return leg', () => {
    const task = tradeTask();
    task.tradeRouteNodeIds = [];
    task.tradeInstructions = [
      { nodeId: 'town-a', buy: [], sell: [] },
      { nodeId: 'town-b', buy: [], sell: [] }
    ];
    task.currentRouteIndex = 2;

    normalizeTradeTask(task);
    expect(task.tradePhase).toBe(TradePhase.RETURNING);
    const segments = buildTradeRouteSegments(task, 'home');
    expect(segments[segments.length - 1]).toEqual({
      startNodeId: 'town-b', endNodeId: 'home', isCurrent: true
    });
  });
});
