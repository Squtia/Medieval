import { describe, it, expect, vi } from 'vitest';
import { CombatFXEngine } from './CombatFXEngine';
import { VFXPreset } from '../../models/VFX';
import * as THREE from 'three';

describe('VFXLifecycle - Phase 0 失敗案例驗證 (計時器洩漏與 RAF 控制)', () => {
  const createTestPreset = (id: string, duration: number): VFXPreset => ({
    id,
    name: `測試預設 ${id}`,
    category: 'PHYSICAL',
    description: '測試生命週期清理',
    trajectory: 'MELEE_SWEEP',
    shaderMode: 'SLASH_BLADE',
    colorCore: '#ffffff',
    colorRim: '#f59e0b',
    duration,
    scale: 1,
    spin: 0,
    fresnel: 1,
    trailCount: 10,
    trailSize: 5,
    spikes: 0,
    spikeHeight: 0,
    burstCount: 10,
    bloomStr: 1,
    bloomRad: 0.5,
    bloomThresh: 0.2,
    impact: {
      hitStopTime: 30,
      targetPunchScale: 0.9,
      shakeIntensity: 5,
      shakeDuration: 0.2,
      penetrationDistance: 0,
      knockbackDistance: 0,
      hitFlashColor: '#ffffff',
      screenShake: false
    },
    layers: []
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
});
