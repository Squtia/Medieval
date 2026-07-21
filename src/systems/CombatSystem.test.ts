import { afterEach, describe, expect, it } from 'vitest';
import { GameState } from '../core/GameState';
import { Random, SeededRandomSource } from '../core/Random';
import { FormationRow } from '../models/types';
import { CombatSystem } from './CombatSystem';

function fighter(stats: { hp: number; atk: number; def: number; hit: number; evade: number }) {
  return {
    id: 'hero',
    name: 'Test Hero',
    formationRow: FormationRow.FRONT,
    getCombatStats: () => ({ ...stats, mp: 0 })
  } as any;
}

describe('CombatSystem', () => {
  afterEach(() => Random.reset());

  it('requires enemies to be defeated before reporting victory', () => {
    Random.setSource(new SeededRandomSource(10));
    GameState.adventurers = [fighter({ hp: 10000, atk: 0, def: 10000, hit: 0, evade: 10000 })];
    const report = CombatSystem.simulateCombat(['hero'], 80);
    expect(report.isVictory).toBe(false);
    expect(report.battleLog).toContain('僵局');
  });

  it('reports victory when the final enemy wave is cleared', () => {
    Random.setSource(new SeededRandomSource(10));
    GameState.adventurers = [fighter({ hp: 1000, atk: 10000, def: 1000, hit: 1000, evade: 1000 })];
    const report = CombatSystem.simulateCombat(['hero'], 10);
    expect(report.isVictory).toBe(true);
  });
});
