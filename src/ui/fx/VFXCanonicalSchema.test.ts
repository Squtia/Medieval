import { describe, it, expect } from 'vitest';
import defaultVFXPresets from '../../data/vfx_presets.json';
import {
  VFXPreset,
  VFXSequence,
  migrateLegacyPreset,
  sequenceToLegacyPreset,
  CANONICAL_SEQUENCE_SCHEMA_VERSION
} from '../../models/VFX';
import { VFXPresetRepository } from './VFXPresetRepository';

describe('VFXCanonicalSchema - Phase 6 Canonical Schema 收斂與無損轉譯驗證', () => {
  const allBuiltInPresets = defaultVFXPresets as unknown as VFXPreset[];

  it('1. 官方 30 款既有 Preset 必須 100% 成功遷移為 Canonical VFXSequence (Schema v2)', () => {
    expect(allBuiltInPresets.length).toBeGreaterThanOrEqual(30);

    allBuiltInPresets.forEach(preset => {
      const seq: VFXSequence = migrateLegacyPreset(preset);

      expect(seq.schemaVersion).toBe(CANONICAL_SEQUENCE_SCHEMA_VERSION);
      expect(seq.id).toBe(preset.id);
      expect(seq.name).toBe(preset.name || preset.id);
      expect(seq.duration).toBeCloseTo(preset.duration, 2);
      expect(seq.tracks.length).toBeGreaterThanOrEqual(2); // 至少具備 main 與 particle 軌
      expect(seq.impactCues.length).toBeGreaterThan(0);

      // 檢查所有 Clip payload 皆為型別安全的 Discriminated Union
      seq.tracks.forEach(track => {
        expect(track.id).toBeTruthy();
        expect(track.clips.length).toBeGreaterThanOrEqual(0);
        track.clips.forEach(clip => {
          expect(clip.id).toBeTruthy();
          expect(clip.payload).toBeDefined();
          expect(['MESH', 'SLASH', 'PROJECTILE', 'PARTICLE', 'IMPACT', 'SCREEN_FX', 'AUDIO', 'COMPOSITE_LAYER']).toContain(clip.payload.type);
        });
      });
    });
  });

  it('2. 雙向無損 Roundtrip：Preset -> Sequence -> Preset 必須保持數值與合約 100% 一致', () => {
    allBuiltInPresets.forEach(preset => {
      const seq = migrateLegacyPreset(preset);
      const restored = sequenceToLegacyPreset(seq);

      expect(restored.id).toBe(preset.id);
      expect(restored.name).toBe(preset.name || preset.id);
      expect(restored.category).toBe(preset.category);
      expect(restored.duration).toBeCloseTo(preset.duration, 2);
      expect(restored.trajectory).toBe(preset.trajectory);
      expect(restored.shaderMode).toBe(preset.shaderMode);
      expect(restored.colorCore).toBe(preset.colorCore);
      expect(restored.colorRim).toBe(preset.colorRim);
      expect(restored.scale).toBe(preset.scale);

      if (preset.burstCount !== undefined) {
        expect(restored.burstCount).toBe(preset.burstCount);
      }
      if (preset.trailCount !== undefined) {
        expect(restored.trailCount).toBe(preset.trailCount);
      }

      // 次生圖層一致性
      const originalLayers = preset.layers || [];
      const restoredLayers = restored.layers || [];
      expect(restoredLayers.length).toBe(originalLayers.length);
      for (let i = 0; i < originalLayers.length; i++) {
        expect(restoredLayers[i].presetId).toBe(originalLayers[i].presetId);
        expect(restoredLayers[i].delay).toBe(originalLayers[i].delay);
      }

      // Impact 配置一致性
      if (preset.impact) {
        expect(restored.impact.shakeIntensity).toBe(preset.impact.shakeIntensity);
        expect(restored.impact.screenShake).toBe(preset.impact.screenShake);
      }

      // Impact Cue 一致性
      const origCues = preset.impactCues || [];
      const restCues = restored.impactCues || [];
      if (origCues.length > 0) {
        expect(restCues.length).toBe(origCues.length);
        expect(restCues[0].time).toBe(origCues[0].time);
      }
    });
  });

  it('3. Editor Session State 隔離：sanitizePresetContent 必須剔除所有 UI 暫態屬性', () => {
    const dirtyPreset: any = {
      id: 'VFX_DIRTY_TEST',
      name: '暫態測試',
      duration: 0.5,
      _mainTrackMuted: true,
      _trackMuteStates: { main: true, layers: false },
      _selected: true,
      solo: true,
      locked: true,
      layers: [
        {
          id: 'layer_0',
          presetId: 'VFX_SUB',
          delay: 0.1,
          duration: 0.3,
          _selected: true,
          solo: false,
          locked: true
        }
      ]
    };

    const clean = VFXPresetRepository.sanitizePresetContent(dirtyPreset);

    expect((clean as any)._mainTrackMuted).toBeUndefined();
    expect((clean as any)._trackMuteStates).toBeUndefined();
    expect((clean as any)._selected).toBeUndefined();
    expect((clean as any).solo).toBeUndefined();
    expect((clean as any).locked).toBeUndefined();

    expect(clean.layers![0].presetId).toBe('VFX_SUB');
    expect((clean.layers![0] as any)._selected).toBeUndefined();
    expect((clean.layers![0] as any).solo).toBeUndefined();
    expect((clean.layers![0] as any).locked).toBeUndefined();
  });
});
