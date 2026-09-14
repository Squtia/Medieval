import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VFXStudioStore } from './VFXStudioStore';
import { VFXLibrary } from './VFXLibrary';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { VFXPreset, getSequenceMainClip } from '../../models/VFX';

// 建立輕量 Mock DOM 環境
function setupMockDom() {
  const elements = new Map<string, any>();

  const createMockElement = (id: string, tag: string = 'div') => {
    const el = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      style: {} as Record<string, string>,
      dataset: {} as Record<string, string>,
      listeners: {} as Record<string, Function[]>,
      addEventListener(type: string, fn: Function) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(fn);
      },
      dispatchEvent(e: any) {
        const fns = this.listeners[e.type] || [];
        fns.forEach(fn => fn(e));
      },
      querySelector(sel: string) {
        if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
        return null;
      },
      querySelectorAll(sel: string) {
        return [];
      }
    };
    elements.set(id, el);
    return el;
  };

  const container = createMockElement('library-container');
  createMockElement('lib-preset-select', 'select');
  createMockElement('lib-btn-publish', 'button');
  createMockElement('lib-btn-new', 'button');
  createMockElement('lib-btn-clone', 'button');
  createMockElement('lib-btn-export', 'button');
  createMockElement('lib-btn-bind-attack', 'button');
  createMockElement('lib-btn-reset-attack', 'button');
  createMockElement('lib-snapshot-select', 'select');
  createMockElement('lib-btn-refresh-snapshots', 'button');
  createMockElement('lib-btn-restore-snapshot', 'button');
  createMockElement('lib-snapshot-msg', 'div');

  (globalThis as any).document = {
    getElementById: (id: string) => elements.get(id) || null,
    querySelector: (sel: string) => {
      if (sel.startsWith('#')) return elements.get(sel.slice(1)) || null;
      return null;
    },
    querySelectorAll: () => []
  };

  return { container, elements };
}

