import { VFXScheduler } from '../../ui/fx/VFXScheduler';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';

export type FrameTimelineState = 'STOPPED' | 'PLAYING' | 'PAUSED';

export interface FrameData {
  frame: number;
  totalFrames: number;
  time: number;
  duration: number;
  progress: number;
}

export type FrameListener = (data: FrameData) => void;
export type StateChangeListener = (state: FrameTimelineState) => void;

/**
 * ⏱️ FrameTimelineEngine
 * 嚴格遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 3.2 節與第 6 節規範：
 * 1. 徹底消滅雙重時鐘 (Dual Clocks) 違規，單一真相來源為 VFXScheduler。
 * 2. 移除獨立的 requestAnimationFrame 迴圈，時間軸進度 100% 由 VFXScheduler 的 tick 驅動。
 * 3. 嚴格以 60 FPS 整數影格對應邏輯演出秒數，支援 pause、seek、慢動作與無殘留重播。
 */
export class FrameTimelineEngine {
  private fps: number = 60;
  private currentFrame: number = 0;
  private totalFrames: number = 30;
  private duration: number = 0.5;
  private speed: number = 1.0;
  private isLooping: boolean = true;
  private state: FrameTimelineState = 'STOPPED';
  private scheduler: VFXScheduler;

  private frameListeners: Set<FrameListener> = new Set();
  private stateListeners: Set<StateChangeListener> = new Set();

  private isEmitting: boolean = false;

  constructor(duration: number = 0.5, fps: number = 60, scheduler?: VFXScheduler) {
    this.fps = Math.max(10, Math.min(fps, 120));
    this.scheduler = scheduler || CombatFXEngine.getInstance().getScheduler();
    this.setDuration(duration);

    // 初始強制處於暫停凍結狀態，嚴禁時鐘在背景空轉偷跑
    this.scheduler.pause();
    this.scheduler.seek(0, false);

    // 🌟 單一時鐘管線：監聽 VFXScheduler 的 tick 廣播，整數影格完全同步（含防重入鎖）
    this.scheduler.onTick((currentTime, progress) => {
      if (this.state === 'PLAYING' && !this.isEmitting) {
        this.isEmitting = true;
        try {
          const total = this.totalFrames;
          const nextFrame = Math.min(total, Math.round(progress * total));
          this.currentFrame = nextFrame;
          this.emitFrame();

          if (progress >= 1.0) {
            if (this.isLooping) {
              this.currentFrame = 0;
              this.scheduler.seek(0, false);
              this.emitFrame();
            } else {
              this.pause();
            }
          }
        } finally {
          this.isEmitting = false;
        }
      }
    });
  }

  public setFps(fps: number): void {
    this.fps = Math.max(10, Math.min(fps, 120));
    this.updateTotalFrames();
    this.emitFrame();
  }

  public getFps(): number {
    return this.fps;
  }

  public setDuration(seconds: number): void {
    this.duration = Math.max(0.05, seconds);
    this.scheduler.setDuration(this.duration);
    this.updateTotalFrames();
    if (this.currentFrame > this.totalFrames) {
      this.currentFrame = this.totalFrames;
    }
    this.emitFrame();
  }

  public getDuration(): number {
    return this.duration;
  }

  private updateTotalFrames(): void {
    this.totalFrames = Math.max(1, Math.round(this.duration * this.fps));
  }

  public getTotalFrames(): number {
    return this.totalFrames;
  }

  public getCurrentFrame(): number {
    return this.currentFrame;
  }

  public getCurrentTime(): number {
    return Number((this.currentFrame / this.fps).toFixed(4));
  }

  public getProgress(): number {
    if (this.totalFrames <= 0) return 0;
    return Math.min(1.0, Math.max(0, this.currentFrame / this.totalFrames));
  }

  public getState(): FrameTimelineState {
    return this.state;
  }

  public isPlaying(): boolean {
    return this.state === 'PLAYING';
  }

  public isPaused(): boolean {
    return this.state === 'PAUSED';
  }

  public isStopped(): boolean {
    return this.state === 'STOPPED';
  }

