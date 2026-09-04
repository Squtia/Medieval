import { CombatEvent, CombatEventType } from '../../models/Combat';
import { ImpactPresentationMode, VFXImpactConfig, VFXImpactCue, VFXPreset } from '../../models/VFX';
import { CombatFXEngine, ScreenPoint } from './CombatFXEngine';
import { VFXPresetRepository } from './VFXPresetRepository';

/**
 * 🎯 CombatImpactPresentation
 * 已完成與時間軸 Cue 配對的純呈現物件 (Immutable Presentation Item)
 * 禁止 StageAdapter 再度執行 damage * weight 或 damage / count 等二度運算
 */
export interface CombatImpactPresentation {
  cueIndex: number;
  cueId: string;
  targetId: string;
  amount: number;
  kind: 'DAMAGE' | 'HEAL' | 'SHIELD_DAMAGE' | 'MISS';
  isCrit: boolean;
  isPrimary: boolean;
  targetHp?: number;
  targetMaxHp?: number;
}

/**
 * 📦 聚合技能行動單元 (CombatAction)
 * 以 actionId 為穩定邊界，包含一個施法行為與其後續引發之所有傷害/治療/狀態事件
 */
export interface CombatAction {
  actionId: string;
  actorId: string;
  skillId?: string;
  vfxId?: string;
  events: CombatEvent[];
}

/**
 * 🧮 mapImpactsToCues
 * 核心純函式：將戰鬥已結算事件精確映射至視覺時間軸 Cue
 * 嚴格遵循 docs/VFX_STUDIO_GEMINI_3_8_FLASH_ACCEPTANCE_FIX.md 規範 6：
 * - 任一模式皆不得篡改已結算的傷害/治療總值。
 * - SPLIT_SINGLE_IMPACT: 採用整數安全分配，餘數分配於終擊段，片段總和精確等於原始 amount。
 * - EXACT_IMPACTS: N 筆 Impact 依序對應 N 個 Cue，逐筆呈現原始 amount。
 * - PRIMARY_ONLY: 僅在 isPrimary Cue 呈現原始 amount，其餘 Cue 僅觸發無數值打擊感。
 * - 多目標隔離：多目標事件依 targetId 分離，絕不混淆目標。
 */
export function mapImpactsToCues(
  events: CombatEvent[],
  cues: VFXImpactCue[] = [],
  mode: ImpactPresentationMode = 'EXACT_IMPACTS'
): CombatImpactPresentation[] {
  // 過濾有效結算事件 (HIT, CRIT, HEAL, SHIELD_DAMAGE, MISS)
  const impactEvents = events.filter(e =>
    e.type === CombatEventType.HIT ||
    e.type === CombatEventType.CRIT ||
    e.type === CombatEventType.HEAL ||
    e.type === CombatEventType.SHIELD_DAMAGE ||
    e.type === CombatEventType.MISS
  );

  if (impactEvents.length === 0) return [];

  // 若預設未定義 Cues，建立單一 Fallback Cue
  const effectiveCues: VFXImpactCue[] = cues.length > 0
    ? cues
    : [{ cueId: 'CUE_DEFAULT', time: 0.15, weight: 1.0, isPrimary: true }];

  const results: CombatImpactPresentation[] = [];

  // 依 targetId 分組進行目標隔離處理
  const targetMap = new Map<string, CombatEvent[]>();
  impactEvents.forEach(ev => {
    const tid = ev.targetId || 'UNKNOWN';
    if (!targetMap.has(tid)) targetMap.set(tid, []);
    targetMap.get(tid)!.push(ev);
  });

  targetMap.forEach((targetEvents, targetId) => {
    // 判斷該目標之結算模式
    // 1. 若事件本身即為多段（多筆 HIT 事件），一律採 EXACT 對齊
    if (targetEvents.length > 1) {
      targetEvents.forEach((ev, idx) => {
        const cueIdx = Math.min(idx, effectiveCues.length - 1);
        const cue = effectiveCues[cueIdx];
        results.push({
          cueIndex: cueIdx,
          cueId: cue.cueId,
          targetId,
          amount: ev.damage || ev.healAmount || 0,
          kind: ev.type === CombatEventType.HEAL ? 'HEAL' : (ev.type === CombatEventType.SHIELD_DAMAGE ? 'SHIELD_DAMAGE' : (ev.type === CombatEventType.MISS ? 'MISS' : 'DAMAGE')),
          isCrit: ev.type === CombatEventType.CRIT,
          isPrimary: cue.isPrimary || idx === targetEvents.length - 1,
          targetHp: ev.targetHp,
          targetMaxHp: ev.targetMaxHp
        });
      });
      return;
    }

    // 2. 該目標僅有單筆已結算事件
    const singleEv = targetEvents[0];
    const totalAmount = singleEv.damage || singleEv.healAmount || 0;
    const kind = singleEv.type === CombatEventType.HEAL ? 'HEAL' : (singleEv.type === CombatEventType.SHIELD_DAMAGE ? 'SHIELD_DAMAGE' : (singleEv.type === CombatEventType.MISS ? 'MISS' : 'DAMAGE'));
    const isCrit = singleEv.type === CombatEventType.CRIT;

    if (mode === 'PRIMARY_ONLY') {
      // 僅在 primary cue 呈現完整數值，其餘為 0
      const primaryIdx = effectiveCues.findIndex(c => c.isPrimary);
      const chosenPrimary = primaryIdx >= 0 ? primaryIdx : effectiveCues.length - 1;

      effectiveCues.forEach((cue, cIdx) => {
        const isPri = cIdx === chosenPrimary;
        results.push({
          cueIndex: cIdx,
          cueId: cue.cueId,
          targetId,
          amount: isPri ? totalAmount : 0,
          kind,
          isCrit: isPri && isCrit,
          isPrimary: isPri,
          targetHp: isPri ? singleEv.targetHp : undefined,
          targetMaxHp: singleEv.targetMaxHp
        });
      });
    } else if (mode === 'SPLIT_SINGLE_IMPACT' && effectiveCues.length > 1 && totalAmount > 0) {
      // ⚖️ 整數安全分配 (Integer Safe Split)
      const count = effectiveCues.length;
      const baseSlice = Math.floor(totalAmount / count);
      const remainder = totalAmount % count;

      effectiveCues.forEach((cue, cIdx) => {
        // 餘數由終擊段吸收，確保加總 100% 等於 totalAmount
        const isLast = cIdx === count - 1;
        const sliceAmount = isLast ? baseSlice + remainder : baseSlice;
        results.push({
          cueIndex: cIdx,
          cueId: cue.cueId,
          targetId,
          amount: sliceAmount,
          kind,
          isCrit: isLast && isCrit,
          isPrimary: cue.isPrimary || isLast,
          targetHp: isLast ? singleEv.targetHp : undefined,
          targetMaxHp: singleEv.targetMaxHp
        });
      });
    } else {
      // 🎯 EXACT_IMPACTS 預設：整數直接於第一個或主要 Cue 呈現
      effectiveCues.forEach((cue, cIdx) => {
        const isFirst = cIdx === 0;
        results.push({
          cueIndex: cIdx,
          cueId: cue.cueId,
          targetId,
          amount: isFirst ? totalAmount : 0,
          kind,
          isCrit: isFirst && isCrit,
          isPrimary: cue.isPrimary || isFirst,
          targetHp: isFirst ? singleEv.targetHp : undefined,
          targetMaxHp: singleEv.targetMaxHp
        });
      });
    }
  });

  return results;
}

