import { VFXSequence } from '../../models/VFX';
import { VFXStudioStore } from './VFXStudioStore';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { VFXTimelineEvaluator } from '../../ui/fx/VFXTimelineEvaluator';
import { FrameTimelineEngine, FrameData } from './FrameTimelineEngine';
import { TimelineView } from './timeline/TimelineView';
import { TimelineSelection, SelectedTrackInfo } from './timeline/TimelineSelection';
import { TimelineCommands } from './timeline/TimelineCommands';
import { TimelineInteraction } from './timeline/TimelineInteraction';

/**
 * ⏱️ VFXTimeline
 * 專業多軌時間軸編輯組件 (Multi-track Sequence Timeline Facade)
 * 將選取狀態 (TimelineSelection)、命令操作 (TimelineCommands)、
 * 視圖渲染 (TimelineView) 與指標互動 (TimelineInteraction) 解耦調度，由純確定性 FrameTimelineEngine 驅動
 */
export class VFXTimeline {
  private container: HTMLElement;
  private store: VFXStudioStore;
  private fxEngine: CombatFXEngine;
  private frameEngine: FrameTimelineEngine;
  private duration: number = 0.5;

  private selection: TimelineSelection;
  private commands: TimelineCommands;
  private interaction: TimelineInteraction;

  private unsubscribeStore?: () => void;
  private keydownHandler?: (e: KeyboardEvent) => void;

  private onScrubStartCallback?: () => void;
  private onScrubCallback?: (targetTime: number) => void;
  private onScrubEndCallback?: (targetTime: number) => void;
  private onPlayPauseToggleCallback?: (isPaused: boolean) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.store = VFXStudioStore.getInstance();
    this.fxEngine = CombatFXEngine.getInstance();

    const initialDuration = Math.max(0.05, VFXTimelineEvaluator.getEffectivePresentationDuration(this.store.getPreset()));
    this.frameEngine = new FrameTimelineEngine(initialDuration, 60);

    this.selection = new TimelineSelection();
    this.commands = new TimelineCommands(this.store);
    this.interaction = new TimelineInteraction(
      this.container,
      this.store,
      this.frameEngine,
      this.fxEngine,
      this.selection,
      this.commands,
      {
        requestRender: () => this.render(this.store.getPreset()),
        onScrubStart: () => this.onScrubStartCallback?.(),
        onScrub: (time: number) => this.onScrubCallback?.(time),
        onScrubEnd: (time: number) => this.onScrubEndCallback?.(time)
      }
    );

    this.frameEngine.onFrame((data) => {
      this.updateFrameUI(data);
      this.onScrubCallback?.(data.time);
    });

    this.frameEngine.onStateChange((state) => {
      this.updateStateUI(state);
      this.onPlayPauseToggleCallback?.(state === 'PAUSED');
    });

