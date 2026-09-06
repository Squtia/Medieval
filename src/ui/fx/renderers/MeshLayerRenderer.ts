import * as THREE from 'three';
import { VFXPreset } from '../../../models/VFX';

/**
 * 🗡️ MeshLayerRenderer
 * 專門負責 3D 實體幾何體、專屬著色器材質與頂點動畫的渲染器
 * 包含：動態月牙斬芒 (Slash)、立體破土地裂尖岩 (Spikes)、體積黑體火焰 (Volumetric Fire)、菲涅爾冰晶 (Ice) 與護盾 (Shield)
 */
export class MeshLayerRenderer {
  /**
   * 🎨 專屬劍氣漸層著色器：外緣白熾刀刃，內弧透明漸散，兩端收尖
   */
  public static createSlashShaderMaterial(colorCore: string, colorRim: string): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorCore: { value: new THREE.Color(colorCore) },
        colorRim: { value: new THREE.Color(colorRim) },
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
          float edgeAlpha = pow(vUv.y, 2.2);
          float tipAlpha = sin(vUv.x * 3.1415926);
          float finalAlpha = edgeAlpha * tipAlpha * uOpacity;
          vec3 finalColor = mix(colorRim, mix(colorCore, vec3(1.0, 1.0, 1.0), pow(vUv.y, 3.5)), vUv.y);
          gl_FragColor = vec4(finalColor * 1.5, finalAlpha);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }

  /**
   * ⚔️ 動態月牙弧芒幾何生成器（依揮砍角度與扁平率計算頂點並平移至目標胸膛中心）
   */
  public static buildDynamicSlashGeo(
    bladeRadius: number,
    bladeWidth: number,
    headAngle: number,
    tailAngle: number,
    centerAngle: number,
    aspect: number = 1.0
  ): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const segments = 24;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const offsetX = Math.cos(centerAngle) * bladeRadius * 0.82;
    const offsetY = Math.sin(centerAngle) * bladeRadius * 0.82;
    const safeAspect = Math.max(0.2, Math.min(aspect, 3.0));

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = tailAngle + t * (headAngle - tailAngle);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const rInner = bladeRadius - bladeWidth;
      const rOuter = bladeRadius;

      const posXInner = (cosA * rInner - offsetX) * safeAspect;
      const posYInner = (sinA * rInner - offsetY) / Math.sqrt(safeAspect);
      positions.push(posXInner, posYInner, 0);
      uvs.push(t, 0.0);

      const posXOuter = (cosA * rOuter - offsetX) * safeAspect;
      const posYOuter = (sinA * rOuter - offsetY) / Math.sqrt(safeAspect);
      positions.push(posXOuter, posYOuter, 0);
      uvs.push(t, 1.0);
    }

    for (let i = 0; i < segments; i++) {
      const idx = i * 2;
      indices.push(idx, idx + 1, idx + 2);
      indices.push(idx + 1, idx + 3, idx + 2);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /**
   * 🔮 菲涅爾冰晶著色器材質
   */
  public static createFresnelShaderMaterial(
    colorCore: string = '#ffffff',
    colorRim: string = '#38bdf8',
    fresnelExponent: number = 2.0
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorCore: { value: new THREE.Color(colorCore) },
        colorEdge: { value: new THREE.Color(colorRim) },
        uFresnel: { value: fresnelExponent }
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
        uniform float uFresnel;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), uFresnel);
          vec3 finalColor = mix(colorCore, colorEdge, fresnel);
          gl_FragColor = vec4(finalColor, 0.9 + fresnel * 0.1);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }

  /**
   * 🔮 菲涅爾冰晶著色器材質（相容舊呼叫）
   */
  public static createIceShaderMaterial(colorCore: string = '#38bdf8', colorRim: string = '#ffffff', fresnel: number = 2.0): THREE.ShaderMaterial {
    return this.createFresnelShaderMaterial(colorCore, colorRim, fresnel);
  }

  /**
   * 🔥 體積黑體動態火焰著色器 (Simplex Noise 頂點法線顫動)
   */
  public static createVolumetricFlameMaterial(
    colorCore: string = '#ffffff',
    colorRim: string = '#f97316',
    turbulence: number = 5.0,
    speed: number = 2.0
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorCore: { value: new THREE.Color(colorCore) },
        colorRim: { value: new THREE.Color(colorRim) },
        uTime: { value: 0 },
        uTurbulence: { value: turbulence },
        uSpeed: { value: speed }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uTurbulence;
        uniform float uSpeed;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          float displacement = sin(position.x * 0.15 + uTime * uSpeed * 6.0) *
                               cos(position.y * 0.15 + uTime * uSpeed * 4.0) * uTurbulence;
          vec3 newPos = position + normal * displacement;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 colorCore;
        uniform vec3 colorRim;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float intensity = pow(dot(vNormal, vec3(0.0, 0.0, 1.0)), 1.2);
          vec3 col = mix(colorRim, colorCore, intensity);
          gl_FragColor = vec4(col * 1.6, 0.85);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }

  /**
   * 🌋 地刺幾何形態建立器 (尖錐、六角稜柱、粗糙裂岩、破土樁)
   */
  public static createSpikeGeometry(
    shape: 'CONE_SPIKE' | 'CRYSTAL_PRISM' | 'JAGGED_ROCK' | 'PILLAR_COLUMN' = 'JAGGED_ROCK',
    width: number = 7,
    height: number = 45
  ): THREE.BufferGeometry {
    let geo: THREE.BufferGeometry;
    if (shape === 'CRYSTAL_PRISM') {
      geo = new THREE.CylinderGeometry(width * 0.7, width, height, 6);
    } else if (shape === 'PILLAR_COLUMN') {
      geo = new THREE.CylinderGeometry(width, width, height, 8);
    } else if (shape === 'JAGGED_ROCK') {
      geo = new THREE.ConeGeometry(width * 1.3, height, 5);
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setX(i, x * (0.85 + (i % 3) * 0.12));
        pos.setZ(i, z * (0.9 + ((i + 1) % 3) * 0.1));
      }
      pos.needsUpdate = true;
    } else {
      geo = new THREE.ConeGeometry(width, height, 8);
    }

    // 錨點設於底座，向上突出
    geo.translate(0, height / 2, 0);
    return geo;
  }

  /**
   * 📐 單一真理來源 (SSOT)：計算斬擊幾何形態與角度參數
   * 同時供定格求值 (Scrubbing) 與動態播放 (Playing) 呼叫，保證 100% 姿態與方向一致
   */
  public static calculateSlashGeometryParams(
    preset: Partial<VFXPreset>,
    progress: number,
    reverseFallback: boolean = false
  ): {
    bladeRadius: number;
    bladeWidth: number;
    headAngle: number;
    tailAngle: number;
    centerAngle: number;
    aspect: number;
    isCross: boolean;
    isWhirlwind: boolean;
    colorCore: string;
    colorRim: string;
  } {
    const isWhirlwind = Boolean((preset.id && preset.id.includes('WHIRLWIND')) || preset.slashShape === 'WHIRLWIND');
    const isCross = Boolean(preset.slashShape === 'CROSS');
    const sc = preset.scale || 1.0;

    const bladeRadius = (preset.slashRadius || (isWhirlwind ? 85 : 65)) * sc;
    const bladeWidth = (preset.slashBladeWidth || (isWhirlwind ? 18 : 10)) * sc;
    const maxArcSpan = (isWhirlwind ? 360 : (preset.slashArcSpan || 135)) * (Math.PI / 180);
    const startAngle = (preset.slashAngle !== undefined ? preset.slashAngle : -45) * (Math.PI / 180);

    const isReverse = preset.slashReverse !== undefined 
      ? preset.slashReverse 
      : (preset.reverse !== undefined ? preset.reverse : reverseFallback);
    const dirSign = isReverse ? -1 : 1;
    const centerAngle = startAngle + dirSign * (maxArcSpan * 0.5);
    const aspect = preset.slashAspect || 1.0;

    const p = Math.max(0, Math.min(1.0, progress));
    let headT: number;
    let tailT: number;
    if (p < 0.45) {
      const pHead = Math.max(0, Math.min(p / 0.45, 1));
      headT = Math.pow(pHead, 0.7);
      tailT = Math.pow(pHead, 2.4) * 0.2;
    } else {
      const pTail = Math.max(0, Math.min((p - 0.45) / 0.55, 1));
      headT = 1.0;
      tailT = 0.2 + Math.pow(pTail, 1.4) * 0.8;
    }
    if (headT - tailT < 0.18) headT = Math.min(1.0, tailT + 0.18);

    const headAngle = startAngle + dirSign * headT * maxArcSpan;
    const tailAngle = startAngle + dirSign * tailT * maxArcSpan;

    return {
      bladeRadius,
      bladeWidth,
      headAngle,
      tailAngle,
      centerAngle,
      aspect,
      isCross,
      isWhirlwind,
      colorCore: preset.colorCore || '#fed7aa',
      colorRim: preset.colorRim || '#ea580c'
    };
  }

  /**
   * 🛡️ 建立神聖護盾複合幾何網格群組 (六角柱 + 外環 + 雙十字)
   */
  public static buildHolyShieldGroup(scale: number = 1.0, colorCore: string = '#fde047', colorRim: string = '#eab308'): THREE.Group {
    const group = new THREE.Group();
    const shieldR = 70 * scale;

    const hexGeo = new THREE.CylinderGeometry(shieldR, shieldR, 8, 6);
    hexGeo.rotateX(Math.PI / 2);
    const hexMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorCore),
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending
    });
    const hexMesh = new THREE.Mesh(hexGeo, hexMat);
    group.add(hexMesh);

    const ringGeo = new THREE.TorusGeometry(shieldR * 1.05, 5, 8, 6);
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorRim),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    const crossVGeo = new THREE.BoxGeometry(10 * scale, shieldR * 1.2, 4);
    const crossHGeo = new THREE.BoxGeometry(shieldR * 0.9, 10 * scale, 4);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending });
    const crossVMesh = new THREE.Mesh(crossVGeo, crossMat);
    const crossHMesh = new THREE.Mesh(crossHGeo, crossMat);
    group.add(crossVMesh);
    group.add(crossHMesh);

    (group as any).__shieldParts = { hexMesh, ringMesh, crossVMesh, crossHMesh, hexMat, ringMat, crossMat };
    return group;
  }

  /**
   * 🛡️ 依進度 p (0~1) 動態求值護盾膨脹與淡出
   */
  public static updateHolyShield(group: THREE.Group, progress: number): void {
    const parts = (group as any).__shieldParts;
    if (!parts) return;
    const prog = Math.max(0, Math.min(1.0, progress));

    if (prog < 0.25) {
      const sc = (prog / 0.25) * 1.15;
      group.scale.set(sc, sc, sc);
      parts.hexMat.opacity = 0.88;
      parts.ringMat.opacity = 0.95;
      parts.crossMat.opacity = 1.0;
    } else {
      group.scale.set(1.0, 1.0, 1.0);
      const fade = 1.0 - (prog - 0.25) / 0.75;
      parts.hexMat.opacity = Math.max(0, fade * 0.88);
      parts.ringMat.opacity = Math.max(0, fade * 0.95);
      parts.crossMat.opacity = Math.max(0, fade);
    }
  }

  /**
   * 📢 建立戰吼音波環組
   */
  public static buildTauntShoutGroup(count: number = 3, colorRim: string = '#ef4444'): THREE.Group {
    const group = new THREE.Group();
    const waves: { mesh: THREE.Mesh; delay: number; mat: THREE.MeshBasicMaterial }[] = [];

    for (let i = 0; i < count; i++) {
      const geo = new THREE.RingGeometry(20, 32, 32);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorRim),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      waves.push({ mesh, delay: i * 0.08, mat });
    }
    (group as any).__waves = waves;
    return group;
  }

  /**
   * 📢 依進度 p (0~1) 動態求值戰吼音波平移擴散
   */
  public static updateTauntShout(
    group: THREE.Group,
    progress: number,
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    scale: number = 1.0
  ): void {
    const waves = (group as any).__waves;
    if (!waves) return;
    const prog = Math.max(0, Math.min(1.0, progress));

    waves.forEach((w: any) => {
      const tLocal = (prog - w.delay) / 0.85;
      if (tLocal < 0 || tLocal >= 1.0) {
        w.mesh.visible = false;
        return;
      }
      w.mesh.visible = true;
      const sc = 1 + tLocal * 5.5 * scale;
      w.mesh.scale.set(sc, sc, 1);
      w.mesh.position.lerpVectors(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(targetPos.x - casterPos.x, targetPos.y - casterPos.y, 0),
        tLocal * 0.85
      );
      w.mat.opacity = Math.max(0, (1 - tLocal) * 0.95);
    });
  }

  /**
   * ☀️ 建立神聖天降光柱 Mesh
   */
  public static buildHolyPillarMesh(scale: number = 1.0, colorCore: string = '#fde047'): THREE.Mesh {
    const h = 450;
    const geo = new THREE.CylinderGeometry(20 * scale, 30 * scale, h, 24);
    geo.translate(0, h / 2, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorCore),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    return new THREE.Mesh(geo, mat);
  }

  /**
   * ☀️ 依進度 p (0~1) 動態求值神聖光柱收縮消散
   */
  public static updateHolyPillar(mesh: THREE.Mesh, progress: number): void {
    const prog = Math.max(0, Math.min(1.0, progress));
    const sc = Math.max(0, 1.0 - prog);
    mesh.scale.set(sc, 1, sc);
    if (mesh.material) {
      (mesh.material as THREE.MeshBasicMaterial).opacity = sc * 0.9;
    }
  }
}
