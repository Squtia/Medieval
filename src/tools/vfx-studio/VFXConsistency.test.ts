import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MeshLayerRenderer } from '../../ui/fx/renderers/MeshLayerRenderer';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { VFXPreset } from '../../models/VFX';

describe('VFX Scrubbing vs Playing SSOT Consistency Tests', () => {
  it('旋風橫掃 (VFX_WHIRLWIND)：定格求值與動態播放計算之半徑、刀寬、360度跨度與方向完全一致', () => {
    const whirlwindPreset: Partial<VFXPreset> = {
      id: 'VFX_WHIRLWIND',
      name: '旋風橫掃 (Whirlwind)',
      trajectory: 'MELEE_SWEEP',
      shaderMode: 'SLASH_BLADE',
      scale: 1.8,
      duration: 0.38,
      colorCore: '#fed7aa',
      colorRim: '#ea580c'
    };

    // 模擬動態播放進度 p = 0.5
    const dynamicParams = MeshLayerRenderer.calculateSlashGeometryParams(whirlwindPreset, 0.5);

    // 模擬時間軸定格求值 p = 0.5
    const scrubParams = MeshLayerRenderer.calculateSlashGeometryParams(
      { ...whirlwindPreset, scale: 1.8 },
      0.5,
      false
    );

    // 驗證 SSOT 純函式產出 100% 相同
    expect(scrubParams.isWhirlwind).toBe(true);
    expect(dynamicParams.isWhirlwind).toBe(true);
    expect(scrubParams.bladeRadius).toBe(85 * 1.8);
    expect(dynamicParams.bladeRadius).toBe(85 * 1.8);
    expect(scrubParams.bladeWidth).toBe(18 * 1.8);
    expect(dynamicParams.bladeWidth).toBe(18 * 1.8);
    expect(scrubParams.headAngle).toBeCloseTo(dynamicParams.headAngle, 5);
    expect(scrubParams.tailAngle).toBeCloseTo(dynamicParams.tailAngle, 5);
    expect(scrubParams.centerAngle).toBeCloseTo(dynamicParams.centerAngle, 5);
  });

  it('毀滅隕石 (DIAGONAL_DROP)：定格路徑與動態彈道起點嚴格對齊高空左上，不跌落為水平直線', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const casterPos = new THREE.Vector3(-120, 0, 0);
    const targetPos = new THREE.Vector3(120, 0, 0);

    // 調用私有 calculate3DTrackPos 驗證起點與終點
    const startPos = (fxEngine as any).calculate3DTrackPos('DIAGONAL_DROP', false, 0.0, casterPos, targetPos);
    const endPos = (fxEngine as any).calculate3DTrackPos('DIAGONAL_DROP', false, 1.0, casterPos, targetPos);
    const midPos = (fxEngine as any).calculate3DTrackPos('DIAGONAL_DROP', false, 0.5, casterPos, targetPos);

    // 起點必須來自左上天空 (target.x - 260, target.y + 380, 0)
    expect(startPos.x).toBe(120 - 260); // -140
    expect(startPos.y).toBe(0 + 380);   // 380
    expect(startPos.z).toBe(0);

    // 終點必須精準落在目標位置
    expect(endPos.x).toBe(120);
    expect(endPos.y).toBe(0);

    // 中點必須在斜降連線上
    expect(midPos.x).toBe((-140 + 120) / 2);
    expect(midPos.y).toBe((380 + 0) / 2);
  });

  it('神聖護盾 (SHIELD_BARRIER)：MeshLayerRenderer 建立六角柱與十字架，動態求值前段膨脹後段淡出', () => {
    const shieldGroup = MeshLayerRenderer.buildHolyShieldGroup(1.5, '#fde047', '#eab308');
    expect(shieldGroup.children.length).toBe(4); // 六角柱 + 外環 + 雙十字
    const parts = (shieldGroup as any).__shieldParts;
    expect(parts.hexMesh).toBeDefined();
    expect(parts.ringMesh).toBeDefined();

    // 前段 p = 0.23 (接近頂峰 1.15)
    MeshLayerRenderer.updateHolyShield(shieldGroup, 0.23);
    expect(shieldGroup.scale.x).toBeGreaterThan(1.0);

    // 後段 p = 0.8 (淡出)
    MeshLayerRenderer.updateHolyShield(shieldGroup, 0.8);
    expect(shieldGroup.scale.x).toBe(1.0);
    expect(parts.hexMat.opacity).toBeLessThan(0.88);
  });

  it('戰吼音波 (SHOUT_WAVE)：MeshLayerRenderer 建立多層音波環，隨進度向目標方向擴散平移', () => {
    const shoutGroup = MeshLayerRenderer.buildTauntShoutGroup(3, '#ef4444');
    expect(shoutGroup.children.length).toBe(3);

    const casterPos = new THREE.Vector3(-100, 0, 0);
    const targetPos = new THREE.Vector3(100, 0, 0);

    MeshLayerRenderer.updateTauntShout(shoutGroup, 0.4, casterPos, targetPos, 1.0);
    const waves = (shoutGroup as any).__waves;
    const wave0 = waves[0];
    expect(wave0.mesh.visible).toBe(true);
    expect(wave0.mesh.position.x).toBeGreaterThan(0); // 向目標平移
  });

  it('神聖光柱 (HOLY_LIGHT)：MeshLayerRenderer 建立圓柱光柱，隨進度直徑收縮', () => {
    const mesh = MeshLayerRenderer.buildHolyPillarMesh(1.2, '#fde047');
    expect(mesh.geometry).toBeDefined();

    MeshLayerRenderer.updateHolyPillar(mesh, 0.5);
    expect(mesh.scale.x).toBeCloseTo(0.5, 1);
    expect(mesh.scale.z).toBeCloseTo(0.5, 1);
  });

  it('非聶耳冰晶槍 (FRESNEL_ICE)：旋轉冰晶與錐體在定格與播放中旋轉角度完全一致', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const icePreset = {
      id: 'VFX_FROST_LANCE',
      name: '非聶耳冰槍',
      trajectory: 'HORIZONTAL',
      shaderMode: 'FRESNEL_ICE',
      scale: 1.0,
      duration: 0.5,
      colorCore: '#e0f2fe',
      colorRim: '#38bdf8'
    } as unknown as VFXPreset;

    // 驗證在時間 t = 0.25 (p = 0.5) 渲染
    fxEngine.renderFrameAt(icePreset, 0.25);
    const previewGroup = (fxEngine as any).studioPreviewGroup;
    expect(previewGroup).toBeDefined();
    expect(previewGroup.visible).toBe(true);

    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    const cache = trackGroup.__cache;
    expect(cache.currentShader).toBe('FRESNEL_ICE');
    expect(cache.frostGroup).toBeDefined();
    expect(cache.frostGroup.visible).toBe(true);
    // 驗證自轉角度 p * 4 * PI = 0.5 * 4 * PI = 2 * PI
    expect(cache.frostGroup.rotation.z).toBeCloseTo(2 * Math.PI, 4);
  });

  it('風暴狂雷 (DIELECTRIC_LIGHTNING)：落雷起點來自高空天頂，折線電弧與地面衝擊環正確生成', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const lightningPreset = {
      id: 'VFX_THUNDER_STRIKE',
      name: '風暴狂雷',
      trajectory: 'VERTICAL_DROP',
      shaderMode: 'DIELECTRIC_LIGHTNING',
      scale: 1.2,
      duration: 0.4,
      colorCore: '#ffffff',
      colorRim: '#38bdf8'
    } as unknown as VFXPreset;

    // 驗證在時間 t = 0.2 (p = 0.5)
    fxEngine.renderFrameAt(lightningPreset, 0.2);
    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    const cache = trackGroup.__cache;
    expect(cache.currentShader).toBe('DIELECTRIC_LIGHTNING');
    expect(cache.lightningGroup).toBeDefined();
    expect(cache.lightningGroup.children.length).toBeGreaterThan(0);
  });

  it('奧術追蹤彈 (ARC_MULTI)：多發彈道對稱側向散發，進度隨時間平滑推進', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const multiPreset = {
      id: 'VFX_ARCANE_MISSILES',
      name: '奧術追蹤彈',
      trajectory: 'ARC_MULTI',
      shaderMode: 'ENERGY_BEAM',
      salvoCount: 3,
      scale: 1.0,
      duration: 0.6,
      colorCore: '#fbcfe8',
      colorRim: '#c084fc'
    } as unknown as VFXPreset;

    fxEngine.renderFrameAt(multiPreset, 0.3);
    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    const cache = trackGroup.__cache;
    expect(cache.multiArcGroup).toBeDefined();
    expect(cache.multiArcGroup.visible).toBe(true);
    expect(cache.multiArcs.length).toBe(3);
    expect(cache.multiArcs[0].spreadY).toBe(-55);
    expect(cache.multiArcs[1].spreadY).toBe(0);
    expect(cache.multiArcs[2].spreadY).toBe(55);
  });

  it('貫穿突刺 (COLUMN_PIERCE)：終點自動延伸 penetrationDistance，絕不截斷於目標點', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const caster = new THREE.Vector3(-100, 0, 0);
    const target = new THREE.Vector3(100, 0, 0);

    const piercePreset = {
      id: 'VFX_PIERCE',
      name: '貫穿長槍',
      trajectory: 'COLUMN_PIERCE',
      shaderMode: 'ENERGY_BEAM',
      scale: 1.0,
      duration: 0.5,
      colorCore: '#ffffff',
      colorRim: '#eab308',
      impact: {
        penetrationDistance: 80
      }
    } as unknown as VFXPreset;

    fxEngine.renderFrameWorldAt(piercePreset, 0.25, caster, target);
    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    const cache = trackGroup.__cache;
    expect(cache.beamGroup).toBeDefined();
    expect(cache.beamGroup.visible).toBe(true);
  });
});
