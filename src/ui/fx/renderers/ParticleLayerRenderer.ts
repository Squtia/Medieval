import * as THREE from 'three';
import { VFX_RENDER_ORDER } from '../VFXSpatialPolicy';
import { defaultVfxRng } from '../VFXRng';

export interface ParticleEmitterOptions {
  color: string;
  size: number;
  count: number;
  opacity?: number;
}

/**
 * ✨ ParticleLayerRenderer
 * 專門負責發光微粒流、飛行拖尾 (Trail) 與命中爆散碎屑 (Burst) 的渲染器
 */
export class ParticleLayerRenderer {
  /**
   * ✨ 建立微粒 Points 系統
   */
  public static createParticleSystem(options: ParticleEmitterOptions): {
    points: THREE.Points;
    geometry: THREE.BufferGeometry;
    material: THREE.PointsMaterial;
    positions: Float32Array;
  } {
    const count = Math.max(1, options.count);
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: new THREE.Color(options.color),
      size: options.size,
      transparent: true,
      opacity: options.opacity ?? 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const points = new THREE.Points(geometry, material);
    points.renderOrder = VFX_RENDER_ORDER.IMPACT;
    return { points, geometry, material, positions };
  }

  /**
   * 💥 建立受擊點球狀放射爆散微粒
   */
  public static spawnBurstParticles(
    scene: THREE.Scene,
    origin: THREE.Vector3,
    options: {
      color: string;
      size?: number;
      count?: number;
      speed?: number;
      rng?: () => number;
    }
  ): {
    update: (delta: number) => boolean;
    dispose: () => void;
  } {
    const getRandom = options.rng || defaultVfxRng;
    const count = options.count || 50;
    const sys = this.createParticleSystem({
      color: options.color,
      size: options.size || 8,
      count
    });

    const velocities: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const theta = getRandom() * Math.PI * 2;
      const phi = Math.acos(getRandom() * 2 - 1);
      const spd = (options.speed || 160) * (0.4 + getRandom() * 0.8);
      velocities.push(
        new THREE.Vector3(
          Math.sin(phi) * Math.cos(theta) * spd,
          Math.sin(phi) * Math.sin(theta) * spd,
          Math.cos(phi) * spd * 0.4
        )
      );
      sys.positions[i * 3] = origin.x;
      sys.positions[i * 3 + 1] = origin.y;
      sys.positions[i * 3 + 2] = origin.z;
    }
    sys.geometry.attributes.position.needsUpdate = true;
    scene.add(sys.points);

    let elapsed = 0;
    const lifeTime = 0.35;

    return {
      update: (delta: number) => {
        elapsed += delta;
        const progress = Math.min(elapsed / lifeTime, 1);
        const posAttr = sys.geometry.attributes.position as THREE.BufferAttribute;

        for (let i = 0; i < count; i++) {
          const v = velocities[i];
          posAttr.setXYZ(
            i,
            posAttr.getX(i) + v.x * delta,
            posAttr.getY(i) + v.y * delta,
            posAttr.getZ(i) + v.z * delta
          );
        }
        posAttr.needsUpdate = true;
        sys.material.opacity = (1 - progress) * 0.9;

        return progress >= 1;
      },
      dispose: () => {
        scene.remove(sys.points);
        sys.geometry.dispose();
        sys.material.dispose();
      }
    };
  }

  /**
   * 💥 建立受擊點破空火花與星芒爆散 (Slash Impact Sparks)
   */
  public static spawnSlashSparks(
    scene: THREE.Scene,
    origin: THREE.Vector3,
    colorHex: string = '#f59e0b',
    count: number = 16,
    rng: () => number = defaultVfxRng
  ): {
    update: (delta: number) => boolean;
    dispose: () => void;
  } {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities: { x: number; y: number; z: number }[] = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
      const angle = (Math.PI * 2 * i) / count + (rng() - 0.5) * 0.6;
      const speed = 120 + rng() * 180;
      velocities.push({
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
        z: (rng() - 0.5) * 60
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(colorHex),
      size: 7,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const points = new THREE.Points(geo, mat);
    points.renderOrder = VFX_RENDER_ORDER.IMPACT;
    scene.add(points);

    let sparkElapsed = 0;
    const sparkDuration = 0.22;

    return {
      update: (delta: number) => {
        sparkElapsed += delta;
        const prog = Math.min(sparkElapsed / sparkDuration, 1);
        const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;

        for (let i = 0; i < count; i++) {
          const v = velocities[i];
          posAttr.setXYZ(
            i,
            origin.x + v.x * sparkElapsed,
            origin.y + v.y * sparkElapsed,
            origin.z + v.z * sparkElapsed
          );
        }
        posAttr.needsUpdate = true;
        mat.opacity = (1 - prog) * 0.9;
        return prog >= 1;
      },
      dispose: () => {
        scene.remove(points);
        geo.dispose();
        mat.dispose();
      }
    };
  }
}
