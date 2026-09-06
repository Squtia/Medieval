import * as THREE from 'three';
import { VFXPreset } from '../../models/VFX';
import { VFXScheduler } from './VFXScheduler';
import { MeshLayerRenderer } from './renderers/MeshLayerRenderer';
import { ParticleLayerRenderer } from './renderers/ParticleLayerRenderer';
import { ImpactLayerRenderer } from './renderers/ImpactLayerRenderer';
import { PlaybackClock } from './PlaybackClock';

export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ActiveEffect {
  update: (delta: number) => boolean;
  dispose: () => void;
}

/**
 * 🎬 VFXPlayer
 * 專案 3D 視覺特效獨立核心播放器 (Standalone VFX Sequence Player)
 * 嚴格遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 規範：
 * 1. 拒絕偽 Facade，具備實體 3D 場景、相機、WebGLRenderer 與單一 Canvas
 * 2. 整合專用 Layer Renderers (Mesh, Particle, Impact)
 * 3. 整合專用 VFXScheduler (單一邏輯演出時鐘)
 * 4. 具備完全可取消之 clear() 機制
 */
export class VFXPlayer {
  protected static playerInstance: VFXPlayer | null = null;

  protected container: HTMLElement | null = null;
  protected canvas: HTMLCanvasElement | null = null;
  protected scene: THREE.Scene;
  protected camera: THREE.PerspectiveCamera;
  protected renderer: THREE.WebGLRenderer;

  protected activeEffects: ActiveEffect[] = [];
  protected isRunning = false;
  protected lastTime = 0;
  protected playbackSpeed = 1.0;
  protected playbackGeneration = 0;
  protected scheduler: VFXScheduler = new VFXScheduler();
  protected playbackClock: VFXScheduler;
  protected sessionRng: (() => number) | null = null;

  constructor() {
    this.playbackClock = this.scheduler;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    this.camera.position.z = 500;
    this.camera.far = 5000;

    if (typeof document !== 'undefined' && typeof document.createElementNS === 'function' && typeof HTMLCanvasElement !== 'undefined') {
      try {
        this.renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 2));
        this.renderer.setClearColor(0x000000, 0);
        if (this.renderer.debug) {
          this.renderer.debug.checkShaderErrors = false;
        }
      } catch (err) {
        this.renderer = {
          domElement: { style: {} } as any,
          setSize: () => {},
          render: () => {}
        } as any;
      }
    } else {
      this.renderer = {
        domElement: { style: {} } as any,
        setSize: () => {},
        render: () => {}
      } as any;
    }
  }

  public static getInstance(): VFXPlayer {
    if (!this.playerInstance) {
      this.playerInstance = new VFXPlayer();
    }
    return this.playerInstance;
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
    this.resize();

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', () => this.resize());
    }
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

  public setSessionRng(rng: (() => number) | null): void {
    this.sessionRng = rng;
  }

  public getRandom(): number {
    return this.sessionRng ? this.sessionRng() : Math.random();
  }

  public getScheduler(): VFXScheduler {
    return this.scheduler;
  }

  public getPlaybackClock(): PlaybackClock {
    return this.scheduler;
  }

  public setPlaybackSpeed(speed: number): void {
    this.playbackSpeed = Math.max(0.05, Math.min(speed, 5.0));
    this.scheduler.setSpeed(this.playbackSpeed);
  }

  public getPlaybackSpeed(): number {
    return this.playbackSpeed;
  }

  public pause(): void {
    this.scheduler.pause();
  }

  public resume(): void {
    this.scheduler.resume();
  }

  public isPaused(): boolean {
    return this.scheduler.isPaused();
  }

  public seek(targetTimeSeconds: number, triggerSkippedCues: boolean = false): void {
    this.scheduler.seek(targetTimeSeconds, triggerSkippedCues);
  }

  public clear(): void {
    this.playbackGeneration++;
    this.scheduler.clear();
    this.sessionRng = null;

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

  protected startLoop(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();

    const animate = (time: number) => {
      if (!this.isRunning) return;
      requestAnimationFrame(animate);

      const rawDelta = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;

      const delta = this.scheduler.advance(rawDelta);

      if (delta > 0) {
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
          const effect = this.activeEffects[i];
          const isDone = effect.update(delta);
          if (isDone) {
            effect.dispose();
            this.activeEffects.splice(i, 1);
          }
        }
      }

      this.renderer.render(this.scene, this.camera);
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(animate);
    }
  }

  public addActiveEffect(effect: ActiveEffect): void {
    this.activeEffects.push(effect);
  }

  public getScene(): THREE.Scene {
    return this.scene;
  }
}

// 供專案相容與出口導出
export { CombatFXEngine } from './CombatFXEngine';
export { VFXStudioAdapter, type VFXStudioAdapterOptions } from './VFXStudioAdapter';
export { VFXPresetRepository, VFX_STORAGE_KEY, CURRENT_SCHEMA_VERSION } from './VFXPresetRepository';
export { VFXPresetValidator, type ValidationResult } from './VFXPresetValidator';
export { CombatStudioStageAdapter } from './adapters/CombatStudioStageAdapter';
export { CombatStageAdapter } from './adapters/CombatStageAdapter';
export { PlaybackClock, type ScheduledTask, type TickListener } from './PlaybackClock';
export { CombatActionPlayer, mapImpactsToCues, type CombatAction, type CombatImpactPresentation } from './CombatActionPlayer';
export { MeshLayerRenderer } from './renderers/MeshLayerRenderer';
export { ParticleLayerRenderer } from './renderers/ParticleLayerRenderer';
export { ImpactLayerRenderer } from './renderers/ImpactLayerRenderer';
export { VFXScheduler } from './VFXScheduler';
