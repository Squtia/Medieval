import { VFXStudioStore } from './VFXStudioStore';
import { VFXTimeline } from './VFXTimeline';
import { VFXInspector } from './VFXInspector';
import { VFXLibrary } from './VFXLibrary';
import { VFXStage } from './VFXStage';
import { CombatFXEngine, ScreenPoint } from '../../ui/fx/CombatFXEngine';
import { VFXStudioAdapter } from '../../ui/fx/VFXPlayer';
import { VFXPreset, VFXImpactCue, getTrajectorySpatialAnchor, calculateSpatialPoint, calculateCasterMotionOffset } from '../../models/VFX';

/**
 * 🎮 VFXStudioController
 * 特效工房主控制器 (Main Controller)
 * 協同 Store、Timeline、Inspector、Library、Stage 與 StudioAdapter，並整合效能預算監控 HUD
 */
export class VFXStudioController {
  private store: VFXStudioStore;
  private timeline: VFXTimeline;
  private inspector: VFXInspector;
  private library: VFXLibrary;
  private stage: VFXStage;
  private studioAdapter: VFXStudioAdapter;

  private hudBudgetTimer: any = null;

  constructor() {
    this.store = VFXStudioStore.getInstance();

    const viewportContainer = document.getElementById('viewport')!;
    const casterEl = document.getElementById('ref-caster')!;
    const targetEls = Array.from(document.querySelectorAll('#target-stage-wrapper .target, #ref-target')) as HTMLElement[];

    this.studioAdapter = new VFXStudioAdapter({
      viewportContainer,
      casterElement: casterEl,
      targetElements: targetEls
    });

    this.stage = new VFXStage(this.studioAdapter);

    const timelineContainer = document.getElementById('timeline-mount-point')!;
    this.timeline = new VFXTimeline(timelineContainer);
    const frameEngine = this.timeline.getFrameEngine();

    // 建立視口基準測試標記 (Frame Benchmark Marker)
    this.initBenchmarkMarker();

    // 🌟 核心：監聽 FrameTimelineEngine 的每一影格，100% 統一走同一套確定性影格求值管線
    // 遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 3.2 節與第 14 節規範：
    // 連續播放與時間軸定格在物理層面 100% 共享相同的 renderStudioFrameAt 求值核心，徹底消除雙軌分裂
    frameEngine.onFrame((data) => {
      this.renderStudioFrameAt(data.time);

      const casterEl = document.getElementById('ref-caster');
      const targetEl = document.querySelector('#target-stage-wrapper .target, #ref-target') as HTMLElement | null;
      this.updateTargetImpactFeedbackAt(this.store.getPreset(), data.time, targetEl);
      this.updateCasterMotionAt(this.store.getPreset(), data.time, casterEl);
      this.updateBenchmarkMarkerAt(data.time, data.frame, data.totalFrames);
    });

    // 🌟 核心：雙向同步頂部與底部播放/暫停狀態
    frameEngine.onStateChange((state) => {
      const isPlaying = state === 'PLAYING';
      this.syncPlayPauseUI(isPlaying);
      if (!isPlaying) {
        this.renderStudioFrameAt(frameEngine.getCurrentTime());
      }
    });

    const leftSidebar = document.querySelector('.sidebar-left') as HTMLElement;
    const rightSidebar = document.querySelector('.sidebar-right') as HTMLElement;
    this.inspector = new VFXInspector(leftSidebar, rightSidebar);
    this.inspector.bindAll();

    // 🌟 串接時間軸 Cue 選取與情境式 Inspector 編輯卡片 (#card-cue-inspector)
    // 遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 4 節與第 11 節規範
    this.timeline.onSelectCue((cueIndex) => {
      this.inspector.setSelectedCueIndex(cueIndex);
    });

    // 🌟 串接時間軸軌道選取與情境式 Inspector 動態收合（Phase 3 規範）
    this.timeline.onSelectTrack((trackInfo) => {
      this.inspector.setContextualTarget(trackInfo);
    });

    // ⚡ 當 Preset 參數變更時，若時長有改則同步更新 FrameTimelineEngine，並檢查草稿暫存狀態
    this.store.subscribe((preset) => {
      if (preset.duration && preset.duration !== frameEngine.getDuration()) {
        frameEngine.setDuration(preset.duration);
      }
      this.renderStudioFrameAt(frameEngine.getCurrentTime());
      this.updateBenchmarkMarkerAt(frameEngine.getCurrentTime(), frameEngine.getCurrentFrame(), frameEngine.getTotalFrames());
      this.syncStashButtonUI();
    });

    const libraryMount = document.getElementById('library-mount-point')!;
    this.library = new VFXLibrary(libraryMount);

    this.bindTopControls();
    this.bindKeyboard();
    this.startQualityBudgetMonitor();

    // 初始狀態同步
    this.syncStashButtonUI();
    this.renderStudioFrameAt(0);
    this.updateBenchmarkMarkerAt(0, 0, frameEngine.getTotalFrames());

    if (typeof window !== 'undefined') {
      (window as any).__FX_ENGINE__ = CombatFXEngine.getInstance();
      (window as any).CombatFXEngine = CombatFXEngine;
    }
  }

