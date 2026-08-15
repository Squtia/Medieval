import { describe, expect, it } from 'vitest';
import { calculateFloatingPosition } from './FloatingPosition';

describe('floating element position', () => {
  it('flips tooltip to the left/top when exceeding viewport and space is available', () => {
    expect(calculateFloatingPosition({
      pointerX: 790,
      pointerY: 590,
      elementWidth: 220,
      elementHeight: 180,
      viewportWidth: 800,
      viewportHeight: 600
    })).toEqual({ x: 555, y: 395 });
  });

  it('keeps oversized content anchored to the safe padding when neither side fits', () => {
    expect(calculateFloatingPosition({
      pointerX: 0,
      pointerY: 0,
      elementWidth: 900,
      elementHeight: 700,
      viewportWidth: 800,
      viewportHeight: 600
    })).toEqual({ x: 12, y: 12 });
  });

  it('positions normally when right/bottom space is sufficient', () => {
    expect(calculateFloatingPosition({
      pointerX: 100,
      pointerY: 100,
      elementWidth: 200,
      elementHeight: 100,
      viewportWidth: 800,
      viewportHeight: 600
    })).toEqual({ x: 115, y: 115 });
  });
});
