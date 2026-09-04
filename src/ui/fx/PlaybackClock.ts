/**
 * ⏱️ PlaybackClock
 * 單一演出邏輯時鐘與事件調度器 (Single Logical Playback Clock & Scheduler)
 * 嚴格遵循 docs/VFX_STUDIO_GEMINI_3_8_FLASH_ACCEPTANCE_FIX.md 規範：
 * - 動畫進度、Cue、圖層、受擊反饋與清理全部讀取同一 logical time。
 * - speed 僅縮放 logical time 推進比例，禁止散落 wall-clock setTimeout。
 * - pause 時 logical time 不前進，任何 cue 均不得觸發。
 * - resume 從原邏輯點繼續，不重入、不殘留。
 * - seek 行為明確且可驗證。
 * - clear/abort 後所有 pending task 歸零。
 */

export interface ScheduledTask {
  id: number;
  triggerTime: number; // 邏輯秒數 (seconds)
  callback: () => void;
  fired: boolean;
  cancelled: boolean;
}

export type TickListener = (currentTime: number, progress: number) => void;

export class PlaybackClock {
  private currentTime: number = 0; // 當前邏輯秒數
  private duration: number = 1.0;  // 總秒數
  private speed: number = 1.0;     // 播放倍率 (0.05 ~ 5.0)
  private paused: boolean = false;
  private tasks: ScheduledTask[] = [];
  private nextTaskId: number = 1;
  private tickListeners: Set<TickListener> = new Set();

  constructor(duration: number = 1.0) {
    this.duration = Math.max(0.01, duration);
  }

  public setDuration(duration: number): void {
    this.duration = Math.max(0.01, duration);
  }

  public getDuration(): number {
    return this.duration;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getNormalizedProgress(): number {
    if (this.duration <= 0) return 0;
    return Math.min(1.0, Math.max(0, this.currentTime / this.duration));
  }

  public setSpeed(speed: number): void {
    this.speed = Math.max(0.05, Math.min(speed, 5.0));
  }

  public getSpeed(): number {
    return this.speed;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
  }

  /**
   * 排程在指定邏輯秒數 (triggerTimeInSeconds) 觸發回呼
   */
  public schedule(triggerTimeInSeconds: number, callback: () => void): number {
    const id = this.nextTaskId++;
    this.tasks.push({
      id,
      triggerTime: Math.max(0, triggerTimeInSeconds),
      callback,
      fired: false,
      cancelled: false
    });
    // 依 triggerTime 排序確保依序執行
    this.tasks.sort((a, b) => a.triggerTime - b.triggerTime);
    return id;
  }

  public cancelTask(taskId: number): void {
    const t = this.tasks.find(x => x.id === taskId);
    if (t) {
      t.cancelled = true;
    }
  }

  /**
   * 推進時鐘（由 requestAnimationFrame 渲染迴圈或單元測試呼叫）
   * @param rawDeltaSeconds 真實經過時間 (秒)
   * @returns 實際推進的邏輯 delta 秒數
   */
  public advance(rawDeltaSeconds: number): number {
    if (this.paused) return 0;
    const delta = rawDeltaSeconds * this.speed;
    const prevTime = this.currentTime;
    this.currentTime += delta;

    // 觸發在 [prevTime, this.currentTime] 之間到期的 task
    for (const task of this.tasks) {
      if (!task.fired && !task.cancelled && task.triggerTime <= this.currentTime) {
        task.fired = true;
        try {
          task.callback();
        } catch (err) {
          console.error('[PlaybackClock] Task callback execution error:', err);
        }
      }
    }

    // 廣播 tick 狀態
    const progress = this.getNormalizedProgress();
    this.tickListeners.forEach(fn => fn(this.currentTime, progress));

    return delta;
  }

  /**
   * Seek 到指定秒數
   * @param targetTimeSeconds 目標秒數
   * @param triggerSkippedCues 是否執行跨過的 cues（預設 false，避免 seek 時重複爆發舊 cue）
   */
  public seek(targetTimeSeconds: number, triggerSkippedCues: boolean = false): void {
    const clamped = Math.max(0, Math.min(targetTimeSeconds, this.duration));
    const prevTime = this.currentTime;
    this.currentTime = clamped;

    if (clamped < prevTime) {
      // 倒退 seek：將大於 targetTime 的任務重置為未觸發狀態
      for (const task of this.tasks) {
        if (task.triggerTime > clamped) {
          task.fired = false;
        }
      }
    } else {
      // 向前 seek：處理跨過的任務
      for (const task of this.tasks) {
        if (!task.fired && !task.cancelled && task.triggerTime <= clamped) {
          if (triggerSkippedCues) {
            task.fired = true;
            try {
              task.callback();
            } catch (err) {
              console.error('[PlaybackClock] Seek task error:', err);
            }
          } else {
            // 標記已觸發但不執行 callback
            task.fired = true;
          }
        }
      }
    }

    const progress = this.getNormalizedProgress();
    this.tickListeners.forEach(fn => fn(this.currentTime, progress));
  }

  /**
   * 重置並清空所有待辦任務與時鐘進度
   */
  public clear(): void {
    for (const task of this.tasks) {
      task.cancelled = true;
    }
    this.tasks = [];
    this.currentTime = 0;
    const progress = 0;
    this.tickListeners.forEach(fn => fn(0, progress));
  }

  public onTick(listener: TickListener): () => void {
    this.tickListeners.add(listener);
    return () => this.tickListeners.delete(listener);
  }

  public getPendingTaskCount(): number {
    return this.tasks.filter(t => !t.fired && !t.cancelled).length;
  }

  public getTasks(): readonly ScheduledTask[] {
    return this.tasks;
  }
}