  private benchmarkMarker: HTMLElement | null = null;
  private lastTriggeredCueId: string | null = null;
  private lastPlayedLoopFrame: number = -1;

  /**
   * 🌟 播放專案原生真實實戰特效管線 (包含真實粒子噴發、光柱、刀芒、地裂與衝擊波)
   */
  private playNativeEffect(): void {
    const preset = this.store.getPreset();
    // 🌟 嚴格遵照文件 Phase 1：播放新特效前徹底清除舊粒子、回調與幾何體，保證零殘留
    this.studioAdapter.clear();
    CombatFXEngine.getInstance().clearStudioPreview();

    if (this.stage.isAOE()) {
      this.studioAdapter.playMultiTarget(preset);
    } else {
      this.studioAdapter.play(preset);
    }
  }

  private initBenchmarkMarker(): void {
    const overlay = document.getElementById('scene-overlay') || document.getElementById('viewport');
    if (!overlay) return;
    let marker = document.getElementById('benchmark-marker');
    if (!marker) {
      marker = document.createElement('div');
      marker.id = 'benchmark-marker';
      marker.style.position = 'absolute';
      marker.style.width = '36px';
      marker.style.height = '36px';
      marker.style.borderRadius = '50%';
      marker.style.background = 'radial-gradient(circle, #38bdf8 0%, #0284c7 60%, rgba(2, 132, 199, 0.2) 100%)';
      marker.style.border = '2px solid #ffffff';
      marker.style.boxShadow = '0 0 16px rgba(56, 189, 248, 0.9), 0 0 30px rgba(56, 189, 248, 0.5)';
      marker.style.display = 'none'; // 隱藏搶眼藍球，避免遮擋真實 3D 特效
      marker.style.flexDirection = 'column';
      marker.style.alignItems = 'center';
      marker.style.justifyContent = 'center';
      marker.style.zIndex = '60';
      marker.style.pointerEvents = 'none';
      marker.style.transform = 'translate(-50%, -50%)';
      marker.innerHTML = `
        <div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div>
        <span id="benchmark-marker-label" style="position: absolute; top: 40px; font-size: 0.7rem; font-family: monospace; font-weight: bold; color: #38bdf8; background: rgba(15, 23, 42, 0.85); padding: 1px 6px; border-radius: 4px; border: 1px solid #0284c7; white-space: nowrap;">F: 00</span>
      `;
      overlay.appendChild(marker);
    }
    marker.style.display = 'none'; // 強制隱藏搶眼藍球，避免遮擋真實 3D 特效
    this.benchmarkMarker = marker;
  }

