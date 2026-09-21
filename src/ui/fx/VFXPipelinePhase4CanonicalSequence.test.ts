import { describe, it, expect, beforeEach } from 'vitest';
import { 
  VFXPreset, 
  VFXSequence, 
  VFXSlashClipPayload,
  VFXProjectileClipPayload
} from '../../models/VFX';
import { VFXPresetRepository } from './VFXPresetRepository';
import { CombatFXEngine } from './CombatFXEngine';
import { MeshLayerRenderer } from './renderers/MeshLayerRenderer';
import { CombatActionPlayer, CombatAction } from './CombatActionPlayer';
import { CombatEventType } from '../../models/Combat';
import { VFXStudioAdapter } from './VFXStudioAdapter';
import { CombatStudioStageAdapter } from './adapters/CombatStudioStageAdapter';

describe('VFX Pipeline Phase 4: Canonical Sequence & Typed Payload Convergence', () => {
  let repo: VFXPresetRepository;

  beforeEach(() => {
    repo = VFXPresetRepository.getInstance();
  });

  describe('4.1 原生 Canonical VFXSequence 之 Typed Payload 規格完整性驗證', () => {
    it('應能正確定義與解析帶有完整 typed VFXSlashClipPayload 的 Sequence', () => {
      const slashPayload: VFXSlashClipPayload = {
        rendererType: 'SLASH',
        shape: 'WHIRLWIND',
        radius: 95,
        bladeWidth: 22,
        angle: 30,
        arcSpan: 360,
        aspect: 1.2,
        reverse: true,
        colorCore: '#ffffff',
        colorRim: '#3b82f6',
        rotX: 10,
        rotY: 20,
        rotZ: 30,
        salvo: {
          count: 3,
          rhythm: 'ACCELERATE',
          angleJitter: 15,
          alternating: true
        }
      };

      const sequence: VFXSequence = {
        schemaVersion: 2,
        id: 'VFX_PURE_NEW_SLASH',
        name: '純新版無痕斬擊',
        category: 'PHYSICAL',
        description: '無 legacy 欄位之標準測試 Sequence',
        duration: 0.45,
        spatialMode: 'AT_TARGET',
        tracks: [
          {
            id: 'trk_main',
            name: '主斬擊',
            type: 'SLASH',
            clips: [
              {
                id: 'clip_1',
                name: '旋風斬',
                startTime: 0,
                duration: 0.45,
                payload: {
                  type: 'SLASH',
                  data: slashPayload
                }
              }
            ]
          }
        ],
        impactCues: [{ cueId: 'CUE_1', time: 0.3, weight: 1, isPrimary: true }]
      };

      expect(sequence.id).toBe('VFX_PURE_NEW_SLASH');
      expect(sequence.duration).toBe(0.45);
      const mainTrack = sequence.tracks.find(t => t.id === 'trk_main');
      expect(mainTrack).toBeDefined();
      const clip = mainTrack!.clips[0];
      expect(clip.payload.type).toBe('SLASH');
      
      const payload = clip.payload.data as VFXSlashClipPayload;
      expect(payload.rendererType).toBe('SLASH');
      expect(payload.shape).toBe('WHIRLWIND');
      expect(payload.radius).toBe(95);
      expect(payload.bladeWidth).toBe(22);
      expect(payload.angle).toBe(30);
      expect(payload.rotX).toBe(10);
      expect(payload.rotY).toBe(20);
      expect(payload.rotZ).toBe(30);
      expect(payload.salvo?.count).toBe(3);
      expect(payload.salvo?.rhythm).toBe('ACCELERATE');
    });

    it('應能正確定義與解析帶有完整 typed VFXProjectileClipPayload 的 Sequence', () => {
      const projPayload: VFXProjectileClipPayload = {
        rendererType: 'PROJECTILE',
        shape: 'DIAMOND',
        shaderMode: 'VOLUMETRIC_FIRE',
        coreBrightness: 2.4,
        scale: 1.5,
        spin: 12,
        path: 'DIAGONAL_SKY_TO_B',
        arcHeight: 60,
        salvo: {
          count: 4,
          duration: 0.5,
          rhythm: 'DECELERATE',
          spreadAngle: 25,
          spreadRadius: 30
        }
      };

      const sequence: VFXSequence = {
        schemaVersion: 2,
        id: 'VFX_PURE_NEW_MISSILE',
        name: '純新版魔力飛彈',
        category: 'ELEMENTAL',
        description: '標準投射物測試 Sequence',
        duration: 0.6,
        spatialMode: 'A_TO_B',
        tracks: [
          {
            id: 'trk_main',
            name: '主彈道',
            type: 'PROJECTILE',
            clips: [
              {
                id: 'clip_proj',
                name: '魔力飛彈',
                startTime: 0,
                duration: 0.6,
                payload: {
                  type: 'PROJECTILE',
                  data: projPayload
                }
              }
            ]
          }
        ],
        impactCues: [{ cueId: 'CUE_1', time: 0.5, weight: 1, isPrimary: true }]
      };

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

  describe('4.6 規格 §9.3 跨三端純 Canonical VFXSequence 播放一致性驗證', () => {
    it('純 Canonical Sequence (無任何 legacy 欄位) 在主遊戲、Combat Studio 與 VFX Studio 三端一致播放且 Cue 參數守恆', async () => {
      // 1. 建立一個純 Canonical Schema 的 VFXSequence（絕對不提供任何 legacy-only 頂層欄位）
      const pureCanonicalSeq: VFXSequence = {
        schemaVersion: 2,
        id: 'VFX_PURE_CANONICAL_TEST_SPEC_9_3',
        name: '純 Canonical 規範驗證特效',
        category: 'PHYSICAL',
        description: '無任何 legacy 頂層欄位之標準序列',
        duration: 0.5,
        tracks: [
          {
            id: 'trk_canonical_main',
            name: '主軌',
            type: 'MESH',
            enabled: true,
            clips: [
              {
                id: 'clip_slash_1',
                startTime: 0,
                duration: 0.5,
                payload: {
                  type: 'SLASH',
                  data: {
                    rendererType: 'SLASH',
                    shape: 'CRESCENT',
                    colorCore: '#38bdf8',
                    colorRim: '#1e40af',
                    scale: 1.2,
                    angle: 45,
                    arcSpan: 180,
                    aspect: 1.0,
                    bladeWidth: 15,
                    radius: 75,
                    reverse: false
                  }
                }
              }
            ]
          }
        ],
        impactCues: [
          {
            cueId: 'CUE_ALPHA',
            time: 0.2,
            weight: 0.4,
            isPrimary: true,
            targetPolicy: 'PRIMARY_TARGET'
          },
          {
            cueId: 'CUE_BETA',
            time: 0.4,
            weight: 0.6,
            isPrimary: false,
            targetPolicy: 'EACH_TARGET'
          }
        ]
      };

      // 2. 存入 Repository 並自 SSOT 取得
      const saveRes = repo.saveSequence(pureCanonicalSeq);
      expect(saveRes.success).toBe(true);

      const resolvedSeq = repo.getSequence('VFX_PURE_CANONICAL_TEST_SPEC_9_3');
      expect(resolvedSeq).toBeDefined();
      expect(resolvedSeq?.id).toBe('VFX_PURE_CANONICAL_TEST_SPEC_9_3');
      expect(resolvedSeq?.impactCues).toHaveLength(2);

      // 3. 端點 A：主遊戲 CombatActionPlayer 實戰播放
      const actionPlayer = new CombatActionPlayer();
      const mainGameCuesTriggered: { cueId: string; time: number; policy?: string }[] = [];

      const combatAction: CombatAction = {
        actionId: 'act_canonical_spec',
        actorId: 'hero_1',
        vfxId: 'VFX_PURE_CANONICAL_TEST_SPEC_9_3',
        events: [
          {
            type: CombatEventType.HIT,
            actionId: 'act_canonical_spec',
            actorId: 'hero_1',
            targetId: 'enemy_1',
            damage: 200,
            text: '主目標重擊'
          },
          {
            type: CombatEventType.HIT,
            actionId: 'act_canonical_spec',
            actorId: 'hero_1',
            targetId: 'enemy_2',
            damage: 300,
            text: '副目標橫掃'
          }
        ]
      };

      await actionPlayer.playAction(combatAction, {
        fromPoint: { x: 50, y: 50 },
        toPoint: { x: 150, y: 150 },
        onPresentImpact: (_item, cue) => {
          if (cue) {
            mainGameCuesTriggered.push({
              cueId: cue.cueId,
              time: cue.time,
              policy: cue.targetPolicy
            });
          }
        }
      });

      // 4. 端點 B：Combat Studio (CombatStudioStageAdapter) 播放
      const studioAdapter = CombatStudioStageAdapter.getInstance();
      const studioCuesTriggered: { cueId: string; time: number; policy?: string }[] = [];

      await studioAdapter.playCombatAction(combatAction, {
        fromPoint: { x: 50, y: 50 },
        toPoint: { x: 150, y: 150 },
        onImpact: (_item, cue) => {
          if (cue) {
            studioCuesTriggered.push({
              cueId: cue.cueId,
              time: cue.time,
              policy: cue.targetPolicy
            });
          }
        }
      });

      // 5. 端點 C：VFX Studio (VFXStudioAdapter) 預覽播放
      const createMockEl = (x: number, y: number, w: number, h: number) => ({
        style: {},
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        offsetWidth: w,
        offsetHeight: h,
        appendChild: () => {},
        getBoundingClientRect: () => ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h })
      } as any as HTMLElement);

      const mockViewport = createMockEl(0, 0, 800, 600);
      const mockCaster = createMockEl(100, 100, 50, 50);
      const mockTarget = createMockEl(400, 100, 50, 50);

      const vfxStudioAdapter = new VFXStudioAdapter({
        viewportContainer: mockViewport,
        casterElement: mockCaster,
        targetElements: [mockTarget]
      });

      const vfxStudioCuesTriggered: { cueId: string; time: number; policy?: string }[] = [];

      await vfxStudioAdapter.play(resolvedSeq!, 0, (_impact, _idx, _tot, _el, cue) => {
        if (cue) {
          vfxStudioCuesTriggered.push({
            cueId: cue.cueId,
            time: cue.time,
            policy: cue.targetPolicy
          });
        }
      });

      // 6. 跨三端嚴格一致性斷言（Cue 數量、時間、target policy、duration 一致）
      expect(pureCanonicalSeq.duration).toBe(0.5);
      expect(pureCanonicalSeq.impactCues).toHaveLength(2);

      // 輔助函式：提取相異 Cue 序列（消除 AOE 多目標分發造成的重複通知）
      const getUniqueCues = (list: { cueId: string; time: number; policy?: string }[]) => {
        const seen = new Set<string>();
        return list.filter(c => {
          if (seen.has(c.cueId)) return false;
          seen.add(c.cueId);
          return true;
        });
      };

      const uniqueMainGameCues = getUniqueCues(mainGameCuesTriggered);
      const uniqueStudioCues = getUniqueCues(studioCuesTriggered);
      const uniqueVfxStudioCues = getUniqueCues(vfxStudioCuesTriggered);

      // 三端相異 Cue 數量一致
      expect(uniqueMainGameCues.length).toBe(2);
      expect(uniqueStudioCues.length).toBe(2);
      expect(uniqueVfxStudioCues.length).toBe(2);

      // Cue ID 與時序一致
      expect(uniqueMainGameCues.map(c => c.cueId)).toEqual(['CUE_ALPHA', 'CUE_BETA']);
      expect(uniqueStudioCues.map(c => c.cueId)).toEqual(['CUE_ALPHA', 'CUE_BETA']);
      expect(uniqueVfxStudioCues.map(c => c.cueId)).toEqual(['CUE_ALPHA', 'CUE_BETA']);

      expect(uniqueMainGameCues.map(c => c.time)).toEqual([0.2, 0.4]);
      expect(uniqueStudioCues.map(c => c.time)).toEqual([0.2, 0.4]);
      expect(uniqueVfxStudioCues.map(c => c.time)).toEqual([0.2, 0.4]);

      // Target Policy 一致
      expect(uniqueMainGameCues.map(c => c.policy)).toEqual(['PRIMARY_TARGET', 'EACH_TARGET']);
      expect(uniqueStudioCues.map(c => c.policy)).toEqual(['PRIMARY_TARGET', 'EACH_TARGET']);
      expect(uniqueVfxStudioCues.map(c => c.policy)).toEqual(['PRIMARY_TARGET', 'EACH_TARGET']);
    }, 15000);
  });
});

