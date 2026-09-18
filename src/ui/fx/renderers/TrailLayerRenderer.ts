import * as THREE from 'three';
import { defaultVfxRng } from '../VFXRng';
import { VFX_RENDER_ORDER } from '../VFXSpatialPolicy';

export interface TrailInstance {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  positions: Float32Array;
  count: number;
  currentIndex: number;
  update: (currentPos: THREE.Vector3) => void;
  updateArcTrail?: (tipSampler: (prog: number) => THREE.Vector3, currentProgress: number, spreadWidth?: number, strands?: number) => void;
  updateTrajectoryTrail?: (startPos: THREE.Vector3, curPos: THREE.Vector3, progress: number, arcHeight?: number, spreadWidth?: number, strands?: number) => void;
  updateStyle?: (colorHex: string, size: number, currentScale?: number) => void;
  dispose: () => void;
}

export interface BurstCloudInstance {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  count: number;
  update: (centerPos: THREE.Vector3, progress: number) => void;
  hide: () => void;
  dispose: () => void;
}

/**
 * 🌠 TrailLayerRenderer
 * 專門負責 3D 彈道拖尾、揮砍光軌粒子與運動採樣點的渲染器
 * 依據 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md §6 規格建立
 */
export class TrailLayerRenderer {
  private static softParticleTexture: THREE.Texture | null = null;

  /**
   * 🌟 取得動態生成之高斯羽化星芒圓球紋理 (徹底消除硬邊方塊像素)
   */
  public static getSoftParticleTexture(): THREE.Texture {
    if (this.softParticleTexture) return this.softParticleTexture;
    if (typeof document === 'undefined') {
      // 測試環境 (無頭 node) 回傳 dummy Texture
      this.softParticleTexture = new THREE.Texture();
      return this.softParticleTexture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.35)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = false;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.softParticleTexture = tex;
    return tex;
  }

