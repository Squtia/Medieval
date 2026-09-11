import * as THREE from 'three';
import { VFXPreset, VFXImpactConfig, VFXImpactCue, VFXSequence } from '../../models/VFX';
import { VFXPresetRepository } from './VFXPresetRepository';
import { PlaybackClock } from './PlaybackClock';

import { VFXPlayer, ScreenPoint, ActiveEffect } from './VFXPlayer';
import { MeshLayerRenderer } from './renderers/MeshLayerRenderer';
import { ParticleLayerRenderer } from './renderers/ParticleLayerRenderer';
import { ImpactLayerRenderer } from './renderers/ImpactLayerRenderer';
import { TrailLayerRenderer } from './renderers/TrailLayerRenderer';
import { ScreenFxRenderer } from './renderers/ScreenFxRenderer';
import { AudioLayerRenderer } from './renderers/AudioLayerRenderer';
import { VFXTimelineEvaluator } from './VFXTimelineEvaluator';
import { VFXEffectInstance, VFXInstanceRegistry } from './VFXEffectInstance';
import { resolvePresetSpatialMode, resolveVFXWorldStart, VFX_RENDER_ORDER } from './VFXSpatialPolicy';

export type { ScreenPoint };
export type VFXCueScreenPointResolver = (cue: VFXImpactCue, cueIndex: number) => readonly ScreenPoint[];
type VFXCueWorldPointResolver = (cue: VFXImpactCue, cueIndex: number) => readonly THREE.Vector3[];

export class CombatFXEngine extends VFXPlayer {
  private static fxInstance: CombatFXEngine | null = null;

