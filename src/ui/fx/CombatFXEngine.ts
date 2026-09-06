import * as THREE from 'three';
import { VFXPreset, VFXImpactConfig, VFXImpactCue } from '../../models/VFX';
import defaultVFXPresets from '../../data/vfx_presets.json';
import { VFXPresetRepository } from './VFXPresetRepository';
import { PlaybackClock } from './PlaybackClock';

import { VFXPlayer, ScreenPoint, ActiveEffect } from './VFXPlayer';
import { MeshLayerRenderer } from './renderers/MeshLayerRenderer';
import { ParticleLayerRenderer } from './renderers/ParticleLayerRenderer';
import { ImpactLayerRenderer } from './renderers/ImpactLayerRenderer';

export type { ScreenPoint };

export class CombatFXEngine extends VFXPlayer {
  private static fxInstance: CombatFXEngine | null = null;
  private scheduledTimers = new Set<ReturnType<typeof setTimeout>>();

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

  /**
   * 🌍 確定性影格求值核心 (世界座標版本)
   */
  public renderFrameWorldAt(
    preset: VFXPreset,
    timeSeconds: number,
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3
  ): void {
    if (!this.studioPreviewGroup) {
      this.studioPreviewGroup = new THREE.Group();
    }
    if (!this.scene.children.includes(this.studioPreviewGroup)) {
      this.scene.add(this.studioPreviewGroup);
    }
    this.studioPreviewGroup.visible = true;

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
      shaderMode: preset.shaderMode || (preset.trajectory === 'MELEE_SWEEP' ? 'SLASH_BLADE' : 'ENERGY_BEAM'),
      spatialMode: preset.spatialMode || preset.trajectoryPath || preset.trajectory || 'A_TO_B',
      reverse: !!preset.reverse,
      colorCore: preset.colorCore || '#ffffff',
      colorRim: preset.colorRim || '#38bdf8',
      preset: preset,
      enabled: !(preset as any)._mainTrackMuted
    };

