import { VFXPreset, getTrajectorySpatialAnchor } from '../../../models/VFX';

/**
 * 🎨 TimelineView
 * 時間軸 DOM 渲染模組 (Timeline View & Template Renderer)
 * 負責渲染標尺、多軌條、Clip 區塊、Cue 菱形 Marker 與貫穿播放頭
 */
export interface TimelineRenderContext {
  preset: VFXPreset;
  duration: number;
  totalFrames: number;
  isPaused: boolean;
  selectedClipIndex: number | null;
  selectedCueIndex: number | null;
  trackMuteStates: { main: boolean; layers: boolean; impact: boolean };
  soloTrack: string | null;
  allPresets: VFXPreset[];
  isTrackLocked: (key: string) => boolean;
  isTrackSoloed: (key: string) => boolean;
}

export class TimelineView {
  public static renderHTML(ctx: TimelineRenderContext): string {
    const {
      preset,
      duration,
      totalFrames,
      isPaused,
      selectedClipIndex,
      selectedCueIndex,
      trackMuteStates,
      soloTrack,
      allPresets,
      isTrackLocked,
      isTrackSoloed
    } = ctx;

    const cues = preset.impactCues || [];
    const layers = preset.layers || [];

    // 計算尺規時間刻度
    const step = duration > 1.2 ? 0.2 : 0.1;
    const tickCount = Math.floor(duration / step);
    const rulerTicks: { time: number; pct: number }[] = [];
    for (let i = 0; i <= tickCount; i++) {
      const t = Number((i * step).toFixed(2));
      if (t <= duration) {
        rulerTicks.push({ time: t, pct: (t / duration) * 100 });
      }
    }
    if (rulerTicks.length === 0 || rulerTicks[rulerTicks.length - 1].time < duration) {
      rulerTicks.push({ time: duration, pct: 100 });
    }

    const anchor = getTrajectorySpatialAnchor(preset.spatialMode || preset.trajectoryPath || preset.trajectory);
    const anchorLabel = anchor === 'AT_CASTER' ? '🏠 自身(A)' : anchor === 'TRAJECTORY' ? '🚀 彈道(A➔B)' : '💥 目標(B)';
    const mainDelay = Math.max(0, preset.mainDelay || 0);
    const mainDuration = Math.max(0.05, Math.min(duration - mainDelay, preset.mainDuration !== undefined ? preset.mainDuration : (duration - mainDelay)));
    const mainStartPct = Math.min(95, Math.max(0, (mainDelay / duration) * 100));
    const mainDurPct = Math.min(100 - mainStartPct, Math.max(5, (mainDuration / duration) * 100));

    return `
      <div class="vfx-timeline-panel" style="background: #111827; border-top: 1px solid #374151; padding: 6px 14px 10px 14px; font-size: 0.75rem; color: #9ca3af; display: flex; flex-direction: column; gap: 6px; user-select: none; position: relative;">
        <!-- 頂部標題、秒數與功能控制列 -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #1f2937; padding-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-weight: bold; color: #38bdf8; font-size: 0.8rem; display: flex; align-items: center; gap: 4px;">
              ⏱️ 專業多軌時間軸 (Multi-track Timeline)
            </span>
            <span id="tl-time-display" style="color: #fbbf24; font-family: monospace; font-weight: bold; background: #1e293b; padding: 2px 8px; border-radius: 4px; border: 1px solid #334155;">
              Frame: 00 / ${totalFrames} (0.00s / ${duration.toFixed(2)}s)
            </span>
            <div style="display: flex; align-items: center; gap: 4px; font-size: 0.72rem; color: #94a3b8;" title="直接設定當前預設總演示時長 (0.1s ~ 5.0s)">
              <span>時長:</span>
              <input id="tl-range-duration" type="range" step="0.05" min="0.1" max="5.0" value="${duration.toFixed(2)}" style="width: 60px; accent-color: #38bdf8; cursor: pointer;">
              <input id="tl-input-duration" type="number" step="0.05" min="0.1" max="5.0" value="${duration.toFixed(2)}" style="width: 50px; background: #0f172a; border: 1px solid #475569; color: #fbbf24; border-radius: 4px; padding: 1px 4px; font-family: monospace; font-weight: bold; font-size: 0.72rem; text-align: center;">
              <span>s</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="tl-btn-play-pause" style="background: #1e293b; border: 1px solid #475569; color: ${isPaused ? '#38bdf8' : '#fbbf24'}; padding: 2px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; font-weight: bold;" title="切換播放/暫停 (Space)">${isPaused ? '▶ 播放' : '⏸ 暫停'}</button>
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

        <!-- 依文件 §5.5 縮短時長超出確認對話框 -->
        <div id="tl-duration-overflow-dialog" style="display: none; background: rgba(30, 41, 59, 0.98); border: 1px solid #ef4444; border-radius: 6px; padding: 8px 12px; margin-bottom: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.5);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: #f87171; font-weight: bold; font-size: 0.75rem;">⚠️ 縮短時長確認：以下項目將超出新時長範圍</span>
          </div>
          <div id="tl-overflow-items-list" style="max-height: 70px; overflow-y: auto; font-size: 0.7rem; color: #fca5a5; margin-bottom: 8px; font-family: monospace;"></div>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="tl-btn-dur-extend" style="background: #0284c7; color: #fff; border: none; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">延長 sequence 配合項目</button>
            <button id="tl-btn-dur-scale" style="background: #d97706; color: #fff; border: none; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">按比例縮放全部</button>
            <button id="tl-btn-dur-cancel" style="background: #475569; color: #fff; border: none; padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">取消</button>
          </div>
        </div>

        <!-- ⏱️ 多軌與時間尺規工作區 (含動態貫穿播放頭) -->
        <div id="tl-workspace" style="position: relative; display: flex; flex-direction: column; gap: 4px;">
          <!-- 播放頭 (Playhead) 貫穿整個工作區：初始對齊 0s 刻度 (188px) -->
          <div id="tl-playhead" class="tl-playhead" style="position: absolute; left: 188px; top: 0; bottom: 0; width: 2px; background: #ef4444; z-index: 50; pointer-events: auto; cursor: ew-resize; box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);">
            <div style="position: absolute; top: -2px; left: -5px; width: 12px; height: 10px; background: #ef4444; clip-path: polygon(0 0, 100% 0, 50% 100%);"></div>
          </div>

          <!-- 軌道 0: 時間刻度尺 (Ruler Track) -->
          <div class="tl-track-row" style="display: flex; align-items: center; gap: 8px;">
            <div class="tl-track-header" style="width: 180px; display: flex; align-items: center; justify-content: space-between;">
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
            <div class="tl-track-header" style="width: 180px; display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <span style="color: #38bdf8; font-weight: bold; font-size: 0.72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">👑 主圖層 (L0)</span>
              <div style="display: flex; gap: 2px; flex-shrink: 0;">
                <button class="tl-solo-btn ${isTrackSoloed('main') ? 'active' : ''}" data-track="main" style="background: ${isTrackSoloed('main') ? '#eab308' : '#334155'}; color: ${isTrackSoloed('main') ? '#000' : '#fff'}; font-weight: bold; border: none; padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="獨奏主圖層 (Solo)">S</button>
                <button class="tl-mute-btn ${trackMuteStates.main ? 'active' : ''}" data-track="main" style="background: ${trackMuteStates.main ? '#ef4444' : '#334155'}; color: #fff; border: none; padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="靜音主圖層 (Mute)">M</button>
                <button class="tl-lock-btn ${isTrackLocked('main') ? 'active' : ''}" data-track="main" style="background: ${isTrackLocked('main') ? '#d97706' : '#1e293b'}; color: ${isTrackLocked('main') ? '#fff' : '#94a3b8'}; border: 1px solid ${isTrackLocked('main') ? '#f59e0b' : '#475569'}; padding: 1px 3px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="${isTrackLocked('main') ? '已鎖定 (Lock)' : '未鎖定'}">${isTrackLocked('main') ? '🔒' : '🔓'}</button>
              </div>
            </div>
            <div id="tl-main-track-bar" class="tl-track-bar" style="flex: 1; height: 20px; background: #1e293b; border-radius: 3px; position: relative; border: 1px solid #334155;">
              <div class="tl-main-clip ${isTrackLocked('main') ? 'locked' : ''}" style="position: absolute; left: ${mainStartPct}%; top: 1px; bottom: 1px; width: ${mainDurPct}%; background: linear-gradient(90deg, rgba(56, 189, 248, 0.75), rgba(2, 132, 199, 0.9)); border: 1px solid #38bdf8; border-radius: 2px; display: flex; align-items: center; justify-content: space-between; padding: 0 5px; font-size: 0.65rem; color: #fff; cursor: ${isTrackLocked('main') ? 'not-allowed' : 'grab'}; user-select: none; touch-action: none;" title="主圖層: ${anchorLabel} ${preset.trajectoryPath || preset.trajectory || 'DIRECT'}${preset.reverse ? ' [🔄反向]' : ''}\n起點: ${mainDelay.toFixed(2)}s | 時長: ${mainDuration.toFixed(2)}s\n(${isTrackLocked('main') ? '🔒 已鎖定禁止拖動' : '拖動本體調整起始前搖 / 拖拉右緣調整時長'})">
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; font-size: 0.64rem;">
                  <b style="color: #fef08a;">${anchorLabel}</b> ${preset.trajectoryPath || preset.trajectory || 'DIRECT'}${preset.reverse ? ' 🔄' : ''} (${mainDuration.toFixed(2)}s)
                </span>
                <div class="tl-main-resize-handle" style="width: 10px; height: 100%; background: #bae6fd; opacity: 0.9; cursor: ${isTrackLocked('main') ? 'not-allowed' : 'ew-resize'}; border-radius: 2px; margin-right: -4px; z-index: 5;" title="${isTrackLocked('main') ? '🔒 已鎖定禁止拉伸' : '拖動調整主圖層時長'}"></div>
              </div>
            </div>
          </div>

          <!-- 軌道 2..N: 獨立次生圖層列表 (Multi-layer Tracks) -->
          ${layers.map((layer, idx) => {
            const lDelay = Math.max(0, layer.delay || 0);
            const lDur = Math.max(0.05, Math.min(duration - lDelay, layer.duration !== undefined ? layer.duration : 0.2));
            const startPct = Math.min(95, Math.max(0, (lDelay / duration) * 100));
            const durPct = Math.min(100 - startPct, Math.max(5, (lDur / duration) * 100));
            const lAnchor = getTrajectorySpatialAnchor(layer.spatialMode || layer.trajectory);
            const lAnchorLabel = layer.spatialMode === 'AT_CASTER' ? '🏠自身' : layer.spatialMode === 'AT_TARGET' ? '💥目標' : layer.spatialMode === 'VERTICAL_SKY_TO_B' ? '⚡天降' : layer.spatialMode === 'DIAGONAL_SKY_TO_B' ? '☄️斜降' : layer.spatialMode === 'A_TO_VERTICAL_SKY' ? '🏹朝天' : layer.spatialMode === 'A_TO_DIAGONAL_SKY' ? '🚀斜空' : (lAnchor === 'AT_CASTER' ? '🏠自身' : lAnchor === 'AT_TARGET' ? '💥目標' : '🚀彈道');
            const isMuted = layer.enabled === false;
            const isSoloed = isTrackSoloed(`layer_${idx}`);
            const isLocked = isTrackLocked(`layer_${idx}`);
            const refPreset = allPresets.find(p => p.id === layer.presetId);
            const refDisplayName = refPreset ? refPreset.name : (layer.presetId || layer.shaderMode || `圖層 ${idx + 1}`);
            const isClipSelected = selectedClipIndex === idx;
            const fadeInVal = layer.fadeIn ?? 0.05;
            const fadeOutVal = layer.fadeOut ?? 0.08;
            const inWidthPct = Math.max(3, Math.min(40, (fadeInVal / lDur) * 100));
            const outWidthPct = Math.max(3, Math.min(40, (fadeOutVal / lDur) * 100));

            return `
              <div class="tl-track-row tl-layer-track-row" data-layer-idx="${idx}" style="display: flex; align-items: center; gap: 8px;">
                <div class="tl-track-header" style="width: 180px; display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                  <div style="display: flex; align-items: center; gap: 3px; flex: 1; min-width: 0;">
                    <select class="tl-layer-preset-select" data-layer-idx="${idx}" ${isLocked ? 'disabled' : ''} style="flex: 1; min-width: 48px; max-width: 88px; background: #0f172a; border: 1px solid ${isLocked ? '#475569' : '#3b82f6'}; color: #93c5fd; font-size: 0.61rem; padding: 1px; border-radius: 3px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;" title="${isLocked ? '🔒 軌道已鎖定無法更換' : '切換此圖層引用的特效素材'}">
                      <option value="" disabled ${!layer.presetId ? 'selected' : ''}>-- 選擇素材 --</option>
                      ${allPresets.map(p => {
                        const anchor = getTrajectorySpatialAnchor(p.spatialMode || p.trajectoryPath || p.trajectory);
                        const tag = anchor === 'AT_CASTER' ? '[自身]' : anchor === 'TRAJECTORY' ? '[彈道]' : '[目標]';
                        return `<option value="${p.id}" ${p.id === layer.presetId ? 'selected' : ''}>${tag} ${p.name || p.id}</option>`;
                      }).join('')}
                    </select>
                    ${layer.presetId ? `
                      <button class="tl-btn-jump-preset" data-preset-id="${layer.presetId}" style="background: transparent; border: none; color: #38bdf8; font-size: 0.6rem; cursor: pointer; padding: 0 2px; flex-shrink: 0;" title="🔗 暫存當前技能並跳轉編輯原素材 [${refDisplayName}]">🔗</button>
                    ` : ''}
                  </div>
                  <div style="display: flex; gap: 2px; flex-shrink: 0;">
                    <button class="tl-layer-solo-btn ${isSoloed ? 'active' : ''}" data-layer-idx="${idx}" style="background: ${isSoloed ? '#eab308' : '#334155'}; color: ${isSoloed ? '#000' : '#fff'}; font-weight: bold; border: none; padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="獨奏此圖層 (Solo)">S</button>
                    <button class="tl-layer-toggle-btn" data-layer-idx="${idx}" style="background: ${isMuted ? '#ef4444' : '#334155'}; color: #fff; border: none; padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="${isMuted ? '啟用圖層' : '靜音圖層'}">${isMuted ? '❌' : '👁️'}</button>
                    <button class="tl-layer-lock-btn ${isLocked ? 'active' : ''}" data-layer-idx="${idx}" style="background: ${isLocked ? '#d97706' : '#1e293b'}; color: ${isLocked ? '#fff' : '#94a3b8'}; border: 1px solid ${isLocked ? '#f59e0b' : '#475569'}; padding: 1px 3px; border-radius: 3px; font-size: 0.62rem; cursor: pointer;" title="${isLocked ? '已鎖定 (Lock)' : '未鎖定'}">${isLocked ? '🔒' : '🔓'}</button>
                    <button class="tl-layer-delete-btn" data-layer-idx="${idx}" ${isLocked ? 'disabled' : ''} style="background: rgba(239, 68, 68, 0.25); color: ${isLocked ? '#64748b' : '#fca5a5'}; border: 1px solid rgba(239, 68, 68, 0.5); padding: 1px 4px; border-radius: 3px; font-size: 0.62rem; cursor: ${isLocked ? 'not-allowed' : 'pointer'}; flex-shrink: 0;" title="刪除此圖層">🗑️</button>
                  </div>
                </div>
                <div class="tl-track-bar tl-single-layer-bar" data-layer-idx="${idx}" style="flex: 1; height: 20px; background: #1e293b; border-radius: 3px; position: relative; border: 1px solid #334155;">
                  <div class="tl-layer-clip ${isClipSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}" data-layer-idx="${idx}" style="position: absolute; left: ${startPct}%; top: 1px; bottom: 1px; width: ${durPct}%; background: ${isMuted ? 'rgba(75, 85, 99, 0.6)' : 'linear-gradient(90deg, rgba(168, 85, 247, 0.75), rgba(126, 34, 206, 0.9))'}; border: ${isClipSelected ? '2px solid #fbbf24' : (isMuted ? '1px solid #6b7280' : '1px solid #c084fc')}; box-shadow: ${isClipSelected ? '0 0 10px rgba(251, 191, 36, 0.7)' : 'none'}; border-radius: 2px; display: flex; align-items: center; justify-content: space-between; padding: 0 4px; font-size: 0.65rem; color: #fff; cursor: ${isLocked ? 'not-allowed' : 'grab'}; user-select: none; touch-action: none;" title="圖層 ${idx + 1}: ${refDisplayName}\n模式: ${lAnchorLabel}${layer.reverse ? ' [🔄反向]' : ''}\n起點: ${lDelay.toFixed(2)}s | 時長: ${lDur.toFixed(2)}s\n(${isLocked ? '🔒 已鎖定禁止拖動' : '點選高亮編輯淡入淡出 / 拖動本體調起點 / 拖拉右緣調時長'})">
                    <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${inWidthPct}%; background: linear-gradient(90deg, rgba(255,255,255,0.45), transparent); pointer-events: none;"></div>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; font-size: 0.63rem; padding-left: 4px; z-index: 1;">
                      <b style="color: #fef08a;">${lAnchorLabel}</b> ${refDisplayName}${layer.reverse ? ' 🔄' : ''} (${lDur.toFixed(2)}s)
                    </span>
                    <div style="position: absolute; right: 6px; top: 0; bottom: 0; width: ${outWidthPct}%; background: linear-gradient(-90deg, rgba(255,255,255,0.45), transparent); pointer-events: none;"></div>
                    <div class="tl-clip-resize-handle" data-layer-idx="${idx}" style="width: 10px; height: 100%; background: #f3e8ff; opacity: 0.9; cursor: ${isLocked ? 'not-allowed' : 'ew-resize'}; border-radius: 2px; margin-right: -3px; z-index: 5;" title="${isLocked ? '🔒 已鎖定禁止拉伸' : '拖動調整圖層時長'}"></div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}

