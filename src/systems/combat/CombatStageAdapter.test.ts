import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatStageAdapter } from '../../ui/fx/adapters/CombatStageAdapter';
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

describe('⚔️ CombatStageAdapter (主遊戲實戰模態框同源適配器驗證)', () => {
  let modal: MockElement;
  let originalDocument: any;

  beforeEach(() => {
    modal = new MockElement('combat-modal', 'active');
    const pCard = new MockElement('combat-p-p1', 'combat-card player-side');
    const eCard = new MockElement('combat-p-enemy_1', 'combat-card enemy-side');
    modal.appendChild(pCard);
    modal.appendChild(eCard);

    originalDocument = (globalThis as any).document;
    (globalThis as any).document = {
      createElement: (tag: string) => new MockElement('', tag),
      getElementById: (id: string) => {
        if (id === 'combat-p-p1') return pCard;
        if (id === 'combat-p-enemy_1') return eCard;
        return null;
      }
    };
  });

  afterEach(() => {
    CombatStageAdapter.getInstance().clear();
    (globalThis as any).document = originalDocument;
    vi.restoreAllMocks();
  });

  it('1. 應維持單例模式並成功掛載到戰鬥模態框', () => {
    const a1 = CombatStageAdapter.getInstance();
    const a2 = CombatStageAdapter.getInstance();
    expect(a1).toBe(a2);

    a1.mount(modal as any);
    expect(a1.isVfxEnabled()).toBe(true);
  });

  it('2. 應能精準查找主遊戲角色卡牌 (combat-p-前綴與清除前綴)', () => {
    const adapter = CombatStageAdapter.getInstance();
    adapter.mount(modal as any);

    const pCard = adapter.findCardElement('p1');
    const pCardAdv = adapter.findCardElement('adv_123_p1');
    const eCard = adapter.findCardElement('enemy_1');

    expect(pCard).not.toBeNull();
    expect(pCardAdv).toBe(pCard);
    expect(eCard).not.toBeNull();
  });

  it('3. 應能計算卡牌中心點相對座標', () => {
    const adapter = CombatStageAdapter.getInstance();
    adapter.mount(modal as any);

    const pt = adapter.getUnitPoint('p1', 'player');
    expect(pt.x).toBeGreaterThanOrEqual(0);
    expect(pt.y).toBeGreaterThanOrEqual(0);
  });

  it('4. triggerHitFeedback 應正確產生受擊震動與浮動跳字', () => {
    const adapter = CombatStageAdapter.getInstance();
    adapter.mount(modal as any);

    const targetEl = adapter.findCardElement('enemy_1')!;
    const ev: CombatEvent = {
      type: CombatEventType.HIT,
      targetId: 'enemy_1',
      damage: 150,
      text: '普通打擊 150'
    };

    adapter.triggerHitFeedback(targetEl, ev, null, 0, 1);
    expect(modal.querySelectorAll('.floating-dmg').length).toBeGreaterThan(0);
  });

  it('5. playCombatAction 應以 CombatAction 為單位調度多段打擊呈現', async () => {
    const adapter = CombatStageAdapter.getInstance();
    adapter.mount(modal as any);

    const action = {
      actionId: 'act_main_combo',
      actorId: 'p1',
      skillId: 'blade_dance',
      vfxId: 'VFX_DEFAULT_SLASH',
      events: [
        {
          type: CombatEventType.SKILL_CAST,
          actionId: 'act_main_combo',
          actorId: 'p1',
          targetId: 'enemy_1',
          impactIndex: 0,
          impactCount: 2,
          text: '施放劍舞'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_main_combo',
          actorId: 'p1',
          targetId: 'enemy_1',
          damage: 50,
          impactIndex: 0,
          impactCount: 2,
          text: '第一段 50'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_main_combo',
          actorId: 'p1',
          targetId: 'enemy_1',
          damage: 75,
          impactIndex: 1,
          impactCount: 2,
          text: '第二段 75'
        }
      ]
    };

    const impacts: number[] = [];
    let done = false;

    await adapter.playCombatAction(action, {
      skipVfx: true,
      onImpact: (item) => {
        impacts.push(item.amount);
      },
      onComplete: () => {
        done = true;
      }
    });

    expect(done).toBe(true);
    expect(impacts.reduce((a, b) => a + b, 0)).toBe(125);
  });
});
