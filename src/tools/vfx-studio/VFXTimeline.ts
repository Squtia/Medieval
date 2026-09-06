import { VFXImpactCue, VFXPreset, getTrajectorySpatialAnchor } from '../../models/VFX';
import { VFXStudioStore } from './VFXStudioStore';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { FrameTimelineEngine, FrameData } from './FrameTimelineEngine';

/**
 * ⏱️ VFXTimeline
 * 專業多軌時間軸編輯組件 (Multi-track Sequence Timeline & Scrubbing Controller)
 * 由純確定性 FrameTimelineEngine 驅動，嚴格對齊 60 FPS 影格刻度
 */
export class VFXTimeline {
  private container: HTMLElement;
  private store: VFXStudioStore;
  private fxEngine: CombatFXEngine;
  private frameEngine: FrameTimelineEngine;
  private duration: number = 0.5;
  private isDraggingCue: boolean = false;
  private isDraggingClip: boolean = false;
  private activeDragCueIndex: number = -1;
  private isScrubbingPlayhead: boolean = false;
  private selectedClipIndex: number | null = null;
  private selectedCueIndex: number | null = null;
  private onScrubStartCallback?: () => void;
  private onScrubCallback?: (targetTime: number) => void;
  private onScrubEndCallback?: (targetTime: number) => void;
  private onPlayPauseToggleCallback?: (isPaused: boolean) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.store = VFXStudioStore.getInstance();
    this.fxEngine = CombatFXEngine.getInstance();

