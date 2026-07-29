export interface RandomSource {
  next(): number;
}

class NativeRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

export class SeededRandomSource implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    // Mulberry32: compact, deterministic and sufficient for gameplay simulation.
    this.state += 0x6d2b79f5;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
}

export function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0 || 1;

  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function createSeededRandom(seed: string | number): SeededRandomSource {
  return new SeededRandomSource(hashSeed(seed));
}

let source: RandomSource = new NativeRandomSource();

export const Random = {
  next(): number {
    return source.next();
  },

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  },

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty collection.');
    return items[Math.floor(this.next() * items.length)];
  },

  setSource(nextSource: RandomSource): void {
    source = nextSource;
  },

  reset(): void {
    source = new NativeRandomSource();
  }
};
