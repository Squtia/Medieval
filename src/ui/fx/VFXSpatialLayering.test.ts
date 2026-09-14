import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolvePresetSpatialMode, resolveVFXWorldStart, VFX_RENDER_ORDER } from './VFXSpatialPolicy';
import { MeshLayerRenderer } from './renderers/MeshLayerRenderer';
import defaultVFXSequences from '../../data/vfx_sequences.json';
import { VFXSequence } from '../../models/VFX';

describe('VFX spatial and layering policy', () => {
  it('maps a trajectory-only vertical-drop preset to the sky-to-target mode', () => {
    expect(resolvePresetSpatialMode({ trajectory: 'VERTICAL_DROP' })).toBe('VERTICAL_SKY_TO_B');
    expect(resolvePresetSpatialMode({ trajectory: 'DIAGONAL_DROP' })).toBe('DIAGONAL_SKY_TO_B');
  });

  it('maps the shipped Storm Bolt preset without relying on a synthetic fixture', () => {
    const stormBolt = (defaultVFXSequences as VFXSequence[]).find(s => s.id === 'VFX_LIGHTNING_BOLT');
    expect(stormBolt).toBeDefined();
    expect(stormBolt?.spatialMode).toBe('VERTICAL_SKY_TO_B');
  });

  it('preserves an explicitly authored spatial mode', () => {
    expect(resolvePresetSpatialMode({
      spatialMode: 'AT_CASTER',
      trajectory: 'VERTICAL_DROP'
    })).toBe('AT_CASTER');
  });

  it('starts vertical lightning above the target instead of at the caster', () => {
    const caster = new THREE.Vector3(-120, 20, 7);
    const target = new THREE.Vector3(140, 35, 11);
    const start = resolveVFXWorldStart('VERTICAL_DROP', caster, target);

    expect(start.toArray()).toEqual([140, 415, 11]);
    expect(start.y).toBeGreaterThanOrEqual(target.y + 300);
    expect(start.equals(caster)).toBe(false);
  });

  it('defines deterministic back-to-front layer bands', () => {
    expect(VFX_RENDER_ORDER.GROUND).toBeLessThan(VFX_RENDER_ORDER.MAIN);
    expect(VFX_RENDER_ORDER.MAIN).toBeLessThan(VFX_RENDER_ORDER.TRAIL);
    expect(VFX_RENDER_ORDER.TRAIL).toBeLessThan(VFX_RENDER_ORDER.IMPACT);
  });

  it('keeps every dedicated transparent shader out of the depth-write buffer', () => {
    const materials = [
      MeshLayerRenderer.createProceduralLightningShader(),
      MeshLayerRenderer.createAdvancedIceShaderMaterial(),
      MeshLayerRenderer.createVolumetricBlackbodyFlameMaterial(),
      MeshLayerRenderer.createRockCragShaderMaterial()
    ];

    materials.forEach(material => {
      expect(material.transparent).toBe(true);
      expect(material.depthWrite).toBe(false);
      expect(material.depthTest).toBe(true);
      material.dispose();
    });
  });

  it('builds lightning branches, an ionization ring, and an ice-crystal trail', () => {
    const lightningRoot = new THREE.Group();
    const lightningCache: any = {};
    MeshLayerRenderer.updateLightningTube(
      lightningRoot,
      new THREE.Vector3(0, 380, 0),
      new THREE.Vector3(0, 0, 0),
      0.5,
      1,
      '#38bdf8',
      '#ffffff',
      1,
      lightningCache
    );
    expect(lightningCache.lightningGroup.children.length).toBeGreaterThanOrEqual(5);

    const iceRoot = new THREE.Group();
    const iceCache: any = {};
    MeshLayerRenderer.updateFresnelIce(
      iceRoot,
      new THREE.Vector3(),
      new THREE.Vector3(100, 0, 0),
      0.5,
      1,
      '#ffffff',
      '#38bdf8',
      iceCache
    );
    expect(iceCache.iceTrail.children).toHaveLength(7);
    expect(iceCache.iceMaterial.uniforms.uTime.value).toBe(2);
  });

  it('uses the rock shader and overshoots during the earth eruption', () => {
    const root = new THREE.Group();
    const cache: any = {};
    MeshLayerRenderer.updateEarthShatter(root, new THREE.Vector3(), 0.3, 1, '#78716c', 1, cache);

    expect(cache.spikesGroup.scale.y).toBeGreaterThan(1);
    cache.spikesGroup.children.forEach((spike: THREE.Mesh) => {
      expect(spike.material).toBeInstanceOf(THREE.ShaderMaterial);
      expect((spike.material as THREE.ShaderMaterial).depthWrite).toBe(false);
    });
  });

  it('🏔️ 動態連動驗證：spikeArrayCount 動態生成對應數量副刺，且熱響應 (Hot-Reactivity) 重構正確', () => {
    const root = new THREE.Group();
    const cache: any = {};
    // 預設 5 根：1 主峰 + 4 狼牙副刺 + 4 碎石板 = 9 個 units
    MeshLayerRenderer.updateEarthShatter(root, new THREE.Vector3(), 0.3, 1, '#78716c', 1, cache, '#f97316', {
      spikeArrayCount: 5,
      spikeShape: 'JAGGED_ROCK'
    });
    expect(cache.spikeUnits.length).toBe(9);

    // 調整至 9 根：1 主峰 + 8 狼牙副刺 + 4 碎石板 = 13 個 units
    MeshLayerRenderer.updateEarthShatter(root, new THREE.Vector3(), 0.3, 1, '#78716c', 1, cache, '#f97316', {
      spikeArrayCount: 9,
      spikeShape: 'CRYSTAL_PRISM'
    });
    expect(cache.spikeUnits.length).toBe(13);

    // 驗證幾何切換為 CRYSTAL_PRISM 六角稜柱水晶
    const mainSpike = cache.spikeUnits.find((u: any) => u.isMainSpike);
    expect(mainSpike).toBeDefined();
    expect(mainSpike.mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
  });

  it('🌊 生長模式驗證：SURGE_RECEDE 在刺出後迅速縮回地底', () => {
    const root = new THREE.Group();
    const cache: any = {};
    // 在 p = 0.65 時，SURGE_RECEDE 應已開始回縮且 Y 軸高度縮回
    MeshLayerRenderer.updateEarthShatter(root, new THREE.Vector3(), 0.65, 1, '#78716c', 1, cache, '#f97316', {
      spikeArrayBehavior: 'SURGE_RECEDE',
      spikeArrayCount: 5
    });

    const mainSpike = cache.spikeUnits.find((u: any) => u.isMainSpike);
    // 在 p=0.65 時，尖刺已抽回地底插槽：高度縮回且絕不露在地面下方
    expect(mainSpike.mesh.scale.y).toBeLessThan(0.8);
    expect(mainSpike.mesh.position.y).toBe(0); // 底座釘在地面，不向下懸空掉出！
  });
});

