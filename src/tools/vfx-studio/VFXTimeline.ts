import { VFXImpactCue, VFXPreset } from '../../models/VFX';
import { VFXStudioStore } from './VFXStudioStore';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';

/**
 * ⏱️ VFXTimeline
 * 專業多軌時間軸編輯組件 (Multi-track Sequence Timeline & Scrubbing Controller)
 * 嚴格遵循 docs/VFX_STUDIO_GEMINI_3_8_FLASH_ACCEPTANCE_FIX.md 規範：
 * 1. constructor 立即初始 render 當前 Preset。
 * 2. 具備時間刻度尺 (Ruler)、貫穿動態播放頭 (.tl-playhead) 與精確秒數顯示。
 * 3. 點擊 / 拖動 Ruler 進行即時 seek；播放時由單一時鐘驅動平滑前進。
 * 4. Cue Marker 可拖曳微調，限制在 0～duration。
 * 5. 拖曳是一筆 Undo Transaction，pointermove 期間不累積歷史記錄，pointerup 提交唯一快照。
 * 6. 支援雙擊空白新增 Cue、Shift+點擊刪除 Cue。
 */
export class VFXTimeline {
  private container: HTMLElement;
  private store: VFXStudioStore;
  private fxEngine: CombatFXEngine;
  private duration: number = 0.5;
  private isDraggingCue: boolean = false;
  private activeDragCueIndex: number = -1;
  private isScrubbingPlayhead: boolean = false;
  private unsubscribeTick: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.store = VFXStudioStore.getInstance();
    this.fxEngine = CombatFXEngine.getInstance();

    this.store.subscribe((preset) => {
      // 拖曳 Cue 期間不重建整張 DOM，避免中斷指標捕捉
      if (!this.isDraggingCue) {
        this.render(preset);
      }
    });

    // 🌟 規範 8.2.1：constructor 完成後立即 render 當前 Preset
    this.render(this.store.getPreset());

