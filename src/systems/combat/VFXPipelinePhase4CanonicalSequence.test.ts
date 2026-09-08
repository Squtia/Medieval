import { describe, it, expect, beforeEach } from 'vitest';
import { 
  VFXPreset, 
  VFXSequence, 
  migrateLegacyPreset, 
  sequenceToLegacyPreset,
  VFXSlashClipPayload,
  VFXProjectileClipPayload
} from '../../models/VFX';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { MeshLayerRenderer } from '../../ui/fx/renderers/MeshLayerRenderer';

describe('VFX Pipeline Phase 4: Canonical Sequence & Typed Payload Convergence', () => {
  let repo: VFXPresetRepository;

  beforeEach(() => {
    repo = VFXPresetRepository.getInstance();
  });

  describe('4.1 新建純新版 Preset (無 legacy 欄位) 遷移至 Canonical VFXSequence', () => {
    it('應能正確將純新版 SLASH Preset 轉換為帶有完整 typed VFXSlashClipPayload 的 Sequence', () => {
      const pureSlashPreset: VFXPreset = {
        id: 'VFX_PURE_NEW_SLASH',
        name: '純新版無痕斬擊',
        category: 'PHYSICAL',
        description: '無 legacy 欄位之標準測試 Preset',
        trajectory: 'MELEE_SWEEP',
        rendererType: 'SLASH',
        shaderMode: 'SLASH_BLADE',
        slashShape: 'WHIRLWIND',
        slashRadius: 95,
        slashBladeWidth: 22,
        slashAngle: 30,
        slashArcSpan: 360,
        slashAspect: 1.2,
        slashReverse: true,
        salvoCount: 3,
        salvoRhythmCurve: 'ACCELERATE',
        slashAngleJitter: 15,
        slashAlternating: true,
        duration: 0.45,
        scale: 1.0,
        spin: 0,
        fresnel: 0,
        trailCount: 0,
        trailSize: 0,
        spikes: 0,
        spikeHeight: 0,
        burstCount: 0,
        bloomStr: 0,
        bloomRad: 0,
        bloomThresh: 0,
        impact: {
          hitStopTime: 0,
          targetPunchScale: 1,
          shakeIntensity: 0,
          shakeDuration: 0,
          penetrationDistance: 0,
          knockbackDistance: 0,
          hitFlashColor: '#ffffff',
          screenShake: false
        },
        salvoDuration: 0.45,
        salvoSpreadAngle: 0,
        arcHeight: 0,
        multiHitImpact: false,
        layers: [],
        hitCount: 1,
        colorCore: '#ffffff',
        colorRim: '#3b82f6'
      };

      const sequence = migrateLegacyPreset(pureSlashPreset);

      expect(sequence.id).toBe('VFX_PURE_NEW_SLASH');
      expect(sequence.duration).toBe(0.45);
      expect(sequence.tracks).toHaveLength(3); // trk_main + trk_particle + trk_impact

      const mainTrack = sequence.tracks.find(t => t.id === 'trk_main');
      expect(mainTrack).toBeDefined();
      expect(mainTrack?.clips).toHaveLength(1);

      const clip = mainTrack!.clips[0];
      expect(clip.payload.type).toBe('SLASH');
      
      const payload = clip.payload.data as VFXSlashClipPayload;
      expect(payload.rendererType).toBe('SLASH');
      expect(payload.shape).toBe('WHIRLWIND');
      expect(payload.radius).toBe(95);
      expect(payload.bladeWidth).toBe(22);
      expect(payload.angle).toBe(30);
      expect(payload.arcSpan).toBe(360);
      expect(payload.aspect).toBe(1.2);
      expect(payload.reverse).toBe(true);
      expect(payload.colorCore).toBe('#ffffff');
      expect(payload.colorRim).toBe('#3b82f6');
      expect(payload.salvo).toBeDefined();
      expect(payload.salvo?.count).toBe(3);
      expect(payload.salvo?.rhythm).toBe('ACCELERATE');
      expect(payload.salvo?.angleJitter).toBe(15);
      expect(payload.salvo?.alternating).toBe(true);
    });

    it('應能正確將純新版 PROJECTILE Preset 轉換為帶有完整 typed VFXProjectileClipPayload 的 Sequence', () => {
      const pureProjectilePreset: VFXPreset = {
        id: 'VFX_PURE_NEW_MISSILE',
        name: '純新版魔力飛彈',
        category: 'ELEMENTAL',
        description: '無 legacy 欄位之標準投射物測試 Preset',
        trajectory: 'HORIZONTAL',
        rendererType: 'PROJECTILE',
        coreMeshShape: 'DIAMOND',
        shaderMode: 'VOLUMETRIC_FIRE',
        coreBrightness: 2.4,
        scale: 1.5,
        spin: 12,
        trajectoryPath: 'DIAGONAL_SKY_TO_B',
        arcHeight: 60,
        reverse: false,
        salvoCount: 4,
        salvoDuration: 0.5,
        salvoRhythmCurve: 'DECELERATE',
        salvoSpreadAngle: 25,
        salvoSpreadRadius: 30,
        duration: 0.6,
        fresnel: 0,
        trailCount: 0,
        trailSize: 0,
        spikes: 0,
        spikeHeight: 0,
        burstCount: 0,
        bloomStr: 0,
        bloomRad: 0,
        bloomThresh: 0,
        impact: {
          hitStopTime: 0,
          targetPunchScale: 1,
          shakeIntensity: 0,
          shakeDuration: 0,
          penetrationDistance: 0,
          knockbackDistance: 0,
          hitFlashColor: '#ffffff',
          screenShake: false
        },
        multiHitImpact: false,
        layers: [],
        hitCount: 1,
        colorCore: '#a855f7',
        colorRim: '#c084fc'
      };

      const sequence = migrateLegacyPreset(pureProjectilePreset);

      expect(sequence.id).toBe('VFX_PURE_NEW_MISSILE');
      const mainTrack = sequence.tracks.find(t => t.id === 'trk_main');
      const clip = mainTrack!.clips[0];
      expect(clip.payload.type).toBe('PROJECTILE');

      const payload = clip.payload.data as VFXProjectileClipPayload;
      expect(payload.rendererType).toBe('PROJECTILE');
      expect(payload.shape).toBe('DIAMOND');
      expect(payload.shaderMode).toBe('VOLUMETRIC_FIRE');
      expect(payload.coreBrightness).toBe(2.4);
      expect(payload.scale).toBe(1.5);
      expect(payload.spin).toBe(12);
      expect(payload.path).toBe('DIAGONAL_SKY_TO_B');
      expect(payload.arcHeight).toBe(60);
      expect(payload.salvo?.count).toBe(4);
      expect(payload.salvo?.duration).toBe(0.5);
      expect(payload.salvo?.rhythm).toBe('DECELERATE');
      expect(payload.salvo?.spreadAngle).toBe(25);
      expect(payload.salvo?.spreadRadius).toBe(30);
    });
  });

  describe('4.2 往返無損守恆 (Roundtrip Invariance)', () => {
    it('SLASH Preset 在 Preset -> Sequence -> Preset 往返轉換中主要參數保持零失真', () => {
      const originalPreset: VFXPreset = {
        id: 'VFX_ROUNDTRIP_SLASH',
        name: '往返測試斬擊',
        category: 'PHYSICAL',
        description: '往返守恆測試',
        trajectory: 'MELEE_SWEEP',
        rendererType: 'SLASH',
        shaderMode: 'SLASH_BLADE',
        slashShape: 'CROSS',
        slashRadius: 78,
        slashBladeWidth: 16,
        slashAngle: -60,
        slashArcSpan: 150,
        slashAspect: 1.3,
        slashReverse: true,
        salvoCount: 2,
        salvoRhythmCurve: 'BURST_PAIRS',
        slashAngleJitter: 8,
        slashAlternating: true,
        duration: 0.4,
        scale: 1.25,
        colorCore: '#fef08a',
        colorRim: '#ca8a04',
        spin: 0,
        fresnel: 0,
        trailCount: 0,
        trailSize: 0,
        spikes: 0,
        spikeHeight: 0,
        burstCount: 0,
        bloomStr: 0,
        bloomRad: 0,
        bloomThresh: 0,
        impact: {
          hitStopTime: 0,
          targetPunchScale: 1,
          shakeIntensity: 0,
          shakeDuration: 0,
          penetrationDistance: 0,
          knockbackDistance: 0,
          hitFlashColor: '#ffffff',
          screenShake: false
        },
        salvoDuration: 0.4,
        salvoSpreadAngle: 0,
        arcHeight: 0,
        multiHitImpact: false,
        layers: [],
        hitCount: 1
      };

      const sequence = migrateLegacyPreset(originalPreset);
      const reconstructedPreset = sequenceToLegacyPreset(sequence);

      expect(reconstructedPreset.id).toBe(originalPreset.id);
      expect(reconstructedPreset.rendererType).toBe('SLASH');
      expect(reconstructedPreset.slashShape).toBe(originalPreset.slashShape);
      expect(reconstructedPreset.slashRadius).toBe(originalPreset.slashRadius);
      expect(reconstructedPreset.slashBladeWidth).toBe(originalPreset.slashBladeWidth);
      expect(reconstructedPreset.slashAngle).toBe(originalPreset.slashAngle);
      expect(reconstructedPreset.slashArcSpan).toBe(originalPreset.slashArcSpan);
      expect(reconstructedPreset.slashAspect).toBe(originalPreset.slashAspect);
      expect(reconstructedPreset.slashReverse).toBe(originalPreset.slashReverse);
      expect(reconstructedPreset.salvoCount).toBe(originalPreset.salvoCount);
      expect(reconstructedPreset.salvoRhythmCurve).toBe(originalPreset.salvoRhythmCurve);
      expect(reconstructedPreset.slashAngleJitter).toBe(originalPreset.slashAngleJitter);
      expect(reconstructedPreset.slashAlternating).toBe(originalPreset.slashAlternating);
      expect(reconstructedPreset.duration).toBe(originalPreset.duration);
      expect(reconstructedPreset.scale).toBe(originalPreset.scale);
      expect(reconstructedPreset.colorCore).toBe(originalPreset.colorCore);
      expect(reconstructedPreset.colorRim).toBe(originalPreset.colorRim);
    });

    it('PROJECTILE Preset 在 Preset -> Sequence -> Preset 往返轉換中主要參數保持零失真', () => {
      const originalPreset: VFXPreset = {
        id: 'VFX_ROUNDTRIP_PROJECTILE',
        name: '往返測試投射物',
        category: 'ELEMENTAL',
        description: '往返守恆測試',
        trajectory: 'HORIZONTAL',
        rendererType: 'PROJECTILE',
        coreMeshShape: 'STAR',
        shaderMode: 'FRESNEL_ICE',
        coreBrightness: 2.1,
        scale: 1.6,
        spin: 18,
        trajectoryPath: 'A_TO_VERTICAL_SKY',
        arcHeight: 45,
        reverse: true,
        salvoCount: 5,
        salvoDuration: 0.55,
        salvoRhythmCurve: 'STAGGERED',
        salvoSpreadAngle: 18,
        salvoSpreadRadius: 22,
        duration: 0.7,
        colorCore: '#e0f2fe',
        colorRim: '#0284c7',
        fresnel: 0,
        trailCount: 0,
        trailSize: 0,
        spikes: 0,
        spikeHeight: 0,
        burstCount: 0,
        bloomStr: 0,
        bloomRad: 0,
        bloomThresh: 0,
        impact: {
          hitStopTime: 0,
          targetPunchScale: 1,
          shakeIntensity: 0,
          shakeDuration: 0,
          penetrationDistance: 0,
          knockbackDistance: 0,
          hitFlashColor: '#ffffff',
          screenShake: false
        },
        multiHitImpact: false,
        layers: [],
        hitCount: 1
      };

      const sequence = migrateLegacyPreset(originalPreset);
      const reconstructedPreset = sequenceToLegacyPreset(sequence);

      expect(reconstructedPreset.id).toBe(originalPreset.id);
      expect(reconstructedPreset.rendererType).toBe('PROJECTILE');
      expect(reconstructedPreset.coreMeshShape).toBe(originalPreset.coreMeshShape);
      expect(reconstructedPreset.shaderMode).toBe(originalPreset.shaderMode);
      expect(reconstructedPreset.coreBrightness).toBe(originalPreset.coreBrightness);
      expect(reconstructedPreset.scale).toBe(originalPreset.scale);
      expect(reconstructedPreset.spin).toBe(originalPreset.spin);
      expect(reconstructedPreset.trajectoryPath).toBe(originalPreset.trajectoryPath);
      expect(reconstructedPreset.arcHeight).toBe(originalPreset.arcHeight);
      expect(reconstructedPreset.salvoCount).toBe(originalPreset.salvoCount);
      expect(reconstructedPreset.salvoDuration).toBe(originalPreset.salvoDuration);
      expect(reconstructedPreset.salvoRhythmCurve).toBe(originalPreset.salvoRhythmCurve);
      expect(reconstructedPreset.salvoSpreadAngle).toBe(originalPreset.salvoSpreadAngle);
      expect(reconstructedPreset.salvoSpreadRadius).toBe(originalPreset.salvoSpreadRadius);
      expect(reconstructedPreset.duration).toBe(originalPreset.duration);
    });
  });

  describe('4.3 VFXPresetRepository Canonical Sequence 接口與持久化', () => {
    it('應能透過 getSequence 解析既有 Preset 並取得 Sequence', () => {
      const seq = repo.getSequence('VFX_HEAVY_STRIKE');
      expect(seq).toBeDefined();
      expect(seq?.id).toBe('VFX_HEAVY_STRIKE');
      expect(seq?.tracks.length).toBeGreaterThanOrEqual(1);
    });

    it('應能透過 saveSequence 保存 Canonical Sequence 並更新 Repository', () => {
      const customSeq: VFXSequence = {
        schemaVersion: 2,
        id: 'VFX_CANONICAL_TEST_SEQ',
        name: '正規序列測試',
        category: 'PHYSICAL',
        description: '保存測試',
        duration: 0.5,
        impactPresentationMode: 'EXACT_IMPACTS',
        tracks: [
          {
            id: 'mainTrack',
            name: '主軌',
            type: 'MESH',
            enabled: true,
            clips: [
              {
                id: 'clip_1',
                startTime: 0,
                duration: 0.5,
                payload: {
                  type: 'SLASH',
                  data: {
                    rendererType: 'SLASH',
                    colorCore: '#ffffff',
                    colorRim: '#10b981',
                    scale: 1.1,
                    angle: 0,
                    arcSpan: 180,
                    aspect: 1.0,
                    bladeWidth: 12,
                    radius: 70,
                    reverse: false,
                    shape: 'CRESCENT'
                  }
                }
              }
            ]
          }
        ],
        impactCues: [
          {
            cueId: 'CUE_1',
            time: 0.35,
            weight: 1,
            isPrimary: true
          }
        ]
      };

      const result = repo.saveSequence(customSeq);
      expect(result.success).toBe(true);

      const retrievedSeq = repo.getSequence('VFX_CANONICAL_TEST_SEQ');
      expect(retrievedSeq).toBeDefined();
      expect(retrievedSeq?.id).toBe('VFX_CANONICAL_TEST_SEQ');
      expect(retrievedSeq?.impactCues).toHaveLength(1);
      expect(retrievedSeq?.tracks[0].clips[0].payload.type).toBe('SLASH');
    });
  });

  describe('4.4 移除 Preset ID 造型特判驗證', () => {
    it('MeshLayerRenderer.calculateSlashGeometryParams 嚴格依據 slashShape 決定是否為旋風，而非依據 id', () => {
      // 相同 slashShape: 'WHIRLWIND'，不同 ID
      const presetA: VFXPreset = {
        id: 'TOTALLY_RANDOM_NAME_1',
        name: '測試 A',
        category: 'PHYSICAL',
        description: '',
        trajectory: 'MELEE_SWEEP',
        shaderMode: 'SLASH_BLADE',
        colorCore: '#ffffff',
        colorRim: '#ea580c',
        slashShape: 'WHIRLWIND',
        slashRadius: 90,
        slashBladeWidth: 20,
        slashArcSpan: 360,
        duration: 0.3,
        scale: 1,
        spin: 0,
        fresnel: 0,
        trailCount: 0,
        trailSize: 0,
        spikes: 0,
        spikeHeight: 0,
        burstCount: 0,
        bloomStr: 0,
        bloomRad: 0,
        bloomThresh: 0,
        impact: {
          hitStopTime: 0,
          targetPunchScale: 1,
          shakeIntensity: 0,
          shakeDuration: 0,
          penetrationDistance: 0,
          knockbackDistance: 0,
          hitFlashColor: '#ffffff',
          screenShake: false
        },
        salvoCount: 1,
        salvoDuration: 0.3,
        salvoRhythmCurve: 'LINEAR',
        salvoSpreadAngle: 0,
        arcHeight: 0,
        multiHitImpact: false,
        layers: [],
        hitCount: 1
      };

      const presetB: VFXPreset = {
        ...presetA,
        id: 'WHIRLWIND_IN_NAME_BUT_NOT_SHAPE',
        slashShape: 'CRESCENT',
        slashRadius: 65,
        slashBladeWidth: 10,
        slashArcSpan: 135
      };

      const geoA = MeshLayerRenderer.calculateSlashGeometryParams(presetA, 0.5);
      const geoB = MeshLayerRenderer.calculateSlashGeometryParams(presetB, 0.5);

      // presetA 雖然 ID 沒有 WHIRLWIND，但因為 slashShape 是 WHIRLWIND，判定為 isWhirlwind = true
      expect(geoA.isWhirlwind).toBe(true);
      expect(geoA.isCross).toBe(false);

      // presetB 雖然 ID 包含 WHIRLWIND，但因為 slashShape 是 CRESCENT，判定為 isWhirlwind = false
      expect(geoB.isWhirlwind).toBe(false);
    });
  });

  describe('4.5 CombatFXEngine Canonical Sequence 原生呼叫', () => {
    it('CombatFXEngine.playSequence 應能無異常接收並排程播放 sequence', () => {
      const engine = CombatFXEngine.getInstance();
      const seq: VFXSequence = {
        schemaVersion: 2,
        id: 'VFX_SEQ_ENGINE_TEST',
        name: '戰鬥引擎 Sequence 原生測試',
        category: 'PHYSICAL',
        description: 'Sequence 播放測試',
        duration: 0.4,
        tracks: [
          {
            id: 'mainTrack',
            name: '主軌',
            type: 'MESH',
            enabled: true,
            clips: [
              {
                id: 'clip_1',
                startTime: 0,
                duration: 0.4,
                payload: {
                  type: 'SLASH',
                  data: {
                    rendererType: 'SLASH',
                    colorCore: '#ffffff',
                    colorRim: '#f97316',
                    scale: 1.0,
                    angle: 45,
                    arcSpan: 120,
                    aspect: 1.0,
                    bladeWidth: 10,
                    radius: 60,
                    reverse: false,
                    shape: 'CRESCENT'
                  }
                }
              }
            ]
          }
        ],
        impactCues: []
      };

      // 驗證 playSequence 不拋出例外且能正常返回 Promise
      expect(() => {
        const promise = engine.playSequence(seq, { x: 100, y: 100 }, { x: 200, y: 200 });
        expect(promise).toBeInstanceOf(Promise);
      }).not.toThrow();
    });
  });
});