    // 鍵盤 Delete / Backspace 刪除選中的 Cue
    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.target && ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT')) return;
        const selectedCueIdx = this.selection.getSelectedCueIndex();
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedCueIdx !== null && selectedCueIdx >= 0) {
          this.selection.selectCue(null);
          this.commands.deleteCue(selectedCueIdx);
          this.render(this.store.getPreset());
        }
      };
      window.addEventListener('keydown', this.keydownHandler);
    }

    this.unsubscribeStore = this.store.subscribe((preset) => {
      if (this.interaction && this.interaction.isDragging()) {
        return; // 🛡️ 拖曳 Cue 或 Clip 期間禁止銷毀重繪 DOM，保護指針捕獲與連續拖曳流暢度
      }
      const effectiveDur = VFXTimelineEvaluator.getEffectivePresentationDuration(preset);
      if (effectiveDur && effectiveDur !== this.frameEngine.getDuration()) {
        this.frameEngine.setDuration(effectiveDur);
      }
      this.render(preset);
    });

    // 🌟 規範 8.2.1：constructor 完成後立即 render 當前 Preset
    this.render(this.store.getPreset());
  }

  public onSelectCue(cb: (cueIndex: number | null) => void): void {
    this.selection.onSelectCue(cb);
  }

  public onSelectTrack(cb: (trackInfo: SelectedTrackInfo) => void): void {
    this.selection.onSelectTrack(cb);
  }

  public getFrameEngine(): FrameTimelineEngine {
    return this.frameEngine;
  }

  public onScrubStart(cb: () => void): void {
    this.onScrubStartCallback = cb;
  }

  public onScrub(cb: (targetTime: number) => void): void {
    this.onScrubCallback = cb;
  }

  public onScrubEnd(cb: (targetTime: number) => void): void {
    this.onScrubEndCallback = cb;
  }

  public onPlayPauseToggle(cb: (isPaused: boolean) => void): void {
    this.onPlayPauseToggleCallback = cb;
  }

  public getIsPaused(): boolean {
    return this.frameEngine.isPaused();
  }

  public getCurrentTime(): number {
    return this.frameEngine.getCurrentTime();
  }

  public setPaused(paused: boolean): void {
    if (paused) {
      this.frameEngine.pause();
    } else {
      this.frameEngine.play();
    }
  }

  public seekTo(targetTime: number): void {
    this.frameEngine.seekToTime(targetTime);
    this.fxEngine.seek(targetTime);
  }

  public updateFrameUI(data: FrameData): void {
    const playhead = this.container.querySelector('#tl-playhead') as HTMLElement;
    const timeDisplay = this.container.querySelector('#tl-time-display') as HTMLElement;

    if (playhead) {
      const rulerBar = this.container.querySelector('#tl-ruler-bar') as HTMLElement;
      if (rulerBar && rulerBar.offsetWidth > 0) {
        const offsetLeft = rulerBar.offsetLeft;
        const width = rulerBar.offsetWidth;
        playhead.style.left = `${offsetLeft + width * data.progress}px`;
      } else {
        const pct = Math.min(100, Math.max(0, data.progress * 100));
        playhead.style.left = `calc(148px + (100% - 148px) * ${pct / 100})`;
      }
    }

    if (timeDisplay) {
      const frameStr = data.frame.toString().padStart(2, '0');
      timeDisplay.textContent = `Frame: ${frameStr} / ${data.totalFrames} (${data.time.toFixed(2)}s / ${data.duration.toFixed(2)}s)`;
    }
  }

  public updatePlayhead(currentTime: number, progress: number): void {
    const totalFrames = this.frameEngine.getTotalFrames();
    const frame = Math.round(progress * totalFrames);
    this.updateFrameUI({
      frame,
      totalFrames,
      time: currentTime,
      duration: this.frameEngine.getDuration(),
      progress
    });
  }

  public updateStateUI(state: string): void {
    const btnPlayPause = this.container.querySelector('#tl-btn-play-pause') as HTMLButtonElement | null;
    if (btnPlayPause) {
      const isPlaying = state === 'PLAYING';
      btnPlayPause.textContent = isPlaying ? '⏸ 暫停' : '▶ 播放';
      btnPlayPause.style.color = isPlaying ? '#fbbf24' : '#38bdf8';
    }
  }

  public render(preset: VFXSequence): void {
    this.duration = Math.max(0.1, VFXTimelineEvaluator.getEffectivePresentationDuration(preset));

    const html = TimelineView.renderHTML({
      preset,
      duration: this.duration,
      totalFrames: this.frameEngine.getTotalFrames(),
      isPaused: this.frameEngine.isPaused(),
      selectedClipIndex: this.selection.getSelectedClipIndex(),
      selectedCueIndex: this.selection.getSelectedCueIndex(),
      trackMuteStates: this.store.getTrackMuteStates(),
      soloTrack: this.store.getSoloTrack(),
      allPresets: VFXPresetRepository.getInstance().getAllPresets(),
      isTrackLocked: (key: string) => this.store.isTrackLocked(key),
      isTrackSoloed: (key: string) => this.store.isTrackSoloed(key)
    });

    this.container.innerHTML = html;
    this.interaction.bindEvents(this.duration);
  }

  public destroy(): void {
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = undefined;
    }
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.frameEngine.destroy();
  }
}
