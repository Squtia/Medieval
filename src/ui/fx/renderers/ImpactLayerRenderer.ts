import * as THREE from 'three';

export interface ImpactWaveOptions {
  radius?: number;
  thickness?: number;
  color?: string;
  blur?: number;
  plane?: 'CAMERA' | 'GROUND';
  duration?: number;
}

/**
 * 🥊 ImpactLayerRenderer
 * 專門負責受擊打擊反饋、2.5D 擴散衝擊光圈 (Wave Ring) 與動態閃光的渲染器
 */
export class ImpactLayerRenderer {
  /**
   * 💥 建立受擊擴散光圈 (Impact Wave Ring)
   */
  public static spawnImpactWave(
    scene: THREE.Scene,
    origin: THREE.Vector3,
    options: ImpactWaveOptions
  ): {
    update: (delta: number) => boolean;
    dispose: () => void;
  } {
    const maxRadius = options.radius || 65;
    const thickness = Math.max(1, options.thickness || 4);
    const col = new THREE.Color(options.color || '#ffffff');
    const isGround = options.plane === 'GROUND';
    const duration = options.duration || 0.28;
    const blurPct = Math.min(100, Math.max(0, options.blur ?? 30)) / 100;

    // 根據 thickness 計算環形內外半徑，並依 blur 調整初始透明度與漸層
    const innerR = Math.max(1, maxRadius * 0.1);
    const outerR = innerR + thickness;
    const ringGeo = new THREE.RingGeometry(innerR, outerR, 32);
    const baseOpacity = 0.95 * (1.0 - blurPct * 0.4); // blur 越高越柔焦
    const ringMat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: baseOpacity,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(ringGeo, ringMat);
    mesh.position.copy(origin);
    if (isGround) {
      mesh.rotation.x = Math.PI * 0.38; // 2.5D 俯視傾角
      mesh.position.y -= 45;            // 貼近地面腳底
    }
    scene.add(mesh);

    let elapsed = 0;

    return {
      update: (delta: number) => {
        elapsed += delta;
        const progress = Math.min(elapsed / duration, 1);
        const currentScale = 0.1 + progress * 0.9;
        mesh.scale.set(currentScale, currentScale, currentScale);
        ringMat.opacity = (1 - progress) * baseOpacity;
        return progress >= 1;
      },
      dispose: () => {
        scene.remove(mesh);
        ringGeo.dispose();
        ringMat.dispose();
      }
    };
  }
}