    const initialDuration = Math.max(0.05, this.store.getPreset().duration || 0.5);
    this.frameEngine = new FrameTimelineEngine(initialDuration, 60);

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
      window.addEventListener('keydown', (e) => {
        if (e.target && ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT')) return;
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedCueIndex !== null && this.selectedCueIndex >= 0) {
          const cues = [...(this.store.getPreset().impactCues || [])];
          if (cues.length > 0) {
            cues.splice(this.selectedCueIndex, 1);
            this.selectedCueIndex = null;
            this.store.updateConfig({ impactCues: cues }, true);
          }
        }
      });
    }

    this.store.subscribe((preset) => {
      // 拖曳 Cue 或 Clip 期間不重建整張 DOM，避免中斷指標捕捉
      if (!this.isDraggingCue && !this.isScrubbingPlayhead && !this.isDraggingClip) {
        if (preset.duration && preset.duration !== this.frameEngine.getDuration()) {
          this.frameEngine.setDuration(preset.duration);
        }
        this.render(preset);
      }
    });

    // 🌟 規範 8.2.1：constructor 完成後立即 render 當前 Preset
    this.render(this.store.getPreset());
  }

  private onSelectCueCallback?: (cueIndex: number | null) => void;
  private onSelectTrackCallback?: (trackInfo: { type: 'MAIN' | 'LAYER' | 'CUE'; index?: number } | null) => void;

  public onSelectCue(cb: (cueIndex: number | null) => void): void {
    this.onSelectCueCallback = cb;
  }

  public onSelectTrack(cb: (trackInfo: { type: 'MAIN' | 'LAYER' | 'CUE'; index?: number } | null) => void): void {
    this.onSelectTrackCallback = cb;
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

  public render(preset: VFXPreset): void {
    this.duration = Math.max(0.1, preset.duration || 0.4);
    const cues = preset.impactCues || [];
    const layers = preset.layers || [];
    const mutes = this.store.getTrackMuteStates();
    const soloTrack = this.store.getSoloTrack();

    // 計算尺規時間刻度 (每 0.1s 一個主刻度，若 duration 較長則彈性遞增)
    const step = this.duration > 1.2 ? 0.2 : 0.1;
    const tickCount = Math.floor(this.duration / step);
    const rulerTicks: { time: number; pct: number }[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const t = Number((i * step).toFixed(2));
      if (t <= this.duration) {
        rulerTicks.push({ time: t, pct: (t / this.duration) * 100 });
      }
    }
    if (rulerTicks.length === 0 || rulerTicks[rulerTicks.length - 1].time < this.duration) {
      rulerTicks.push({ time: this.duration, pct: 100 });
    }

    const anchor = getTrajectorySpatialAnchor(preset.trajectory);
    const anchorLabel = anchor === 'AT_CASTER' ? '🏠 自身(A)' : anchor === 'TRAJECTORY' ? '🚀 彈道(A➔B)' : '💥 目標(B)';
    const mainDelay = Math.max(0, preset.mainDelay || 0);
    const mainDuration = Math.max(0.05, Math.min(this.duration - mainDelay, preset.mainDuration !== undefined ? preset.mainDuration : (this.duration - mainDelay)));
    const mainStartPct = Math.min(95, Math.max(0, (mainDelay / this.duration) * 100));
    const mainDurPct = Math.min(100 - mainStartPct, Math.max(5, (mainDuration / this.duration) * 100));
    const allPresets = VFXPresetRepository.getInstance().getAllPresets();

    this.container.innerHTML = `
      <div class="vfx-timeline-panel" style="background: #111827; border-top: 1px solid #374151; padding: 6px 14px 10px 14px; font-size: 0.75rem; color: #9ca3af; display: flex; flex-direction: column; gap: 6px; user-select: none; position: relative;">
        <!-- 頂部標題、秒數與功能控制列 -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1f2937; padding-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: bold; color: #38bdf8; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
              ⏱️ 專業多軌時間軸 (Multi-track Timeline)
            </span>
            <span id="tl-time-display" style="color: #fbbf24; font-family: monospace; font-weight: bold; background: #1e293b; padding: 2px 8px; border-radius: 4px; border: 1px solid #334155;">
              Frame: 00 / ${this.frameEngine.getTotalFrames()} (0.00s / ${this.duration.toFixed(2)}s)
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="tl-btn-play-pause" style="background: #1e293b; border: 1px solid #475569; color: ${this.frameEngine.isPaused() ? '#38bdf8' : '#fbbf24'}; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; font-weight: bold;" title="切換播放/暫停 (Space)">${this.frameEngine.isPaused() ? '▶ 播放' : '⏸ 暫停'}</button>
            <button id="tl-btn-step-prev" style="background: #1e293b; border: 1px solid #475569; color: #cbd5e1; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;" title="後退一幀 (-1 Frame)">⏪ -1 幀</button>
            <button id="tl-btn-step-next" style="background: #1e293b; border: 1px solid #475569; color: #cbd5e1; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;" title="前進一幀 (+1 Frame)">⏩ +1 幀</button>
            <button id="tl-btn-stop" style="background: #1e293b; border: 1px solid #475569; color: #f87171; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;" title="停止並重置至第 0 幀">⏹ 重置</button>
            <button id="tl-btn-add-cue" style="background: #1e293b; border: 1px solid #475569; color: #38bdf8; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; transition: background 0.15s;" title="在當前時間或尾端新增一個打擊 Cue">➕ 新增 Cue</button>
            <select id="tl-presentation-mode" style="background: #1e293b; border: 1px solid #475569; color: #fbbf24; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem;">
              <option value="EXACT_IMPACTS" ${preset.impactPresentationMode === 'EXACT_IMPACTS' ? 'selected' : ''}>🎯 真多段 EXACT</option>
              <option value="SPLIT_SINGLE_IMPACT" ${preset.impactPresentationMode === 'SPLIT_SINGLE_IMPACT' ? 'selected' : ''}>⚖️ 拆分 SPLIT</option>
              <option value="PRIMARY_ONLY" ${preset.impactPresentationMode === 'PRIMARY_ONLY' ? 'selected' : ''}>🏁 終擊 PRIMARY</option>
            </select>
          </div>
        </div>

        <!-- ⏱️ 多軌與時間尺規工作區 (含動態貫穿播放頭) -->
        <div id="tl-workspace" style="position: relative; display: flex; flex-direction: column; gap: 4px;">
          <!-- 播放頭 (Playhead) 貫穿整個工作區：初始對齊 0s 刻度 (148px) -->
          <div id="tl-playhead" class="tl-playhead" style="position: absolute; left: 148px; top: 0; bottom: 0; width: 2px; background: #ef4444; z-index: 50; pointer-events: auto; cursor: ew-resize; box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);">
            <div style="position: absolute; top: -2px; left: -5px; width: 12px; height: 10px; background: #ef4444; clip-path: polygon(0 0, 100% 0, 50% 100%);"></div>
          </div>

          <!-- 軌道 0: 時間刻度尺 (Ruler Track) -->
          <div class="tl-track-row" style="display: flex; align-items: center; gap: 8px;">
            <div class="tl-track-header" style="width: 140px; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: #64748b; font-size: 0.7rem; font-weight: 600;">刻度尺 (Ruler)</span>
            </div>
            <div id="tl-ruler-bar" class="tl-track-bar tl-ruler-bar" style="flex: 1; height: 18px; background: #0f172a; border: 1px solid #334155; border-radius: 3px; position: relative; cursor: pointer;">
              ${rulerTicks.map(t => `
                <div style="position: absolute; left: ${t.pct}%; top: 0; bottom: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; pointer-events: none;">
                  <div style="width: 1px; height: 6px; background: #475569;"></div>
                  <span style="font-size: 0.6rem; color: #94a3b8; font-family: monospace; transform: scale(0.9);">${t.time}s</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- 軌道 1: 主特效圖層 (Layer 0 - 基礎主軌) -->
          <div class="tl-track-row" style="display: flex; align-items: center; gap: 8px;">
            <div class="tl-track-header" style="width: 140px; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: #38bdf8; font-weight: bold; font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">👑 主圖層 (L0)</span>
              <div style="display: flex; gap: 2px;">
                <button class="tl-solo-btn ${this.store.isTrackSoloed('main') ? 'active' : ''}" data-track="main" style="background: ${this.store.isTrackSoloed('main') ? '#eab308' : '#334155'}; color: ${this.store.isTrackSoloed('main') ? '#000' : '#fff'}; font-weight: bold; border: none; padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="獨奏主圖層 (Solo)">S</button>
                <button class="tl-mute-btn ${mutes.main ? 'active' : ''}" data-track="main" style="background: ${mutes.main ? '#ef4444' : '#334155'}; color: #fff; border: none; padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="靜音主圖層 (Mute)">M</button>
                <button class="tl-lock-btn ${this.store.isTrackLocked('main') ? 'active' : ''}" data-track="main" style="background: ${this.store.isTrackLocked('main') ? '#d97706' : '#1e293b'}; color: ${this.store.isTrackLocked('main') ? '#fff' : '#94a3b8'}; border: 1px solid ${this.store.isTrackLocked('main') ? '#f59e0b' : '#475569'}; padding: 1px 3px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="${this.store.isTrackLocked('main') ? '已鎖定 (Lock)' : '未鎖定'}">${this.store.isTrackLocked('main') ? '🔒' : '🔓'}</button>
              </div>
            </div>
            <div id="tl-main-track-bar" class="tl-track-bar" style="flex: 1; height: 20px; background: #1e293b; border-radius: 3px; position: relative; border: 1px solid #334155;">
              <div class="tl-main-clip ${this.store.isTrackLocked('main') ? 'locked' : ''}" style="position: absolute; left: ${mainStartPct}%; top: 1px; bottom: 1px; width: ${mainDurPct}%; background: linear-gradient(90deg, rgba(56, 189, 248, 0.75), rgba(2, 132, 199, 0.9)); border: 1px solid #38bdf8; border-radius: 2px; display: flex; align-items: center; justify-content: space-between; padding: 0 5px; font-size: 0.65rem; color: #fff; cursor: ${this.store.isTrackLocked('main') ? 'not-allowed' : 'grab'}; user-select: none; touch-action: none;" title="主圖層: ${anchorLabel} ${preset.trajectoryPath || preset.trajectory || 'DIRECT'}${preset.reverse ? ' [🔄反向]' : ''}\n起點: ${mainDelay.toFixed(2)}s | 時長: ${mainDuration.toFixed(2)}s\n(${this.store.isTrackLocked('main') ? '🔒 已鎖定禁止拖動' : '拖動本體調整起始前搖 / 拖拉右緣調整時長'})">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; font-size: 0.64rem;">
                  <b style="color: #fef08a;">${anchorLabel}</b> ${preset.trajectoryPath || preset.trajectory || 'DIRECT'}${preset.reverse ? ' 🔄' : ''} (${mainDuration.toFixed(2)}s)
                </span>
                <div class="tl-main-resize-handle" style="width: 6px; height: 100%; background: #bae6fd; opacity: 0.9; cursor: ${this.store.isTrackLocked('main') ? 'not-allowed' : 'ew-resize'}; border-radius: 1px; margin-right: -3px;" title="${this.store.isTrackLocked('main') ? '🔒 已鎖定禁止拉伸' : '拖動調整主圖層時長'}"></div>
              </div>
            </div>
          </div>

          <!-- 軌道 2..N: 獨立次生圖層列表 (Multi-layer Tracks) -->
          ${layers.map((layer, idx) => {
            const lDelay = Math.max(0, layer.delay || 0);
            const lDur = Math.max(0.05, Math.min(this.duration - lDelay, layer.duration !== undefined ? layer.duration : 0.2));
            const startPct = Math.min(95, Math.max(0, (lDelay / this.duration) * 100));
            const durPct = Math.min(100 - startPct, Math.max(5, (lDur / this.duration) * 100));
            const lAnchor = getTrajectorySpatialAnchor(layer.spatialMode || layer.trajectory);
            const lAnchorLabel = layer.spatialMode === 'AT_CASTER' ? '🏠自身' : layer.spatialMode === 'AT_TARGET' ? '💥目標' : layer.spatialMode === 'VERTICAL_SKY_TO_B' ? '⚡天降' : layer.spatialMode === 'DIAGONAL_SKY_TO_B' ? '☄️斜降' : layer.spatialMode === 'A_TO_VERTICAL_SKY' ? '🏹朝天' : layer.spatialMode === 'A_TO_DIAGONAL_SKY' ? '🚀斜空' : (lAnchor === 'AT_CASTER' ? '🏠自身' : lAnchor === 'AT_TARGET' ? '💥目標' : '🚀彈道');
            const isMuted = layer.enabled === false;
            const isSoloed = this.store.isTrackSoloed(`layer_${idx}`);
            const isLocked = this.store.isTrackLocked(`layer_${idx}`);
            const refPreset = allPresets.find(p => p.id === layer.presetId);
            const refDisplayName = refPreset ? refPreset.name : (layer.presetId || layer.shaderMode || `圖層 ${idx + 1}`);
            const isClipSelected = this.selectedClipIndex === idx;
            const fadeInVal = layer.fadeIn ?? 0.05;
            const fadeOutVal = layer.fadeOut ?? 0.08;
            const inWidthPct = Math.max(3, Math.min(40, (fadeInVal / lDur) * 100));
            const outWidthPct = Math.max(3, Math.min(40, (fadeOutVal / lDur) * 100));

            return `
              <div class="tl-track-row tl-layer-track-row" data-layer-idx="${idx}" style="display: flex; align-items: center; gap: 8px;">
                <div class="tl-track-header" style="width: 140px; display: flex; align-items: center; justify-content: space-between;">
                  <div style="display: flex; align-items: center; gap: 3px; max-width: 90px;">
                    <!-- 🎨 直接在圖層 Header 自由選擇/切換素材 -->
                    <select class="tl-layer-preset-select" data-layer-idx="${idx}" ${isLocked ? 'disabled' : ''} style="width: 72px; background: #0f172a; border: 1px solid ${isLocked ? '#475569' : '#3b82f6'}; color: #93c5fd; font-size: 0.61rem; padding: 1px; border-radius: 3px; text-overflow: ellipsis;" title="${isLocked ? '🔒 軌道已鎖定無法更換' : '切換此圖層引用的特效素材'}">
                      <option value="" disabled ${!layer.presetId ? 'selected' : ''}>-- 選擇素材 --</option>
                      ${allPresets.map(p => {
                        const anchor = getTrajectorySpatialAnchor(p.spatialMode || p.trajectoryPath || p.trajectory);
                        const tag = anchor === 'AT_CASTER' ? '[自身]' : anchor === 'TRAJECTORY' ? '[彈道]' : '[目標]';
                        return `<option value="${p.id}" ${p.id === layer.presetId ? 'selected' : ''}>${tag} ${p.name || p.id}</option>`;
                      }).join('')}
                    </select>
                    ${layer.presetId ? `
                      <button class="tl-btn-jump-preset" data-preset-id="${layer.presetId}" style="background: transparent; border: none; color: #38bdf8; font-size: 0.6rem; cursor: pointer; padding: 0;" title="🔗 暫存當前技能並跳轉編輯原素材 [${refDisplayName}]">🔗</button>
                    ` : ''}
                  </div>
                  <div style="display: flex; gap: 2px;">
                    <button class="tl-layer-solo-btn ${isSoloed ? 'active' : ''}" data-layer-idx="${idx}" style="background: ${isSoloed ? '#eab308' : '#334155'}; color: ${isSoloed ? '#000' : '#fff'}; font-weight: bold; border: none; padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="獨奏此圖層 (Solo)">S</button>
                    <button class="tl-layer-toggle-btn" data-layer-idx="${idx}" style="background: ${isMuted ? '#ef4444' : '#334155'}; color: #fff; border: none; padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="${isMuted ? '啟用圖層' : '靜音圖層'}">${isMuted ? '❌' : '👁️'}</button>
                    <button class="tl-layer-lock-btn ${isLocked ? 'active' : ''}" data-layer-idx="${idx}" style="background: ${isLocked ? '#d97706' : '#1e293b'}; color: ${isLocked ? '#fff' : '#94a3b8'}; border: 1px solid ${isLocked ? '#f59e0b' : '#475569'}; padding: 1px 3px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="${isLocked ? '已鎖定 (Lock)' : '未鎖定'}">${isLocked ? '🔒' : '🔓'}</button>
                    <button class="tl-layer-delete-btn" data-layer-idx="${idx}" ${isLocked ? 'disabled' : ''} style="background: #1e293b; color: ${isLocked ? '#64748b' : '#f87171'}; border: 1px solid #475569; padding: 1px 3px; border-radius: 3px; font-size: 0.62rem; cursor: ${isLocked ? 'not-allowed' : 'pointer'};" title="刪除此圖層">🗑️</button>
                  </div>
                </div>
                <div class="tl-track-bar tl-single-layer-bar" data-layer-idx="${idx}" style="flex: 1; height: 20px; background: #1e293b; border-radius: 3px; position: relative; border: 1px solid #334155;">
                  <div class="tl-layer-clip ${isClipSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}" data-layer-idx="${idx}" style="position: absolute; left: ${startPct}%; top: 1px; bottom: 1px; width: ${durPct}%; background: ${isMuted ? 'rgba(75, 85, 99, 0.6)' : 'linear-gradient(90deg, rgba(168, 85, 247, 0.75), rgba(126, 34, 206, 0.9))'}; border: ${isClipSelected ? '2px solid #fbbf24' : (isMuted ? '1px solid #6b7280' : '1px solid #c084fc')}; box-shadow: ${isClipSelected ? '0 0 10px rgba(251, 191, 36, 0.7)' : 'none'}; border-radius: 2px; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; font-size: 0.65rem; color: #fff; cursor: ${isLocked ? 'not-allowed' : 'grab'}; user-select: none; touch-action: none;" title="圖層 ${idx + 1}: ${refDisplayName}\n模式: ${lAnchorLabel}${layer.reverse ? ' [🔄反向]' : ''}\n起點: ${lDelay.toFixed(2)}s | 時長: ${lDur.toFixed(2)}s\n(${isLocked ? '🔒 已鎖定禁止拖動' : '點選高亮編輯淡入淡出 / 拖動本體調起點 / 拖拉右緣調時長'})">
                    <!-- 🎞️ 邊緣淡入淡出斜角標記 (隨 fadeIn/fadeOut 實時縮放) -->
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${inWidthPct}%; background: linear-gradient(90deg, rgba(255,255,255,0.45), transparent); pointer-events: none;"></div>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; font-size: 0.63rem; padding-left: 4px; z-index: 1;">
                      <b style="color: #fef08a;">${lAnchorLabel}</b> ${refDisplayName}${layer.reverse ? ' 🔄' : ''} (${lDur.toFixed(2)}s)
                    </span>
                    <div style="position: absolute; right: 6px; top: 0; bottom: 0; width: ${outWidthPct}%; background: linear-gradient(-90deg, rgba(255,255,255,0.45), transparent); pointer-events: none;"></div>
                    <div class="tl-clip-resize-handle" data-layer-idx="${idx}" style="width: 6px; height: 100%; background: #f3e8ff; opacity: 0.9; cursor: ${isLocked ? 'not-allowed' : 'ew-resize'}; border-radius: 1px; margin-right: -2px; z-index: 2;" title="${isLocked ? '🔒 已鎖定禁止拉伸' : '拖動調整圖層時長'}"></div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}

          <!-- 🎬 選中圖層淡入淡出微調列 (當點擊任一 Clip 時動態展示) -->
          ${(this.selectedClipIndex !== null && layers[this.selectedClipIndex]) ? (() => {
            const sIdx = this.selectedClipIndex;
            const sLayer = layers[sIdx];
            return `
              <div id="tl-selected-clip-toolbar" style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #fbbf24; border-radius: 4px; padding: 4px 10px; font-size: 0.72rem; color: #fde047; margin: 2px 0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-weight: bold;">🎬 編輯圖層 (L${sIdx + 1}):</span>
                  <span style="color: #cbd5e1;">${sLayer.name || `圖層 ${sIdx + 1}`}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 14px;">
                  <label style="display: flex; align-items: center; gap: 4px;">
                    <span>淡入 (Fade In):</span>
                    <input type="range" class="tl-clip-fade-input" data-param="fadeIn" min="0" max="0.5" step="0.01" value="${sLayer.fadeIn ?? 0.05}" style="width: 65px; accent-color: #fbbf24;">
                    <span class="tl-clip-fade-val" data-param="fadeIn" style="font-family: monospace; color: #fff; width: 34px;">${(sLayer.fadeIn ?? 0.05).toFixed(2)}s</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 4px;">
                    <span>淡出 (Fade Out):</span>
                    <input type="range" class="tl-clip-fade-input" data-param="fadeOut" min="0" max="0.5" step="0.01" value="${sLayer.fadeOut ?? 0.08}" style="width: 65px; accent-color: #fbbf24;">
                    <span class="tl-clip-fade-val" data-param="fadeOut" style="font-family: monospace; color: #fff; width: 34px;">${(sLayer.fadeOut ?? 0.08).toFixed(2)}s</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 4px;">
                    <span>縮放 (Scale):</span>
                    <input type="range" class="tl-clip-fade-input" data-param="scale" min="0.3" max="2.5" step="0.1" value="${sLayer.scale ?? 1.0}" style="width: 55px; accent-color: #38bdf8;">
                    <span class="tl-clip-fade-val" data-param="scale" style="font-family: monospace; color: #fff; width: 28px;">${(sLayer.scale ?? 1.0).toFixed(1)}x</span>
                  </label>
                  <button id="tl-btn-close-clip-bar" style="background: #334155; border: none; color: #fff; padding: 1px 6px; border-radius: 3px; cursor: pointer; font-size: 0.65rem;">✕ 關閉</button>
                </div>
              </div>
            `;
          })() : ''}

          <!-- ➕ 快捷新增圖層列 (引用庫存預製件) -->
          <div style="display: flex; align-items: center; gap: 8px; margin: 2px 0;">
            <div style="width: 140px; display: flex; align-items: center; justify-content: flex-end;">
              <span style="font-size: 0.65rem; color: #64748b;">素材引用 (+Layer):</span>
            </div>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button id="tl-btn-add-layer" style="background: #1e293b; border: 1px solid #10b981; color: #34d399; padding: 1px 7px; border-radius: 3px; font-size: 0.64rem; cursor: pointer;" title="新增 1層次生圖層">➕ 加一層</button>
              <button id="tl-btn-add-layer-caster" style="background: #1e293b; border: 1px solid #38bdf8; color: #38bdf8; padding: 1px 7px; border-radius: 3px; font-size: 0.64rem; cursor: pointer;" title="新增 1層自身揮刀/升空圖層">🏠 +自身前段</button>
              <button id="tl-btn-add-layer-traj" style="background: #1e293b; border: 1px solid #a855f7; color: #c084fc; padding: 1px 7px; border-radius: 3px; font-size: 0.64rem; cursor: pointer;" title="新增 2層位移/飛行彈道圖層">🚀 +位移彈道</button>
              <button id="tl-btn-add-layer-sky" style="background: #1e293b; border: 1px solid #eab308; color: #fde047; padding: 1px 7px; border-radius: 3px; font-size: 0.64rem; cursor: pointer;" title="新增天降雷劈/隕石圖層">⚡ +天降彈道</button>
              <button id="tl-btn-add-layer-target" style="background: #1e293b; border: 1px solid #f43f5e; color: #fb7185; padding: 1px 7px; border-radius: 3px; font-size: 0.64rem; cursor: pointer;" title="新增 3層目標受擊爆裂圖層">💥 +受擊爆破</button>
            </div>
          </div>

          <!-- 軌道 3: 打擊感 Cue 軌 (Impact Cue Track) -->
          <div class="tl-track-row" style="display: flex; align-items: center; gap: 8px;">
            <div class="tl-track-header" style="width: 112px; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: #cbd5e1; font-weight: 500; font-size: 0.72rem;">🥊 打擊 Cue 點</span>
              <div style="display: flex; gap: 3px;">
                <button class="tl-solo-btn" data-track="impact" style="background: ${soloTrack === 'impact' ? '#eab308' : '#334155'}; color: ${soloTrack === 'impact' ? '#000' : '#fff'}; font-weight: bold; border: none; padding: 1px 5px; border-radius: 3px; font-size: 0.65rem; cursor: pointer;" title="預覽獨奏打擊反饋">S</button>
                <button class="tl-mute-btn" data-track="impact" style="background: ${mutes.impact ? '#ef4444' : '#334155'}; color: #fff; border: none; padding: 1px 5px; border-radius: 3px; font-size: 0.65rem; cursor: pointer;" title="預覽靜音打擊反饋">M</button>
              </div>
            </div>
            <div id="tl-cue-track-bar" class="tl-track-bar tl-cue-bar" style="flex: 1; height: 26px; background: #1f2937; border-radius: 3px; position: relative; border: 1px dashed #4b5563; cursor: crosshair;" title="雙擊空白處新增 Cue">
              ${cues.map((cue, idx) => {
                const leftPct = Math.min(100, Math.max(0, (cue.time / this.duration) * 100));
                const isPri = cue.isPrimary || (idx === cues.length - 1);
                const color = isPri ? '#ef4444' : '#f59e0b';
                const isCueSelected = this.selectedCueIndex === idx;
                return `
                  <div class="tl-cue-marker ${isCueSelected ? 'selected' : ''}" data-cue-idx="${idx}" style="position: absolute; left: ${leftPct}%; top: 50%; transform: translate(-50%, -50%); cursor: grab; display: flex; flex-direction: column; align-items: center; z-index: 25; touch-action: none;" title="${cue.cueId}: ${cue.time.toFixed(2)}s\n(點擊選中 / 按 Delete 或 ✕ 刪除 / 拖曳微調)">
                    ${isCueSelected ? `
                      <button class="tl-cue-delete-btn" data-cue-idx="${idx}" style="position: absolute; top: -16px; background: #ef4444; color: #fff; border: 1px solid #fff; border-radius: 50%; width: 14px; height: 14px; font-size: 0.52rem; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; z-index: 30; box-shadow: 0 0 6px rgba(0,0,0,0.9);" title="點擊刪除此打擊點">✕</button>
                    ` : ''}
                    <div class="tl-cue-diamond" style="width: 11px; height: 11px; background: ${color}; transform: rotate(45deg); border: ${isCueSelected ? '2px solid #fbbf24' : '1.5px solid #fff'}; box-shadow: ${isCueSelected ? '0 0 10px #fbbf24' : '0 0 6px ' + color}; pointer-events: none;"></div>
                    <span class="tl-cue-time-tag" style="font-size: 0.62rem; color: ${isCueSelected ? '#fbbf24' : color}; font-weight: bold; font-family: monospace; margin-top: 2px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); pointer-events: none;">${cue.time.toFixed(2)}s</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(preset);
    this.updateFrameUI(this.frameEngine.getCurrentFrameData());
    this.updateStateUI(this.frameEngine.isPaused() ? 'PAUSED' : 'PLAYING');
  }

  private bindEvents(preset: VFXPreset): void {
    // 1. 軌道預覽靜音按鈕 (不寫入 Preset SSOT)
    this.container.querySelectorAll('.tl-mute-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trk = (e.currentTarget as HTMLElement).dataset.track as 'main' | 'layers' | 'impact';
        if (trk) {
          const mutes = this.store.getTrackMuteStates();
          this.store.setTrackMute(trk, !mutes[trk]);
          this.render(this.store.getPreset());
        }
      });
    });

    // 1.5 軌道預覽獨奏按鈕 (Solo)
    this.container.querySelectorAll('.tl-solo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trk = (e.currentTarget as HTMLElement).dataset.track;
        if (trk) {
          this.store.toggleTrackSolo(trk);
          this.render(this.store.getPreset());
        }
      });
    });

    // 1.5.1 軌道鎖定按鈕 (Lock)
    this.container.querySelectorAll('.tl-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const trk = (e.currentTarget as HTMLElement).dataset.track;
        if (trk) {
          this.store.toggleTrackLock(trk);
          this.render(this.store.getPreset());
        }
      });
    });

    // 1.5.2 次生圖層 Solo 按鈕
    this.container.querySelectorAll('.tl-layer-solo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = (e.currentTarget as HTMLElement).dataset.layerIdx;
        if (idx !== undefined) {
          this.store.toggleTrackSolo(`layer_${idx}`);
          this.render(this.store.getPreset());
        }
      });
    });

    // 1.5.3 次生圖層 Lock 按鈕
    this.container.querySelectorAll('.tl-layer-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = (e.currentTarget as HTMLElement).dataset.layerIdx;
        if (idx !== undefined) {
          this.store.toggleTrackLock(`layer_${idx}`);
          this.render(this.store.getPreset());
        }
      });
    });

    // 1.6 播放/暫停與前後逐幀步進、重置控制
    const btnPlayPause = this.container.querySelector('#tl-btn-play-pause') as HTMLButtonElement;
    if (btnPlayPause) {
      btnPlayPause.addEventListener('click', () => {
        this.frameEngine.togglePlayPause();
      });
    }

    const btnStepPrev = this.container.querySelector('#tl-btn-step-prev') as HTMLButtonElement;
    if (btnStepPrev) {
      btnStepPrev.addEventListener('click', () => {
        this.frameEngine.stepPrev(1);
      });
    }

    const btnStepNext = this.container.querySelector('#tl-btn-step-next') as HTMLButtonElement;
    if (btnStepNext) {
      btnStepNext.addEventListener('click', () => {
        this.frameEngine.stepNext(1);
      });
    }

    const btnStop = this.container.querySelector('#tl-btn-stop') as HTMLButtonElement;
    if (btnStop) {
      btnStop.addEventListener('click', () => {
        this.frameEngine.stop();
      });
    }

    // 2. 打擊模式切換
    const modeSelect = this.container.querySelector('#tl-presentation-mode') as HTMLSelectElement;
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value as any;
        this.store.updateConfig({ impactPresentationMode: val }, true);
      });
    }

    // 3. 新增 Cue 按鈕
    const btnAddCue = this.container.querySelector('#tl-btn-add-cue') as HTMLButtonElement;
    if (btnAddCue) {
      btnAddCue.addEventListener('click', () => {
        this.addNewCueAt(preset, this.frameEngine.getCurrentTime());
      });
    }

    // 4. 尺規與播放頭 Seek / Scrubbing 控制 (點擊 / 拖動 Ruler 或 Playhead，精確吸附整數影格)
    const rulerBar = this.container.querySelector('#tl-ruler-bar') as HTMLElement;
    const playheadEl = this.container.querySelector('#tl-playhead') as HTMLElement;

    if (rulerBar) {
      const handleSeek = (e: MouseEvent | PointerEvent) => {
        const rect = rulerBar.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const pct = rect.width > 0 ? offsetX / rect.width : 0;
        const totalFrames = this.frameEngine.getTotalFrames();
        const targetFrame = Math.round(pct * totalFrames);
        this.frameEngine.seekToFrame(targetFrame);
        this.fxEngine.seek(this.frameEngine.getCurrentTime());
      };

      const startScrubbing = (e: PointerEvent, captureEl: HTMLElement) => {
        this.isScrubbingPlayhead = true;
        this.frameEngine.pause();
        try { captureEl.setPointerCapture(e.pointerId); } catch (_) {}
        this.onScrubStartCallback?.();
        handleSeek(e);
      };

      const doScrubbing = (e: PointerEvent) => {
        if (this.isScrubbingPlayhead) {
          handleSeek(e);
        }
      };

      const stopScrubbing = (e: PointerEvent, captureEl: HTMLElement) => {
        if (this.isScrubbingPlayhead) {
          this.isScrubbingPlayhead = false;
          try { captureEl.releasePointerCapture(e.pointerId); } catch (_) {}
          handleSeek(e);
          this.onScrubEndCallback?.(this.frameEngine.getCurrentTime());
        }
      };

      rulerBar.addEventListener('pointerdown', (e) => startScrubbing(e, rulerBar));
      rulerBar.addEventListener('pointermove', doScrubbing);
      rulerBar.addEventListener('pointerup', (e) => stopScrubbing(e, rulerBar));
      rulerBar.addEventListener('pointercancel', (e) => stopScrubbing(e, rulerBar));

      if (playheadEl) {
        playheadEl.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          startScrubbing(e, playheadEl);
        });
        playheadEl.addEventListener('pointermove', doScrubbing);
        playheadEl.addEventListener('pointerup', (e) => stopScrubbing(e, playheadEl));
        playheadEl.addEventListener('pointercancel', (e) => stopScrubbing(e, playheadEl));
      }
    }

    // 5. Cue 軌道雙擊新增 Cue / 點擊空白處取消選取
    const cueTrackBar = this.container.querySelector('#tl-cue-track-bar') as HTMLElement;
    if (cueTrackBar) {
      cueTrackBar.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.tl-cue-marker')) return;
        if (this.selectedCueIndex !== null) {
          this.selectedCueIndex = null;
          this.onSelectCueCallback?.(null);
          this.onSelectTrackCallback?.(null);
          this.render(this.store.getPreset());
        }
      });

      cueTrackBar.addEventListener('dblclick', (e) => {
        const rect = cueTrackBar.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const targetTime = Number(((offsetX / rect.width) * this.duration).toFixed(2));
        this.addNewCueAt(preset, targetTime);
      });
    }

    // 5.8 🌟 Cue 刪除按鈕點擊事件 (直覺 ✕ 刪除)
    this.container.querySelectorAll('.tl-cue-delete-btn').forEach(delBtn => {
      delBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cueIdx = Number((e.currentTarget as HTMLElement).dataset.cueIdx);
        const cues = [...(this.store.getPreset().impactCues || [])];
        if (cues.length > 0 && cueIdx >= 0 && cueIdx < cues.length) {
          cues.splice(cueIdx, 1);
          this.selectedCueIndex = null;
          this.onSelectCueCallback?.(null);
          this.store.updateConfig({ impactCues: cues }, true);
          this.render(this.store.getPreset());
        }
      });
    });

    // 6. 🌟 Cue Marker 拖曳交易與點擊刪除 (規範 8.2.4 & 8.2.5)
    this.container.querySelectorAll('.tl-cue-marker').forEach(markerEl => {
      const el = markerEl as HTMLElement;
      const cueIdx = Number(el.dataset.cueIdx);

      el.addEventListener('pointerdown', (evt) => {
        const e = evt as PointerEvent;
        // 若點擊的是刪除按鈕，直接返回交由按鈕處理
        if (e.target && (e.target as HTMLElement).classList?.contains('tl-cue-delete-btn')) {
          return;
        }

        // Shift+點擊: 刪除此 Cue
        if (e.shiftKey || e.altKey) {
          e.stopPropagation();
          const cues = [...(preset.impactCues || [])];
          if (cues.length > 0 && cueIdx >= 0 && cueIdx < cues.length) {
            cues.splice(cueIdx, 1);
            this.selectedCueIndex = null;
            this.onSelectCueCallback?.(null);
            this.store.updateConfig({ impactCues: cues }, true);
            this.render(this.store.getPreset());
          }
          return;
        }

        e.stopPropagation();
        this.isDraggingCue = true;
        this.activeDragCueIndex = cueIdx;
        el.style.cursor = 'grabbing';
        el.setPointerCapture(e.pointerId);

        const trackBar = this.container.querySelector('#tl-cue-track-bar') as HTMLElement;
        const trackRect = trackBar.getBoundingClientRect();
        const initialCues = JSON.parse(JSON.stringify(preset.impactCues || [])) as VFXImpactCue[];
        const initialTime = initialCues[cueIdx]?.time ?? 0;
        let lastComputedTime = initialTime;
        let hasMoved = false;

        // 🌟 規範 8.2.5：拖曳是一筆 Undo Transaction，在起點記錄拖曳前狀態快照
        this.store.recordSnapshot();

        const onPointerMove = (moveEvt: PointerEvent) => {
          if (!this.isDraggingCue) return;
          hasMoved = true;
          const offsetX = Math.max(0, Math.min(moveEvt.clientX - trackRect.left, trackRect.width));
          const newTime = Number(((offsetX / trackRect.width) * this.duration).toFixed(2));
          lastComputedTime = newTime;

          // 即時視覺回饋：移動 DOM 位置與數值
          const pct = Math.min(100, Math.max(0, (newTime / this.duration) * 100));
          el.style.left = `${pct}%`;
          const timeTag = el.querySelector('.tl-cue-time-tag') as HTMLElement;
          if (timeTag) timeTag.textContent = `${newTime.toFixed(2)}s`;

          // 記憶體中更新當前 Preset (recordHistory: false，不累積多餘 Undo 項目)
          const updated = [...(this.store.getPreset().impactCues || [])];
          if (updated[cueIdx]) {
            updated[cueIdx].time = newTime;
            this.store.updateConfig({ impactCues: updated }, false);
          }
        };

        const onPointerUp = (upEvt: PointerEvent) => {
          if (!this.isDraggingCue) return;
          this.isDraggingCue = false;
          this.activeDragCueIndex = -1;
          el.style.cursor = 'grab';
          try { el.releasePointerCapture(upEvt.pointerId); } catch (_) {}
          el.removeEventListener('pointermove', onPointerMove);
          el.removeEventListener('pointerup', onPointerUp);
          el.removeEventListener('pointercancel', onPointerUp);

          // 若僅點擊無移動，則切換選中此 Cue
          if (!hasMoved) {
            this.selectedCueIndex = (this.selectedCueIndex === cueIdx) ? null : cueIdx;
            this.onSelectCueCallback?.(this.selectedCueIndex);
            this.onSelectTrackCallback?.(this.selectedCueIndex !== null ? { type: 'CUE', index: cueIdx } : null);
            this.render(this.store.getPreset());
            return;
          }

          // 🌟 規範 8.2.5：在 pointerup 提交最終值，整體拖曳維持為一筆 Undo Transaction
          if (hasMoved && lastComputedTime !== initialTime) {
            const finalCues = [...(this.store.getPreset().impactCues || [])];
            const draggedCueId = finalCues[cueIdx]?.cueId;
            if (finalCues[cueIdx]) {
              finalCues[cueIdx].time = lastComputedTime;
              // 依時間重新排序 Cue 列表
              finalCues.sort((a, b) => a.time - b.time);
              if (this.selectedCueIndex !== null && draggedCueId) {
                this.selectedCueIndex = finalCues.findIndex(c => c.cueId === draggedCueId);
                this.onSelectCueCallback?.(this.selectedCueIndex >= 0 ? this.selectedCueIndex : null);
              }
              this.store.updateConfig({ impactCues: finalCues }, false);
            }
          }
        };

        el.addEventListener('pointermove', onPointerMove);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointercancel', onPointerUp);
      });
    });

    // 6.5 🌟 主特效軌 Clip 拖曳移動 (mainDelay) 與右緣把手拉伸 (mainDuration)
    const mainTrackBar = this.container.querySelector('#tl-main-track-bar') as HTMLElement;
    const mainClip = this.container.querySelector('.tl-main-clip') as HTMLElement;
    const mainHandle = this.container.querySelector('.tl-main-resize-handle') as HTMLElement;

    if (mainTrackBar && mainClip && mainHandle) {
      // 6.5.1 右緣拉伸 (Resize Duration)
      mainHandle.addEventListener('pointerdown', (evt) => {
        const e = evt as PointerEvent;
        e.stopPropagation();
        if (this.store.isTrackLocked('main')) return;
        this.isDraggingClip = true;
        mainHandle.setPointerCapture(e.pointerId);

        const trackRect = mainTrackBar.getBoundingClientRect();
        const currentPreset = this.store.getPreset();
        const startDelay = Math.max(0, currentPreset.mainDelay || 0);
        const initialDuration = Math.max(0.05, currentPreset.mainDuration !== undefined ? currentPreset.mainDuration : (this.duration - startDelay));
        let lastDuration = initialDuration;
        let hasResized = false;

        this.store.recordSnapshot();

        const onHandleMove = (moveEvt: PointerEvent) => {
          hasResized = true;
          const offsetX = Math.max(0, Math.min(moveEvt.clientX - trackRect.left, trackRect.width));
          const pointerTime = (offsetX / trackRect.width) * this.duration;
          // 選項 B 嚴格邊界：maxDuration = duration - startDelay
          const maxDur = Math.max(0.05, this.duration - startDelay);
          const newDur = Math.max(0.05, Math.min(maxDur, pointerTime - startDelay));
          lastDuration = Number(newDur.toFixed(2));

          const durPct = Math.min(100 - ((startDelay / this.duration) * 100), Math.max(5, (lastDuration / this.duration) * 100));
          mainClip.style.width = `${durPct}%`;

          this.store.updateConfig({ mainDuration: lastDuration }, false);
        };

        const onHandleUp = (upEvt: PointerEvent) => {
          this.isDraggingClip = false;
          try { mainHandle.releasePointerCapture(upEvt.pointerId); } catch (_) {}
          mainHandle.removeEventListener('pointermove', onHandleMove);
          mainHandle.removeEventListener('pointerup', onHandleUp);
          mainHandle.removeEventListener('pointercancel', onHandleUp);

          if (hasResized && lastDuration !== initialDuration) {
            this.store.updateConfig({ mainDuration: lastDuration }, false);
          }
          this.render(this.store.getPreset());
        };

        mainHandle.addEventListener('pointermove', onHandleMove);
        mainHandle.addEventListener('pointerup', onHandleUp);
        mainHandle.addEventListener('pointercancel', onHandleUp);
      });

      // 6.5.2 整塊 Clip 拖曳移動 (Move mainDelay)
      mainClip.addEventListener('pointerdown', (evt) => {
        const e = evt as PointerEvent;
        if ((e.target as HTMLElement).classList.contains('tl-main-resize-handle')) {
          return;
        }

        if (this.store.isTrackLocked('main')) return;

        e.stopPropagation();
        this.isDraggingClip = true;
        mainClip.style.cursor = 'grabbing';
        mainClip.setPointerCapture(e.pointerId);

        const trackRect = mainTrackBar.getBoundingClientRect();
        const currentPreset = this.store.getPreset();
        const curDuration = Math.max(0.05, currentPreset.mainDuration !== undefined ? currentPreset.mainDuration : (this.duration - (currentPreset.mainDelay || 0)));
        const initialDelay = Math.max(0, currentPreset.mainDelay || 0);
        const clickOffsetTime = ((e.clientX - mainClip.getBoundingClientRect().left) / trackRect.width) * this.duration;
        let lastDelay = initialDelay;
        let hasMoved = false;

        this.store.recordSnapshot();

        const onClipMove = (moveEvt: PointerEvent) => {
          hasMoved = true;
          const pointerPosTime = ((moveEvt.clientX - trackRect.left) / trackRect.width) * this.duration;
          // 選項 B 嚴格邊界：maxDelay = duration - curDuration
          const maxDelay = Math.max(0, this.duration - curDuration);
          const newDelay = Math.max(0, Math.min(maxDelay, pointerPosTime - clickOffsetTime));
          lastDelay = Number(newDelay.toFixed(2));

          const startPct = Math.min(95, Math.max(0, (lastDelay / this.duration) * 100));
          mainClip.style.left = `${startPct}%`;

          this.store.updateConfig({ mainDelay: lastDelay }, false);
        };

        const onClipUp = (upEvt: PointerEvent) => {
          this.isDraggingClip = false;
          mainClip.style.cursor = 'grab';
          try { mainClip.releasePointerCapture(upEvt.pointerId); } catch (_) {}
          mainClip.removeEventListener('pointermove', onClipMove);
          mainClip.removeEventListener('pointerup', onClipUp);
          mainClip.removeEventListener('pointercancel', onClipUp);

          if (hasMoved && lastDelay !== initialDelay) {
            this.store.updateConfig({ mainDelay: lastDelay }, false);
          } else if (!hasMoved) {
            this.onSelectTrackCallback?.({ type: 'MAIN' });
          }
          this.render(this.store.getPreset());
        };

        mainClip.addEventListener('pointermove', onClipMove);
        mainClip.addEventListener('pointerup', onClipUp);
        mainClip.addEventListener('pointercancel', onClipUp);
      });
    }

    // 7. 🌟 次生多圖層快捷新增按鈕組 (通用加一層 / 自身前段 / 位移彈道 / 天降彈道 / 目標受擊)
    const addLayerWithConfig = (partialConfig: any) => {
      const currentPreset = this.store.getPreset();
      const curLayers = currentPreset.layers || [];
      const newLayer = {
        id: `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: partialConfig.name || `圖層 ${curLayers.length + 1}`,
        spatialMode: partialConfig.spatialMode || 'A_TO_B',
        reverse: partialConfig.reverse || false,
        shaderMode: partialConfig.shaderMode || 'ENERGY_BEAM',
        delay: partialConfig.delay !== undefined ? partialConfig.delay : Number(Math.min(this.duration * 0.8, this.duration * 0.15 * curLayers.length).toFixed(2)),
        duration: partialConfig.duration !== undefined ? partialConfig.duration : Number((this.duration * 0.4).toFixed(2)),
        scale: partialConfig.scale || 1.0,
        enabled: true,
        generatesHit: false
      };
      this.store.updateConfig({ layers: [...curLayers, newLayer] }, true);
    };

    this.container.querySelector('#tl-btn-add-layer')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({
        name: '次生圖層',
        shaderMode: 'ENERGY_BEAM',
        duration: 0.4
      });
    });

    this.container.querySelector('#tl-btn-add-layer-caster')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({
        name: '自身揮刀/升空',
        spatialMode: 'AT_CASTER',
        shaderMode: 'SLASH_BLADE',
        delay: 0.0,
        duration: Number((this.duration * 0.35).toFixed(2))
      });
    });

    this.container.querySelector('#tl-btn-add-layer-traj')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({
        name: '位移飛行彈道',
        spatialMode: 'A_TO_B',
        shaderMode: 'ENERGY_BEAM',
        delay: Number((this.duration * 0.2).toFixed(2)),
        duration: Number((this.duration * 0.4).toFixed(2))
      });
    });

    this.container.querySelector('#tl-btn-add-layer-sky')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({
        name: '天降雷劈/流星',
        spatialMode: 'VERTICAL_SKY_TO_B',
        shaderMode: 'DIELECTRIC_LIGHTNING',
        delay: Number((this.duration * 0.3).toFixed(2)),
        duration: Number((this.duration * 0.35).toFixed(2))
      });
    });

    this.container.querySelector('#tl-btn-add-layer-target')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({
        name: '目標受擊爆裂',
        spatialMode: 'AT_TARGET',
        shaderMode: 'EARTH_SHATTER',
        delay: Number((this.duration * 0.5).toFixed(2)),
        duration: Number((this.duration * 0.35).toFixed(2))
      });
    });

    // 7.2 🌟 圖層素材下拉選單切換 (即時更換圖層引用的素材/Prefab)
    this.container.querySelectorAll('.tl-layer-preset-select').forEach(selEl => {
      selEl.addEventListener('change', (e) => {
        e.stopPropagation();
        const select = e.currentTarget as HTMLSelectElement;
        const layerIdx = Number(select.dataset.layerIdx);
        const presetId = select.value;
        const layers = [...(this.store.getPreset().layers || [])];
        if (layers[layerIdx]) {
          const repo = VFXPresetRepository.getInstance();
          const targetPreset = repo.getPreset(presetId);
          if (targetPreset) {
            layers[layerIdx] = {
              ...layers[layerIdx],
              presetId: targetPreset.id,
              name: targetPreset.name,
              shaderMode: targetPreset.shaderMode || 'ENERGY_BEAM',
              spatialMode: targetPreset.spatialMode || 'A_TO_B',
              reverse: targetPreset.reverse || false
            };
            this.store.updateConfig({ layers }, true);
            this.render(this.store.getPreset());
          }
        }
      });
    });

    // 7.3 🌟 選中圖層淡入淡出工具列 (微調 fadeIn / fadeOut / scale)
    const btnCloseClipBar = this.container.querySelector('#tl-btn-close-clip-bar');
    if (btnCloseClipBar) {
      btnCloseClipBar.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedClipIndex = null;
        this.render(this.store.getPreset());
      });
    }

    this.container.querySelectorAll('.tl-clip-fade-input').forEach(inputEl => {
      inputEl.addEventListener('input', (e) => {
        e.stopPropagation();
        const input = e.currentTarget as HTMLInputElement;
        const param = input.dataset.param as 'fadeIn' | 'fadeOut' | 'scale';
        const val = Number(input.value);
        const valTag = this.container.querySelector(`.tl-clip-fade-val[data-param="${param}"]`);
        if (valTag) {
          valTag.textContent = param === 'scale' ? `${val.toFixed(1)}x` : `${val.toFixed(2)}s`;
        }
        if (this.selectedClipIndex !== null) {
          const layers = [...(this.store.getPreset().layers || [])];
          if (layers[this.selectedClipIndex]) {
            layers[this.selectedClipIndex] = {
              ...layers[this.selectedClipIndex],
              [param]: val
            };
            this.store.updateConfig({ layers }, false);
          }
        }
      });
      inputEl.addEventListener('change', () => {
        if (this.selectedClipIndex !== null) {
          this.render(this.store.getPreset());
        }
      });
    });

    // 7.4 🌟 點擊 🔗 跳轉編輯原素材 (安全暫存當前技能)
    this.container.querySelectorAll('.tl-btn-jump-preset').forEach(btnEl => {
      btnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const presetId = (btnEl as HTMLElement).dataset.presetId;
        if (!presetId) return;
        const targetPreset = VFXPresetRepository.getInstance().getPreset(presetId);
        if (targetPreset) {
          const current = this.store.getPreset();
          this.store.stashCurrentDraft(current.name || current.id);
          this.store.setPreset(targetPreset, false);
          this.store.setDirty(false);
        }
      });
    });

    // 7.5 🌟 圖層獨立靜音開關 (Toggle Mute) 與 刪除 (Delete) 按鈕
    this.container.querySelectorAll('.tl-layer-toggle-btn').forEach(btnEl => {
      btnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerIdx = Number((btnEl as HTMLElement).dataset.layerIdx);
        const layers = [...(this.store.getPreset().layers || [])];
        if (layers[layerIdx]) {
          const curState = layers[layerIdx].enabled !== false;
          layers[layerIdx] = { ...layers[layerIdx], enabled: !curState };
          this.store.updateConfig({ layers }, true);
        }
      });
    });

    this.container.querySelectorAll('.tl-layer-delete-btn').forEach(btnEl => {
      btnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerIdx = Number((btnEl as HTMLElement).dataset.layerIdx);
        const layers = [...(this.store.getPreset().layers || [])];
        if (layers[layerIdx]) {
          layers.splice(layerIdx, 1);
          if (this.selectedClipIndex === layerIdx) this.selectedClipIndex = null;
          this.store.updateConfig({ layers }, true);
        }
      });
    });

    // 8. 🌟 多圖層 Clip 獨立拖曳移動與邊緣拉伸 (Resize)
    // 8.1 右側邊緣拉伸 handle 拖曳
    this.container.querySelectorAll('.tl-clip-resize-handle').forEach(handleEl => {
      const handle = handleEl as HTMLElement;
      const layerIdx = Number(handle.dataset.layerIdx);

      handle.addEventListener('pointerdown', (evt) => {
        const e = evt as PointerEvent;
        e.stopPropagation(); // 阻止觸發 clip 的移動
        if (this.store.isTrackLocked(`layer_${layerIdx}`)) return;
        this.isDraggingClip = true;
        handle.setPointerCapture(e.pointerId);

        const rowBar = (handle.closest('.tl-single-layer-bar') || handle.parentElement || this.container) as HTMLElement;
        const trackRect = rowBar.getBoundingClientRect();
        const currentPreset = this.store.getPreset();
        const layer = currentPreset.layers?.[layerIdx];
        if (!layer) return;

        const startDelay = Math.max(0, layer.delay || 0);
        const initialDuration = layer.duration || 0.2;
        let lastDuration = initialDuration;
        let hasResized = false;

        const clipEl = handle.closest('.tl-layer-clip') as HTMLElement;
        this.store.recordSnapshot();

        const onHandleMove = (moveEvt: PointerEvent) => {
          hasResized = true;
          const offsetX = Math.max(0, Math.min(moveEvt.clientX - trackRect.left, trackRect.width));
          const pointerTime = (offsetX / trackRect.width) * this.duration;
          // 選項 B 嚴格邊界：不得超過時間軸總長度
          const maxDur = Math.max(0.05, this.duration - startDelay);
          const newDur = Math.max(0.05, Math.min(maxDur, pointerTime - startDelay));
          lastDuration = Number(newDur.toFixed(2));

          // 即時調整寬度
          if (clipEl) {
            const durPct = Math.min(100 - ((startDelay / this.duration) * 100), Math.max(4, (lastDuration / this.duration) * 100));
            clipEl.style.width = `${durPct}%`;
          }

          const layers = [...(this.store.getPreset().layers || [])];
          if (layers[layerIdx]) {
            layers[layerIdx] = { ...layers[layerIdx], duration: lastDuration };
            this.store.updateConfig({ layers }, false);
          }
        };

        const onHandleUp = (upEvt: PointerEvent) => {
          this.isDraggingClip = false;
          try { handle.releasePointerCapture(upEvt.pointerId); } catch (_) {}
          handle.removeEventListener('pointermove', onHandleMove);
          handle.removeEventListener('pointerup', onHandleUp);
          handle.removeEventListener('pointercancel', onHandleUp);

          if (hasResized && lastDuration !== initialDuration) {
            const finalLayers = [...(this.store.getPreset().layers || [])];
            if (finalLayers[layerIdx]) {
              finalLayers[layerIdx] = { ...finalLayers[layerIdx], duration: lastDuration };
              this.store.updateConfig({ layers: finalLayers }, false);
            }
          }
          this.render(this.store.getPreset());
        };

        handle.addEventListener('pointermove', onHandleMove);
        handle.addEventListener('pointerup', onHandleUp);
        handle.addEventListener('pointercancel', onHandleUp);
      });
    });

    // 8.2 整塊 Clip 拖曳移動與 Shift+點擊刪除 / 單擊選中
    this.container.querySelectorAll('.tl-layer-clip').forEach(clipEl => {
      const clip = clipEl as HTMLElement;
      const layerIdx = Number(clip.dataset.layerIdx);

      clip.addEventListener('pointerdown', (evt) => {
        const e = evt as PointerEvent;
        // 若點擊的是拉伸把手，則直接返回交由拉伸處理
        if ((e.target as HTMLElement).classList.contains('tl-clip-resize-handle')) {
          return;
        }

        // 若圖層已鎖定，僅切換選中狀態，禁止拖曳或刪除
        if (this.store.isTrackLocked(`layer_${layerIdx}`)) {
          this.selectedClipIndex = (this.selectedClipIndex === layerIdx) ? null : layerIdx;
          this.render(this.store.getPreset());
          return;
        }

        // Shift+點擊: 刪除此圖層 Clip
        if (e.shiftKey || e.altKey) {
          e.stopPropagation();
          const layers = [...(this.store.getPreset().layers || [])];
          if (layers.length > 0) {
            layers.splice(layerIdx, 1);
            if (this.selectedClipIndex === layerIdx) this.selectedClipIndex = null;
            this.store.updateConfig({ layers }, true);
          }
          return;
        }

        e.stopPropagation();
        this.isDraggingClip = true;
        clip.style.cursor = 'grabbing';
        clip.setPointerCapture(e.pointerId);

        const rowBar = (clip.closest('.tl-single-layer-bar') || clip.parentElement || this.container) as HTMLElement;
        const trackRect = rowBar.getBoundingClientRect();
        const currentPreset = this.store.getPreset();
        const layer = currentPreset.layers?.[layerIdx];
        if (!layer) return;

        const clipDuration = Math.max(0.05, layer.duration || 0.2);
        const initialDelay = Math.max(0, layer.delay || 0);
        const startClientX = e.clientX;
        let lastDelay = initialDelay;
        let hasMoved = false;

        this.store.recordSnapshot();

        const onClipMove = (moveEvt: PointerEvent) => {
          hasMoved = true;
          const deltaX = moveEvt.clientX - startClientX;
          const maxDelay = Math.max(0, this.duration - clipDuration);
          const newDelay = Math.max(0, Math.min(maxDelay, (deltaX / trackRect.width) * this.duration));
          lastDelay = Number(newDelay.toFixed(2));

          // 即時視覺回饋
          const startPct = Math.min(95, Math.max(0, (lastDelay / this.duration) * 100));
          clip.style.left = `${startPct}%`;

          const layers = [...(this.store.getPreset().layers || [])];
          if (layers[layerIdx]) {
            layers[layerIdx] = { ...layers[layerIdx], delay: lastDelay };
            this.store.updateConfig({ layers }, false);
          }
        };

        const onClipUp = (upEvt: PointerEvent) => {
          this.isDraggingClip = false;
          clip.style.cursor = 'grab';
          try { clip.releasePointerCapture(upEvt.pointerId); } catch (_) {}
          clip.removeEventListener('pointermove', onClipMove);
          clip.removeEventListener('pointerup', onClipUp);
          clip.removeEventListener('pointercancel', onClipUp);

          // 若僅點擊無位移，切換選取該 Clip 進行淡入淡出等微調
          if (!hasMoved) {
            this.selectedClipIndex = (this.selectedClipIndex === layerIdx) ? null : layerIdx;
            this.onSelectTrackCallback?.(this.selectedClipIndex !== null ? { type: 'LAYER', index: layerIdx } : null);
            this.render(this.store.getPreset());
            return;
          }

          if (hasMoved && lastDelay !== initialDelay) {
            const finalLayers = [...(this.store.getPreset().layers || [])];
            if (finalLayers[layerIdx]) {
              finalLayers[layerIdx] = { ...finalLayers[layerIdx], delay: lastDelay };
              this.store.updateConfig({ layers: finalLayers }, false);
            }
          }
          this.render(this.store.getPreset());
        };

        clip.addEventListener('pointermove', onClipMove);
        clip.addEventListener('pointerup', onClipUp);
        clip.addEventListener('pointercancel', onClipUp);
      });
    });
  }

  private addNewCueAt(preset: VFXPreset, timeInSeconds: number): void {
    const cues = [...(preset.impactCues || [])];
    const clampedTime = Math.min(this.duration, Math.max(0, Number(timeInSeconds.toFixed(2))));
    cues.push({
      cueId: `CUE_${cues.length + 1}`,
      time: clampedTime,
      weight: 1.0,
      isPrimary: false
    });
    cues.sort((a, b) => a.time - b.time);
    this.store.updateConfig({ impactCues: cues }, true);
  }
}
