import { describe, expect, it } from 'vitest';
import { calculateFloatingPosition } from './FloatingPosition';

describe('floating element position', () => {
  it('keeps a tooltip inside the bottom-right viewport boundary', () => {
    expect(calculateFloatingPosition({
      pointerX: 790,
      pointerY: 590,
      elementWidth: 220,
      elementHeight: 180,
      viewportWidth: 800,
      viewportHeight: 600
    })).toEqual({ x: 568, y: 408 });
  });

  it('keeps oversized content anchored to the safe padding', () => {
    expect(calculateFloatingPosition({
      pointerX: 0,
      pointerY: 0,
      elementWidth: 900,
      elementHeight: 700,
      viewportWidth: 800,
      viewportHeight: 600
    })).toEqual({ x: 12, y: 12 });
  });
});
