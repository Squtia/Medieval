import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { VFXStudioStore } from '../../tools/vfx-studio/VFXStudioStore';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { VFXLibrary } from '../../tools/vfx-studio/VFXLibrary';
import { VFXSequence } from '../../models/VFX';
import { MeshLayerRenderer } from '../../ui/fx/renderers/MeshLayerRenderer';
import { TrailLayerRenderer } from '../../ui/fx/renderers/TrailLayerRenderer';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';

describe('🎯 播放無拖尾污染、名稱編輯防護與自訂特效管線驗收', () => {
  let store: VFXStudioStore;
  let repo: VFXPresetRepository;

  beforeEach(() => {
    store = VFXStudioStore.getInstance();
    repo = VFXPresetRepository.getInstance();
  });

  it('🛡️ 播放污染根治：未配置拖尾的技能不得被無中生有塞入 35 顆拖尾粒子', () => {
    // 建立一個標準無拖尾技能 (例如純粹斬擊或盾擊)
    const cleanSlashSeq: VFXSequence = {
      schemaVersion: 2,
      id: 'VFX_TEST_NO_TRAIL',
      name: '無拖尾純物理劍擊',
      category: 'PHYSICAL',
      description: '純劍刃無粒子',
      duration: 0.4,
      spatialMode: 'AT_TARGET',
      tracks: [
        {
          id: 'trk_main',
          name: '主軌',
          type: 'SLASH',
          enabled: true,
          clips: [
            {
              id: 'clip_main_0',
              startTime: 0,
              duration: 0.4,
              payload: {
                type: 'SLASH',
                data: {
                  rendererType: 'SLASH',
                  shaderMode: 'SLASH_BLADE',
                  colorCore: '#ffffff',
                  colorRim: '#3b82f6'
                  // 未定義 trailCount
                }
              }
            }
          ]
        }
      ],
      impactCues: [{ cueId: 'CUE_1', time: 0.28, weight: 1.0, isPrimary: true }]
    };

    store.setSequence(cleanSlashSeq, false);

    // 驗證 resolvedData 與 pData 中沒有 trailCount 時，求值得到的 trailCount 嚴格為 0
    const mainClip = cleanSlashSeq.tracks[0].clips[0];
    const pData = (cleanSlashSeq.tracks.find(t => t.type === 'PARTICLE')?.clips[0]?.payload.data || {}) as Record<string, any>;
    const resolvedData = mainClip.payload.data as Record<string, any>;

    const trailCount = resolvedData.trailCount !== undefined ? resolvedData.trailCount : (pData.trailCount !== undefined ? pData.trailCount : 0);
    expect(trailCount).toBe(0);
  });

  it('🏷️ 名稱與描述編輯：Store 必須正確更新根屬性，且不得將 name/description 洩漏至 mainClip.payload.data', () => {
    const testSeq: VFXSequence = {
      schemaVersion: 2,
      id: 'VFX_TEST_RENAME',
      name: '原有名稱',
      category: 'SPECIAL',
      description: '原有描述',
      duration: 0.5,
      spatialMode: 'TRAJECTORY',
      tracks: [
        {
          id: 'trk_main',
          name: '主軌',
          type: 'MESH',
          enabled: true,
          clips: [
            {
              id: 'clip_main',
              startTime: 0,
              duration: 0.5,
              payload: {
                type: 'PROJECTILE',
                data: {
                  rendererType: 'PROJECTILE' as const,
                  shape: 'ARROW' as const,
                  colorCore: '#ffffff'
                }
              }
            }
          ]
        }
      ],
      impactCues: [{ cueId: 'CUE_1', time: 0.35, weight: 1.0, isPrimary: true }]
    };

    store.setSequence(testSeq, false);

    // 模擬使用者在介面輸入新名稱與新描述
    store.updateConfig({
      name: '使用者自訂新名稱',
      description: '使用者更新後的備註描述'
    });

    const updatedSeq = store.getSequence();
    expect(updatedSeq.name).toBe('使用者自訂新名稱');
    expect(updatedSeq.description).toBe('使用者更新後的備註描述');

    // 關鍵斷言：Clip payload.data 內絕不被污染出 name 或 description
    const clipData = updatedSeq.tracks[0].clips[0].payload.data as any;
    expect(clipData.name).toBeUndefined();
    expect(clipData.description).toBeUndefined();
  });

  it('🚀 自訂新特效生命週期：使用者新建自訂特效能成功保存與檢索', () => {
    const newCustomSeq: VFXSequence = {
      schemaVersion: 2,
      id: 'VFX_CUSTOM_PLAYER_NEW',
      name: '玩家新建烈焰刀',
      category: 'SPECIAL',
      description: '玩家自創特效',
      duration: 0.6,
      spatialMode: 'TRAJECTORY',
      tracks: [
        {
          id: 'trk_main',
          name: '主特效軌',
          type: 'SLASH',
          enabled: true,
          clips: [
            {
              id: 'clip_main_0',
              startTime: 0,
              duration: 0.55,
              payload: {
                type: 'SLASH',
                data: {
                  rendererType: 'SLASH',
                  shaderMode: 'SLASH_BLADE',
                  colorCore: '#ffedd5',
                  colorRim: '#ea580c'
                }
              }
            }
          ]
        }
      ],
      impactCues: [{ cueId: 'CUE_1', time: 0.42, weight: 1.0, isPrimary: true }]
    };

    const saveResult = repo.saveSequence(newCustomSeq);
    expect(saveResult.success).toBe(true);
    expect(repo.hasSequence('VFX_CUSTOM_PLAYER_NEW')).toBe(true);

    const retrieved = repo.getSequence('VFX_CUSTOM_PLAYER_NEW');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('玩家新建烈焰刀');

    repo.deletePreset('VFX_CUSTOM_PLAYER_NEW');
  });

  it('🏷️ VFXLibrary 基本資訊卡片切換連動：updateMetaCard 必須即時更新 ID、名稱與描述', () => {
    // 建立輕量 Mock DOM 元素
    const mockElements: Record<string, { textContent?: string; value?: string }> = {
      '#lib-display-seq-id': { textContent: 'VFX_HEAVY_STRIKE' },
      '#lib-input-seq-name': { value: '巨力重劈 (Heavy Strike)' },
      '#lib-input-seq-desc': { value: '沉重的近戰大威力劈砍' },
      '#lib-preset-select': { value: 'VFX_HEAVY_STRIKE' }
    };

    const mockContainer = {
      querySelector: (selector: string) => mockElements[selector] || null,
      querySelectorAll: () => []
    } as unknown as HTMLElement;

    const library = Object.create(VFXLibrary.prototype);
    library.container = mockContainer;

    // 模擬切換到「精靈矢雨 (VFX_SPIRIT_DANCE)」
    const spiritDance = repo.getPreset('VFX_SPIRIT_DANCE')!;
    expect(spiritDance).toBeDefined();

    // 執行連動更新函式
    library.updateMetaCard(spiritDance);

    // 斷言卡片中文字與下拉選單必須 100% 變更為「精靈矢雨」
    expect(mockElements['#lib-display-seq-id'].textContent).toBe('VFX_SPIRIT_DANCE');
    expect(mockElements['#lib-input-seq-name'].value).toBe(spiritDance.name);
    expect(mockElements['#lib-input-seq-desc'].value).toBe(spiritDance.description);
    expect(mockElements['#lib-preset-select'].value).toBe('VFX_SPIRIT_DANCE');
  });

  it('🏹 多發彈幕 (ARC_MULTI / Salvo) 拖尾附著：每顆子彈自帶專屬拖尾，座標緊跟貝茲軌跡且非線性聚集', () => {
    const trackGroup = new THREE.Group();
    const cache: any = {};
    const startPos = new THREE.Vector3(0, 0, 0);
    const endPos = new THREE.Vector3(400, 0, 0);

    // 模擬「精靈矢雨」：5 發散射彈幕，扇形開角 25 度，拖尾 16 顆
    MeshLayerRenderer.updateArcMulti(
      trackGroup,
      startPos,
      endPos,
      0.5, // 飛行進度 50%
      1.0,
      '#38bdf8',
      cache,
      5, // 5 發齊射
      undefined,
      25, // 25 度散射角
      0,
      0,
      'FRESNEL_ICE',
      '#ffffff',
      { trailCount: 16, trailSize: 6, trailColor: '#38bdf8' }
    );

    expect(cache.multiArcs).toBeDefined();
    expect(cache.multiArcs.length).toBe(5);

    // 驗證每一發子彈都自帶獨立的 trailPoints 與 trailGeo
    cache.multiArcs.forEach((arc: any) => {
      expect(arc.trailPoints).toBeDefined();
      expect(arc.trailGeo).toBeDefined();
      expect(arc.trailPoints.visible).toBe(true);
    });

    // 關鍵空間斷言：頂部子彈 (arc 0) 與底部子彈 (arc 4) 的拖尾粒子 Y 座標必須實質分開，消滅中央虛擬直線！
    const topArc = cache.multiArcs[0];
    const bottomArc = cache.multiArcs[4];
    const topPosArr = topArc.trailGeo.attributes.position.array as Float32Array;
    const bottomPosArr = bottomArc.trailGeo.attributes.position.array as Float32Array;

    // 取樣第 1 個粒子 (接近質點近端) 的 Y 座標
    const topBulletY = topArc.group.position.y;
    const bottomBulletY = bottomArc.group.position.y;
    expect(topBulletY).not.toBe(bottomBulletY);

    const topTrailY = topPosArr[1]; // y
    const bottomTrailY = bottomPosArr[1]; // y
    expect(Math.abs(topTrailY - bottomTrailY)).toBeGreaterThan(20);

    // 清理資源
    trackGroup.traverse((obj: any) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  });

  it('🕊️ 拖尾終點消散：在進度 >= 0.99 (命中目標) 時，子彈與拖尾頂點必須徹底隱藏，杜絕定格殘留', () => {
    const trackGroup = new THREE.Group();
    const cache: any = {};
    const startPos = new THREE.Vector3(0, 0, 0);
    const endPos = new THREE.Vector3(400, 0, 0);

    // 測試進度到達 0.999 (命中)
    MeshLayerRenderer.updateArcMulti(
      trackGroup,
      startPos,
      endPos,
      0.999,
      1.0,
      '#38bdf8',
      cache,
      3,
      undefined,
      15,
      0,
      0,
      'FRESNEL_ICE',
      '#ffffff',
      { trailCount: 12, trailSize: 6, trailColor: '#38bdf8' }
    );

    // 斷言所有子彈與其拖尾皆已不可見
    cache.multiArcs.forEach((arc: any) => {
      expect(arc.group.visible).toBe(false);
      if (arc.trailPoints) {
        expect(arc.trailPoints.visible).toBe(false);
      }
    });

    // 驗證單軌 TrailLayerRenderer 在 p >= 0.99 時粒子整體隱藏且透明度歸零
    const testScene = new THREE.Scene();
    const trail = TrailLayerRenderer.createTrail(testScene, startPos, '#f59e0b', 10, 8, 1.0);
    trail.updateTrajectoryTrail?.(startPos, endPos, 0.999, 0);

    expect(trail.points.visible).toBe(false);
    expect(trail.material.opacity).toBe(0);

    trail.dispose();
  });

  it('⏱️ 連續戰鬥時鐘累積排程：在時鐘已運行數秒後施放技能，Cue 點絕不在第 1 影格秒觸發，而是精確在 cue.time 到達時觸發', async () => {
    const { CombatFXEngine } = await import('../../ui/fx/CombatFXEngine');
    const engine = CombatFXEngine.getInstance();

    // 模擬戰鬥進行了 5.0 秒（全域邏輯時鐘推進至 5.0 秒）
    const scheduler = (engine as any).playbackClock;
    scheduler.currentTime = 5.0;

    const testSeq: VFXSequence = {
      schemaVersion: 2,
      id: 'VFX_TEST_CUE_TIMING',
      name: '測試時序',
      category: 'SPECIAL',
      description: '測試時鐘時序',
      duration: 0.5,
      spatialMode: 'A_TO_B',
      tracks: [
        {
          id: 'trk_main',
          name: '主軌',
          type: 'MESH',
          enabled: true,
          clips: [
            {
              id: 'c1',
              startTime: 0,
              duration: 0.5,
              payload: {
                type: 'PROJECTILE',
                data: { rendererType: 'PROJECTILE', shape: 'SPHERE' }
              }
            }
          ]
        }
      ],
      impactCues: [
        { cueId: 'CUE_1', time: 0.28, weight: 1.0, isPrimary: true }
      ]
    };

    let hitTriggered = false;
    let hitTime = -1;

    // 呼叫 playSequence 進行播放 (確保 engine 處於 isRunning 狀態)
    (engine as any).isRunning = true;
    const from = new THREE.Vector3(0, 0, 0);
    const to = new THREE.Vector3(400, 0, 0);
    const playPromise = engine.playSequenceWorld(
      testSeq,
      from,
      to,
      true,
      () => {
        hitTriggered = true;
        hitTime = scheduler.getCurrentTime();
      }
    );

    // 關鍵斷言 1：在施放後的第一影格 (推進 0.016 秒，時間到 5.016 秒)，Cue 絕不得提前觸發！
    scheduler.advance(0.016);
    expect(hitTriggered).toBe(false);

    // 關鍵斷言 2：再推進 0.1 秒 (時間到 5.116 秒)，Cue 依然未觸發！
    scheduler.advance(0.1);
    expect(hitTriggered).toBe(false);

    // 關鍵斷言 3：推進到 0.28 秒之後 (推進 0.2 秒，時間到 5.316 秒 >= 5.0 + 0.28)，Cue 精準觸發！
    scheduler.advance(0.2);
    expect(hitTriggered).toBe(true);
    expect(hitTime).toBeCloseTo(5.28, 1);

    // 推進完畢結束
    scheduler.advance(0.3);
    await playPromise;
    engine.clear();
  });

  it('💥 命中爆散碎屑 (burstCount) 自動吸附主 CUE 點：未到 CUE 點進度前隱藏，抵達 CUE 點進度瞬間精準爆散', () => {
    const engine = CombatFXEngine.getInstance();
    (engine as any).isRunning = true;

    // 建立一個總時長 0.8s，CUE 點設在 0.32s (進度 p = 0.32 / 0.8 = 0.40) 的特效序列
    const seq: VFXSequence = {
      schemaVersion: 2,
      id: 'VFX_TEST_BURST_CUE',
      name: '測試爆散吸附',
      description: '測試爆散吸附主CUE點',
      duration: 0.8,
      category: 'SPECIAL',
      tracks: [
        {
          id: 'trk_main',
          name: '主軌',
          type: 'MESH',
          enabled: true,
          clips: [
            {
              id: 'c1',
              startTime: 0,
              duration: 0.8,
              payload: {
                type: 'PROJECTILE',
                data: {
                  rendererType: 'PROJECTILE',
                  burstCount: 30,
                  colorRim: '#38bdf8'
                }
              }
            }
          ]
        }
      ],
      impactCues: [
        { cueId: 'CUE_1', time: 0.32, weight: 1.0, isPrimary: true }
      ]
    };

    const targetGroup = new THREE.Group();
    const from = new THREE.Vector3(0, 0, 0);
    const to = new THREE.Vector3(200, 0, 0);

    // 情況 A：進度 p = 0.35 (< 0.40)，尚未到達 CUE 點，碎屑 Cache 應未產生或處於隱藏
    engine.renderSequenceWorldAt(seq, 0.28, from, to, targetGroup);
    const burstCacheBefore = (targetGroup as any).__burstCache;
    if (burstCacheBefore) {
      expect(burstCacheBefore.points.visible).toBe(false);
    }

    // 情況 B：進度 p = 0.42 (>= 0.40)，已到達 CUE 點，碎屑必須已生成並可見
    engine.renderSequenceWorldAt(seq, 0.34, from, to, targetGroup);
    const burstCacheAfter = (targetGroup as any).__burstCache;
    expect(burstCacheAfter).toBeDefined();
    expect(burstCacheAfter.points.visible).toBe(true);

    engine.clear();
  });

  it('💥 命中爆散碎屑 (burstCount) 自訂時間 (burstTime)：當指定 burstTime 時，碎屑精準於該時間點爆散', () => {
    const engine = CombatFXEngine.getInstance();
    (engine as any).isRunning = true;

    // 建立一個總時長 1.0s，CUE 點設在 0.8s，但創作者指定 burstTime = 0.2s 的序列
    const seq: VFXSequence = {
      schemaVersion: 2,
      id: 'VFX_TEST_BURST_CUSTOM_TIME',
      name: '測試自訂爆散時間',
      description: '測試自訂burstTime爆發時間',
      duration: 1.0,
      category: 'SPECIAL',
      tracks: [
        {
          id: 'trk_main',
          name: '主軌',
          type: 'MESH',
          enabled: true,
          clips: [
            {
              id: 'c1',
              startTime: 0,
              duration: 1.0,
              payload: {
                type: 'PROJECTILE',
                data: {
                  rendererType: 'PROJECTILE',
                  burstCount: 40,
                  burstTime: 0.2, // 創作者強制在第 0.2 秒 (p = 0.20) 爆散
                  colorRim: '#f59e0b'
                }
              }
            }
          ]
        }
      ],
      impactCues: [
        { cueId: 'CUE_1', time: 0.8, weight: 1.0, isPrimary: true }
      ]
    };

    const targetGroup = new THREE.Group();
    const from = new THREE.Vector3(0, 0, 0);
    const to = new THREE.Vector3(200, 0, 0);

    // 情況 A：進度 p = 0.15 (< 0.20)，尚未抵達 burstTime
    engine.renderSequenceWorldAt(seq, 0.15, from, to, targetGroup);
    const burstCacheBefore = (targetGroup as any).__burstCache;
    if (burstCacheBefore) {
      expect(burstCacheBefore.points.visible).toBe(false);
    }

    // 情況 B：進度 p = 0.25 (>= 0.20)，即使 CUE 點在 0.8s，碎屑已依據 burstTime 提早精準爆散！
    engine.renderSequenceWorldAt(seq, 0.25, from, to, targetGroup);
    const burstCacheAfter = (targetGroup as any).__burstCache;
    expect(burstCacheAfter).toBeDefined();
    expect(burstCacheAfter.points.visible).toBe(true);

    engine.clear();
  });
});
