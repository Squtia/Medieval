import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaybackClock } from '../../ui/fx/PlaybackClock';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { VFXTimeline } from '../../tools/vfx-studio/VFXTimeline';
import { VFXStudioStore } from '../../tools/vfx-studio/VFXStudioStore';
import { VFXPreset } from '../../models/VFX';

// ─────────────────────────────────────────────────────────────
// 🌐 輕量 Node 相容 DOM Mock 輔助物件
// ─────────────────────────────────────────────────────────────
class MockDOMNode {
  public id: string = '';
  public tagName: string = 'DIV';
  public textContent: string = '';
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  public classList = {
    _classes: new Set<string>(),
    contains: (c: string) => this.classList._classes.has(c),
    add: (c: string) => this.classList._classes.add(c),
    remove: (c: string) => this.classList._classes.delete(c)
  };
  public children: MockDOMNode[] = [];
  public parentNode: MockDOMNode | null = null;
  private listeners: Record<string, Function[]> = {};

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
  }

  public set innerHTML(html: string) {
    // 簡單解析標籤與 class / id / dataset
    this.children = [];
    const idMatches = html.matchAll(/id="([^"]+)"/g);
    for (const match of idMatches) {
      const child = new MockDOMNode('div');
      child.id = match[1];
      child.parentNode = this;
      this.children.push(child);
    }
    // 抓取 cue marker
    const cueMatches = html.matchAll(/class="[^"]*tl-cue-marker[^"]*"[^>]*data-cue-idx="(\d+)"/g);
    for (const match of cueMatches) {
      const child = new MockDOMNode('div');
      child.classList.add('tl-cue-marker');
      child.dataset['cueIdx'] = match[1];
      const timeTag = new MockDOMNode('span');
      timeTag.classList.add('tl-cue-time-tag');
      child.children.push(timeTag);
      child.parentNode = this;
      this.children.push(child);
    }
  }

  public addEventListener(event: string, fn: Function): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  public removeEventListener(event: string, fn: Function): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }
  }

  public dispatchEvent(evt: any): boolean {
    const list = this.listeners[evt.type] || [];
    list.forEach(fn => fn(evt));
    return true;
  }

  public querySelector(sel: string): MockDOMNode | null {
    if (sel.startsWith('#')) {
      const targetId = sel.slice(1);
      return this.findRecursive(n => n.id === targetId);
    }
    if (sel.startsWith('.')) {
      const targetClass = sel.slice(1);
      return this.findRecursive(n => n.classList.contains(targetClass));
    }
    return null;
  }

  public querySelectorAll(sel: string): MockDOMNode[] {
    const results: MockDOMNode[] = [];
    if (sel.startsWith('.')) {
      const targetClass = sel.slice(1);
      this.findAllRecursive(n => n.classList.contains(targetClass), results);
    }
    return results;
  }

  public getBoundingClientRect() {
    return { left: 0, top: 0, width: 500, height: 30, right: 500, bottom: 30, x: 0, y: 0 };
  }

  public setPointerCapture(_id: number) {}
  public releasePointerCapture(_id: number) {}

  private findRecursive(predicate: (n: MockDOMNode) => boolean): MockDOMNode | null {
    for (const child of this.children) {
      if (predicate(child)) return child;
      const sub = child.findRecursive(predicate);
      if (sub) return sub;
    }
    return null;
  }

  private findAllRecursive(predicate: (n: MockDOMNode) => boolean, acc: MockDOMNode[]): void {
    for (const child of this.children) {
      if (predicate(child)) acc.push(child);
      child.findAllRecursive(predicate, acc);
    }
  }
}