  public setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(speed, 5.0));
  }

  public getSpeed(): number {
    return this.speed;
  }

  public setLoop(loop: boolean): void {
    this.isLooping = loop;
  }

  public getLoop(): boolean {
    return this.isLooping;
  }

  public onFrame(listener: FrameListener): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  public onStateChange(listener: StateChangeListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public getCurrentFrameData(): FrameData {
    return {
      frame: this.currentFrame,
      totalFrames: this.totalFrames,
      time: this.getCurrentTime(),
      duration: this.duration,
      progress: this.getProgress()
    };
  }

  private emitFrame(): void {
    const data = this.getCurrentFrameData();
    for (const fn of this.frameListeners) {
      try {
        fn(data);
      } catch (err) {
        console.error('Error in FrameTimelineEngine listener:', err);
      }
    }
  }

  private setState(nextState: FrameTimelineState): void {
    if (this.state === nextState) return;
    this.state = nextState;
    for (const fn of this.stateListeners) {
      try {
        fn(this.state);
      } catch (err) {
        console.error('Error in FrameTimelineEngine state listener:', err);
      }
    }
  }

  /**
   * ▶ 播放：從當前影格開始逐格向前推進
   * 若當前已在最後一幀，自動循環回 Frame 0 重新播放
   */
  /**
   * ▶ 播放：直接喚醒 VFXScheduler 演出時鐘推進
   */
  public play(): void {
    if (this.currentFrame >= this.totalFrames || this.scheduler.getNormalizedProgress() >= 1.0) {
      this.currentFrame = 0;
      this.scheduler.seek(0, false);
    }
    this.setState('PLAYING');
    this.scheduler.resume();
    this.emitFrame();
  }

  /**
   * ⏸ 暫停：凍結 VFXScheduler 演出時鐘
   */
  public pause(): void {
    this.setState('PAUSED');
    this.scheduler.pause();
  }

  /**
   * ⏹ 停止：重置至第 0 幀並重置 VFXScheduler
   */
  public stop(): void {
    this.currentFrame = 0;
    this.setState('STOPPED');
    this.scheduler.seek(0, false);
    this.scheduler.pause();
    this.emitFrame();
  }

  /**
   * ⏯ 播放/暫停雙向切換
   */
  public togglePlayPause(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * ⏩ 逐格前進：向前推進 n 個影格 (預設 1 幀)
   */
  public stepNext(frames: number = 1): void {
    if (this.isPlaying()) {
      this.pause();
    }
    const count = Math.max(1, Math.round(frames));
    const target = this.currentFrame + count;
    this.seekToFrame(target > this.totalFrames ? (this.isLooping ? 0 : this.totalFrames) : target);
  }

  /**
   * ⏪ 逐格倒帶：向後倒退 n 個影格 (預設 1 幀)
   */
  public stepPrev(frames: number = 1): void {
    if (this.isPlaying()) {
      this.pause();
    }
    const count = Math.max(1, Math.round(frames));
    const target = this.currentFrame - count;
    this.seekToFrame(target < 0 ? (this.isLooping ? this.totalFrames : 0) : target);
  }

  /**
   * 🎯 跳轉至指定整數影格 F 並精確同步 VFXScheduler 邏輯秒數
   */
  public seekToFrame(targetFrame: number): void {
    const wasPlaying = this.isPlaying();
    if (wasPlaying) {
      this.pause();
    }
    this.currentFrame = Math.max(0, Math.min(Math.round(targetFrame), this.totalFrames));
    const targetTime = this.getCurrentTime();
    this.scheduler.seek(targetTime, false);
    this.setState('PAUSED');
    this.emitFrame();
  }

  /**
   * ⏱️ 跳轉至指定秒數 t（自動吸附至最近的整數影格）並定格
   */
  public seekToTime(timeSeconds: number): void {
    const targetFrame = Math.round(timeSeconds * this.fps);
    this.seekToFrame(targetFrame);
  }

  public destroy(): void {
    this.frameListeners.clear();
    this.stateListeners.clear();
  }
}
