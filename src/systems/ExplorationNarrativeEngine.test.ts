import { describe, it, expect } from 'vitest';
import { ExplorationNarrativeEngine } from './ExplorationNarrativeEngine';

describe('ExplorationNarrativeEngine - Dynamic Capture Rate Engine Tests', () => {
  it('1. 滅國絕境圍城戰 (isLastStand = true) 時，俘虜率必為 100%', () => {
    // 即使傳入自訂 rate 或攻城標記，只要是滅國絕境必為 100
    const rate1 = ExplorationNarrativeEngine.calculateCaptureRate(undefined, true, true);
    expect(rate1).toBe(100);

    const rate2 = ExplorationNarrativeEngine.calculateCaptureRate(30, true, false);
    expect(rate2).toBe(100);
  });

  it('2. 單位有自訂 captureRate 時，非滅國情況優先採用自訂數值', () => {
    // 自訂 0% (狂熱死士 / 永不被俘)
    const rateZero = ExplorationNarrativeEngine.calculateCaptureRate(0, false, true);
    expect(rateZero).toBe(0);

    // 自訂 80% (容易投降派)
    const rateHigh = ExplorationNarrativeEngine.calculateCaptureRate(80, false, false);
    expect(rateHigh).toBe(80);

    // 防呆邊界 120 限制在 100，-20 限制在 0
    expect(ExplorationNarrativeEngine.calculateCaptureRate(120, false, false)).toBe(100);
    expect(ExplorationNarrativeEngine.calculateCaptureRate(-20, false, false)).toBe(0);
  });

  it('3. 未指定自訂 captureRate 時，攻城戰 (isSiege = true) 預設為 40%', () => {
    const rate = ExplorationNarrativeEngine.calculateCaptureRate(undefined, false, true);
    expect(rate).toBe(40);
  });

  it('4. 未指定自訂 captureRate 時，野外遭遇/討伐據點預設為 25%', () => {
    const rate = ExplorationNarrativeEngine.calculateCaptureRate(undefined, false, false);
    expect(rate).toBe(25);
  });
});
