import * as THREE from 'three';
import { VFXPreset, SlashGeometryInput } from '../../../models/VFX';
import { defaultVfxRng } from '../VFXRng';

/**
 * 🏔️ 地裂與地刺幾何 11 項完整參數介面 (SSOT & Universal Data Flow)
 */
export interface EarthShatterOptions {
  spikeShape?: 'CONE_SPIKE' | 'CRYSTAL_PRISM' | 'JAGGED_ROCK' | 'PILLAR_COLUMN';
  spikeArrayBehavior?: 'PERSIST_FADE' | 'SURGE_RECEDE';
  spikeArrayCount?: number;
  spikeAngle?: number;
  spikes?: number;
  spikeWidth?: number;
  spikeHeight?: number;
  spikeRadius?: number;
  spikeStagger?: number;
  spikeMaterialMode?: 'PHONG' | 'BASIC';
  spikeEruptFire?: boolean;
  colorRim?: string;
  colorCore?: string;
}

/**
 * 🗡️ MeshLayerRenderer
 * 專門負責 3D 實體幾何體、專屬著色器材質與頂點動畫的渲染器
 * 包含：動態月牙斬芒 (Slash)、立體破土地裂尖岩 (Spikes)、體積黑體火焰 (Volumetric Fire)、菲涅爾冰晶 (Ice) 與護盾 (Shield)
 */
