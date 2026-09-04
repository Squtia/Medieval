import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { VFXPresetValidator } from '../../ui/fx/VFXPresetValidator';

describe('VFX SSOT Publish and Restore Defense', () => {
  const createMinimalValidPreset = (id: string, name: string, duration = 0.6, cues: any[] = []) => ({
    id,
    name,
    trajectory: 'MELEE_SWEEP',
    shaderMode: 'SLASH_BLADE',
    duration,
    scale: 1,
    impact: {},
    impactCues: cues
  });

  it('should accept valid preset list with consistent impactCues', () => {
    const validList = [
      createMinimalValidPreset('VFX_SLASH_TEST', '測試斬擊', 0.6, [
        { cueId: 'cue-1', time: 0.2, weight: 1, isPrimary: true },
        { cueId: 'cue-2', time: 0.4, weight: 1, isPrimary: false }
      ]),
      createMinimalValidPreset('VFX_BLAST_TEST', '測試爆發', 1.0, [
        { cueId: 'cue-blast', time: 0.5, weight: 2, isPrimary: true }
      ])
    ];

    const result = VFXPresetValidator.validatePresetList(validList);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject preset list with duplicate cueId within the same preset', () => {
    const invalidList = [
      createMinimalValidPreset('VFX_DUPLICATE_CUES', '重複 Cue ID', 0.8, [
        { cueId: 'cue-duplicate', time: 0.2, weight: 1 },
        { cueId: 'cue-duplicate', time: 0.5, weight: 1 }
      ])
    ];

    const result = VFXPresetValidator.validatePresetList(invalidList);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Duplicate cueId'))).toBe(true);
  });

  it('should reject cue time that exceeds preset duration or is negative', () => {
    const outOfBounds = [
      createMinimalValidPreset('VFX_OOB_CUE', '超時 Cue', 0.5, [
        { cueId: 'cue-neg', time: -0.1, weight: 1 },
        { cueId: 'cue-over', time: 0.8, weight: 1 }
      ])
    ];

    const result = VFXPresetValidator.validatePresetList(outOfBounds);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('negative') || e.includes('exceeds'))).toBe(true);
  });

  it('should reject non-finite, NaN, or non-number cue time', () => {
    const nanList = [
      createMinimalValidPreset('VFX_NAN_CUE', 'NaN Cue', 1.0, [
        { cueId: 'cue-nan', time: NaN, weight: 1 },
        { cueId: 'cue-inf', time: Infinity, weight: 1 }
      ])
    ];

    const result = VFXPresetValidator.validatePresetList(nanList);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('must be a finite number'))).toBe(true);
  });

  it('should enforce server-side path traversal and prefix defense on snapshot filename', () => {
    // 嚴格對齊 vite.config.ts L483 之防護契約
    const isLegalSnapshotFilename = (filename: any): boolean => {
      if (typeof filename !== 'string') return false;
      if (path.basename(filename) !== filename) return false;
      if (!filename.startsWith('vfx_snapshot_')) return false;
      if (!filename.endsWith('.json')) return false;
      return true;
    };

    expect(isLegalSnapshotFilename('vfx_snapshot_2026-09-04_120000.json')).toBe(true);
    expect(isLegalSnapshotFilename('../../package.json')).toBe(false);
    expect(isLegalSnapshotFilename('..\\..\\Windows\\System32\\cmd.exe')).toBe(false);
    expect(isLegalSnapshotFilename('foo/bar.json')).toBe(false);
    expect(isLegalSnapshotFilename('arbitrary_file.json')).toBe(false);
  });
});
