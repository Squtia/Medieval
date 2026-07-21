import { afterEach, describe, expect, it } from 'vitest';
import { Random, SeededRandomSource } from '../core/Random';
import { DataStore } from './DataStore';

describe('recruit traits', () => {
  afterEach(() => Random.reset());

  it('never includes the initial hero exclusive guardian trait', () => {
    Random.setSource(new SeededRandomSource(20260721));
    const recruited = Array.from({ length: 500 }, () => DataStore.getRandomRecruitTrait().name);

    expect(recruited).not.toContain(DataStore.TraitDB.GUARDIAN.name);
    expect(new Set(recruited).size).toBeGreaterThan(1);
  });
});
