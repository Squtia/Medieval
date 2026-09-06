import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CombatEvent, CombatEventType } from '../../models/Combat';
import { mapImpactsToCues, CombatActionPlayer, CombatAction } from '../../ui/fx/CombatActionPlayer';
import { CombatFXEngine } from '../../ui/fx/CombatFXEngine';
import { VFXImpactCue, VFXPreset } from '../../models/VFX';

describe('Fix 3: CombatAction & Cue Mapping Verification (Batches C & D)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 🧮 批次 D 測試：Impact Cue 與傷害呈現語意純函式不變量
  // ─────────────────────────────────────────────────────────────
  describe('批次 D：mapImpactsToCues 純函式不變量測試', () => {
    it('不變量 1: 任一模式都不得改變戰鬥系統已結算的 HP 最終結算總值', () => {
      const rawDamage = 777;
      const events: CombatEvent[] = [
        {
          type: CombatEventType.HIT,
          actionId: 'act_test',
          actorId: 'player',
          targetId: 'boss',
          damage: rawDamage,
          targetHp: 223,
          targetMaxHp: 1000,
          text: '造成傷害'
        }
      ];

      const cues: VFXImpactCue[] = [
        { cueId: 'CUE_1', time: 0.1, weight: 0.25, isPrimary: false },
        { cueId: 'CUE_2', time: 0.2, weight: 0.25, isPrimary: false },
        { cueId: 'CUE_3', time: 0.35, weight: 0.5, isPrimary: true }
      ];

      // 測試三種模式
      const exactItems = mapImpactsToCues(events, cues, 'EXACT_IMPACTS');
      const splitItems = mapImpactsToCues(events, cues, 'SPLIT_SINGLE_IMPACT');
      const primaryItems = mapImpactsToCues(events, cues, 'PRIMARY_ONLY');

      // 總傷害值加總檢驗
      const exactSum = exactItems.reduce((acc, cur) => acc + cur.amount, 0);
      const splitSum = splitItems.reduce((acc, cur) => acc + cur.amount, 0);
      const primarySum = primaryItems.reduce((acc, cur) => acc + cur.amount, 0);

      expect(exactSum).toBe(rawDamage);
      expect(splitSum).toBe(rawDamage);
      expect(primarySum).toBe(rawDamage);
    });

    it('不變量 2: SPLIT_SINGLE_IMPACT 所有顯示片段整數加總 100% 精確等於來源 amount，餘數進終擊 (依文件第 11 節驗收標準: 503 依 20/20/60 切割後總和仍為 503)', () => {
      // 🌟 嚴格遵守文件 Phase 5 驗收指標：503 依 20/20/60 切割後總和仍為 503
      const specDamage = 503;
      const specEvents: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_spec', actorId: 'p', targetId: 'm', damage: specDamage, text: '命中' }
      ];
      const specCues: VFXImpactCue[] = [
        { cueId: 'CUE_1', time: 0.1, weight: 20, isPrimary: false },
        { cueId: 'CUE_2', time: 0.2, weight: 20, isPrimary: false },
        { cueId: 'CUE_3', time: 0.35, weight: 60, isPrimary: true }
      ];

      const specItems = mapImpactsToCues(specEvents, specCues, 'SPLIT_SINGLE_IMPACT');
      expect(specItems.length).toBe(3);
      // 503 * 20/100 = 100.6 -> floor 100
      // 503 * 20/100 = 100.6 -> floor 100
      // 餘數 503 - 200 = 303 進終擊
      expect(specItems.map(i => i.amount)).toEqual([100, 100, 303]);
      expect(specItems.reduce((sum, i) => sum + i.amount, 0)).toBe(503);

      // 測試不能整除的數值 (例如 500 依權重 0.33, 0.33, 0.34 切割)
      const rawDamage = 500;
      const events: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_1', actorId: 'p', targetId: 'm', damage: rawDamage, text: '命中' }
      ];
      const cues: VFXImpactCue[] = [
        { cueId: 'CUE_A', time: 0.1, weight: 0.33, isPrimary: false },
        { cueId: 'CUE_B', time: 0.2, weight: 0.33, isPrimary: false },
        { cueId: 'CUE_C', time: 0.3, weight: 0.34, isPrimary: true }
      ];

      const items = mapImpactsToCues(events, cues, 'SPLIT_SINGLE_IMPACT');
      expect(items.length).toBe(3);
      expect(items.map(i => i.amount)).toEqual([165, 165, 170]);
      expect(items.reduce((sum, i) => sum + i.amount, 0)).toBe(500);

      // 測試小數額分配 (例如 2 點傷害拆 3 段)
      const tinyEvents: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_2', actorId: 'p', targetId: 'm', damage: 2, text: '微弱命中' }
      ];
      const tinyItems = mapImpactsToCues(tinyEvents, cues, 'SPLIT_SINGLE_IMPACT');
      expect(tinyItems.map(i => i.amount)).toEqual([0, 0, 2]);
      expect(tinyItems.reduce((sum, i) => sum + i.amount, 0)).toBe(2);

      // 測試 VISUAL_ONLY 純視覺 Cue 不參與傷害分配
      const mixedCues: VFXImpactCue[] = [
        { cueId: 'SPARK_PREP', time: 0.05, kind: 'VISUAL_ONLY' },
        { cueId: 'HIT_MAIN', time: 0.2, weight: 1.0, isPrimary: true }
      ];
      const mixedItems = mapImpactsToCues(events, mixedCues, 'SPLIT_SINGLE_IMPACT');
      expect(mixedItems.length).toBe(2);
      expect(mixedItems[0].amount).toBe(0);
      expect(mixedItems[0].kind).toBe('VISUAL_ONLY');
      expect(mixedItems[1].amount).toBe(500);
    });

    it('不變量 3: EXACT_IMPACTS 每個顯示值逐一等於來源 impact.amount，順序與 cueId 正確', () => {
      const events: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_slash', targetId: 'boss', damage: 100, text: '段1' },
        { type: CombatEventType.HIT, actionId: 'act_slash', targetId: 'boss', damage: 150, text: '段2' },
        { type: CombatEventType.CRIT, actionId: 'act_slash', targetId: 'boss', damage: 320, text: '段3暴擊' }
      ];
      const cues: VFXImpactCue[] = [
        { cueId: 'CUE_1', time: 0.1, weight: 1.0, isPrimary: false },
        { cueId: 'CUE_2', time: 0.2, weight: 1.0, isPrimary: false },
        { cueId: 'CUE_3', time: 0.3, weight: 1.0, isPrimary: true }
      ];

      const items = mapImpactsToCues(events, cues, 'EXACT_IMPACTS');
      expect(items.length).toBe(3);
      expect(items[0].amount).toBe(100);
      expect(items[1].amount).toBe(150);
      expect(items[2].amount).toBe(320);
      expect(items[2].isCrit).toBe(true);
      expect(items[2].isPrimary).toBe(true);
    });

    it('不變量 4: PRIMARY_ONLY 恰好一個數值呈現，其餘 Cue 金額為 0', () => {
      const events: CombatEvent[] = [
        { type: CombatEventType.CRIT, actionId: 'act_heavy', targetId: 'golem', damage: 660, text: '蓄力暴擊' }
      ];
      const cues: VFXImpactCue[] = [
        { cueId: 'CUE_CHARGE', time: 0.1, weight: 0.2, isPrimary: false },
        { cueId: 'CUE_IMPACT', time: 0.4, weight: 1.0, isPrimary: true }
      ];

      const items = mapImpactsToCues(events, cues, 'PRIMARY_ONLY');
      expect(items.length).toBe(2);
      expect(items[0].amount).toBe(0);
      expect(items[0].isPrimary).toBe(false);
      expect(items[1].amount).toBe(660);
      expect(items[1].isPrimary).toBe(true);
      expect(items[1].isCrit).toBe(true);
    });

    it('不變量 5: 多目標 AOE mapping 絕不把 A 目標的 impact 混淆至 B 目標', () => {
      const aoeEvents: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_aoe', targetId: 'enemy_A', damage: 180, text: '目標A受擊' },
        { type: CombatEventType.CRIT, actionId: 'act_aoe', targetId: 'enemy_B', damage: 360, text: '目標B暴擊' },
        { type: CombatEventType.MISS, actionId: 'act_aoe', targetId: 'enemy_C', damage: 0, text: '目標C閃避' }
      ];
      const cues: VFXImpactCue[] = [
        { cueId: 'CUE_BURST', time: 0.25, weight: 1.0, isPrimary: true }
      ];

      const items = mapImpactsToCues(aoeEvents, cues, 'EXACT_IMPACTS');
      expect(items.length).toBe(3);

      const itemA = items.find(i => i.targetId === 'enemy_A');
      const itemB = items.find(i => i.targetId === 'enemy_B');
      const itemC = items.find(i => i.targetId === 'enemy_C');

      expect(itemA?.amount).toBe(180);
      expect(itemA?.kind).toBe('DAMAGE');

      expect(itemB?.amount).toBe(360);
      expect(itemB?.isCrit).toBe(true);

      expect(itemC?.kind).toBe('MISS');
      expect(itemC?.amount).toBe(0);
    });

    it('不變量 6: 治療 (HEAL) 與吸血 (DAMAGE + HEAL) 具備確定性呈現', () => {
      const vampireEvents: CombatEvent[] = [
        { type: CombatEventType.HIT, actionId: 'act_vamp', actorId: 'witch', targetId: 'warrior', damage: 200, text: '吸血傷害' },
        { type: CombatEventType.HEAL, actionId: 'act_vamp', actorId: 'witch', targetId: 'witch', healAmount: 100, text: '吸血恢復' }
      ];

      const items = mapImpactsToCues(vampireEvents, [], 'EXACT_IMPACTS');
      expect(items.length).toBe(2);
      expect(items.find(i => i.targetId === 'warrior')?.kind).toBe('DAMAGE');
      expect(items.find(i => i.targetId === 'warrior')?.amount).toBe(200);

      expect(items.find(i => i.targetId === 'witch')?.kind).toBe('HEAL');
      expect(items.find(i => i.targetId === 'witch')?.amount).toBe(100);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 🎬 批次 C 測試：真正的 CombatAction 播放鏈與單次播放保證
  // ─────────────────────────────────────────────────────────────
  describe('批次 C：CombatActionPlayer 完整播放鏈與調度', () => {
    it('應驗證 1 個 SKILL_CAST + 3 個 HIT 事件組成一個 Action，底層只播放一次 VFX', async () => {
      const actionPlayer = new CombatActionPlayer();
      const fxEngine = CombatFXEngine.getInstance();
      (fxEngine as any).isRunning = true;

      const mock3CuePreset: VFXPreset = {
        ...((CombatFXEngine.getInstance() as any).getPreset?.('VFX_HEAVY_STRIKE') || {}),
        id: 'TEST_COMBO_VFX',
        duration: 0.4,
        impactCues: [
          { cueId: 'CUE_1', time: 0.1, weight: 1, isPrimary: false },
          { cueId: 'CUE_2', time: 0.2, weight: 1, isPrimary: false },
          { cueId: 'CUE_3', time: 0.3, weight: 1, isPrimary: true }
        ]
      } as any;
      vi.spyOn((actionPlayer as any).presetRepo, 'getPreset').mockReturnValue(mock3CuePreset);

      const playPresetSpy = vi.spyOn(fxEngine, 'playPresetConfig').mockImplementation(async (_preset, _from, _to, onImpact: any) => {
        // 模擬觸發 3 個 Cue
        if (typeof onImpact === 'function') {
          onImpact({} as any, 0, 3, { cueId: 'CUE_1', time: 0.1, weight: 1, isPrimary: false });
          onImpact({} as any, 1, 3, { cueId: 'CUE_2', time: 0.2, weight: 1, isPrimary: false });
          onImpact({} as any, 2, 3, { cueId: 'CUE_3', time: 0.3, weight: 1, isPrimary: true });
        }
      });

      const action: CombatAction = {
        actionId: 'act_combo',
        actorId: 'hero',
        vfxId: 'TEST_COMBO_VFX',
        events: [
          { type: CombatEventType.SKILL_CAST, actionId: 'act_combo', actorId: 'hero', text: '發動三段斬' },
          { type: CombatEventType.HIT, actionId: 'act_combo', targetId: 'enemy_1', damage: 100, text: '段1' },
          { type: CombatEventType.HIT, actionId: 'act_combo', targetId: 'enemy_1', damage: 120, text: '段2' },
          { type: CombatEventType.CRIT, actionId: 'act_combo', targetId: 'enemy_1', damage: 250, text: '段3暴擊' }
        ]
      };

      const receivedItems: any[] = [];

      await actionPlayer.playAction(action, {
        fromPoint: { x: 0, y: 0 },
        toPoint: { x: 100, y: 100 },
        onPresentImpact: (item) => {
          receivedItems.push(item);
        }
      });

      // 核心驗證 1：一個 Action 嚴格只呼叫一次 3D 引擎播放！
      expect(playPresetSpy).toHaveBeenCalledTimes(1);

      // 核心驗證 2：三個 Cue 各精準消費一個已結算 impact
      expect(receivedItems.length).toBe(3);
      expect(receivedItems.map(i => i.amount)).toEqual([100, 120, 250]);
      expect(receivedItems[2].isCrit).toBe(true);
    });

    it('應驗證 skipVfx 模式下直接同步結算所有呈現項目，不呼叫 3D 引擎', async () => {
      const actionPlayer = new CombatActionPlayer();
      const fxEngine = CombatFXEngine.getInstance();
      const playPresetSpy = vi.spyOn(fxEngine, 'playPresetConfig');

      const action: CombatAction = {
        actionId: 'act_skip',
        actorId: 'hero',
        vfxId: 'VFX_HEAVY_STRIKE',
        events: [
          { type: CombatEventType.HIT, actionId: 'act_skip', targetId: 'enemy_1', damage: 300, text: '跳過傷害' }
        ]
      };

      const presented: any[] = [];
      let completeCalled = false;

      await actionPlayer.playAction(action, {
        fromPoint: { x: 0, y: 0 },
        toPoint: { x: 100, y: 100 },
        skipVfx: true,
        onPresentImpact: (item) => presented.push(item),
        onActionComplete: () => { completeCalled = true; }
      });

      expect(playPresetSpy).not.toHaveBeenCalled();
      expect(presented.length).toBe(1);
      expect(presented[0].amount).toBe(300);
      expect(completeCalled).toBe(true);
    });

    it('規範第 11 節驗收標準: WebGL 或 3D 渲染拋出異常時，戰鬥依然完成且不遺失結算項目', async () => {
      const actionPlayer = new CombatActionPlayer();
      const fxEngine = CombatFXEngine.getInstance();

      // 模擬 WebGL Context Lost 或 Shader 拋出重大異常
      vi.spyOn(fxEngine, 'playPresetConfig').mockRejectedValue(new Error('WebGL context lost simulation'));

      const action: CombatAction = {
        actionId: 'act_webgl_fail',
        actorId: 'hero',
        vfxId: 'VFX_HEAVY_STRIKE',
        events: [
          { type: CombatEventType.CRIT, actionId: 'act_webgl_fail', targetId: 'boss', damage: 999, text: '致勝一擊' }
        ]
      };

      const presented: any[] = [];
      let completeCalled = false;

      // 執行 playAction，絕不可 throw / reject 導致戰鬥中斷！
      await expect(actionPlayer.playAction(action, {
        fromPoint: { x: 0, y: 0 },
        toPoint: { x: 100, y: 100 },
        onPresentImpact: (item) => presented.push(item),
        onActionComplete: () => { completeCalled = true; }
      })).resolves.not.toThrow();

      // 驗收標準：戰鬥完成回調 100% 觸發，且數值安全派發
      expect(completeCalled).toBe(true);
      expect(presented.length).toBe(1);
      expect(presented[0].amount).toBe(999);
      expect(presented[0].isCrit).toBe(true);
    });

    it('規範第 8 節: STATUS_APPLY 事件映射為 STATUS 且不虛構傷害', () => {
      const statusEvents: CombatEvent[] = [
        { type: CombatEventType.STATUS_APPLY, actionId: 'act_buff', targetId: 'ally_1', text: '附加聖佑' }
      ];
      const cues: VFXImpactCue[] = [
        { cueId: 'CUE_BLESS', time: 0.2, kind: 'STATUS' }
      ];

      const items = mapImpactsToCues(statusEvents, cues, 'EXACT_IMPACTS');
      expect(items.length).toBe(1);
      expect(items[0].kind).toBe('STATUS');
      expect(items[0].amount).toBe(0);
    });
  });
});