          <!-- 🎬 選中圖層淡入淡出微調列 (當點擊任一 Clip 時動態展示) -->
          ${(selectedClipIndex !== null && layers[selectedClipIndex]) ? (() => {
            const sIdx = selectedClipIndex;
            const sLayer = layers[sIdx];
            return `
              <div id="tl-selected-clip-toolbar" style="display: flex; align-items: center; justify-content: space-between; background: #0f172a; border: 1px solid #fbbf24; border-radius: 4px; padding: 4px 10px; font-size: 0.72rem; color: #fde047; margin: 2px 0;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-weight: bold;">🎬 編輯圖層 (L${sIdx + 1}):</span>
                  <span style="color: #cbd5e1;">${sLayer.name || `圖層 ${sIdx + 1}`}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
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
                  <button class="tl-toolbar-delete-layer-btn" data-layer-idx="${sIdx}" style="background: rgba(239, 68, 68, 0.25); border: 1px solid #ef4444; color: #fca5a5; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 0.68rem; font-weight: bold; display: flex; align-items: center; gap: 3px;" title="刪除此選中圖層">
                    🗑️ 刪除圖層
                  </button>
                  <button id="tl-btn-close-clip-bar" style="background: #334155; border: none; color: #fff; padding: 1px 6px; border-radius: 3px; cursor: pointer; font-size: 0.65rem;">✕ 關閉</button>
                </div>
              </div>
            `;
          })() : ''}