    // 訂閱引擎時鐘 Tick 驅動動態播放頭
    this.bindClockTick();
  }

  private bindClockTick(): void {
    if (this.unsubscribeTick) {
      this.unsubscribeTick();
    }
    const clock = this.fxEngine.getPlaybackClock();
    this.unsubscribeTick = clock.onTick((currentTime, progress) => {
      if (!this.isScrubbingPlayhead) {
        this.updatePlayhead(currentTime, progress);
      }
    });
  }

  public updatePlayhead(currentTime: number, progress: number): void {
    const playhead = this.container.querySelector('#tl-playhead') as HTMLElement;
    const timeDisplay = this.container.querySelector('#tl-time-display') as HTMLElement;

    if (playhead) {
      const pct = Math.min(100, Math.max(0, progress * 100));
      playhead.style.left = `calc(120px + (100% - 130px) * ${pct / 100})`;
    }

    if (timeDisplay) {
      timeDisplay.textContent = `${currentTime.toFixed(2)}s / ${this.duration.toFixed(2)}s`;
    }
  }

  public render(preset: VFXPreset): void {
    this.duration = Math.max(0.1, preset.duration || 0.4);
    const cues = preset.impactCues || [];
    const layers = preset.layers || [];
    const mutes = this.store.getTrackMuteStates();

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

    this.container.innerHTML = `
      <div class="vfx-timeline-panel" style="background: #111827; border-top: 1px solid #374151; padding: 6px 14px 10px 14px; font-size: 0.75rem; color: #9ca3af; display: flex; flex-direction: column; gap: 6px; user-select: none; position: relative;">
        <!-- 頂部標題、秒數與功能控制列 -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1f2937; padding-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: bold; color: #38bdf8; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
              ⏱️ 專業多軌時間軸 (Multi-track Timeline)
            </span>
            <span id="tl-time-display" style="color: #fbbf24; font-family: monospace; font-weight: bold; background: #1e293b; padding: 2px 8px; border-radius: 4px; border: 1px solid #334155;">
              0.00s / ${this.duration.toFixed(2)}s
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
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
          <!-- 播放頭 (Playhead) 貫穿整個工作區 -->
          <div id="tl-playhead" class="tl-playhead" style="position: absolute; left: 120px; top: 0; bottom: 0; width: 2px; background: #ef4444; z-index: 50; pointer-events: auto; cursor: ew-resize; box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);">
            <div style="position: absolute; top: -2px; left: -5px; width: 12px; height: 10px; background: #ef4444; clip-path: polygon(0 0, 100% 0, 50% 100%);"></div>
          </div>

          <!-- 軌道 0: 時間刻度尺 (Ruler Track) -->
          <div class="tl-track-row" style="display: flex; align-items: center; gap: 8px;">
            <div class="tl-track-header" style="width: 112px; display: flex; align-items: center; justify-content: space-between;">
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

          <!-- 軌道 1: 主特效軌 (Main Track) -->
          <div class="tl-track-row" style="display: flex; align-items: center; gap: 8px;">
            <div class="tl-track-header" style="width: 112px; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: #cbd5e1; font-weight: 500; font-size: 0.72rem;">⚔️ 主特效軌</span>
              <button class="tl-mute-btn" data-track="main" style="background: ${mutes.main ? '#ef4444' : '#334155'}; color: #fff; border: none; padding: 1px 5px; border-radius: 3px; font-size: 0.65rem; cursor: pointer;" title="預覽靜音此軌道 (不影響 Preset 正式設定)">M</button>
            </div>
            <div class="tl-track-bar" style="flex: 1; height: 16px; background: #1e293b; border-radius: 3px; position: relative; overflow: hidden; border: 1px solid #334155;">
              <div style="position: absolute; left: 0; top: 0; bottom: 0; width: 100%; background: linear-gradient(90deg, rgba(56, 189, 248, 0.4), rgba(56, 189, 248, 0.8)); border-radius: 2px; display: flex; align-items: center; padding-left: 6px; font-size: 0.68rem; color: #fff;">
                ${preset.trajectory || 'DIRECT'} | ${preset.shaderMode || 'ENERGY'}
              </div>
            </div>
          </div>

          <!-- 軌道 2: 次生圖層軌 (Layers Track) -->
          <div class="tl-track-row" style="display: flex; align-items: center; gap: 8px;">
            <div class="tl-track-header" style="width: 112px; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: #cbd5e1; font-weight: 500; font-size: 0.72rem;">🔮 次生圖層</span>
              <button class="tl-mute-btn" data-track="layers" style="background: ${mutes.layers ? '#ef4444' : '#334155'}; color: #fff; border: none; padding: 1px 5px; border-radius: 3px; font-size: 0.65rem; cursor: pointer;" title="預覽靜音次生圖層">M</button>
            </div>
            <div class="tl-track-bar" style="flex: 1; height: 16px; background: #1e293b; border-radius: 3px; position: relative; border: 1px solid #334155;">
              ${layers.length === 0 ? '<span style="font-size: 0.65rem; color: #475569; padding-left: 6px; line-height: 16px;">(無次生圖層)</span>' : ''}
              ${layers.map(layer => {
                const startPct = Math.min(95, Math.max(0, ((layer.delay || 0) / this.duration) * 100));
                const durPct = Math.min(100 - startPct, Math.max(8, ((layer.duration || 0.2) / this.duration) * 100));
                return `
                  <div style="position: absolute; left: ${startPct}%; top: 1px; bottom: 1px; width: ${durPct}%; background: rgba(168, 85, 247, 0.6); border: 1px solid #c084fc; border-radius: 2px; display: flex; align-items: center; padding: 0 4px; font-size: 0.65rem; color: #fff; white-space: nowrap; overflow: hidden;" title="Layer: ${layer.presetId || layer.shaderMode}">
                    ${layer.presetId || layer.shaderMode}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- 軌道 3: 打擊感 Cue 軌 (Impact Cue Track) -->
          <div class="tl-track-row" style="display: flex; align-items: center; gap: 8px;">
            <div class="tl-track-header" style="width: 112px; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: #cbd5e1; font-weight: 500; font-size: 0.72rem;">🥊 打擊 Cue 點</span>
              <button class="tl-mute-btn" data-track="impact" style="background: ${mutes.impact ? '#ef4444' : '#334155'}; color: #fff; border: none; padding: 1px 5px; border-radius: 3px; font-size: 0.65rem; cursor: pointer;" title="預覽靜音打擊反饋">M</button>
            </div>
            <div id="tl-cue-track-bar" class="tl-track-bar tl-cue-bar" style="flex: 1; height: 26px; background: #1f2937; border-radius: 3px; position: relative; border: 1px dashed #4b5563; cursor: crosshair;" title="雙擊空白處新增 Cue">
              ${cues.map((cue, idx) => {
                const leftPct = Math.min(100, Math.max(0, (cue.time / this.duration) * 100));
                const isPri = cue.isPrimary || (idx === cues.length - 1);
                const color = isPri ? '#ef4444' : '#f59e0b';
                return `
                  <div class="tl-cue-marker" data-cue-idx="${idx}" style="position: absolute; left: ${leftPct}%; top: 50%; transform: translate(-50%, -50%); cursor: grab; display: flex; flex-direction: column; align-items: center; z-index: 20; touch-action: none;" title="${cue.cueId}: ${cue.time.toFixed(2)}s\n(拖曳微調 / Shift+點擊刪除)">
                    <div class="tl-cue-diamond" style="width: 11px; height: 11px; background: ${color}; transform: rotate(45deg); border: 1.5px solid #fff; box-shadow: 0 0 6px ${color}; pointer-events: none;"></div>
                    <span class="tl-cue-time-tag" style="font-size: 0.62rem; color: ${color}; font-weight: bold; font-family: monospace; margin-top: 2px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); pointer-events: none;">${cue.time.toFixed(2)}s</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(preset);
    this.bindClockTick();
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
        this.addNewCueAt(preset, this.fxEngine.getPlaybackClock().getCurrentTime());
      });
    }

    // 4. 尺規 Seek 控制 (點擊 / 拖動 Ruler)
    const rulerBar = this.container.querySelector('#tl-ruler-bar') as HTMLElement;
    if (rulerBar) {
      const handleSeek = (e: MouseEvent | PointerEvent) => {
        const rect = rulerBar.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const targetTime = Number(((offsetX / rect.width) * this.duration).toFixed(2));
        this.fxEngine.seek(targetTime, false);
        this.updatePlayhead(targetTime, targetTime / this.duration);
      };

      rulerBar.addEventListener('pointerdown', (e) => {
        this.isScrubbingPlayhead = true;
        rulerBar.setPointerCapture(e.pointerId);
        handleSeek(e);
      });

      rulerBar.addEventListener('pointermove', (e) => {
        if (this.isScrubbingPlayhead) {
          handleSeek(e);
        }
      });

      const stopScrubbing = (e: PointerEvent) => {
        if (this.isScrubbingPlayhead) {
          this.isScrubbingPlayhead = false;
          try { rulerBar.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      };
      rulerBar.addEventListener('pointerup', stopScrubbing);
      rulerBar.addEventListener('pointercancel', stopScrubbing);
    }

    // 5. Cue 軌道雙擊新增 Cue
    const cueTrackBar = this.container.querySelector('#tl-cue-track-bar') as HTMLElement;
    if (cueTrackBar) {
      cueTrackBar.addEventListener('dblclick', (e) => {
        const rect = cueTrackBar.getBoundingClientRect();
        const offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const targetTime = Number(((offsetX / rect.width) * this.duration).toFixed(2));
        this.addNewCueAt(preset, targetTime);
      });
    }

    // 6. 🌟 Cue Marker 拖曳交易與點擊刪除 (規範 8.2.4 & 8.2.5)
    this.container.querySelectorAll('.tl-cue-marker').forEach(markerEl => {
      const el = markerEl as HTMLElement;
      const cueIdx = Number(el.dataset.cueIdx);

      el.addEventListener('pointerdown', (evt) => {
        const e = evt as PointerEvent;
        // Shift+點擊: 刪除此 Cue
        if (e.shiftKey || e.altKey) {
          e.stopPropagation();
          const cues = [...(preset.impactCues || [])];
          if (cues.length > 1) {
            cues.splice(cueIdx, 1);
            this.store.updateConfig({ impactCues: cues }, true);
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

          // 🌟 規範 8.2.5：在 pointerup 提交最終值，整體拖曳維持為一筆 Undo Transaction
          if (hasMoved && lastComputedTime !== initialTime) {
            const finalCues = [...(this.store.getPreset().impactCues || [])];
            if (finalCues[cueIdx]) {
              finalCues[cueIdx].time = lastComputedTime;
              // 依時間重新排序 Cue 列表
              finalCues.sort((a, b) => a.time - b.time);
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
