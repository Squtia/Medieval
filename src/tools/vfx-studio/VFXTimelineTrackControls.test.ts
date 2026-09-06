import { describe, it, expect, beforeEach } from 'vitest';
import { VFXStudioStore } from './VFXStudioStore';
import { VFXInspector } from './VFXInspector';

// 輕量 Mock DOM
class MockElement {
  public id: string = '';
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  public value: string = '';
  public textContent: string = '';
  public addEventListener(_type: string, _fn: Function): void {}
  constructor(id: string = '') {
    this.id = id;
  }
}

describe('⏱️ VFXTimelineTrackControls (Phase 4 軌道專業控制項與 Phase 3 情境收合測試)', () => {
  let store: VFXStudioStore;

  beforeEach(() => {
    store = VFXStudioStore.getInstance();
    // 重設乾淨狀態
    store.setTrackMute('main', false);
    store.setTrackMute('layers', false);
    store.setTrackMute('impact', false);

    // 若有 Solo 或 Lock 殘留，清空
    if (store.isTrackSoloed('main')) store.toggleTrackSolo('main');
    if (store.isTrackSoloed('layer_0')) store.toggleTrackSolo('layer_0');
    if (store.isTrackSoloed('layer_1')) store.toggleTrackSolo('layer_1');
    if (store.isTrackLocked('main')) store.toggleTrackLock('main');
    if (store.isTrackLocked('layer_0')) store.toggleTrackLock('layer_0');
  });

  it('1. 預設無 Solo 時，主軌與圖層軌均正常生效活躍', () => {
    expect(store.hasAnySolo()).toBe(false);
    expect(store.isMainTrackActive()).toBe(true);
    expect(store.isLayerTrackActive(0, true)).toBe(true);
    expect(store.isLayerTrackActive(1, true)).toBe(true);
  });

  it('2. 當圖層 0 啟動 Solo 時，主軌與其他未 Solo 圖層應被自動遮蔽', () => {
    const isSolo = store.toggleTrackSolo('layer_0');
    expect(isSolo).toBe(true);
    expect(store.hasAnySolo()).toBe(true);

    // 圖層 0 應活躍
    expect(store.isLayerTrackActive(0, true)).toBe(true);
    // 主軌應被遮蔽
    expect(store.isMainTrackActive()).toBe(false);
    // 圖層 1 未被 Solo，應被遮蔽
    expect(store.isLayerTrackActive(1, true)).toBe(false);

    // 再次點擊解除 Solo
    store.toggleTrackSolo('layer_0');
    expect(store.hasAnySolo()).toBe(false);
    expect(store.isMainTrackActive()).toBe(true);
    expect(store.isLayerTrackActive(1, true)).toBe(true);
  });

  it('3. 當主軌啟動 Solo 時，所有次生圖層應被自動遮蔽', () => {
    store.toggleTrackSolo('main');
    expect(store.isMainTrackActive()).toBe(true);
    expect(store.isLayerTrackActive(0, true)).toBe(false);
    expect(store.isLayerTrackActive(1, true)).toBe(false);

    store.toggleTrackSolo('main');
    expect(store.isMainTrackActive()).toBe(true);
    expect(store.isLayerTrackActive(0, true)).toBe(true);
  });

  it('4. 軌道鎖定 Lock 狀態管理應正確切換與回報', () => {
    expect(store.isTrackLocked('main')).toBe(false);
    expect(store.isTrackLocked('layer_0')).toBe(false);

    store.toggleTrackLock('main');
    expect(store.isTrackLocked('main')).toBe(true);

    store.toggleTrackLock('layer_0');
    expect(store.isTrackLocked('layer_0')).toBe(true);

    // 再次點擊解鎖
    store.toggleTrackLock('main');
    expect(store.isTrackLocked('main')).toBe(false);
  });

  it('5. 情境式 Inspector：選中 Cue 時應隱藏主軌施法動作與受擊衝擊卡片', () => {
    const slashCard = new MockElement();
    const salvoCard = new MockElement();
    const spikeCard = new MockElement();
    const casterCard = new MockElement();
    const impactCard = new MockElement();
    const cueCard = new MockElement('card-cue-inspector');

    (globalThis as any).document = {
      getElementById: (id: string) => {
        if (id === 'card-cue-inspector') return cueCard;
        return new MockElement(id);
      },
      querySelector: (sel: string) => {
        if (sel === '.card-slash-section') return slashCard;
        if (sel === '.card-salvo-section') return salvoCard;
        if (sel === '.card-spike-section') return spikeCard;
        if (sel === '.card-caster-motion') return casterCard;
        if (sel === '.card-impact-section') return impactCard;
        return null;
      },
      querySelectorAll: () => []
    };

    const leftSidebar = new MockElement() as any;
    const rightSidebar = new MockElement() as any;
    const inspector = new VFXInspector(leftSidebar, rightSidebar);

    // 模擬選中 Cue 0
    inspector.setContextualTarget({ type: 'CUE', index: 0 });
    expect(casterCard.style.display).toBe('none');
    expect(impactCard.style.display).toBe('none');

    // 模擬取消選取，切換回主軌
    inspector.setContextualTarget({ type: 'MAIN' });
    expect(casterCard.style.display).toBe('block');
    expect(impactCard.style.display).toBe('block');
  });
});