  private updateBenchmarkMarkerAt(currentTime: number, frame: number, totalFrames: number): void {
    if (!this.benchmarkMarker) return;
    const casterEl = document.getElementById('ref-caster');
    const targetEl = document.getElementById('ref-target') || document.querySelector('#target-stage-wrapper .target');
    const viewport = document.getElementById('viewport');
    if (!casterEl || !targetEl || !viewport) return;

    const preset = this.store.getPreset();
    const mode = preset.spatialMode || preset.trajectoryPath || preset.trajectory || 'A_TO_B';
    const isReverse = !!preset.reverse;
    const anchor = getTrajectorySpatialAnchor(mode);
    const mainDelay = Math.max(0, preset.mainDelay || 0);
    const totalDuration = this.timeline.getFrameEngine().getDuration();
    const mainDuration = Math.max(0.05, preset.mainDuration !== undefined ? preset.mainDuration : (totalDuration - mainDelay));
    const mainEnd = mainDelay + mainDuration;

    // 計算主軌有效播放進度 (0 ~ 1)
    let mainProgress = 0;
    if (currentTime >= mainEnd) {
      mainProgress = 1;
    } else if (currentTime > mainDelay) {
      mainProgress = (currentTime - mainDelay) / mainDuration;
    }

    const vpRect = viewport.getBoundingClientRect();
    const cRect = casterEl.getBoundingClientRect();
    const tRect = targetEl.getBoundingClientRect();

    const startX = (cRect.left + cRect.width / 2) - vpRect.left;
    const startY = (cRect.top + cRect.height / 2) - vpRect.top;
    const endX = (tRect.left + tRect.width / 2) - vpRect.left;
    const endY = (tRect.top + tRect.height / 2) - vpRect.top;

    const pt = calculateSpatialPoint(
      mode,
      isReverse,
      mainProgress,
      { x: startX, y: startY },
      { x: endX, y: endY }
    );

    this.benchmarkMarker.style.left = `${pt.x}px`;
    this.benchmarkMarker.style.top = `${pt.y}px`;

    const label = this.benchmarkMarker.querySelector('#benchmark-marker-label') as HTMLElement;
    if (label) {
      const fStr = frame.toString().padStart(2, '0');
      let tag = ' [A➔B]';
      if (mode === 'AT_CASTER') tag = ' [A自身]';
      else if (mode === 'AT_TARGET') tag = ' [B目標]';
      else if (mode === 'VERTICAL_SKY_TO_B') tag = isReverse ? ' [B➔天頂]' : ' [天降➔B]';
      else if (mode === 'DIAGONAL_SKY_TO_B') tag = isReverse ? ' [B➔斜天]' : ' [斜降➔B]';
      else if (mode === 'A_TO_VERTICAL_SKY') tag = isReverse ? ' [天頂➔A]' : ' [A➔天頂]';
      else if (mode === 'A_TO_DIAGONAL_SKY') tag = isReverse ? ' [斜天➔A]' : ' [A➔斜天]';
      else if (isReverse) tag = ' [B➔A]';

      label.textContent = `F: ${fStr} / ${totalFrames}${tag}`;
    }
  }

  public isPlaying(): boolean {
    return this.timeline.getFrameEngine().isPlaying();
  }

  public togglePlayPause(): void {
    this.timeline.getFrameEngine().togglePlayPause();
  }

  public pausePlayback(): void {
    this.timeline.getFrameEngine().pause();
  }

  public startPlayback(): void {
    this.timeline.getFrameEngine().play();
  }

  private syncPlayPauseUI(isPlaying: boolean): void {
    const btnPlayTop = document.getElementById('btn-play');
    if (btnPlayTop) {
      btnPlayTop.innerHTML = isPlaying ? '⏸ 暫停 (Space)' : '▶ 播放 (Space)';
      btnPlayTop.style.borderColor = isPlaying ? '#eab308' : '#30363d';
      btnPlayTop.style.color = isPlaying ? '#eab308' : '#c9d1d9';
    }
  }

