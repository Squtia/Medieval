import * as THREE from 'three';
import { VFXPreset, VFXImpactConfig } from '../../models/VFX';
import defaultVFXPresets from '../../data/vfx_presets.json';
import { VFXPresetRepository } from './VFXPresetRepository';

export interface ScreenPoint {
  x: number;
  y: number;
}

interface ActiveEffect {
  update: (delta: number) => boolean;
  dispose: () => void;
}

export class CombatFXEngine {
  private static instance: CombatFXEngine | null = null;

  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  private activeEffects: ActiveEffect[] = [];
  private isRunning = false;
  private lastTime = 0;
  private playbackGeneration = 0;
  private scheduledTimers = new Set<ReturnType<typeof setTimeout>>();

  private constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    this.camera.position.z = 500;
    this.camera.far = 5000;

    // 🌟 100% 完美透明 WebGL 渲染器，配合 Additive Blending 呈現極致發光 (Node 環境防呆)
    if (typeof document !== 'undefined') {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setClearColor(0x000000, 0); // 確保透明度為 0
    } else {
      this.renderer = {
        domElement: { style: {} } as any,
        setSize: () => {},
        render: () => {}
      } as any;
    }
  }

  public static getInstance(): CombatFXEngine {
    if (!this.instance) {
      this.instance = new CombatFXEngine();
    }
    return this.instance;
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

  public mount(container: HTMLElement): void {
    if (this.container === container) return;
    this.container = container;
    const canvas = this.renderer.domElement;
    this.canvas = canvas;
    canvas.id = 'three-combat-fx-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '35';

    container.appendChild(canvas);
    this.resize(); // 初始 resize（container 可能不可見，使用 fallback 尺寸）

    window.addEventListener('resize', () => this.resize());
    this.startLoop();
  }

  public resize(): void {
    if (!this.container) return;
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    this.camera.aspect = width / height;
    const fovInRadians = (this.camera.fov * Math.PI) / 180;
    this.camera.position.z = height / (2 * Math.tan(fovInRadians / 2));
    this.camera.far = 5000;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  public screenToWorld(pt: ScreenPoint): THREE.Vector3 {
    if (!this.container) return new THREE.Vector3(0, 0, 0);
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;
    const x = pt.x - width / 2;
    const y = height / 2 - pt.y;
    return new THREE.Vector3(x, y, 0);
  }

  /**
   * 🧹 清空當前畫布上所有特效物件、定時器與動畫循環（用於跳過或中途關閉）
   */
  public clear(): void {
    this.playbackGeneration++;
    this.scheduledTimers.forEach(t => clearTimeout(t));
    this.scheduledTimers.clear();

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      try {
        this.activeEffects[i].dispose();
      } catch (e) {
        // ignore
      }
    }
    this.activeEffects = [];
    while (this.scene.children.length > 0) {
      const obj = this.scene.children[0];
      this.scene.remove(obj);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private startLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    const animate = (time: number) => {
      if (!this.isRunning) return;
      requestAnimationFrame(animate);

      const delta = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;

      for (let i = this.activeEffects.length - 1; i >= 0; i--) {
        const effect = this.activeEffects[i];
        const isDone = effect.update(delta);
        if (isDone) {
          effect.dispose();
          this.activeEffects.splice(i, 1);
        }
      }

      this.renderer.render(this.scene, this.camera);
    };

    requestAnimationFrame(animate);
  }

  // ─────────────────────────────────────────────────────────────
  // 🔮 菲涅爾冰晶發光 Shader (100% 透明相容)
  // ─────────────────────────────────────────────────────────────
  private createIceShaderMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorCore: { value: new THREE.Color(0x38bdf8) },
        colorEdge: { value: new THREE.Color(0xffffff) }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-worldPos.xyz);
          gl_Position = projectionMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 colorCore;
        uniform vec3 colorEdge;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 1.5);
          vec3 finalColor = mix(colorCore, colorEdge, fresnel);
          gl_FragColor = vec4(finalColor, 0.9 + fresnel * 0.1);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
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
    isPlayerOrOnImpact?: boolean | ((impact: VFXImpactConfig, hitIndex: number, totalHits: number) => void),
    onImpactCallback?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number) => void
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
    isPlayerOrOnImpact?: boolean | ((impact: VFXImpactConfig, hitIndex: number, totalHits: number) => void),
    onImpactCallback?: (impact: VFXImpactConfig, hitIndex: number, totalHits: number) => void
  ): Promise<void> {
    const isPlayer = typeof isPlayerOrOnImpact === 'boolean' ? isPlayerOrOnImpact : true;
    const onImpact = typeof isPlayerOrOnImpact === 'function' ? isPlayerOrOnImpact : onImpactCallback;

    return new Promise((resolve) => {
      const impactConfig = preset.impact;
      const totalHits = Math.max(1, preset.hitCount || preset.salvoCount || 1);
      const firedHits = new Set<number>();
      let resolved = false;

      const fireImpact = (hitIdx: number = 0) => {
        if (!firedHits.has(hitIdx)) {
          firedHits.add(hitIdx);
          if (onImpact) {
            onImpact(impactConfig, hitIdx, totalHits);
          }
        }
      };

      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          for (let k = 0; k < totalHits; k++) {
            fireImpact(k);
          }
          if (failsafeTimer) clearTimeout(failsafeTimer);
          resolve();
        }
      };

      const failsafeTimer = this.registerTimer(() => {
        safeResolve();
      }, (preset.duration + 0.5) * 1000);

      let actualEndPos = endPos.clone();
      if (preset.trajectory === 'COLUMN_PIERCE' && impactConfig.penetrationDistance > 0) {
        const dir = new THREE.Vector3().subVectors(actualEndPos, startPos).normalize();
        actualEndPos = actualEndPos.addScaledVector(dir, impactConfig.penetrationDistance);
      }

      // 🔮 複合多圖層特效排程 (Composite VFX Preset Sequencer)
      if (preset.layers && preset.layers.length > 0) {
        preset.layers.forEach((layer) => {
          const delayMs = (layer.delay || 0.1) * 1000;
          this.registerTimer(() => {
            if (this.isRunning) {
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
              if (layer.trajectory === 'MELEE_SWEEP' || layer.shaderMode === 'SLASH_BLADE') {
                this.playArcSlash(actualEndPos, layerPreset, () => {}, () => {});
              } else if (layer.trajectory === 'VERTICAL_DROP') {
                this.playHolyPillar(actualEndPos, layerPreset, () => {}, () => {});
              } else if (layer.shaderMode === 'DIELECTRIC_LIGHTNING') {
                this.playDynamicLightning(startPos, actualEndPos, layerPreset, () => {}, () => {});
              } else if (layer.shaderMode === 'ENERGY_BEAM' || layer.trajectory === 'COLUMN_PIERCE') {
                this.playDynamicBeam(startPos, actualEndPos, layerPreset, () => {}, () => {});
              } else {
                this.playDynamicProjectile(startPos, actualEndPos, layerPreset, () => {}, () => {});
              }
            }
          }, delayMs);
        });
      }

      // 🚀 多段連擊排程發射 (Salvo & Multi-Hit Scheduler)
      if (totalHits > 1) {
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

          this.registerTimer(() => {
            if (this.isRunning) {
              fireImpact(i);
              // 每次連擊在受擊點爆散微型火花
              this.playSlashSparks(actualEndPos, preset.colorCore, 6);
            }
          }, (timeOffset + Math.min(preset.duration * 0.4, 0.2)) * 1000);
        }
      }

      // 根據軌跡與 Shader 模式分流至全動態渲染管線
      const mainOnHit = () => fireImpact(0);

      if (preset.trajectory === 'SHOUT_WAVE' || preset.id === 'VFX_TAUNT_SHOUT') {
        this.playTauntShout(startPos, actualEndPos, preset, mainOnHit, safeResolve);
      } else if (preset.trajectory === 'SHIELD_BARRIER' || preset.id === 'VFX_HOLY_SHIELD') {
        this.playHolyShield(actualEndPos, preset, mainOnHit, safeResolve);
      } else if (preset.trajectory === 'PARABOLA_ARC' || preset.id === 'VFX_ARROW_VOLLEY' || preset.id === 'VFX_WATCHTOWER_VOLLEY') {
        this.playArrowVolley(startPos, actualEndPos, preset, mainOnHit, safeResolve);
      } else if (preset.trajectory === 'MELEE_SWEEP' || preset.shaderMode === 'SLASH_BLADE') {
        this.playArcSlash(actualEndPos, preset, mainOnHit, safeResolve);
      } else if (preset.trajectory === 'BODY_AURA' || preset.id === 'VFX_SHIELD_WALL') {
        this.playAuraRing(actualEndPos, preset, mainOnHit, safeResolve);
      } else if (preset.trajectory === 'VERTICAL_DROP' && preset.shaderMode === 'HOLY_LIGHT') {
        this.playHolyPillar(actualEndPos, preset, mainOnHit, safeResolve);
      } else if (preset.shaderMode === 'DIELECTRIC_LIGHTNING') {
        this.playDynamicLightning(startPos, actualEndPos, preset, mainOnHit, safeResolve);
      } else if (preset.shaderMode === 'ENERGY_BEAM' || preset.trajectory === 'COLUMN_PIERCE') {
        this.playDynamicBeam(startPos, actualEndPos, preset, mainOnHit, safeResolve);
      } else {
        // 🌟 通用動態投射物管線（完整支援火球、冰矛、暗影、箭矢，100% 讀取 Preset 參數）
        this.playDynamicProjectile(startPos, actualEndPos, preset, mainOnHit, safeResolve);
      }
    });
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
    segments = 40
  ): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const angleDiff = headAngle - tailAngle;
    if (Math.abs(angleDiff) < 0.001) {
      geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0], 2));
      return geo;
    }

    // 🎯 中心貫穿偏移校準：使弧芒中段精確切過目標正中心 (0, 0)
    const offsetX = Math.cos(centerAngle) * (radius * 0.82);
    const offsetY = Math.sin(centerAngle) * (radius * 0.82);

    for (let i = 0; i <= segments; i++) {
      const t = i / segments; // 0 = tail, 1 = head
      const theta = tailAngle + angleDiff * t;

      // 刃部流線厚度：刃尖(t=1)銳利如針、中段飽滿、尾部(t=0)漸細收尖
      const widthFactor = Math.sin(t * Math.PI);
      const w = Math.max(1.5, bladeWidth * widthFactor);

      const rInner = radius - w * 0.85;
      const rOuter = radius + w * 0.15;

      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // 內弧頂點 (uv.y = 0，漸層消散為透明)
      positions.push(cosT * rInner - offsetX, sinT * rInner - offsetY, 0);
      uvs.push(t, 0);

      // 外弧頂點 (uv.y = 1，白熾銳利刀刃)
      positions.push(cosT * rOuter - offsetX, sinT * rOuter - offsetY, 0);
      uvs.push(t, 1);
    }

    for (let i = 0; i < segments; i++) {
      const i0 = i * 2;
      const i1 = i0 + 1;
      const i2 = (i + 1) * 2;
      const i3 = i2 + 1;

      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
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

    const isWhirlwind = preset.id.includes('WHIRLWIND') || preset.slashShape === 'WHIRLWIND';
    const isCross = preset.slashShape === 'CROSS';

    // 🎛️ 支援自訂粗細與半徑（預設細銳刀芒 10px，徹底告別 40px 肥塊）
    const bladeRadius = (preset.slashRadius || (isWhirlwind ? 85 : 65)) * preset.scale;
    const bladeWidth = (preset.slashBladeWidth || (isWhirlwind ? 18 : 10)) * preset.scale;
    const maxArcSpan = (isWhirlwind ? 360 : (preset.slashArcSpan || 135)) * (Math.PI / 180);
    const startAngle = (preset.slashAngle !== undefined ? preset.slashAngle : -45) * (Math.PI / 180);
    const dirSign = preset.slashReverse ? -1 : 1;
    const centerAngle = startAngle + dirSign * (maxArcSpan * 0.5);

    // 🎨 專屬劍氣漸層著色器：外緣白熾刀刃，內弧透明漸散
    const slashShaderMat = new THREE.ShaderMaterial({
      uniforms: {
        colorCore: { value: new THREE.Color(preset.colorCore) },
        colorRim: { value: new THREE.Color(preset.colorRim) },
        uOpacity: { value: 1.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 colorCore;
        uniform vec3 colorRim;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          // vUv.y: 0 = 內弧(消散), 1 = 外弧(刀鋒)
          // vUv.x: 0 = 刃尾, 1 = 刃尖
          float edgeAlpha = pow(vUv.y, 2.2); // 內緣快速淡出為透明，杜絕死白
          float tipAlpha = sin(vUv.x * 3.1415926); // 兩端收尖淡出
          float finalAlpha = edgeAlpha * tipAlpha * uOpacity;

          // 外緣高亮白熾，內側漸層至技能光彩
          vec3 finalColor = mix(colorRim, mix(colorCore, vec3(1.0, 1.0, 1.0), pow(vUv.y, 3.5)), vUv.y);
          gl_FragColor = vec4(finalColor * 1.5, finalAlpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

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
        const prog = Math.min(elapsed / duration, 1);

        let headT: number;
        let tailT: number;
        if (prog < 0.45) {
          const pHead = prog / 0.45;
          headT = Math.pow(pHead, 0.7);
          tailT = Math.pow(pHead, 2.4) * 0.2;
        } else {
          const pTail = (prog - 0.45) / 0.55;
          headT = 1.0;
          tailT = 0.2 + Math.pow(pTail, 1.4) * 0.8;
        }

        const headAngle = startAngle + dirSign * headT * maxArcSpan;
        const tailAngle = startAngle + dirSign * tailT * maxArcSpan;

        if (currentGeo) currentGeo.dispose();
        currentGeo = this.buildDynamicSlashGeo(bladeRadius, bladeWidth, headAngle, tailAngle, centerAngle);

        if (!currentMesh) {
          currentMesh = new THREE.Mesh(currentGeo, slashShaderMat);
          group.add(currentMesh);

          if (isCross) {
            crossGeo = this.buildDynamicSlashGeo(bladeRadius, bladeWidth, -headAngle, -tailAngle, -centerAngle);
            crossMesh = new THREE.Mesh(crossGeo, slashShaderMat);
            group.add(crossMesh);
          }
        } else {
          currentMesh.geometry = currentGeo;
          if (isCross && crossMesh) {
            if (crossGeo) crossGeo.dispose();
            crossGeo = this.buildDynamicSlashGeo(bladeRadius, bladeWidth, -headAngle, -tailAngle, -centerAngle);
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
    const group = new THREE.Group();
    group.position.copy(pos);
    this.scene.add(group);

    const shieldR = 70 * preset.scale;
    const hexGeo = new THREE.CylinderGeometry(shieldR, shieldR, 8, 6);
    hexGeo.rotateX(Math.PI / 2);
    const hexMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.colorCore || 0xfde047),
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(hexGeo, hexMat));

    const ringGeo = new THREE.TorusGeometry(shieldR * 1.05, 5, 8, 6);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.colorRim || 0xeab308),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    group.add(new THREE.Mesh(ringGeo, ringMat));

    const crossVGeo = new THREE.BoxGeometry(10 * preset.scale, shieldR * 1.2, 4);
    const crossHGeo = new THREE.BoxGeometry(shieldR * 0.9, 10 * preset.scale, 4);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending });
    group.add(new THREE.Mesh(crossVGeo, crossMat));
    group.add(new THREE.Mesh(crossHGeo, crossMat));

    onHit();
    let elapsed = 0;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;
        const prog = Math.min(elapsed / preset.duration, 1);

        if (prog < 0.25) {
          const sc = (prog / 0.25) * 1.15;
          group.scale.set(sc, sc, sc);
        } else {
          group.scale.set(1.0, 1.0, 1.0);
          const fade = 1 - (prog - 0.25) / 0.75;
          hexMat.opacity = fade * 0.88;
          ringMat.opacity = fade * 0.95;
          crossMat.opacity = fade;
        }

        if (prog >= 1) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        hexGeo.dispose();
        hexMat.dispose();
        ringGeo.dispose();
        ringMat.dispose();
        crossVGeo.dispose();
        crossHGeo.dispose();
        crossMat.dispose();
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
    const group = new THREE.Group();
    group.position.copy(casterPos);
    this.scene.add(group);

    const waves: { mesh: THREE.Mesh; delay: number; geo: THREE.RingGeometry; mat: THREE.MeshBasicMaterial }[] = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.RingGeometry(20, 32, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(preset.colorRim || 0xef4444),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      waves.push({ mesh, delay: i * 0.08, geo, mat });
    }

    let elapsed = 0;
    let hitFired = false;

    this.activeEffects.push({
      update: (delta) => {
        elapsed += delta;

        waves.forEach(w => {
          const tLocal = (elapsed - w.delay) / (preset.duration * 0.85);
          if (tLocal < 0 || tLocal >= 1) {
            w.mesh.visible = false;
            return;
          }
          w.mesh.visible = true;
          const sc = 1 + tLocal * 5.5 * preset.scale;
          w.mesh.scale.set(sc, sc, 1);
          w.mesh.position.lerpVectors(new THREE.Vector3(0, 0, 0), new THREE.Vector3(targetPos.x - casterPos.x, targetPos.y - casterPos.y, 0), tLocal * 0.85);
          w.mat.opacity = (1 - tLocal) * 0.95;
        });

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
        waves.forEach(w => {
          w.geo.dispose();
          w.mat.dispose();
        });
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
    const group = new THREE.Group();
    group.position.copy(pos);
    this.scene.add(group);

    const h = 450;
    const geo = new THREE.CylinderGeometry(20 * preset.scale, 30 * preset.scale, h, 24);
    geo.translate(0, h / 2, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.colorCore),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);

    onHit();

    let life = preset.duration;
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        const sc = Math.max(0, life / preset.duration);
        mesh.scale.set(sc, 1, sc);
        mat.opacity = sc;
        if (life <= 0) {
          onComplete();
          return true;
        }
        return false;
      },
      dispose: () => {
        this.scene.remove(group);
        geo.dispose();
        mat.dispose();
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

  // ─────────────────────────────────────────────────────────────
  // 🌟 通用次世代動態特效渲染管線 (Universal Dynamic VFX Pipeline)
  // ─────────────────────────────────────────────────────────────

  private createGlowTexture(colorHex: string): THREE.CanvasTexture {
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
    return new THREE.CanvasTexture(c);
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
   * 🔥 體積黑體輻射火焰動態著色器 (Vertex Noise Displacement + Blackbody Spectrum)
   */
  private createVolumetricFlameMaterial(colorCoreHex: string, colorRimHex: string, coreBrightness = 1.0, turbulence = 5.0, speed = 2.0): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorCore: { value: new THREE.Color(colorCoreHex) },
        uColorRim: { value: new THREE.Color(colorRimHex) },
        uCoreBrightness: { value: coreBrightness },
        uTurbulence: { value: turbulence },
        uTurbulenceSpeed: { value: speed }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uTurbulence;
        uniform float uTurbulenceSpeed;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vNoise;

        vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
        float snoise(vec3 v){
          const vec2 C = vec2(1.0/6.0, 1.0/3.0);
          const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
          vec3 i = floor(v + dot(v, C.yyy));
          vec3 x0 = v - i + dot(i, C.xxx);
          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min(g.xyz, l.zxy);
          vec3 i2 = max(g.xyz, l.zxy);
          vec3 x1 = x0 - i1 + 1.0 * C.xxx;
          vec3 x2 = x0 - i2 + 2.0 * C.xxx;
          vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
          i = mod(i, 289.0);
          vec4 p = permute(permute(permute(
                     i.z + vec4(0.0, i1.z, i2.z, 1.0))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0));
          float n_ = 0.142857142857;
          vec3 ns = n_ * D.wyz - D.xzx;
          vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_);
          vec4 x = x_ * ns.x + ns.yyyy;
          vec4 y = y_ * ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);
          vec4 b0 = vec4(x.xy, y.xy);
          vec4 b1 = vec4(x.zw, y.zw);
          vec4 s0 = floor(b0) * 2.0 + 1.0;
          vec4 s1 = floor(b1) * 2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));
          vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
          vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
          vec3 p0 = vec3(a0.xy, h.x);
          vec3 p1 = vec3(a0.zw, h.y);
          vec3 p2 = vec3(a1.xy, h.z);
          vec3 p3 = vec3(a1.zw, h.w);
          vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
          p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
          vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
          m = m * m;
          return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
        }

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          float noise = snoise(position * 0.15 + vec3(0.0, -uTime * (uTurbulenceSpeed * 2.1), uTime * uTurbulenceSpeed));
          vNoise = noise;
          vec3 displaced = position + normal * (noise * uTurbulence);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColorCore;
        uniform vec3 uColorRim;
        uniform float uCoreBrightness;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying float vNoise;

        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
          float heat = clamp(0.55 + vNoise * 0.45 - rim * 0.4, 0.0, 1.0);
          vec3 fireColor = mix(uColorRim, uColorCore * uCoreBrightness, pow(heat, 1.5));
          float alpha = clamp(0.7 + vNoise * 0.3, 0.3, 0.95);
          gl_FragColor = vec4(fireColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
  }

  private createFresnelShaderMaterial(colorCoreHex: string, colorRimHex: string, fresnelVal = 2.0): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorCore: { value: new THREE.Color(colorCoreHex) },
        colorRim: { value: new THREE.Color(colorRimHex) },
        fresnelPower: { value: fresnelVal }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 colorCore;
        uniform vec3 colorRim;
        uniform float fresnelPower;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(vViewPosition);
          float f = 1.0 - max(dot(viewDir, vNormal), 0.0);
          f = pow(f, fresnelPower);
          vec3 finalCol = mix(colorCore, colorRim, f);
          gl_FragColor = vec4(finalCol * 1.3, 0.95);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }

  /**
   * ❄️ 命中點次生冰刺/晶刺破裂爆發 (Secondary Spikes Burst - 支援多幾何形態)
   */
  private spawnSecondarySpikes(pos: THREE.Vector3, count: number, height: number, colorRimHex: string, preset?: VFXPreset): void {
    const group = new THREE.Group();
    // 🎯 腳底貼地原點校考：若角度向上沖天 (45°~135°) 或為地表破土，原點自動下沉至目標腳底地面 (pos.y - 65)！
    const isUpward = (preset?.spikeAngle !== undefined && preset.spikeAngle >= 45 && preset.spikeAngle <= 135) || (preset?.trajectory === 'GROUND_BURST');
    const basePos = pos.clone();
    if (isUpward) {
      basePos.y -= 65;
    }
    group.position.copy(basePos);
    this.scene.add(group);

    const spikeItems: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; delay: number; heightVar?: number }[] = [];
    const width = Math.max(3, (preset?.spikeWidth || 7) * (preset?.scale || 1.0));
    const finalHeight = Math.max(20, height);
    const shape = preset?.spikeShape || 'CONE_SPIKE';
    const spreadRadius = preset?.spikeRadius !== undefined ? preset.spikeRadius : 80;
    const staggerMs = preset?.spikeStagger !== undefined ? preset.spikeStagger : 25;
    const staggerSec = staggerMs / 1000;

    let spikeGeo: THREE.BufferGeometry;
    if (shape === 'CRYSTAL_PRISM') {
      spikeGeo = new THREE.CylinderGeometry(width * 0.35, width, finalHeight, 6);
    } else if (shape === 'JAGGED_ROCK') {
      spikeGeo = new THREE.ConeGeometry(width * 1.3, finalHeight, 4);
    } else if (shape === 'PILLAR_COLUMN') {
      spikeGeo = new THREE.CylinderGeometry(width, width, finalHeight, 12);
    } else {
      spikeGeo = new THREE.ConeGeometry(width, finalHeight, 8);
    }
    // 🎯 錨點設於底座，尖端沿 +Y 延伸至 (0, finalHeight, 0)
    spikeGeo.translate(0, finalHeight / 2, 0);

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

      const spikeMat = new THREE.MeshBasicMaterial({
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

      const delay = orderIndices[i] * staggerSec;
      const heightVar = 0.82 + Math.random() * 0.36;
      spikeItems.push({ mesh, mat: spikeMat, delay, heightVar });
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
          } else {
            item.mesh.scale.set(0.001, 0.001, 0.001);
            item.mat.opacity = 0;
          }
        });

        return elapsed >= totalDuration || allDone;
      },
      dispose: () => {
        this.scene.remove(group);
        spikeGeo.dispose();
        spikeItems.forEach(item => item.mat.dispose());
      }
    });
  }

  /**
   * 💥 通用命中衝擊光環與爆散粒子 (Impact Blast & Expanding Ring)
   */
  private spawnDynamicImpactBurst(pos: THREE.Vector3, preset: VFXPreset): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    this.scene.add(group);

    const ringGeo = new THREE.RingGeometry(12, 28, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(preset.colorRim),
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    if (preset.wavePlane === 'GROUND') {
      ringMesh.position.y = -65;
      ringMesh.rotation.x = (68 * Math.PI) / 180;
    }
    group.add(ringMesh);

    const burstCount = Math.max(12, preset.burstCount || 40);
    const geo = new THREE.BufferGeometry();
    const posArray = new Float32Array(burstCount * 3);
    const vels: THREE.Vector3[] = [];

    for (let i = 0; i < burstCount; i++) {
      posArray[i * 3] = 0;
      posArray[i * 3 + 1] = 0;
      posArray[i * 3 + 2] = 0;
      const spd = Math.random() * 240 + 80;
      const theta = Math.random() * Math.PI * 2;
      vels.push(new THREE.Vector3(Math.cos(theta) * spd, Math.sin(theta) * spd, (Math.random() - 0.5) * 60));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(preset.colorRim),
      size: (preset.trailSize || 8) * (preset.scale || 1.0),
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    const pts = new THREE.Points(geo, mat);
    group.add(pts);

    let life = 0.5;
    this.activeEffects.push({
      update: (delta) => {
        life -= delta;
        const prog = 1 - Math.max(0, life / 0.5);
        ringMesh.scale.set(1 + prog * 4.5 * (preset.scale || 1.0), 1 + prog * 4.5 * (preset.scale || 1.0), 1);
        ringMat.opacity = (1 - prog) * 0.9;

        const attr = geo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < burstCount; i++) {
          attr.setXYZ(
            i,
            attr.getX(i) + vels[i].x * delta,
            attr.getY(i) + vels[i].y * delta,
            attr.getZ(i) + vels[i].z * delta
          );
          vels[i].y -= 180 * delta;
        }
        attr.needsUpdate = true;
        mat.opacity = 1 - prog;
        return life <= 0;
      },
      dispose: () => {
        this.scene.remove(group);
        ringGeo.dispose();
        ringMat.dispose();
        geo.dispose();
        mat.dispose();
      }
    });
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
    if (preset.trajectory === 'VERTICAL_DROP') {
      actualStart = new THREE.Vector3(endPos.x, endPos.y + 380, 0);
    } else if (preset.trajectory === 'DIAGONAL_DROP') {
      actualStart = new THREE.Vector3(endPos.x - 260, endPos.y + 380, 0);
    } else if (preset.trajectory === 'GROUND_BURST') {
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

export { CombatFXEngine as VFXPlayer };