/**
 * 🎬 CombatActionPlayer
 * 一次技能行動的完整播放器 (Single Action VFX Pipeline Player)
 * 職責：
 * 1. 一個 Action 只呼叫一次 VFXPlayer.play()。
 * 2. 協調 impacts 與 cues 配對。
 * 3. 支援 Promise await、pause、resume、speed 與取消。
 */
export class CombatActionPlayer {
  private fxEngine: CombatFXEngine;
  private presetRepo: VFXPresetRepository;

  constructor() {
    this.fxEngine = CombatFXEngine.getInstance();
    this.presetRepo = VFXPresetRepository.getInstance();
  }

  /**
   * 播放一次完整的技能行動
   */
  public async playAction(
    action: CombatAction,
    options: {
      fromPoint: ScreenPoint;
      toPoint: ScreenPoint;
      skipVfx?: boolean;
      onPresentImpact?: (item: CombatImpactPresentation, cue?: VFXImpactCue) => void;
      onActionComplete?: () => void;
    }
  ): Promise<void> {
    const vfxId = action.vfxId || 'VFX_DEFAULT_SLASH';
    const preset = this.presetRepo.getPreset(vfxId);

    // 若 skipVfx 或找不到 preset，直接無特效結算所有呈現項目
    if (options.skipVfx || !preset) {
      const mode = preset?.impactPresentationMode || 'EXACT_IMPACTS';
      const items = mapImpactsToCues(action.events, preset?.impactCues || [], mode);
      const activeItems = items.filter(i => i.amount > 0 || i.kind === 'MISS');
      activeItems.forEach(item => {
        options.onPresentImpact?.(item);
      });
      options.onActionComplete?.();
      return;
    }

    // 計算預先配對之打擊項目清單
    const presentationItems = mapImpactsToCues(
      action.events,
      preset.impactCues || [],
      preset.impactPresentationMode || 'EXACT_IMPACTS'
    );

    // 依 cueIndex 分組建立查找表
    const cueMap = new Map<number, CombatImpactPresentation[]>();
    presentationItems.forEach(item => {
      if (!cueMap.has(item.cueIndex)) cueMap.set(item.cueIndex, []);
      cueMap.get(item.cueIndex)!.push(item);
    });

    // 呼叫底層 3D FX 引擎，精確播放一次 Preset！
    await this.fxEngine.playPresetConfig(
      preset,
      options.fromPoint,
      options.toPoint,
      (_impact: VFXImpactConfig, hitIdx: number, _totalHits: number, cue?: VFXImpactCue) => {
        // 當時間軸觸發特定 Cue 時，分發已配對之呈現項目
        const matchedItems = cueMap.get(hitIdx) || [];
        if (matchedItems.length > 0) {
          matchedItems.forEach(item => {
            options.onPresentImpact?.(item, cue);
          });
        } else {
          // 若無數值項目，仍觸發無數值打擊感
          options.onPresentImpact?.({
            cueIndex: hitIdx,
            cueId: cue?.cueId || `CUE_${hitIdx}`,
            targetId: '',
            amount: 0,
            kind: 'DAMAGE',
            isCrit: false,
            isPrimary: cue?.isPrimary ?? false
          }, cue);
        }
      }
    );

    options.onActionComplete?.();
  }
}