    const secondaryTracks = (preset.layers || []).map((l, idx) => {
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
        shaderMode: l.shaderMode || refPreset?.shaderMode || 'ENERGY_BEAM',
        spatialMode: l.spatialMode || refPreset?.spatialMode || 'A_TO_B',
        reverse: l.reverse !== undefined ? l.reverse : (refPreset?.reverse || false),
        colorCore: refPreset?.colorCore || preset.colorCore || '#ffffff',
        colorRim: refPreset?.colorRim || preset.colorRim || '#f59e0b',
        preset: refPreset || preset,
        enabled: l.enabled !== false
      };
    });

    const allTracks = [mainTrack, ...secondaryTracks];

    // 確保每條軌道具備專屬的 Group
    if (!this.studioTrackGroups) {
      this.studioTrackGroups = [];
    }

    while (this.studioTrackGroups.length < allTracks.length) {
      const g = new THREE.Group();
      this.studioTrackGroups.push(g);
      this.studioPreviewGroup.add(g);
    }

    // 隱藏多餘的群組
    for (let i = allTracks.length; i < this.studioTrackGroups.length; i++) {
      this.studioTrackGroups[i].visible = false;
    }

    // 🌟 2. 逐軌進行確定性影格求值與 3D 幾何繪製
    for (let i = 0; i < allTracks.length; i++) {
      const track = allTracks[i];
      const trackGroup = this.studioTrackGroups[i];

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
    if (mode === 'AT_TARGET') {
      return targetPos.clone();
    }
    if (mode === 'VERTICAL_DROP' || mode === 'VERTICAL_SKY_TO_B') {
      const sky = new THREE.Vector3(targetPos.x, targetPos.y + 380, targetPos.z);
      return reverse ? new THREE.Vector3().lerpVectors(targetPos, sky, progress) : new THREE.Vector3().lerpVectors(sky, targetPos, progress);
    }
    if (mode === 'DIAGONAL_DROP' || mode === 'DIAGONAL_SKY_TO_B') {
      const sky = new THREE.Vector3(targetPos.x - 260, targetPos.y + 380, targetPos.z);
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
    const shader = track.shaderMode || 'ENERGY_BEAM';
    const isSlash = shader === 'SLASH_BLADE' || track.spatialMode === 'MELEE_SWEEP';

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
      cache.slashGeo = this.buildDynamicSlashGeo(
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

      // 十字斬第二道反向刀芒
      if (params.isCross) {
        if (cache.crossGeo) cache.crossGeo.dispose();
        cache.crossGeo = this.buildDynamicSlashGeo(
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
      } else if (cache.crossMesh) {
        cache.crossMesh.visible = false;
      }

      return;
    }

    // ─────────────────────────────────────────────────────────────
    // ⚡ 2. 狂暴折線電漿與天降雷殛 (DIELECTRIC_LIGHTNING)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'DIELECTRIC_LIGHTNING') {
      trackGroup.position.set(0, 0, 0);

      const rayStart = startPos;
      const rayTarget = endPos;

      // 產生 3 條折線閃電 Tube
      if (!cache.lightningGroup) {
        cache.lightningGroup = new THREE.Group();
        trackGroup.add(cache.lightningGroup);
      }
      cache.lightningGroup.visible = true;

      // 清除前一影格的閃電幾何
      while (cache.lightningGroup.children.length > 0) {
        const c = cache.lightningGroup.children[0];
        cache.lightningGroup.remove(c);
        if ((c as any).geometry) (c as any).geometry.dispose();
      }

      // 進度長度計算 (隨 p 延伸)
      const currentEnd = new THREE.Vector3().lerpVectors(rayStart, rayTarget, Math.min(1.0, p * 2.2));
      const segments = 10;
      const pts: THREE.Vector3[] = [rayStart];
      for (let s = 1; s < segments; s++) {
        const alpha = s / segments;
        const base = new THREE.Vector3().lerpVectors(rayStart, currentEnd, alpha);
        const jitter = (Math.sin(s * 7.5 + p * 20) * 22) * sc;
        pts.push(new THREE.Vector3(base.x + jitter, base.y, base.z + (Math.cos(s * 5) * 12)));
      }
      pts.push(currentEnd);

      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 20, 4.5 * sc, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(track.colorRim),
        transparent: true,
        opacity: Math.max(0.3, fadeAlpha),
        blending: THREE.AdditiveBlending
      });
      cache.lightningGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

      // 地面受擊電弧擴散光環
      if (p > 0.3) {
        const ringProg = (p - 0.3) / 0.7;
        const ringGeo = new THREE.RingGeometry((12 + ringProg * 40) * sc, (18 + ringProg * 45) * sc, 20);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(track.colorCore),
          transparent: true,
          opacity: Math.max(0.1, (1 - ringProg) * fadeAlpha),
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(rayTarget);
        cache.lightningGroup.add(ringMesh);
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🪨 3. 破土錐狀地刺陣列 (EARTH_SHATTER)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'EARTH_SHATTER') {
      trackGroup.position.copy(targetPos);

      if (!cache.spikesGroup) {
        cache.spikesGroup = new THREE.Group();
        const offsets = [
          { x: 0, y: 0, scale: 1.0, rot: 0 },
          { x: -28, y: -8, scale: 0.75, rot: 0.25 },
          { x: 26, y: -6, scale: 0.8, rot: -0.22 },
          { x: -14, y: 14, scale: 0.65, rot: 0.12 },
          { x: 18, y: 16, scale: 0.7, rot: -0.15 }
        ];

        offsets.forEach(off => {
          const coneGeo = new THREE.ConeGeometry(9 * sc * off.scale, 58 * sc * off.scale, 6);
          coneGeo.translate(0, (29 * sc * off.scale), 0);
          const coneMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(track.colorRim),
            wireframe: false
          });
          const cone = new THREE.Mesh(coneGeo, coneMat);
          cone.position.set(off.x * sc, off.y * sc, 0);
          cone.rotation.z = off.rot;
          cache.spikesGroup.add(cone);
        });
        trackGroup.add(cache.spikesGroup);
      }
      cache.spikesGroup.visible = true;

      // 破土生長高度計算 (前段破土突刺，中段聳立，後段崩解)
      let hScale = p < 0.35 ? Math.pow(p / 0.35, 0.6) : (p > 0.75 ? Math.max(0.1, 1 - (p - 0.75) / 0.25) : 1.0);
      cache.spikesGroup.scale.set(1.0, Math.max(0.05, hScale), 1.0);

      cache.spikesGroup.children.forEach((mesh: any) => {
        if (mesh.material) {
          mesh.material.color.set(track.colorRim);
          mesh.material.opacity = fadeAlpha;
        }
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // ❄️ 4. 冰晶之矛與旋轉冰環 (FRESNEL_ICE / FROST_LANCE / FROST_NOVA)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'FRESNEL_ICE' || shader === 'FROST_LANCE' || shader === 'FROST_NOVA') {
      trackGroup.position.copy(curPos);
      trackGroup.lookAt(endPos);

      if (!cache.frostGroup) {
        cache.frostGroup = new THREE.Group();
        // 核心冰晶長錐
        const coneGeo = new THREE.ConeGeometry(9 * sc, 60 * sc, 8);
        coneGeo.rotateX(Math.PI / 2);
        const coneMat = MeshLayerRenderer.createFresnelShaderMaterial(track.colorCore, track.colorRim, 2.0);
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cache.frostGroup.add(cone);

        // 外圍旋轉冰晶環
        const ringGeo = new THREE.TorusGeometry(18 * sc, 2.5 * sc, 8, 20);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(track.colorRim),
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        cache.frostGroup.add(ring);

        trackGroup.add(cache.frostGroup);
      }
      cache.frostGroup.visible = true;
      cache.frostGroup.rotation.z = p * Math.PI * 4;
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🔮 5. 能量貫穿光束 (ENERGY_BEAM - 非多彈道時)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'ENERGY_BEAM' && track.preset?.trajectory !== 'ARC_MULTI' && track.spatialMode !== 'ARC_MULTI') {
      trackGroup.position.set(0, 0, 0);

      if (!cache.beamMesh) {
        cache.beamGroup = new THREE.Group();

        // 圓柱光柱 (連接起訖點)
        const dist = startPos.distanceTo(endPos) || 100;
        const cylGeo = new THREE.CylinderGeometry(7 * sc, 7 * sc, dist, 12);
        cylGeo.translate(0, dist / 2, 0);
        cylGeo.rotateX(Math.PI / 2);
        const cylMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(track.colorRim),
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending
        });
        const cyl = new THREE.Mesh(cylGeo, cylMat);
        cyl.position.copy(startPos);
        cyl.lookAt(endPos);
        cache.beamGroup.add(cyl);

        // 兩端發光圓環
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(track.colorCore),
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide
        });
        const ring1 = new THREE.Mesh(new THREE.RingGeometry(8 * sc, 16 * sc, 16), ringMat);
        ring1.position.copy(startPos);
        cache.beamGroup.add(ring1);

        const ring2 = new THREE.Mesh(new THREE.RingGeometry(12 * sc, 22 * sc, 16), ringMat);
        ring2.position.copy(endPos);
        cache.beamGroup.add(ring2);

        cache.beamMesh = cyl;
        trackGroup.add(cache.beamGroup);
      }
      cache.beamGroup.visible = true;
      if (cache.beamMesh?.material) {
        (cache.beamMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.2, fadeAlpha * (0.6 + Math.sin(p * 25) * 0.4));
      }
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🔥 6. 體積黑體動態火焰彈道 (VOLUMETRIC_FIRE / DARK_VOID - 毀滅隕石、熾熱天火)
    // ─────────────────────────────────────────────────────────────
    if (shader === 'VOLUMETRIC_FIRE' || shader === 'DARK_VOID') {
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
        cache.shieldGroup = MeshLayerRenderer.buildHolyShieldGroup(sc, track.colorCore || '#fde047', track.colorRim || '#eab308');
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
        cache.shoutGroup = MeshLayerRenderer.buildTauntShoutGroup(3, track.colorRim || '#ef4444');
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
      trackGroup.position.set(0, 0, 0);
      if (!cache.arrowGroup) {
        cache.arrowGroup = new THREE.Group();
        const arrowCount = 9;
        const arrowGeo = new THREE.ConeGeometry(2.5 * sc, 24 * sc, 5);
        arrowGeo.rotateX(Math.PI / 2);
        const arrowMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(track.colorRim || '#38bdf8'),
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending
        });
        const items: any[] = [];
        for (let i = 0; i < arrowCount; i++) {
          const mesh = new THREE.Mesh(arrowGeo, arrowMat);
          cache.arrowGroup.add(mesh);
          const p0 = new THREE.Vector3(casterPos.x + (Math.sin(i * 3.7) * 20), casterPos.y + (Math.cos(i * 2.1) * 15), 0);
          const p2 = new THREE.Vector3(targetPos.x + (Math.sin(i * 5.3) * 30), targetPos.y + (Math.cos(i * 4.2) * 20), 0);
          const midX = (p0.x + p2.x) / 2;
          const midY = Math.max(p0.y, p2.y) + 140 + (i % 3) * 15;
          const p1 = new THREE.Vector3(midX, midY, 0);
          items.push({ mesh, p0, p1, p2, delay: i * 0.03 });
        }
        cache.arrowItems = items;
        trackGroup.add(cache.arrowGroup);
      }
      cache.arrowGroup.visible = true;
      const totalDuration = track.duration || 0.4;
      cache.arrowItems.forEach((item: any) => {
        const tLocal = (p * totalDuration - item.delay) / (totalDuration * 0.85);
        if (tLocal < 0 || tLocal >= 1.0) {
          item.mesh.visible = false;
          return;
        }
        item.mesh.visible = true;
        const oneMinusT = 1.0 - tLocal;
        const posX = oneMinusT * oneMinusT * item.p0.x + 2 * oneMinusT * tLocal * item.p1.x + tLocal * tLocal * item.p2.x;
        const posY = oneMinusT * oneMinusT * item.p0.y + 2 * oneMinusT * tLocal * item.p1.y + tLocal * tLocal * item.p2.y;
        item.mesh.position.set(posX, posY, 0);
        const tanX = 2 * (1 - tLocal) * (item.p1.x - item.p0.x) + 2 * tLocal * (item.p2.x - item.p1.x);
        const tanY = 2 * (1 - tLocal) * (item.p1.y - item.p0.y) + 2 * tLocal * (item.p2.y - item.p1.y);
        const tangent = new THREE.Vector3(tanX, tanY, 0).normalize();
        item.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
      });
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // 🌋 11. 大地裂地波推進 (GROUND_FISSURE)
    // ─────────────────────────────────────────────────────────────
    if (track.preset?.trajectory === 'GROUND_FISSURE' || track.spatialMode === 'GROUND_FISSURE') {
      trackGroup.position.set(0, 0, 0);
      if (!cache.fissureGroup) {
        cache.fissureGroup = new THREE.Group();
        const groundYOffset = -60;
        const groundStart = new THREE.Vector3(casterPos.x, casterPos.y + groundYOffset, 0);
        const groundEnd = new THREE.Vector3(targetPos.x, targetPos.y + groundYOffset, 0);
        const totalDist = groundStart.distanceTo(groundEnd);
        const nodeCount = Math.max(4, Math.min(12, Math.floor(totalDist / 48)));
        const nodes: any[] = [];
        const spikeWidth = Math.max(4, (track.preset?.spikeWidth || 10) * sc);
        const baseHeight = Math.max(30, (track.preset?.spikeHeight || 55) * sc);

        for (let i = 0; i < nodeCount; i++) {
          const ratio = nodeCount > 1 ? i / (nodeCount - 1) : 1;
          const pos = new THREE.Vector3().lerpVectors(groundStart, groundEnd, ratio);
          const nodeGroup = new THREE.Group();
          nodeGroup.position.copy(pos);

          const scaleFactor = 0.65 + ratio * 0.75;
          const curH = baseHeight * scaleFactor;
          const curW = spikeWidth * scaleFactor;
          const rockGeo = MeshLayerRenderer.createSpikeGeometry('JAGGED_ROCK', curW, curH);
          const rockMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(track.colorRim || '#94a3b8'),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
          });
          const rockMesh = new THREE.Mesh(rockGeo, rockMat);
          rockMesh.scale.set(0.1, 0.01, 0.1);
          nodeGroup.add(rockMesh);

          cache.fissureGroup.add(nodeGroup);
          nodes.push({ nodeGroup, rockMesh, rockMat, ratio, curH });
        }
        cache.fissureNodes = nodes;
        trackGroup.add(cache.fissureGroup);
      }
      cache.fissureGroup.visible = true;

      // 依進度 p 動態推進波浪尖岩
      cache.fissureNodes.forEach((item: any) => {
        const triggerP = item.ratio * 0.72;
        if (p < triggerP) {
          item.nodeGroup.visible = false;
        } else {
          item.nodeGroup.visible = true;
          const localP = Math.min(1.0, (p - triggerP) / 0.28);
          if (localP < 0.25) {
            const sp = localP / 0.25;
            item.rockMesh.scale.set(1, sp, 1);
            item.rockMat.opacity = 0.9;
          } else {
            const fade = Math.max(0, 1.0 - (localP - 0.25) / 0.75);
            item.rockMesh.scale.set(1, 1, 1);
            item.rockMat.opacity = fade * 0.9;
          }
        }
      });
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

    // 🏹 多彈道弧線散佈 (ARC_MULTI / 奧術飛彈)
    if (track.preset?.trajectory === 'ARC_MULTI' || track.spatialMode === 'ARC_MULTI') {
      const salvoCount = Math.max(3, track.preset?.salvoCount || 3);
      trackGroup.position.set(0, 0, 0);
      if (!cache.multiArcGroup) {
        cache.multiArcGroup = new THREE.Group();
        const arcs: any[] = [];
        for (let i = 0; i < salvoCount; i++) {
          const arcMesh = new THREE.Mesh(
            new THREE.SphereGeometry(6 * sc, 16, 16),
            new THREE.MeshBasicMaterial({
              color: new THREE.Color(track.colorRim || '#38bdf8'),
              transparent: true,
              opacity: 0.9,
              blending: THREE.AdditiveBlending
            })
          );
          const glow = this.createGlowSprite(track.colorRim || '#38bdf8', 26 * sc, 0.8);
          arcMesh.add(glow);
          cache.multiArcGroup.add(arcMesh);
          const spreadY = (i - (salvoCount - 1) / 2) * 55;
          arcs.push({ mesh: arcMesh, spreadY, delay: i * 0.06 });
        }
        cache.multiArcs = arcs;
        trackGroup.add(cache.multiArcGroup);
      }
      cache.multiArcGroup.visible = true;
      cache.multiArcs.forEach((item: any) => {
        const localP = Math.min(1.0, Math.max(0, (p - item.delay) / (1.0 - item.delay || 0.1)));
        if (localP <= 0 || localP >= 1.0) {
          item.mesh.visible = false;
          return;
        }
        item.mesh.visible = true;
        const midPoint = new THREE.Vector3(
          (casterPos.x + targetPos.x) / 2,
          (casterPos.y + targetPos.y) / 2 + item.spreadY,
          0
        );
        const oneMinusT = 1.0 - localP;
        const posX = oneMinusT * oneMinusT * casterPos.x + 2 * oneMinusT * localP * midPoint.x + localP * localP * targetPos.x;
        const posY = oneMinusT * oneMinusT * casterPos.y + 2 * oneMinusT * localP * midPoint.y + localP * localP * targetPos.y;
        item.mesh.position.set(posX, posY, 0);
      });
      return;
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
  // 🔮 菲涅爾冰晶發光 Shader (委派 MeshLayerRenderer)
  // ─────────────────────────────────────────────────────────────
  private createIceShaderMaterial(): THREE.ShaderMaterial {
    return MeshLayerRenderer.createIceShaderMaterial();
  }

  // ─────────────────────────────────────────────────────────────
  // ❄️ 1. 冰霜之矛 (Frost Lance)
  // ─────────────────────────────────────────────────────────────
  public playFrostLance(from: ScreenPoint, to: ScreenPoint, onHit?: () => void): void {
    const startPos = this.screenToWorld(from);
    const endPos = this.screenToWorld(to);
    const duration = 0.35;
    let elapsed = 0;

    const group = new THREE.Group();
    group.position.copy(startPos);
    group.lookAt(endPos);
    this.scene.add(group);

    // 1. 核心冰晶錐體
    const spearGeo = new THREE.ConeGeometry(10, 70, 8);
    spearGeo.rotateX(Math.PI / 2);
    const spearMat = this.createIceShaderMaterial();
    const spearMesh = new THREE.Mesh(spearGeo, spearMat);
    group.add(spearMesh);

    // 2. 外部螺旋冰晶環
    const ringGeo = new THREE.TorusGeometry(18, 2.5, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    // 3. 拖尾粒子
    const trailCount = 35;
    const trailGeo = new THREE.BufferGeometry();
    const trailPositions = new Float32Array(trailCount * 3);
    for (let i = 0; i < trailCount; i++) {
      trailPositions[i * 3] = startPos.x;
      trailPositions[i * 3 + 1] = startPos.y;
      trailPositions[i * 3 + 2] = startPos.z;
    }
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    const trailMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 10,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const trailPoints = new THREE.Points(trailGeo, trailMat);
    this.scene.add(trailPoints);

    let trailIdx = 0;

    const effect: ActiveEffect = {
      update: (delta) => {
        elapsed += delta;
        const progress = Math.min(elapsed / duration, 1);

        group.position.lerpVectors(startPos, endPos, progress);
        spearMesh.rotateZ(delta * 22);
        ringMesh.rotateZ(-delta * 28);

        const posAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let k = 0; k < 3; k++) {
          const idx = (trailIdx + k) % trailCount;
          posAttr.setXYZ(
            idx,
            group.position.x + (Math.random() - 0.5) * 14,
            group.position.y + (Math.random() - 0.5) * 14,
            group.position.z + (Math.random() - 0.5) * 14
          );
        }
        trailIdx = (trailIdx + 3) % trailCount;
        posAttr.needsUpdate = true;

        if (progress >= 1) {
          if (onHit) onHit();
          this.spawnIceCrystalBlast(endPos);
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        this.scene.remove(trailPoints);
        spearGeo.dispose();
        spearMat.dispose();
        ringGeo.dispose();
        ringMat.dispose();
        trailGeo.dispose();
        trailMat.dispose();
      }
    };

    this.activeEffects.push(effect);
  }

  private spawnIceCrystalBlast(pos: THREE.Vector3): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    this.scene.add(group);

    // 8 根放射狀 3D 尖銳冰刺
    const spikeCount = 8;
    const spikeMeshes: THREE.Mesh[] = [];
    const spikeGeo = new THREE.ConeGeometry(8, 55, 6);
    spikeGeo.rotateX(Math.PI / 2);
    const spikeMat = this.createIceShaderMaterial();

    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const mesh = new THREE.Mesh(spikeGeo, spikeMat);
      mesh.position.set(Math.cos(angle) * 10, Math.sin(angle) * 10, 0);
      mesh.rotation.z = angle - Math.PI / 2;
      mesh.scale.set(0.1, 0.1, 0.1);
      group.add(mesh);
      spikeMeshes.push(mesh);
    }

    // 60 顆高光碎裂冰晶
    const particleCount = 60;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const vels: THREE.Vector3[] = [];
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 340 + 120;
      vels.push(new THREE.Vector3(Math.cos(angle) * spd, Math.sin(angle) * spd, (Math.random() - 0.5) * 80));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 14,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    let life = 0.55;
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        const progress = 1 - Math.max(0, life / 0.55);

        const spikeScale = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;
        spikeMeshes.forEach(m => m.scale.set(spikeScale, spikeScale, spikeScale));

        const attr = geo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          attr.setXYZ(i, attr.getX(i) + vels[i].x * delta, attr.getY(i) + vels[i].y * delta, attr.getZ(i) + vels[i].z * delta);
        }
        attr.needsUpdate = true;
        mat.opacity = Math.max(0, life / 0.55);

        return life <= 0;
      },
      dispose: () => {
        this.scene.remove(group);
        this.scene.remove(points);
        spikeGeo.dispose();
        spikeMat.dispose();
        geo.dispose();
        mat.dispose();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ⚡ 2. 風暴狂雷 (Storm Bolt)
  // ─────────────────────────────────────────────────────────────
  public playStormBolt(target: ScreenPoint, onHit?: () => void): void {
    const targetPos = this.screenToWorld(target);
    const group = new THREE.Group();
    this.scene.add(group);

    const boltCount = 3;
    const meshes: THREE.Mesh[] = [];

    for (let b = 0; b < boltCount; b++) {
      const startSky = new THREE.Vector3(
        targetPos.x + (Math.random() - 0.5) * 120,
        targetPos.y + 380,
        0
      );

      const segments = 14;
      const pts: THREE.Vector3[] = [startSky];
      for (let i = 1; i < segments; i++) {
        const alpha = i / segments;
        const base = new THREE.Vector3().lerpVectors(startSky, targetPos, alpha);
        const jagged = (Math.random() - 0.5) * (b === 0 ? 60 : 40);
        pts.push(new THREE.Vector3(base.x + jagged, base.y, base.z));
      }
      pts.push(targetPos);

      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 28, b === 0 ? 6 : 3, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: b === 0 ? 0xffffff : 0x38bdf8,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending
      });
      const boltMesh = new THREE.Mesh(tubeGeo, tubeMat);
      group.add(boltMesh);
      meshes.push(boltMesh);
    }

    if (onHit) onHit();
    this.spawnLightningShockwave(targetPos);

    let life = 0.28;
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        meshes.forEach(m => {
          (m.material as THREE.MeshBasicMaterial).opacity = Math.random() > 0.2 ? 1 : 0.3;
        });
        return life <= 0;
      },
      dispose: () => {
        this.scene.remove(group);
        meshes.forEach(m => {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        });
      }
    });
  }

  private spawnLightningShockwave(pos: THREE.Vector3): void {
    const ringGeo = new THREE.RingGeometry(8, 26, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    this.scene.add(ring);

    const count = 50;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 320 + 120;
      vels.push(new THREE.Vector3(Math.cos(angle) * spd, Math.sin(angle) * spd, 0));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 12,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    let life = 0.45;
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        const progress = 1 - Math.max(0, life / 0.45);
        ring.scale.set(1 + progress * 7, 1 + progress * 7, 1);
        ringMat.opacity = Math.max(0, 1 - progress);

        const attr = geo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < count; i++) {
          attr.setXY(i, attr.getX(i) + vels[i].x * delta, attr.getY(i) + vels[i].y * delta);
        }
        attr.needsUpdate = true;
        mat.opacity = Math.max(0, life / 0.45);

        return life <= 0;
      },
      dispose: () => {
        this.scene.remove(ring);
        this.scene.remove(points);
        ringGeo.dispose();
        ringMat.dispose();
        geo.dispose();
        mat.dispose();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ☄️ 3. 灰燼流星 (Cinder Fall)
  // ─────────────────────────────────────────────────────────────
  public playCinderFall(target: ScreenPoint, onHit?: () => void): void {
    const endPos = this.screenToWorld(target);
    const startPos = new THREE.Vector3(endPos.x + 220, endPos.y + 380, 80);
    const duration = 0.45;
    let elapsed = 0;

    const group = new THREE.Group();
    group.position.copy(startPos);
    this.scene.add(group);

    const outerGeo = new THREE.SphereGeometry(28, 16, 16);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    group.add(outer);

    const coreGeo = new THREE.SphereGeometry(16, 12, 12);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      blending: THREE.AdditiveBlending
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    group.add(core);

    const effect: ActiveEffect = {
      update: (delta) => {
        elapsed += delta;
        const progress = Math.min(elapsed / duration, 1);
        group.position.lerpVectors(startPos, endPos, progress);

        if (progress >= 1) {
          if (onHit) onHit();
          this.spawnCinderExplosion(endPos);
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        outerGeo.dispose();
        outerMat.dispose();
        coreGeo.dispose();
        coreMat.dispose();
      }
    };

    this.activeEffects.push(effect);
  }

  private spawnCinderExplosion(pos: THREE.Vector3): void {
    const ringGeo = new THREE.RingGeometry(10, 32, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    this.scene.add(ring);

    const count = 70;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 360 + 140;
      vels.push(new THREE.Vector3(Math.cos(angle) * spd, Math.sin(angle) * spd + 40, (Math.random() - 0.5) * 60));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 16,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    const sparks = new THREE.Points(geo, mat);
    this.scene.add(sparks);

    let life = 0.6;
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        const progress = 1 - Math.max(0, life / 0.6);
        ring.scale.set(1 + progress * 8, 1 + progress * 8, 1);
        ringMat.opacity = Math.max(0, 1 - progress);

        const attr = geo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < count; i++) {
          attr.setXYZ(i, attr.getX(i) + vels[i].x * delta, attr.getY(i) + vels[i].y * delta, attr.getZ(i) + vels[i].z * delta);
        }
        attr.needsUpdate = true;
        mat.opacity = Math.max(0, life / 0.6);

        return life <= 0;
      },
      dispose: () => {
        this.scene.remove(ring);
        this.scene.remove(sparks);
        ringGeo.dispose();
        ringMat.dispose();
        geo.dispose();
        mat.dispose();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 💫 4. 新星光束 (Nova Beam)
  // ─────────────────────────────────────────────────────────────
  public playNovaBeam(from: ScreenPoint, to: ScreenPoint, onHit?: () => void): void {
    const startPos = this.screenToWorld(from);
    const endPos = this.screenToWorld(to);
    const dir = new THREE.Vector3().subVectors(endPos, startPos);
    const length = dir.length();

    const group = new THREE.Group();
    group.position.copy(startPos);
    group.lookAt(endPos);
    this.scene.add(group);

    const innerGeo = new THREE.CylinderGeometry(6, 6, length, 16);
    innerGeo.rotateZ(Math.PI / 2);
    innerGeo.translate(length / 2, 0, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    group.add(inner);

    const outerGeo = new THREE.CylinderGeometry(20, 20, length, 16);
    outerGeo.rotateZ(Math.PI / 2);
    outerGeo.translate(length / 2, 0, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    group.add(outer);

    if (onHit) onHit();

    let life = 0.45;
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        const progress = Math.max(0, life / 0.45);
        inner.scale.set(progress, 1, progress);
        outer.scale.set(progress, 1, progress);
        outerMat.opacity = progress * 0.8;
        return life <= 0;
      },
      dispose: () => {
        this.scene.remove(group);
        innerGeo.dispose();
        innerMat.dispose();
        outerGeo.dispose();
        outerMat.dispose();
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 🗡️ 5. 3D 半月刃 (Blade Slash)
  // ─────────────────────────────────────────────────────────────
  public playBladeSlash(target: ScreenPoint, onHit?: () => void): void {
    const targetPos = this.screenToWorld(target);

    const curve = new THREE.EllipseCurve(0, 0, 80, 80, 0, Math.PI * 0.8, false, 0);
    const points = curve.getPoints(24);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 8,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending
    });
    const arc = new THREE.Line(geo, mat);
    arc.position.copy(targetPos);
    arc.rotation.z = -Math.PI / 4;
    this.scene.add(arc);

    if (onHit) onHit();

    let life = 0.3;
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        arc.scale.addScalar(delta * 5);
        mat.opacity = Math.max(0, life / 0.3);
        return life <= 0;
      },
      dispose: () => {
        this.scene.remove(arc);
        geo.dispose();
        mat.dispose();
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
    const startPos = this.screenToWorld(from);
    let endPos = this.screenToWorld(to);
    const preset = this.getPreset(vfxId) || this.getPreset('VFX_DEFAULT_SLASH') || (defaultVFXPresets[0] as unknown as VFXPreset);
    return this.playPresetWorld(preset, startPos, endPos, isPlayerOrOnImpact, onImpactCallback);
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
   * 🌍 核心世界座標播放管線（避免子圖層重複 screenToWorld 轉換）
   */
  public playPresetWorld(
    preset: VFXPreset,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    isPlayerOrOnImpact?: boolean | ((impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void),
    onImpactCallback?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number, cue?: VFXImpactCue) => void
  ): Promise<void> {
    const isPlayer = typeof isPlayerOrOnImpact === 'boolean' ? isPlayerOrOnImpact : true;
    const onImpact = typeof isPlayerOrOnImpact === 'function' ? isPlayerOrOnImpact : onImpactCallback;

    return new Promise((resolve) => {
      const impactConfig = preset.impact;
      const hasCues = Array.isArray(preset.impactCues) && preset.impactCues.length > 0;
      const totalHits = hasCues ? preset.impactCues!.length : Math.max(1, preset.hitCount || preset.salvoCount || 1);
      const firedHits = new Set<number>();
      let resolved = false;

      const fireImpact = (hitIdx: number = 0, cue?: VFXImpactCue) => {
        if (!firedHits.has(hitIdx)) {
          firedHits.add(hitIdx);
          if (onImpact && !(preset as any).muteImpact) {
            onImpact(impactConfig, hitIdx, totalHits, cue);
          }
        }
      };

      const curGen = this.playbackGeneration;
      this.playbackClock.setDuration(preset.duration);
      this.playbackClock.setSpeed(this.playbackSpeed);

      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          if (failsafeTimer) clearTimeout(failsafeTimer);
          if (hasCues) {
            preset.impactCues!.forEach((cue, k) => fireImpact(k, cue));
          } else {
            for (let k = 0; k < totalHits; k++) {
              fireImpact(k);
            }
          }
          resolve();
        }
      };

      // Failsafe: 物理牆時鐘防護，確保遇極端異常時流程不永久掛起
      const failsafeWallMs = Math.max(1200, ((preset.duration + 0.8) / this.playbackSpeed) * 1000);
      const failsafeTimer = setTimeout(() => {
        if (this.playbackGeneration === curGen && !resolved) {
          safeResolve();
        }
      }, failsafeWallMs);
      this.scheduledTimers.add(failsafeTimer);

      let actualEndPos = endPos.clone();
      if (preset.trajectory === 'COLUMN_PIERCE' && impactConfig.penetrationDistance > 0) {
        const dir = new THREE.Vector3().subVectors(actualEndPos, startPos).normalize();
        actualEndPos = actualEndPos.addScaledVector(dir, impactConfig.penetrationDistance);
      }

      // 🔮 複合多圖層特效排程 (Composite VFX Preset Sequencer)
      if (preset.layers && preset.layers.length > 0) {
        preset.layers.forEach((layer) => {
          const delaySec = Math.max(0, layer.delay || 0.1);
          this.playbackClock.schedule(delaySec, () => {
            if (this.isRunning && this.playbackGeneration === curGen) {
              if (layer.presetId) {
                const subPreset = this.getPreset(layer.presetId);
                if (subPreset) {
                  // 🧩 積木式引用庫中任一現有 Preset，直傳已轉換之世界座標！
                  this.playPresetWorld(
                    subPreset,
                    startPos,
                    actualEndPos,
                    isPlayer,
                    (layer.emitsImpactCue || layer.generatesHit) ? (imp, hIdx, tHits) => onImpact?.(imp, hIdx, tHits) : undefined
                  );
                }
                return;
              }

              const layerPreset: VFXPreset = {
                ...preset,
                trajectory: layer.trajectory || preset.trajectory,
                shaderMode: layer.shaderMode || preset.shaderMode,
                colorCore: layer.colorCore || preset.colorCore,
                colorRim: layer.colorRim || preset.colorRim,
                scale: (layer.scale || 1) * preset.scale,
                duration: layer.duration || preset.duration,
                layers: undefined
              };
              if (layer.trajectory === 'GROUND_FISSURE') {
                this.playGroundFissure(startPos, actualEndPos, layerPreset, () => {}, () => {});
              } else if (layer.trajectory === 'MELEE_SWEEP' || layer.shaderMode === 'SLASH_BLADE') {
                this.playArcSlash(actualEndPos, layerPreset, () => {}, () => {});
              } else if (layer.trajectory === 'VERTICAL_DROP') {
                this.playHolyPillar(actualEndPos, layerPreset, () => {}, () => {});
              } else if (layer.shaderMode === 'DIELECTRIC_LIGHTNING') {
                const layerTraj = (layer.trajectory || '') as string;
                const lightningStart = (layerTraj === 'VERTICAL_DROP' || layerTraj === 'VERTICAL_SKY_TO_B')
                  ? new THREE.Vector3(actualEndPos.x, actualEndPos.y + 380, 0)
                  : startPos;
                this.playDynamicLightning(lightningStart, actualEndPos, layerPreset, () => {}, () => {});
              } else if (layer.shaderMode === 'ENERGY_BEAM' || layer.trajectory === 'COLUMN_PIERCE') {
                this.playDynamicBeam(startPos, actualEndPos, layerPreset, () => {}, () => {});
              } else {
                this.playDynamicProjectile(startPos, actualEndPos, layerPreset, () => {}, () => {});
              }
            }
          });
        });
      }

      // 🎯 具名 Impact Cue 時間軸排程器 (優先級高於傳統連擊曲線)
      if (hasCues) {
        preset.impactCues!.forEach((cue, cueIdx) => {
          this.playbackClock.schedule(Math.max(0, cue.time), () => {
            if (this.isRunning && this.playbackGeneration === curGen) {
              fireImpact(cueIdx, cue);
              this.playSlashSparks(actualEndPos, preset.colorCore, 8);
            }
          });
        });
      } else if (totalHits > 1) {
        // 🚀 多段連擊排程發射 (Salvo & Multi-Hit Scheduler)
        const salvoDur = preset.salvoDuration || Math.min(preset.duration * 0.85, 0.45);
        for (let i = 0; i < totalHits; i++) {
          const ratio = totalHits > 1 ? i / (totalHits - 1) : 0;
          let timeOffset = ratio * salvoDur;
          if (preset.salvoRhythmCurve === 'ACCELERATE') {
            timeOffset = Math.pow(ratio, 1.8) * salvoDur;
          } else if (preset.salvoRhythmCurve === 'DECELERATE') {
            timeOffset = Math.sqrt(ratio) * salvoDur;
          } else if (preset.salvoRhythmCurve === 'BURST_PAIRS') {
            const pairIdx = Math.floor(i / 2);
            const inPair = i % 2;
            timeOffset = pairIdx * (salvoDur * 0.6) + inPair * 0.06;
          }

          const triggerTimeSec = timeOffset + Math.min(preset.duration * 0.4, 0.2);
          this.playbackClock.schedule(triggerTimeSec, () => {
            if (this.isRunning && this.playbackGeneration === curGen) {
              fireImpact(i);
              // 每次連擊在受擊點爆散微型火花
              this.playSlashSparks(actualEndPos, preset.colorCore, 6);
            }
          });
        }
      }

      // 🌟 核心：統一確定性影格主視覺求值管線 (Deterministic Unified Frame Evaluator)
      // 遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 3.2 節與第 14 節規範：
      // 連續播放與時間軸定格在物理層面 100% 共享相同的 renderFrameWorldAt 求值核心，徹底消除雙軌分裂
      if ((preset as any).muteMain) {
        this.playbackClock.schedule(preset.duration, () => {
          safeResolve();
        });
      } else {
        let effectElapsed = 0;
        const totalDuration = Math.max(0.05, preset.duration || 0.4);

        this.activeEffects.push({
          update: (delta) => {
            if (this.playbackGeneration !== curGen) return true;
            effectElapsed += delta;
            this.renderFrameWorldAt(preset, effectElapsed, startPos, actualEndPos);
            if (effectElapsed >= totalDuration) {
              safeResolve();
              return true;
            }
            return false;
          },
          dispose: () => {
            if (this.playbackGeneration === curGen) {
              this.clearStudioPreview();
            }
          }
        });
      }
    });
  }

  /**
   * 💥 公開受擊點破空火花與星芒爆散 (供時間軸與 Cue 點觸發)
   */
  public playCueSparks(pos: THREE.Vector3, colorHex: string = '#f59e0b', count = 12): void {
    this.playSlashSparks(pos, colorHex, count);
  }

  /**
   * 💥 受擊點破空火花與星芒爆散 (Slash Impact Sparks)
   */
  private playSlashSparks(pos: THREE.Vector3, colorHex: string, count = 16): void {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
      const speed = 120 + Math.random() * 180;
      velocities.push({
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
        z: (Math.random() - 0.5) * 60
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(colorHex),
      size: 7,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);

    let sparkElapsed = 0;
    const sparkDuration = 0.22;

    this.activeEffects.push({
      update: (delta) => {
        sparkElapsed += delta;
        const prog = Math.min(sparkElapsed / sparkDuration, 1);
        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;

        for (let i = 0; i < count; i++) {
          const v = velocities[i];
          posAttr.setXYZ(
            i,
            pos.x + v.x * sparkElapsed,
            pos.y + v.y * sparkElapsed,
            pos.z + v.z * sparkElapsed
          );
        }
        posAttr.needsUpdate = true;
        mat.opacity = (1 - prog) * 0.9;

        if (prog >= 1) {
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(points);
        geo.dispose();
        mat.dispose();
      }
    });
  }

  /**
   * ⚔️ 次世代動態破空劍氣生長 Mesh 幾何體生成器 (Dynamic Blade Ribbon)
   * 具備中心貫穿平移校準與內弧淡出漸層！
   */
  private buildDynamicSlashGeo(
    radius: number,
    bladeWidth: number,
    headAngle: number,
    tailAngle: number,
    centerAngle: number,
    aspect: number = 1.0
  ): THREE.BufferGeometry {
    return MeshLayerRenderer.buildDynamicSlashGeo(radius, bladeWidth, headAngle, tailAngle, centerAngle, aspect);
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
        currentGeo = this.buildDynamicSlashGeo(
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
            crossGeo = this.buildDynamicSlashGeo(
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
            crossGeo = this.buildDynamicSlashGeo(
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
    const group = MeshLayerRenderer.buildHolyShieldGroup(sc, preset.colorCore || '#fde047', preset.colorRim || '#eab308');
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
    const group = MeshLayerRenderer.buildTauntShoutGroup(3, preset.colorRim || '#ef4444');
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
   * 🏹 弓兵拋物齊射與箭塔齊射 (Arrow Volley)
   */
  private playArrowVolley(
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const group = new THREE.Group();
    this.scene.add(group);

    const arrowCount = 9;
    const arrowMeshes: { mesh: THREE.Mesh; p0: THREE.Vector3; p1: THREE.Vector3; p2: THREE.Vector3; delay: number }[] = [];
    const arrowGeo = new THREE.ConeGeometry(2.5 * preset.scale, 24 * preset.scale, 5);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.colorRim),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < arrowCount; i++) {
      const mesh = new THREE.Mesh(arrowGeo, arrowMat);
      mesh.visible = false;
      group.add(mesh);

      const p0 = new THREE.Vector3(fromPos.x + (Math.random() - 0.5) * 40, fromPos.y + (Math.random() - 0.5) * 30, 0);
      const p2 = new THREE.Vector3(toPos.x + (Math.random() - 0.5) * 60, toPos.y + (Math.random() - 0.5) * 40, 0);
      const midX = (p0.x + p2.x) / 2;
      const midY = Math.max(p0.y, p2.y) + 140 + Math.random() * 40;
      const p1 = new THREE.Vector3(midX, midY, 0);

      arrowMeshes.push({ mesh, p0, p1, p2, delay: i * 0.03 });
    }

    let elapsed = 0;
    let hitFired = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        let allDone = true;

        arrowMeshes.forEach(item => {
          const tLocal = (elapsed - item.delay) / (preset.duration * 0.85);
          if (tLocal < 0) {
            allDone = false;
            return;
          }
          if (tLocal >= 1) {
            item.mesh.visible = false;
            return;
          }

          allDone = false;
          item.mesh.visible = true;

          // 二次貝茲曲線 (Quadratic Bezier)
          const t = tLocal;
          const oneMinusT = 1 - t;
          const curPos = new THREE.Vector3(
            oneMinusT * oneMinusT * item.p0.x + 2 * oneMinusT * t * item.p1.x + t * t * item.p2.x,
            oneMinusT * oneMinusT * item.p0.y + 2 * oneMinusT * t * item.p1.y + t * t * item.p2.y,
            0
          );
          item.mesh.position.copy(curPos);

          // 切線方向 (Tangent)
          const tangent = new THREE.Vector3(
            2 * (1 - t) * (item.p1.x - item.p0.x) + 2 * t * (item.p2.x - item.p1.x),
            2 * (1 - t) * (item.p1.y - item.p0.y) + 2 * t * (item.p2.y - item.p1.y),
            0
          ).normalize();
          item.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
        });

        if (!hitFired && elapsed >= preset.duration * 0.6) {
          hitFired = true;
          onHit();
        }

        if (allDone && elapsed >= preset.duration) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        arrowGeo.dispose();
        arrowMat.dispose();
      }
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
   * 🔥 體積黑體輻射火焰動態著色器 (委派 MeshLayerRenderer)
   */
  private createVolumetricFlameMaterial(colorCoreHex: string, colorRimHex: string, coreBrightness = 1.0, turbulence = 5.0, speed = 2.0): THREE.ShaderMaterial {
    return MeshLayerRenderer.createVolumetricFlameMaterial(colorCoreHex, colorRimHex, turbulence, speed);
  }

  private createFresnelShaderMaterial(colorCoreHex: string, colorRimHex: string, fresnelVal = 2.0): THREE.ShaderMaterial {
    return MeshLayerRenderer.createFresnelShaderMaterial(colorCoreHex, colorRimHex, fresnelVal);
  }

  /**
   * ❄️ 命中點次生冰刺/晶刺破裂爆發 (Secondary Spikes Burst - 支援多幾何形態)
   */
  private spawnSecondarySpikes(pos: THREE.Vector3, count: number, height: number, colorRimHex: string, preset?: VFXPreset): void {
    const group = new THREE.Group();
    // 🎯 腳底貼地原點校考：若角度向上沖天 (45°~135°) 或為地表破土，原點自動下沉至目標腳底地面 (pos.y - 65)！
    const isUpward = (preset?.spikeAngle !== undefined && preset.spikeAngle >= 45 && preset.spikeAngle <= 135) || (preset?.trajectory === 'GROUND_BURST') || (preset?.trajectory === 'GROUND_FISSURE');
    const basePos = pos.clone();
    if (isUpward) {
      basePos.y -= 65;
    }
    group.position.copy(basePos);
    this.scene.add(group);

    const isPhong = preset?.spikeMaterialMode !== 'BASIC';
    if (isPhong) {
      const ambient = new THREE.AmbientLight(0x94a3b8, 0.9);
      const dir = new THREE.DirectionalLight(0xfff1e6, 1.5);
      dir.position.set(50, 150, 100);
      group.add(ambient);
      group.add(dir);
    }

    const spikeItems: { mesh: THREE.Mesh; mat: THREE.Material; delay: number; heightVar?: number; fireMesh?: THREE.Mesh }[] = [];
    const width = Math.max(3, (preset?.spikeWidth || 7) * (preset?.scale || 1.0));
    const finalHeight = Math.max(20, height);
    const shape = preset?.spikeShape || 'CONE_SPIKE';
    const spreadRadius = preset?.spikeRadius !== undefined ? preset.spikeRadius : 80;
    const staggerMs = preset?.spikeStagger !== undefined ? preset.spikeStagger : 25;
    const staggerSec = staggerMs / 1000;

    const spikeGeo = MeshLayerRenderer.createSpikeGeometry(shape as any, width, finalHeight);

    const isDirectional = (preset?.spikeAngle !== undefined && preset.spikeAngle > 0);
    const baseRad = isDirectional ? ((preset!.spikeAngle! * Math.PI) / 180) : 0;

    // 🎲 亂數洗牌先後破土順序（告別死板流水線順序，呈現真實崩裂爆發感）
    const orderIndices = Array.from({ length: count }, (_, idx) => idx);
    for (let i = orderIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = orderIndices[i];
      orderIndices[i] = orderIndices[j];
      orderIndices[j] = temp;
    }

    const eruptFire = preset?.spikeEruptFire || preset?.shaderMode === 'VOLUMETRIC_FIRE';

    for (let i = 0; i < count; i++) {
      let angle: number;
      let posX = 0;
      let posY = 0;
      const posZ = (Math.random() - 0.5) * 16;

      if (isUpward) {
        // 🌊 向上沖天/地表破土模式：沿著地表水平線大範圍橫向排開！
        const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
        posX = t * spreadRadius * 1.8;
        posY = (Math.random() - 0.5) * 6;
        const tilt = t * 0.45;
        angle = (preset?.spikeAngle !== undefined ? ((preset.spikeAngle * Math.PI) / 180) : Math.PI / 2) + tilt;
      } else if (isDirectional) {
        const span = 0.65;
        angle = baseRad + (count > 1 ? (i / (count - 1) - 0.5) * span : 0);
        const dist = (spreadRadius * 0.35) * (0.6 + (i / Math.max(1, count)) * 0.5);
        posX = Math.cos(angle) * dist;
        posY = Math.sin(angle) * dist;
      } else {
        angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const dist = (spreadRadius * 0.45) * (0.7 + Math.random() * 0.6);
        posX = Math.cos(angle) * dist;
        posY = Math.sin(angle) * dist;
      }

      const spikeMat = isPhong
        ? new THREE.MeshPhongMaterial({
            color: new THREE.Color(colorRimHex),
            specular: new THREE.Color(0xffffff),
            shininess: 24,
            flatShading: true,
            transparent: true,
            opacity: 0,
            depthWrite: false
          })
        : new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorRimHex),
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
          });

      const mesh = new THREE.Mesh(spikeGeo, spikeMat);
      mesh.position.set(posX, posY, posZ);
      mesh.rotation.z = angle - Math.PI / 2;
      mesh.scale.set(0.001, 0.001, 0.001);
      group.add(mesh);

      // 伴生地火噴發
      let fireMesh: THREE.Mesh | undefined;
      if (eruptFire) {
        const fGeo = new THREE.ConeGeometry(width * 1.1, finalHeight * 1.25, 6);
        fGeo.translate(0, finalHeight * 0.62, 0);
        const fMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(preset?.colorCore || '#ff6600'),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending
        });
        fireMesh = new THREE.Mesh(fGeo, fMat);
        fireMesh.position.set(posX, posY, posZ + 2);
        fireMesh.rotation.z = angle - Math.PI / 2;
        fireMesh.scale.set(0.001, 0.001, 0.001);
        group.add(fireMesh);
      }

      const delay = orderIndices[i] * staggerSec;
      const heightVar = 0.82 + Math.random() * 0.36;
      spikeItems.push({ mesh, mat: spikeMat, delay, heightVar, fireMesh });
    }

    let elapsed = 0;
    const spikeDuration = 0.38;
    const totalDuration = (count * staggerSec) + spikeDuration + 0.1;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        let allDone = true;

        spikeItems.forEach(item => {
          if (elapsed < item.delay) {
            item.mesh.scale.set(0.001, 0.001, 0.001);
            item.mat.opacity = 0;
            if (item.fireMesh) {
              item.fireMesh.scale.set(0.001, 0.001, 0.001);
              (item.fireMesh.material as THREE.Material).opacity = 0;
            }
            allDone = false;
            return;
          }

          const age = elapsed - item.delay;
          if (age < spikeDuration) {
            allDone = false;
            const prog = age / spikeDuration;
            const sc = prog < 0.22 ? (prog / 0.22) : 1 - (prog - 0.22) / 0.78 * 0.35;
            item.mesh.scale.set(sc, sc * (item as any).heightVar, sc);
            item.mat.opacity = Math.max(0, 1 - (prog - 0.25) / 0.75);

            if (item.fireMesh) {
              item.fireMesh.scale.set(sc * 1.2, sc * (item as any).heightVar * 1.3, sc * 1.2);
              (item.fireMesh.material as THREE.Material).opacity = Math.max(0, 1 - (prog - 0.2) / 0.8);
            }
          } else {
            item.mesh.scale.set(0.001, 0.001, 0.001);
            item.mat.opacity = 0;
            if (item.fireMesh) {
              item.fireMesh.scale.set(0.001, 0.001, 0.001);
              (item.fireMesh.material as THREE.Material).opacity = 0;
            }
          }
        });

        return elapsed >= totalDuration || allDone;
      },
      dispose: () => {
        this.scene.remove(group);
        spikeGeo.dispose();
        spikeItems.forEach(item => {
          item.mat.dispose();
          if (item.fireMesh) {
            item.fireMesh.geometry.dispose();
            (item.fireMesh.material as THREE.Material).dispose();
          }
        });
      }
    });
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
        pos.y += (Math.random() - 0.5) * 12;
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
    if (trajMode === 'VERTICAL_DROP' || trajMode === 'VERTICAL_SKY_TO_B') {
      actualStart = new THREE.Vector3(endPos.x, endPos.y + 380, 0);
    } else if (trajMode === 'DIAGONAL_DROP' || trajMode === 'DIAGONAL_SKY_TO_B') {
      actualStart = new THREE.Vector3(endPos.x - 260, endPos.y + 380, 0);
    } else if (trajMode === 'GROUND_BURST') {
      actualStart = new THREE.Vector3(endPos.x, endPos.y - 120, 0);
    }

    const group = new THREE.Group();
    group.position.copy(actualStart);
    this.scene.add(group);

    const sc = preset.scale || 1.0;
    let coreMesh: THREE.Object3D;

    let flameMat: THREE.ShaderMaterial | null = null;

    if (preset.shaderMode === 'FRESNEL_ICE') {
      const coneGeo = new THREE.ConeGeometry(9 * sc, 50 * sc, 8);
      coneGeo.rotateX(Math.PI / 2);
      const mat = this.createFresnelShaderMaterial(preset.colorCore, preset.colorRim, preset.fresnel || 2.0);
      coreMesh = new THREE.Mesh(coneGeo, mat);
      group.lookAt(endPos);
    } else if (preset.shaderMode === 'VOLUMETRIC_FIRE' || preset.shaderMode === 'DARK_VOID') {
      const sphereGeo = new THREE.SphereGeometry(16 * sc, 32, 32);
      flameMat = this.createVolumetricFlameMaterial(
        preset.colorCore,
        preset.colorRim,
        preset.coreBrightness || 1.0,
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
      const coneGeo = new THREE.ConeGeometry(5 * sc, 35 * sc, 6);
      coneGeo.rotateX(Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(preset.colorRim),
        transparent: true,
        blending: THREE.AdditiveBlending
      });
      coreMesh = new THREE.Mesh(coneGeo, mat);
      group.lookAt(endPos);
    }
    group.add(coreMesh);

    // 動態拖尾粒子系統 (Trail Emitter)
    const trailCount = Math.min(50, Math.max(10, preset.trailCount || 30));
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(trailCount * 3);
    for (let i = 0; i < trailCount; i++) {
      trailPos[i * 3] = actualStart.x;
      trailPos[i * 3 + 1] = actualStart.y;
      trailPos[i * 3 + 2] = actualStart.z;
    }
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    const trailMat = new THREE.PointsMaterial({
      color: new THREE.Color(preset.colorRim),
      size: (preset.trailSize || 8) * sc,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    const trailPoints = new THREE.Points(trailGeo, trailMat);
    this.scene.add(trailPoints);
    let trailIdx = 0;

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

        // 動態拋灑拖尾粒子
        const posAttr = trailGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let k = 0; k < 2; k++) {
          const idx = (trailIdx + k) % trailCount;
          posAttr.setXYZ(
            idx,
            curPos.x + (Math.random() - 0.5) * 12 * sc,
            curPos.y + (Math.random() - 0.5) * 12 * sc,
            curPos.z + (Math.random() - 0.5) * 12 * sc
          );
        }
        trailIdx = (trailIdx + 2) % trailCount;
        posAttr.needsUpdate = true;

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
        this.scene.remove(trailPoints);
        trailGeo.dispose();
        trailMat.dispose();
      }
    });
  }

  /**
   * ⚡ 動態雷擊電弧管線
   */
  private playDynamicLightning(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const segCount = 14;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segCount; i++) {
      const t = i / segCount;
      const pt = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      if (i > 0 && i < segCount) {
        pt.x += (Math.random() - 0.5) * 55;
        pt.y += (Math.random() - 0.5) * 55;
      }
      points.push(pt);
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, segCount, 4.5 * (preset.scale || 1.0), 6, false);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.colorCore),
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    this.scene.add(mesh);

    onHit();
    if (preset.spikes && preset.spikes > 0) {
      this.spawnSecondarySpikes(endPos, preset.spikes, preset.spikeHeight || 40, preset.colorRim);
    }
    this.spawnDynamicImpactBurst(endPos, preset);

    let life = Math.max(0.15, (preset.duration || 0.3) * 0.6);
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        mat.opacity = Math.max(0, life / 0.2);
        if (life <= 0) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(mesh);
        geo.dispose();
        mat.dispose();
      }
    });
  }

  /**
   * 💫 動態高能射線管線
   */
  private playDynamicBeam(
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    preset: VFXPreset,
    onHit: () => void,
    onComplete: () => void
  ): void {
    const dist = startPos.distanceTo(endPos);
    const group = new THREE.Group();
    group.position.copy(startPos);
    group.lookAt(endPos);
    this.scene.add(group);

    const sc = preset.scale || 1.0;
    const innerGeo = new THREE.CylinderGeometry(4 * sc, 4 * sc, dist, 12);
    innerGeo.rotateZ(Math.PI / 2);
    innerGeo.translate(dist / 2, 0, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.colorCore),
      blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(innerGeo, innerMat));

    const outerGeo = new THREE.CylinderGeometry(14 * sc, 14 * sc, dist, 12);
    outerGeo.rotateZ(Math.PI / 2);
    outerGeo.translate(dist / 2, 0, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.colorRim),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(outerGeo, outerMat));

    onHit();
    this.spawnDynamicImpactBurst(endPos, preset);

    let life = Math.max(0.18, (preset.duration || 0.3) * 0.7);
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        const progress = Math.max(0, life / 0.3);
        group.scale.set(1, progress, progress);
        outerMat.opacity = progress * 0.85;
        if (life <= 0) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        innerGeo.dispose();
        innerMat.dispose();
        outerGeo.dispose();
        outerMat.dispose();
      }
    });
  }
}