  /**
   * 建立標準點雲拖尾實例 (支援傳統點雲更新與確定性刀尖弧度採樣)
   */
  public static createTrail(
    scene: THREE.Scene,
    startPos: THREE.Vector3,
    colorRim: string = '#38bdf8',
    trailCount: number = 30,
    trailSize: number = 8,
    scale: number = 1.0,
    rng: () => number = defaultVfxRng
  ): TrailInstance {
    const count = Math.min(60, Math.max(10, trailCount));
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = startPos.x;
      positions[i * 3 + 1] = startPos.y;
      positions[i * 3 + 2] = startPos.z;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(colorRim),
      size: Math.max(12, trailSize * scale * 1.5),
      transparent: true,
      opacity: 0.95,
      map: this.getSoftParticleTexture(),
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 999;
    scene.add(points);

    let currentIndex = 0;

    const update = (currentPos: THREE.Vector3) => {
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      if (!posAttr) return;

      for (let k = 0; k < 2; k++) {
        const idx = (currentIndex + k) % count;
        posAttr.setXYZ(
          idx,
          currentPos.x + (rng() - 0.5) * 6 * scale,
          currentPos.y + (rng() - 0.5) * 6 * scale,
          currentPos.z + (rng() - 0.5) * 6 * scale
        );
      }
      posAttr.needsUpdate = true;
      currentIndex = (currentIndex + 2) % count;
    };

    /**
     * ⚔️ 確定性圓弧刀尖流光取樣 (Deterministic Arc Blade Trail)
     * 沿著過去進度弧線分散取樣，越靠近刀尖越集中，出刀尾聲平滑消散，出刀完畢徹底隱藏零殘留
     */
    const updateArcTrail = (
      tipSampler: (prog: number) => THREE.Vector3,
      currentProgress: number,
      spreadWidth: number = 0,
      strands: number = 1
    ) => {
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      if (!posAttr) return;

      if (currentProgress <= 0.001 || currentProgress >= 0.999) {
        // 出刀完畢或尚未出刀：立即隱藏且透明度歸零，保證最後一影格絕對零殘留
        points.visible = false;
        material.opacity = 0;
        return;
      }

      points.visible = true;
      // 尾段漸隱衰減 (Progress > 0.75 開始淡出)
      if (currentProgress > 0.75) {
        const fade = Math.max(0, 1.0 - (currentProgress - 0.75) / 0.24);
        material.opacity = 0.85 * fade;
      } else {
        material.opacity = 0.85;
      }

      const trailSpan = Math.min(0.35, currentProgress);
      const strandCount = Math.max(1, Math.min(3, strands));

      for (let i = 0; i < count; i++) {
        const uNorm = i / Math.max(1, count - 1); // 1 = 刀尖, 0 = 尾端
        const u = Math.pow(uNorm, 1.4); // 非線性聚集於刀尖
        const sampleProg = Math.max(0, currentProgress - (1 - u) * trailSpan);
        const basePos = tipSampler(sampleProg);

        // 🌟 多股微相位交織羽流與散開寬度 (Strands & Flowing Plumes for Slash Trail)
        const strandIdx = i % strandCount;
        const strandPhaseOffset = (strandIdx * Math.PI * 2) / strandCount;
        const flowPhase = currentProgress * 24.0 - (1 - uNorm) * 12.0 + i * 0.45 + strandPhaseOffset;
        const tailDispersion = 1 - uNorm; // 越往尾部散得越開
        const extraSpread = spreadWidth * tailDispersion;
        const waveX = Math.cos(flowPhase * 0.9) * extraSpread;
        const waveY = Math.sin(flowPhase) * extraSpread;
        const waveZ = Math.sin(flowPhase * 1.3) * (extraSpread * 0.6);
        const jitter = (1 - uNorm * 0.7) * 6 * scale;

        posAttr.setXYZ(
          i,
          basePos.x + waveX + (rng() - 0.5) * jitter,
          basePos.y + waveY + (rng() - 0.5) * jitter,
          basePos.z + waveZ + (rng() - 0.5) * jitter
        );
      }
      posAttr.needsUpdate = true;
    };

    /**
     * 🏹 確定性彈道軌跡拖尾 (Deterministic Trajectory Trail)
     * 沿著 (startPos -> curPos) 歷史軌跡動態分佈：
     * - 頭部彗核：高度聚集、高能量亮光
     * - 尾部流光：非線性拉長、自然波動擾動擴散 (Turbulence Wave)，打破機械等距死線
     * - 尾端漸隱：子彈接近目標時平滑消散 (Lifetime Fade)，徹底杜絕動畫結束暫留
     */
    const updateTrajectoryTrail = (
      startPos: THREE.Vector3,
      curPos: THREE.Vector3,
      progress: number,
      arcHeight: number = 0,
      spreadWidth: number = 0,
      strands: number = 1
    ) => {
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      if (!posAttr) return;

      if (progress <= 0.001 || progress >= 0.99) {
        points.visible = false;
        material.opacity = 0;
        return;
      }

      points.visible = true;

      // 🌟 尾端平滑消散：進度超過 0.75 時平滑衰減，命中時自然散盡，絕不硬定在空中
      let trailFade = 1.0;
      if (progress > 0.75) {
        trailFade = Math.max(0, (0.99 - progress) / 0.24);
      }
      material.opacity = Math.min(0.95, 0.95 * trailFade);

      const dist = startPos.distanceTo(curPos);
      if (dist < 2) {
        // 原地/駐留型特效：在主體周圍形成自然流動星塵雲
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + progress * Math.PI * 4;
          const radius = (12 + Math.sin(progress * 8.0 + i) * 6 + (i % 5) * 6) * scale + spreadWidth * 0.5;
          posAttr.setXYZ(
            i,
            curPos.x + Math.cos(angle) * radius + (rng() - 0.5) * 5 * scale,
            curPos.y + Math.sin(angle) * radius + (rng() - 0.5) * 5 * scale,
            curPos.z + (rng() - 0.5) * 10 * scale
          );
        }
        posAttr.needsUpdate = true;
        return;
      }

      // 彗尾跨度：依飛行速度動態延展
      const trailSpan = Math.min(0.45, progress * 0.85);
      const strandCount = Math.max(1, Math.min(3, strands));

      for (let i = 0; i < count; i++) {
        // 🌟 非線性彗核聚集：i 靠近 0 時緊貼彈頭，越往後越拉開
        const uNorm = i / Math.max(1, count - 1);
        const u = Math.pow(uNorm, 1.6);
        const sampleProg = Math.max(0, progress - u * trailSpan);
        const ratio = sampleProg / Math.max(0.001, progress);

        const x = THREE.MathUtils.lerp(startPos.x, curPos.x, ratio);
        let y = THREE.MathUtils.lerp(startPos.y, curPos.y, ratio);
        const z = THREE.MathUtils.lerp(startPos.z, curPos.z, ratio);

        if (arcHeight > 0) {
          y += Math.sin(sampleProg * Math.PI) * arcHeight;
        }

        // 🌟 多股微相位交織羽流與散開寬度 (Strands & Flowing Plumes)
        const strandIdx = i % strandCount;
        const strandPhaseOffset = (strandIdx * Math.PI * 2) / strandCount;
        const flowPhase = progress * 24.0 - uNorm * 12.0 + i * 0.45 + strandPhaseOffset;
        const extraSpread = spreadWidth * uNorm;
        const waveY = (Math.sin(flowPhase) * (2.0 + uNorm * 8.0) * scale) + (Math.sin(flowPhase) * extraSpread);
        const waveZ = (Math.cos(flowPhase * 1.2) * (2.0 + uNorm * 8.0) * scale) + (Math.cos(flowPhase) * extraSpread);
        const spreadJitter = (1.5 + Math.pow(uNorm, 1.4) * 14.0) * scale;

        posAttr.setXYZ(
          i,
          x + (rng() - 0.5) * spreadJitter * 0.4,
          y + waveY + (rng() - 0.5) * spreadJitter,
          z + waveZ + (rng() - 0.5) * spreadJitter
        );
      }
      posAttr.needsUpdate = true;
    };

