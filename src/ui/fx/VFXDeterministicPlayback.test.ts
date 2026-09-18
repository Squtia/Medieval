import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TrailLayerRenderer } from './renderers/TrailLayerRenderer';
import { ParticleLayerRenderer } from './renderers/ParticleLayerRenderer';
import { MeshLayerRenderer } from './renderers/MeshLayerRenderer';
import * as THREE from 'three';

describe('VFXDeterministicPlayback - Phase 0 失敗案例驗證 (確定性隨機與 Math.random 根除)', () => {
  it('🔴 缺陷 1：TrailLayerRenderer 在建立拖尾時不得直接呼叫全域 Math.random()', () => {
    const mathRandomSpy = vi.spyOn(Math, 'random');

    const scene = new THREE.Scene();
    const startPos = new THREE.Vector3(0, 0, 0);
    const trail = TrailLayerRenderer.createTrail(scene, startPos, '#ffffff', 20, 8, 1.0);

    const currentPos = new THREE.Vector3(50, 0, 0);

    mathRandomSpy.mockClear();

    // 更新拖尾點雲
    trail.update(currentPos);

    // ⚠️ 預期在此紅燈：TrailLayerRenderer.ts:64-66 直接使用了 (Math.random() - 0.5) * 6 * scale，
    // 未透過傳入的 seeded RNG 求值，導致全域 Math.random 被呼叫！
    expect(mathRandomSpy).not.toHaveBeenCalled();

    mathRandomSpy.mockRestore();
  });

  it('🔴 缺陷 2：VFX Runtime 核心檔案中不得包含直接呼叫 Math.random() 的不可控邏輯', () => {
    const trailRendererPath = path.resolve(__dirname, 'renderers/TrailLayerRenderer.ts');
    const content = fs.readFileSync(trailRendererPath, 'utf-8');

    // 排除註解與純型別，直接檢驗是否有未受控的 Math.random 呼叫
    const hasUncontrolledMathRandom = content.includes('Math.random()');
    
    // ⚠️ 預期在此紅燈：TrailLayerRenderer 內部依然殘留 Math.random()
    expect(hasUncontrolledMathRandom).toBe(false);
  });

  it('✅ 驗證 Phase 8 情境 4: 固定 Seed 於相同時間點之頂點座標/幾何姿態數值 100% 恆等 (Diff = 0)，不同 Seed 產生明確差異', async () => {
    const { createLcgRng } = await import('./VFXRng');

    const seed = 123456789;

    // 1. 使用 Seed 123456789 生成第一次拖尾與粒子點雲座標快照 A
    const rngA = createLcgRng(seed);
    const sceneA = new THREE.Scene();
    const trailA = TrailLayerRenderer.createTrail(sceneA, new THREE.Vector3(0, 0, 0), '#ffffff', 20, 8, 1.0, rngA);

    // 模擬在固定時間進度 (例如 t = 0.3s) 連續推進點雲
    trailA.update(new THREE.Vector3(30, 10, 0));
    trailA.update(new THREE.Vector3(60, 20, 0));
    trailA.update(new THREE.Vector3(90, 30, 0));

    const positionsA = Array.from(trailA.points.geometry.attributes.position.array);

    // 2. 重新初始化完全相同的 Seed 123456789 生成第二次快照 B
    const rngB = createLcgRng(seed);
    const sceneB = new THREE.Scene();
    const trailB = TrailLayerRenderer.createTrail(sceneB, new THREE.Vector3(0, 0, 0), '#ffffff', 20, 8, 1.0, rngB);

    trailB.update(new THREE.Vector3(30, 10, 0));
    trailB.update(new THREE.Vector3(60, 20, 0));
    trailB.update(new THREE.Vector3(90, 30, 0));

    const positionsB = Array.from(trailB.points.geometry.attributes.position.array);

    // 3. 斷言：在相同 Seed 與時間推進序列下，每個頂點座標 Float32Array 必須 100% 數值精確相等！
    expect(positionsA.length).toBeGreaterThan(0);
    expect(positionsA.length).toBe(positionsB.length);
    expect(positionsA).toEqual(positionsB);

    // 4. 使用不同 Seed 生成快照 C
    const rngC = createLcgRng(987654321);
    const sceneC = new THREE.Scene();
    const trailC = TrailLayerRenderer.createTrail(sceneC, new THREE.Vector3(0, 0, 0), '#ffffff', 20, 8, 1.0, rngC);

    trailC.update(new THREE.Vector3(30, 10, 0));
    trailC.update(new THREE.Vector3(60, 20, 0));
    trailC.update(new THREE.Vector3(90, 30, 0));

    const positionsC = Array.from(trailC.points.geometry.attributes.position.array);

    // 斷言：不同 Seed 必須產生實質頂點抖動差異
    expect(positionsA).not.toEqual(positionsC);
  });

  it('✅ 驗證刀尖圓弧拖尾 updateArcTrail 於出刀中途產生流光，於出刀結束 (p >= 1.0) 徹底回收零殘留', () => {
    const scene = new THREE.Scene();
    const trail = TrailLayerRenderer.createTrail(scene, new THREE.Vector3(0, 0, 0), '#f59e0b', 25, 8, 1.0);

    // 模擬刀尖位置採樣函數：圓弧運動
    const bladeTipSampler = (p: number) => {
      const angle = p * Math.PI;
      return new THREE.Vector3(Math.cos(angle) * 100, Math.sin(angle) * 100, 0);
    };

    // 1. 出刀中途 (p = 0.5)
    trail.updateArcTrail!(bladeTipSampler, 0.5);
    expect(trail.points.visible).toBe(true);
    expect(trail.material.opacity).toBeGreaterThan(0.5);

    const midPosArray = Array.from(trail.points.geometry.attributes.position.array);
    // 刀尖點 (最後一個點或 u=1) 應該靠近 (cos(0.5pi)*100, sin(0.5pi)*100, 0) 即 (0, 100, 0)
    const tipX = midPosArray[(trail.count - 1) * 3];
    const tipY = midPosArray[(trail.count - 1) * 3 + 1];
    expect(Math.abs(tipX)).toBeLessThan(15);
    expect(tipY).toBeGreaterThan(85);

    // 2. 出刀結束 (p = 1.0)
    trail.updateArcTrail!(bladeTipSampler, 1.0);
    expect(trail.points.visible).toBe(false);
    expect(trail.material.opacity).toBe(0);

    // 3. 驗證羽尾散開 (spreadWidth) 與相位交織 (strands) 對斬擊頂點位置產生實質動態影響
    trail.updateArcTrail!(bladeTipSampler, 0.5, 0, 1);
    const posWithoutSpread = Array.from(trail.points.geometry.attributes.position.array);

    trail.updateArcTrail!(bladeTipSampler, 0.5, 30, 2);
    const posWithSpreadAndStrands = Array.from(trail.points.geometry.attributes.position.array);

    // 斷言：啟用 spreadWidth 與 strands 後，頂點陣列數值必須產生實質位移
    expect(posWithoutSpread).not.toEqual(posWithSpreadAndStrands);

    // 斷言：尾端頂點（i = 0，遠離刀尖）位移差值大於刀尖頂點（i = count - 1，靠近刀尖）
    const tailDiffX = Math.abs(posWithSpreadAndStrands[0] - posWithoutSpread[0]);
    const tailDiffY = Math.abs(posWithSpreadAndStrands[1] - posWithoutSpread[1]);
    const tipDiffX = Math.abs(posWithSpreadAndStrands[(trail.count - 1) * 3] - posWithoutSpread[(trail.count - 1) * 3]);
    const tipDiffY = Math.abs(posWithSpreadAndStrands[(trail.count - 1) * 3 + 1] - posWithoutSpread[(trail.count - 1) * 3 + 1]);

    expect(tailDiffX + tailDiffY).toBeGreaterThan(tipDiffX + tipDiffY);

    trail.dispose();
  });

  it('✅ 驗證垂直切片熱更新：fresnel 指數、能量光束顏色與神聖天柱色彩熱響應', () => {
    // 1. 驗證 updateFresnelIce 實質更新 uFresnel uniform
    const frostGroup = new THREE.Group();
    const cacheFrost: any = {};
    MeshLayerRenderer.updateFresnelIce(
      frostGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 0, 0),
      0.5,
      1.0,
      '#ffffff',
      '#38bdf8',
      cacheFrost,
      'ARROW',
      75,
      0.85,
      1.0,
      undefined,
      1.2
    );
    expect(cacheFrost.iceMaterial.uniforms.uFresnel.value).toBe(1.2);

    MeshLayerRenderer.updateFresnelIce(
      frostGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 0, 0),
      0.5,
      1.0,
      '#ffffff',
      '#38bdf8',
      cacheFrost,
      'ARROW',
      75,
      0.85,
      1.0,
      undefined,
      3.5
    );
    expect(cacheFrost.iceMaterial.uniforms.uFresnel.value).toBe(3.5);

    // 2. 驗證 updateEnergyBeam 實質熱更新光柱與光環材質色彩
    const beamGroup = new THREE.Group();
    const cacheBeam: any = {};
    MeshLayerRenderer.updateEnergyBeam(
      beamGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 0, 0),
      0.5,
      1.0,
      '#ffffff',
      '#ff0000',
      1.0,
      cacheBeam
    );
    expect(cacheBeam.beamMesh.material.color.getHexString()).toBe('ff0000');

    // 命中快取時切換色彩：
    MeshLayerRenderer.updateEnergyBeam(
      beamGroup,
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 0, 0),
      0.6,
      1.0,
      '#ffff00',
      '#00ff00',
      1.0,
      cacheBeam
    );
    expect(cacheBeam.beamMesh.material.color.getHexString()).toBe('00ff00');
    expect(cacheBeam.beamRing1.material.color.getHexString()).toBe('ffff00');

    // 3. 驗證 updateHolyPillar 實質熱更新柱體顏色
    const pillarMesh = MeshLayerRenderer.buildHolyPillarMesh(1.0, '#fde047');
    MeshLayerRenderer.updateHolyPillar(pillarMesh, 0.2, '#00ffff');
    expect((pillarMesh.material as THREE.MeshBasicMaterial).color.getHexString()).toBe('00ffff');
  });
});

