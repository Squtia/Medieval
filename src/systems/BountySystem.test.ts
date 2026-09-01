import { describe, expect, it } from 'vitest';
import { AdventurerState } from '../models/types';
import { BountySystem } from './BountySystem';

function makeState(bounty: any) {
  return {
    bounties: [bounty, ...Array.from({ length: 9 }, (_, index) => ({ id: `pending_${index}`, status: 'PENDING', expireDays: 99 }))],
    adventurers: [{ id: 'merc_1', name: '測試傭兵', currentState: AdventurerState.DISPATCHED }],
    myTerritory: { security: 50 }
  };
}

describe('BountySystem', () => {
  it('計時委託完成時立即釋放傭兵，不必等到領獎', () => {
    const state = makeState({ id: 'b1', name: '巡邏', status: 'IN_PROGRESS', remainingDuration: 1, dispatchedMercId: 'merc_1', type: 'NORMAL' });
    BountySystem.processDailyTick(state);
    expect(state.bounties[0].status).toBe('COMPLETED');
    expect(state.adventurers[0].currentState).toBe(AdventurerState.IDLE);
  });

  it('會修復舊存檔中已完成但仍卡在派遣狀態的傭兵', () => {
    const state = makeState({ id: 'b1', name: '舊委託', status: 'COMPLETED', dispatchedMercId: 'merc_1' });
    BountySystem.processDailyTick(state);
    expect(state.adventurers[0].currentState).toBe(AdventurerState.IDLE);
  });

  it('討伐指定據點勝利後才完成驗收型委託', () => {
    const state = makeState({ id: 'b1', name: '討伐', status: 'IN_PROGRESS', dispatchedMercId: 'merc_1', objective: { type: 'SUBJUGATE_NODE', targetNodeId: 'fort_a' } });
    expect(BountySystem.handleSubjugationCompleted(state, 'fort_b', true)).toBe(0);
    expect(BountySystem.handleSubjugationCompleted(state, 'fort_a', false)).toBe(0);
    expect(BountySystem.handleSubjugationCompleted(state, 'fort_a', true)).toBe(1);
    expect(state.bounties[0].status).toBe('COMPLETED');
    expect(state.adventurers[0].currentState).toBe(AdventurerState.IDLE);
  });
});