    const updateStyle = (colorHex: string, size: number, currentScale: number = 1.0) => {
      material.color.set(colorHex);
      material.size = Math.max(12, size * currentScale * 1.5);
      material.needsUpdate = true;
    };

    const dispose = () => {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    };

    return {
      points,
      geometry,
      material,
      positions,
      count,
      currentIndex,
      update,
      updateArcTrail,
      updateTrajectoryTrail,
      updateStyle,
      dispose
    };
  }

  /**
   * 💥 建立/管理確定性命中爆散粒子群 (Deterministic Impact Burst Cloud)
   * 隨進度向四周爆散擴散並淡出，100% 響應面板 param-burst-count
   */
  public static createBurstCloud(
    scene: THREE.Scene,
    centerPos: THREE.Vector3,
    colorHex: string = '#38bdf8',
    burstCount: number = 60,
    particleSize: number = 10,
    rng: () => number = defaultVfxRng
  ): BurstCloudInstance {
    const count = Math.max(8, burstCount);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = centerPos.x;
      positions[i * 3 + 1] = centerPos.y;
      positions[i * 3 + 2] = centerPos.z;

      // 預先求值隨機球面散射向量
      const theta = rng() * Math.PI * 2;
      const phi = (rng() - 0.5) * Math.PI;
      const speed = 40 + rng() * 80;
      velocities[i * 3] = Math.cos(phi) * Math.cos(theta) * speed;
      velocities[i * 3 + 1] = Math.sin(phi) * speed;
      velocities[i * 3 + 2] = Math.cos(phi) * Math.sin(theta) * speed;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: new THREE.Color(colorHex),
      size: Math.max(12, particleSize * 1.2),
      transparent: true,
      opacity: 0.95,
      map: this.getSoftParticleTexture(),
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = 999;
    scene.add(points);

    const update = (currentCenter: THREE.Vector3, burstProgress: number) => {
      const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
      if (!posAttr) return;

      if (burstProgress <= 0.001 || burstProgress >= 1.0) {
        points.visible = false;
        material.opacity = 0;
        return;
      }

      points.visible = true;
      material.opacity = Math.max(0, 0.9 * (1.0 - burstProgress));

      for (let i = 0; i < count; i++) {
        posAttr.setXYZ(
          i,
          currentCenter.x + velocities[i * 3] * burstProgress,
          currentCenter.y + velocities[i * 3 + 1] * burstProgress - (burstProgress * burstProgress * 25), // 微重力下墜
          currentCenter.z + velocities[i * 3 + 2] * burstProgress
        );
      }
      posAttr.needsUpdate = true;
    };

    const hide = () => {
      points.visible = false;
      material.opacity = 0;
    };

    const dispose = () => {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    };

    return {
      points,
      geometry,
      material,
      count,
      update,
      hide,
      dispose
    };
  }

  /**
   * ⚡ 建立動態雷擊電弧 (Dynamic Lightning Arc)
   */
  public static spawnLightning(
    scene: THREE.Scene,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    options: {
      color?: string;
      scale?: number;
      duration?: number;
      rng?: () => number;
    }
  ): {
    update: (delta: number) => boolean;
    dispose: () => void;
  } {
    const rng = options.rng || defaultVfxRng;
    const segCount = 14;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segCount; i++) {
      const t = i / segCount;
      const pt = new THREE.Vector3().lerpVectors(startPos, endPos, t);
      if (i > 0 && i < segCount) {
        pt.x += (rng() - 0.5) * 55;
        pt.y += (rng() - 0.5) * 55;
      }
      points.push(pt);
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, segCount, 4.5 * (options.scale || 1.0), 6, false);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(options.color || '#38bdf8'),
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = VFX_RENDER_ORDER.MAIN;
    scene.add(mesh);

    let life = Math.max(0.15, (options.duration || 0.3) * 0.6);

    return {
      update: (delta: number) => {
        life -= delta;
        mat.opacity = Math.max(0, life / 0.2);
        return life <= 0;
      },
      dispose: () => {
        scene.remove(mesh);
        geo.dispose();
        mat.dispose();
      }
    };
  }

  /**
   * 💫 建立動態高能射線光束 (Dynamic Energy Beam)
   */
  public static spawnBeam(
    scene: THREE.Scene,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    options: {
      colorCore?: string;
      colorRim?: string;
      scale?: number;
      duration?: number;
    }
  ): {
    update: (delta: number) => boolean;
    dispose: () => void;
  } {
    const dist = startPos.distanceTo(endPos);
    const group = new THREE.Group();
    group.renderOrder = VFX_RENDER_ORDER.MAIN;
    group.position.copy(startPos);
    group.lookAt(endPos);
    scene.add(group);

    const sc = options.scale || 1.0;
    const innerGeo = new THREE.CylinderGeometry(4 * sc, 4 * sc, dist, 12);
    innerGeo.rotateZ(Math.PI / 2);
    innerGeo.translate(dist / 2, 0, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(options.colorCore || '#ffffff'),
      blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(innerGeo, innerMat));

    const outerGeo = new THREE.CylinderGeometry(14 * sc, 14 * sc, dist, 12);
    outerGeo.rotateZ(Math.PI / 2);
    outerGeo.translate(dist / 2, 0, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(options.colorRim || '#38bdf8'),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(outerGeo, outerMat));

    let life = Math.max(0.18, (options.duration || 0.3) * 0.7);

    return {
      update: (delta: number) => {
        life -= delta;
        const progress = Math.max(0, life / 0.3);
        group.scale.set(1, progress, progress);
        outerMat.opacity = progress * 0.85;
        return life <= 0;
      },
      dispose: () => {
        scene.remove(group);
        innerGeo.dispose();
        innerMat.dispose();
        outerGeo.dispose();
        outerMat.dispose();
      }
    };
  }

  /**
   * 🏹 建立弓兵拋物齊射 (Arrow Volley)
   */
  public static spawnArrowVolley(
    scene: THREE.Scene,
    fromPos: THREE.Vector3,
    toPos: THREE.Vector3,
    options: {
      color?: string;
      scale?: number;
      duration?: number;
      arrowCount?: number;
      onHitPoint?: () => void;
      rng?: () => number;
    }
  ): {
    update: (delta: number) => boolean;
    dispose: () => void;
  } {
    const rng = options.rng || defaultVfxRng;
    const group = new THREE.Group();
    group.renderOrder = VFX_RENDER_ORDER.MAIN;
    scene.add(group);

    const arrowCount = options.arrowCount || 9;
    const sc = options.scale || 1.0;
    const arrowMeshes: { mesh: THREE.Mesh; p0: THREE.Vector3; p1: THREE.Vector3; p2: THREE.Vector3; delay: number }[] = [];
    const arrowGeo = new THREE.ConeGeometry(2.5 * sc, 24 * sc, 5);
    arrowGeo.rotateX(Math.PI / 2);
    const arrowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(options.color || '#f59e0b'),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });

    for (let i = 0; i < arrowCount; i++) {
      const mesh = new THREE.Mesh(arrowGeo, arrowMat);
      mesh.visible = false;
      group.add(mesh);

      const p0 = new THREE.Vector3(fromPos.x + (rng() - 0.5) * 40, fromPos.y + (rng() - 0.5) * 30, 0);
      const p2 = new THREE.Vector3(toPos.x + (rng() - 0.5) * 60, toPos.y + (rng() - 0.5) * 40, 0);
      const midX = (p0.x + p2.x) / 2;
      const midY = Math.max(p0.y, p2.y) + 140 + rng() * 40;
      const p1 = new THREE.Vector3(midX, midY, 0);

      arrowMeshes.push({ mesh, p0, p1, p2, delay: i * 0.03 });
    }

    let elapsed = 0;
    let hitFired = false;
    const duration = options.duration || 0.45;

    return {
      update: (delta: number) => {
        elapsed += delta;
        let allDone = true;

        arrowMeshes.forEach(item => {
          const tLocal = (elapsed - item.delay) / (duration * 0.85);
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

        if (!hitFired && elapsed >= duration * 0.6) {
          hitFired = true;
          options.onHitPoint?.();
        }

        return allDone && elapsed >= duration;
      },
      dispose: () => {
        scene.remove(group);
        arrowGeo.dispose();
        arrowMat.dispose();
      }
    };
  }
}
