import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolvePresetSpatialMode, resolveVFXWorldStart, VFX_RENDER_ORDER } from './VFXSpatialPolicy';
import { MeshLayerRenderer } from './renderers/MeshLayerRenderer';
import defaultVFXPresets from '../../data/vfx_presets.json';
import { VFXPreset } from '../../models/VFX';

describe('VFX spatial and layering policy', () => {
  it('maps a trajectory-only vertical-drop preset to the sky-to-target mode', () => {
    expect(resolvePresetSpatialMode({ trajectory: 'VERTICAL_DROP' })).toBe('VERTICAL_SKY_TO_B');
    expect(resolvePresetSpatialMode({ trajectory: 'DIAGONAL_DROP' })).toBe('DIAGONAL_SKY_TO_B');
  });

  it('maps the shipped Storm Bolt preset without relying on a synthetic fixture', () => {
    const stormBolt = (defaultVFXPresets as VFXPreset[]).find(preset => preset.id === 'VFX_LIGHTNING_BOLT');
    expect(stormBolt).toBeDefined();
    expect(stormBolt?.trajectory).toBe('VERTICAL_DROP');
    expect(resolvePresetSpatialMode(stormBolt!)).toBe('VERTICAL_SKY_TO_B');
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
});
