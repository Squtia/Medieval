import { describe, expect, it } from 'vitest';
import { calendarToTotalDays } from './Calendar';

describe('calendarToTotalDays', () => {
  it('converts the 30-day calendar into a monotonic day number', () => {
    expect(calendarToTotalDays(1, 1, 1)).toBe(1);
    expect(calendarToTotalDays(1, 2, 1)).toBe(31);
    expect(calendarToTotalDays(2, 1, 1)).toBe(361);
  });
});
