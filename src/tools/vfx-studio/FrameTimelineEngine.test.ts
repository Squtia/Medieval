import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FrameTimelineEngine } from './FrameTimelineEngine';

describe('FrameTimelineEngine (確定性影格引擎測試)', () => {
  let engine: FrameTimelineEngine;

  beforeEach(() => {
    // 0.5 秒，60 FPS => 30 幀
    engine = new FrameTimelineEngine(0.5, 60);
  });

  afterEach(() => {
    engine.destroy();
  });

  it('應正確初始化影格數據（60 FPS, 0.5s = 30 幀）', () => {
    expect(engine.getFps()).toBe(60);
    expect(engine.getDuration()).toBe(0.5);
    expect(engine.getTotalFrames()).toBe(30);
    expect(engine.getCurrentFrame()).toBe(0);
    expect(engine.getCurrentTime()).toBe(0);
    expect(engine.getProgress()).toBe(0);
    expect(engine.getState()).toBe('STOPPED');
  });

  it('應支援逐影格步進 stepNext 與邊界約束', () => {
    engine.setLoop(false);

    engine.stepNext();
    expect(engine.getCurrentFrame()).toBe(1);
    expect(engine.getCurrentTime()).toBeCloseTo(1 / 60, 4);
    expect(engine.getState()).toBe('PAUSED');

    engine.stepNext(4);
    expect(engine.getCurrentFrame()).toBe(5);

    // 推進超過總幀數時應停在最後一幀 (非循環)
    engine.stepNext(50);
    expect(engine.getCurrentFrame()).toBe(30);
  });

  it('應支援逐影格倒帶 stepPrev 與邊界約束', () => {
    engine.setLoop(false);
    engine.seekToFrame(5);
    expect(engine.getCurrentFrame()).toBe(5);

    engine.stepPrev();
    expect(engine.getCurrentFrame()).toBe(4);

    engine.stepPrev(10);
    expect(engine.getCurrentFrame()).toBe(0);
  });

  it('應在循環模式下於邊界處無縫回滾', () => {
    engine.setLoop(true);
    engine.seekToFrame(30);

    // 在最後一幀 stepNext 應回滾到第 0 幀
    engine.stepNext();
    expect(engine.getCurrentFrame()).toBe(0);

    // 在第 0 幀 stepPrev 應跳至最後一幀
    engine.stepPrev();
    expect(engine.getCurrentFrame()).toBe(30);
  });

  it('應精準支援 seekToFrame 與 seekToTime', () => {
    engine.seekToFrame(15);
    expect(engine.getCurrentFrame()).toBe(15);
    expect(engine.getProgress()).toBe(0.5);
    expect(engine.getCurrentTime()).toBeCloseTo(0.25, 3);

    // 0.333 秒在 60FPS 下約為第 20 幀
    engine.seekToTime(0.3333);
    expect(engine.getCurrentFrame()).toBe(20);
  });

  it('應正確廣播 onFrame 事件與 onStateChange 事件', () => {
    let lastFrame = -1;
    let lastProgress = -1;
    engine.onFrame((data) => {
      lastFrame = data.frame;
      lastProgress = data.progress;
    });

    let lastState = '';
    engine.onStateChange((state) => {
      lastState = state;
    });

    engine.stepNext(10);
    expect(lastFrame).toBe(10);
    expect(lastProgress).toBeCloseTo(10 / 30, 4);
    expect(lastState).toBe('PAUSED');

    engine.stop();
    expect(lastFrame).toBe(0);
    expect(lastState).toBe('STOPPED');
  });
});
