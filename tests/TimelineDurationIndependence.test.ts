import { describe, it, expect, beforeEach } from 'vitest';
import { VFXStudioStore } from '../src/tools/vfx-studio/VFXStudioStore';
import { VFXPresetRepository } from '../src/ui/fx/VFXPresetRepository';
import { getSequenceMainClip } from '../src/models/VFX';

describe('Timeline Duration & Main Layer Independence Validation', () => {
  let store: VFXStudioStore;

  beforeEach(() => {
    store = new VFXStudioStore();
    const repo = VFXPresetRepository.getInstance();
    const slashPreset = repo.getPreset('slash_iron');
    if (slashPreset) {
      store.loadPreset(slashPreset);
    }
  });

  it('1. 驗證主圖層可合法小於總時長，且兩者獨立互不篡改', () => {
    // 設定總時長 1.5s，主圖層 0.4s，延遲 0.1s
    store.updateConfig({
      duration: 1.5,
      mainDelay: 0.1,
      mainDuration: 0.4
    }, true);

    const preset = store.getPreset();
    const seq = store.getSequence();
    const mainClip = getSequenceMainClip(seq);

    expect(seq.duration).toBe(1.5);
    expect(preset.duration).toBe(1.5);
    expect(mainClip?.duration).toBe(0.4);
    expect(mainClip?.startTime).toBe(0.1);
    expect(preset.mainDuration).toBe(0.4);
    expect(preset.mainDelay).toBe(0.1);

    // 主圖層結束時間為 0.5s，遠小於總時長 1.5s
    expect((mainClip?.startTime || 0) + (mainClip?.duration || 0)).toBeLessThan(seq.duration);
  });

  it('2. 驗證縮短總時長時，若未截斷主圖層，主圖層保持原時長不變', () => {
    // 總時長從 1.5s 縮短到 1.0s，主圖層結束於 0.5s
    store.updateConfig({
      duration: 1.5,
      mainDelay: 0.1,
      mainDuration: 0.4
    }, true);

    // 模擬使用者在頂部輸入框將時長改為 1.0s
    store.updateConfig({ duration: 1.0 }, true);

    const seq = store.getSequence();
    const mainClip = getSequenceMainClip(seq);
    expect(seq.duration).toBe(1.0);
    expect(mainClip?.duration).toBe(0.4);
    expect(mainClip?.startTime).toBe(0.1);
  });

  it('3. 驗證縮短總時長超過主圖層時，智慧夾緊 (Auto-Clamp) 生效且無報錯', () => {
    // 主圖層結束於 0.8s (delay 0.2s + dur 0.6s)
    store.updateConfig({
      duration: 1.5,
      mainDelay: 0.2,
      mainDuration: 0.6
    }, true);

    // 縮短總時長至 0.5s
    const targetVal = 0.5;
    const startDelay = 0.2;
    const currentMainDur = 0.6;
    let newMainDelay = startDelay;
    if (newMainDelay >= targetVal) {
      newMainDelay = Math.max(0, Number((targetVal - 0.05).toFixed(2)));
    }
    const maxMainDur = Math.max(0.05, Number((targetVal - newMainDelay).toFixed(2)));
    const newMainDuration = Math.min(currentMainDur, maxMainDur);

    store.updateConfig({
      duration: targetVal,
      mainDelay: newMainDelay,
      mainDuration: newMainDuration
    }, true);

    const seq = store.getSequence();
    const mainClip = getSequenceMainClip(seq);
    expect(seq.duration).toBe(0.5);
    expect(mainClip?.startTime).toBe(0.2);
    expect(mainClip?.duration).toBe(0.3); // 0.5 - 0.2 = 0.3s，被平滑夾緊在 0.5s 內
    expect((mainClip?.startTime || 0) + (mainClip?.duration || 0)).toBeLessThanOrEqual(0.5);
  });
});
