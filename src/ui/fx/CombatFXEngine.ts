import * as THREE from 'three';

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

  private constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.z = 500;

    // 🌟 100% 完美透明 WebGL 渲染器，配合 Additive Blending 呈現極致發光
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); // 確保透明度為 0
  }

  public static getInstance(): CombatFXEngine {
    if (!this.instance) {
      this.instance = new CombatFXEngine();
    }
    return this.instance;
  }

  public mount(container: HTMLElement): void {
    if (this.container === container) return;
    this.container = container;
    this.canvas = this.renderer.domElement;
    this.canvas.id = 'three-combat-fx-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.zIndex = '35';

    this.container.appendChild(this.canvas);
    this.resize();

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
}
