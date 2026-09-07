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
});
