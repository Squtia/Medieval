import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CombatEventType, CombatEvent, StatusEffectType } from '../../models/Combat';
import { CombatAction, resolveActionMainTargetId } from '../../ui/fx/CombatActionPlayer';
import { CombatStageAdapter } from '../../ui/fx/adapters/CombatStageAdapter';

class MockElement {
  public id: string = '';
  public className: string = '';
  public style: any = {
    setProperty: () => {},
    getPropertyValue: () => ''
  };
  public classList: {
    contains: (c: string) => boolean;
    add: (c: string) => void;
    remove: (c: string) => void;
  };
  public children: MockElement[] = [];
  public parentNode: MockElement | null = null;
  public clientWidth: number = 1000;
  public clientHeight: number = 600;
  public rect: any = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };

  constructor(id: string = '', className: string = '') {
    this.id = id;
    this.className = className;
    const classes = new Set<string>(className ? className.split(' ') : []);
    this.classList = {
      contains: (c: string) => classes.has(c),
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c)
    };
  }

  public appendChild(child: MockElement): void {
    child.parentNode = this;
    this.children.push(child);
  }

  public querySelector(selector: string): MockElement | null {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.children.find(c => c.id === id) || null;
    }
    return null;
  }

  public querySelectorAll(selector: string): MockElement[] {
    return [];
  }

  public getBoundingClientRect() {
    return this.rect;
  }
}

