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
  updateArcTrail?: (tipSampler: (prog: number) => THREE.Vector3, currentProgress: number) => void;
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
      size: trailSize * scale,
      transparent: true,
      opacity: 0.85,
      map: this.getSoftParticleTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = VFX_RENDER_ORDER.TRAIL;
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
    const updateArcTrail = (tipSampler: (prog: number) => THREE.Vector3, currentProgress: number) => {
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
      for (let i = 0; i < count; i++) {
        const u = i / Math.max(1, count - 1); // 1 = 刀尖, 0 = 尾端
        const sampleProg = Math.max(0, currentProgress - (1 - u) * trailSpan);
        const basePos = tipSampler(sampleProg);
        const jitter = (1 - u * 0.6) * 7 * scale;

        posAttr.setXYZ(
          i,
          basePos.x + (rng() - 0.5) * jitter,
          basePos.y + (rng() - 0.5) * jitter,
          basePos.z + (rng() - 0.5) * jitter
        );
      }
      posAttr.needsUpdate = true;
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
