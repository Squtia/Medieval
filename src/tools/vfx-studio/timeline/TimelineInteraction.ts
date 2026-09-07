import { VFXPreset, VFXImpactCue, ImpactPresentationMode } from '../../../models/VFX';
import { VFXStudioStore } from '../VFXStudioStore';
import { FrameTimelineEngine } from '../FrameTimelineEngine';
import { VFXPlayer } from '../../../ui/fx/VFXPlayer';
import { VFXPresetRepository } from '../../../ui/fx/VFXPresetRepository';
import { TimelineSelection } from './TimelineSelection';
import { TimelineCommands } from './TimelineCommands';

/**
 * 🖱️ TimelineInteraction
 * 時間軸指標與互動事件處理模組 (Timeline Interaction & Dragging Controller)
 * 負責播放頭 Scrubbing、Cue 拖曳/新增/刪除、Clip 拖曳移動與邊緣拉伸 (Resize) 事件綁定
 */
export interface TimelineInteractionCallbacks {
  requestRender: () => void;
  onScrubStart?: () => void;
  onScrub?: (time: number) => void;
  onScrubEnd?: (time: number) => void;
}

export class TimelineInteraction {
  private container: HTMLElement;
  private store: VFXStudioStore;
  private frameEngine: FrameTimelineEngine;
  private fxEngine: VFXPlayer;
  private selection: TimelineSelection;
  private commands: TimelineCommands;
  private callbacks: TimelineInteractionCallbacks;

  // 拖曳狀態管理
  private isScrubbingPlayhead = false;
  private isDraggingCue = false;
  private activeDragCueIndex = -1;
  private isDraggingClip = false;

  constructor(
    container: HTMLElement,
    store: VFXStudioStore,
    frameEngine: FrameTimelineEngine,
    fxEngine: VFXPlayer,
    selection: TimelineSelection,
    commands: TimelineCommands,
    callbacks: TimelineInteractionCallbacks
  ) {
    this.container = container;
    this.store = store;
    this.frameEngine = frameEngine;
    this.fxEngine = fxEngine;
    this.selection = selection;
    this.commands = commands;
    this.callbacks = callbacks;
  }

  public bindEvents(duration: number): void {
    const preset = this.store.getPreset();

    this.bindTrackControls();
    this.bindPlaybackControls();
    this.bindPresentationMode();
    this.bindRulerAndPlayheadScrubbing(duration);
    this.bindCueTrackAndMarkers(duration);
    this.bindMainTrackClip(duration);
    this.bindLayerButtonsAndPresets(duration);
    this.bindLayerClips(duration);
  }

