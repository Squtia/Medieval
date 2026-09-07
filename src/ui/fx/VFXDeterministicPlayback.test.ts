import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TrailLayerRenderer } from './renderers/TrailLayerRenderer';
import { ParticleLayerRenderer } from './renderers/ParticleLayerRenderer';
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
});
