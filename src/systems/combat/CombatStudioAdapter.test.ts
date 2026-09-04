import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatStudioStageAdapter } from '../../ui/fx/adapters/CombatStudioStageAdapter';
import { CombatEvent, CombatEventType } from '../../models/Combat';

// 建立輕量 Node 相容 DOM Mock
class MockElement {
  public id: string = '';
  private _className: string = '';
  private _classes = new Set<string>();

  public get className(): string {
    return this._className;
  }
  public set className(val: string) {
    this._className = val || '';
    this._classes = new Set(this._className.split(' ').filter(Boolean));
  }

  public style: Record<string, string> & {
    setProperty: (k: string, v: string) => void;
    getPropertyValue: (k: string) => string;
  };
  public classList: {
    contains: (c: string) => boolean;
    add: (c: string) => void;
    remove: (c: string) => void;
  };
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public textContent: string = '';
  public clientWidth: number = 800;
  public clientHeight: number = 450;

  constructor(id: string = '', className: string = '') {
    this.id = id;
    this.className = className;
    const styles: Record<string, string> = {};
    this.style = Object.assign(styles, {
      setProperty: (k: string, v: string) => { styles[k] = v; },
      getPropertyValue: (k: string) => styles[k] || ''
    });

    this.classList = {
      contains: (c: string) => this._classes.has(c),
      add: (c: string) => {
        this._classes.add(c);
        this._className = Array.from(this._classes).join(' ');
      },
      remove: (c: string) => {
        this._classes.delete(c);
        this._className = Array.from(this._classes).join(' ');
      }
    };
  }

  public appendChild(child: MockElement): void {
    child.parentNode = this;
    this.children.push(child);
  }

  public remove(): void {
    if (this.parentNode) {
      const idx = this.parentNode.children.indexOf(this);
      if (idx !== -1) this.parentNode.children.splice(idx, 1);
      this.parentNode = null;
    }
  }

  public getBoundingClientRect() {
    return {
      left: 100,
      top: 50,
      width: 120,
      height: 80,
      right: 220,
      bottom: 130
    };
  }

  public querySelector(selector: string): MockElement | null {
    const list = this.querySelectorAll(selector);
    return list.length > 0 ? list[0] : null;
  }

  public querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const traverse = (node: MockElement) => {
      for (const ch of (node.children || [])) {
        if (!ch) continue;
        if (selector.startsWith('#')) {
          if (ch.id === selector.slice(1)) results.push(ch);
        } else if (selector.startsWith('.')) {
          const cls = selector.slice(1);
          if (ch.classList && typeof ch.classList.contains === 'function' && ch.classList.contains(cls)) {
            results.push(ch);
          }
        } else if (selector.includes('id*=')) {
          const match = selector.match(/id\*="([^"]+)"/);
          if (match && ch.id && ch.id.includes(match[1])) results.push(ch);
        }
        if (ch.children) traverse(ch);
      }
    };
    traverse(this);
    return results;
  }
}