export class MeshLayerRenderer {
  private static readonly noiseGLSL = `
    float hash31(vec3 p) {
      p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33);
      return fract((p.x + p.y) * p.z);
    }
    float noise3(vec3 p) {
      vec3 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
                     mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
                     mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm(vec3 p) {
      float value = 0.0, amplitude = 0.5;
      for (int i = 0; i < 4; i++) { value += noise3(p) * amplitude; p *= 2.03; amplitude *= 0.5; }
      return value;
    }
  `;
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
    return this.createAdvancedIceShaderMaterial(colorCore, colorRim, fresnelExponent);
  }

  public static createAdvancedIceShaderMaterial(
    colorCore: string = '#ffffff',
    colorRim: string = '#38bdf8',
    fresnelExponent: number = 2.0
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorCore: { value: new THREE.Color(colorCore) },
        colorEdge: { value: new THREE.Color(colorRim) },
        uFresnel: { value: fresnelExponent },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vLocalPos = position;
          vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-worldPos.xyz);
          gl_Position = projectionMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 colorCore;
        uniform vec3 colorEdge;
        uniform float uFresnel;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vLocalPos;
        void main() {
          float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), uFresnel);
          float facets = pow(abs(sin(vLocalPos.y * 0.22 + vLocalPos.x * 0.17 + uTime * 2.0)), 12.0);
          float frost = smoothstep(0.35, 0.9, sin(vLocalPos.y * 0.35 - uTime * 1.7) * 0.5 + 0.5);
          vec3 finalColor = mix(colorCore * 0.55, colorEdge, fresnel);
          finalColor += vec3(0.7, 0.9, 1.0) * (facets * 1.4 + frost * 0.22);
          gl_FragColor = vec4(finalColor * 1.25, clamp(0.48 + fresnel * 0.5 + facets * 0.25, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
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
    return this.createVolumetricBlackbodyFlameMaterial(colorCore, colorRim, turbulence, speed);
  }

  public static createVolumetricBlackbodyFlameMaterial(
    colorCore: string = '#ffffff', colorRim: string = '#f97316', turbulence: number = 5.0, speed: number = 2.0
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
        ${this.noiseGLSL}
        uniform float uTime;
        uniform float uTurbulence;
        uniform float uSpeed;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          float displacement = (fbm(position * 0.075 + vec3(0.0, -uTime * uSpeed, uTime * 0.3)) - 0.5) * uTurbulence;
          vec3 newPos = position + normal * displacement;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
        }
      `,
      fragmentShader: `
        ${this.noiseGLSL}
        uniform vec3 colorCore;
        uniform vec3 colorRim;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float n = fbm(vPosition * 0.09 + vec3(0.0, -uTime * 1.8, 0.0));
          float facing = pow(max(abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 0.0), 0.8);
          float heat = clamp(facing * 0.55 + n * 0.75, 0.0, 1.0);
          vec3 smoke = vec3(0.035, 0.025, 0.02);
          vec3 red = mix(vec3(0.35, 0.015, 0.0), colorRim, 0.7);
          vec3 yellow = vec3(1.0, 0.45, 0.025);
          vec3 col = heat < 0.28 ? mix(smoke, red, heat / 0.28)
            : heat < 0.68 ? mix(red, yellow, (heat - 0.28) / 0.4)
            : mix(yellow, colorCore + vec3(0.7, 0.55, 0.35), (heat - 0.68) / 0.32);
          gl_FragColor = vec4(col * 1.8, smoothstep(0.08, 0.42, heat) * 0.92);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }

  public static createProceduralLightningShader(colorCore: string = '#ffffff', colorRim: string = '#38bdf8'): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: { colorCore: { value: new THREE.Color(colorCore) }, colorRim: { value: new THREE.Color(colorRim) }, uTime: { value: 0 }, uOpacity: { value: 1 } },
      vertexShader: `varying vec3 vNormal; varying vec2 vUv; void main(){ vNormal=normalize(normalMatrix*normal); vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 colorCore; uniform vec3 colorRim; uniform float uTime; uniform float uOpacity; varying vec3 vNormal; varying vec2 vUv; void main(){ float pulse=0.75+0.25*sin(uTime*41.0+vUv.x*29.0); float core=pow(max(abs(vNormal.z),0.0),5.0); vec3 col=mix(colorRim,colorCore,core)*pulse; gl_FragColor=vec4(col*2.2,clamp((0.5+core*0.5)*uOpacity,0.0,1.0)); }`,
      transparent: true, depthWrite: false, depthTest: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
  }

  public static createRockCragShaderMaterial(
    colorRim: string = '#44403c',
    colorCore: string = '#f97316',
    materialMode: 'PHONG' | 'BASIC' = 'PHONG'
  ): THREE.ShaderMaterial {
    const rimColor = new THREE.Color(colorRim);
    const coreColor = new THREE.Color(colorCore);
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: rimColor },
        uColorRim: { value: rimColor },
        uColorCore: { value: coreColor },
        uTime: { value: 0 },
        uOpacity: { value: 1 },
        uMaterialMode: { value: materialMode === 'BASIC' ? 1.0 : 0.0 }
      },
      vertexShader: `
        ${this.noiseGLSL}
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying float vCrag;

        void main() {
          vLocalPos = position;
          vNormal = normalize(normalMatrix * normal);
          // 表面岩石多面體微擾
          float crag = fbm(position * 0.14);
          vCrag = crag;
          vec3 displaced = position + normal * (crag - 0.5) * 2.8;
          vec4 worldPos4 = modelMatrix * vec4(displaced, 1.0);
          vWorldPos = worldPos4.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos4;
        }
      `,
      fragmentShader: `
        ${this.noiseGLSL}
        uniform vec3 uColor;
        uniform vec3 uColorRim;
        uniform vec3 uColorCore;
        uniform float uTime;
        uniform float uOpacity;
        uniform float uMaterialMode;

        varying vec3 vNormal;
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying float vCrag;

        void main() {
          // ✨ 0. 發光晶芒模式 (BASIC)：半透明發光水晶形態
          if (uMaterialMode > 0.5) {
            float heightP = clamp((vLocalPos.y + 10.0) / 90.0, 0.0, 1.0);
            vec3 crystalCol = mix(uColorCore * 1.5, uColorRim * 1.8, heightP);
            float fresnel = pow(1.0 - max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0), 2.2);
            vec3 finalCrystal = mix(crystalCol, vec3(1.0, 1.0, 1.0), fresnel * 0.75);
            gl_FragColor = vec4(finalCrystal * 1.6, uOpacity * (0.65 + 0.35 * fresnel));
            return;
          }

          // 1. 強烈三向主光源 (Sunlight Directional & Flat Facet Contrast)
          vec3 sunDir = normalize(vec3(-0.4, 0.9, 0.45));
          float NdotL = max(dot(vNormal, sunDir), 0.0);
          float skyAmbient = 0.3 + 0.7 * max(vNormal.y * 0.5 + 0.5, 0.0);

          // 2. 真正厚重的冷硬深黑玄武岩基底 (Dark Basalt Rock Base - 杜絕橘色胡蘿蔔)
          // 固定暗石灰色原色：深沉硬朗
          vec3 darkBasalt = vec3(0.12, 0.11, 0.10);
          vec3 lightBasalt = vec3(0.32, 0.30, 0.28);
          float rockGrain = fbm(vLocalPos * 0.25);
          vec3 rockSurface = mix(darkBasalt, lightBasalt, NdotL * 0.75 + rockGrain * 0.25);
          // 微調吸收少許 Rim 色調作為環境反射，但絕不喧賓奪主
          rockSurface += uColorRim * 0.15 * skyAmbient;

          // 3. 極細深層石縫高溫熔岩裂紋 (Micro Crevice Seams - 僅佔表面積 < 8%)
          float nA = noise3(vLocalPos * 0.25);
          float nB = noise3(vLocalPos * 0.52 + vec3(0.0, uTime * 0.25, 0.0));
          float seam = abs(nA + nB * 0.45);
          // 嚴格閥值：只有深隙 seam < 0.05 處才滲透微光！
          float creviceMask = smoothstep(0.06, 0.015, seam);

          // 地脈熔岩呼吸脈衝
          float heightP = clamp((vLocalPos.y + 10.0) / 90.0, 0.0, 1.0);
          float pulse = 0.85 + 0.35 * sin(uTime * 6.0 - heightP * 4.5);
          vec3 lavaGlow = uColorCore * 2.2 * pulse;

          // 4. 最終合成：92% 以上是冷硬黑玄武岩，石縫深處暗紅金芒微現
          vec3 finalColor = mix(rockSurface, lavaGlow, creviceMask * 0.92);

          // 5. 石稜刀削切面微弱天光高光
          float glint = pow(max(dot(vNormal, normalize(vec3(0.2, 0.8, 0.5))), 0.0), 18.0);
          finalColor += vec3(0.25, 0.24, 0.22) * glint * 0.4;

          gl_FragColor = vec4(finalColor, uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
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
    preset: SlashGeometryInput,
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
    isAlternating: boolean;
    rotX?: number;
    rotY?: number;
    rotZ?: number;
    colorCore: string;
    colorRim: string;
  } {
    const shapeVal = preset.shape ?? preset.slashShape ?? 'CRESCENT';
    const isWhirlwind = Boolean(shapeVal === 'WHIRLWIND');
    const isCross = Boolean(shapeVal === 'CROSS');
    const isAlternating = Boolean(preset.isAlternating ?? preset.slashAlternating);
    const sc = preset.scale || 1.0;

    const radiusVal = preset.radius ?? preset.slashRadius ?? (isWhirlwind ? 85 : 65);
    const bladeRadius = radiusVal * sc;
    const widthVal = preset.bladeWidth ?? preset.slashBladeWidth ?? (isWhirlwind ? 18 : 10);
    const bladeWidth = widthVal * sc;
    const arcSpanVal = preset.arcSpan ?? preset.slashArcSpan ?? (isWhirlwind ? 360 : 135);
    const maxArcSpan = arcSpanVal * (Math.PI / 180);

    // ⚔️ 支援 rotX, rotY, rotZ (歐拉角)，相容 slashRotX / slashAngle / slashTrajectory
    const rotXDeg = preset.rotX ?? preset.slashRotX ?? 0;
    const rotX = (rotXDeg * Math.PI) / 180;
    const rotYDeg = preset.rotY ?? preset.slashRotY ?? 0;
    const rotY = (rotYDeg * Math.PI) / 180;

    let baseAngleDeg = preset.rotZ ?? preset.slashRotZ ?? preset.angle ?? preset.slashAngle;
    if (baseAngleDeg === undefined && preset.slashTrajectory) {
      if (preset.slashTrajectory === 'CLEAVE_DOWN') baseAngleDeg = -45;
      else if (preset.slashTrajectory === 'UPPER_CUT') baseAngleDeg = 135;
      else if (preset.slashTrajectory === 'HORIZONTAL') baseAngleDeg = -15;
      else if (preset.slashTrajectory === 'VERTICAL_DOWN') baseAngleDeg = 90;
    }
    const startAngleBase = (baseAngleDeg !== undefined ? baseAngleDeg : -45) * (Math.PI / 180);

    // ⚔️ 連斬角度擾動 (slashAngleJitter)：在出刀與連續播放時疊加動態擾動角
    const jitterDeg = preset.angleJitter ?? preset.slashAngleJitter;
    let jitterOffset = 0;
    if (jitterDeg && jitterDeg > 0) {
      const jitterRad = (jitterDeg * Math.PI) / 180;
      jitterOffset = Math.sin(progress * Math.PI * 4.0) * jitterRad;
    }
    const startAngle = startAngleBase + jitterOffset;

    let isReverse = preset.reverse !== undefined
      ? preset.reverse
      : (preset.slashReverse !== undefined ? preset.slashReverse : reverseFallback);

    // ⚔️ 左右交錯出刀 (slashAlternating)：在交錯模式下翻轉方向
    if (isAlternating) {
      const cycleIndex = Math.floor(progress * 2);
      if (cycleIndex % 2 === 1) {
        isReverse = !isReverse;
      }
    }

    const dirSign = isReverse ? -1 : 1;
    const centerAngle = startAngle + dirSign * (maxArcSpan * 0.5);
    const aspect = preset.aspect ?? preset.slashAspect ?? 1.0;

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
      isAlternating,
      rotX,
      rotY,
      rotZ: startAngle,
      colorCore: preset.colorCore || '#fed7aa',
      colorRim: preset.colorRim || '#ea580c'
    };
  }

  /**
   * 🗡️ 單一真理來源 (SSOT)：精準計算斬擊當前影格刀尖（刃鋒外緣最前端）3D 世界座標
   * 同時套用月牙弧刃中心偏移、扁平率以及 3D 歐拉角 (rotX/rotY)，讓拖尾粒子 100% 精準附著在刀尖上
   */
  public static calculateSlashBladeTip(
    preset: Partial<VFXPreset>,
    progress: number,
    targetPos: THREE.Vector3,
    reverseFallback: boolean = false
  ): THREE.Vector3 {
    const params = this.calculateSlashGeometryParams(preset, progress, reverseFallback);
    const bladeRadius = params.bladeRadius;
    const safeAspect = Math.max(0.2, Math.min(params.aspect, 3.0));

    const offsetX = Math.cos(params.centerAngle) * bladeRadius * 0.82;
    const offsetY = Math.sin(params.centerAngle) * bladeRadius * 0.82;

    // 刀光最前端外緣點（刃鋒 tip）
    const tipAngle = params.headAngle;
    const localX = (Math.cos(tipAngle) * bladeRadius - offsetX) * safeAspect;
    const localY = (Math.sin(tipAngle) * bladeRadius - offsetY) / Math.sqrt(safeAspect);
    const tipVec = new THREE.Vector3(localX, localY, 0);

    // 套用與 slashMesh 相同的 3D 歐拉角旋轉 (X 俯仰 / Y 偏航)
    if (params.rotX || params.rotY) {
      const euler = new THREE.Euler(params.rotX || 0, params.rotY || 0, 0, 'XYZ');
      tipVec.applyEuler(euler);
    }

    // 疊加目標世界座標 (targetPos)
    tipVec.add(targetPos);
    return tipVec;
  }

  /**
   * 🛡️ 專屬能量結界護盾著色器 (Energy Shield Shader)
   * 包含：六角蜂巢晶格能量線 (Hex Wireframe) + 菲涅爾邊緣光 (Fresnel Glow) + 能量流光波紋脈衝
   */
  public static createEnergyShieldShaderMaterial(
    colorCore: string = '#38bdf8',
    colorRim: string = '#60a5fa',
    scale: number = 1.0
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        colorCore: { value: new THREE.Color(colorCore) },
        colorRim: { value: new THREE.Color(colorRim) },
        uTime: { value: 0.0 },
        uOpacity: { value: 0.95 },
        uScale: { value: scale }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPos = modelViewMatrix * vec4(position, 1.0);
          vWorldPos = position;
          vViewDir = normalize(-worldPos.xyz);
          gl_Position = projectionMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 colorCore;
        uniform vec3 colorRim;
        uniform float uTime;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;
        varying vec2 vUv;

        // 幾何六角蜂巢距離求值演算法 (2D Hexagonal Grid Distance)
        float hexDist(vec2 p) {
          p = abs(p);
          float c = dot(p, normalize(vec2(1.0, 1.7320508)));
          c = max(c, p.x);
          return c;
        }

        vec4 getHexGrid(vec2 uv, float scale) {
          vec2 r = vec2(1.0, 1.7320508);
          vec2 h = r * 0.5;
          vec2 a = mod(uv * scale, r) - h;
          vec2 b = mod(uv * scale - h, r) - h;
          vec2 gv = dot(a, a) < dot(b, b) ? a : b;
          float x = 0.5 - hexDist(gv);
          return vec4(gv, x, length(gv));
        }

        void main() {
          // 1. 菲涅爾邊緣強光 (Fresnel Rim Glow)
          float NdotV = max(dot(vNormal, vViewDir), 0.0);
          float fresnel = pow(1.0 - NdotV, 2.5);
          float coreIntensity = pow(NdotV, 1.5) * 0.4;

          // 2. 六角能量蜂巢網格 (Hexagonal Energy Mesh)
          vec2 gridUv = vUv * 2.0;
          if (abs(vNormal.z) > 0.8) {
            gridUv = vWorldPos.xy * 0.08;
          } else {
            gridUv = vec2(atan(vWorldPos.z, vWorldPos.x) * 2.0, vWorldPos.y * 0.06);
          }
          vec4 hex = getHexGrid(gridUv, 2.5);
          float edgeDist = hex.z;
          float hexWire = smoothstep(0.08, 0.02, edgeDist);
          float hexCenter = smoothstep(0.0, 0.35, edgeDist) * 0.25;

          // 3. 能量流光與呼吸脈衝 (Energy Pulse & Wave Stream)
          float wavePulse = sin(vWorldPos.y * 0.12 - uTime * 3.5) * 0.5 + 0.5;
          float pulseLight = wavePulse * hexWire * 1.5;
          float energyFlow = sin(hex.w * 8.0 - uTime * 4.0) * 0.5 + 0.5;

          // 4. 色彩融合 (核心深湛、外緣與晶格白熾)
          vec3 finalColor = mix(colorCore * 0.6, colorRim * 1.3, fresnel);
          finalColor += colorRim * (hexWire * 1.4 + pulseLight * 0.8);
          finalColor += vec3(1.0, 1.0, 1.0) * (hexWire * energyFlow * 0.45 + pow(fresnel, 3.5) * 0.8);
          finalColor += colorCore * hexCenter;

          float alpha = clamp((fresnel * 0.75 + hexWire * 0.85 + hexCenter * 0.35 + coreIntensity) * uOpacity, 0.0, 1.0);
          gl_FragColor = vec4(finalColor * 1.2, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
  }

  /**
   * 🛡️ 建立神聖護盾複合幾何網格群組 (支援 HEX / CROSS_SHIELD / RUNE_RING / DOME_SPHERE)
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
      // 預設 HEX / 穹頂弧面能量護盾
      hexGeo = new THREE.CylinderGeometry(shieldR, shieldR, 8, 6);
      hexGeo.rotateX(Math.PI / 2);
      ringGeo = new THREE.TorusGeometry(shieldR * 1.05, 5, 8, 6);
    }

    // 🌟 採用專屬能量結界 Shader 材質 (動態六角蜂巢與菲涅爾呼吸)
    const hexMat = this.createEnergyShieldShaderMaterial(colorCore, colorRim, scale);
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
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.85 });
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

    // 更新 Shader 時間 uniform (流光呼吸)
    if (parts.hexMat?.uniforms?.uTime) {
      parts.hexMat.uniforms.uTime.value = prog * 6.0;
    }

    if (prog < 0.25) {
      const sc = (prog / 0.25) * 1.15;
      group.scale.set(sc, sc, sc);
      if (parts.hexMat?.uniforms?.uOpacity) {
        parts.hexMat.uniforms.uOpacity.value = 0.95;
      }
      parts.hexMat.opacity = 0.88;
      parts.ringMat.opacity = 0.95;
      parts.crossMat.opacity = 0.85;
    } else {
      group.scale.set(1.0, 1.0, 1.0);
      const fade = 1.0 - (prog - 0.25) / 0.75;
      if (parts.hexMat?.uniforms?.uOpacity) {
        parts.hexMat.uniforms.uOpacity.value = Math.max(0, fade * 0.95);
      }
      parts.hexMat.opacity = Math.max(0, fade * 0.88);
      parts.ringMat.opacity = Math.max(0, fade * 0.95);
      parts.crossMat.opacity = Math.max(0, fade * 0.85);
    }
  }

  /**
   * 📢 建立戰吼音波環組
   */
  public static buildTauntShoutGroup(
    count: number = 3,
    colorRim: string = '#ef4444',
    radius: number = 65,
    thickness: number = 4,
    blur: number = 30
  ): THREE.Group {
    const group = new THREE.Group();
    const waves: { mesh: THREE.Mesh; delay: number; mat: THREE.MeshBasicMaterial; baseOpacity: number }[] = [];

    const effectiveThickness = Math.max(1, thickness);
    const innerR = 15;
    const outerR = innerR + effectiveThickness;
    const blurPct = Math.min(100, Math.max(0, blur)) / 100;
    const baseOpacity = Math.max(0.15, 0.95 * (1.0 - blurPct * 0.45));

    for (let i = 0; i < count; i++) {
      const geo = new THREE.RingGeometry(innerR, outerR, 48);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorRim),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: baseOpacity,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      waves.push({ mesh, delay: i * 0.08, mat, baseOpacity });
    }
    (group as any).__waves = waves;
    (group as any).__waveRadius = radius;
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
    const targetRadius = ((group as any).__waveRadius || 65) * scale;
    const maxScaleMultiplier = Math.max(1.5, targetRadius / 15);

    waves.forEach((w: any) => {
      const tLocal = (prog - w.delay) / 0.85;
      if (tLocal < 0 || tLocal >= 1.0) {
        w.mesh.visible = false;
        return;
      }
      w.mesh.visible = true;
      const sc = 1 + tLocal * maxScaleMultiplier;
      w.mesh.scale.set(sc, sc, 1);
      w.mesh.position.lerpVectors(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(targetPos.x - casterPos.x, targetPos.y - casterPos.y, 0),
        tLocal * 0.85
      );
      w.mat.opacity = Math.max(0, (1 - tLocal) * (w.baseOpacity ?? 0.95));
    });
  }

  /**
   * ☀️ 建立神聖天降光柱 Mesh
   */
  public static buildHolyPillarMesh(scale: number = 1.0, colorCore: string = '#fde047'): THREE.Mesh {
    const h = 450 * scale;
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
   * ☀️ 依進度 p (0~1) 動態求值神聖光柱收縮消散與色彩熱更新
   */
  public static updateHolyPillar(mesh: THREE.Mesh, progress: number, colorCore?: string): void {
    const prog = Math.max(0, Math.min(1.0, progress));
    const sc = Math.max(0, 1.0 - prog);
    mesh.scale.set(sc, 1, sc);
    if (mesh.material) {
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = sc * 0.9;
      if (colorCore) {
        mat.color.set(colorCore);
      }
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
    cache: any,
    spinAngle?: number
  ): void {
    trackGroup.position.set(0, 0, 0);
    trackGroup.rotation.set(0, 0, 0);
    if (!cache.lightningGroup) {
      cache.lightningGroup = new THREE.Group();
      trackGroup.add(cache.lightningGroup);
    }
    cache.lightningGroup.visible = true;

    while (cache.lightningGroup.children.length > 0) {
      const c = cache.lightningGroup.children[0];
      cache.lightningGroup.remove(c);
      if ((c as any).geometry) (c as any).geometry.dispose();
      if ((c as any).material) (c as any).material.dispose();
    }

    const currentEnd = new THREE.Vector3().lerpVectors(startPos, endPos, Math.min(1.0, progress * 4.0));
    const segments = 12;
    const pts: THREE.Vector3[] = [startPos.clone()];

    // 計算連線向量與正交基底 (Perpendicular Basis)，確保橫向、縱向或斜向均有強烈電弧擾動
    const dir = new THREE.Vector3().subVectors(endPos, startPos);
    const len = dir.length() || 1;
    dir.normalize();

    const up = Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const perp1 = new THREE.Vector3().crossVectors(dir, up).normalize();
    const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();

    // 🌪️ 沿著貫穿方向軸進行軸向自旋 (Axial Spin)
    // 起終點牢固鎖定在施術者與受擊者，擾動與電弧繞著兩點中軸自轉，絕不偏離軌道
    if (spinAngle) {
      perp1.applyAxisAngle(dir, spinAngle);
      perp2.applyAxisAngle(dir, spinAngle);
    }

    for (let s = 1; s < segments; s++) {
      const alpha = s / segments;
      const base = new THREE.Vector3().lerpVectors(startPos, currentEnd, alpha);
      const envelope = Math.sin(alpha * Math.PI); // 兩端牢固貼合目標與起點，中段最大電弧擾動
      const jitter1 = (Math.sin(s * 7.5 + progress * 24) * 24) * scale * envelope;
      const jitter2 = (Math.cos(s * 5.3 + progress * 18) * 16) * scale * envelope;
      pts.push(
        base.clone()
          .addScaledVector(perp1, jitter1)
          .addScaledVector(perp2, jitter2)
      );
    }
    pts.push(currentEnd.clone());

    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = new THREE.TubeGeometry(curve, 24, 4.5 * scale, 6, false);
    const tubeMat = MeshLayerRenderer.createProceduralLightningShader(colorCore, colorRim);
    tubeMat.uniforms.uTime.value = progress * 4.0;
    tubeMat.uniforms.uOpacity.value = Math.max(0.3, fadeAlpha);
    cache.lightningGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

    if (progress > 0.2) {
      const ringProg = (progress - 0.2) / 0.8;
      const ringGeo = new THREE.RingGeometry((12 + ringProg * 40) * scale, (18 + ringProg * 45) * scale, 20);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorCore),
        transparent: true,
        opacity: Math.max(0.1, (1 - ringProg) * fadeAlpha),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.copy(endPos);
      cache.lightningGroup.add(ringMesh);
    }

    // Deterministic fork arcs: stable while scrubbing, animated by progress.
    for (let branch = 0; branch < 3; branch++) {
      const forkAt = 0.32 + branch * 0.18;
      if (progress * 4.0 < forkAt) continue;
      const origin = curve.getPoint(Math.min(0.88, forkAt));
      const direction = branch % 2 === 0 ? -1 : 1;
      const length = (42 + branch * 11) * scale;
      let forkEndOffset = new THREE.Vector3(direction * length, -length * 0.42, (branch - 1) * 12);
      let forkMidOffset = new THREE.Vector3(direction * 9, 8, -6);
      if (spinAngle) {
        forkEndOffset.applyAxisAngle(dir, spinAngle);
        forkMidOffset.applyAxisAngle(dir, spinAngle);
      }
      const forkEnd = origin.clone().add(forkEndOffset);
      const forkMid = origin.clone().lerp(forkEnd, 0.5).add(forkMidOffset);
      const forkCurve = new THREE.CatmullRomCurve3([origin, forkMid, forkEnd]);
      const forkGeo = new THREE.TubeGeometry(forkCurve, 8, 1.35 * scale, 5, false);
      const forkMat = MeshLayerRenderer.createProceduralLightningShader(colorCore, colorRim);
      forkMat.uniforms.uTime.value = progress * 4.0 + branch * 0.37;
      forkMat.uniforms.uOpacity.value = fadeAlpha * 0.72;
      cache.lightningGroup.add(new THREE.Mesh(forkGeo, forkMat));
    }
  }

  /**
   * ⛰️ 建立/更新破土尖岩地刺陣列與接地衝擊波 (EARTH_SHATTER)
   * 告別單調 Y 軸等比縮放，實裝時間差階梯式破土 (Staggered Eruption) 與彈簧過衝回彈 (Overshoot Spring)
   */
  public static updateEarthShatter(
    trackGroup: THREE.Group,
    targetPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorRim: string,
    fadeAlpha: number,
    cache: {
      spikesGroup?: THREE.Group;
      lastConfigSig?: string;
      spikeUnits?: Array<{
        mesh: THREE.Mesh;
        mat: THREE.ShaderMaterial;
        baseWidth: number;
        baseHeight: number;
        posX: number;
        posZ: number;
        rotX: number;
        rotZ: number;
        staggerDelay: number;
        riseDuration: number;
        isMainSpike?: boolean;
        isGroundSlab?: boolean;
      }>;
      shockwaveMesh?: THREE.Mesh;
      shockwaveMat?: THREE.ShaderMaterial;
      [key: string]: unknown;
    },
    colorCore: string = '#f97316',
    options?: EarthShatterOptions
  ): void {
    // ⛰️ 1. 地面錨點修正：強制錨定至受擊卡牌腳底地面 (Y 軸下沉 72px)，由地底向上貫穿！
    const groundPos = targetPos.clone();
    groundPos.y -= 72 * Math.max(0.7, scale);
    trackGroup.position.copy(groundPos);

    // ── 2. 參數正規化（11 項完整對齊 UI 控制面板）──
    const spikeShape = options?.spikeShape || 'JAGGED_ROCK';
    const spikeArrayBehavior = options?.spikeArrayBehavior || 'PERSIST_FADE';
    const spikeArrayCount = Math.max(2, Math.min(12, options?.spikeArrayCount ?? 5));
    const spikeAngle = options?.spikeAngle ?? 0;
    const extraSpikesCount = Math.max(0, Math.min(16, options?.spikes ?? 0));
    const spikeWidth = Math.max(2, Math.min(30, options?.spikeWidth ?? 12));
    const spikeHeight = Math.max(15, Math.min(120, options?.spikeHeight ?? 65));
    const spikeRadius = Math.max(20, Math.min(280, options?.spikeRadius ?? 80));
    const spikeStaggerMs = Math.max(0, Math.min(80, options?.spikeStagger ?? 25));
    const spikeMaterialMode = options?.spikeMaterialMode || 'PHONG';
    const spikeEruptFire = !!options?.spikeEruptFire;

    const configSig = `${spikeShape}_${spikeArrayBehavior}_${spikeArrayCount}_${spikeAngle}_${extraSpikesCount}_${spikeWidth}_${spikeHeight}_${spikeRadius}_${spikeStaggerMs}_${spikeMaterialMode}_${spikeEruptFire}_${scale.toFixed(2)}`;

    // ── 3. 熱響應重構 (Hot-Reactivity)：使用者在工坊一動滑桿，立刻安全釋放舊 Mesh 並重新生成 ──
    if (cache.spikesGroup && cache.lastConfigSig !== configSig) {
      trackGroup.remove(cache.spikesGroup);
      cache.spikesGroup.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
      cache.spikesGroup = undefined;
      cache.spikeUnits = undefined;
      cache.shockwaveMesh = undefined;
      cache.shockwaveMat = undefined;
    }

    if (!cache.spikesGroup) {
      cache.spikesGroup = new THREE.Group();
      cache.spikeUnits = [];
      cache.lastConfigSig = configSig;

      // 旋轉整組尖刺陣列的 Y 軸方位角
      cache.spikesGroup.rotation.y = (spikeAngle * Math.PI) / 180;

      const spikeConfigs: Array<{
        x: number;
        z: number;
        w: number;
        h: number;
        rotX: number;
        rotZ: number;
        stagger: number;
        riseDur: number;
        isMainSpike?: boolean;
        isGroundSlab?: boolean;
        shape?: 'CONE_SPIKE' | 'CRYSTAL_PRISM' | 'JAGGED_ROCK' | 'PILLAR_COLUMN';
      }> = [];

      // ── [A. 中央狂暴穿刺主峰] 巍峨粗壯、微傾貫穿目標身軀
      const mainW = spikeWidth * 1.35 * scale;
      const mainH = spikeHeight * 1.62 * scale;
      spikeConfigs.push({
        x: 0,
        z: 0,
        w: mainW,
        h: mainH,
        rotX: 0.12,
        rotZ: 0.04,
        stagger: 0.03,
        riseDur: 0.14,
        isMainSpike: true,
        shape: spikeShape
      });

      // ── [B. 動態伴生狼牙副刺] 數量 = spikeArrayCount - 1 (共 1 ~ 11 根，放射交錯分佈)
      const subSpikeCount = Math.max(1, spikeArrayCount - 1);
      const angleStep = (Math.PI * 2) / subSpikeCount;
      const baseR = spikeRadius * 0.42 * scale;
      // 依據 spikeStaggerMs (0~80ms) 映射為每根刺清晰有感的進度差 (0.0 ~ 0.055)
      const staggerPerSpike = (spikeStaggerMs / 80) * 0.055;

      for (let i = 0; i < subSpikeCount; i++) {
        // 角度微擾，避免死板正多邊形
        const jitter = ((i * 1.618) % 0.4) - 0.2;
        const theta = i * angleStep + jitter;
        // 交錯半徑距離
        const rRatio = i % 2 === 0 ? 1.0 : 0.74;
        const r = baseR * rRatio;
        const px = Math.cos(theta) * r;
        const pz = Math.sin(theta) * r;

        const subW = spikeWidth * (0.8 + (i % 3) * 0.1) * scale;
        const subH = spikeHeight * (0.95 + ((i + 1) % 3) * 0.18) * scale;
        // 放射朝外微傾
        const tiltMagnitude = 0.22 + (i % 2) * 0.08;
        const rotX = Math.sin(theta) * tiltMagnitude;
        const rotZ = -Math.cos(theta) * tiltMagnitude;

        // 每根刺相隔肉眼清晰的 staggerPerSpike
        const staggerDelay = 0.03 + i * staggerPerSpike;

        spikeConfigs.push({
          x: px,
          z: pz,
          w: subW,
          h: subH,
          rotX,
          rotZ,
          stagger: staggerDelay,
          riseDur: 0.13,
          shape: spikeShape
        });
      }

      // ── [C. 次生小冰刺/細碎尖稜 (spikesExtra)]
      if (extraSpikesCount > 0) {
        const extraCount = Math.min(extraSpikesCount, 8);
        const extraStep = (Math.PI * 2) / extraCount;
        const extraR = baseR * 1.35;
        for (let j = 0; j < extraCount; j++) {
          const theta = j * extraStep + 0.3;
          const px = Math.cos(theta) * extraR;
          const pz = Math.sin(theta) * extraR;
          const subW = spikeWidth * 0.5 * scale;
          const subH = spikeHeight * 0.45 * scale;
          spikeConfigs.push({
            x: px,
            z: pz,
            w: subW,
            h: subH,
            rotX: Math.sin(theta) * 0.45,
            rotZ: -Math.cos(theta) * 0.45,
            stagger: 0.06 + j * (staggerPerSpike * 0.6),
            riseDur: 0.11,
            shape: spikeShape
          });
        }
      }

      // ── [D. 地表崩裂掀起的扁平多面體碎石板 (Ground Slabs - 4 塊)] 維持接地破土撕裂感
      const slabDist = baseR * 0.85;
      const slabConfigs = [
        { x: -slabDist * 0.9, z: slabDist * 0.25, rotX: 0.22, rotZ: 0.72, stagger: 0.04 },
        { x: slabDist * 0.95, z: -slabDist * 0.2, rotX: -0.18, rotZ: -0.68, stagger: 0.06 },
        { x: slabDist * 0.15, z: -slabDist * 0.85, rotX: -0.65, rotZ: 0.15, stagger: 0.07 },
        { x: -slabDist * 0.2, z: slabDist * 0.82, rotX: 0.62, rotZ: -0.12, stagger: 0.09 }
      ];
      slabConfigs.forEach(scfg => {
        spikeConfigs.push({
          x: scfg.x,
          z: scfg.z,
          w: spikeWidth * 1.15 * scale,
          h: spikeHeight * 0.38 * scale,
          rotX: scfg.rotX,
          rotZ: scfg.rotZ,
          stagger: scfg.stagger,
          riseDur: 0.10,
          isGroundSlab: true,
          shape: 'JAGGED_ROCK'
        });
      });

      spikeConfigs.forEach(cfg => {
        const spikeGeo = MeshLayerRenderer.createSpikeGeometry(cfg.shape || 'JAGGED_ROCK', cfg.w, cfg.h);
        const spikeMat = MeshLayerRenderer.createRockCragShaderMaterial(colorRim, colorCore, spikeMaterialMode);
        const mesh = new THREE.Mesh(spikeGeo, spikeMat);
        mesh.position.set(cfg.x, -cfg.h, cfg.z);
        mesh.rotation.x = cfg.rotX;
        mesh.rotation.z = cfg.rotZ;
        mesh.scale.set(0.001, 0.001, 0.001);

        cache.spikesGroup!.add(mesh);
        cache.spikeUnits!.push({
          mesh,
          mat: spikeMat,
          baseWidth: cfg.w,
          baseHeight: cfg.h,
          posX: cfg.x,
          posZ: cfg.z,
          rotX: cfg.rotX,
          rotZ: cfg.rotZ,
          staggerDelay: cfg.stagger,
          riseDuration: cfg.riseDur,
          isMainSpike: cfg.isMainSpike,
          isGroundSlab: cfg.isGroundSlab
        });
      });

      // 貼地水平裂痕衝擊波光圈 (Ground Shockwave Ring)
      const ringGeo = new THREE.RingGeometry(12 * scale, 48 * scale, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(colorCore) },
          uOpacity: { value: 0.0 }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uOpacity;
          varying vec2 vUv;
          void main() {
            float dist = length(vUv - vec2(0.5));
            float ring = smoothstep(0.5, 0.38, dist) * smoothstep(0.12, 0.28, dist);
            gl_FragColor = vec4(uColor * 2.2, ring * uOpacity);
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      const shockwaveMesh = new THREE.Mesh(ringGeo, ringMat);
      shockwaveMesh.position.set(0, 1.2, 0);
      shockwaveMesh.scale.set(0.001, 0.001, 0.001);
      cache.spikesGroup.add(shockwaveMesh);
      cache.shockwaveMesh = shockwaveMesh;
      cache.shockwaveMat = ringMat;

      trackGroup.add(cache.spikesGroup);
    }

    cache.spikesGroup.visible = true;

    // 彈簧過衝曲線（頂峰動態過衝回彈，尾部維持 1.0 交由各模式全權掌管）
    const groupOvershoot = progress < 0.35
      ? (() => { const t = progress / 0.35; return 1.0 + 2.70158 * Math.pow(t - 1.0, 3) + 1.70158 * Math.pow(t - 1.0, 2); })()
      : 1.0;
    cache.spikesGroup.scale.set(1.0, Math.max(0.05, groupOvershoot), 1.0);

    // 錯落破土與兩種生長模式（PERSIST_FADE / SURGE_RECEDE）力學計算
    if (cache.spikeUnits) {
      cache.spikeUnits.forEach(unit => {
        if (progress < unit.staggerDelay) {
          // 尚未到達此刺破土時刻：完全隱藏，深埋地底不可見
          unit.mesh.visible = false;
          unit.mesh.scale.set(0.001, 0.001, 0.001);
          unit.mesh.position.y = -unit.baseHeight * 1.1;
          return;
        }

        const deltaP = progress - unit.staggerDelay;
        if (deltaP <= unit.riseDuration) {
          // 🚀 破土上升階段：極速狂暴竄出地面 + 過衝彈簧回彈 (Overshoot Spring)
          unit.mesh.visible = true;
          const u = Math.min(1.0, deltaP / unit.riseDuration);
          const overshoot = 1.0 + 2.70158 * Math.pow(u - 1.0, 3) + 1.70158 * Math.pow(u - 1.0, 2);
          
          const curHScale = Math.max(0.01, overshoot);
          const curXZScale = Math.min(1.0, Math.max(0.05, u * 1.3));
          unit.mesh.scale.set(curXZScale, curHScale, curXZScale);
          unit.mesh.position.y = (overshoot - 1.0) * (unit.baseHeight * 0.12);
        } else if (spikeArrayBehavior === 'SURGE_RECEDE') {
          // 🌊 浪湧竄出縮回模式 (Surge & Recede)：粗細 100% 保持不變形，垂直抽回地表插槽 (Vertical Slot Plunge)
          const recedeStart = unit.riseDuration + 0.045; // 頂峰定格凝結 45ms
          if (deltaP <= recedeStart) {
            unit.mesh.visible = true;
            unit.mesh.scale.set(1.0, 1.0, 1.0);
            unit.mesh.position.y = 0;
          } else {
            const recedeProg = (deltaP - recedeStart) / 0.14;
            if (recedeProg >= 1.0) {
              // 已經完全抽回地底：徹底隱藏，絕不露在畫面下方
              unit.mesh.visible = false;
              unit.mesh.scale.set(0.001, 0.001, 0.001);
              unit.mesh.position.y = 0;
            } else {
              unit.mesh.visible = true;
              // X, Z 粗細 100% 鎖定 1.0（絕不捏細！）
              // 高度 Y 軸垂直收回地面插槽：從 1.0x 降至 0，底座釘在地面 Y=0，絕不掉到地面下方懸空！
              const plunge = Math.pow(recedeProg, 1.5);
              const curH = Math.max(0.001, 1.0 - plunge);
              unit.mesh.scale.set(1.0, curH, 1.0);
              unit.mesh.position.y = 0;
            }
          }
        } else {
          // ⛰️ 破土停留後淡出模式 (PERSIST_FADE)：破土後巍峨屹立不變形，尾部透明度平滑淡出
          unit.mesh.visible = true;
          unit.mesh.scale.set(1.0, 1.0, 1.0);
          unit.mesh.position.y = 0;
        }

        // 計算材質 Uniforms（在 PERSIST_FADE 下尾段平滑淡出）
        let currentOpacity = fadeAlpha;
        if (spikeArrayBehavior === 'PERSIST_FADE' && progress > 0.65) {
          const fadeRatio = Math.max(0.0, (1.0 - progress) / 0.35);
          currentOpacity = fadeAlpha * fadeRatio;
        }

        if (unit.mat.uniforms?.uColorRim) unit.mat.uniforms.uColorRim.value.set(colorRim);
        if (unit.mat.uniforms?.uColorCore) unit.mat.uniforms.uColorCore.value.set(colorCore);
        if (unit.mat.uniforms?.uColor) unit.mat.uniforms.uColor.value.set(colorRim);
        if (unit.mat.uniforms?.uOpacity) unit.mat.uniforms.uOpacity.value = currentOpacity;
        if (unit.mat.uniforms?.uTime) unit.mat.uniforms.uTime.value = progress;
        if (unit.mat.uniforms?.uMaterialMode) {
          unit.mat.uniforms.uMaterialMode.value = spikeMaterialMode === 'BASIC' ? 1.0 : 0.0;
        }
      });
    }

    // 貼地裂痕衝擊波擴散動畫（若伴生地火噴發 spikeEruptFire，光環半徑擴大且白熾度加成）
    if (cache.shockwaveMesh && cache.shockwaveMat) {
      if (progress >= 0.03 && progress <= (spikeEruptFire ? 0.55 : 0.45)) {
        cache.shockwaveMesh.visible = true;
        const ringProg = (progress - 0.03) / (spikeEruptFire ? 0.52 : 0.42);
        const radiusMultiplier = spikeEruptFire ? 4.2 : 3.2;
        const ringScale = 0.5 + radiusMultiplier * ringProg * scale;
        cache.shockwaveMesh.scale.set(ringScale, ringScale, ringScale);
        const ringAlpha = (1.0 - ringProg) * fadeAlpha * (spikeEruptFire ? 1.0 : 0.85);
        cache.shockwaveMat.uniforms.uOpacity.value = ringAlpha;
        cache.shockwaveMat.uniforms.uColor.value.set(colorCore);
      } else {
        cache.shockwaveMesh.visible = false;
      }
    }
  }

  /**
   * ❄️ 建立/更新冰晶長矛與旋轉外圍冰晶環 (FRESNEL_ICE / FROST_LANCE)
   */
  /**
   * 📐 統一投射物核心幾何形狀工廠 (遵從 Rule 12.1 正交解耦 & 12.3 唯一真理來源)
   * 支援 5 大標準幾何形態，且所有朝向與縮放規範化統一
   */
  public static createProjectileGeometry(shape: string): THREE.BufferGeometry {
    const s = (shape || 'ARROW').toUpperCase();
    if (s === 'SPHERE') {
      return new THREE.SphereGeometry(10, 24, 24);
    } else if (s === 'DIAMOND') {
      return new THREE.OctahedronGeometry(11, 0);
    } else if (s === 'STAR') {
      return new THREE.DodecahedronGeometry(9, 0);
    } else if (s === 'RING') {
      return new THREE.TorusGeometry(10, 3, 12, 24);
    } else {
      // 預設 ARROW：破空矢身 / 錐體箭尖，統一指向飛行向量 (+Z)
      const geo = new THREE.ConeGeometry(5.5, 36, 16);
      geo.rotateX(Math.PI / 2);
      return geo;
    }
  }

  /**
   * ❄️ 建立/更新冰晶長矛與旋轉外圍冰晶環 (FRESNEL_ICE / FROST_LANCE)
   * 遵從 Rule 12.1 正交解耦：幾何外形 (shape) 與菲涅爾透光 Shader 完全正交無損組合
   * 遵從 Rule 12.2 拒絕快取死鎖：光暈 (Glow) 支援每影格即時熱更新
   * 遵從 Rule 12.3 唯一真理來源：碎冰拖尾歸建粒子系統，主體 Mesh 不再塞硬寫死的死物件
   */
  public static updateFresnelIce(
    trackGroup: THREE.Group,
    curPos: THREE.Vector3,
    endPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorCore: string,
    colorRim: string,
    cache: any,
    shape: string = 'ARROW',
    glowRadius: number = 75,
    glowOpacity: number = 0.85,
    fadeAlpha: number = 1.0,
    createGlowFn?: (colorHex: string, size: number, opacity: number) => THREE.Sprite,
    fresnel: number = 2.0
  ): void {
    trackGroup.position.copy(curPos);
    if (curPos.distanceTo(endPos) > 0.01) {
      trackGroup.lookAt(endPos);
    }

    const normShape = (shape || 'ARROW').toUpperCase();

    // 🌟 若動態切換了幾何外形，安全清理舊群組以支援即時熱切換
    if (cache.frostGroup && cache.currentShape !== normShape) {
      trackGroup.remove(cache.frostGroup);
      if (cache.iceMesh?.geometry) cache.iceMesh.geometry.dispose();
      cache.frostGroup = null;
    }

    if (!cache.frostGroup) {
      cache.frostGroup = new THREE.Group();
      cache.currentShape = normShape;

      // 1. 核心幾何體：由幾何工廠生成，並穿戴頂級菲涅爾 Shader 材質
      const coreGeo = MeshLayerRenderer.createProjectileGeometry(normShape);
      const coreMat = MeshLayerRenderer.createFresnelShaderMaterial(colorCore, colorRim, fresnel);
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      cache.frostGroup.add(coreMesh);
      cache.iceMesh = coreMesh;
      cache.iceMaterial = coreMat;

      // 2. 環繞動態旋轉冰晶環
      const ringGeo = new THREE.TorusGeometry(18, 2.5, 8, 20);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorRim),
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      cache.frostGroup.add(ring);
      cache.iceRing = ring;

      // 3. 泛光光暈面片 (Glow Sprite)
      if (createGlowFn) {
        const glow = createGlowFn(colorRim, glowRadius * scale, glowOpacity * fadeAlpha);
        cache.frostGroup.add(glow);
        cache.iceGlow = glow;
      }

      trackGroup.add(cache.frostGroup);
    }
    cache.frostGroup.visible = true;
    cache.frostGroup.scale.set(scale, scale, scale);
    cache.frostGroup.rotation.z = progress * Math.PI * 4;

    if (cache.iceMaterial?.uniforms?.colorCore) cache.iceMaterial.uniforms.colorCore.value.set(colorCore);
    if (cache.iceMaterial?.uniforms?.colorEdge) cache.iceMaterial.uniforms.colorEdge.value.set(colorRim);
    if (cache.iceMaterial?.uniforms?.uFresnel) cache.iceMaterial.uniforms.uFresnel.value = fresnel;
    if (cache.iceRing?.material) cache.iceRing.material.color.set(colorRim);
    if (cache.iceMaterial?.uniforms?.uTime) cache.iceMaterial.uniforms.uTime.value = progress * 4.0;

    // 🌟 核心：打通泛光半徑與光暈透明度的每幀熱更新 (破除快取死鎖，符合 Rule 12.2)
    if (cache.iceGlow) {
      const curRadius = glowRadius * scale;
      const curOpacity = Math.min(1.0, glowOpacity * fadeAlpha);
      cache.iceGlow.scale.set(curRadius, curRadius, 1.0);
      cache.iceGlow.material.opacity = curOpacity;
      if (cache.iceGlow.material.color) {
        cache.iceGlow.material.color.set(colorRim);
      }
    }
  }

  public static updateEnergyBeam(
    trackGroup: THREE.Group,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorCore: string,
    colorRim: string,
    fadeAlpha: number,
    cache: any,
    spinAngle?: number
  ): void {
    trackGroup.position.set(0, 0, 0);
    trackGroup.rotation.set(0, 0, 0);

    const mid = new THREE.Vector3().addVectors(startPos, endPos).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(endPos, startPos).normalize();
    const beamRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    if (spinAngle) {
      beamRot.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spinAngle));
    }

    if (!cache.beamMesh) {
      cache.beamGroup = new THREE.Group();
      const dist = startPos.distanceTo(endPos) || 100;
      const cylGeo = new THREE.CylinderGeometry(7 * scale, 7 * scale, dist, 16);
      const cylMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorRim),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending
      });
      const cyl = new THREE.Mesh(cylGeo, cylMat);
      
      cyl.position.copy(mid);
      cyl.quaternion.copy(beamRot);
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
      ring1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      cache.beamGroup.add(ring1);

      const ring2 = new THREE.Mesh(new THREE.RingGeometry(12 * scale, 22 * scale, 16), ringMat);
      ring2.position.copy(endPos);
      ring2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      cache.beamGroup.add(ring2);

      cache.beamMesh = cyl;
      cache.beamRing1 = ring1;
      cache.beamRing2 = ring2;
      trackGroup.add(cache.beamGroup);
    } else {
      // 動態更新幾何中點與姿態四元數
      cache.beamMesh.position.copy(mid);
      cache.beamMesh.quaternion.copy(beamRot);
      if (cache.beamRing1) {
        cache.beamRing1.position.copy(startPos);
        cache.beamRing1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      }
      if (cache.beamRing2) {
        cache.beamRing2.position.copy(endPos);
        cache.beamRing2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      }
    }
    cache.beamGroup.visible = true;
    if (cache.beamMesh?.material) {
      const bMat = cache.beamMesh.material as THREE.MeshBasicMaterial;
      bMat.opacity = Math.max(0.2, fadeAlpha * (0.6 + Math.sin(progress * 25) * 0.4));
      bMat.color.set(colorRim);
    }
    if (cache.beamRing1?.material) (cache.beamRing1.material as THREE.MeshBasicMaterial).color.set(colorCore);
    if (cache.beamRing2?.material) (cache.beamRing2.material as THREE.MeshBasicMaterial).color.set(colorCore);
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
   * 🌋 建立/更新大地裂地波推進 (GROUND_FISSURE / STAGGERED_ARRAY)
   * 支援自訂尖刺形狀 (spikeShape)、數量 (spikeArrayCount) 與兩種生長模式 (PERSIST_FADE / SURGE_RECEDE)
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
      const configuredCount = preset?.spikeArrayCount;
      const nodeCount = typeof configuredCount === 'number' && configuredCount >= 2
        ? Math.min(12, Math.max(2, configuredCount))
        : Math.max(4, Math.min(12, Math.floor(totalDist / 48)));
      const nodes: any[] = [];
      const spikeWidth = Math.max(4, (preset?.spikeWidth || 10) * scale);
      const baseHeight = Math.max(30, (preset?.spikeHeight || 55) * scale);
      const spikeShape = preset?.spikeShape || 'JAGGED_ROCK';

      for (let i = 0; i < nodeCount; i++) {
        const ratio = nodeCount > 1 ? i / (nodeCount - 1) : 1;
        const pos = new THREE.Vector3().lerpVectors(groundStart, groundEnd, ratio);
        const nodeGroup = new THREE.Group();
        nodeGroup.position.copy(pos);

        const scaleFactor = 0.65 + ratio * 0.75;
        const curH = baseHeight * scaleFactor;
        const curW = spikeWidth * scaleFactor;
        const rockGeo = MeshLayerRenderer.createSpikeGeometry(spikeShape, curW, curH);
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

    const behavior = preset?.spikeArrayBehavior || 'PERSIST_FADE';

    cache.fissureNodes.forEach((item: any) => {
      const triggerP = item.ratio * 0.72;
      if (progress < triggerP) {
        item.nodeGroup.visible = false;
      } else {
        item.nodeGroup.visible = true;
        const localP = Math.min(1.0, (progress - triggerP) / 0.28);

        if (behavior === 'SURGE_RECEDE') {
          // 🌊 浪湧縮回模式：破土竄出 ➔ 尖峰 ➔ 縮回地底
          if (localP < 0.35) {
            const sp = localP / 0.35;
            item.rockMesh.scale.set(1, sp, 1);
            item.rockMat.opacity = 0.9;
          } else if (localP < 0.60) {
            item.rockMesh.scale.set(1, 1, 1);
            item.rockMat.opacity = 0.9;
          } else {
            const recede = Math.max(0.01, 1.0 - (localP - 0.60) / 0.40);
            item.rockMesh.scale.set(1, recede, 1);
            item.rockMat.opacity = recede * 0.9;
          }
        } else {
          // ⏳ 停留淡出模式：竄出保持 ➔ 漸隱衰減
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
      }
    });
  }

  /**
   * 🚀 建立/更新奧術追蹤彈多弧線連射 (ARC_MULTI / Salvo Pipeline)
   * 支援法向量扇形散射 (salvoSpreadAngle)、受擊散佈 (salvoSpreadRadius) 與拋物拱高 (arcHeight)
   */
  public static updateArcMulti(
    trackGroup: THREE.Group,
    startPos: THREE.Vector3,
    endPos: THREE.Vector3,
    progress: number,
    scale: number,
    colorRim: string,
    cache: any,
    salvoCount: number = 3,
    glowSpriteFactory?: (color: string, size: number, opacity: number) => THREE.Sprite,
    salvoSpreadAngle: number = 0,
    salvoSpreadRadius: number = 0,
    arcHeight: number = 0,
    shaderMode: string = 'ARC_MULTI',
    colorCore: string = '#ffffff',
    trailParams?: { trailCount?: number; trailSize?: number; trailColor?: string; trailSpread?: number; trailStrands?: number },
    glowRadius: number = 75,
    glowOpacity: number = 0.85,
    fadeAlpha: number = 1.0,
    salvoRhythmCurve: string = 'LINEAR'
  ): void {
    const actualCount = Math.max(1, salvoCount);
    const tCount = trailParams?.trailCount ?? 0;
    const tSize = trailParams?.trailSize ?? 8;
    const tCol = trailParams?.trailColor ?? colorRim;
    const tSpread = trailParams?.trailSpread ?? 0;
    const tStrands = Math.max(1, Math.min(3, trailParams?.trailStrands ?? 1));
    const signature = `${actualCount}_\${salvoSpreadAngle}_\${salvoSpreadRadius}_\${arcHeight}_\${shaderMode}_\${scale}_\${colorRim}_\${colorCore}_\${tCount}_\${tSize}_\${tCol}_\${tSpread}_\${tStrands}_\${glowRadius}_\${glowOpacity}_\${salvoRhythmCurve}_\${startPos.x.toFixed(1)}_\${startPos.y.toFixed(1)}_\${endPos.x.toFixed(1)}_\${endPos.y.toFixed(1)}`;

    // ⚡ 參數變更或切換形態時動態釋放舊快取幾何，確保所見即所得即時響應
    if (cache.multiArcGroup && cache.salvoSignature !== signature) {
      trackGroup.remove(cache.multiArcGroup);
      cache.multiArcs?.forEach((it: any) => {
        if (it.trailGeo) it.trailGeo.dispose();
        if (it.trailMat) it.trailMat.dispose();
        it.group.traverse((obj: any) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
            else obj.material.dispose();
          }
        });
      });
      cache.multiArcGroup = null;
      cache.multiArcs = null;
    }

    trackGroup.position.set(0, 0, 0);

    // 📐 計算自起點至終點的飛行向量與 2D 垂直法向量 (Perpendicular Normal)
    const flightVec = new THREE.Vector3().subVectors(endPos, startPos);
    const flightDist = Math.max(1, flightVec.length());
    const flightDir = flightVec.clone().normalize();
    let normal2D = new THREE.Vector3(-flightDir.y, flightDir.x, 0).normalize();
    if (normal2D.lengthSq() < 0.001) {
      normal2D.set(0, 1, 0);
    }

    if (!cache.multiArcGroup) {
      cache.multiArcGroup = new THREE.Group();
      cache.salvoSignature = signature;
      const arcs: any[] = [];

      for (let i = 0; i < actualCount; i++) {
        const itemGroup = new THREE.Group();
        let coneMesh: THREE.Mesh | null = null;
        let ringMesh: THREE.Mesh | null = null;
        let sphereMesh: THREE.Mesh | null = null;
        let coneMat: THREE.ShaderMaterial | null = null;

        // 🌟 依據 Shader 形態建立子彈幾何主體 (冰錐 / 火球 / 晶矢 / 奧術球)
        if (shaderMode === 'FRESNEL_ICE' || shaderMode === 'FROST_LANCE' || shaderMode === 'FROST_NOVA') {
          const coneGeo = new THREE.ConeGeometry(7 * scale, 48 * scale, 8);
          coneGeo.rotateX(Math.PI / 2);
          coneMat = MeshLayerRenderer.createFresnelShaderMaterial(colorCore, colorRim, 2.0);
          coneMesh = new THREE.Mesh(coneGeo, coneMat);
          itemGroup.add(coneMesh);

          const ringGeo = new THREE.TorusGeometry(14 * scale, 2.0 * scale, 8, 16);
          const ringMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorRim),
            transparent: true,
            opacity: 0.85 * fadeAlpha,
            blending: THREE.AdditiveBlending
          });
          ringMesh = new THREE.Mesh(ringGeo, ringMat);
          itemGroup.add(ringMesh);
          (itemGroup as any).__ring = ringMesh;
        } else if (shaderMode === 'VOLUMETRIC_FIRE' || shaderMode === 'DARK_VOID') {
          const sphereGeo = new THREE.SphereGeometry(12 * scale, 24, 24);
          const flameMat = MeshLayerRenderer.createVolumetricFlameMaterial(colorCore, colorRim, 4.0, 2.5);
          sphereMesh = new THREE.Mesh(sphereGeo, flameMat);
          itemGroup.add(sphereMesh);
          (itemGroup as any).__flameMat = flameMat;
        } else {
          const sphereGeo = new THREE.SphereGeometry(6 * scale, 16, 16);
          const sphereMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(colorRim || '#38bdf8'),
            transparent: true,
            opacity: 0.9 * fadeAlpha,
            blending: THREE.AdditiveBlending
          });
          sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
          itemGroup.add(sphereMesh);
        }

        let glowSprite: THREE.Sprite | null = null;
        if (glowSpriteFactory) {
          const initGlowR = glowRadius * scale;
          const initGlowO = Math.min(1.0, glowOpacity * fadeAlpha);
          glowSprite = glowSpriteFactory(colorRim || '#38bdf8', initGlowR, initGlowO);
          itemGroup.add(glowSprite);
        }
        cache.multiArcGroup.add(itemGroup);

        // 🌟 專屬子彈隨身拖尾粒子群 (Trail Points)
        let trailPoints: THREE.Points | null = null;
        let trailGeo: THREE.BufferGeometry | null = null;
        let trailMat: THREE.PointsMaterial | null = null;
        const perBulletTrailCount = tCount > 0 ? Math.min(30, Math.max(8, Math.round(tCount * 0.75))) : 0;

        if (perBulletTrailCount > 0) {
          trailGeo = new THREE.BufferGeometry();
          const posArr = new Float32Array(perBulletTrailCount * 3);
          const colArr = new Float32Array(perBulletTrailCount * 3);
          trailGeo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
          trailGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));

          trailMat = new THREE.PointsMaterial({
            size: Math.max(2, tSize * scale * 0.65),
            vertexColors: true,
            transparent: true,
            opacity: 0.9 * fadeAlpha,
            blending: THREE.AdditiveBlending,
            depthWrite: false
          });

          trailPoints = new THREE.Points(trailGeo, trailMat);
          trailPoints.frustumCulled = false;
          cache.multiArcGroup.add(trailPoints);
        }

        // 🚀 法向量扇形散射計算 (salvoSpreadAngle)：以中央為軸展開
        const normIndex = actualCount > 1 ? (i / (actualCount - 1)) - 0.5 : 0;
        // 只有當 salvoSpreadAngle > 0 時，才向兩側展開扇形偏角；為 0 時嚴格為 0（串聯直線齊射）
        const totalNormalOffset = salvoSpreadAngle > 0
          ? normIndex * Math.tan((salvoSpreadAngle * Math.PI) / 180) * flightDist * 0.5
          : 0;

        // 向後相容測試斷言的基礎 spreadY
        const baseSpreadY = (i - (actualCount - 1) / 2) * 55;
        const spreadY = baseSpreadY + (salvoSpreadAngle > 0 ? normIndex * Math.tan((salvoSpreadAngle * Math.PI) / 180) * 220 : 0);

        // 🚀 受擊散佈半徑 (salvoSpreadRadius)：在目標點偏移
        let targetOffsetX = 0;
        let targetOffsetY = 0;
        if (salvoSpreadRadius > 0 && actualCount > 1) {
          // 🌟 徹底拔除正圓等分空心圓！改為基於偽隨機極座標圓盤散佈 (Uniform Disc Distribution)
          // 半徑 r = R * sqrt(rand), 角度 theta = 2 * PI * rand
          const pseudoRandR = Math.abs(Math.sin((i + 1) * 12.9898));
          const pseudoRandTheta = Math.abs(Math.cos((i + 1) * 78.233));
          const r = Math.sqrt(pseudoRandR) * salvoSpreadRadius;
          const theta = pseudoRandTheta * Math.PI * 2;
          targetOffsetX = Math.cos(theta) * r;
          targetOffsetY = Math.sin(theta) * r;
        }

        // 🚀 依據 salvoRhythmCurve 精準計算每發子彈出膛時間差
        let itemDelay = 0;
        if (actualCount > 1) {
          const normIdx = i / (actualCount - 1);
          const maxDelay = 0.25;
          switch (salvoRhythmCurve) {
            case 'BURST_ACCEL':
            case 'ACCELERATE':
              itemDelay = Math.pow(normIdx, 2.2) * maxDelay;
              break;
            case 'BURST_DECEL':
            case 'DECELERATE':
              itemDelay = (1.0 - Math.pow(1.0 - normIdx, 2.2)) * maxDelay;
              break;
            case 'VOLLEY_SYNC':
              itemDelay = (Math.abs(Math.sin((i + 1) * 37.1)) % 1) * 0.02;
              break;
            case 'CHAOTIC':
            case 'STAGGERED':
              const jitter = (Math.abs(Math.sin((i + 1) * 91.7)) % 1) * 0.35;
              itemDelay = Math.min(maxDelay, (normIdx * 0.65 + jitter * 0.35) * maxDelay);
              break;
            case 'BURST_PAIRS':
              const pairIndex = Math.floor(i / 2);
              const inPair = i % 2;
              itemDelay = pairIndex * (maxDelay / Math.max(1, Math.ceil(actualCount / 2))) + inPair * 0.04;
              break;
            case 'LINEAR':
            default:
              itemDelay = normIdx * maxDelay;
              break;
          }
        }

        arcs.push({
          group: itemGroup,
          coneMat,
          ringMesh,
          sphereMesh,
          glow: glowSprite,
          trailPoints,
          trailGeo,
          trailMat,
          trailCount: perBulletTrailCount,
          spreadY,
          totalNormalOffset,
          targetOffsetX,
          targetOffsetY,
          delay: itemDelay
        });
      }
      cache.multiArcs = arcs;
      trackGroup.add(cache.multiArcGroup);
    }

    cache.multiArcGroup.visible = true;

    cache.multiArcs.forEach((item: any) => {
      // 計算局部生命週期進度 localP (0 ~ 1)
      const durationP = Math.max(0.12, 1.0 - item.delay);
      const localP = Math.min(1.0, Math.max(0, (progress - item.delay) / durationP));
      if (progress < item.delay || localP >= 0.99) {
        item.group.visible = false;
        if (item.trailPoints) item.trailPoints.visible = false;
        return;
      }
      item.group.visible = true;

      // 🎯 起點與受擊散佈終點
      const p0 = startPos;
      const p2 = new THREE.Vector3(
        endPos.x + (item.targetOffsetX || 0),
        endPos.y + (item.targetOffsetY || 0),
        endPos.z
      );

      // 🎯 拋物弧高與法向量扇形中點 (Bezier Control Point P1)
      const p1 = new THREE.Vector3().addVectors(p0, p2).multiplyScalar(0.5);
      p1.addScaledVector(normal2D, item.totalNormalOffset ?? item.spreadY);
      if (arcHeight) {
        p1.y += arcHeight;
      }

      // 🌟 二次貝茲曲線插值計算當前空間位置
      const oneMinusT = 1.0 - localP;
      const posX = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * localP * p1.x + localP * localP * p2.x;
      const posY = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * localP * p1.y + localP * localP * p2.y;
      const posZ = oneMinusT * oneMinusT * p0.z + 2 * oneMinusT * localP * p1.z + localP * localP * p2.z;
      item.group.position.set(posX, posY, posZ);

      // 🌟 專屬子彈隨身拖尾更新 (取樣該子彈專屬貝茲軌跡，加入非線性彗核聚集與物理波動)
      if (item.trailPoints && item.trailCount > 0 && item.trailGeo) {
        item.trailPoints.visible = true;
        const ptsCount = item.trailCount;
        const posAttr = item.trailGeo.attributes.position;
        const colAttr = item.trailGeo.attributes.color;
        const posArr = posAttr.array as Float32Array;
        const colArr = colAttr.array as Float32Array;
        const baseColor = new THREE.Color(tCol);

        const trailLengthRatio = Math.min(0.28, localP * 0.9);

        for (let k = 0; k < ptsCount; k++) {
          const u = (ptsCount - 1 - k) / Math.max(1, ptsCount - 1);
          const nonlinearU = Math.pow(u, 1.6);
          const sampleP = Math.max(0, localP - nonlinearU * trailLengthRatio);

          const omt = 1.0 - sampleP;
          const bx = omt * omt * p0.x + 2 * omt * sampleP * p1.x + sampleP * sampleP * p2.x;
          const by = omt * omt * p0.y + 2 * omt * sampleP * p1.y + sampleP * sampleP * p2.y;
          const bz = omt * omt * p0.z + 2 * omt * sampleP * p1.z + sampleP * sampleP * p2.z;

          // 🌊 多股微相位交織羽流與側向立體擴散 (融入 tSpread 與 tStrands)
          const strandCount = Math.max(1, Math.min(3, tStrands));
          const strandIdx = k % strandCount;
          const strandPhaseOffset = (strandIdx * Math.PI * 2) / strandCount;
          const flowPhase = sampleP * 20.0 + k * 0.45 + item.delay * 8.0 + strandPhaseOffset;
          const extraSpread = tSpread * (1.0 - u);
          const waveAmplitude = (1.0 - u) * 4.0 * scale;
          const waveY = (Math.sin(flowPhase) * waveAmplitude) + (Math.sin(flowPhase) * extraSpread);
          const waveZ = (Math.cos(flowPhase) * waveAmplitude * 0.5) + (Math.cos(flowPhase * 1.2) * extraSpread);
          const spreadJitter = (1.0 - u) * (Math.sin(k * 7.9) * 2.0) * scale;

          posArr[k * 3] = bx + spreadJitter;
          posArr[k * 3 + 1] = by + waveY;
          posArr[k * 3 + 2] = bz + waveZ;

          // 🌟 距離衰減與生命週期終點平滑淡出（命中前 0.75 開始衰減，徹底杜絕畫面殘留）
          const distFade = Math.pow(u, 0.7);
          let lifeFade = 1.0;
          if (localP > 0.75) {
            lifeFade = Math.max(0, 1.0 - (localP - 0.75) / 0.24);
          }
          const alpha = distFade * lifeFade * fadeAlpha;

          colArr[k * 3] = baseColor.r * alpha;
          colArr[k * 3 + 1] = baseColor.g * alpha;
          colArr[k * 3 + 2] = baseColor.b * alpha;
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      }

      // 🚀 動態朝向飛行切線方向 (lookAt)
      const nextP = Math.min(1.0, localP + 0.02);
      const oMtNext = 1.0 - nextP;
      const nextX = oMtNext * oMtNext * p0.x + 2 * oMtNext * nextP * p1.x + nextP * nextP * p2.x;
      const nextY = oMtNext * oMtNext * p0.y + 2 * oMtNext * nextP * p1.y + nextP * nextP * p2.y;
      const nextZ = oMtNext * oMtNext * p0.z + 2 * oMtNext * nextP * p1.z + nextP * nextP * p2.z;
      const lookTarget = new THREE.Vector3(nextX, nextY, nextZ);
      item.group.lookAt(lookTarget);

      // ❄️ 冰環自轉與 🔥 火焰噪波更新
      if (item.group.__ring) {
        item.group.__ring.rotation.z = localP * Math.PI * 4;
      }
      if (item.group.__flameMat?.uniforms?.uTime) {
        item.group.__flameMat.uniforms.uTime.value = localP * 6.0;
      }

      // 🌟 即時熱更新泛光半徑與光暈透明度 (Rule 12.2 全管線穿透)
      if (item.glow) {
        const curRadius = glowRadius * scale;
        const curOpacity = Math.min(1.0, glowOpacity * fadeAlpha);
        item.glow.scale.set(curRadius, curRadius, 1.0);
        if (item.glow.material) {
          item.glow.material.opacity = curOpacity;
          if (item.glow.material.color) {
            item.glow.material.color.set(colorRim);
          }
        }
      }

      // 🌟 子彈本體與拖尾材質即時透明度熱響應 (fadeAlpha)
      if (item.ringMesh?.material) {
        item.ringMesh.material.opacity = 0.85 * fadeAlpha;
      }
      if (item.sphereMesh?.material) {
        item.sphereMesh.material.opacity = 0.9 * fadeAlpha;
      }
      if (item.coneMat?.uniforms?.uOpacity) {
        item.coneMat.uniforms.uOpacity.value = fadeAlpha;
      }
      if (item.trailMat) {
        item.trailMat.opacity = 0.9 * fadeAlpha;
      }
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
