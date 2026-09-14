import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { resolvePresetSpatialTopology, resolveVFXEndpoints } from './VFXSpatialPolicy';
import { MeshLayerRenderer } from './renderers/MeshLayerRenderer';
import { VFXPreset } from '../../models/VFX';

describe('VFXSpatialTopology & Orthogonal Trajectory Architecture', () => {
  it('correctly infers spatial topology from presets with backward compatibility', () => {
    // 1. 一般投射物彈道 ➔ 質點飛行
    expect(resolvePresetSpatialTopology({ trajectory: 'HORIZONTAL' })).toBe('POINT_TRANSPORT');
    expect(resolvePresetSpatialTopology({ trajectoryPath: 'A_TO_B' })).toBe('POINT_TRANSPORT');

    // 2. 原地近戰揮砍 ➔ 原地幾何展開
    expect(resolvePresetSpatialTopology({ trajectory: 'MELEE_SWEEP' })).toBe('LOCAL_MORPH');
    expect(resolvePresetSpatialTopology({ spatialMode: 'AT_TARGET' })).toBe('LOCAL_MORPH');
    expect(resolvePresetSpatialTopology({ spatialMode: 'AT_CASTER' })).toBe('LOCAL_MORPH');

    // 3. 跨空間能量柱 (天雷 / 電弧 / 聚能光束)
    expect(resolvePresetSpatialTopology({ shaderMode: 'DIELECTRIC_LIGHTNING' })).toBe('SPAN_BEAM');
    expect(resolvePresetSpatialTopology({ shaderMode: 'ENERGY_BEAM' })).toBe('SPAN_BEAM');
    expect(resolvePresetSpatialTopology({ rendererType: 'LIGHTNING' })).toBe('SPAN_BEAM');

    // 4. 沿途連鎖陣列 (地裂 / 連鎖破土)
    expect(resolvePresetSpatialTopology({ trajectory: 'GROUND_FISSURE' })).toBe('STAGGERED_ARRAY');
    expect(resolvePresetSpatialTopology({ rendererType: 'GROUND_FISSURE' })).toBe('STAGGERED_ARRAY');
  });

  it('supports flying blade wave by combining POINT_TRANSPORT with SLASH_BLADE', () => {
    const flyingBladePreset: Partial<VFXPreset> = {
      spatialTopology: 'POINT_TRANSPORT',
      shaderMode: 'SLASH_BLADE',
      slashAlignToPath: true,
      trajectoryPath: 'A_TO_B'
    };

    // 驗證自訂 topology 優先權高於預設
    expect(resolvePresetSpatialTopology(flyingBladePreset)).toBe('POINT_TRANSPORT');
    expect(flyingBladePreset.slashAlignToPath).toBe(true);
  });

  it('executes staggered spike array in PERSIST_FADE mode where spikes persist then fade', () => {
    const group = new THREE.Group();
    const cache: Record<string, any> = {};
    const caster = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(200, 0, 0);

    const preset: Partial<VFXPreset> = {
      spatialTopology: 'STAGGERED_ARRAY',
      spikeArrayBehavior: 'PERSIST_FADE',
      spikeArrayCount: 5
    };

    // 進行前段取樣
    MeshLayerRenderer.updateGroundFissure(group, caster, target, 0.45, 1.0, '#38bdf8', cache, preset);
    expect(cache.fissureNodes).toBeDefined();
    expect(cache.fissureNodes.length).toBe(5);

    // 取得第一根竄起的刺
    const firstNode = cache.fissureNodes[0];
    expect(firstNode.nodeGroup.visible).toBe(true);
    expect(firstNode.rockMesh.scale.y).toBe(1.0); // 已經竄出至頂峰

    // 推進至後段進度 0.95 (接近尾聲)
    MeshLayerRenderer.updateGroundFissure(group, caster, target, 0.95, 1.0, '#38bdf8', cache, preset);
    // PERSIST_FADE 模式下，刺依然保持地面高程 (scale.y === 1.0)，由 opacity 漸隱
    expect(firstNode.rockMesh.scale.y).toBe(1.0);
    expect(firstNode.rockMat.opacity).toBeLessThan(0.9);
  });

  it('executes staggered spike array in SURGE_RECEDE mode where spikes surge and recede into ground', () => {
    const group = new THREE.Group();
    const cache: Record<string, any> = {};
    const caster = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(200, 0, 0);

    const preset: Partial<VFXPreset> = {
      spatialTopology: 'STAGGERED_ARRAY',
      spikeArrayBehavior: 'SURGE_RECEDE',
      spikeArrayCount: 6
    };

    // 推進至 0.45，第一根刺處於竄起頂峰
    MeshLayerRenderer.updateGroundFissure(group, caster, target, 0.45, 1.0, '#38bdf8', cache, preset);
    expect(cache.fissureNodes.length).toBe(6);
    const firstNode = cache.fissureNodes[0];
    expect(firstNode.nodeGroup.visible).toBe(true);

    // 推進至 0.95，SURGE_RECEDE 模式下，第一根刺必須如浪潮般平滑縮回地底 (scale.y 接近 0.01)
    MeshLayerRenderer.updateGroundFissure(group, caster, target, 0.95, 1.0, '#38bdf8', cache, preset);
    expect(firstNode.rockMesh.scale.y).toBeLessThan(0.3);
  });

  it('verifies that lightning (DIELECTRIC_LIGHTNING) natively connects caster to target in A_TO_B mode', () => {
    const caster = new THREE.Vector3(-150, 0, 0);
    const target = new THREE.Vector3(150, 0, 0);

    // ⚡ 驗證掌心雷 / 連鎖電弧 (A_TO_B)：起點必須在施術者身上，終點在受擊者身上
    const endpointsA2B = resolveVFXEndpoints('TRAJECTORY', 'A_TO_B', 'HORIZONTAL', false, caster, target);
    expect(endpointsA2B.startPos.toArray()).toEqual([-150, 0, 0]);
    expect(endpointsA2B.endPos.toArray()).toEqual([150, 0, 0]);

    // ⚡ 驗證狂雷天降 (VERTICAL_SKY_TO_B)：起點在目標正上方天空，終點在受擊者身上
    const endpointsSky = resolveVFXEndpoints('TRAJECTORY', 'VERTICAL_SKY_TO_B', 'VERTICAL_DROP', false, caster, target);
    expect(endpointsSky.startPos.x).toBe(150);
    expect(endpointsSky.startPos.y).toBeGreaterThanOrEqual(380);
    expect(endpointsSky.endPos.toArray()).toEqual([150, 0, 0]);

    // ⚡ 驗證斜天降雷 (DIAGONAL_SKY_TO_B)：起點在目標斜上方天空，終點在受擊者身上
    const endpointsDiag = resolveVFXEndpoints('TRAJECTORY', 'DIAGONAL_SKY_TO_B', 'DIAGONAL_DROP', false, caster, target);
    expect(endpointsDiag.startPos.x).toBeLessThan(150);
    expect(endpointsDiag.startPos.y).toBeGreaterThanOrEqual(380);
    expect(endpointsDiag.endPos.toArray()).toEqual([150, 0, 0]);
  });

  it('verifies penetrating projectiles (Pierce Arrow) extend beyond target along trajectory', () => {
    const caster = new THREE.Vector3(-100, 0, 0);
    const target = new THREE.Vector3(100, 0, 0);
    const penetrationDist = 50;

    const endpoints = resolveVFXEndpoints('TRAJECTORY', 'A_TO_B', 'COLUMN_PIERCE', false, caster, target, penetrationDist);
    expect(endpoints.startPos.toArray()).toEqual([-100, 0, 0]);
    // 終點應朝衝擊方向穿透至 100 + 50 = 150
    expect(endpoints.endPos.x).toBe(150);
    expect(endpoints.endPos.y).toBe(0);
  });

  it('guarantees POINT_TRANSPORT does not collapse to target when legacy trajectory is MELEE_SWEEP', () => {
    const caster = new THREE.Vector3(-120, 0, 0);
    const target = new THREE.Vector3(120, 0, 0);

    // 模擬近戰特效轉為質點運動，但舊欄位殘留 MELEE_SWEEP
    const endpoints = resolveVFXEndpoints(
      'TRAJECTORY',
      'A_TO_B',
      'MELEE_SWEEP',
      false,
      caster,
      target,
      0,
      { spatialTopology: 'POINT_TRANSPORT' }
    );

    // 起終點絕對不能塌縮在 targetPos (120, 0, 0)，必須正常從 caster (-120, 0, 0) 飛向 target (120, 0, 0)
    expect(endpoints.startPos.toArray()).toEqual([-120, 0, 0]);
    expect(endpoints.endPos.toArray()).toEqual([120, 0, 0]);
    expect(endpoints.startPos.distanceTo(endpoints.endPos)).toBeGreaterThan(200);
  });
});

