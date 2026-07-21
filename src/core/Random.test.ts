import { afterEach, describe, expect, it } from 'vitest';
import { Random, SeededRandomSource } from './Random';

describe('Random', () => {
  afterEach(() => Random.reset());

  it('replays the same sequence for the same seed', () => {
    Random.setSource(new SeededRandomSource(42));
    const first = [Random.next(), Random.next(), Random.int(1, 10)];
    Random.setSource(new SeededRandomSource(42));
    const second = [Random.next(), Random.next(), Random.int(1, 10)];
    expect(second).toEqual(first);
  });

  it('keeps integer rolls inside the requested range', () => {
    Random.setSource(new SeededRandomSource(7));
    const values = Array.from({ length: 100 }, () => Random.int(3, 5));
    expect(values.every(value => value >= 3 && value <= 5)).toBe(true);
  });
});
