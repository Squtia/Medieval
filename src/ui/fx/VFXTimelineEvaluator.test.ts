import { describe, it, expect } from 'vitest';
import { VFXTimelineEvaluator } from './VFXTimelineEvaluator';
import { VFXPreset, VFXImpactCue, VFXLayer } from '../../models/VFX';

describe('⏱️ VFXTimelineEvaluator (純邏輯時間軸求值器驗證)', () => {
  const basePreset: VFXPreset = {
    id: 'test_fx',
    name: '測試特效',
    category: 'PHYSICAL',
    description: '測試用',
    trajectory: 'HORIZONTAL',
    shaderMode: 'SLASH_BLADE',
    colorCore: '#ffffff',
    colorRim: '#38bdf8',
    duration: 1.0,
    scale: 1.0,
    spin: 0,
    fresnel: 1.0,
    trailCount: 20,
    trailSize: 6,
    spikes: 0,
    spikeHeight: 0,
    burstCount: 10,
    bloomStr: 1.0,
    bloomRad: 0.5,
    bloomThresh: 0.8,
    impact: {
      hitStopTime: 50,
      targetPunchScale: 0.85,
      shakeIntensity: 10,
      shakeDuration: 0.25,
      penetrationDistance: 0,
      knockbackDistance: 5,
      hitFlashColor: '#ffffff',
      screenShake: true
    }
  };

  describe('1. 連擊節奏求值 (evaluateSalvoTimings)', () => {
    it('單段打擊時應回傳固定基底延遲時間點', () => {
      const timings = VFXTimelineEvaluator.evaluateSalvoTimings(basePreset, 1);
      expect(timings).toHaveLength(1);
      expect(timings[0]).toBe(0.2); // Math.min(1.0 * 0.4, 0.2)
    });

    it('LINEAR 等距節奏應輸出均勻且單調遞增之時間陣列', () => {
      const preset: VFXPreset = {
        ...basePreset,
        salvoDuration: 0.6,
        salvoRhythmCurve: 'LINEAR'
      };
      const timings = VFXTimelineEvaluator.evaluateSalvoTimings(preset, 4);
      expect(timings).toHaveLength(4);
      expect(timings[0]).toBe(0.2);
      expect(timings[3]).toBe(0.8); // 0.2 + 0.6

      const diff1 = timings[1] - timings[0];
      const diff2 = timings[2] - timings[1];
      const diff3 = timings[3] - timings[2];
      expect(Math.abs(diff1 - diff2)).toBeLessThan(0.001);
      expect(Math.abs(diff2 - diff3)).toBeLessThan(0.001);
    });

    it('ACCELERATE 指數加速應呈現前疏後密 (間隔遞減)', () => {
      const preset: VFXPreset = {
        ...basePreset,
        salvoDuration: 0.5,
        salvoRhythmCurve: 'ACCELERATE'
      };
      const timings = VFXTimelineEvaluator.evaluateSalvoTimings(preset, 5);
      expect(timings).toHaveLength(5);
      // 驗證單調遞增
      for (let i = 1; i < timings.length; i++) {
        expect(timings[i]).toBeGreaterThan(timings[i - 1]);
      }
      // 前半段耗時應大於後半段耗時
      const firstHalfTime = timings[2] - timings[0];
      const secondHalfTime = timings[4] - timings[2];
      expect(firstHalfTime).toBeLessThan(secondHalfTime); // ACCELERATE ratio^1.8 在 ratio 小時 timeOffset 增長慢（打擊密集），但在時間軸上觸發密集
    });

    it('DECELERATE 減速節奏應呈現前密後疏', () => {
      const preset: VFXPreset = {
        ...basePreset,
        salvoDuration: 0.5,
        salvoRhythmCurve: 'DECELERATE'
      };
      const timings = VFXTimelineEvaluator.evaluateSalvoTimings(preset, 5);
      expect(timings).toHaveLength(5);
      for (let i = 1; i < timings.length; i++) {
        expect(timings[i]).toBeGreaterThan(timings[i - 1]);
      }
      const gap01 = timings[1] - timings[0];
      const gap34 = timings[4] - timings[3];
      expect(gap01).toBeGreaterThan(gap34); // sqrt(ratio) 在 ratio=0->0.25 增長極快
    });

    it('BURST_PAIRS 應呈現成對雙發點射 (兩發相距 0.06s)', () => {
      const preset: VFXPreset = {
        ...basePreset,
        salvoDuration: 0.6,
        salvoRhythmCurve: 'BURST_PAIRS'
      };
      const timings = VFXTimelineEvaluator.evaluateSalvoTimings(preset, 4);
      expect(timings).toHaveLength(4);
      // 第 0 發與第 1 發相差 0.06
      const pair1Gap = Number((timings[1] - timings[0]).toFixed(3));
      expect(pair1Gap).toBe(0.06);

      // 第 2 發與第 3 發相差 0.06
      const pair2Gap = Number((timings[3] - timings[2]).toFixed(3));
      expect(pair2Gap).toBe(0.06);

      // 第 1 發到第 2 發的間隔 (組間間隔) 應大於 0.06
      const groupGap = timings[2] - timings[1];
      expect(groupGap).toBeGreaterThan(0.06);
    });

    it('極限邊界測試：所有時間點不應超過 preset.duration', () => {
      const shortPreset: VFXPreset = {
        ...basePreset,
        duration: 0.3,
        salvoDuration: 0.5
      };
      const timings = VFXTimelineEvaluator.evaluateSalvoTimings(shortPreset, 8);
      timings.forEach(t => {
        expect(t).toBeLessThanOrEqual(0.3);
      });
    });
  });

  describe('2. Impact Cue 解析 (resolveImpactCues)', () => {
    it('具有具名 impactCues 時應保留其屬性並依時間升冪排序', () => {
      const cues: VFXImpactCue[] = [
        { cueId: 'cue_3', time: 0.45, kind: 'STATUS' },
        { cueId: 'cue_1', time: 0.1, kind: 'IMPACT' },
        { cueId: 'cue_2', time: 0.25, kind: 'IMPACT', isPrimary: true }
      ];
      const preset: VFXPreset = {
        ...basePreset,
        impactCues: cues
      };

      const resolved = VFXTimelineEvaluator.resolveImpactCues(preset);
      expect(resolved).toHaveLength(3);
      expect(resolved[0].cueId).toBe('cue_1');
      expect(resolved[1].cueId).toBe('cue_2');
      expect(resolved[2].cueId).toBe('cue_3');
      expect(resolved[1].isPrimary).toBe(true);
    });

    it('未設定 impactCues 時，應依 hitCount 動態生成標準化 Fallback Cues', () => {
      const preset: VFXPreset = {
        ...basePreset,
        hitCount: 3,
        salvoDuration: 0.4
      };

      const resolved = VFXTimelineEvaluator.resolveImpactCues(preset);
      expect(resolved).toHaveLength(3);
      expect(resolved[0].cueId).toBe('test_fx_cue_0');
      expect(resolved[1].cueId).toBe('test_fx_cue_1');
      expect(resolved[2].cueId).toBe('test_fx_cue_2');
      // 最後一擊應為 isPrimary: true
      expect(resolved[0].isPrimary).toBe(false);
      expect(resolved[1].isPrimary).toBe(false);
      expect(resolved[2].isPrimary).toBe(true);
    });
  });

  describe('3. 複合圖層解析 (resolveCompositeLayers)', () => {
    it('無圖層時應回傳空陣列', () => {
      const layers = VFXTimelineEvaluator.resolveCompositeLayers(basePreset);
      expect(layers).toEqual([]);
    });

    it('應正確解析圖層延遲、覆蓋參數並過濾 enabled: false 的靜音圖層', () => {
      const rawLayers: VFXLayer[] = [
        {
          id: 'layer_fire',
          delay: 0.15,
          trajectory: 'GROUND_FISSURE',
          colorCore: '#ff5500',
          enabled: true
        },
        {
          id: 'layer_muted',
          delay: 0.2,
          enabled: false
        },
        {
          id: 'layer_lightning',
          delay: 0.3,
          shaderMode: 'DIELECTRIC_LIGHTNING'
        }
      ];

      const preset: VFXPreset = {
        ...basePreset,
        layers: rawLayers
      };

      const resolved = VFXTimelineEvaluator.resolveCompositeLayers(preset);
      expect(resolved).toHaveLength(2); // 排除 muted

      expect(resolved[0].delay).toBe(0.15);
      expect(resolved[0].resolvedPreset.trajectory).toBe('GROUND_FISSURE');
      expect(resolved[0].resolvedPreset.colorCore).toBe('#ff5500');
      expect(resolved[0].resolvedPreset.layers).toBeUndefined(); // 防遞迴

      expect(resolved[1].delay).toBe(0.3);
      expect(resolved[1].resolvedPreset.shaderMode).toBe('DIELECTRIC_LIGHTNING');
    });
  });

  describe('4. 受擊回饋分派 (calculateHitFeedback)', () => {
    it('一般單擊或終擊段應給予 100% 震動與螢幕震動', () => {
      const feedback = VFXTimelineEvaluator.calculateHitFeedback(basePreset.impact, 2, 3, true);
      expect(feedback.shakeIntensity).toBe(10);
      expect(feedback.punchScale).toBe(0.85);
      expect(feedback.screenShake).toBe(true);
    });

    it('在 multiHitImpact 模式下，前段打擊應適度輕量化', () => {
      const feedback = VFXTimelineEvaluator.calculateHitFeedback(basePreset.impact, 0, 3, true);
      expect(feedback.shakeIntensity).toBe(4); // 10 * 0.4
      expect(feedback.screenShake).toBe(false); // 前段不觸發全螢幕震動
      expect(feedback.hitStopTime).toBe(15);    // 50 * 0.3
    });
  });
});
