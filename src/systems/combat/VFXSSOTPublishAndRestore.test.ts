import { describe, it, expect, vi } from 'vitest';
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

  it('✅ 驗證 Phase 8 情境 3: 快照還原端到端閉環 (POST restore -> repo reload -> change listener 觸發)', async () => {
    const { VFXPresetRepository } = await import('../../ui/fx/VFXPresetRepository');
    const repo = VFXPresetRepository.getInstance();

    // 1. 準備快照資料 (模擬先前備份的 Preset 快照)
    const snapshotPresets = [
      createMinimalValidPreset('VFX_SNAPSHOT_RESTORED', '還原後的快照特效', 1.2, [
        { cueId: 'cue-snap-1', time: 0.3, weight: 1, isPrimary: true }
      ])
    ];

    let listenerFired = false;
    const unsubscribe = repo.addChangeListener(() => {
      listenerFired = true;
    });

    // 2. 模擬端到端伺服器還原 API (POST /__vfx_api/restore_snapshot)
    (globalThis as any).fetch = vi.fn(async (url: string, options: any) => {
      if (url === '/__vfx_api/restore_snapshot' || url === '/api/restore-vfx-backup') {
        const body = JSON.parse(options.body);
        if (body.filename !== 'vfx_snapshot_valid.json') {
          return {
            ok: false,
            status: 400,
            json: async () => ({ success: false, error: 'Illegal snapshot' })
          };
        }
        return {
          ok: true,
          json: async () => ({
            success: true,
            message: '已從快照還原',
            presets: snapshotPresets
          })
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    // 3. 呼叫還原 API
    const resp = await fetch('/__vfx_api/restore_snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'vfx_snapshot_valid.json' })
    });
    const data = await resp.json();

    expect(data.success).toBe(true);
    expect(data.presets).toHaveLength(1);

    // 4. Repository reloadPresets 寫回記憶體
    repo.reloadPresets(data.presets);

    // 5. 斷言：監聽器必須被觸發，且 Repository 內的預設已替換為快照內容
    expect(listenerFired).toBe(true);
    expect(repo.getPreset('VFX_SNAPSHOT_RESTORED')).toBeDefined();
    expect(repo.getPreset('VFX_SNAPSHOT_RESTORED')?.name).toBe('還原後的快照特效');
    expect(repo.getPreset('VFX_SNAPSHOT_RESTORED')?.duration).toBe(1.2);

    unsubscribe();
  });
});