describe('Fix 2: PlaybackClock \u0026 VFXTimeline Verification (Batches E \u0026 F)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // ⏱️ 批次 E 測試：單一時鐘、播放速度、暫停與取消排程
  // ─────────────────────────────────────────────────────────────
  describe('批次 E：單一時鐘 (PlaybackClock) 與排程調度', () => {
    it('應驗證 0.3x, 1.0x, 2.0x 播放速度下，Cue 在相同的 normalized progress 觸發', () => {
      const duration = 1.0; // 1 秒特效
      const cueTime = 0.5;   // 50% 時間點的 Cue

      const speeds = [0.3, 1.0, 2.0];

      speeds.forEach(speed => {
        const clock = new PlaybackClock(duration);
        clock.setSpeed(speed);

        let cueFired = false;
        let progressAtFire = -1;

        clock.schedule(cueTime, () => {
          cueFired = true;
          progressAtFire = clock.getNormalizedProgress();
        });

        // 模擬步進：每步進真實 0.05 秒
        const step = 0.05;
        let totalRealTime = 0;
        while (!cueFired && totalRealTime < 5.0) {
          clock.advance(step);
          totalRealTime += step;
        }

        expect(cueFired).toBe(true);
        // 在三種不同速度下，觸發時的邏輯進度皆應等於或略大於 0.5 (容許 1 個步進的離散誤差)
        expect(progressAtFire).toBeGreaterThanOrEqual(0.5);
        expect(progressAtFire).toBeLessThan(0.65);
      });
    });

    it('應驗證 pause() 期間 advance 時間，無任何 cue 或 task 觸發；resume() 後繼續推進', () => {
      const clock = new PlaybackClock(1.0);
      let firedCount = 0;

      clock.schedule(0.2, () => { firedCount++; });
      clock.schedule(0.4, () => { firedCount++; });

      // 1. 推進到 0.1s
      clock.advance(0.1);
      expect(firedCount).toBe(0);

      // 2. 暫停
      clock.pause();
      expect(clock.isPaused()).toBe(true);

      // 模擬暫停期間流逝 500ms (0.5 秒)
      for (let i = 0; i < 10; i++) {
        const delta = clock.advance(0.05);
        expect(delta).toBe(0);
      }
      // 依舊維持 0 觸發
      expect(firedCount).toBe(0);
      expect(clock.getCurrentTime()).toBe(0.1);

      // 3. 恢復播放 (resume)
      clock.resume();
      expect(clock.isPaused()).toBe(false);

      // 推進 0.15s (累計 0.25s，跨過 0.2s Cue)
      clock.advance(0.15);
      expect(firedCount).toBe(1);

      // 再推進 0.2s (累計 0.45s，跨過 0.4s Cue)
      clock.advance(0.2);
      expect(firedCount).toBe(2);
    });

    it('應驗證 seek() 跨過 Cue 的明確行為：向後 seek 重置任務狀態，向前 seek 標記跨過任務', () => {
      const clock = new PlaybackClock(1.0);
      let cue1Fired = false;
      let cue2Fired = false;

      clock.schedule(0.3, () => { cue1Fired = true; });
      clock.schedule(0.7, () => { cue2Fired = true; });

      // 1. 正常前進到 0.4s (觸發 cue1)
      clock.advance(0.4);
      expect(cue1Fired).toBe(true);
      expect(cue2Fired).toBe(false);

      // 2. 向前 Seek 到 0.8s (預設 triggerSkippedCues: false，避免快轉瞬間爆發音效)
      clock.seek(0.8, false);
      expect(clock.getCurrentTime()).toBe(0.8);
      expect(clock.getPendingTaskCount()).toBe(0);

      // 3. 向後 Seek 到 0.2s (倒退時重置大於 0.2s 的任務為未觸發)
      clock.seek(0.2);
      expect(clock.getCurrentTime()).toBe(0.2);
      expect(clock.getPendingTaskCount()).toBe(2);

      // 重新檢查 task 狀態
      const tasks = clock.getTasks();
      expect(tasks[0].fired).toBe(false);
      expect(tasks[1].fired).toBe(false);
    });

    it('應驗證 clear() 後所有 pending 任務數歸零，舊回呼絕不再被執行', () => {
      const clock = new PlaybackClock(1.0);
      let fired = false;

      clock.schedule(0.5, () => { fired = true; });
      expect(clock.getPendingTaskCount()).toBe(1);

      clock.clear();
      expect(clock.getPendingTaskCount()).toBe(0);
      expect(clock.getCurrentTime()).toBe(0);

      // clear 後即使再度推進，已取消的任務也不會執行
      clock.advance(1.0);
      expect(fired).toBe(false);
    });

    it('應驗證連續快速播放 20 次，只有最後一個 session 的 callback 最終生效', () => {
      const engine = CombatFXEngine.getInstance();
      // 確保引擎處於測試活動狀態
      (engine as any).isRunning = true;

      const mockPreset: VFXPreset = {
        ...((VFXStudioStore.getInstance().getPreset())),
        id: 'TEST_PRESET',
        duration: 0.3,
        impactCues: [
          { cueId: 'CUE_1', time: 0.15, weight: 1.0, isPrimary: true }
        ]
      };

      const start = { x: 0, y: 0 };
      const end = { x: 100, y: 100 };

      const hitLogs: number[] = [];

      // 連續觸發 20 次播放，每一次都中斷前一次
      for (let i = 0; i < 20; i++) {
        const sessionIdx = i;
        engine.clear();
        engine.playPresetConfig(mockPreset, start, end, () => {
          hitLogs.push(sessionIdx);
        });
      }

      // 模擬時鐘推進完成最後一次播放
      const clock = engine.getPlaybackClock();
      clock.advance(0.4);

      // 只有最後一次 (index 19) 會產生 hitLog
      expect(hitLogs).toEqual([19]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 🎛️ 批次 F 測試：多軌時間軸組件、初始渲染、播放頭與拖曳交易
  // ─────────────────────────────────────────────────────────────
  describe('批次 F：VFXTimeline 時間軸編輯能力與 Undo Transaction', () => {
    let mockContainer: any;

    beforeEach(() => {
      mockContainer = new MockDOMNode('div');
    });

    it('應驗證 VFXTimeline constructor 完成後立即 render 當前 Preset，DOM 具備刻度尺、播放頭與所有軌道', () => {
      const timeline = new VFXTimeline(mockContainer as HTMLElement);

      // 1. 驗證時間顯示存在
      const timeDisplay = mockContainer.querySelector('#tl-time-display');
      expect(timeDisplay).not.toBeNull();

      // 2. 驗證時間尺規 (Ruler) 存在
      const ruler = mockContainer.querySelector('#tl-ruler-bar');
      expect(ruler).not.toBeNull();

      // 3. 驗證動態播放頭 (.tl-playhead) 存在
      const playhead = mockContainer.querySelector('#tl-playhead');
      expect(playhead).not.toBeNull();

      // 4. 驗證 Cue Marker 存在
      const cueMarkers = mockContainer.querySelectorAll('.tl-cue-marker');
      expect(cueMarkers.length).toBeGreaterThan(0);
    });

    it('應驗證動態播放頭 updatePlayhead 會即時更新 style.left 與文字顯示', () => {
      const timeline = new VFXTimeline(mockContainer as HTMLElement);
      const playhead = mockContainer.querySelector('#tl-playhead') as any;
      const timeDisplay = mockContainer.querySelector('#tl-time-display') as any;

      timeline.updatePlayhead(0.25, 0.5);

      expect(timeDisplay.textContent).toContain('0.25s');
      expect(playhead.style.left).toContain('0.5');
    });

    it('應驗證 Cue Marker 拖曳是一筆 Undo Transaction：拖曳中不堆疊 Undo，結束時提交唯一快照', () => {
      const store = VFXStudioStore.getInstance();
      const initialPreset = store.getPreset();
      const initialCues = [
        { cueId: 'CUE_1', time: 0.1, weight: 1.0, isPrimary: false },
        { cueId: 'CUE_2', time: 0.3, weight: 1.0, isPrimary: true }
      ];
      store.setPreset({ ...initialPreset, duration: 0.5, impactCues: initialCues }, false);

      const timeline = new VFXTimeline(mockContainer as HTMLElement);
      const markerEl = mockContainer.querySelector('.tl-cue-marker') as any;
      expect(markerEl).not.toBeNull();

      // 1. Pointer Down
      markerEl.dispatchEvent({ type: 'pointerdown', clientX: 100, pointerId: 1, stopPropagation: () => {} });

      // 2. 模擬連續移動 5 次 (pointermove)
      for (let i = 1; i <= 5; i++) {
        markerEl.dispatchEvent({ type: 'pointermove', clientX: 100 + i * 20, pointerId: 1 });
      }

      // 拖曳中：Undo 堆疊不暴增
      // 3. Pointer Up 提交
      markerEl.dispatchEvent({ type: 'pointerup', clientX: 200, pointerId: 1 });

      // 驗證最終時間已被更新為 200/500 * 0.5 = 0.20s
      const updatedPreset = store.getPreset();
      const movedCue = updatedPreset.impactCues?.find(c => c.cueId === 'CUE_1');
      expect(movedCue?.time).toBe(0.20);

      // 驗證可以正確 Undo 回到初始狀態
      expect(store.canUndo()).toBe(true);
      store.undo();
      const undonePreset = store.getPreset();
      const restoredCue = undonePreset.impactCues?.find(c => c.cueId === 'CUE_1');
      expect(restoredCue?.time).toBe(0.1);
    });
  });
});
