import { describe, it, expect } from 'vitest';
import { VFXPresetValidator } from './VFXPresetValidator';
import { VFXPreset } from '../../models/VFX';

describe('VFXPresetGraphValidation - Phase 0 失敗案例驗證 (圖層引用與循環環路防護)', () => {
  const createTestPreset = (id: string, layers: any[] = []): VFXPreset => ({
    id,
    name: `測試預設 ${id}`,
    category: 'PHYSICAL',
    description: '測試圖層引用圖結構',
    trajectory: 'MELEE_SWEEP',
    shaderMode: 'SLASH_BLADE',
    colorCore: '#ffffff',
    colorRim: '#f59e0b',
    duration: 0.5,
    scale: 1,
    spin: 0,
    fresnel: 1,
    trailCount: 10,
    trailSize: 5,
    spikes: 0,
    spikeHeight: 0,
    burstCount: 10,
    bloomStr: 1,
    bloomRad: 0.5,
    bloomThresh: 0.2,
    impact: {
      hitStopTime: 30,
      targetPunchScale: 0.9,
      shakeIntensity: 5,
      shakeDuration: 0.2,
      penetrationDistance: 0,
      knockbackDistance: 0,
      hitFlashColor: '#ffffff',
      screenShake: false
    },
    layers
  });

  it('🔴 缺陷 1：圖層自我引用 (A ➔ A) 必須被 Validator 判定非法', () => {
    const selfReferencing = createTestPreset('VFX_SELF_REF', [
      {
        id: 'layer_self',
        presetId: 'VFX_SELF_REF', // 引用自身！
        delay: 0.1,
        duration: 0.2
      }
    ]);

    const res = VFXPresetValidator.validatePreset(selfReferencing);
    // ⚠️ 預期在此紅燈：目前 VFXPresetValidator 完全沒有檢查 layers 引用自身，因此會錯誤判定為 isValid: true！
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.toLowerCase().includes('self') || e.includes('自我引用'))).toBe(true);
  });

  it('🔴 缺陷 2：圖層環狀循環引用 (A ➔ B ➔ A) 必須被整個清單驗證拒絕', () => {
    const presetA = createTestPreset('VFX_CYCLE_A', [
      { id: 'layer_b', presetId: 'VFX_CYCLE_B', delay: 0.1, duration: 0.2 }
    ]);
    const presetB = createTestPreset('VFX_CYCLE_B', [
      { id: 'layer_a', presetId: 'VFX_CYCLE_A', delay: 0.1, duration: 0.2 }
    ]);

    const res = VFXPresetValidator.validatePresetList([presetA, presetB]);
    // ⚠️ 預期在此紅燈：目前 validatePresetList 只檢查單一 Preset 欄位與 ID 唯一性，
    // 未建立有向圖 (Graph) 與 Cycle 偵測，導致循環引用通過驗證！
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.toLowerCase().includes('cycle') || e.includes('循環'))).toBe(true);
  });

  it('🔴 缺陷 3：圖層引用不存在的 presetId 必須被拒絕', () => {
    const invalidPreset = createTestPreset('VFX_GHOST_REF', [
      { id: 'layer_ghost', presetId: 'VFX_DOES_NOT_EXIST_9999', delay: 0, duration: 0.3 }
    ]);

    const res = VFXPresetValidator.validatePresetList([invalidPreset]);
    // ⚠️ 預期在此紅燈：目前未核對 layer.presetId 是否存在於清單中
    expect(res.isValid).toBe(false);
    expect(res.errors.some(e => e.includes('VFX_DOES_NOT_EXIST_9999'))).toBe(true);
  });
});
