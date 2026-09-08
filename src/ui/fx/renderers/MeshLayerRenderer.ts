import * as THREE from 'three';
import { VFXPreset } from '../../../models/VFX';
import { defaultVfxRng } from '../VFXRng';

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
    const isWhirlwind = Boolean(preset.slashShape === 'WHIRLWIND');
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
   * 🛡️ 建立神聖護盾複合幾何網格群組 (支援 HEX / CROSS_SHIELD / RUNE_RING)
   */
  public static buildHolyShieldGroup(scale: number = 1.0, colorCore: string = '#fde047', colorRim: string = '#eab308', shape: string = 'HEX'): THREE.Group {
    const group = new THREE.Group();
    const shieldR = 70 * scale;

    let hexGeo: THREE.BufferGeometry;
    let ringGeo: THREE.BufferGeometry;

    if (shape === 'RUNE_RING') {
      hexGeo = new THREE.RingGeometry(shieldR * 0.35, shieldR * 0.85, 24);
      ringGeo = new THREE.TorusGeometry(shieldR * 1.05, 6 * scale, 12, 32);
    } else if (shape === 'CROSS_SHIELD') {
      hexGeo = new THREE.BoxGeometry(shieldR * 1.1, shieldR * 1.4, 6 * scale);
      ringGeo = new THREE.TorusGeometry(shieldR * 1.1, 8 * scale, 8, 4);
    } else {
      // 預設 HEX
      hexGeo = new THREE.CylinderGeometry(shieldR, shieldR, 8, 6);
      hexGeo.rotateX(Math.PI / 2);
      ringGeo = new THREE.TorusGeometry(shieldR * 1.05, 5, 8, 6);
    }

    const hexMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorCore),
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending
    });
    const hexMesh = new THREE.Mesh(hexGeo, hexMat);
    group.add(hexMesh);

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

    if (shape !== 'RUNE_RING') {
      group.add(crossVMesh);
      group.add(crossHMesh);
    }

    (group as any).__shieldParts = { hexMesh, ringMesh, crossVMesh, crossHMesh, hexMat, ringMat, crossMat, shape };
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

  /**
   * ⚡ 建立/更新天降狂暴雷殛閃電 Tube 群組 (DIELECTRIC_LIGHTNING)
   */
  public static updateLightningTube(
    trackGroup: THREE.Group,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorRim: string,
    colorCore: string,
    fadeAlpha: number,
    cache: any
  ): void {
    trackGroup.position.set(0, 0, 0);
    if (!cache.lightningGroup) {
      cache.lightningGroup = new THREE.Group();
      trackGroup.add(cache.lightningGroup);
    }
    cache.lightningGroup.visible = true;

    while (cache.lightningGroup.children.length > 0) {
      const c = cache.lightningGroup.children[0];
      cache.lightningGroup.remove(c);
      if ((c as any).geometry) (c as any).geometry.dispose();
    }

    const currentEnd = new THREE.Vector3().lerpVectors(startPos, endPos, Math.min(1.0, progress * 2.2));
    const segments = 10;
    const pts: THREE.Vector3[] = [startPos];
    for (let s = 1; s < segments; s++) {
      const alpha = s / segments;
      const base = new THREE.Vector3().lerpVectors(startPos, currentEnd, alpha);
      const jitter = (Math.sin(s * 7.5 + progress * 20) * 22) * scale;
      pts.push(new THREE.Vector3(base.x + jitter, base.y, base.z + (Math.cos(s * 5) * 12)));
    }
    pts.push(currentEnd);

    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 20, 4.5 * scale, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(colorRim),
      transparent: true,
      opacity: Math.max(0.3, fadeAlpha),
      blending: THREE.AdditiveBlending
    });
    cache.lightningGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

    if (progress > 0.3) {
      const ringProg = (progress - 0.3) / 0.7;
      const ringGeo = new THREE.RingGeometry((12 + ringProg * 40) * scale, (18 + ringProg * 45) * scale, 20);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorCore),
        transparent: true,
        opacity: Math.max(0.1, (1 - ringProg) * fadeAlpha),
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(endPos);
      cache.lightningGroup.add(ringMesh);
    }
  }

  /**
   * 🪨 建立/更新破土錐狀地刺尖岩陣列 (EARTH_SHATTER)
   */
  public static updateEarthShatter(
    trackGroup: THREE.Group,
    targetPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorRim: string,
    fadeAlpha: number,
    cache: any
  ): void {
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
        const coneGeo = new THREE.ConeGeometry(9 * scale * off.scale, 58 * scale * off.scale, 6);
        coneGeo.translate(0, 29 * scale * off.scale, 0);
        const coneMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(colorRim),
          wireframe: false
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(off.x * scale, off.y * scale, 0);
        cone.rotation.z = off.rot;
        cache.spikesGroup.add(cone);
      });
      trackGroup.add(cache.spikesGroup);
    }
    cache.spikesGroup.visible = true;

    const hScale = progress < 0.35
      ? Math.pow(progress / 0.35, 0.6)
      : (progress > 0.75 ? Math.max(0.1, 1 - (progress - 0.75) / 0.25) : 1.0);
    cache.spikesGroup.scale.set(1.0, Math.max(0.05, hScale), 1.0);

    cache.spikesGroup.children.forEach((mesh: any) => {
      if (mesh.material) {
        mesh.material.color.set(colorRim);
        mesh.material.opacity = fadeAlpha;
      }
    });
  }

  /**
   * ❄️ 建立/更新冰晶長矛與旋轉外圍冰晶環 (FRESNEL_ICE / FROST_LANCE)
   */
  public static updateFresnelIce(
    trackGroup: THREE.Group,
    curPos: THREE.Vector3,
    endPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorCore: string,
    colorRim: string,
    cache: any
  ): void {
    trackGroup.position.copy(curPos);
    trackGroup.lookAt(endPos);

    if (!cache.frostGroup) {
      cache.frostGroup = new THREE.Group();
      const coneGeo = new THREE.ConeGeometry(9 * scale, 60 * scale, 8);
      coneGeo.rotateX(Math.PI / 2);
      const coneMat = MeshLayerRenderer.createFresnelShaderMaterial(colorCore, colorRim, 2.0);
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cache.frostGroup.add(cone);

      const ringGeo = new THREE.TorusGeometry(18 * scale, 2.5 * scale, 8, 20);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorRim),
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      cache.frostGroup.add(ring);

      trackGroup.add(cache.frostGroup);
    }
    cache.frostGroup.visible = true;
    cache.frostGroup.rotation.z = progress * Math.PI * 4;
  }

  /**
   * 🔮 建立/更新貫穿圓柱能量光束與兩端聚能環 (ENERGY_BEAM)
   */
  public static updateEnergyBeam(
    trackGroup: THREE.Group,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorCore: string,
    colorRim: string,
    fadeAlpha: number,
    cache: any
  ): void {
    trackGroup.position.set(0, 0, 0);

    if (!cache.beamMesh) {
      cache.beamGroup = new THREE.Group();
      const dist = startPos.distanceTo(endPos) || 100;
      const cylGeo = new THREE.CylinderGeometry(7 * scale, 7 * scale, dist, 12);
      cylGeo.translate(0, dist / 2, 0);
      cylGeo.rotateX(Math.PI / 2);
      const cylMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorRim),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const cyl = new THREE.Mesh(cylGeo, cylMat);
      cyl.position.copy(startPos);
      cyl.lookAt(endPos);
      cache.beamGroup.add(cyl);

      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorCore),
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const ring1 = new THREE.Mesh(new THREE.RingGeometry(8 * scale, 16 * scale, 16), ringMat);
      ring1.position.copy(startPos);
      cache.beamGroup.add(ring1);

      const ring2 = new THREE.Mesh(new THREE.RingGeometry(12 * scale, 22 * scale, 16), ringMat);
      ring2.position.copy(endPos);
      cache.beamGroup.add(ring2);

      cache.beamMesh = cyl;
      trackGroup.add(cache.beamGroup);
    }
    cache.beamGroup.visible = true;
    if (cache.beamMesh?.material) {
      (cache.beamMesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0.2, fadeAlpha * (0.6 + Math.sin(progress * 25) * 0.4));
    }
  }

  /**
   * 🏹 建立/更新拋物線齊射箭雨 (PARABOLA_ARC)
   */
  public static updateParabolaArrows(
    trackGroup: THREE.Group,
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    progress: number,
    duration: number,
    scale: number,
    colorRim: string,
    cache: any
  ): void {
    trackGroup.position.set(0, 0, 0);
    if (!cache.arrowGroup) {
      cache.arrowGroup = new THREE.Group();
      const arrowCount = 9;
      const arrowGeo = new THREE.ConeGeometry(2.5 * scale, 24 * scale, 5);
      arrowGeo.rotateX(Math.PI / 2);
      const arrowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorRim || '#38bdf8'),
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
    const totalDuration = duration || 0.4;
    cache.arrowItems.forEach((item: any) => {
      const tLocal = (progress * totalDuration - item.delay) / (totalDuration * 0.85);
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
  }

  /**
   * 🌋 建立/更新大地裂地波推進 (GROUND_FISSURE)
   */
  public static updateGroundFissure(
    trackGroup: THREE.Group,
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorRim: string,
    cache: any,
    preset?: any
  ): void {
    trackGroup.position.set(0, 0, 0);
    if (!cache.fissureGroup) {
      cache.fissureGroup = new THREE.Group();
      const groundYOffset = -60;
      const groundStart = new THREE.Vector3(casterPos.x, casterPos.y + groundYOffset, 0);
      const groundEnd = new THREE.Vector3(targetPos.x, targetPos.y + groundYOffset, 0);
      const totalDist = groundStart.distanceTo(groundEnd);
      const nodeCount = Math.max(4, Math.min(12, Math.floor(totalDist / 48)));
      const nodes: any[] = [];
      const spikeWidth = Math.max(4, (preset?.spikeWidth || 10) * scale);
      const baseHeight = Math.max(30, (preset?.spikeHeight || 55) * scale);

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
          color: new THREE.Color(colorRim || '#94a3b8'),
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

    cache.fissureNodes.forEach((item: any) => {
      const triggerP = item.ratio * 0.72;
      if (progress < triggerP) {
        item.nodeGroup.visible = false;
      } else {
        item.nodeGroup.visible = true;
        const localP = Math.min(1.0, (progress - triggerP) / 0.28);
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
  }

  /**
   * 🚀 建立/更新奧術追蹤彈多弧線連射 (ARC_MULTI)
   */
  public static updateArcMulti(
    trackGroup: THREE.Group,
    casterPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorRim: string,
    cache: any,
    salvoCount: number = 3,
    glowSpriteFactory?: (color: string, size: number, opacity: number) => THREE.Sprite
  ): void {
    trackGroup.position.set(0, 0, 0);
    if (!cache.multiArcGroup) {
      cache.multiArcGroup = new THREE.Group();
      const arcs: any[] = [];
      const actualCount = Math.max(3, salvoCount);
      for (let i = 0; i < actualCount; i++) {
        const arcMesh = new THREE.Mesh(
          new THREE.SphereGeometry(6 * scale, 16, 16),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorRim || '#38bdf8'),
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending
          })
        );
        if (glowSpriteFactory) {
          const glow = glowSpriteFactory(colorRim || '#38bdf8', 26 * scale, 0.8);
          arcMesh.add(glow);
        }
        cache.multiArcGroup.add(arcMesh);
        const spreadY = (i - (actualCount - 1) / 2) * 55;
        arcs.push({ mesh: arcMesh, spreadY, delay: i * 0.06 });
      }
      cache.multiArcs = arcs;
      trackGroup.add(cache.multiArcGroup);
    }
    cache.multiArcGroup.visible = true;
    cache.multiArcs.forEach((item: any) => {
      const localP = Math.min(1.0, Math.max(0, (progress - item.delay) / (1.0 - item.delay || 0.1)));
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
  }

  /**
   * ❄️ 命中點次生冰刺/晶刺破裂爆發 (Secondary Spikes Burst - 支援多幾何形態)
   */
  public static spawnSecondarySpikes(
    scene: THREE.Scene,
    pos: THREE.Vector3,
    count: number,
    height: number,
    colorRimHex: string,
    preset?: VFXPreset,
    rng: () => number = defaultVfxRng
  ): {
    update: (delta: number) => boolean;
    dispose: () => void;
  } {
    const group = new THREE.Group();
    const isUpward = (preset?.spikeAngle !== undefined && preset.spikeAngle >= 45 && preset.spikeAngle <= 135) || (preset?.trajectory === 'GROUND_BURST') || (preset?.trajectory === 'GROUND_FISSURE');
    const basePos = pos.clone();
    if (isUpward) {
      basePos.y -= 65;
    }
    group.position.copy(basePos);
    scene.add(group);

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

    const orderIndices = Array.from({ length: count }, (_, idx) => idx);
    for (let i = orderIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = orderIndices[i];
      orderIndices[i] = orderIndices[j];
      orderIndices[j] = temp;
    }

    const eruptFire = preset?.spikeEruptFire || preset?.shaderMode === 'VOLUMETRIC_FIRE';

    for (let i = 0; i < count; i++) {
      let angle: number;
      let posX = 0;
      let posY = 0;
      const posZ = (rng() - 0.5) * 16;

      if (isUpward) {
        const t = count > 1 ? (i / (count - 1) - 0.5) : 0;
        posX = t * spreadRadius * 1.8;
        posY = (rng() - 0.5) * 6;
        const tilt = t * 0.45;
        angle = (preset?.spikeAngle !== undefined ? ((preset.spikeAngle * Math.PI) / 180) : Math.PI / 2) + tilt;
      } else if (isDirectional) {
        const span = 0.65;
        angle = baseRad + (count > 1 ? (i / (count - 1) - 0.5) * span : 0);
        const dist = (spreadRadius * 0.35) * (0.6 + (i / Math.max(1, count)) * 0.5);
        posX = Math.cos(angle) * dist;
        posY = Math.sin(angle) * dist;
      } else {
        angle = (i / count) * Math.PI * 2 + (rng() - 0.5) * 0.25;
        const dist = (spreadRadius * 0.45) * (0.7 + rng() * 0.6);
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
      const heightVar = 0.82 + rng() * 0.36;
      spikeItems.push({ mesh, mat: spikeMat, delay, heightVar, fireMesh });
    }

    let elapsed = 0;
    const spikeDuration = 0.38;
    const totalDuration = (count * staggerSec) + spikeDuration + 0.1;

    return {
      update: (delta: number) => {
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
        scene.remove(group);
        spikeGeo.dispose();
        spikeItems.forEach(item => {
          item.mat.dispose();
          if (item.fireMesh) {
            item.fireMesh.geometry.dispose();
            (item.fireMesh.material as THREE.Material).dispose();
          }
        });
      }
    };
  }
}
