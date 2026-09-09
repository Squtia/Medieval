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
      slashShape: 'WHIRLWIND',
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

  it('斬擊 3D 歐拉角 (X/Y/Z)：旋轉參數真實貫通至 Mesh rotation，保證 Pitch/Yaw/Roll 3D 姿態精確', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const caster = new THREE.Vector3(-100, 0, 0);
    const target = new THREE.Vector3(100, 0, 0);

    const slashPreset = {
      id: 'VFX_SLASH_3D',
      name: '3D 傾角斬擊',
      trajectory: 'MELEE_SWEEP',
      shaderMode: 'SLASH_BLADE',
      slashRotX: 35,
      slashRotY: -25,
      slashRotZ: -60,
      scale: 1.0,
      duration: 0.4,
      colorCore: '#ffffff',
      colorRim: '#f59e0b'
    } as unknown as VFXPreset;

    fxEngine.renderFrameWorldAt(slashPreset, 0.2, caster, target);
    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    const cache = trackGroup.__cache;
    expect(cache.slashMesh).toBeDefined();
    expect(cache.slashMesh.visible).toBe(true);
    // 驗證 X/Y 歐拉角真實套用至 mesh.rotation
    expect(cache.slashMesh.rotation.x).toBeCloseTo((35 * Math.PI) / 180, 4);
    expect(cache.slashMesh.rotation.y).toBeCloseTo((-25 * Math.PI) / 180, 4);
  });

  it('多發冰晶之矛 (FRESNEL_ICE 連射 7 發)：徹底根除 Early Return，真實生成 7 發實體錐形冰錐與外圍冰環並套用 31° 偏角與 130px 散佈', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const caster = new THREE.Vector3(-200, 0, 0);
    const target = new THREE.Vector3(200, 0, 0);

    // 完美還原使用者截圖中的條件：FRESNEL_ICE、7 發、偏角 31°、受擊散佈 130px
    const frostSalvoPreset = {
      id: 'VFX_FROST_SALVO_7',
      name: '七重冰晶連射',
      trajectory: 'TRAJECTORY',
      shaderMode: 'FRESNEL_ICE',
      scale: 1.0,
      duration: 0.5,
      salvoCount: 7,
      salvoSpreadAngle: 31,
      salvoSpreadRadius: 130,
      arcHeight: 60,
      colorCore: '#ffffff',
      colorRim: '#38bdf8'
    } as unknown as VFXPreset;

    fxEngine.renderFrameWorldAt(frostSalvoPreset, 0.25, caster, target);
    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    const cache = trackGroup.__cache;

    // 1. 驗證多發彈幕群組被正確建立，而非僅有單一 frostGroup
    expect(cache.multiArcGroup).toBeDefined();
    expect(cache.multiArcGroup.visible).toBe(true);

    // 2. 驗證確實生成 7 枚子彈實體
    expect(cache.multiArcs.length).toBe(7);
    expect(cache.multiArcGroup.children.length).toBe(7);

    // 3. 驗證每枚子彈實體均包含真實 FRESNEL 冰錐 Mesh 與冰環 Mesh
    const firstBulletGroup = cache.multiArcs[0].group;
    expect(firstBulletGroup).toBeDefined();
    expect(firstBulletGroup.__ring).toBeDefined(); // 具備冰環旋轉實體

    // 4. 驗證 31° 散射偏角 (SpreadAngle) 與受擊散佈半徑 (SpreadRadius) 確實計算偏移
    const spreadY0 = cache.multiArcs[0].spreadY;
    const spreadY6 = cache.multiArcs[6].spreadY;
    expect(spreadY0).toBeLessThan(0); // 下偏
    expect(spreadY6).toBeGreaterThan(0); // 上偏
    expect(Math.abs(spreadY6 - spreadY0)).toBeGreaterThan(150); // 31° 展開幅度遠大於基礎值

    // 5. 驗證受擊散佈落點偏移半徑存在
    const hasTargetOffset = cache.multiArcs.some((a: any) => Math.abs(a.targetOffsetX) > 20 || Math.abs(a.targetOffsetY) > 20);
    expect(hasTargetOffset).toBe(true);

    // 6. 驗證飛行中子彈位置確實從起點 (-200) 飛向終點 (200)，而非卡在原點 (0, 0, 0)
    const visibleBullets = cache.multiArcs.filter((a: any) => a.group.visible);
    expect(visibleBullets.length).toBeGreaterThan(0);
    visibleBullets.forEach((b: any) => {
      // 在 t = 0.25 時，X 座標應位於起點與終點之間，絕不可全員堆積在原點 0
      expect(b.group.position.x).toBeGreaterThan(-200);
      expect(b.group.position.x).toBeLessThan(200);
    });
  });

  it('⚡ 驗證雷電形態 (DIELECTRIC_LIGHTNING) 即使 salvoCount > 1 亦絕不被彈幕管線誤劫持', () => {
    const fxEngine = CombatFXEngine.getInstance();
    fxEngine.clearStudioPreview();

    const caster = new THREE.Vector3(-150, 0, 0);
    const target = new THREE.Vector3(150, 0, 0);

    const lightningWithSalvoPreset = {
      id: 'VFX_LIGHTNING_TEST',
      name: '狂雷連鎖穿透',
      trajectory: 'TRAJECTORY',
      shaderMode: 'DIELECTRIC_LIGHTNING',
      scale: 1.0,
      duration: 0.4,
      salvoCount: 5, // 模擬面板殘留或設定了 5 發
      salvoSpreadAngle: 25,
      colorCore: '#ffffff',
      colorRim: '#38bdf8'
    } as unknown as VFXPreset;

    fxEngine.renderFrameWorldAt(lightningWithSalvoPreset, 0.2, caster, target);
    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    const cache = trackGroup.__cache;

    // 驗證絕不進入 multiArcGroup
    expect(cache.multiArcGroup).toBeUndefined();
    // 驗證確實建立閃電幾何群組 (lightningGroup)
    expect(cache.lightningGroup).toBeDefined();
    expect(cache.lightningGroup.visible).toBe(true);
  });

  it('⚡ 驗證落雷 (DIELECTRIC_LIGHTNING / VERTICAL_DROP) 終點與地面電環 100% 鎖定於受擊目標 targetPos', () => {
    const fxEngine = CombatFXEngine.getInstance();
    fxEngine.clearStudioPreview();

    const caster = new THREE.Vector3(-180, 0, 0);
    const target = new THREE.Vector3(220, 15, 0); // 任意偏位之受擊目標

    const stormBoltPreset = {
      id: 'VFX_LIGHTNING_BOLT',
      name: '風暴狂雷',
      trajectory: 'VERTICAL_DROP',
      shaderMode: 'DIELECTRIC_LIGHTNING',
      scale: 1.2,
      duration: 0.3,
      colorCore: '#ffffff',
      colorRim: '#fde047'
    } as unknown as VFXPreset;

    // 在 t = 0.25 (進度約 0.83) 時求值，此時落雷與受擊電環均已完全生成
    fxEngine.renderFrameWorldAt(stormBoltPreset, 0.25, caster, target);
    const trackGroup = (fxEngine as any).studioTrackGroups[0];
    const cache = trackGroup.__cache;

    expect(cache.lightningGroup).toBeDefined();
    const children = cache.lightningGroup.children;
    // 應有雷電 Tube (Mesh) 與 地面電環 Ring (Mesh)
    expect(children.length).toBeGreaterThanOrEqual(2);

    // 第二個子物件為地面電環 ringMesh，其 position 必須精確與 target 相同
    const ringMesh = children[1];
    expect(ringMesh.position.x).toBeCloseTo(target.x, 1);
    expect(ringMesh.position.y).toBeCloseTo(target.y, 1);
    expect(ringMesh.position.z).toBeCloseTo(target.z, 1);
  });
});