  /**
   * 1. 軌道 Solo / Mute / Lock 狀態控制
   */
  private bindTrackControls(): void {
    // 主軌道 controls
    this.container.querySelector('#tl-main-solo-btn')?.addEventListener('click', () => {
      this.commands.toggleTrackSolo('main');
      this.callbacks.requestRender();
    });
    // 軌道 Mute 按鈕組 (支援通用 .tl-mute-btn 與 ID 選取器)
    this.container.querySelectorAll('.tl-mute-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const track = (e.currentTarget as HTMLElement).dataset.track as 'main' | 'layers' | 'impact';
        if (track && (track === 'main' || track === 'layers' || track === 'impact')) {
          this.commands.toggleTrackMute(track);
          this.callbacks.requestRender();
        }
      });
    });

    this.container.querySelector('#tl-main-mute-btn')?.addEventListener('click', () => {
      this.commands.toggleTrackMute('main');
      this.callbacks.requestRender();
    });
    this.container.querySelector('#tl-main-lock-btn')?.addEventListener('click', () => {
      this.commands.toggleTrackLock('main');
      this.callbacks.requestRender();
    });

    this.container.querySelector('#tl-impact-solo-btn')?.addEventListener('click', () => {
      this.commands.toggleTrackSolo('impact');
      this.callbacks.requestRender();
    });
    this.container.querySelector('#tl-impact-mute-btn')?.addEventListener('click', () => {
      this.commands.toggleTrackMute('impact');
      this.callbacks.requestRender();
    });
    this.container.querySelector('#tl-impact-lock-btn')?.addEventListener('click', () => {
      this.commands.toggleTrackLock('impact');
      this.callbacks.requestRender();
    });

    // 次生圖層 Solo / Lock 按鈕組
    this.container.querySelectorAll('.tl-layer-solo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = (e.currentTarget as HTMLElement).dataset.layerIdx;
        if (idx !== undefined) {
          this.commands.toggleTrackSolo(`layer_${idx}`);
          this.callbacks.requestRender();
        }
      });
    });

    this.container.querySelectorAll('.tl-layer-lock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = (e.currentTarget as HTMLElement).dataset.layerIdx;
        if (idx !== undefined) {
          this.commands.toggleTrackLock(`layer_${idx}`);
          this.callbacks.requestRender();
        }
      });
    });
  }

  /**
   * 2. 播放、暫停、前後逐幀步進與重置
   */
  private bindPlaybackControls(): void {
    this.container.querySelector('#tl-btn-play-pause')?.addEventListener('click', () => {
      this.frameEngine.togglePlayPause();
    });
    this.container.querySelector('#tl-btn-step-prev')?.addEventListener('click', () => {
      this.frameEngine.stepPrev(1);
    });
    this.container.querySelector('#tl-btn-step-next')?.addEventListener('click', () => {
      this.frameEngine.stepNext(1);
    });
    this.container.querySelector('#tl-btn-stop')?.addEventListener('click', () => {
      this.frameEngine.stop();
    });
  }

  /**
   * 3. 打擊展示模式切換
   */
  private bindPresentationMode(): void {
    const modeSelect = this.container.querySelector('#tl-presentation-mode') as HTMLSelectElement;
    if (modeSelect) {
      modeSelect.addEventListener('change', (e) => {
        const val = (e.target as HTMLSelectElement).value as ImpactPresentationMode;
        this.commands.updatePresentationMode(val);
      });
    }
  }

  /**
   * 4. 尺規與播放頭 Seek / Scrubbing
   */
  private bindRulerAndPlayheadScrubbing(duration: number): void {
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
        this.callbacks.onScrub?.(this.frameEngine.getCurrentTime());
      };

      const startScrubbing = (e: PointerEvent, captureEl: HTMLElement) => {
        this.isScrubbingPlayhead = true;
        this.frameEngine.pause();
        try { captureEl.setPointerCapture(e.pointerId); } catch (_) {}
        this.callbacks.onScrubStart?.();
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
          this.callbacks.onScrubEnd?.(this.frameEngine.getCurrentTime());
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
  }

  /**
   * 5. Cue 軌道雙擊新增、刪除按鈕、菱形 Marker 拖曳交易
   */
  private bindCueTrackAndMarkers(duration: number): void {
    const preset = this.store.getPreset();

    // 頂部「+ Cue」按鈕
    this.container.querySelector('#tl-btn-add-cue')?.addEventListener('click', () => {
      this.commands.addNewCueAt(this.frameEngine.getCurrentTime(), duration);
      this.callbacks.requestRender();
    });

    const cueTrackBar = this.container.querySelector('#tl-cue-track-bar') as HTMLElement;
    if (cueTrackBar) {
      cueTrackBar.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.tl-cue-marker')) return;
        if (this.selection.getSelectedCueIndex() !== null) {
          this.selection.selectCue(null);
          this.callbacks.requestRender();
        }
      });

      cueTrackBar.addEventListener('dblclick', (e) => {
        const rect = cueTrackBar.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const targetTime = Number(((offsetX / rect.width) * duration).toFixed(2));
        this.commands.addNewCueAt(targetTime, duration);
        this.callbacks.requestRender();
      });
    }

    // Cue 刪除按鈕 (直覺 ✕ 刪除)
    this.container.querySelectorAll('.tl-cue-delete-btn').forEach(delBtn => {
      delBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cueIdx = Number((e.currentTarget as HTMLElement).dataset.cueIdx);
        this.selection.selectCue(null);
        this.commands.deleteCue(cueIdx);
        this.callbacks.requestRender();
      });
    });

    // Cue Marker 拖曳與 Shift+點擊刪除
    this.container.querySelectorAll('.tl-cue-marker').forEach(markerEl => {
      const el = markerEl as HTMLElement;
      const cueIdx = Number(el.dataset.cueIdx);

      el.addEventListener('pointerdown', (evt) => {
        const e = evt as PointerEvent;
        if (e.target && (e.target as HTMLElement).classList?.contains('tl-cue-delete-btn')) {
          return;
        }

        // Shift+點擊: 刪除此 Cue
        if (e.shiftKey || e.altKey) {
          e.stopPropagation();
          this.selection.selectCue(null);
          this.commands.deleteCue(cueIdx);
          this.callbacks.requestRender();
          return;
        }

        e.stopPropagation();
        this.isDraggingCue = true;
        this.activeDragCueIndex = cueIdx;
        el.style.cursor = 'grabbing';
        el.setPointerCapture(e.pointerId);

        const trackBar = this.container.querySelector('#tl-cue-track-bar') as HTMLElement;
        const trackRect = trackBar.getBoundingClientRect();
        const currentPreset = this.store.getPreset();
        const initialCues = JSON.parse(JSON.stringify(currentPreset.impactCues || [])) as VFXImpactCue[];
        const initialTime = initialCues[cueIdx]?.time ?? 0;
        let lastComputedTime = initialTime;
        let hasMoved = false;

        // 🌟 規範 8.2.5：拖曳是一筆 Undo Transaction，在起點記錄拖曳前狀態快照
        this.store.recordSnapshot();

        const onPointerMove = (moveEvt: PointerEvent) => {
          if (!this.isDraggingCue) return;
          hasMoved = true;
          const offsetX = Math.max(0, Math.min(moveEvt.clientX - trackRect.left, trackRect.width));
          const newTime = Number(((offsetX / trackRect.width) * duration).toFixed(2));
          lastComputedTime = newTime;

          const pct = Math.min(100, Math.max(0, (newTime / duration) * 100));
          el.style.left = `${pct}%`;
          const timeTag = el.querySelector('.tl-cue-time-tag') as HTMLElement;
          if (timeTag) timeTag.textContent = `${newTime.toFixed(2)}s`;

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

          if (!hasMoved) {
            const currentSelected = this.selection.getSelectedCueIndex();
            const newSelected = currentSelected === cueIdx ? null : cueIdx;
            this.selection.selectCue(newSelected);
            this.callbacks.requestRender();
            return;
          }

          if (hasMoved && lastComputedTime !== initialTime) {
            const finalCues = [...(this.store.getPreset().impactCues || [])];
            const draggedCueId = finalCues[cueIdx]?.cueId;
            if (finalCues[cueIdx]) {
              finalCues[cueIdx].time = lastComputedTime;
              finalCues.sort((a, b) => a.time - b.time);
              if (this.selection.getSelectedCueIndex() !== null && draggedCueId) {
                const newIdx = finalCues.findIndex(c => c.cueId === draggedCueId);
                this.selection.selectCue(newIdx >= 0 ? newIdx : null);
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
  }

  /**
   * 6. 主特效軌 Clip 拖曳移動 (mainDelay) 與右緣把手拉伸 (mainDuration)
   */
  private bindMainTrackClip(duration: number): void {
    const mainTrackBar = this.container.querySelector('#tl-main-track-bar') as HTMLElement;
    const mainClip = this.container.querySelector('.tl-main-clip') as HTMLElement;
    const mainHandle = this.container.querySelector('.tl-main-resize-handle') as HTMLElement;

    if (!mainTrackBar || !mainClip || !mainHandle) return;

    // 6.1 右緣拉伸 (Resize mainDuration)
    mainHandle.addEventListener('pointerdown', (evt) => {
      const e = evt as PointerEvent;
      e.stopPropagation();
      if (this.store.isTrackLocked('main')) return;
      this.isDraggingClip = true;
      mainHandle.setPointerCapture(e.pointerId);

      const trackRect = mainTrackBar.getBoundingClientRect();
      const currentPreset = this.store.getPreset();
      const startDelay = Math.max(0, currentPreset.mainDelay || 0);
      const initialDuration = Math.max(0.05, currentPreset.mainDuration !== undefined ? currentPreset.mainDuration : (duration - startDelay));
      let lastDuration = initialDuration;
      let hasResized = false;

      this.store.recordSnapshot();

      const onHandleMove = (moveEvt: PointerEvent) => {
        hasResized = true;
        const offsetX = Math.max(0, Math.min(moveEvt.clientX - trackRect.left, trackRect.width));
        const pointerTime = (offsetX / trackRect.width) * duration;
        const maxDur = Math.max(0.05, duration - startDelay);
        const newDur = Math.max(0.05, Math.min(maxDur, pointerTime - startDelay));
        lastDuration = Number(newDur.toFixed(2));

        const durPct = Math.min(100 - ((startDelay / duration) * 100), Math.max(5, (lastDuration / duration) * 100));
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
        this.callbacks.requestRender();
      };

      mainHandle.addEventListener('pointermove', onHandleMove);
      mainHandle.addEventListener('pointerup', onHandleUp);
      mainHandle.addEventListener('pointercancel', onHandleUp);
    });

    // 6.2 整塊 Clip 拖曳移動 (Move mainDelay)
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
      const curDuration = Math.max(0.05, currentPreset.mainDuration !== undefined ? currentPreset.mainDuration : (duration - (currentPreset.mainDelay || 0)));
      const initialDelay = Math.max(0, currentPreset.mainDelay || 0);
      const clickOffsetTime = ((e.clientX - mainClip.getBoundingClientRect().left) / trackRect.width) * duration;
      let lastDelay = initialDelay;
      let hasMoved = false;

      this.store.recordSnapshot();

      const onClipMove = (moveEvt: PointerEvent) => {
        hasMoved = true;
        const pointerPosTime = ((moveEvt.clientX - trackRect.left) / trackRect.width) * duration;
        const maxDelay = Math.max(0, duration - curDuration);
        const newDelay = Math.max(0, Math.min(maxDelay, pointerPosTime - clickOffsetTime));
        lastDelay = Number(newDelay.toFixed(2));

        const startPct = Math.min(95, Math.max(0, (lastDelay / duration) * 100));
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
          this.selection.selectTrack({ type: 'MAIN' });
        }
        this.callbacks.requestRender();
      };

      mainClip.addEventListener('pointermove', onClipMove);
      mainClip.addEventListener('pointerup', onClipUp);
      mainClip.addEventListener('pointercancel', onClipUp);
    });
  }

  /**
   * 7. 次生圖層快捷新增、素材切換下拉選單、淡入淡出面板
   */
  private bindLayerButtonsAndPresets(duration: number): void {
    const addLayerWithConfig = (partialConfig: any) => {
      const currentPreset = this.store.getPreset();
      const curLayers = currentPreset.layers || [];
      const newLayer = {
        id: `layer_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: partialConfig.name || `圖層 ${curLayers.length + 1}`,
        spatialMode: partialConfig.spatialMode || 'A_TO_B',
        reverse: partialConfig.reverse || false,
        shaderMode: partialConfig.shaderMode || 'ENERGY_BEAM',
        delay: partialConfig.delay !== undefined ? partialConfig.delay : Number(Math.min(duration * 0.8, duration * 0.15 * curLayers.length).toFixed(2)),
        duration: partialConfig.duration !== undefined ? partialConfig.duration : Number((duration * 0.4).toFixed(2)),
        scale: partialConfig.scale || 1.0,
        enabled: true,
        generatesHit: false
      };
      this.store.updateConfig({ layers: [...curLayers, newLayer] }, true);
      this.callbacks.requestRender();
    };

    this.container.querySelector('#tl-btn-add-layer')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({ name: '次生圖層', shaderMode: 'ENERGY_BEAM', duration: 0.4 });
    });

    this.container.querySelector('#tl-btn-add-layer-caster')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({
        name: '自身揮刀/升空',
        spatialMode: 'AT_CASTER',
        shaderMode: 'SLASH_BLADE',
        delay: 0.0,
        duration: Number((duration * 0.35).toFixed(2))
      });
    });

    this.container.querySelector('#tl-btn-add-layer-traj')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({
        name: '位移飛行彈道',
        spatialMode: 'A_TO_B',
        shaderMode: 'ENERGY_BEAM',
        delay: Number((duration * 0.2).toFixed(2)),
        duration: Number((duration * 0.4).toFixed(2))
      });
    });

    this.container.querySelector('#tl-btn-add-layer-sky')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({
        name: '天降雷劈/流星',
        spatialMode: 'VERTICAL_SKY_TO_B',
        shaderMode: 'DIELECTRIC_LIGHTNING',
        delay: Number((duration * 0.3).toFixed(2)),
        duration: Number((duration * 0.35).toFixed(2))
      });
    });

    this.container.querySelector('#tl-btn-add-layer-target')?.addEventListener('click', (e) => {
      e.stopPropagation();
      addLayerWithConfig({
        name: '目標受擊爆裂',
        spatialMode: 'AT_TARGET',
        shaderMode: 'EARTH_SHATTER',
        delay: Number((duration * 0.5).toFixed(2)),
        duration: Number((duration * 0.35).toFixed(2))
      });
    });

    // 圖層素材下拉切換
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
            this.callbacks.requestRender();
          }
        }
      });
    });

    // 選中圖層淡入淡出面板微調
    this.container.querySelector('#tl-btn-close-clip-bar')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selection.selectClip(null);
      this.callbacks.requestRender();
    });

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
        const selClipIdx = this.selection.getSelectedClipIndex();
        if (selClipIdx !== null) {
          const layers = [...(this.store.getPreset().layers || [])];
          if (layers[selClipIdx]) {
            layers[selClipIdx] = { ...layers[selClipIdx], [param]: val };
            this.store.updateConfig({ layers }, false);
          }
        }
      });
      inputEl.addEventListener('change', () => {
        if (this.selection.getSelectedClipIndex() !== null) {
          this.callbacks.requestRender();
        }
      });
    });

    // 跳轉編輯原素材按鈕
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
          this.callbacks.requestRender();
        }
      });
    });

    // 圖層啟用切換與刪除
    this.container.querySelectorAll('.tl-layer-toggle-btn').forEach(btnEl => {
      btnEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const layerIdx = Number((btnEl as HTMLElement).dataset.layerIdx);
        const layers = [...(this.store.getPreset().layers || [])];
        if (layers[layerIdx]) {
          const curState = layers[layerIdx].enabled !== false;
          layers[layerIdx] = { ...layers[layerIdx], enabled: !curState };
          this.store.updateConfig({ layers }, true);
          this.callbacks.requestRender();
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
          if (this.selection.getSelectedClipIndex() === layerIdx) {
            this.selection.selectClip(null);
          }
          this.store.updateConfig({ layers }, true);
          this.callbacks.requestRender();
        }
      });
    });
  }

  /**
   * 8. 次生圖層 Clip 拖曳移動與邊緣拉伸 (Resize)
   */
  private bindLayerClips(duration: number): void {
    // 8.1 右側邊緣拉伸 handle
    this.container.querySelectorAll('.tl-clip-resize-handle').forEach(handleEl => {
      const handle = handleEl as HTMLElement;
      const layerIdx = Number(handle.dataset.layerIdx);

      handle.addEventListener('pointerdown', (evt) => {
        const e = evt as PointerEvent;
        e.stopPropagation();
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
          const pointerTime = (offsetX / trackRect.width) * duration;
          const maxDur = Math.max(0.05, duration - startDelay);
          const newDur = Math.max(0.05, Math.min(maxDur, pointerTime - startDelay));
          lastDuration = Number(newDur.toFixed(2));

          if (clipEl) {
            const durPct = Math.min(100 - ((startDelay / duration) * 100), Math.max(4, (lastDuration / duration) * 100));
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
          this.callbacks.requestRender();
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
        if ((e.target as HTMLElement).classList.contains('tl-clip-resize-handle')) {
          return;
        }

        if (this.store.isTrackLocked(`layer_${layerIdx}`)) {
          const curSel = this.selection.getSelectedClipIndex();
          this.selection.selectClip(curSel === layerIdx ? null : layerIdx);
          this.callbacks.requestRender();
          return;
        }

        // Shift+點擊: 刪除此圖層 Clip
        if (e.shiftKey || e.altKey) {
          e.stopPropagation();
          const layers = [...(this.store.getPreset().layers || [])];
          if (layers.length > 0) {
            layers.splice(layerIdx, 1);
            if (this.selection.getSelectedClipIndex() === layerIdx) {
              this.selection.selectClip(null);
            }
            this.store.updateConfig({ layers }, true);
            this.callbacks.requestRender();
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
          const maxDelay = Math.max(0, duration - clipDuration);
          const newDelay = Math.max(0, Math.min(maxDelay, (deltaX / trackRect.width) * duration));
          lastDelay = Number(newDelay.toFixed(2));

          const startPct = Math.min(95, Math.max(0, (lastDelay / duration) * 100));
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

          if (!hasMoved) {
            const curSel = this.selection.getSelectedClipIndex();
            const newSel = curSel === layerIdx ? null : layerIdx;
            this.selection.selectClip(newSel);
            this.selection.selectTrack(newSel !== null ? { type: 'LAYER', index: layerIdx } : null);
            this.callbacks.requestRender();
            return;
          }

          if (hasMoved && lastDelay !== initialDelay) {
            const finalLayers = [...(this.store.getPreset().layers || [])];
            if (finalLayers[layerIdx]) {
              finalLayers[layerIdx] = { ...finalLayers[layerIdx], delay: lastDelay };
              this.store.updateConfig({ layers: finalLayers }, false);
            }
          }
          this.callbacks.requestRender();
        };

        clip.addEventListener('pointermove', onClipMove);
        clip.addEventListener('pointerup', onClipUp);
        clip.addEventListener('pointercancel', onClipUp);
      });
    });
  }
}
