import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatEvent, CombatEventType } from '../../models/Combat';
import { mapImpactsToCues, CombatActionPlayer, CombatAction, collectCombatActions, isCombatAction } from '../../ui/fx/CombatActionPlayer';
import { SkillVfxBindingRegistry } from './SkillVfxBindingRegistry';
import { VFXImpactCue, VFXPreset } from '../../models/VFX';
import { CombatUIManager } from '../../ui/CombatUIManager';

/**
 * 🚨 Phase 0：固定現有缺陷測試案例 (Pin Down Existing Defects)
 * 依據 docs/VFX_STUDIO_GEMINI_REFACTOR_IMPLEMENTATION.md Phase 0 規範：
 * 為重複跳字、binding mode 失效、targetPolicy 失效、SHIELD_BREAK 缺失建立會失敗的測試。
 * 完成條件：新測試在舊程式上明確失敗，且能指出錯誤結果。
 */
if (typeof globalThis.localStorage === 'undefined') {
  let store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    length: 0,
    key: (i: number) => Object.keys(store)[i] || null
  } as any;
}

describe('Phase 0: VFX 管線現有已知缺陷測試 (Pin Down Failure Cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.localStorage.clear();
    (SkillVfxBindingRegistry as any).instance = undefined;
  });

  // ─────────────────────────────────────────────────────────────
  // 缺陷 1：Cue targetPolicy 在多目標 AOE 與 CASTER 時未實際執行
  // ─────────────────────────────────────────────────────────────
  describe('缺陷 1: mapImpactsToCues 之 targetPolicy 未真實執行', () => {
    it('PRIMARY_TARGET 應只在主目標生效，不得在所有 AOE 目標重複生成', () => {
      const aoeEvents: CombatEvent[] = [
        {
          type: CombatEventType.HIT,
          actionId: 'act_aoe',
          actorId: 'player_1',
          targetId: 'enemy_main',
          damage: 100,
          text: '主目標受擊'
        },
        {
          type: CombatEventType.HIT,
          actionId: 'act_aoe',
          actorId: 'player_1',
          targetId: 'enemy_sub',
          damage: 100,
          text: '副目標受擊'
        }
      ];

      const cues: VFXImpactCue[] = [
        {
          cueId: 'CUE_PRIMARY_BURST',
          time: 0.2,
          kind: 'IMPACT',
          isPrimary: true,
          targetPolicy: 'PRIMARY_TARGET'
        }
      ];

      // 依規格 3.2：PRIMARY_TARGET 不得複製到所有目標，若未給 primaryTargetId 預設取第一個目標
      const presentations = mapImpactsToCues(aoeEvents, cues, 'EXACT_IMPACTS');

      // 預期：只應有 1 筆呈現給 enemy_main
      const primaryItems = presentations.filter(p => p.cueId === 'CUE_PRIMARY_BURST');
      expect(primaryItems.length).toBe(1);
      expect(primaryItems[0].targetId).toBe('enemy_main');
    });

    it('CASTER 應指向施法者 actorId，且不得直接挪用敵方目標傷害', () => {
      const events: CombatEvent[] = [
        {
          type: CombatEventType.HIT,
          actionId: 'act_buff_strike',
          actorId: 'hero_paladin',
          targetId: 'boss_dragon',
          damage: 500,
          text: '命中惡龍'
        }
      ];

      const cues: VFXImpactCue[] = [
        {
          cueId: 'CUE_CASTER_AURA',
          time: 0.1,
          kind: 'IMPACT',
          targetPolicy: 'CASTER'
        }
      ];

      const presentations = mapImpactsToCues(events, cues, 'EXACT_IMPACTS');

      const casterItems = presentations.filter(p => p.cueId === 'CUE_CASTER_AURA');
      expect(casterItems.length).toBe(1);
      // 依規格 3.2：CASTER 指向 actorId
      expect(casterItems[0].targetId).toBe('hero_paladin');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 缺陷 2：技能綁定的演出模式未進入正式播放管線
  // ─────────────────────────────────────────────────────────────
  describe('缺陷 2: 技能綁定之 impactPresentationMode 未進入正式播放管線', () => {
    it('CombatAction 帶有 presentationMode 或來自 SkillVfxBinding 時，應優先於 Preset 預設', async () => {
      const registry = SkillVfxBindingRegistry.getInstance();
      // 技能綁定中心為 MAGIC_SWORDSMAN_PHANTOM 設定了 SPLIT_SINGLE_IMPACT (Preset 預設為 EXACT_IMPACTS，具備 3 個 cues)
      registry.setSkillBinding('MAGIC_SWORDSMAN_PHANTOM', 'VFX_PHANTOM_SLASH', 'SPLIT_SINGLE_IMPACT');

      // 建立包含單一 300 傷害的 action
      const action: CombatAction = {
        actionId: 'act_phantom',
        actorId: 'player',
        skillId: 'MAGIC_SWORDSMAN_PHANTOM',
        vfxId: 'VFX_PHANTOM_SLASH',
        presentationMode: 'SPLIT_SINGLE_IMPACT', // 依規格 2.1 應支援此欄位並權威生效
        events: [
          {
            type: CombatEventType.HIT,
            actionId: 'act_phantom',
            actorId: 'player',
            targetId: 'enemy',
            damage: 300,
            text: '幻影斬擊'
          }
        ]
      };

      const capturedPresentations: any[] = [];
      const player = new CombatActionPlayer();

      await player.playAction(action, {
        fromPoint: { x: 0, y: 0 },
        toPoint: { x: 100, y: 100 },
        skipVfx: true,
        onPresentImpact: (item) => capturedPresentations.push(item)
      });

      // 依規格 1.1 & 2.1：技能綁定的 SPLIT_SINGLE_IMPACT 必須權威生效，
      // 因而 300 傷害應被拆分為 2 段以上呈現。
      // 但在舊版中，playAction() 只讀 preset.impactPresentationMode ('EXACT_IMPACTS')，
      // 因而只呈現 1 段 300 傷害，測試明確失敗。
      expect(capturedPresentations.length).toBeGreaterThan(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 缺陷 3：SHIELD_BREAK 未成為正式 Impact
  // ─────────────────────────────────────────────────────────────
  describe('缺陷 3: SHIELD_BREAK 未納入 mapImpactsToCues 與正式 Impact 結算', () => {
    it('mapImpactsToCues 應將 SHIELD_BREAK 視為正式 Impact，並標記 kind 為 SHIELD_BREAK', () => {
      const shieldBreakEvents: CombatEvent[] = [
        {
          type: CombatEventType.SHIELD_BREAK,
          actionId: 'act_shield_break',
          actorId: 'attacker',
          targetId: 'defender_shield',
          damage: 150,
          text: '護盾崩解！'
        }
      ];

      const cues: VFXImpactCue[] = [
        { cueId: 'CUE_SHIELD_FX', time: 0.2, kind: 'SHIELD', isPrimary: true }
      ];

      const presentations = mapImpactsToCues(shieldBreakEvents, cues, 'EXACT_IMPACTS');

      // 依規格 1.5 & 2.3：SHIELD_BREAK 必須為正式 impact，不得被 filter 忽略
      expect(presentations.length).toBe(1);
      expect(presentations[0].kind).toBe('SHIELD_BREAK');
      expect(presentations[0].targetId).toBe('defender_shield');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 缺陷 4：主遊戲重複跳字呈現路徑 (Phase 2 修復驗收)
  // ─────────────────────────────────────────────────────────────
  describe('缺陷 4: 主遊戲結算路徑不應重複觸發浮動跳字', () => {
    it('collectCombatActions 應將同 actionId 事件純函式預先分組，且 DEATH 事件保留為獨立事件', () => {
      const rawEvents: CombatEvent[] = [
        { type: CombatEventType.SKILL_CAST, actionId: 'act_1', actorId: 'mage', targetId: 'mage', text: '施法' },
        { type: CombatEventType.HIT, actionId: 'act_1', actorId: 'mage', targetId: 'golem', damage: 100, text: '第一段' },
        { type: CombatEventType.HIT, actionId: 'act_1', actorId: 'mage', targetId: 'golem', damage: 150, text: '第二段' },
        { type: CombatEventType.DEATH, targetId: 'golem', text: '魔像倒下' }
      ];

      const items = collectCombatActions(rawEvents);
      expect(items.length).toBe(2);

      // 第一個項目是 CombatAction
      expect(isCombatAction(items[0])).toBe(true);
      if (isCombatAction(items[0])) {
        expect(items[0].actionId).toBe('act_1');
        expect(items[0].events.length).toBe(3);
      }

      // 第二個項目是獨立 DEATH 事件
      expect(isCombatAction(items[1])).toBe(false);
      expect((items[1] as CombatEvent).type).toBe(CombatEventType.DEATH);

      // 驗證原事件物件未被寫入 absorbedBySkillCast 暫態污染
      rawEvents.forEach(ev => {
        expect((ev as any).absorbedBySkillCast).toBeUndefined();
      });
    });

    it('CombatUIManager.reconcileFinalActionState 應為純狀態校準，絕不建立 floating-dmg DOM', () => {
      // 設置 Node 相容之 DOM 節點
      class SimpleMockElement {
        id: string;
        textContent: string = '';
        className: string = '';
        children: SimpleMockElement[] = [];
        classList = {
          add: vi.fn(),
          remove: vi.fn(),
          contains: () => false
        };
        style: Record<string, string> = {};

        constructor(id: string) {
          this.id = id;
        }
        appendChild(child: SimpleMockElement) {
          this.children.push(child);
          return child;
        }
        querySelectorAll(selector: string) {
          if (selector === '.floating-dmg') {
            return this.children.filter(c => c.className.includes('floating-dmg'));
          }
          return [];
        }
        remove() {}
      }

      const targetCard = new SimpleMockElement('combat-p-golem');
      const hpFill = new SimpleMockElement('hp-fill-golem');
      const hpTxt = new SimpleMockElement('hp-txt-golem');
      targetCard.appendChild(hpFill);
      targetCard.appendChild(hpTxt);

      const oldDoc = (globalThis as any).document;
      (globalThis as any).document = {
        createElement: (tag: string) => {
          const el = new SimpleMockElement('');
          el.className = tag;
          return el;
        },
        getElementById: (id: string) => {
          if (id === 'combat-p-golem') return targetCard;
          if (id === 'hp-fill-golem') return hpFill;
          if (id === 'hp-txt-golem') return hpTxt;
          return null;
        }
      };

      try {
        const hitEvent: CombatEvent = {
          type: CombatEventType.HIT,
          actionId: 'act_single_hit',
          actorId: 'hero',
          targetId: 'golem',
          damage: 100,
          targetHp: 200,
          targetMaxHp: 300,
          text: '斬擊'
        };

        // 執行終態校準
        CombatUIManager.reconcileFinalActionState([hitEvent]);

        // 驗證 HP 數值已正確校準
        expect(hpTxt.textContent).toBe('200/300');

        // 驗證絕未生成 floating-dmg 跳字 DOM (重複跳字徹底根除)
        const floatingEls = targetCard.querySelectorAll('.floating-dmg');
        expect(floatingEls.length).toBe(0);
      } finally {
        (globalThis as any).document = oldDoc;
      }
    });

    it('§7 & §8.3: 快速結束或 Skip 時 CombatActionPlayer.clearDebugOverlay 應立即清除 FALLBACK 殘留', () => {
      const mockEl = {
        innerHTML: '<span style="color:#ef4444;font-weight:bold;">⚠️ FALLBACK</span>',
        style: { display: 'block' }
      };
      const oldDoc = (globalThis as any).document;
      (globalThis as any).document = {
        getElementById: (id: string) => (id === 'vfx-debug-overlay' ? mockEl : null)
      };

      try {
        expect(mockEl.innerHTML).toContain('FALLBACK');
        CombatActionPlayer.clearDebugOverlay(true);
        expect(mockEl.innerHTML).toContain('IDLE');
        expect(mockEl.innerHTML).not.toContain('FALLBACK');
      } finally {
        (globalThis as any).document = oldDoc;
      }
    });

    it('§7: CombatStudio 與主遊戲使用相同 collectCombatActions 聚合結構', () => {
      const studioEvents: CombatEvent[] = [
        { type: CombatEventType.TURN_START, text: '第 1 回合' },
        { type: CombatEventType.SKILL_CAST, actionId: 'act_studio_1', actorId: 'adv_1', skillId: 'FIGHTER_SLASH', text: '發動斬擊' },
        { type: CombatEventType.HIT, actionId: 'act_studio_1', actorId: 'adv_1', targetId: 'enemy_1', damage: 60, text: '斬擊命中' },
        { type: CombatEventType.TURN_END, text: '回合結束' }
      ];

      const collected = collectCombatActions(studioEvents);
      expect(collected.length).toBe(3);
      expect(isCombatAction(collected[0])).toBe(false); // TURN_START
      expect(isCombatAction(collected[1])).toBe(true);  // CombatAction (聚合 SKILL_CAST + HIT)
      expect(isCombatAction(collected[2])).toBe(false); // TURN_END

      if (isCombatAction(collected[1])) {
        expect(collected[1].actionId).toBe('act_studio_1');
        expect(collected[1].events.length).toBe(2);
      }
    });
  });
});