          <!-- ➕ 快捷新增圖層列 -->
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
                <button class="tl-mute-btn" data-track="impact" style="background: ${trackMuteStates.impact ? '#ef4444' : '#334155'}; color: #fff; border: none; padding: 1px 5px; border-radius: 3px; font-size: 0.65rem; cursor: pointer;" title="預覽靜音打擊反饋">M</button>
              </div>
            </div>
            <div id="tl-cue-track-bar" class="tl-track-bar tl-cue-bar" style="flex: 1; height: 26px; background: #1f2937; border-radius: 3px; position: relative; border: 1px dashed #4b5563; cursor: crosshair;" title="雙擊空白處新增 Cue">
              ${cues.map((cue, idx) => {
                const leftPct = Math.min(100, Math.max(0, (cue.time / duration) * 100));
                const isPri = cue.isPrimary || (idx === cues.length - 1);
                const color = isPri ? '#ef4444' : '#f59e0b';
                const isCueSelected = selectedCueIndex === idx;
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
  }

  public static updatePlayhead(container: HTMLElement, progress: number): void {
    const playhead = container.querySelector('#tl-playhead') as HTMLElement;
    const rulerBar = container.querySelector('#tl-ruler-bar') as HTMLElement;
    if (playhead && rulerBar) {
      const headerWidth = 148;
      const barWidth = rulerBar.clientWidth;
      const leftPos = headerWidth + Math.max(0, Math.min(1.0, progress)) * barWidth;
      playhead.style.left = `${leftPos}px`;
    }
  }

  public static updateFrameUI(container: HTMLElement, frame: number, totalFrames: number, time: number, duration: number): void {
    const display = container.querySelector('#tl-time-display');
    if (display) {
      const fStr = frame.toString().padStart(2, '0');
      display.textContent = `Frame: ${fStr} / ${totalFrames} (${time.toFixed(2)}s / ${duration.toFixed(2)}s)`;
    }
  }

  public static updateStateUI(container: HTMLElement, isPaused: boolean): void {
    const btnPlayPause = container.querySelector('#tl-btn-play-pause') as HTMLButtonElement;
    if (btnPlayPause) {
      btnPlayPause.textContent = isPaused ? '▶ 播放' : '⏸ 暫停';
      btnPlayPause.style.color = isPaused ? '#38bdf8' : '#fbbf24';
    }
  }
}