describe('⚔️ CombatTargetResolution - 戰鬥行動受術目標嚴格隔離測試', () => {
  let modal: MockElement;

  beforeEach(() => {
    modal = new MockElement('combat-modal');
    modal.rect = { left: 0, right: 1000, top: 0, bottom: 600, width: 1000, height: 600 };

    // 玩家施法者卡牌 (左側 x=200, y=300)
    const playerCard = new MockElement('combat-p-hero_1', 'combat-card player-side');
    playerCard.rect = { left: 150, right: 250, top: 250, bottom: 350, width: 100, height: 100 };
    modal.appendChild(playerCard);

    // 隊友卡牌 (左下方 x=200, y=450)
    const allyCard = new MockElement('combat-p-ally_tank', 'combat-card player-side');
    allyCard.rect = { left: 150, right: 250, top: 400, bottom: 500, width: 100, height: 100 };
    modal.appendChild(allyCard);

    // 敵方目標卡牌 (右側 x=800, y=300)
    const enemyCard = new MockElement('combat-p-boss_goblin', 'combat-card enemy-side');
    enemyCard.rect = { left: 750, right: 850, top: 250, bottom: 350, width: 100, height: 100 };
    modal.appendChild(enemyCard);

    CombatStageAdapter.getInstance().mount(modal as any);
  });

  afterEach(() => {
    CombatStageAdapter.getInstance().clear();
    CombatStageAdapter.getInstance().destroy();
  });

  it('1. 單體攻擊技能：SKILL_CAST 保留自身 targetId 扣 MP，目標必須解析為敵方 boss_goblin', () => {
    const action: CombatAction = {
      actionId: 'act_heavy_strike_001',
      actorId: 'hero_1',
      skillId: 'heavy_strike',
      vfxId: 'VFX_HEAVY_STRIKE',
      events: [
        {
          type: CombatEventType.SKILL_CAST,
          actionId: 'act_heavy_strike_001',
          actorId: 'hero_1',
          targetId: 'hero_1', // ⚠️ 扣自身 MP
          skillTargetId: 'boss_goblin', // 真正受擊目標
          targetMp: 80,
          targetMaxMp: 100,
          text: '施法者施放奮力一擊'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_heavy_strike_001',
          actorId: 'hero_1',
          targetId: 'boss_goblin',
          damage: 150,
          targetHp: 350,
          targetMaxHp: 500,
          text: '對哥布林造成 150 點傷害'
        }
      ]
    };

    const targetId = resolveActionMainTargetId(action);
    expect(targetId).toBe('boss_goblin');
    expect(targetId).not.toBe('hero_1');
  });

  it('2. 群體 AOE 攻擊技能：多個 HIT 事件中，主目標必須為敵方，絕不得誤指施法者自身', () => {
    const action: CombatAction = {
      actionId: 'act_whirlwind_002',
      actorId: 'hero_1',
      skillId: 'whirlwind',
      vfxId: 'VFX_WHIRLWIND_SLASH',
      events: [
        {
          type: CombatEventType.SKILL_CAST,
          actionId: 'act_whirlwind_002',
          actorId: 'hero_1',
          targetId: 'hero_1', // 扣自身 MP
          skillTargetId: 'boss_goblin',
          text: '施放旋風斬'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_whirlwind_002',
          actorId: 'hero_1',
          targetId: 'boss_goblin',
          damage: 90,
          text: '第一目標受創'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_whirlwind_002',
          actorId: 'hero_1',
          targetId: 'goblin_minion_2',
          damage: 75,
          text: '第二目標受創'
        }
      ]
    };

    const targetId = resolveActionMainTargetId(action);
    expect(targetId).toBe('boss_goblin');
  });

  it('3. 友軍治療技能：受術目標必須解析為受治療之隊友 ally_tank', () => {
    const action: CombatAction = {
      actionId: 'act_heal_003',
      actorId: 'hero_1',
      skillId: 'holy_light',
      vfxId: 'VFX_HOLY_LIGHT',
      events: [
        {
          type: CombatEventType.SKILL_CAST,
          actionId: 'act_heal_003',
          actorId: 'hero_1',
          targetId: 'hero_1', // 扣自身 MP
          skillTargetId: 'ally_tank',
          text: '施放聖光治療'
        },
        {
          type: CombatEventType.HEAL,
          actionId: 'act_heal_003',
          actorId: 'hero_1',
          targetId: 'ally_tank',
          damage: -80,
          targetHp: 280,
          targetMaxHp: 300,
          text: '治療坦克 80 點'
        }
      ]
    };

    const targetId = resolveActionMainTargetId(action);
    expect(targetId).toBe('ally_tank');
  });

  it('4. 自身增益技能：純自身增益時，目標才正確為 hero_1 自身', () => {
    const action: CombatAction = {
      actionId: 'act_taunt_004',
      actorId: 'hero_1',
      skillId: 'taunt',
      vfxId: 'VFX_SELF_BUFF',
      events: [
        {
          type: CombatEventType.SKILL_CAST,
          actionId: 'act_taunt_004',
          actorId: 'hero_1',
          targetId: 'hero_1',
          skillTargetId: 'hero_1',
          text: '施放嘲諷'
        },
        {
          type: CombatEventType.STATUS_APPLY,
          actionId: 'act_taunt_004',
          actorId: 'hero_1',
          targetId: 'hero_1',
          statusType: StatusEffectType.TAUNT,
          text: '自身獲得嘲諷狀態'
        }
      ]
    };

    const targetId = resolveActionMainTargetId(action);
    expect(targetId).toBe('hero_1');
  });

  it('5. CombatStageAdapter 播放時，3D 起點與終點座標絕對不同 (起點在玩家側，終點在敵方側)', async () => {
    const adapter = CombatStageAdapter.getInstance();
    const action: CombatAction = {
      actionId: 'act_fireball_005',
      actorId: 'hero_1',
      skillId: 'fireball',
      vfxId: 'VFX_DEFAULT_SLASH',
      events: [
        {
          type: CombatEventType.SKILL_CAST,
          actionId: 'act_fireball_005',
          actorId: 'hero_1',
          targetId: 'hero_1', // 扣 MP
          skillTargetId: 'boss_goblin',
          text: '施放火球'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_fireball_005',
          actorId: 'hero_1',
          targetId: 'boss_goblin',
          damage: 100,
          text: '命中 100'
        }
      ]
    };

    const fromPt = adapter.getUnitPoint('hero_1', 'player');
    const toPt = adapter.getUnitPoint('boss_goblin', 'enemy');

    // 驗證起點在左側 (x = 200)，終點在右側 (x = 800)
    expect(fromPt.x).toBeLessThan(400);
    expect(toPt.x).toBeGreaterThan(600);
    expect(fromPt.x).not.toBe(toPt.x);

    let impacted = false;
    await adapter.playCombatAction(action, {
      skipVfx: true,
      onImpact: (item) => {
        impacted = true;
        // 驗證打擊項目的目標 ID 100% 歸屬於 boss_goblin
        expect(item.targetId).toBe('boss_goblin');
      }
    });

    expect(impacted).toBe(true);
  });
});