describe('VFXStudioPublishFlow - Phase 0 失敗案例驗證 (發布資料閉環)', () => {
  let store: VFXStudioStore;
  let repo: VFXPresetRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    store = VFXStudioStore.getInstance();
    repo = VFXPresetRepository.getInstance();
    store.setDirty(false);
  });

  it('🔴 缺陷 1：修改目前 Preset 後發布，發布至伺服器的 payload 必須包含最新修改草稿', async () => {
    const { container, elements } = setupMockDom();
    const lib = new VFXLibrary(container as any);

    // 1. 使用者在 Inspector / Timeline 調整了當前預設的 colorCore
    const current = store.getPreset();
    const testColor = '#00ffcc';
    store.updateConfig({ colorCore: testColor }, true);

    expect((getSequenceMainClip(store.getSequence())?.payload.data as any)?.colorCore).toBe(testColor);
    expect(store.getIsDirty()).toBe(true);

    // 2. 攔截 fetch，檢查發布給伺服器的 body 內容
    let capturedPayload: any = null;
    (globalThis as any).fetch = vi.fn(async (url: string, options: any) => {
      if (url === '/__vfx_api/save_ssot') {
        capturedPayload = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ success: true, count: capturedPayload.presets.length, snapshot: 'snap_test.json' })
        };
      }
      return { ok: false, json: async () => ({}) };
    });

    (globalThis as any).alert = vi.fn();

    // 3. 觸發點擊發布按鈕
    const publishBtn = elements.get('lib-btn-publish');
    publishBtn.dispatchEvent({ type: 'click' });

    // 等待發布流程
    await new Promise(r => setTimeout(r, 50));

    // 驗證：發布送出之 presets 陣列中，對應 id 的預設必須包含剛修改的 colorCore
    expect(capturedPayload).not.toBeNull();
    const publishedPreset = capturedPayload.presets.find((p: VFXPreset) => p.id === current.id);
    expect(publishedPreset).toBeDefined();

    // ⚠️ 預期在此紅燈：目前 VFXLibrary 直接呼叫 this.repo.getAllPresets()，
    // 未將 store.getPreset() 寫入 repo，所以送出的依然是舊顏色！
    expect(publishedPreset.colorCore).toBe(testColor);
  });

  it('🔴 缺陷 2：發布失敗 (HTTP 500) 時，Dirty 標記不可被清除，且草稿必須完整保留', async () => {
    const { container, elements } = setupMockDom();
    const lib = new VFXLibrary(container as any);

    store.updateConfig({ duration: 1.88 }, true);
    expect(store.getIsDirty()).toBe(true);

    (globalThis as any).fetch = vi.fn(async () => {
      return {
        ok: false,
        json: async () => ({ success: false, error: 'Internal Server Error' })
      };
    });
    (globalThis as any).alert = vi.fn();
    if (!globalThis.navigator) {
      Object.defineProperty(globalThis, 'navigator', {
        value: { clipboard: { writeText: vi.fn() } },
        configurable: true,
        writable: true
      });
    } else if (!globalThis.navigator.clipboard) {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: { writeText: vi.fn() },
        configurable: true,
        writable: true
      });
    } else {
      vi.spyOn(globalThis.navigator.clipboard, 'writeText').mockImplementation(vi.fn());
    }

    const publishBtn = elements.get('lib-btn-publish');
    publishBtn.dispatchEvent({ type: 'click' });
    await new Promise(r => setTimeout(r, 50));

    // 驗證：發布失敗時，Dirty 必須維持 true
    expect(store.getIsDirty()).toBe(true);
    expect(store.getPreset().duration).toBe(1.88);
  });

  it('🔴 缺陷 3：切換下拉選單預設時，若當前有未保存之 Dirty 草稿，不得靜默覆蓋遺失', () => {
    const { container, elements } = setupMockDom();
    const lib = new VFXLibrary(container as any);

    // 1. 在 Store 中修改草稿
    const originalPresetId = store.getPreset().id;
    store.updateConfig({ name: '尚未保存的修改草稿' }, true);
    expect(store.getIsDirty()).toBe(true);

    // 2. 創作者不小心切換下拉選單到另一個 Preset
    const select = elements.get('lib-preset-select');
    select.value = 'VFX_FIREBALL';

    // 模擬使用者在 prompt/confirm 點擊「取消」或希望保留
    (globalThis as any).confirm = vi.fn(() => false);

    select.dispatchEvent({ type: 'change', target: select });

    // ⚠️ 預期在此紅燈：目前 VFXLibrary.ts 直接 setPreset(p, false); setDirty(false)，
    // 根本沒有確認攔截，導致原先草稿被硬生生抹殺！
    expect(store.getPreset().id).toBe(originalPresetId);
    expect(store.getIsDirty()).toBe(true);
  });

  it('✅ 驗證 4：發布成功後，Repository 重新載入或回讀依然保留該草稿修改', async () => {
    const { container, elements } = setupMockDom();
    const lib = new VFXLibrary(container as any);

    const testDuration = 2.45;
    store.updateConfig({ duration: testDuration }, true);

    (globalThis as any).fetch = vi.fn(async (url: string, options: any) => {
      if (url === '/__vfx_api/save_ssot') {
        const payload = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({ success: true, count: payload.presets.length, snapshot: 'snap_123.json' })
        };
      }
      if (url.startsWith('/api/get-vfx-presets')) {
        return {
          ok: true,
          json: async () => repo.getAllSequences()
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    (globalThis as any).alert = vi.fn();

    const publishBtn = elements.get('lib-btn-publish');
    publishBtn.dispatchEvent({ type: 'click' });
    await new Promise(r => setTimeout(r, 60));

    // 驗證：Dirty 被清除，且 repo 中確實保存了修改後的 duration
    expect(store.getIsDirty()).toBe(false);
    expect(repo.getPreset(store.getPreset().id)?.duration).toBe(testDuration);
  });

  it('🔴 驗證 5：回讀資料與草稿深層比對不一致時 (例如 Layer 或 Cue 未同步)，必須中斷且 Dirty 保持 true', async () => {
    const { container, elements } = setupMockDom();
    const lib = new VFXLibrary(container as any);

    // 修改 Cue 與 Layer
    const current = store.getPreset();
    store.updateConfig({
      impactCues: [
        ...(current.impactCues || []),
        { cueId: 'cue_test_deep_eq', time: 0.22, kind: 'IMPACT', weight: 50 }
      ]
    }, true);
    expect(store.getIsDirty()).toBe(true);

    (globalThis as any).fetch = vi.fn(async (url: string) => {
      if (url === '/__vfx_api/save_ssot') {
        return {
          ok: true,
          json: async () => ({ success: true, count: 30, snapshot: 'snap_123.json' })
        };
      }
      if (url.startsWith('/api/get-vfx-presets')) {
        // 模擬伺服器返回的資料中，該 Cue 遺漏（例如寫入失敗或資料未同步）
        const stalePresets = repo.getAllSequences().map(p => {
          if (p.id === current.id) {
            return { ...p, impactCues: [] }; // 故意回傳空 cues
          }
          return p;
        });
        return {
          ok: true,
          json: async () => stalePresets
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    (globalThis as any).alert = vi.fn();

    const publishBtn = elements.get('lib-btn-publish');
    publishBtn.dispatchEvent({ type: 'click' });
    await new Promise(r => setTimeout(r, 60));

    // 驗證：因深層比對失敗，Dirty 嚴格不可被清除，畫面草稿完整保留
    expect(store.getIsDirty()).toBe(true);
    expect(store.getPreset().impactCues?.some((c: any) => c.cueId === 'cue_test_deep_eq')).toBe(true);
  });

  it('🔴 驗證 6：回讀端點網路異常 (HTTP 500 / 連線失敗) 時，必須判定發布未完成且 Dirty 保持 true', async () => {
    const { container, elements } = setupMockDom();
    const lib = new VFXLibrary(container as any);

    store.updateConfig({ colorCore: '#123456' }, true);
    expect(store.getIsDirty()).toBe(true);

    (globalThis as any).fetch = vi.fn(async (url: string) => {
      if (url === '/__vfx_api/save_ssot') {
        return {
          ok: true,
          json: async () => ({ success: true, count: 30, snapshot: 'snap_123.json' })
        };
      }
      if (url.startsWith('/api/get-vfx-presets')) {
        // 模擬回讀端點崩潰或中斷
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: 'Database read error' })
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    (globalThis as any).alert = vi.fn();

    const publishBtn = elements.get('lib-btn-publish');
    publishBtn.dispatchEvent({ type: 'click' });
    await new Promise(r => setTimeout(r, 60));

    // 驗證：因回讀異常，絕不可視為成功，Dirty 依然為 true
    expect(store.getIsDirty()).toBe(true);
    expect((getSequenceMainClip(store.getSequence())?.payload.data as any)?.colorCore).toBe('#123456');
  });
});