  /**
   * 🌟 依據 §6.1 條款：Combat Runtime 原生支援播放 Canonical VFXSequence
   */
  public playSequence(
    sequence: VFXSequence,
    from: ScreenPoint,
    to: ScreenPoint,
    isPlayerOrOnImpact?: boolean | ((impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void),
    onImpactCallback?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void,
    resolveCueScreenPoints?: VFXCueScreenPointResolver
  ): Promise<void> {
    const resolveCueWorldPoints = resolveCueScreenPoints
      ? (cue: VFXImpactCue, cueIndex: number) => resolveCueScreenPoints(cue, cueIndex).map(point => this.screenToWorld(point))
      : undefined;
    return this.playSequenceWorld(
      sequence,
      this.screenToWorld(from),
      this.screenToWorld(to),
      isPlayerOrOnImpact,
      onImpactCallback,
      undefined,
      0,
      resolveCueWorldPoints
    );
  }

  /**
   * 🌟 依據 §6.1 條款：原生支援 Sequence 世界座標確定性影格求值
   */
  public renderSequenceWorldAt(
    sequence: VFXSequence,
    timeSeconds: number,
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    customRootGroup?: THREE.Group,
    customTrackGroups?: THREE.Group[]
  ): void {
    const rootGroup = customRootGroup || (() => {
      if (!this.studioPreviewGroup) {
        this.studioPreviewGroup = new THREE.Group();
      }
      return this.studioPreviewGroup;
    })();

    if (!this.scene.children.includes(rootGroup)) {
      this.scene.add(rootGroup);
    }
    rootGroup.visible = true;

    // 貫穿彈道延伸終點 (COLUMN_PIERCE)
    let actualTargetPos = targetPos.clone();
    const impactTrack = sequence.tracks.find(t => t.type === 'IMPACT');
    const impactClip = impactTrack?.clips.find(c => c.payload.type === 'IMPACT');
    const impactData = (impactClip?.payload.data as VFXImpactConfig);
    const penDist = impactData?.penetrationDistance;
    const mainTrack = sequence.tracks.find(t => t.id === 'trk_main' || t.type === 'MESH' || t.type === 'SLASH') || sequence.tracks[0];
    const mainClip = mainTrack?.clips[0];
    const mainPayload = mainClip?.payload.data as any;
    if (mainPayload?.trajectory === 'COLUMN_PIERCE' && penDist) {
      const dir = new THREE.Vector3().subVectors(actualTargetPos, casterPos).normalize();
      actualTargetPos.addScaledVector(dir, penDist);
    }

    // 整理所有可渲染幾何軌道（排除 PARTICLE, IMPACT 與 AUDIO 軌道）
    const renderableTracks = sequence.tracks.filter(t => !t.isMuted && t.type !== 'IMPACT' && t.type !== 'AUDIO' && t.type !== 'PARTICLE');
    const trackGroups = customTrackGroups || (this.studioTrackGroups = this.studioTrackGroups || []);

    while (trackGroups.length < renderableTracks.length) {
      const g = new THREE.Group();
      trackGroups.push(g);
      rootGroup.add(g);
    }
    for (let i = renderableTracks.length; i < trackGroups.length; i++) {
      trackGroups[i].visible = false;
    }

    // 逐軌進行確定性影格求值與 3D 幾何繪製
    for (let i = 0; i < renderableTracks.length; i++) {
      const track = renderableTracks[i];
      const trackGroup = trackGroups[i];
      const clip = track.clips[0];
      const clipData = (clip?.payload.data || {}) as any;
      const trackStart = clip?.startTime || 0;
      const trackDur = clip?.duration || sequence.duration || 0.4;
      const trackEnd = trackStart + trackDur;

      if (timeSeconds < trackStart || timeSeconds > trackEnd) {
        trackGroup.visible = false;
        continue;
      }
      trackGroup.visible = true;

      const p = Math.max(0, Math.min(1.0, (timeSeconds - trackStart) / Math.max(0.001, trackDur)));
      const fadeIn = clip?.fadeIn ?? 0.05;
      const fadeOut = clip?.fadeOut ?? 0.08;
      let fadeAlpha = 1.0;
      const elapsed = timeSeconds - trackStart;
      const remaining = trackEnd - timeSeconds;
      if (fadeIn > 0 && elapsed < fadeIn) {
        fadeAlpha = Math.min(fadeAlpha, Math.max(0.1, elapsed / fadeIn));
      }
      if (fadeOut > 0 && remaining < fadeOut) {
        fadeAlpha = Math.min(fadeAlpha, Math.max(0.1, remaining / fadeOut));
      }

      // 次生引用圖層 COMPOSITE_LAYER
      let resolvedData = { ...clipData };
      const subPresetId = clipData.presetId;
      if (clip?.payload.type === 'COMPOSITE_LAYER' && subPresetId) {
        const subSeq = VFXPresetRepository.getInstance().getSequence(subPresetId);
        if (subSeq) {
          const subMainTrack = subSeq.tracks.find(t => t.id === 'trk_main' || t.type === 'MESH' || t.type === 'SLASH') || subSeq.tracks[0];
          const subMainClip = subMainTrack?.clips[0];
          if (subMainClip?.payload.data) {
            resolvedData = {
              ...(subMainClip.payload.data as any),
              ...clipData,
              scale: (clipData.scale || 1.0) * ((subMainClip.payload.data as any).scale || 1.0)
            };
          }
        }
      }

      const spatialMode = resolvedData.spatialMode || (resolvedData.trajectory === 'MELEE_SWEEP' ? 'MELEE_SWEEP' : 'A_TO_B');
      const reverse = !!resolvedData.reverse;

      const curPos = this.calculate3DTrackPos(spatialMode, reverse, p, casterPos, actualTargetPos);
      const startPos = this.calculate3DTrackPos(spatialMode, reverse, 0.0, casterPos, actualTargetPos);
      const endPos = this.calculate3DTrackPos(spatialMode, reverse, 1.0, casterPos, actualTargetPos);

      // 🌟 附著型粒子拖尾處理 (Attachment Trail to curPos or Blade Tip)
      if (i === 0) {
        const particleTrack = sequence.tracks.find(t => !t.isMuted && t.type === 'PARTICLE');
        const pClip = particleTrack?.clips[0];
        const pData = (pClip?.payload.data || {}) as any;
        const isSlash = track.type === 'SLASH' || resolvedData.trajectory === 'MELEE_SWEEP';
        const trailCount = resolvedData.trailCount || pData.trailCount || 35;
        const isTrailEnabled = resolvedData.enableTrail === true || pData.enableTrail === true ||
          (resolvedData.enableTrail !== false && pData.enableTrail !== false && trailCount > 0);

        // 只有啟用拖尾且在出刀區間內才生成與更新拖尾粒子
        // 出刀結束 (timeSeconds >= trackEnd 或 p >= 0.999) 必須立即回收，絕不殘留在最後一個 frame
        if (isTrailEnabled && trailCount > 0 && timeSeconds >= trackStart && timeSeconds < trackEnd && p < 0.999) {
          const slashPreset = (track as any).preset || resolvedData;
          let emissionPos = curPos;
          if (isSlash) {
            emissionPos = MeshLayerRenderer.calculateSlashBladeTip(slashPreset, p, actualTargetPos, reverse);
          }

          let trailCache = (rootGroup as any).__trailCache;
          if (!trailCache) {
            const trailColorHex = resolvedData.trailColor || pData.trailColor || resolvedData.colorRim || pData.colorRim || '#f59e0b';
            trailCache = TrailLayerRenderer.createTrail(
              rootGroup as any,
              emissionPos,
              trailColorHex,
              trailCount,
              resolvedData.trailSize || pData.trailSize || 8,
              resolvedData.scale || pData.scale || 1.0,
              () => this.getRandom()
            );
            (rootGroup as any).__trailCache = trailCache;
          }

          if (isSlash && typeof trailCache.updateArcTrail === 'function') {
            trailCache.updateArcTrail(
              (prog: number) => MeshLayerRenderer.calculateSlashBladeTip(slashPreset, prog, actualTargetPos, reverse),
              p
            );
          } else {
            trailCache.update(emissionPos);
          }
        } else if ((rootGroup as any).__trailCache) {
          (rootGroup as any).__trailCache.dispose();
          (rootGroup as any).__trailCache = null;
        }
      }

      const inferredShader = resolvedData.shaderMode || (track.type === 'SLASH' || resolvedData.trajectory === 'MELEE_SWEEP' ? 'SLASH_BLADE' : undefined);

      const renderTrackObj = {
        id: track.id,
        name: track.name,
        delay: trackStart,
        duration: trackDur,
        fadeIn,
        fadeOut,
        scale: resolvedData.scale || 1.0,
        shaderMode: inferredShader,
        spatialMode,
        reverse,
        colorCore: resolvedData.colorCore || '#ffffff',
        colorRim: resolvedData.colorRim || '#38bdf8',
        preset: resolvedData,
        enabled: true
      };

      if (inferredShader) {
        this.renderTrack3DGeometry(trackGroup, renderTrackObj, p, fadeAlpha, curPos, startPos, endPos, casterPos, actualTargetPos);
      } else {
        trackGroup.visible = false;
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
  private scheduledTimers = new Set<ReturnType<typeof setTimeout>>();
  private instanceRegistry: VFXInstanceRegistry = new VFXInstanceRegistry();

  // ⏱️ 特效工坊專用：常駐確定性影格求值群組（永不播完自毀）
  private studioPreviewGroup: THREE.Group | null = null;
  private studioTrackGroups: THREE.Group[] = [];
  private studioPreviewSlashGeo: THREE.BufferGeometry | null = null;
  private studioPreviewSlashMat: THREE.ShaderMaterial | null = null;
  private studioPreviewCrossGeo: THREE.BufferGeometry | null = null;
  private studioPreviewMesh: THREE.Mesh | null = null;
  private studioPreviewCrossMesh: THREE.Mesh | null = null;
  private studioPreviewProjMesh: THREE.Mesh | null = null;

  private constructor() {
    super();
  }

  public static override getInstance(): CombatFXEngine {
    if (!this.fxInstance) {
      this.fxInstance = new CombatFXEngine();
    }
    return this.fxInstance;
  }

  /**
   * 🎬 確定性影格求值核心 (Deterministic Timeline Frame Evaluator at time t)
   * 遵循 AGENTS.md 第 7 條規範：
   * 1. 畫面姿態 100% 嚴格依據時間 t 求值，不依賴遞增 delta。
   * 2. 暫停定格時物件常駐於場景中，絕不播完自毀。
   * 3. 拖動時間軸倒帶/推進時即時重算頂點幾何，畫面永不消失。
   */
  public renderFrameAt(
    preset: VFXPreset,
    timeSeconds: number,
    from?: ScreenPoint,
    to?: ScreenPoint
  ): void {
    const targetPos = to ? this.screenToWorld(to) : new THREE.Vector3(120, 0, 0);
    const casterPos = from ? this.screenToWorld(from) : new THREE.Vector3(-120, 0, 0);
    this.renderFrameWorldAt(preset, timeSeconds, casterPos, targetPos);
  }

  public getInstanceRegistry(): VFXInstanceRegistry {
    return this.instanceRegistry;
  }

  /**
   * 🧹 安全釋放單一 TrackGroup 及其內部快取幾何與材質
   */
  public static disposeTrackGroup(trackGroup: THREE.Group): void {
    const cache = (trackGroup as any).__cache;
    if (cache) {
      if (cache.slashGeo) cache.slashGeo.dispose();
      if (cache.crossGeo) cache.crossGeo.dispose();
      if (cache.slashMat) cache.slashMat.dispose();
      if (cache.mat) cache.mat.dispose();
      if (cache.geo) cache.geo.dispose();
      (trackGroup as any).__cache = null;
    }
    while (trackGroup.children.length > 0) {
      const child = trackGroup.children[0];
      trackGroup.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
      if ((child as any).material) {
        if (Array.isArray((child as any).material)) {
          (child as any).material.forEach((m: any) => m.dispose());
        } else {
          (child as any).material.dispose();
        }
      }
    }
  }

  /**
   * 🌍 確定性影格求值核心 (世界座標版本)
   * 支援獨立 Instance 專屬 RootGroup 與 TrackGroups，徹底防止並發播放相互覆蓋
   */
  public renderFrameWorldAt(
    preset: VFXPreset | any,
    timeSeconds: number,
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    customRootGroup?: THREE.Group,
    customTrackGroups?: THREE.Group[]
  ): void {
    if (preset && Array.isArray((preset as any).tracks)) {
      this.renderSequenceWorldAt(preset as VFXSequence, timeSeconds, casterPos, targetPos, customRootGroup, customTrackGroups);
      return;
    }

    const rootGroup = customRootGroup || (() => {
      if (!this.studioPreviewGroup) {
        this.studioPreviewGroup = new THREE.Group();
      }
      return this.studioPreviewGroup;
    })();

    if (!this.scene.children.includes(rootGroup)) {
      this.scene.add(rootGroup);
    }
    rootGroup.visible = true;

    // 貫穿彈道延伸終點 (COLUMN_PIERCE)
    let actualTargetPos = targetPos.clone();
    const penDist = preset.impact?.penetrationDistance || (preset as any).penetrationDistance;
    if (preset.trajectory === 'COLUMN_PIERCE' && penDist) {
      const dir = new THREE.Vector3().subVectors(actualTargetPos, casterPos).normalize();
      actualTargetPos.addScaledVector(dir, penDist);
    }

    // 🌟 1. 整理所有軌道（主軌 Layer 0 ＋ 次生圖層 Layer 1..N）
    const mainDelay = Math.max(0, preset.mainDelay || 0);
    const totalDur = Math.max(0.05, preset.duration || 0.4);
    const mainDuration = Math.max(0.05, preset.mainDuration !== undefined ? preset.mainDuration : (totalDur - mainDelay));

    const mainTrack = {
      id: 'main',
      name: preset.name || '主軌',
      delay: mainDelay,
      duration: mainDuration,
      fadeIn: 0.05,
      fadeOut: 0.08,
      scale: preset.scale || 1.0,
      shaderMode: preset.shaderMode || (preset.trajectory === 'MELEE_SWEEP' ? 'SLASH_BLADE' : undefined),
      spatialMode: (preset.spatialMode === 'TRAJECTORY' ? (preset.trajectoryPath || preset.trajectory || 'A_TO_B') : (preset.spatialMode || preset.trajectoryPath || preset.trajectory || 'A_TO_B')),
      reverse: !!preset.reverse,
      colorCore: preset.colorCore || '#ffffff',
      colorRim: preset.colorRim || '#38bdf8',
      preset: preset,
      enabled: !(preset as any)._mainTrackMuted
    };

    const secondaryTracks = (preset.layers || []).map((l: any, idx: number) => {
      let refPreset: VFXPreset | null = null;
      if (l.presetId) {
        refPreset = VFXPresetRepository.getInstance().getPreset(l.presetId) || null;
      }
      return {
        id: l.id || `layer_${idx}`,
        name: l.name || `圖層 ${idx + 1}`,
        delay: Math.max(0, l.delay || 0),
        duration: Math.max(0.05, l.duration || 0.3),
        fadeIn: l.fadeIn ?? 0.05,
        fadeOut: l.fadeOut ?? 0.08,
        scale: (l.scale || 1.0) * (refPreset?.scale || 1.0),
        shaderMode: l.shaderMode || refPreset?.shaderMode || undefined,
        spatialMode: (l.spatialMode === 'TRAJECTORY' ? (l.trajectoryPath || refPreset?.trajectoryPath || refPreset?.trajectory || 'A_TO_B') : (l.spatialMode || refPreset?.spatialMode || 'A_TO_B')),
        reverse: l.reverse !== undefined ? l.reverse : (refPreset?.reverse || false),
        colorCore: refPreset?.colorCore || preset.colorCore || '#ffffff',
        colorRim: refPreset?.colorRim || preset.colorRim || '#f59e0b',
        preset: refPreset || preset,
        enabled: l.enabled !== false
      };
    });

    const allTracks = [mainTrack, ...secondaryTracks];

    // 確保每條軌道具備專屬的 Group
    const trackGroups = customTrackGroups || (this.studioTrackGroups = this.studioTrackGroups || []);

    while (trackGroups.length < allTracks.length) {
      const g = new THREE.Group();
      trackGroups.push(g);
      rootGroup.add(g);
    }

    // 隱藏多餘的群組
    for (let i = allTracks.length; i < trackGroups.length; i++) {
      trackGroups[i].visible = false;
    }

    // 🌟 2. 逐軌進行確定性影格求值與 3D 幾何繪製
    for (let i = 0; i < allTracks.length; i++) {
      const track = allTracks[i];
      const trackGroup = trackGroups[i];

      // 檢查是否在該圖層的有效時間區間內
      const trackStart = track.delay;
      const trackEnd = track.delay + track.duration;

      if (!track.enabled || timeSeconds < trackStart || timeSeconds > trackEnd) {
        trackGroup.visible = false;
        continue;
      }

      trackGroup.visible = true;

      // 計算局部時間進度 (0 ~ 1)
      const p = Math.max(0, Math.min(1.0, (timeSeconds - trackStart) / track.duration));

      // 計算淡入淡出透明度 (Fade In / Fade Out)
      let fadeAlpha = 1.0;
      const elapsed = timeSeconds - trackStart;
      const remaining = trackEnd - timeSeconds;
      if (track.fadeIn > 0 && elapsed < track.fadeIn) {
        fadeAlpha = Math.min(fadeAlpha, Math.max(0.1, elapsed / track.fadeIn));
      }
      if (track.fadeOut > 0 && remaining < track.fadeOut) {
        fadeAlpha = Math.min(fadeAlpha, Math.max(0.1, remaining / track.fadeOut));
      }

      // 計算 3D 空間錨點位置
      const curPos = this.calculate3DTrackPos(track.spatialMode, track.reverse, p, casterPos, actualTargetPos);
      const startPos = this.calculate3DTrackPos(track.spatialMode, track.reverse, 0.0, casterPos, actualTargetPos);
      const endPos = this.calculate3DTrackPos(track.spatialMode, track.reverse, 1.0, casterPos, actualTargetPos);

      // 渲染對應形態之真實 3D 幾何與 Shader
      this.renderTrack3DGeometry(trackGroup, track, p, fadeAlpha, curPos, startPos, endPos, casterPos, actualTargetPos);
    }

    // 立即刷新畫面
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 📐 依據時空路徑計算 3D 世界座標
   */
  private calculate3DTrackPos(
    mode: string,
    reverse: boolean,
    progress: number,
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3
  ): THREE.Vector3 {
    if (mode === 'AT_CASTER') {
      return casterPos.clone();
    }
    if (mode === 'AT_TARGET' || mode === 'MELEE_SWEEP') {
      return targetPos.clone();
    }
    if (mode === 'VERTICAL_DROP' || mode === 'VERTICAL_SKY_TO_B') {
      const sky = new THREE.Vector3(targetPos.x, targetPos.y + 380, targetPos.z);
      return reverse ? new THREE.Vector3().lerpVectors(targetPos, sky, progress) : new THREE.Vector3().lerpVectors(sky, targetPos, progress);
    }
    if (mode === 'DIAGONAL_DROP' || mode === 'DIAGONAL_SKY_TO_B') {
      const offsetX = Math.max(260, Math.abs(targetPos.x - casterPos.x) * 0.7);
      const sky = new THREE.Vector3(targetPos.x - offsetX, targetPos.y + 380, targetPos.z);
      return reverse ? new THREE.Vector3().lerpVectors(targetPos, sky, progress) : new THREE.Vector3().lerpVectors(sky, targetPos, progress);
    }
    if (mode === 'GROUND_BURST') {
      const ground = new THREE.Vector3(targetPos.x, targetPos.y - 120, targetPos.z);
      return reverse ? new THREE.Vector3().lerpVectors(targetPos, ground, progress) : new THREE.Vector3().lerpVectors(ground, targetPos, progress);
    }
    if (mode === 'A_TO_VERTICAL_SKY') {
      const sky = new THREE.Vector3(casterPos.x, casterPos.y + 380, casterPos.z);
      return reverse ? new THREE.Vector3().lerpVectors(sky, casterPos, progress) : new THREE.Vector3().lerpVectors(casterPos, sky, progress);
    }
    if (mode === 'A_TO_DIAGONAL_SKY') {
      const sky = new THREE.Vector3(casterPos.x + 260, casterPos.y + 380, casterPos.z);
      return reverse ? new THREE.Vector3().lerpVectors(sky, casterPos, progress) : new THREE.Vector3().lerpVectors(casterPos, sky, progress);
    }

    // A_TO_B 與預設彈道
    const from = reverse ? targetPos : casterPos;
    const to = reverse ? casterPos : targetPos;
    const pt = new THREE.Vector3().lerpVectors(from, to, progress);
    return pt;
  }

  /**
   * 🎨 依據 Shader/形態繪製真實 3D 幾何體（拒絕單顆球敷衍，嚴格遵守 TIMELINE 規格）
   */
  private renderTrack3DGeometry(
    trackGroup: THREE.Group,
    track: any,
    p: number,
    fadeAlpha: number,
    curPos: THREE.Vector3,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3
  ): void {
    const sc = track.scale || 1.0;
    const shader = track.shaderMode || track.preset?.shaderMode;
    if (!shader) {
      trackGroup.visible = false;
      return;
    }
    const isSlash = shader === 'SLASH_BLADE' || track.spatialMode === 'MELEE_SWEEP';
    const trajectoryMode = track.spatialMode || track.preset?.trajectoryPath || track.preset?.trajectory;
    trackGroup.renderOrder =
      shader === 'EARTH_SHATTER' || shader === 'GROUND_FISSURE' || trajectoryMode === 'GROUND_BURST'
        ? VFX_RENDER_ORDER.GROUND
        : trajectoryMode === 'AT_TARGET'
          ? VFX_RENDER_ORDER.IMPACT
          : VFX_RENDER_ORDER.MAIN;

    // 檢查既有快取
    let cache = (trackGroup as any).__cache;
    if (!cache) {
      cache = {};
      (trackGroup as any).__cache = cache;
    }

    // 若 shader 類型變更，清空舊網格
    if (cache.currentShader !== shader) {
      while (trackGroup.children.length > 0) {
        trackGroup.remove(trackGroup.children[0]);
      }
      cache = { currentShader: shader };
      (trackGroup as any).__cache = cache;
    }

    // ─────────────────────────────────────────────────────────────
    // ⚔️ 1. 近戰刀芒與劍氣斬裂 (SLASH_BLADE)
    // ─────────────────────────────────────────────────────────────
    if (isSlash) {
      trackGroup.position.copy(targetPos);

      const slashPreset = track.preset || track;
      const params = MeshLayerRenderer.calculateSlashGeometryParams(
        { ...slashPreset, scale: sc, colorCore: track.colorCore, colorRim: track.colorRim },
        p,
        track.reverse
      );

      if (cache.slashGeo) cache.slashGeo.dispose();
      cache.slashGeo = MeshLayerRenderer.buildDynamicSlashGeo(
        params.bladeRadius,
        params.bladeWidth,
        params.headAngle,
        params.tailAngle,
        params.centerAngle,
        params.aspect
      );

      if (!cache.slashMat) {
        cache.slashMat = MeshLayerRenderer.createSlashShaderMaterial(params.colorCore, params.colorRim);
      } else {
        cache.slashMat.uniforms.colorCore.value.set(params.colorCore);
        cache.slashMat.uniforms.colorRim.value.set(params.colorRim);
      }
      cache.slashMat.uniforms.uOpacity.value = Math.max(0.2, fadeAlpha);

      if (!cache.slashMesh) {
        cache.slashMesh = new THREE.Mesh(cache.slashGeo, cache.slashMat);
        trackGroup.add(cache.slashMesh);
      } else {
        cache.slashMesh.geometry = cache.slashGeo;
        cache.slashMesh.visible = true;
      }
      // ⚔️ 套用 3D 歐拉角旋轉 (X 俯仰 / Y 偏航，Z 軸已融入 head/tail angle 動態弧面)
      cache.slashMesh.rotation.set(params.rotX || 0, params.rotY || 0, 0);

      // 十字十字斬支援
      if (params.isCross) {
        if (cache.crossGeo) cache.crossGeo.dispose();
        cache.crossGeo = MeshLayerRenderer.buildDynamicSlashGeo(
          params.bladeRadius,
          params.bladeWidth,
          -params.headAngle,
          -params.tailAngle,
          -params.centerAngle,
          params.aspect
        );
        if (!cache.crossMesh) {
          cache.crossMesh = new THREE.Mesh(cache.crossGeo, cache.slashMat);
          trackGroup.add(cache.crossMesh);
        } else {
          cache.crossMesh.geometry = cache.crossGeo;
          cache.crossMesh.visible = true;
        }
        cache.crossMesh.rotation.set(params.rotX || 0, params.rotY || 0, 0);
      } else if (cache.crossMesh) {
        cache.crossMesh.visible = false;
      }

      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🏹 2. 🚀 通用多發彈幕發射器管線 (Universal Salvo Pipeline)
    // 凡是 salvoCount > 1 或 ARC_MULTI，且屬於投射物 Shader (FRESNEL_ICE, VOLUMETRIC_FIRE, ARC_MULTI, ENERGY_BEAM 等)
    // 均統一生成 N 發子彈實體，套用 3D 散射偏角 (salvoSpreadAngle)、受擊散佈 (salvoSpreadRadius) 與拋物弧高 (arcHeight)
    // 注意：非投射物形態（閃電、近戰、地刺、護盾、戰吼、天柱、地裂、自身環）絕不誤入彈幕管線
    // ─────────────────────────────────────────────────────────────
    const isSpecialNonProjectile =
      isSlash ||
      shader === 'DIELECTRIC_LIGHTNING' ||
      shader === 'EARTH_SHATTER' ||
      shader === 'SHIELD_BARRIER' ||
      shader === 'SHOUT_WAVE' ||
      shader === 'HOLY_LIGHT' ||
      shader === 'GROUND_FISSURE' ||
      track.preset?.trajectory === 'PARABOLA_ARC' ||
      track.preset?.id === 'VFX_ARROW_VOLLEY' ||
      track.preset?.id === 'VFX_WATCHTOWER_VOLLEY' ||
      track.preset?.trajectory === 'SHIELD_BARRIER' ||
      track.preset?.trajectory === 'SHOUT_WAVE' ||
      track.preset?.trajectory === 'GROUND_FISSURE' ||
      track.spatialMode === 'AT_CASTER' ||
      track.preset?.trajectory === 'BODY_AURA';

    const isSalvo = !isSpecialNonProjectile && (
      (track.preset?.salvoCount && track.preset.salvoCount > 1) ||
      track.preset?.trajectory === 'ARC_MULTI' ||
      track.spatialMode === 'ARC_MULTI'
    );
    if (isSalvo) {
      if (cache.volumetricGroup) cache.volumetricGroup.visible = false;
      if (cache.projectileGroup) cache.projectileGroup.visible = false;
      if (cache.frostGroup) cache.frostGroup.visible = false;
      if (cache.beamMesh) cache.beamMesh.visible = false;
      if (cache.slashMesh) cache.slashMesh.visible = false;
      if (cache.crossMesh) cache.crossMesh.visible = false;
      if (cache.lightningGroup) cache.lightningGroup.visible = false;
      if (cache.earthShatterGroup) cache.earthShatterGroup.visible = false;
      if (cache.shieldGroup) cache.shieldGroup.visible = false;
      if (cache.shoutGroup) cache.shoutGroup.visible = false;
      if (cache.holyPillarMesh) cache.holyPillarMesh.visible = false;
      if (cache.auraRing) cache.auraRing.visible = false;

      MeshLayerRenderer.updateArcMulti(
        trackGroup,
        startPos,
        endPos,
        p,
        sc,
        track.colorRim || '#38bdf8',
        cache,
        track.preset?.salvoCount || 3,
        (col, sz, op) => this.createGlowSprite(col, sz, op),
        track.preset?.salvoSpreadAngle || 0,
        track.preset?.salvoSpreadRadius || 0,
        track.preset?.arcHeight || 0,
        shader,
        track.colorCore || '#ffffff'
      );
      return;
    } else if (cache.multiArcGroup) {
      cache.multiArcGroup.visible = false;
    }

    // ─────────────────────────────────────────────────────────────
    // ⚡ 3. 閃電穿透 (DIELECTRIC_LIGHTNING - 落雷與雷霆穿透)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'DIELECTRIC_LIGHTNING') {
      // ⚡ 終點 100% 強制鎖定在受擊目標 (End / targetPos) 身上，絕不偏離
      const lightningEnd = targetPos.clone();

      // ⚡ 判定是否為橫向 A>B 穿透模式，否則皆為垂直天頂天降狂雷
      const lightningMode = track.spatialMode
        || track.trajectory
        || track.preset?.spatialMode
        || track.preset?.trajectoryPath
        || track.preset?.trajectory;
      const lightningStart = resolveVFXWorldStart(lightningMode, casterPos, targetPos);

      MeshLayerRenderer.updateLightningTube(
        trackGroup,
        lightningStart,
        lightningEnd,
        p,
        sc,
        track.colorRim,
        track.colorCore,
        fadeAlpha,
        cache
      );
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🪨 4. 破土錐狀地刺陣列 (EARTH_SHATTER)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'EARTH_SHATTER') {
      MeshLayerRenderer.updateEarthShatter(
        trackGroup,
        targetPos,
        p,
        sc,
        track.colorRim,
        fadeAlpha,
        cache
      );
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // ❄️ 5. 冰晶之矛與旋轉冰環 (FRESNEL_ICE / FROST_LANCE / FROST_NOVA - 單發模式)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'FRESNEL_ICE' || shader === 'FROST_LANCE' || shader === 'FROST_NOVA') {
      if (cache.multiArcGroup) cache.multiArcGroup.visible = false;
      MeshLayerRenderer.updateFresnelIce(
        trackGroup,
        curPos,
        endPos,
        p,
        sc,
        track.colorCore,
        track.colorRim,
        cache
      );
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🔮 6. 能量貫穿光束 (ENERGY_BEAM - 單發模式)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'ENERGY_BEAM' && track.preset?.trajectory !== 'ARC_MULTI' && track.spatialMode !== 'ARC_MULTI') {
      if (cache.multiArcGroup) cache.multiArcGroup.visible = false;
      MeshLayerRenderer.updateEnergyBeam(
        trackGroup,
        startPos,
        endPos,
        p,
        sc,
        track.colorCore,
        track.colorRim,
        fadeAlpha,
        cache
      );
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🔥 6. 體積黑體動態火焰彈道 (VOLUMETRIC_FIRE / DARK_VOID - 毀滅隕石、熾熱天火)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'VOLUMETRIC_FIRE' || shader === 'DARK_VOID') {
      if (cache.multiArcGroup) cache.multiArcGroup.visible = false;
      trackGroup.position.copy(curPos);

      if (!cache.volumetricGroup) {
        cache.volumetricGroup = new THREE.Group();
        const sphereGeo = new THREE.SphereGeometry(16 * sc, 32, 32);
        const flameMat = MeshLayerRenderer.createVolumetricFlameMaterial(
          track.colorCore || '#fef08a',
          track.colorRim || '#ef4444',
          track.preset?.flameTurbulence ?? 5.0,
          track.preset?.flameTurbulenceSpeed ?? 2.0
        );
        const sphere = new THREE.Mesh(sphereGeo, flameMat);
        const glow = this.createGlowSprite(
          track.colorRim || '#ef4444',
          (track.preset?.glowRadius || 75) * sc,
          track.preset?.glowOpacity ?? 0.8
        );
        cache.volumetricGroup.add(sphere);
        cache.volumetricGroup.add(glow);
        cache.flameMat = flameMat;
        trackGroup.add(cache.volumetricGroup);
      }
      cache.volumetricGroup.visible = true;
      if (cache.flameMat?.uniforms?.uTime) {
        cache.flameMat.uniforms.uTime.value = p * 5.0;
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🛡️ 7. 神聖壁壘護盾 (SHIELD_BARRIER)
    // ─────────────────────────────────────────────────────────────
    if (track.preset?.trajectory === 'SHIELD_BARRIER' || track.spatialMode === 'SHIELD_BARRIER' || track.preset?.id === 'VFX_HOLY_SHIELD') {
      trackGroup.position.copy(targetPos);
      if (!cache.shieldGroup) {
        const shieldShape = track.preset?.shieldShape || 'HEX';
        cache.shieldGroup = MeshLayerRenderer.buildHolyShieldGroup(sc, track.colorCore || '#fde047', track.colorRim || '#eab308', shieldShape as any);
        trackGroup.add(cache.shieldGroup);
      }
      cache.shieldGroup.visible = true;
      MeshLayerRenderer.updateHolyShield(cache.shieldGroup, p);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 📢 8. 戰吼威懾音波 (SHOUT_WAVE)
    // ─────────────────────────────────────────────────────────────
    if (track.preset?.trajectory === 'SHOUT_WAVE' || track.spatialMode === 'SHOUT_WAVE' || track.preset?.id === 'VFX_TAUNT_SHOUT') {
      trackGroup.position.copy(casterPos);
      if (!cache.shoutGroup) {
        const waveCount = Math.max(1, Math.min(8, track.preset?.waveCount || 3));
        cache.shoutGroup = MeshLayerRenderer.buildTauntShoutGroup(waveCount, track.colorRim || '#ef4444');
        trackGroup.add(cache.shoutGroup);
      }
      cache.shoutGroup.visible = true;
      MeshLayerRenderer.updateTauntShout(cache.shoutGroup, p, casterPos, targetPos, sc);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // ☀️ 9. 神聖天降光柱 (HOLY_LIGHT)
    // ─────────────────────────────────────────────────────────────
    if (track.shaderMode === 'HOLY_LIGHT' || (track.preset?.trajectory === 'VERTICAL_DROP' && track.preset?.shaderMode === 'HOLY_LIGHT')) {
      trackGroup.position.copy(targetPos);
      if (!cache.holyPillarMesh) {
        cache.holyPillarMesh = MeshLayerRenderer.buildHolyPillarMesh(sc, track.colorCore || '#fde047');
        trackGroup.add(cache.holyPillarMesh);
      }
      cache.holyPillarMesh.visible = true;
      MeshLayerRenderer.updateHolyPillar(cache.holyPillarMesh, p);
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🏹 10. 拋物線齊射箭雨 (PARABOLA_ARC)
    // ─────────────────────────────────────────────────────────────
    if (track.preset?.trajectory === 'PARABOLA_ARC' || track.preset?.id === 'VFX_ARROW_VOLLEY' || track.preset?.id === 'VFX_WATCHTOWER_VOLLEY') {
      MeshLayerRenderer.updateParabolaArrows(
        trackGroup,
        casterPos,
        targetPos,
        p,
        track.duration || 0.4,
        sc,
        track.colorRim || '#38bdf8',
        cache
      );
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🌋 11. 大地裂地波推進 (GROUND_FISSURE)
    // ─────────────────────────────────────────────────────────────
    if (track.preset?.trajectory === 'GROUND_FISSURE' || track.spatialMode === 'GROUND_FISSURE') {
      MeshLayerRenderer.updateGroundFissure(
        trackGroup,
        casterPos,
        targetPos,
        p,
        sc,
        track.colorRim || '#94a3b8',
        cache,
        track.preset
      );
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🌟 12. 依時空發生形態精準繪製姿態 (自身光環 / 目標爆散 / 飛行彈道)
    // ─────────────────────────────────────────────────────────────
    const isAtCaster = track.spatialMode === 'AT_CASTER' || track.preset?.trajectory === 'BODY_AURA';
    const isAtTarget = track.spatialMode === 'AT_TARGET';

    if (isAtCaster) {
      // 🏠 A 點自身：繪製擴散光環
      trackGroup.position.copy(casterPos);
      if (!cache.auraRing) {
        const ringGeo = new THREE.RingGeometry(18 * sc, 24 * sc, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(track.colorRim),
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending
        });
        cache.auraRing = new THREE.Mesh(ringGeo, ringMat);
        trackGroup.add(cache.auraRing);
      }
      cache.auraRing.visible = true;
      const ringScale = 0.5 + p * 1.0;
      cache.auraRing.scale.set(ringScale, ringScale, ringScale);
      (cache.auraRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, fadeAlpha * (1.0 - p * 0.5));
      return;
    }

    if (isAtTarget) {
      // 💥 B 點目標：繪製受擊震波爆散光環
      trackGroup.position.copy(targetPos);
      if (!cache.impactRing) {
        const ringGeo = new THREE.RingGeometry(15 * sc, 22 * sc, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(track.colorRim),
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending
        });
        cache.impactRing = new THREE.Mesh(ringGeo, ringMat);
        trackGroup.add(cache.impactRing);
      }
      cache.impactRing.visible = true;
      const ringScale = 0.6 + p * 1.2;
      cache.impactRing.scale.set(ringScale, ringScale, ringScale);
      (cache.impactRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0.1, fadeAlpha * (1.0 - p * 0.6));
      return;
    }

    // 💥 13. 命中伴生次生尖刺陣列 (Secondary Spikes Burst)
    if (track.preset?.spikes && track.preset.spikes > 0) {
      const hitProgress = track.preset.impactCues?.[0]?.time ? (track.preset.impactCues[0].time / (track.duration || 0.4)) : 0.38;
      if (p >= hitProgress) {
        if (!cache.secondarySpikesGroup) {
          cache.secondarySpikesGroup = new THREE.Group();
          const spikeCount = track.preset.spikes;
          const spikeH = track.preset.spikeHeight || 55;
          const spikeW = (track.preset.spikeWidth || 7) * sc;
          const spreadR = track.preset.spikeRadius !== undefined ? track.preset.spikeRadius : 80;
          const shape = track.preset.spikeShape || 'CONE_SPIKE';
          const spikeGeo = MeshLayerRenderer.createSpikeGeometry(shape as any, spikeW, spikeH);
          const spikeMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(track.colorRim || '#38bdf8'),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
          });

          for (let s = 0; s < spikeCount; s++) {
            const mesh = new THREE.Mesh(spikeGeo, spikeMat);
            const angle = (s / spikeCount) * Math.PI * 2;
            const dist = (spreadR * 0.45) * 0.8;
            mesh.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist, 0);
            mesh.rotation.z = angle - Math.PI / 2;
            cache.secondarySpikesGroup.add(mesh);
          }
          cache.secondarySpikesGroup.position.copy(targetPos);
          trackGroup.add(cache.secondarySpikesGroup);
        }
        cache.secondarySpikesGroup.visible = true;
        const spikeLifeP = Math.min(1.0, (p - hitProgress) / (1.0 - hitProgress || 0.1));
        const fade = Math.max(0, 1.0 - spikeLifeP);
        cache.secondarySpikesGroup.children.forEach((c: any) => {
          if (c.material) c.material.opacity = fade * 0.9;
        });
      } else if (cache.secondarySpikesGroup) {
        cache.secondarySpikesGroup.visible = false;
      }
    }


    // 🚀 位移彈道 (TRAJECTORY)：沿軌跡運動之柔和發光彈道
    trackGroup.position.copy(curPos);
    trackGroup.lookAt(endPos);

    if (!cache.projectileGroup) {
      cache.projectileGroup = new THREE.Group();
      const glow = this.createGlowSprite(track.colorRim, 45 * sc, 0.85);
      cache.projectileGroup.add(glow);
      trackGroup.add(cache.projectileGroup);
    }
    cache.projectileGroup.visible = true;
  }

  public clearStudioPreview(): void {
    if (this.studioPreviewGroup) {
      this.scene.remove(this.studioPreviewGroup);
      if (this.studioPreviewSlashGeo) this.studioPreviewSlashGeo.dispose();
      if (this.studioPreviewCrossGeo) this.studioPreviewCrossGeo.dispose();
      if (this.studioPreviewSlashMat) this.studioPreviewSlashMat.dispose();
      this.studioPreviewGroup = null;
      this.studioTrackGroups = [];
    }
  }

  public registerTimer(fn: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const gen = this.playbackGeneration;
    const timer = setTimeout(() => {
      this.scheduledTimers.delete(timer);
      if (this.playbackGeneration === gen && this.isRunning) {
        fn();
      }
    }, delayMs);
    this.scheduledTimers.add(timer);
    return timer;
  }

  /**
   * 🧹 清空當前畫布上所有特效物件、定時器與動畫循環（委派 VFXPlayer 基礎類別）
   */
  public override clear(): void {
    this.scheduledTimers.forEach(t => clearTimeout(t));
    this.scheduledTimers.clear();
    this.instanceRegistry.clearAll(this.scene);
    super.clear();
  }

  /**
   * ⏱️ 在邏輯演出時鐘中排程延遲任務（受 speed 縮放且受 pause 阻斷）
   */
  public scheduleLogical(delaySeconds: number, callback: () => void): number {
    const triggerTime = this.playbackClock.getCurrentTime() + Math.max(0, delaySeconds);
    const gen = this.playbackGeneration;
    return this.playbackClock.schedule(triggerTime, () => {
      if (this.playbackGeneration === gen && this.isRunning) {
        callback();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 🌟 VFX 預設庫與打擊感統一驅動中樞 (Preset-Driven Impact Pipeline)
  // ─────────────────────────────────────────────────────────────
  public getPreset(id: string): VFXPreset | undefined {
    return VFXPresetRepository.getInstance().getPreset(id);
  }

  /**
   * 🥊 依照特效預設庫 ID 播放特效，並支援多段命中 onImpact 節奏斷點！
   */
  /**
   * 🥊 依照特效預設庫 ID 播放特效，並支援多段命中 onImpact 節奏斷點！
   */
  public playPreset(
    vfxId: string,
    from: ScreenPoint,
    to: ScreenPoint,
    isPlayerOrOnImpact?: boolean | ((impact: VFXImpactConfig, hitIndex: number, totalHits: number) => void),
    onImpactCallback?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number) => void
  ): Promise<void> {
    const repo = VFXPresetRepository.getInstance();
    const seq = repo.getSequence(vfxId) || repo.getSequence('VFX_DEFAULT_SLASH');
    if (seq) {
      return this.playSequence(seq, from, to, isPlayerOrOnImpact, onImpactCallback);
    }
    return Promise.resolve();
  }

  /**
   * 🎨 直接以記憶體中的 VFXPreset 配置播放特效（專供特效工房即時預覽與動態參數調試）
   */
  public playPresetConfig(
    preset: VFXPreset,
    from: ScreenPoint,
    to: ScreenPoint,
    isPlayerOrOnImpact?: boolean | ((impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void),
    onImpactCallback?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void
  ): Promise<void> {
    const startPos = this.screenToWorld(from);
    const endPos = this.screenToWorld(to);
    return this.playPresetWorld(preset, startPos, endPos, isPlayerOrOnImpact, onImpactCallback);
  }

  /**
   * 🌍 依據 §6.1 條款：原生支援 Canonical VFXSequence 世界座標播放管線
   */
  public playSequenceWorld(
    sequence: VFXSequence,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    isPlayerOrOnImpact?: boolean | ((impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void),
    onImpactCallback?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void,
    visitedSequenceIds?: Set<string>,
    recursionDepth: number = 0,
    resolveCueWorldPoints?: VFXCueWorldPointResolver
  ): Promise<void> {
    const isPlayer = typeof isPlayerOrOnImpact === 'boolean' ? isPlayerOrOnImpact : true;
    const onImpact = typeof isPlayerOrOnImpact === 'function' ? isPlayerOrOnImpact : onImpactCallback;

    const currentVisited = new Set(visitedSequenceIds);
    if (currentVisited.has(sequence.id) || recursionDepth >= 8) {
      console.warn(`[CombatFXEngine] Recursion loop or max depth (8) reached for sequence ${sequence.id}, aborting sub-layer.`);
      return Promise.resolve();
    }
    currentVisited.add(sequence.id);

    return new Promise((resolve) => {
      const impactTrack = sequence.tracks.find(t => t.type === 'IMPACT');
      const impactClip = impactTrack?.clips.find(c => c.payload.type === 'IMPACT');
      const impactConfig: VFXImpactConfig = (impactClip?.payload.data as VFXImpactConfig) || {
        hitStopTime: 30,
        targetPunchScale: 0.95,
        shakeIntensity: 6,
        shakeDuration: 0.2,
        penetrationDistance: 0,
        knockbackDistance: 0,
        hitFlashColor: '#ffffff',
        screenShake: false
      };

      const resolvedCues = sequence.impactCues && sequence.impactCues.length > 0
        ? sequence.impactCues
        : [{ cueId: 'CUE_1', time: Number((sequence.duration * 0.7).toFixed(2)), weight: 1.0, isPrimary: true }];
      const totalHits = resolvedCues.length;
      const firedHits = new Set<number>();
      let resolved = false;

      const fireImpact = (hitIdx: number = 0, cue?: VFXImpactCue) => {
        if (!firedHits.has(hitIdx)) {
          firedHits.add(hitIdx);
          if (onImpact) {
            onImpact(impactConfig, hitIdx, totalHits, cue);
          }
        }
      };

      const curGen = this.playbackGeneration;
      this.playbackClock.extendDuration(sequence.duration);
      this.playbackClock.setSpeed(this.playbackSpeed);

      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          if (failsafeTimer) {
            clearTimeout(failsafeTimer);
            this.scheduledTimers.delete(failsafeTimer);
          }
          resolvedCues.forEach((cue, k) => fireImpact(k, cue));
          resolve();
        }
      };

      const failsafeWallMs = Math.max(1200, ((sequence.duration + 0.8) / this.playbackSpeed) * 1000);
      const failsafeTimer = setTimeout(() => {
        this.scheduledTimers.delete(failsafeTimer);
        if (this.playbackGeneration === curGen && !resolved) {
          safeResolve();
        }
      }, failsafeWallMs);
      this.scheduledTimers.add(failsafeTimer);

      let actualEndPos = endPos.clone();
      const mainTrack = sequence.tracks.find(t => t.id === 'trk_main' || t.type === 'MESH') || sequence.tracks[0];
      const mainClip = mainTrack?.clips[0];
      const mainData = mainClip?.payload.data as any;
      if (mainData?.trajectory === 'COLUMN_PIERCE' && impactConfig.penetrationDistance > 0) {
        const dir = new THREE.Vector3().subVectors(actualEndPos, startPos).normalize();
        actualEndPos = actualEndPos.addScaledVector(dir, impactConfig.penetrationDistance);
      }

      // 🔮 複合圖層排程 (遍歷 COMPOSITE_LAYER clips)
      for (const track of sequence.tracks) {
        for (const clip of track.clips) {
          if (clip.payload.type === 'COMPOSITE_LAYER') {
            const layerData = clip.payload.data;
            const delay = clip.startTime || 0;
            this.playbackClock.schedule(delay, () => {
              if (this.isRunning && this.playbackGeneration === curGen && layerData.presetId) {
                const subSeq = VFXPresetRepository.getInstance().getSequence(layerData.presetId);
                if (subSeq) {
                  const subMode = layerData.spatialMode || subSeq.spatialMode || 'A_TO_B';
                  const subStart = resolveVFXWorldStart(subMode, startPos, actualEndPos);
                  this.playSequenceWorld(
                    subSeq,
                    subStart,
                    actualEndPos,
                    isPlayer,
                    (layerData.emitsImpactCue || layerData.generatesHit) ? (imp, hIdx, tHits) => onImpact?.(imp, hIdx, tHits) : undefined,
                    currentVisited,
                    recursionDepth + 1
                  );
                }
              }
            });
          }
        }
      }

      // 🎯 具名 Impact Cue 與連擊節奏排程
      resolvedCues.forEach((cue, cueIdx) => {
        this.playbackClock.schedule(Math.max(0, cue.time), () => {
          if (this.isRunning && this.playbackGeneration === curGen) {
            fireImpact(cueIdx, cue);
            const sparkCount = cue.isPrimary || cueIdx === totalHits - 1 ? 12 : 6;
            const cuePositions = resolveCueWorldPoints?.(cue, cueIdx) || [actualEndPos];
            const colorCore = mainData?.colorCore || '#ffffff';
            cuePositions.forEach(position => this.playSlashSparks(position, colorCore, sparkCount));
          }
        });
      });

      // 🌟 核心：確定性多軌影格更新 (播放中逐訊框更新)
      let effectElapsed = 0;
      const totalDuration = Math.max(0.05, sequence.duration || 0.4);

      const instanceId = `inst_${sequence.id}_${curGen}_${Math.floor(this.getRandom() * 100000)}`;
      const instanceRoot = new THREE.Group();
      instanceRoot.name = instanceId;
      const instanceTrackGroups: THREE.Group[] = [];

      const effectInstance: VFXEffectInstance = {
        id: instanceId,
        root: instanceRoot,
        startTime: performance.now(),
        duration: sequence.duration,
        dispose: () => {
          if ((instanceRoot as any).__trailCache) {
            (instanceRoot as any).__trailCache.dispose();
            (instanceRoot as any).__trailCache = null;
          }
          instanceTrackGroups.forEach(g => CombatFXEngine.disposeTrackGroup(g));
          if (instanceRoot.parent) {
            instanceRoot.parent.remove(instanceRoot);
          }
          instanceRoot.clear();
        }
      };
      this.instanceRegistry.register(effectInstance, this.scene);

      this.activeEffects.push({
        update: (delta) => {
          if (this.playbackGeneration !== curGen) return true;
          effectElapsed += delta;
          this.renderSequenceWorldAt(sequence, effectElapsed, startPos, actualEndPos, instanceRoot, instanceTrackGroups);
          if (effectElapsed >= totalDuration) {
            safeResolve();
            return true;
          }
          return false;
        },
        dispose: () => {
          this.instanceRegistry.unregister(instanceId, this.scene);
        }
      });
    });
  }

  /**
   * 🌍 核心世界座標播放管線 (相容包裝，直接委派原生 playSequenceWorld)
   */
  public playPresetWorld(
    preset: any,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    isPlayerOrOnImpact?: boolean | ((impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void),
    onImpactCallback?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void,
    visitedPresetIds?: Set<string>,
    recursionDepth: number = 0,
    resolveCueWorldPoints?: VFXCueWorldPointResolver
  ): Promise<void> {
    const sequence: VFXSequence = preset.tracks
      ? (preset as VFXSequence)
      : (VFXPresetRepository.getInstance().getSequence(preset?.id) || (preset as VFXSequence));
    return this.playSequenceWorld(
      sequence,
      startPos,
      endPos,
      isPlayerOrOnImpact,
      onImpactCallback,
      visitedPresetIds,
      recursionDepth,
      resolveCueWorldPoints
    );
  }

  /**
   * 💥 公開受擊點破空火花與星芒爆散 (供時間軸與 Cue 點觸發)
   */
  public playCueSparks(pos: THREE.Vector3, colorHex: string = '#f59e0b', count = 12): void {
    this.playSlashSparks(pos, colorHex, count);
  }

  /**
   * 💥 受擊點破空火花與星芒爆散 (委派 ParticleLayerRenderer)
   */
  private playSlashSparks(pos: THREE.Vector3, colorHex: string, count = 16): void {
    const sparkFx = ParticleLayerRenderer.spawnSlashSparks(
      this.scene,
      pos,
      colorHex,
      count,
      () => this.getRandom()
    );
    this.activeEffects.push(sparkFx);
  }

  /**
   * ⚔️ 次世代真實破空動態月牙劍氣（穿透胸膛、剃刀外鋒、漸層氣浪）
   */
  private playArcSlash(
    pos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    this.scene.add(group);

    const slashShaderMat = MeshLayerRenderer.createSlashShaderMaterial(preset.colorCore, preset.colorRim);

    let currentGeo: THREE.BufferGeometry | null = null;
    let currentMesh: THREE.Mesh | null = null;
    let crossGeo: THREE.BufferGeometry | null = null;
    let crossMesh: THREE.Mesh | null = null;

    let elapsed = 0;
    let hitTriggered = false;
    const duration = Math.max(0.18, preset.duration || 0.26);

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const prog = Math.max(0, Math.min(elapsed / duration, 1));

        const params = MeshLayerRenderer.calculateSlashGeometryParams(preset, prog);

        if (currentGeo) currentGeo.dispose();
        currentGeo = MeshLayerRenderer.buildDynamicSlashGeo(
          params.bladeRadius,
          params.bladeWidth,
          params.headAngle,
          params.tailAngle,
          params.centerAngle,
          params.aspect
        );

        if (!currentMesh) {
          currentMesh = new THREE.Mesh(currentGeo, slashShaderMat);
          group.add(currentMesh);

          if (params.isCross) {
            crossGeo = MeshLayerRenderer.buildDynamicSlashGeo(
              params.bladeRadius,
              params.bladeWidth,
              -params.headAngle,
              -params.tailAngle,
              -params.centerAngle,
              params.aspect
            );
            crossMesh = new THREE.Mesh(crossGeo, slashShaderMat);
            group.add(crossMesh);
          }
        } else {
          currentMesh.geometry = currentGeo;
          if (params.isCross && crossMesh) {
            if (crossGeo) crossGeo.dispose();
            crossGeo = MeshLayerRenderer.buildDynamicSlashGeo(
              params.bladeRadius,
              params.bladeWidth,
              -params.headAngle,
              -params.tailAngle,
              -params.centerAngle,
              params.aspect
            );
            crossMesh.geometry = crossGeo;
          }
        }

        const fade = prog > 0.6 ? (1 - (prog - 0.6) / 0.4) : 1.0;
        slashShaderMat.uniforms.uOpacity.value = fade;

        // 命中斷點：覆蓋目標胸膛瞬間爆發火花
        if (!hitTriggered && prog >= 0.38) {
          hitTriggered = true;
          onHit();
          this.playSlashSparks(pos, preset.colorRim, 16);
        }

        if (prog >= 1) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        if (currentGeo) currentGeo.dispose();
        if (crossGeo) crossGeo.dispose();
        slashShaderMat.dispose();
      }
    });
  }

  /**
   * 🛡️ 神聖金光護盾壁壘 (Holy Aegis Shield)
   */
  private playHolyShield(
    pos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const sc = preset.scale || 1.0;
    const shieldShape = preset.shieldShape || 'HEX';
    const group = MeshLayerRenderer.buildHolyShieldGroup(sc, preset.colorCore || '#fde047', preset.colorRim || '#eab308', shieldShape as any);
    group.position.copy(pos);
    this.scene.add(group);

    onHit();
    let elapsed = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const prog = Math.min(elapsed / preset.duration, 1.0);
        MeshLayerRenderer.updateHolyShield(group, prog);

        if (prog >= 1.0) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        const parts = (group as any).__shieldParts;
        if (parts) {
          parts.hexMesh.geometry.dispose();
          parts.ringMesh.geometry.dispose();
          parts.crossVMesh.geometry.dispose();
          parts.crossHMesh.geometry.dispose();
          parts.hexMat.dispose();
          parts.ringMat.dispose();
          parts.crossMat.dispose();
        }
      }
    });
  }

  /**
   * 📢 戰吼威懾音波 (Taunt Shout Shockwave)
   */
  private playTauntShout(
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const sc = preset.scale || 1.0;
    const waveCount = Math.max(1, Math.min(8, preset.waveCount || 3));
    const group = MeshLayerRenderer.buildTauntShoutGroup(waveCount, preset.colorRim || '#ef4444');
    group.position.copy(casterPos);
    this.scene.add(group);

    let elapsed = 0;
    let hitFired = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const prog = Math.min(elapsed / preset.duration, 1.0);
        MeshLayerRenderer.updateTauntShout(group, prog, casterPos, targetPos, sc);

        if (!hitFired && elapsed >= preset.duration * 0.45) {
          hitFired = true;
          onHit();
        }

        if (elapsed >= preset.duration) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        const waves = (group as any).__waves;
        if (waves) {
          waves.forEach((w: any) => {
            w.mesh.geometry.dispose();
            w.mat.dispose();
          });
        }
      }
    });
  }

  /**
   * ☀️ 垂直神聖光柱
   */
  private playHolyPillar(
    pos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const sc = preset.scale || 1.0;
    const mesh = MeshLayerRenderer.buildHolyPillarMesh(sc, preset.colorCore || '#fde047');
    mesh.position.copy(pos);
    this.scene.add(mesh);

    onHit();
    let elapsed = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const prog = Math.min(elapsed / preset.duration, 1.0);
        MeshLayerRenderer.updateHolyPillar(mesh, prog);

        if (prog >= 1.0) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material) (mesh.material as THREE.Material).dispose();
      }
    });
  }

  /**
   * 🕊️ 光環升騰
   */
  private playAuraRing(
    pos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    this.scene.add(group);

    const ringGeo = new THREE.TorusGeometry(45 * preset.scale, 4, 16, 36);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.colorRim),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    group.add(ring);

    onHit();

    let elapsed = 0;
    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const prog = Math.min(elapsed / preset.duration, 1);
        ring.position.y = (prog * 100) - 40;
        ring.scale.set(1 + prog * 0.4, 1 + prog * 0.4, 1 + prog * 0.4);
        ringMat.opacity = Math.max(0, 1 - prog);

        if (prog >= 1) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        ringGeo.dispose();
        ringMat.dispose();
      }
    });
  }

  /**
   * 🏹 弓兵拋物齊射與箭塔齊射 (委派 TrailLayerRenderer)
   */
  private playArrowVolley(
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const volleyFx = TrailLayerRenderer.spawnArrowVolley(this.scene, fromPos, toPos, {
      color: preset.colorRim,
      scale: preset.scale || 1.0,
      duration: preset.duration || 0.45,
      arrowCount: 9,
      onHitPoint: onHit,
      rng: () => this.getRandom()
    });

    this.activeEffects.push({
      update: (delta) => {
        const done = volleyFx.update(delta);
        if (done) onComplete();
        return done;
      },
      dispose: () => volleyFx.dispose()
    });
  }

  private static glowTextureCache = new Map<string, THREE.CanvasTexture>();

  private createGlowTexture(colorHex: string): THREE.CanvasTexture {
    const key = (colorHex || '#ffffff').toLowerCase();
    const cached = CombatFXEngine.glowTextureCache.get(key);
    if (cached) return cached;
    if (typeof document === 'undefined') {
      return new THREE.Texture() as any;
    }

    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, colorHex);
      grad.addColorStop(0.65, colorHex + '44');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const tex = new THREE.CanvasTexture(c);
    CombatFXEngine.glowTextureCache.set(key, tex);
    return tex;
  }

  private createGlowSprite(colorHex: string, size = 64, opacity = 0.85): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      map: this.createGlowTexture(colorHex),
      transparent: true,
      opacity: Math.max(0, Math.min(1, opacity)),
      blending: THREE.AdditiveBlending
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    return s;
  }


  /**
   * ❄️ 命中點次生冰刺/晶刺破裂爆發 (委派 MeshLayerRenderer)
   */
  private spawnSecondarySpikes(pos: THREE.Vector3, count: number, height: number, colorRimHex: string, preset?: VFXPreset): void {
    const spikeFx = MeshLayerRenderer.spawnSecondarySpikes(
      this.scene,
      pos,
      count,
      height,
      colorRimHex,
      preset,
      () => this.getRandom()
    );
    this.activeEffects.push(spikeFx);
  }

  /**
   * 🌋 大地衝擊裂地波管線 (Ground Fissure Wave Pipeline)
   * 解決痛點：施術者延伸至目標的地裂浪湧推進、實體尖岩與伴生地火連爆
   */
  private playGroundFissure(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const group = new THREE.Group();
    this.scene.add(group);

    // 1. 局部 FX 光源：為實體尖岩提供立體漫反射與高光
    const isPhong = preset.spikeMaterialMode !== 'BASIC';
    if (isPhong) {
      const ambientLight = new THREE.AmbientLight(0x8899aa, 0.95);
      const dirLight = new THREE.DirectionalLight(0xffeedd, 1.5);
      dirLight.position.set(60, 140, 100);
      group.add(ambientLight);
      group.add(dirLight);
    }

    const groundYOffset = -60; // 貼合卡牌腳底地面
    const groundStart = new THREE.Vector3(startPos.x, startPos.y + groundYOffset, 0);
    const groundEnd = new THREE.Vector3(endPos.x, endPos.y + groundYOffset, 0);

    const totalDist = groundStart.distanceTo(groundEnd);
    const stepDist = 48;
    const nodeCount = Math.max(4, Math.min(12, Math.floor(totalDist / stepDist)));
    const totalDuration = Math.max(0.28, preset.duration || 0.42);
    const nodeInterval = (totalDuration * 0.72) / Math.max(1, nodeCount - 1);

    const nodes: {
      pos: THREE.Vector3;
      delay: number;
      isFinal: boolean;
      scaleFactor: number;
    }[] = [];

    for (let i = 0; i < nodeCount; i++) {
      const ratio = nodeCount > 1 ? i / (nodeCount - 1) : 1;
      const pos = new THREE.Vector3().lerpVectors(groundStart, groundEnd, ratio);
      if (i > 0 && i < nodeCount - 1) {
        pos.y += (this.getRandom() - 0.5) * 12;
      }
      const delay = i * nodeInterval;
      const isFinal = (i === nodeCount - 1);
      const scaleFactor = 0.65 + ratio * 0.75;
      nodes.push({ pos, delay, isFinal, scaleFactor });
    }

    const spikeWidth = Math.max(4, (preset.spikeWidth || 10) * (preset.scale || 1.0));
    const baseHeight = Math.max(30, (preset.spikeHeight || 55) * (preset.scale || 1.0));

    let activeNodeIndex = 0;
    let elapsed = 0;
    let hitTriggered = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        while (activeNodeIndex < nodes.length && elapsed >= nodes[activeNodeIndex].delay) {
          const node = nodes[activeNodeIndex];
          activeNodeIndex++;

          const nodeGroup = new THREE.Group();
          nodeGroup.position.copy(node.pos);
          group.add(nodeGroup);

          const curHeight = baseHeight * node.scaleFactor;
          const curWidth = spikeWidth * node.scaleFactor;

          // 2. 實體尖岩 Mesh（委派 MeshLayerRenderer）
          const rockGeo = MeshLayerRenderer.createSpikeGeometry('JAGGED_ROCK', curWidth, curHeight);

          const rockMat = isPhong
            ? new THREE.MeshPhongMaterial({
                color: new THREE.Color(preset.colorRim || '#94a3b8'),
                specular: new THREE.Color(0xffffff),
                shininess: 24,
                flatShading: true,
                transparent: true,
                opacity: 1
              })
            : new THREE.MeshBasicMaterial({
                color: new THREE.Color(preset.colorRim || '#94a3b8'),
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending
              });

          const rockMesh = new THREE.Mesh(rockGeo, rockMat);
          rockMesh.scale.set(0.1, 0.01, 0.1);
          rockMesh.rotation.z = (this.getRandom() - 0.5) * 0.35;
          nodeGroup.add(rockMesh);

          // 3. 地表黑焦裂痕
          const crackGeo = new THREE.CircleGeometry(curWidth * 1.5, 8);
          crackGeo.rotateX(-Math.PI / 2.5);
          const crackMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color('#1e1b18'),
            transparent: true,
            opacity: 0.8
          });
          const crackMesh = new THREE.Mesh(crackGeo, crackMat);
          crackMesh.position.y = -2;
          nodeGroup.add(crackMesh);

          // 4. 伴生地火噴發
          const eruptFire = preset.spikeEruptFire || preset.shaderMode === 'VOLUMETRIC_FIRE' || preset.category === 'ELEMENTAL';
          let fireMesh: THREE.Mesh | null = null;
          if (eruptFire) {
            const fireGeo = new THREE.ConeGeometry(curWidth * 0.95, curHeight * 1.35, 6);
            fireGeo.translate(0, curHeight * 0.65, 0);
            const fireMat = new THREE.MeshBasicMaterial({
              color: new THREE.Color(preset.colorCore || '#ff7700'),
              transparent: true,
              opacity: 0.95,
              blending: THREE.AdditiveBlending
            });
            fireMesh = new THREE.Mesh(fireGeo, fireMat);
            fireMesh.scale.set(0.01, 0.01, 0.01);
            nodeGroup.add(fireMesh);
          }

          let nodeAge = 0;
          const nodeDur = 0.38;
          this.activeEffects.push({
            update: (d) => {
              nodeAge += d;
              const p = Math.min(1, nodeAge / nodeDur);
              if (p < 0.25) {
                const sp = p / 0.25;
                rockMesh.scale.set(1, sp, 1);
                if (fireMesh) fireMesh.scale.set(1.2 * sp, 1.4 * sp, 1.2 * sp);
              } else {
                const fade = Math.max(0, 1 - (p - 0.4) / 0.6);
                rockMat.opacity = fade;
                if (fireMesh) {
                  fireMesh.scale.set(1.2, 1.4 * fade, 1.2);
                  (fireMesh.material as THREE.MeshBasicMaterial).opacity = fade;
                }
              }
              return p >= 1;
            },
            dispose: () => {
              nodeGroup.remove(rockMesh);
              nodeGroup.remove(crackMesh);
              if (fireMesh) nodeGroup.remove(fireMesh);
              group.remove(nodeGroup);
              rockGeo.dispose();
              rockMat.dispose();
              crackGeo.dispose();
              crackMat.dispose();
              if (fireMesh) {
                fireMesh.geometry.dispose();
                (fireMesh.material as THREE.Material).dispose();
              }
            }
          });

          // 如果是最後一個目標節點，觸發受擊回饋與次生尖刺爆發
          if (node.isFinal && !hitTriggered) {
            hitTriggered = true;
            onHit();
            this.spawnDynamicImpactBurst(endPos, preset);
            if (preset.spikes && preset.spikes > 0) {
              this.spawnSecondarySpikes(endPos, preset.spikes, preset.spikeHeight || 55, preset.colorRim, preset);
            }
          }
        }

        if (elapsed >= totalDuration + 0.38) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
      }
    });
  }

  /**
   * 💥 通用命中衝擊光環與爆散粒子 (委派 ImpactLayerRenderer 與 ParticleLayerRenderer)
   */
  private spawnDynamicImpactBurst(pos: THREE.Vector3, preset: VFXPreset): void {
    const impact = preset.impact as any;
    const wavePlane = (impact?.wavePlane || preset.wavePlane) === 'GROUND' ? 'GROUND' : 'CAMERA';
    const waveRadius = ((impact?.waveRadius ?? preset.waveRadius) || 65) * (preset.scale || 1.0);
    const waveThickness = (impact?.waveThickness ?? (preset as any).waveThickness) || 4;
    const waveBlur = (impact?.waveBlur ?? (preset as any).waveBlur) || 30;

    const wave = ImpactLayerRenderer.spawnImpactWave(this.scene, pos, {
      color: preset.colorRim,
      plane: wavePlane,
      radius: waveRadius,
      thickness: waveThickness,
      blur: waveBlur
    });
    const burst = ParticleLayerRenderer.spawnBurstParticles(this.scene, pos, {
      color: preset.colorRim,
      count: Math.max(12, preset.burstCount || 40),
      size: (preset.trailSize || 8) * (preset.scale || 1.0),
      rng: () => this.getRandom()
    });
    this.activeEffects.push(wave);
    this.activeEffects.push(burst);
  }

  /**
   * 🌟 核心通用動態彈道投射物管線 (Universal Dynamic Projectile)
   */
  private playDynamicProjectile(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    let actualStart = startPos.clone();
    const trajMode = (preset.spatialMode || preset.trajectoryPath || preset.trajectory || '') as string;
    actualStart = resolveVFXWorldStart(trajMode, actualStart, endPos);

    const group = new THREE.Group();
    group.renderOrder = VFX_RENDER_ORDER.MAIN;
    group.position.copy(actualStart);
    this.scene.add(group);

    const sc = preset.scale || 1.0;
    let coreMesh: THREE.Object3D;

    let flameMat: THREE.ShaderMaterial | null = null;

    if (preset.shaderMode === 'FRESNEL_ICE') {
      const coneGeo = new THREE.ConeGeometry(9 * sc, 50 * sc, 8);
      coneGeo.rotateX(Math.PI / 2);
      const mat = MeshLayerRenderer.createFresnelShaderMaterial(preset.colorCore, preset.colorRim, preset.fresnel || 2.0);
      coreMesh = new THREE.Mesh(coneGeo, mat);
      group.lookAt(endPos);
    } else if (preset.shaderMode === 'VOLUMETRIC_FIRE' || preset.shaderMode === 'DARK_VOID') {
      const sphereGeo = new THREE.SphereGeometry(16 * sc, 32, 32);
      flameMat = MeshLayerRenderer.createVolumetricFlameMaterial(
        preset.colorCore,
        preset.colorRim,
        preset.flameTurbulence !== undefined ? preset.flameTurbulence : 5.0,
        preset.flameTurbulenceSpeed !== undefined ? preset.flameTurbulenceSpeed : 2.0
      );
      const sphere = new THREE.Mesh(sphereGeo, flameMat);
      const glow = this.createGlowSprite(
        preset.colorRim,
        (preset.glowRadius || 75) * sc,
        preset.glowOpacity ?? 0.8
      );
      const sub = new THREE.Group();
      sub.add(sphere);
      sub.add(glow);
      coreMesh = sub;
    } else {
      const shape = preset.coreMeshShape || 'ARROW';
      let geo: THREE.BufferGeometry;
      if (shape === 'SPHERE') {
        geo = new THREE.SphereGeometry(10 * sc, 16, 16);
      } else if (shape === 'DIAMOND') {
        geo = new THREE.OctahedronGeometry(11 * sc, 0);
      } else if (shape === 'STAR') {
        geo = new THREE.DodecahedronGeometry(9 * sc, 0);
      } else if (shape === 'RING') {
        geo = new THREE.TorusGeometry(10 * sc, 3 * sc, 8, 16);
      } else {
        // 預設 ARROW (錐形箭頭)
        geo = new THREE.ConeGeometry(5 * sc, 35 * sc, 6);
        geo.rotateX(Math.PI / 2);
      }

      const brightness = Math.max(0.2, preset.coreBrightness ?? 1.0);
      const baseColor = new THREE.Color(preset.colorRim || '#38bdf8');
      baseColor.multiplyScalar(brightness);

      const mat = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: Math.min(1.0, 0.9 * brightness),
        blending: THREE.AdditiveBlending
      });
      coreMesh = new THREE.Mesh(geo, mat);
      (coreMesh as any).__coreShape = shape;
      (coreMesh as any).__coreBrightness = brightness;
      group.lookAt(endPos);
    }
    group.add(coreMesh);

    // 動態拖尾粒子系統 (委派 TrailLayerRenderer)
    const trailInstance = TrailLayerRenderer.createTrail(
      this.scene,
      actualStart,
      preset.colorRim,
      preset.trailCount || 30,
      preset.trailSize || 8,
      sc
    );

    let elapsed = 0;
    let hitFired = false;
    const dur = Math.max(0.15, preset.duration || 0.35);

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const prog = Math.min(elapsed / dur, 1);

        const curPos = new THREE.Vector3().lerpVectors(actualStart, endPos, prog);
        if (preset.arcHeight && preset.arcHeight > 0) {
          curPos.y += Math.sin(prog * Math.PI) * preset.arcHeight;
        }
        group.position.copy(curPos);

        // 火焰噪點動態顫動時間演進
        if (flameMat && flameMat.uniforms && flameMat.uniforms.uTime) {
          flameMat.uniforms.uTime.value += delta;
        }

        // 自轉角速度
        if (preset.spin && preset.spin > 0) {
          coreMesh.rotateZ(delta * preset.spin);
        }

        // 動態更新拖尾
        trailInstance.update(curPos);

        if (!hitFired && prog >= 0.96) {
          hitFired = true;
          onHit();
          if (preset.spikes && preset.spikes > 0) {
            this.spawnSecondarySpikes(endPos, preset.spikes, preset.spikeHeight || 45, preset.colorRim, preset);
          }
          this.spawnDynamicImpactBurst(endPos, preset);
        }

        if (prog >= 1) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        trailInstance.dispose();
      }
    });
  }

  /**
   * ⚡ 動態雷擊電弧管線 (委派 TrailLayerRenderer)
   */
  private playDynamicLightning(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    onHit();
    if (preset.spikes && preset.spikes > 0) {
      this.spawnSecondarySpikes(endPos, preset.spikes, preset.spikeHeight || 40, preset.colorRim);
    }
    this.spawnDynamicImpactBurst(endPos, preset);

    const lightningFx = TrailLayerRenderer.spawnLightning(this.scene, startPos, endPos, {
      color: preset.colorCore,
      scale: preset.scale || 1.0,
      duration: preset.duration || 0.3,
      rng: () => this.getRandom()
    });

    this.activeEffects.push({
      update: (delta) => {
        const done = lightningFx.update(delta);
        if (done) onComplete();
        return done;
      },
      dispose: () => lightningFx.dispose()
    });
  }

  /**
   * 💫 動態高能射線管線 (委派 TrailLayerRenderer)
   */
  private playDynamicBeam(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    onHit();
    this.spawnDynamicImpactBurst(endPos, preset);

    const beamFx = TrailLayerRenderer.spawnBeam(this.scene, startPos, endPos, {
      colorCore: preset.colorCore,
      colorRim: preset.colorRim,
      scale: preset.scale || 1.0,
      duration: preset.duration || 0.3
    });

    this.activeEffects.push({
      update: (delta) => {
        const done = beamFx.update(delta);
        if (done) onComplete();
        return done;
      },
      dispose: () => beamFx.dispose()
    });
  }
}
