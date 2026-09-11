import { describe, it, expect } from 'vitest';
import defaultVFXSequences from '../../data/vfx_sequences.json';
import {
  VFXSequence,
  CANONICAL_SEQUENCE_SCHEMA_VERSION
} from '../../models/VFX';
import { VFXPresetRepository } from './VFXPresetRepository';

describe('VFXCanonicalSchema - Phase 6 Canonical Schema 原生資產完整性驗證', () => {
  const allBuiltInSequences = defaultVFXSequences as unknown as VFXSequence[];

  it('1. 官方 30 款原生資產必須 100% 符合 Canonical VFXSequence (Schema v2)', () => {
    expect(allBuiltInSequences.length).toBeGreaterThanOrEqual(30);

    allBuiltInSequences.forEach(seq => {
      expect(seq.schemaVersion).toBe(CANONICAL_SEQUENCE_SCHEMA_VERSION);
      expect(seq.id).toBeTruthy();
      expect(seq.name).toBeTruthy();
      expect(seq.duration).toBeGreaterThan(0);
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

  it('2. 原生 VFXSequence 必須具備正確的打擊點與軌道幾何規格', () => {
    allBuiltInSequences.forEach(seq => {
      const impactTrack = seq.tracks.find(t => t.type === 'IMPACT');
      expect(impactTrack).toBeDefined();

      const mainTrack = seq.tracks.find(t => t.id === 'trk_main' || t.type === 'SLASH' || t.type === 'PROJECTILE' || t.type === 'MESH');
      expect(mainTrack).toBeDefined();
      expect(mainTrack!.clips.length).toBeGreaterThan(0);

      seq.impactCues.forEach(cue => {
        expect(cue.cueId).toBeTruthy();
        expect(typeof cue.time).toBe('number');
        expect(cue.time).toBeLessThanOrEqual(seq.duration + 0.1);
      });
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