  private bindTopControls(): void {
    // 頂部播放/暫停按鈕
    document.getElementById('btn-play')?.addEventListener('click', () => this.togglePlayPause());

    // 循環開關
    const btnLoop = document.getElementById('btn-loop');
    if (btnLoop) {
      const initialLoop = this.store.getIsLooping();
      this.timeline.getFrameEngine().setLoop(initialLoop);
      btnLoop.addEventListener('click', () => {
        const next = !this.timeline.getFrameEngine().getLoop();
        this.timeline.getFrameEngine().setLoop(next);
        this.store.setLooping(next);
        btnLoop.textContent = next ? '🔄 自動循環: 開' : '🔄 自動循環: 關';
        btnLoop.style.borderColor = next ? '#38bdf8' : '#30363d';
        btnLoop.style.color = next ? '#38bdf8' : '#c9d1d9';
      });
    }

    // 播放速度縮放 (0.25x, 0.5x, 1.0x, 2.0x)
    const speedSel = document.getElementById('select-play-speed') as HTMLSelectElement | null;
    if (speedSel) {
      speedSel.addEventListener('change', () => {
        const speed = parseFloat(speedSel.value) || 1.0;
        CombatFXEngine.getInstance().setPlaybackSpeed(speed);
      });
    }

    // Undo / Redo
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    btnUndo?.addEventListener('click', () => this.store.undo());
    btnRedo?.addEventListener('click', () => this.store.redo());

    // 固定 Seed
    const chkSeed = document.getElementById('chk-fixed-seed') as HTMLInputElement;
    chkSeed?.addEventListener('change', (e) => {
      this.store.setFixedSeed((e.target as HTMLInputElement).checked);
    });

    // 🔙 返回暫存草稿按鈕
    const btnReturnStash = document.getElementById('btn-return-stash');
    btnReturnStash?.addEventListener('click', () => {
      const popped = this.store.popStashedDraft();
      if (popped) {
        this.timeline.getFrameEngine().setDuration(popped.duration || 0.4);
        this.timeline.getFrameEngine().seekToTime(0);
        this.syncStashButtonUI();
      }
    });

    window.addEventListener('resize', () => {
      this.studioAdapter.resize();
    });

    window.addEventListener('beforeunload', (e) => {
      if (this.store.getIsDirty()) {
        e.preventDefault();
        e.returnValue = '尚有未發布至專案的特效變更，確定要離開嗎？';
      }
    });
  }

  private syncStashButtonUI(): void {
    const btn = document.getElementById('btn-return-stash');
    if (!btn) return;
    const hasStash = this.store.getHasStash();
    if (hasStash) {
      const info = this.store.getStashedDraftInfo();
      btn.style.display = 'inline-flex';
      btn.textContent = `🔙 返回草稿 [${info?.name || '先前技能'}]`;
    } else {
      btn.style.display = 'none';
    }
  }

