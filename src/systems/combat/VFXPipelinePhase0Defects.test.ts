import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatEvent, CombatEventType } from '../../models/Combat';
import { mapImpactsToCues, CombatActionPlayer, CombatAction, collectCombatActions, isCombatAction } from '../../ui/fx/CombatActionPlayer';
import { SkillVfxBindingRegistry } from './SkillVfxBindingRegistry';
import { VFXImpactCue, VFXSequence } from '../../models/VFX';
import { VFXPresetRepository } from '../../ui/fx/VFXPresetRepository';
import { CombatUIManager } from '../../ui/CombatUIManager';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';

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
  describe('缺陷 1: mapImpactsToCues 之 targetPolicy 未真實執行與目標分離 (規格 §5)', () => {
    it('PRIMARY_TARGET 應只將 3D visualTarget 設為主目標，但副目標之真實傷害 presentation 必須完整保留且傷害守恆', () => {
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

      // 依規格 §5：PRIMARY_TARGET 只限制 3D 視覺位置，但 logical presentations 同時包含 enemy_main 與 enemy_sub
      const presentations = mapImpactsToCues(aoeEvents, cues, 'EXACT_IMPACTS');

      // 1. 邏輯呈現必須同時包含主目標與副目標
      const mainItems = presentations.filter(p => p.targetId === 'enemy_main' && p.kind === 'DAMAGE');
      const subItems = presentations.filter(p => p.targetId === 'enemy_sub' && p.kind === 'DAMAGE');
      expect(mainItems.length).toBe(1);
      expect(subItems.length).toBe(1);

      // 2. 3D 特效播放位置 (visualTargetId) 應指向 enemy_main
      expect(mainItems[0].visualTargetId ?? mainItems[0].targetId).toBe('enemy_main');
      expect(subItems[0].visualTargetId).toBe('enemy_main');

      // 3. 傷害總值守恆：100 + 100 === 200
      const totalPresentationDmg = presentations
        .filter(p => p.kind === 'DAMAGE')
        .reduce((sum, p) => sum + p.amount, 0);
      expect(totalPresentationDmg).toBe(200);
    });

    it('CASTER 應將 3D 特效指向施法者 actorId，但敵方目標之真實傷害仍在原 target 呈現且不被挪用', () => {
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

      // 敵方目標真實 damage 仍歸 boss_dragon
      const enemyDmgItems = presentations.filter(p => p.targetId === 'boss_dragon' && p.kind === 'DAMAGE');
      expect(enemyDmgItems.length).toBe(1);
      expect(enemyDmgItems[0].amount).toBe(500);

      // 3D 視覺位置應指向施法者 hero_paladin
      expect(enemyDmgItems[0].visualTargetId).toBe('hero_paladin');
    });

    it('EACH_TARGET 的 visualTargetId 必須由 Player 傳給 Engine Cue 世界座標 resolver', async () => {
      const baseSequence = VFXPresetRepository.getInstance().getSequence('VFX_DEFAULT_SLASH')!;
      const sequence: VFXSequence = {
        ...baseSequence,
        id: 'VFX_EACH_TARGET_TEST',
        impactCues: [{ cueId: 'CUE_EACH', time: 0.1, kind: 'IMPACT', targetPolicy: 'EACH_TARGET' }]
      };
      let resolvedPoints: readonly { x: number; y: number }[] = [];
      const playSequence = vi.fn(async (...args: Parameters<CombatFXEngine['playSequence']>) => {
        const [runtimeSequence, , , callback, , resolveCuePoints] = args;
        const cue = runtimeSequence.impactCues[0];
        resolvedPoints = resolveCuePoints?.(cue, 0) || [];
        if (typeof callback === 'function') callback({} as any, 0, 1, cue);
      });
      const player = new CombatActionPlayer(
        { playSequence },
        { getSequence: () => sequence }
      );

      await player.playAction({
        actionId: 'act_each',
        actorId: 'hero',
        vfxId: sequence.id,
        events: [
          { type: CombatEventType.HIT, actionId: 'act_each', actorId: 'hero', targetId: 'enemy_a', damage: 10, text: 'A' },
          { type: CombatEventType.HIT, actionId: 'act_each', actorId: 'hero', targetId: 'enemy_b', damage: 20, text: 'B' }
        ]
      }, {
        fromPoint: { x: 0, y: 0 },
        toPoint: { x: 100, y: 100 },
        resolveVisualPoint: id => id === 'enemy_a' ? { x: 10, y: 20 } : { x: 30, y: 40 }
      });

      expect(resolvedPoints).toEqual([{ x: 10, y: 20 }, { x: 30, y: 40 }]);
    });

    it('cueMap 必須優先於順序映射，且 Cue kind 不相容時不得承載數值', () => {
      const events: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_map', targetId: 'enemy', damage: 10, impactIndex: 0, text: '第一段' },
        { type: CombatEventType.HIT, actionId: 'act_map', targetId: 'enemy', damage: 20, impactIndex: 1, text: '第二段' }
      ];
      const cues: VFXImpactCue[] = [
        { cueId: 'CUE_EARLY', time: 0.1, kind: 'IMPACT' },
        { cueId: 'CUE_HEAL_ONLY', time: 0.15, kind: 'HEAL' },
        { cueId: 'CUE_LATE', time: 0.2, kind: 'IMPACT' }
      ];
      const presentations = mapImpactsToCues(events, cues, {
        presentationMode: 'EXACT_IMPACTS',
        cueMap: { '0': 'CUE_LATE', '1': 'CUE_EARLY' }
      });

      expect(presentations.find(item => item.cueId === 'CUE_LATE')?.amount).toBe(10);
      expect(presentations.find(item => item.cueId === 'CUE_EARLY')?.amount).toBe(20);
      expect(presentations.find(item => item.cueId === 'CUE_HEAL_ONLY')?.kind).toBe('VISUAL_ONLY');
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

  // ─────────────────────────────────────────────────────────────
  // 缺陷 5：多段真實 Impact 少 Cue 時，後段呈現被吞 (規格 §3)
  // ─────────────────────────────────────────────────────────────
  describe('缺陷 5: 多段真實 Impact 少 Cue 時 fallback 派發 (規格 §3)', () => {
    it('2 impacts / 1 cue: 兩筆真實 impact 必須依序呈現且各恰好一次', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const action: CombatAction = {
        actionId: 'act_dual_hit',
        actorId: 'attacker',
        skillId: 'SKILL_DOUBLE_SLASH',
        vfxId: 'VFX_SINGLE_CUE', // 僅有 1 個 Cue
        events: [
          {
            type: CombatEventType.HIT,
            actionId: 'act_dual_hit',
            actorId: 'attacker',
            targetId: 'defender',
            damage: 60,
            text: '第 1 擊'
          },
          {
            type: CombatEventType.HIT,
            actionId: 'act_dual_hit',
            actorId: 'attacker',
            targetId: 'defender',
            damage: 80,
            text: '第 2 擊'
          }
        ]
      };

      const captured: any[] = [];

      // 模擬 preset: 只有 1 個 Cue
      const baseSequence = VFXPresetRepository.getInstance().getSequence('VFX_DEFAULT_SLASH')!;
      const mockSequence: VFXSequence = {
        ...baseSequence,
        id: 'VFX_SINGLE_CUE',
        name: 'Single Cue Slash',
        duration: 0.3,
        impactCues: [
          { cueId: 'CUE_1', time: 0.1, kind: 'IMPACT', weight: 1.0, isPrimary: true }
        ]
      };
      const playSequence = vi.fn(async (...args: Parameters<CombatFXEngine['playSequence']>) => {
          const [runtimeSequence, , , callback] = args;
          if (typeof callback === 'function') {
            runtimeSequence.impactCues.forEach((cue, index) => callback({} as any, index, runtimeSequence.impactCues.length, cue));
          }
      });
      const engine: Pick<CombatFXEngine, 'playSequence'> = { playSequence };
      const repository: Pick<VFXPresetRepository, 'getSequence'> = { getSequence: () => mockSequence };
      const player = new CombatActionPlayer(engine, repository);

      await player.playAction(action, {
        fromPoint: { x: 0, y: 0 },
        toPoint: { x: 100, y: 100 },
        skipVfx: false,
        onPresentImpact: (item) => {
          captured.push(item);
        }
      });

      // 斷言：2 個 impact 都必須被派發，總和 140
      expect(captured.length).toBe(2);
      expect(captured[0].amount).toBe(60);
      expect(captured[1].amount).toBe(80);
      expect(captured[0].targetId).toBe('defender');
      expect(captured[1].targetId).toBe('defender');
      expect(playSequence).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const playedSequence = playSequence.mock.calls[0][0] as VFXSequence;
      expect(playedSequence.impactCues).toHaveLength(2);
    });

    it('成功播放、Skip、WebGL failure 三條路徑之呈現集合必須 100% 一致', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const events: CombatEvent[] = [
        {
          type: CombatEventType.HIT,
          actionId: 'act_compare',
          actorId: 'hero',
          targetId: 'monster',
          damage: 100,
          text: '斬'
        },
        {
          type: CombatEventType.SHIELD_DAMAGE,
          actionId: 'act_compare',
          actorId: 'hero',
          targetId: 'monster',
          shieldDamage: 50,
          text: '護盾吸收'
        }
      ];

      const action: CombatAction = {
        actionId: 'act_compare',
        actorId: 'hero',
        events
      };

      const baseSequence = VFXPresetRepository.getInstance().getSequence('VFX_DEFAULT_SLASH')!;
      const mockSequence: VFXSequence = {
        ...baseSequence,
        id: 'VFX_TEST',
        name: 'Test',
        duration: 0.2,
        impactCues: [
          { cueId: 'CUE_1', time: 0.1, kind: 'IMPACT', weight: 1.0, isPrimary: true }
        ]
      };
      const normalPlaySequence = vi.fn(async (...args: Parameters<CombatFXEngine['playSequence']>) => {
          const [runtimeSequence, , , callback] = args;
          if (typeof callback === 'function') {
            runtimeSequence.impactCues.forEach((cue, index) => callback({} as any, index, runtimeSequence.impactCues.length, cue));
          }
      });
      const normalEngine: Pick<CombatFXEngine, 'playSequence'> = { playSequence: normalPlaySequence };
      const repository: Pick<VFXPresetRepository, 'getSequence'> = { getSequence: () => mockSequence };
      const player = new CombatActionPlayer(normalEngine, repository);

      // 1. Skip 路徑
      const skipCaptured: any[] = [];
      await player.playAction(action, {
        fromPoint: { x: 0, y: 0 },
        toPoint: { x: 100, y: 100 },
        skipVfx: true,
        onPresentImpact: item => skipCaptured.push(item)
      });

      // 2. 正常播放路徑
      const normalCaptured: any[] = [];
      await player.playAction(action, {
        fromPoint: { x: 0, y: 0 },
        toPoint: { x: 100, y: 100 },
        skipVfx: false,
        onPresentImpact: item => normalCaptured.push(item)
      });

      // 3. WebGL failure 路徑
      const failureCaptured: any[] = [];
      const failingEngine: Pick<CombatFXEngine, 'playSequence'> = {
        playSequence: async () => { throw new Error('WebGL context lost simulation'); }
      };
      const failingPlayer = new CombatActionPlayer(failingEngine, repository);
      await failingPlayer.playAction(action, {
        fromPoint: { x: 0, y: 0 },
        toPoint: { x: 100, y: 100 },
        skipVfx: false,
        onPresentImpact: item => failureCaptured.push(item)
      });

      // 斷言：三條路徑獲得的活躍 impact 數量與金額完全一致
      expect(skipCaptured.length).toBe(normalCaptured.length);
      expect(failureCaptured.length).toBe(normalCaptured.length);
      expect(normalCaptured.some(i => i.amount === 50 && (i.kind === 'SHIELD_DAMAGE' || i.shieldDamage === 50))).toBe(true);
      expect(skipCaptured.some(i => i.amount === 50 && (i.kind === 'SHIELD_DAMAGE' || i.shieldDamage === 50))).toBe(true);
      expect(failureCaptured.some(i => i.amount === 50 && (i.kind === 'SHIELD_DAMAGE' || i.shieldDamage === 50))).toBe(true);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 缺陷 6：護盾事件數值解析與破盾呈現 (規格 §4)
  // ─────────────────────────────────────────────────────────────
  describe('缺陷 6: 護盾事件數值解析與破盾呈現 (規格 §4)', () => {
    it('SHIELD_DAMAGE 應正確讀取 shieldDamage，且 amount 不得為 0 或 -0', () => {
      const shieldEv: CombatEvent = {
        type: CombatEventType.SHIELD_DAMAGE,
        actionId: 'act_shield',
        actorId: 'adv_1',
        targetId: 'enemy_shielded',
        shieldDamage: 75,
        damage: 0,
        text: '部隊護盾吸收了 75 點傷害'
      };

      const presentations = mapImpactsToCues([shieldEv], [{ cueId: 'CUE_1', time: 0.1, kind: 'SHIELD' }]);
      expect(presentations.length).toBe(1);
      expect(presentations[0].amount).toBe(75);
      expect(presentations[0].kind).toBe('SHIELD_DAMAGE');
      expect(Object.is(presentations[0].amount, -0)).toBe(false);
    });

    it('SHIELD_BREAK 應能同時表達破盾提示與吸收數值', () => {
      const breakEv: CombatEvent = {
        type: CombatEventType.SHIELD_BREAK,
        actionId: 'act_shield_break',
        actorId: 'adv_1',
        targetId: 'enemy_broken',
        shieldDamage: 120,
        damage: 0,
        text: '部隊護盾破碎！'
      };

      const presentations = mapImpactsToCues([breakEv], [{ cueId: 'CUE_1', time: 0.1, kind: 'SHIELD' }]);
      expect(presentations.length).toBe(1);
      expect(presentations[0].amount).toBe(120);
      expect(presentations[0].kind).toBe('SHIELD_BREAK');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 缺陷 7：Final state reconciliation 多欄位快照遺失 (規格 §6)
  // ─────────────────────────────────────────────────────────────
  describe('缺陷 7: Final state reconciliation 多欄位快照遺失 (規格 §6)', () => {
    it('HIT 後接 STATUS_APPLY，仍必須正確校準 HIT 的 HP 數值', () => {
      const oldDoc = (globalThis as any).document;
      try {
        const hpTxt = { textContent: '300/300' };
        const hpFill = { style: { width: '100%' }, classList: { add: vi.fn(), remove: vi.fn() } };
        const cardEl = { classList: { add: vi.fn(), remove: vi.fn() }, querySelectorAll: () => [] };

        (globalThis as any).document = {
          getElementById: (id: string) => {
            if (id === 'hp-txt-target_1') return hpTxt;
            if (id === 'hp-fill-target_1') return hpFill;
            if (id === 'combat-p-target_1') return cardEl;
            return null;
          }
        };

        const events: CombatEvent[] = [
          {
            type: CombatEventType.HIT,
            actionId: 'act_1',
            actorId: 'hero',
            targetId: 'target_1',
            damage: 100,
            targetHp: 80,
            targetMaxHp: 300,
            text: '重擊'
          },
          {
            type: CombatEventType.STATUS_APPLY,
            actionId: 'act_1',
            actorId: 'hero',
            targetId: 'target_1',
            text: '中毒狀態觸發'
          }
        ];

        CombatUIManager.reconcileFinalActionState(events);
        // 若只取最後一筆事件，HP 快照將遺失；期望 HP 仍正確校準為 80/300
        expect(hpTxt.textContent).toBe('80/300');
      } finally {
        (globalThis as any).document = oldDoc;
      }
    });

    it('MP 消耗後接 HIT，仍必須正確校準 MP 數值', () => {
      const oldDoc = (globalThis as any).document;
      try {
        const mpTxt = { textContent: '100/100' };
        const mpFill = { style: { width: '100%' } };
        const hpTxt = { textContent: '200/200' };
        const hpFill = { style: { width: '100%' }, classList: { add: vi.fn(), remove: vi.fn() } };

        (globalThis as any).document = {
          getElementById: (id: string) => {
            if (id === 'mp-txt-actor_1') return mpTxt;
            if (id === 'mp-fill-actor_1') return mpFill;
            if (id === 'hp-txt-actor_1') return hpTxt;
            if (id === 'hp-fill-actor_1') return hpFill;
            return null;
          }
        };

        const events: CombatEvent[] = [
          {
            type: CombatEventType.SKILL_CAST,
            actionId: 'act_cast',
            actorId: 'actor_1',
            targetId: 'actor_1',
            targetMp: 45,
            targetMaxMp: 100,
            text: '施法消耗 MP'
          },
          {
            type: CombatEventType.HIT,
            actionId: 'act_cast',
            actorId: 'actor_1',
            targetId: 'actor_1',
            damage: 20,
            targetHp: 180,
            targetMaxHp: 200,
            text: '反噬受傷'
          }
        ];

        CombatUIManager.reconcileFinalActionState(events);
        expect(mpTxt.textContent).toBe('45/100');
        expect(hpTxt.textContent).toBe('180/200');
      } finally {
        (globalThis as any).document = oldDoc;
      }
    });

    it('SHIELD_DAMAGE 後接 STATUS 仍必須更新既有護盾 HUD', () => {
      const oldDoc = globalThis.document;
      try {
        const shieldFill = { style: { width: '100%' } };
        const shieldText = { textContent: '🛡 200/200' };
        const shieldBg = {
          getAttribute: (name: string) => name === 'data-shield-max' ? '200' : null,
          classList: { toggle: vi.fn() }
        };
        Object.defineProperty(globalThis, 'document', {
          configurable: true,
          value: {
            getElementById: (id: string) => {
              if (id === 'shield-fill-target_1') return shieldFill;
              if (id === 'shield-txt-target_1') return shieldText;
              if (id === 'shield-bg-target_1') return shieldBg;
              return null;
            }
          }
        });

        CombatUIManager.reconcileFinalActionState([
          {
            type: CombatEventType.SHIELD_DAMAGE,
            actionId: 'act_shield_ui',
            targetId: 'target_1',
            shieldDamage: 75,
            shieldRemaining: 125,
            text: '護盾吸收'
          },
          {
            type: CombatEventType.STATUS_APPLY,
            actionId: 'act_shield_ui',
            targetId: 'target_1',
            text: '狀態附加'
          }
        ]);

        expect(shieldFill.style.width).toBe('62.5%');
        expect(shieldText.textContent).toBe('🛡 125/200');
        expect(shieldBg.classList.toggle).toHaveBeenCalledWith('is-broken', false);
      } finally {
        Object.defineProperty(globalThis, 'document', { configurable: true, value: oldDoc });
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 缺陷 8：Action collector 跨越 Barrier 聚合改變事件時序 (規格 §8)
  // ─────────────────────────────────────────────────────────────
  describe('缺陷 8: Action collector 跨越 Barrier 聚合改變事件時序 (規格 §8)', () => {
    it('相同 actionId 不得跨越 DEATH 等 barrier 強行合併，且 flatten 後順序嚴格等於原始事件', () => {
      const ev1: CombatEvent = {
        type: CombatEventType.HIT,
        actionId: 'act_combo',
        actorId: 'attacker',
        targetId: 'target_A',
        damage: 50,
        text: '第一段攻擊'
      };
      const evDeath: CombatEvent = {
        type: CombatEventType.DEATH,
        targetId: 'target_B',
        text: '目標 B 倒下'
      };
      const ev2: CombatEvent = {
        type: CombatEventType.HIT,
        actionId: 'act_combo',
        actorId: 'attacker',
        targetId: 'target_A',
        damage: 60,
        text: '第二段追擊'
      };

      const originalEvents = [ev1, evDeath, ev2];
      const collected = collectCombatActions(originalEvents);

      // 依規格 §8：遇到 DEATH 必須作為 barrier 切分，不可把 ev2 合併回 ev1 的 Action
      // 預期 collected 應為 [ActionSegment1(ev1), evDeath, ActionSegment2(ev2)]
      expect(collected.length).toBe(3);

      // 驗證 flatten 後物件 identity 順序與輸入完全一致
      const flattened: CombatEvent[] = [];
      collected.forEach(item => {
        if (isCombatAction(item)) {
          flattened.push(...item.events);
        } else {
          flattened.push(item);
        }
      });

      expect(flattened.length).toBe(3);
      expect(flattened[0]).toBe(ev1);
      expect(flattened[1]).toBe(evDeath);
      expect(flattened[2]).toBe(ev2);
    });
  });
});
