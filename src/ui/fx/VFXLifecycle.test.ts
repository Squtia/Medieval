import { describe, it, expect, vi } from 'vitest';
import { CombatFXEngine } from './CombatFXEngine';
import { VFXSequence } from '../../models/VFX';
import * as THREE from 'three';

describe('VFXLifecycle - Phase 0 失敗案例驗證 (計時器洩漏與 RAF 控制)', () => {
  const createTestPreset = (id: string, duration: number): VFXSequence => ({
    schemaVersion: 2,
    id,
    name: `測試預設 ${id}`,
    category: 'PHYSICAL',
    description: '測試生命週期清理',
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

  it('🔴 缺陷 1：播放完成後，CombatFXEngine 的 scheduledTimers 必須清空，不可殘留失效 Timer ID', async () => {
    const fxEngine = CombatFXEngine.getInstance();
    const preset = createTestPreset('VFX_TIMER_LEAK', 0.05);

    const caster = new THREE.Vector3(0, 0, 0);
    const target = new THREE.Vector3(50, 0, 0);

    const initialTimerCount = (fxEngine as any).scheduledTimers.size;

    // 播放一個短特效
    await fxEngine.playPresetWorld(preset, caster, target);

    const finalTimerCount = (fxEngine as any).scheduledTimers.size;
    expect(finalTimerCount).toBe(initialTimerCount);
  });

  it('🛡️ RAF 控制與循環停止：stopLoop 必須取消動畫幀並重設狀態', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const mockCancel = vi.fn();
    (globalThis as any).cancelAnimationFrame = mockCancel;

    (fxEngine as any).rafId = 999;
    (fxEngine as any).isRunning = true;

    fxEngine.stopLoop();

    expect((fxEngine as any).isRunning).toBe(false);
    expect((fxEngine as any).rafId).toBeNull();
    expect(mockCancel).toHaveBeenCalledWith(999);
  });

  it('🛡️ 容器遷移：mount 到新容器時，舊容器不得殘留 Canvas 節點', () => {
    const fxEngine = CombatFXEngine.getInstance();
    const createMockContainer = () => {
      const children: any[] = [];
      const el: any = {
        children,
        clientWidth: 800,
        clientHeight: 500,
        appendChild: vi.fn((child: any) => {
          children.push(child);
          child.parentNode = el;
          return child;
        }),
        querySelectorAll: vi.fn((selector: string) => {
          if (selector === 'canvas') return children.filter(c => c.tagName === 'CANVAS');
          return [];
        })
      };
      return el;
    };

    const oldContainer = createMockContainer();
    const newContainer = createMockContainer();

    const mockCanvas: any = {
      tagName: 'CANVAS',
      style: {},
      parentNode: null,
      remove: vi.fn(function (this: any) {
        if (this.parentNode && this.parentNode.children) {
          const idx = this.parentNode.children.indexOf(this);
          if (idx !== -1) this.parentNode.children.splice(idx, 1);
        }
        this.parentNode = null;
      })
    };

    (fxEngine as any).renderer = {
      domElement: mockCanvas,
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn()
    };

    fxEngine.mount(oldContainer);
    expect(oldContainer.querySelectorAll('canvas').length).toBe(1);

    // 遷移到新容器
    fxEngine.mount(newContainer);
    expect(oldContainer.querySelectorAll('canvas').length).toBe(0);
    expect(newContainer.querySelectorAll('canvas').length).toBe(1);

    fxEngine.unmount();
    expect(newContainer.querySelectorAll('canvas').length).toBe(0);
  });

  it('🛡️ 冪等銷毀：destroy 連續調用兩次不得拋出任何例外', () => {
    const fxEngine = CombatFXEngine.getInstance();
    expect(() => {
      fxEngine.destroy();
      fxEngine.destroy();
    }).not.toThrow();
  });

  it('✅ 驗證 Phase 8 情境 10: 循環執行 100 次 mount -> destroy，Canvas 與監聽器計數嚴格不增長 (零資源洩漏)', () => {
    const fxEngine = CombatFXEngine.getInstance();

    const mockCanvas: any = {
      tagName: 'CANVAS',
      style: {},
      parentNode: null,
      remove: vi.fn(function (this: any) {
        if (this.parentNode && this.parentNode.children) {
          const idx = this.parentNode.children.indexOf(this);
          if (idx !== -1) this.parentNode.children.splice(idx, 1);
        }
        this.parentNode = null;
      })
    };

    (fxEngine as any).renderer = {
      domElement: mockCanvas,
      setSize: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn()
    };

    // 模擬容器
    const container: any = {
      children: [] as any[],
      appendChild: vi.fn((child: any) => {
        child.parentNode = container;
        container.children.push(child);
      }),
      removeChild: vi.fn((child: any) => {
        const idx = container.children.indexOf(child);
        if (idx !== -1) container.children.splice(idx, 1);
        child.parentNode = null;
      }),
      querySelectorAll: vi.fn((selector: string) => {
        if (selector === 'canvas') {
          return container.children.filter((c: any) => c.tagName === 'CANVAS');
        }
        return [];
      })
    };

    let addListenerCount = 0;
    let removeListenerCount = 0;

    const origAdd = globalThis.addEventListener;
    const origRemove = globalThis.removeEventListener;

    (globalThis as any).addEventListener = vi.fn(() => { addListenerCount++; });
    (globalThis as any).removeEventListener = vi.fn(() => { removeListenerCount++; });

    try {
      // 進行 100 次循環 mount -> destroy
      for (let i = 0; i < 100; i++) {
        fxEngine.mount(container);
        expect(container.querySelectorAll('canvas')).toHaveLength(1);
        fxEngine.destroy();
        expect(container.querySelectorAll('canvas')).toHaveLength(0);
      }

      // 斷言：100 次銷毀後，DOM 中殘留 Canvas 恆為 0
      expect(container.querySelectorAll('canvas')).toHaveLength(0);

      // 斷言：每次 mount 新增的 window resize 監聽器都必須在 destroy / unmount 時精準移除 (解除數 === 新增數)
      expect(removeListenerCount).toBe(addListenerCount);

      // 斷言：active effects 恆為 0
      expect(fxEngine.getInstanceRegistry().getActiveCount()).toBe(0);
    } finally {
      (globalThis as any).addEventListener = origAdd;
      (globalThis as any).removeEventListener = origRemove;
    }
  });
});