describe('⚔️ CombatStudioStageAdapter (Phase 6 戰鬥演播室同源適配器驗證)', () => {
  let container: MockElement;
  let originalDocument: any;

  beforeEach(() => {
    container = new MockElement('cs-visual-view', 'cs-arena');
    const pCard = new MockElement('arena_p1', 'cs-arena-card player-side');
    const eCard = new MockElement('arena_enemy_1_0', 'cs-arena-card enemy-side');
    container.appendChild(pCard);
    container.appendChild(eCard);

    originalDocument = (globalThis as any).document;
    (globalThis as any).document = {
      createElement: (tag: string) => new MockElement('', tag),
      getElementById: (id: string) => {
        if (id === 'arena_p1') return pCard;
        if (id === 'arena_enemy_1_0') return eCard;
        return null;
      }
    };
  });

  afterEach(() => {
    CombatStudioStageAdapter.getInstance().clear();
    (globalThis as any).document = originalDocument;
    vi.restoreAllMocks();
  });

  it('1. 應維持單例模式並成功掛載到戰鬥擂台容器', () => {
    const adapter1 = CombatStudioStageAdapter.getInstance();
    const adapter2 = CombatStudioStageAdapter.getInstance();
    expect(adapter1).toBe(adapter2);

    adapter1.mount(container as any);
    expect(container.style.position).toBe('relative');
  });

  it('2. 應能精確定位卡牌元素並計算相對中心點座標', () => {
    const adapter = CombatStudioStageAdapter.getInstance();
    adapter.mount(container as any);

    const pCard = adapter.findCardElement('p1');
    const pCardAdv = adapter.findCardElement('adv_100_p1');
    const eCard = adapter.findCardElement('enemy_1_0');

    expect(pCard).not.toBeNull();
    expect(pCardAdv).toBe(pCard);
    expect(eCard).not.toBeNull();

    const pPt = adapter.getUnitPoint('p1', 'player');
    const ePt = adapter.getUnitPoint('enemy_1_0', 'enemy');

    expect(pPt).toBeDefined();
    expect(typeof pPt.x).toBe('number');
    expect(typeof pPt.y).toBe('number');
    expect(ePt).toBeDefined();
  });

  it('3. 特效開關切換與速度控制應正常生效', () => {
    const adapter = CombatStudioStageAdapter.getInstance();
    adapter.setVfxEnabled(true);
    expect(adapter.isVfxEnabled()).toBe(true);

    adapter.setVfxEnabled(false);
    expect(adapter.isVfxEnabled()).toBe(false);

    adapter.setSpeed(2);
    adapter.setVfxEnabled(true);
  });

  it('4. 受擊反饋 triggerHitFeedback 應正確注入 CSS 變數與生成跳字', () => {
    const adapter = CombatStudioStageAdapter.getInstance();
    adapter.mount(container as any);
    const targetEl = adapter.findCardElement('enemy_1_0')!;

    const ev: CombatEvent = {
      type: CombatEventType.CRIT,
      actorId: 'p1',
      targetId: 'enemy_1_0',
      damage: 350,
      text: '暴擊傷害 350！'
    };

    adapter.triggerHitFeedback(targetEl, ev, {
      shakeIntensity: 18,
      shakeDuration: 0.3,
      targetPunchScale: 0.85,
      hitFlashColor: '#f59e0b',
      knockbackDistance: 15
    } as any, 0, 1);

    expect(targetEl.classList.contains('target-hit')).toBe(true);
    expect(targetEl.style.getPropertyValue('--shake-dur')).toBe('0.3s');
    expect(targetEl.style.getPropertyValue('--flash-color')).toBe('#f59e0b');

    const floatingEl = targetEl.querySelector('.floating-dmg');
    expect(floatingEl).not.toBeNull();
    expect(floatingEl?.textContent).toContain('350');
  });

  it('5. 支援治療事件與 MISS 事件的專屬跳字顏色與符號', () => {
    const adapter = CombatStudioStageAdapter.getInstance();
    adapter.mount(container as any);
    const pCard = adapter.findCardElement('p1')!;

    const healEv: CombatEvent = {
      type: CombatEventType.HEAL,
      targetId: 'p1',
      damage: 120,
      text: '生命恢復 120'
    };
    adapter.triggerHitFeedback(pCard, healEv, null, 0, 1);
    const healFloating = pCard.querySelector('.floating-dmg');
    expect(healFloating?.textContent).toContain('💚 +120');

    const missEv: CombatEvent = {
      type: CombatEventType.MISS,
      targetId: 'p1',
      text: '閃避！'
    };
    adapter.triggerHitFeedback(pCard, missEv, null, 0, 1);
    const missFloating = pCard.querySelectorAll('.floating-dmg');
    expect(Array.from(missFloating).some((el: any) => el.textContent === 'MISS')).toBe(true);
  });

  it('6. clear() 應 100% 清除所有動態跳字與受擊 class，達到零殘留', () => {
    const adapter = CombatStudioStageAdapter.getInstance();
    adapter.mount(container as any);
    const targetEl = adapter.findCardElement('enemy_1_0')!;

    const ev: CombatEvent = {
      type: CombatEventType.HIT,
      targetId: 'enemy_1_0',
      damage: 80,
      text: '普通打擊'
    };
    adapter.triggerHitFeedback(targetEl, ev, null, 0, 1);

    expect(container.querySelectorAll('.floating-dmg').length).toBeGreaterThan(0);

    adapter.clear();

    expect(container.querySelectorAll('.floating-dmg').length).toBe(0);
    expect(targetEl.classList.contains('target-hit')).toBe(false);
  });

  it('7. playEventAction 在 skipVfx 模式下應立即解析並觸發數值跳字，不阻塞迴圈', async () => {
    const adapter = CombatStudioStageAdapter.getInstance();
    adapter.mount(container as any);

    const ev: CombatEvent = {
      type: CombatEventType.HIT,
      actorId: 'p1',
      targetId: 'enemy_1_0',
      damage: 95,
      vfxId: 'VFX_EARTH_SPIKE',
      text: '地裂穿刺 95 點傷害'
    };

    let impacted = false;
    await adapter.playEventAction(ev, {
      skipVfx: true,
      onImpact: () => {
        impacted = true;
      }
    });

    expect(impacted).toBe(true);
    const targetEl = adapter.findCardElement('enemy_1_0')!;
    expect(targetEl.querySelector('.floating-dmg')).not.toBeNull();
  });
});