  private bindKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && e.target && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'SELECT') {
        e.preventDefault();
        this.togglePlayPause();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        this.store.undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
        e.preventDefault();
        this.store.redo();
      }
    });
  }

  /**
   * 📊 實裝效能預算即時監控 HUD (Quality Budgets)
   * 規範標準：
   * - 單體特效預算：Draw Calls <= 35, 粒子數 <= 250
   * - 複合/大招預算：Draw Calls <= 70, 粒子數 <= 600
   */
  private startQualityBudgetMonitor(): void {
    const hud = document.getElementById('quality-budget-hud');
    if (!hud) return;

    this.hudBudgetTimer = setInterval(() => {
      const fxEngine = CombatFXEngine.getInstance();
      const scene = (fxEngine as any).scene;
      const renderer = (fxEngine as any).renderer;
      const currentPreset = this.store.getPreset();

      const isCompositeOrAOE = (currentPreset.layers && currentPreset.layers.length > 0) || this.stage.isAOE();
      const budgetMaxCalls = isCompositeOrAOE ? 70 : 35;
      const budgetMaxParticles = isCompositeOrAOE ? 600 : 250;

      let drawCalls = 0;
      let triangles = 0;
      if (renderer && renderer.info && renderer.info.render) {
        drawCalls = renderer.info.render.calls || 0;
        triangles = renderer.info.render.triangles || 0;
      }

      let activeParticles = 0;
      let activeChildCount = 0;

      if (scene && scene.children) {
        activeChildCount = scene.children.length;
        for (const child of scene.children) {
          if (child.isPoints && child.geometry?.attributes?.position) {
            activeParticles += child.geometry.attributes.position.count || 0;
          }
        }
      }

      const isOverBudget = drawCalls > budgetMaxCalls || activeParticles > budgetMaxParticles;

      hud.className = isOverBudget ? 'budget-alert' : '';
      hud.innerHTML = `
        <span style="color: ${isOverBudget ? '#ef4444' : '#10b981'}; font-weight: bold;">
          ${isOverBudget ? '⚠️ 預算超標' : '🟢 預算健康'}
        </span>
        <span>DC: <b style="color: ${drawCalls > budgetMaxCalls ? '#ef4444' : '#fbbf24'};">${drawCalls}</b>/${budgetMaxCalls}</span>
        <span>粒子: <b style="color: ${activeParticles > budgetMaxParticles ? '#ef4444' : '#38bdf8'};">${activeParticles}</b>/${budgetMaxParticles}</span>
        <span>面數: <b style="color: #cbd5e1;">${triangles}</b></span>
        <span>物件: <b style="color: #cbd5e1;">${activeChildCount}</b></span>
      `;
    }, 250);
  }

  /**
   * 🎬 即時以時間 t 求值並渲染定格影格（所見即所得 Live Morphing & Scrubbing）
   */
  private renderStudioFrameAt(targetTime: number): void {
    const preset = this.store.getPreset();
    const fxEngine = CombatFXEngine.getInstance();
    const casterEl = document.getElementById('ref-caster');
    const targetEl = document.querySelector('#target-stage-wrapper .target, #ref-target') as HTMLElement | null;

    let from: ScreenPoint | undefined;
    let to: ScreenPoint | undefined;

    if (casterEl) {
      from = this.studioAdapter.getElementCenter(casterEl);
    }
    if (targetEl) {
      to = this.studioAdapter.getElementCenter(targetEl);
    }

    // 🌟 嚴格套用 Solo 與 Mute 狀態，直接作用於底層 3D 渲染與幾何繪製
    const isMainActive = this.store.isMainTrackActive();
    const isImpactActive = !this.store.getTrackMuteStates().impact;
    const filteredPreset: VFXPreset = {
      ...preset,
      layers: (preset.layers || []).map((l, idx) => ({
        ...l,
        enabled: this.store.isLayerTrackActive(idx, l.enabled !== false)
      }))
    };
    if (!isMainActive) {
      (filteredPreset as any)._mainTrackMuted = true;
    }

    fxEngine.renderFrameAt(filteredPreset, targetTime, from, to);
    if (isImpactActive) {
      this.updateTargetImpactFeedbackAt(preset, targetTime, targetEl);
    } else if (targetEl) {
      targetEl.style.transform = '';
      targetEl.style.filter = '';
    }
    this.updateCasterMotionAt(preset, targetTime, casterEl);
  }

  /**
   * 🏃 依時間 t 動態計算施術者發力動作 (Step / Recoil / Tilt)
   */
  private updateCasterMotionAt(preset: VFXPreset, currentTime: number, casterEl: HTMLElement | null): void {
    if (!casterEl) return;
    const motion = preset.casterMotion;
    if (!motion || (!motion.stepForward && !motion.recoil && !motion.tiltAngle)) {
      casterEl.style.transform = '';
      return;
    }

    const offset = calculateCasterMotionOffset(currentTime, motion);
    if (offset.offsetX !== 0 || offset.tiltDeg !== 0) {
      casterEl.style.transform = `translateX(${offset.offsetX.toFixed(2)}px) rotate(${offset.tiltDeg.toFixed(2)}deg)`;
    } else {
      casterEl.style.transform = '';
    }
  }

  /**
   * 🥊 依時間 t 動態計算受擊卡牌的打擊回饋 (Punch / Shake / Knockback)
   */
  private updateTargetImpactFeedbackAt(preset: VFXPreset, currentTime: number, targetEl: HTMLElement | null): void {
    if (!targetEl) return;
    const impact = preset.impact;
    if (!impact) {
      targetEl.style.transform = '';
      targetEl.style.filter = '';
      return;
    }

    const cues = preset.impactCues || [{ cueId: 'default', time: (preset.duration || 0.4) * 0.6, weight: 1.0 }];
    const shakeDur = impact.shakeDuration || 0.25;
    let activeCue: VFXImpactCue | null = null;
    let cueElapsed = 0;

    for (const cue of cues) {
      const dt = currentTime - cue.time;
      if (dt >= 0 && dt <= shakeDur) {
        activeCue = cue;
        cueElapsed = dt;
        break;
      }
    }

    if (activeCue) {
      // 🌟 當播放頭精確掃過 Cue 點起點時，觸發一次跳動傷害飄字反饋與真實破空星芒
      if (this.lastTriggeredCueId !== activeCue.cueId && cueElapsed < 0.1) {
        this.lastTriggeredCueId = activeCue.cueId;
        this.showDamagePopup(targetEl, !!activeCue.isPrimary);
        const targetPt = this.studioAdapter.getElementCenter(targetEl);
        const worldPos = CombatFXEngine.getInstance().screenToWorld(targetPt);
        CombatFXEngine.getInstance().playCueSparks(worldPos, preset.colorCore || '#f59e0b', 14);
      }

      const progress = cueElapsed / shakeDur;
      const decay = 1.0 - progress;
      const punchScale = 1.0 - (1.0 - (impact.targetPunchScale || 0.88)) * decay;
      const shakeX = Math.sin(cueElapsed * 60) * (impact.shakeIntensity || 10) * decay;
      const knockback = (impact.knockbackDistance || 15) * Math.sin(progress * Math.PI);

      targetEl.style.transform = `translateX(${shakeX + knockback}px) scale(${punchScale})`;
      if (cueElapsed < 0.08 && impact.hitFlashColor) {
        targetEl.style.filter = `brightness(1.8) drop-shadow(0 0 12px ${impact.hitFlashColor})`;
      } else {
        targetEl.style.filter = '';
      }
    } else {
      targetEl.style.transform = '';
      targetEl.style.filter = '';
      // 當離開任何 cue 的震動範圍，重置記錄以便下一次循環再次觸發
      if (currentTime < 0.05) {
        this.lastTriggeredCueId = null;
      }
    }
  }

  /**
   * 💥 在目標卡牌頭頂彈出打擊傷害數字反饋 (一般/暴擊)
   */
  private showDamagePopup(targetEl: HTMLElement, isCritical: boolean): void {
    const popup = document.createElement('div');
    popup.className = 'cue-damage-popup';
    popup.style.position = 'absolute';
    popup.style.left = '50%';
    popup.style.top = '-20px';
    popup.style.transform = 'translate(-50%, 0)';
    popup.style.fontFamily = 'monospace, sans-serif';
    popup.style.fontWeight = '900';
    popup.style.fontSize = isCritical ? '1.35rem' : '1.05rem';
    popup.style.color = isCritical ? '#ffedd5' : '#fef08a';
    popup.style.textShadow = isCritical
      ? '0 0 10px #ef4444, 0 0 20px #f97316, 2px 2px 0 #000'
      : '0 0 8px #f59e0b, 1px 1px 0 #000';
    popup.style.pointerEvents = 'none';
    popup.style.zIndex = '100';
    popup.style.transition = 'transform 0.65s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.65s ease-out';
    popup.style.whiteSpace = 'nowrap';
    popup.innerHTML = isCritical ? '🔥 CRITICAL -2,850' : '💥 -780';

    targetEl.appendChild(popup);

    requestAnimationFrame(() => {
      popup.style.transform = 'translate(-50%, -48px) scale(1.18)';
      popup.style.opacity = '0';
    });

    setTimeout(() => {
      if (popup.parentElement) popup.parentElement.removeChild(popup);
    }, 700);
  }

  public destroy(): void {
    this.timeline.getFrameEngine().stop();
    if (this.hudBudgetTimer) clearInterval(this.hudBudgetTimer);
    this.studioAdapter.clear();
  }
}
