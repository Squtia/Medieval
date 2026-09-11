import { describe, it, expect, vi } from 'vitest';
import { CombatFXEngine } from './CombatFXEngine';
import { VFXSequence } from '../../models/VFX';
import * as THREE from 'three';

describe('VFXConcurrentPlayback - Phase 0 失敗案例驗證 (並行播放與多目標 AOE 隔離)', () => {
  const createTestPreset = (id: string, duration: number): VFXSequence => ({
    schemaVersion: 2,
    id,
    name: `測試預設 ${id}`,
    category: 'PHYSICAL',
    description: '測試並行時鐘與隔離',
    duration,
    spatialMode: 'A_TO_B',
    impactCues: [{ cueId: `${id}_cue_0`, time: duration * 0.7, weight: 1, isPrimary: true }],
    tracks: [
      {
        id: 'trk_main',
        name: '主斬擊',
        type: 'SLASH',
        clips: [
          {
            id: 'clip_slash_1',
            name: '斬擊',
            startTime: 0,
            duration,
            payload: {
              type: 'SLASH',
              data: {
                rendererType: 'SLASH',
                trajectory: 'MELEE_SWEEP',
                shaderMode: 'SLASH_BLADE',
                colorCore: '#ffffff',
                colorRim: '#f59e0b',
                scale: 1,
                rotX: 0,
                rotY: 0,
                rotZ: 0
              }
            }
          }
        ]
      },
      {
        id: 'trk_impact',
        name: '打擊反饋',
        type: 'IMPACT',
        clips: [
          {
            id: 'clip_impact_1',
            name: '打擊',
            startTime: duration * 0.7,
            duration: 0.2,
            payload: {
              type: 'IMPACT',
              data: {
                hitStopTime: 30,
                targetPunchScale: 0.9,
                shakeIntensity: 5,
                shakeDuration: 0.2,
                penetrationDistance: 0,
                knockbackDistance: 0,
                hitFlashColor: '#ffffff',
                screenShake: false
              }
            }
          }
        ]
      }
    ]
  });

  it('🔴 缺陷 1：兩個不同 Duration 的 Effect 同時播放時，第二個 Effect 不得篡改第一個 Effect 的時鐘長度', async () => {
    const fxEngine = CombatFXEngine.getInstance();
    const clock = fxEngine.getPlaybackClock();

    const longPreset = createTestPreset('VFX_LONG', 2.0);
    const shortPreset = createTestPreset('VFX_SHORT', 0.4);

    const caster = new THREE.Vector3(0, 0, 0);
    const target1 = new THREE.Vector3(100, 0, 0);
    const target2 = new THREE.Vector3(200, 0, 0);

    // 1. 同時啟動長特效與短特效 (例如隊友與敵人同時施法，或連擊並行)
    const p1 = fxEngine.playPresetWorld(longPreset, caster, target1);
    const p2 = fxEngine.playPresetWorld(shortPreset, caster, target2);

    // ⚠️ 預期在此紅燈：目前 CombatFXEngine 內部共用單一 this.playbackClock，
    // 第二個 shortPreset 的 playPresetWorld 直接呼叫了 this.playbackClock.setDuration(0.4)，
    // 導致全局時鐘的 duration 被縮減為 0.4s，原本 2.0s 的長特效被強制截斷！
    expect(clock.getDuration()).toBe(2.0);

    await Promise.all([p1, p2]);
  });

  it('🛡️ 獨立 Effect Instance 與隔離保護：clearStudioPreview 不得清除戰鬥 instance', async () => {
    const fxEngine = CombatFXEngine.getInstance();
    const registry = fxEngine.getInstanceRegistry();

    const longPreset = createTestPreset('VFX_ISOLATED_LONG', 1.5);
    const caster = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(100, 0, 0);

    const playPromise = fxEngine.playPresetWorld(longPreset, caster, target);
    expect(registry.getActiveCount()).toBeGreaterThan(0);

    // 工房或外部呼叫 clearStudioPreview()
    fxEngine.clearStudioPreview();

    // 驗證戰鬥中的 Effect Instance 依然存活，未被誤傷！
    expect(registry.getActiveCount()).toBeGreaterThan(0);

    await playPromise;
  });

  it('🛡️ 超額降級保護：超出 MAX_ACTIVE_INSTANCES (32) 時，自動淘汰最舊實例，杜絕顯存洩漏', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const registry = fxEngine.getInstanceRegistry();
    registry.clearAll();

    for (let i = 0; i < 40; i++) {
      const root = new THREE.Group();
      registry.register({
        id: `mock_inst_${i}`,
        root,
        startTime: Date.now(),
        duration: 1.0,
        dispose: () => {}
      });
    }

    // 驗證活躍數量受控於 32 上限
    expect(registry.getActiveCount()).toBe(32);
    // 驗證最早註冊的 mock_inst_0 已被自動淘汰降級
    expect(registry.has('mock_inst_0')).toBe(false);
    expect(registry.has('mock_inst_39')).toBe(true);

    registry.clearAll();
    expect(registry.getActiveCount()).toBe(0);
  });

  it('✅ 驗證 Phase 8 情境 5: 三目標 AOE 同時播放時各自持有獨立 Effect Instance 與空間座標，單獨結束不誤傷', async () => {
    const fxEngine = CombatFXEngine.getInstance();
    const registry = fxEngine.getInstanceRegistry();
    registry.clearAll();

    const aoePreset = createTestPreset('VFX_AOE_FIREBLAST', 1.0);
    const caster = new THREE.Vector3(0, 0, 0);
    const target1 = new THREE.Vector3(120, 0, 0);
    const target2 = new THREE.Vector3(240, 50, 0);
    const target3 = new THREE.Vector3(-100, -80, 0);

    // 三目標 AOE 同時觸發播放 (例如戰鬥中大招打擊 3 個敵方單位)
    const p1 = fxEngine.playPresetWorld(aoePreset, caster, target1);
    const p2 = fxEngine.playPresetWorld(aoePreset, caster, target2);
    const p3 = fxEngine.playPresetWorld(aoePreset, caster, target3);

    // 1. 斷言：registry 必須同時記錄 3 個獨立的活躍實例
    expect(registry.getActiveCount()).toBe(3);
    const instances = registry.getAll();
    expect(instances).toHaveLength(3);

    // 2. 斷言：3 個實例各自持有不同的 root THREE.Group 物件
    const roots = instances.map(inst => inst.root);
    const uniqueRoots = new Set(roots);
    expect(uniqueRoots.size).toBe(3);

    // 3. 模擬其中一個目標的 Effect 提前被取消或完成 (unregister)
    const firstInstanceId = instances[0].id;
    registry.unregister(firstInstanceId);

    // 4. 斷言：被註銷的實例已移除，但其餘兩個目標的實例依然活躍完好！
    expect(registry.has(firstInstanceId)).toBe(false);
    expect(registry.getActiveCount()).toBe(2);
    expect(registry.has(instances[1].id)).toBe(true);
    expect(registry.has(instances[2].id)).toBe(true);

    // 等待所有異步結束
    await Promise.all([p1, p2, p3]);
    registry.clearAll();
  });
});
