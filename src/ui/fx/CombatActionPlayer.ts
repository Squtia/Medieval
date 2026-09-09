import { CombatEvent, CombatEventType, CombatImpactKind, StatusEffectType } from '../../models/Combat';
import { ImpactPresentationMode, VFXImpactConfig, VFXImpactCue, VFXPreset, VFXCueKind, VFXTargetPolicy, VFXSequence } from '../../models/VFX';
import { CombatFXEngine, ScreenPoint } from './CombatFXEngine';
import { VFXPresetRepository } from './VFXPresetRepository';
import { SkillVfxBindingRegistry } from '../../systems/combat/SkillVfxBindingRegistry';

/**
 * 🎯 CombatImpactPresentation
 * 已解析之打擊/Cue 呈現項目 (Immutable Presentation Item)
 * 禁止 StageAdapter 額外計算 damage * weight 或 damage / count 等二度計算
 * 依據規格 §5.2、§7.2、§11.1 分離 targetId 與 visualTargetId，完整保留文字與狀態資訊
 */
export interface CombatImpactPresentation {
  cueIndex: number;
  cueId: string;
  cueTime: number;
  // 真實結算目標；數字、HP、status 必須使用此欄位。
  targetId: string;
  // 3D VFX 實際播放位置；可以是 primary、each target 或 caster。
  visualTargetId?: string;
  amount: number;
  kind: 'DAMAGE' | 'HEAL' | 'SHIELD_DAMAGE' | 'SHIELD_BREAK' | 'STATUS' | 'MISS' | 'VISUAL_ONLY';
  isCrit: boolean;
  isPrimary: boolean;
  targetHp?: number;
  targetMaxHp?: number;
  targetPolicy?: 'PRIMARY_TARGET' | 'EACH_TARGET' | 'CASTER';
  cueCount?: number;
  presentationIndex?: number;
  presentationCount?: number;
  shieldDamage?: number;
  shieldRemaining?: number;
  text?: string;
  statusType?: StatusEffectType;
  skillName?: string;
}

/**
 * 🎯 resolveImpactAmount (規格 §4.2)
 * 單一純函式：解析結算事件之真實數值，嚴格使用 ?? 杜絕錯誤使用 0，且不得產生 -0
 */
export function resolveImpactAmount(
  event: CombatEvent,
  kind: CombatImpactPresentation['kind']
): number {
  switch (kind) {
    case 'DAMAGE':
      return Math.max(0, event.damage ?? 0);
    case 'HEAL':
      return Math.max(0, event.healAmount ?? event.damage ?? 0);
    case 'SHIELD_DAMAGE':
    case 'SHIELD_BREAK':
      return Math.max(0, event.shieldDamage ?? event.damage ?? 0);
    case 'STATUS':
    case 'MISS':
    case 'VISUAL_ONLY':
      return 0;
  }
}

/**
 * 🎯 shouldPresentImpact (規格 §4.3)
 * 共用活躍 presentation 判定純函式
 * Skip、Preset missing、正常播放補償、WebGL failure 必須全部使用同一 predicate
 */
export function shouldPresentImpact(item: CombatImpactPresentation): boolean {
  if (item.kind === 'VISUAL_ONLY') return false;
  if (item.kind === 'MISS' || item.kind === 'STATUS' || item.kind === 'SHIELD_BREAK') return true;
  return item.amount > 0;
}

/**
 * 🎯 單次戰鬥行動單元 (CombatAction)
 * 以 actionId 為穩定識別碼，包含一次施法、前搖、後續多段打擊、傷害、治療/狀態結算
 */
export interface CombatAction {
  actionId: string;
  actorId: string;
  skillId?: string;
  vfxId?: string;
  presentationMode?: ImpactPresentationMode;
  cueMap?: Record<string, string>;
  events: CombatEvent[];
}

/**
 * 🎯 解析單次戰鬥行動的主要受術/受擊目標 ID
 * 嚴格隔離 SKILL_CAST 用於扣除自身 MP 的 targetId，防止攻擊技能目標誤指施法者自身
 */
export function resolveActionMainTargetId(action: CombatAction): string {
  // 1. 優先從非 SKILL_CAST 的有效受擊/受傷/治療事件中尋找目標
  const hitEv = action.events.find(e =>
    e.type !== CombatEventType.SKILL_CAST &&
    e.targetId &&
    e.targetId !== action.actorId
  );
  if (hitEv?.targetId) return hitEv.targetId;

  // 2. 次選從 SKILL_CAST 的 skillTargetId 尋找（若攻擊或治療他人）
  const castWithSkillTarget = action.events.find(e => e.skillTargetId && e.skillTargetId !== action.actorId);
  if (castWithSkillTarget?.skillTargetId) return castWithSkillTarget.skillTargetId;

  // 3. 次選任意非 SKILL_CAST 事件的 targetId
  const anyNonCastEv = action.events.find(e => e.type !== CombatEventType.SKILL_CAST && e.targetId);
  if (anyNonCastEv?.targetId) return anyNonCastEv.targetId;

  // 4. 若有明確 skillTargetId（包含指定自身的增益技能）
  const anySkillTarget = action.events.find(e => e.skillTargetId);
  if (anySkillTarget?.skillTargetId) return anySkillTarget.skillTargetId;

  // 5. 若皆無，最後才退回第一個有 targetId 的事件或 actorId
  return action.events.find(e => e.targetId)?.targetId || action.actorId;
}

/**
 * 🎯 判斷項目是否為 CombatAction
 */
export function isCombatAction(item: CombatAction | CombatEvent): item is CombatAction {
  if (typeof item !== 'object' || item === null || !('events' in item)) return false;
  return Array.isArray(item.events);
}

/**
 * 🎯 collectCombatActions
 * 將戰鬥事件線性流一次性分組為 CombatAction 與獨立事件
 * 嚴格遵循 docs/VFX_STUDIO_GEMINI_REFACTOR_IMPLEMENTATION.md §4.4 規範：
 * - 依 actionId 預先分組，保留原始順序。
 * - 相同 actionId 的施法、命中、暴擊、治療、護盾、狀態、MISS 歸入同一個 CombatAction。
 * - DEATH 事件（或沒有 actionId 的獨立事件）保留為獨立 CombatEvent，不阻止同 action 收集。
 * - 純函式無副作用，絕不在 event 物件上寫入 absorbedBySkillCast 暫態標記。
 */
export function collectCombatActions(events: readonly CombatEvent[]): Array<CombatAction | CombatEvent> {
  const result: Array<CombatAction | CombatEvent> = [];
  let currentAction: CombatAction | null = null;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    // 🎯 依據規格 §8.2: DEATH、TURN_START、TURN_END、END、SQUAD_CHANGE 或無 actionId 之獨立事件為 Barrier
    const isBarrier =
      ev.type === CombatEventType.DEATH ||
      ev.type === CombatEventType.TURN_START ||
      ev.type === CombatEventType.TURN_END ||
      ev.type === CombatEventType.END ||
      ev.type === CombatEventType.SQUAD_CHANGE ||
      !ev.actionId;

    if (isBarrier) {
      currentAction = null; // 中斷連續 span
      result.push(ev);
      continue;
    }

    const actionId = ev.actionId!;

    // 若當前正在聚合的 Action 處於同一連續 span，則聚合之
    if (currentAction && currentAction.actionId === actionId) {
      currentAction.events.push(ev);
      if (!currentAction.actorId && ev.actorId) currentAction.actorId = ev.actorId;
      if (!currentAction.skillId && ev.skillId) currentAction.skillId = ev.skillId;
      if (!currentAction.vfxId && ev.vfxId) currentAction.vfxId = ev.vfxId;
    } else {
      // 否則（包含被 barrier 中斷後再次出現相同 actionId），建立新的獨立播放 segment
      const newAction: CombatAction = {
        actionId,
        actorId: ev.actorId || '',
        skillId: ev.skillId,
        vfxId: ev.vfxId,
        events: [ev]
      };
      currentAction = newAction;
      result.push(newAction);
    }
  }

  return result;
}

/**
 * 🔍 即時戰鬥特效偵錯資訊 (Debug Overlay Info)
 */
export interface CombatActionDebugInfo {
  actionId: string;
  actorId: string;
  vfxId: string;
  targetId?: string;
  activeCueId?: string;
  activeCueIndex?: number;
  isFallback: boolean;
  isDegraded?: boolean;
  impactCount: number;
}

export interface MapImpactsContext {
  actionId?: string;
  skillId?: string;
  vfxId?: string;
  actorId?: string;
  primaryTargetId?: string;
  presentationMode?: ImpactPresentationMode;
  cueMap?: Record<string, string>;
  onDegraded?: (info: { actionId?: string; skillId?: string; vfxId?: string; targetId: string; impactCount: number; cueCount: number }) => void;
}

function impactKindToCueKind(kind: CombatImpactPresentation['kind']): VFXCueKind {
  if (kind === 'HEAL') return 'HEAL';
  if (kind === 'SHIELD_DAMAGE' || kind === 'SHIELD_BREAK') return 'SHIELD';
  if (kind === 'STATUS') return 'STATUS';
  if (kind === 'VISUAL_ONLY') return 'VISUAL_ONLY';
  return 'IMPACT';
}

/**
 * 🎯 mapImpactsToCues
 * 核心純函式：將戰鬥已結算事件精確配對至視覺時間軸 Cue
 * 嚴格遵循 docs/VFX_STUDIO_GEMINI_REFACTOR_IMPLEMENTATION.md §3 規範：
 * - 任何模式皆不得篡改已結算之傷害/治療總值。
 * - VISUAL_ONLY Cue 不造成傷害 (amount = 0)，純粹視覺反饋。
 * - targetPolicy (PRIMARY_TARGET, EACH_TARGET, CASTER) 必須真實執行過濾。
 * - SHIELD_BREAK 作為正式 Impact 處理。
 * - SPLIT_SINGLE_IMPACT: 依各 cue.weight 進行整數安全切分，餘數歸於終擊/主 Cue，總和精確等於原始 amount。
 * - EXACT_IMPACTS: N 筆 Impact 依序對應 N 個相容 Cue，多出之 Cue 視為純視覺。
 * - PRIMARY_ONLY: 僅在 isPrimary Cue 呈現原始 amount，其餘 Cue 觸發純視覺反饋。
 */
export function cueAcceptsImpact(cueKind: VFXCueKind = 'IMPACT', impactKind: CombatImpactKind): boolean {
  if (cueKind === 'VISUAL_ONLY') return false;
  if (cueKind === 'HEAL') return impactKind === 'HEAL';
  if (cueKind === 'SHIELD') {
    return impactKind === 'SHIELD_DAMAGE' || impactKind === 'SHIELD_BREAK';
  }
  if (cueKind === 'STATUS') return impactKind === 'STATUS';
  return impactKind === 'DAMAGE' || impactKind === 'MISS';
}

export function mapImpactsToCues(
  events: readonly CombatEvent[],
  cues: readonly VFXImpactCue[] = [],
  contextOrMode: MapImpactsContext | ImpactPresentationMode = 'EXACT_IMPACTS'
): CombatImpactPresentation[] {
  const ctx: MapImpactsContext = typeof contextOrMode === 'string'
    ? { presentationMode: contextOrMode, actorId: events[0]?.actorId || '' }
    : (contextOrMode || { presentationMode: 'EXACT_IMPACTS' });

  const mode = ctx.presentationMode || 'EXACT_IMPACTS';

  function resolveEventKind(ev: CombatEvent): 'DAMAGE' | 'HEAL' | 'SHIELD_DAMAGE' | 'SHIELD_BREAK' | 'STATUS' | 'MISS' {
    if (ev.type === CombatEventType.HEAL) return 'HEAL';
    if (ev.type === CombatEventType.SHIELD_DAMAGE) return 'SHIELD_DAMAGE';
    if (ev.type === CombatEventType.SHIELD_BREAK) return 'SHIELD_BREAK';
    if (ev.type === CombatEventType.STATUS_APPLY || ev.type === CombatEventType.STATUS_DAMAGE) return 'STATUS';
    if (ev.type === CombatEventType.MISS) return 'MISS';
    return 'DAMAGE';
  }

  function resolveCueVisualTargetId(
    cue: VFXImpactCue,
    actorId: string,
    primaryTargetId: string,
    logicalTargetId: string
  ): string {
    const policy = cue.targetPolicy ?? 'PRIMARY_TARGET';
    switch (policy) {
      case 'CASTER':
        return actorId || logicalTargetId;
      case 'EACH_TARGET':
        return logicalTargetId;
      case 'PRIMARY_TARGET':
      default:
        return primaryTargetId || logicalTargetId;
    }
  }

  // 篩選有效結算事件 (HIT, CRIT, HEAL, SHIELD_DAMAGE, SHIELD_BREAK, STATUS_APPLY, STATUS_DAMAGE, MISS)
  const impactEvents = events.filter(e =>
    e.type === CombatEventType.HIT ||
    e.type === CombatEventType.CRIT ||
    e.type === CombatEventType.HEAL ||
    e.type === CombatEventType.SHIELD_DAMAGE ||
    e.type === CombatEventType.SHIELD_BREAK ||
    e.type === CombatEventType.STATUS_APPLY ||
    e.type === CombatEventType.STATUS_DAMAGE ||
    e.type === CombatEventType.MISS
  );

  if (impactEvents.length === 0) return [];

  // 不偽造通用 IMPACT Cue；沒有 authored Cue 時，依每筆真實 impact kind 建立 runtime fallback。
  const effectiveCues: VFXImpactCue[] = [...cues];

  const actualImpactTargetIds = [...new Set(impactEvents.map(e => e.targetId).filter((id): id is string => !!id))];
  const primaryTargetId = ctx.primaryTargetId || actualImpactTargetIds[0] || '';
  const actorId = ctx.actorId || events[0]?.actorId || '';

  // 依目標整理所有真實結算事件
  const targetEventsMap = new Map<string, CombatEvent[]>();
  impactEvents.forEach(ev => {
    const tid = ev.targetId || 'UNKNOWN';
    if (!targetEventsMap.has(tid)) targetEventsMap.set(tid, []);
    targetEventsMap.get(tid)!.push(ev);
  });

  const allResults: CombatImpactPresentation[] = [];
  let nextFallbackCueIndex = effectiveCues.length;

  const getMappedCueId = (event: CombatEvent, eventIndex: number): string | undefined => {
    if (!ctx.cueMap) return undefined;
    const keys = [
      event.cueId,
      event.impactIndex !== undefined ? `${event.targetId ?? ''}:${event.impactIndex}` : undefined,
      event.impactIndex !== undefined ? String(event.impactIndex) : undefined,
      String(eventIndex)
    ].filter((key): key is string => key !== undefined);
    for (const key of keys) {
      const mapped = ctx.cueMap[key];
      if (mapped) return mapped;
    }
    return undefined;
  };

  const createFallbackCue = (
    impactKind: CombatImpactPresentation['kind'],
    fallbackIndex: number
  ): VFXImpactCue => {
    const lastAuthoredTime = effectiveCues.reduce((max, cue) => Math.max(max, cue.time), 0);
    return {
      cueId: `CUE_FALLBACK_${fallbackIndex}`,
      time: Math.max(0.05, lastAuthoredTime + (fallbackIndex + 1) * 0.1),
      weight: 1,
      isPrimary: true,
      kind: impactKindToCueKind(impactKind)
    };
  };

  // 🎯 情況 1：若有專屬 CASTER Cue，且施法者自身沒有被列入傷害結算事件中，為施法者建立 VISUAL_ONLY presentation
  const casterCues = effectiveCues
    .map((c, originalIndex) => ({ cue: c, originalIndex }))
    .filter(item => item.cue.targetPolicy === 'CASTER');

  if (casterCues.length > 0 && actorId && !actualImpactTargetIds.includes(actorId)) {
    casterCues.forEach(item => {
      allResults.push({
        cueIndex: item.originalIndex,
        cueId: item.cue.cueId,
        cueTime: item.cue.time,
        targetId: actorId,
        visualTargetId: actorId,
        amount: 0,
        kind: 'VISUAL_ONLY',
        isCrit: false,
        isPrimary: false,
        targetPolicy: item.cue.targetPolicy
      });
    });
  }

  // 🎯 情況 2：遍歷所有實際受擊目標，確保 100% 呈現，絕不因 targetPolicy 是 PRIMARY_TARGET 或 CASTER 丟棄真實 impact
  actualImpactTargetIds.forEach(targetId => {
    const targetEvents = targetEventsMap.get(targetId) || [];
    if (targetEvents.length === 0) return;

    const targetResults: CombatImpactPresentation[] = [];
    const targetCuesWithIndices = effectiveCues.map((c, originalIndex) => ({ cue: c, originalIndex }));

    // 情況 A：多筆真實事件 -> cueMap 優先，其次依 kind compatibility 對齊。
    if (targetEvents.length > 1) {
      const assignedEvents = new Map<number, CombatEvent>();
      const usedCueIndices = new Set<number>();
      const fallbackItems: Array<{ cue: VFXImpactCue; originalIndex: number }> = [];

      targetEvents.forEach((event, eventIndex) => {
        const impactKind = resolveEventKind(event);
        const mappedCueId = getMappedCueId(event, eventIndex);
        let selected = mappedCueId
          ? targetCuesWithIndices.find(item =>
              !usedCueIndices.has(item.originalIndex) &&
              item.cue.cueId === mappedCueId &&
              cueAcceptsImpact(item.cue.kind, impactKind)
            )
          : undefined;

        if (!selected) {
          selected = targetCuesWithIndices.find(item =>
            !usedCueIndices.has(item.originalIndex) &&
            cueAcceptsImpact(item.cue.kind, impactKind)
          );
        }

        if (selected) {
          usedCueIndices.add(selected.originalIndex);
          assignedEvents.set(selected.originalIndex, event);
          return;
        }

        const originalIndex = nextFallbackCueIndex++;
        const fallbackIndex = originalIndex - effectiveCues.length;
        const cue = createFallbackCue(impactKind, fallbackIndex);
        fallbackItems.push({ cue, originalIndex });
        assignedEvents.set(originalIndex, event);
      });

      if (fallbackItems.length > 0) {
        console.warn(
          `[CombatActionPlayer] Compatible cue count (${targetEvents.length - fallbackItems.length}) insufficient for real impacts (${targetEvents.length}). ` +
          `actionId=${ctx.actionId || 'N/A'}, skillId=${ctx.skillId || 'N/A'}, vfxId=${ctx.vfxId || 'N/A'}, targetId=${targetId}`
        );
        if (ctx.onDegraded) {
          ctx.onDegraded({
            actionId: ctx.actionId,
            skillId: ctx.skillId,
            vfxId: ctx.vfxId,
            targetId,
            impactCount: targetEvents.length,
            cueCount: targetEvents.length - fallbackItems.length
          });
        }
      }

      const alignedItems = [...targetCuesWithIndices, ...fallbackItems]
        .sort((a, b) => a.cue.time - b.cue.time || a.originalIndex - b.originalIndex);
      alignedItems.forEach((item) => {
        const { cue, originalIndex } = item;
        const visualTargetId = resolveCueVisualTargetId(cue, actorId, primaryTargetId, targetId);
        const ev = assignedEvents.get(originalIndex);

        if (!ev) {
          targetResults.push({
            cueIndex: originalIndex,
            cueId: cue.cueId,
            cueTime: cue.time,
            targetId,
            visualTargetId,
            amount: 0,
            kind: 'VISUAL_ONLY',
            isCrit: false,
            isPrimary: false,
            targetPolicy: cue.targetPolicy
          });
          return;
        }

        const kind = resolveEventKind(ev);
        const amount = resolveImpactAmount(ev, kind);

        targetResults.push({
          cueIndex: originalIndex,
          cueId: cue.cueId,
          cueTime: cue.time,
          targetId,
          visualTargetId,
          amount,
          kind,
          isCrit: ev.type === CombatEventType.CRIT,
          isPrimary: cue.isPrimary || originalIndex === alignedItems[alignedItems.length - 1].originalIndex,
          targetHp: ev.targetHp,
          targetMaxHp: ev.targetMaxHp,
          targetPolicy: cue.targetPolicy,
          shieldDamage: ev.shieldDamage,
          shieldRemaining: ev.shieldRemaining,
          text: ev.text,
          statusType: ev.statusType,
          skillName: ev.skillName
        });
      });
    }
    // 情況 B：單筆真實事件
    else {
      const singleEv = targetEvents[0];
      const kind = resolveEventKind(singleEv);
      const totalAmount = resolveImpactAmount(singleEv, kind);
      const isCrit = singleEv.type === CombatEventType.CRIT;

      // 只允許 kind-compatible Cue 承載數值；不相容 Cue 保持純視覺。
      let damageableItems = targetCuesWithIndices.filter(item => cueAcceptsImpact(item.cue.kind, kind));

      const mappedCueId = getMappedCueId(singleEv, 0);
      if (mappedCueId) {
        const mappedItem = damageableItems.find(item => item.cue.cueId === mappedCueId);
        damageableItems = mappedItem ? [mappedItem] : [];
      }

      if (damageableItems.length === 0) {
        const originalIndex = nextFallbackCueIndex++;
        const fallbackCue = createFallbackCue(kind, originalIndex - effectiveCues.length);
        damageableItems = [{ cue: fallbackCue, originalIndex }];
        targetCuesWithIndices.push(damageableItems[0]);
        console.warn(
          `[CombatActionPlayer] No compatible cue for ${kind}; created runtime fallback. ` +
          `actionId=${ctx.actionId || 'N/A'}, skillId=${ctx.skillId || 'N/A'}, vfxId=${ctx.vfxId || 'N/A'}, targetId=${targetId}`
        );
        ctx.onDegraded?.({
          actionId: ctx.actionId,
          skillId: ctx.skillId,
          vfxId: ctx.vfxId,
          targetId,
          impactCount: 1,
          cueCount: 0
        });
      }

      if (mode === 'PRIMARY_ONLY') {
        const primaryItem = damageableItems.find(item => item.cue.isPrimary) || damageableItems[damageableItems.length - 1];

        targetCuesWithIndices.forEach(item => {
          const isPri = item.originalIndex === primaryItem.originalIndex;
          const visualTargetId = resolveCueVisualTargetId(item.cue, actorId, primaryTargetId, targetId);
          targetResults.push({
            cueIndex: item.originalIndex,
            cueId: item.cue.cueId,
            cueTime: item.cue.time,
            targetId,
            visualTargetId,
            amount: isPri ? totalAmount : 0,
            kind: isPri ? kind : 'VISUAL_ONLY',
            isCrit: isPri && isCrit,
            isPrimary: isPri,
            targetHp: isPri ? singleEv.targetHp : undefined,
            targetMaxHp: singleEv.targetMaxHp,
            targetPolicy: item.cue.targetPolicy,
            shieldDamage: isPri ? singleEv.shieldDamage : undefined,
            shieldRemaining: isPri ? singleEv.shieldRemaining : undefined,
            text: isPri ? singleEv.text : undefined,
            statusType: isPri ? singleEv.statusType : undefined,
            skillName: singleEv.skillName
          });
        });
      } else if (mode === 'SPLIT_SINGLE_IMPACT' && damageableItems.length > 1 && totalAmount > 0) {
        // 🎯 依各 weight 權重進行整數安全切分，weight <= 0 視為不可承載數值
        const validWeightItems = damageableItems.filter(item => (item.cue.weight ?? 1.0) > 0);
        const totalWeight = validWeightItems.reduce((sum, item) => sum + (item.cue.weight ?? 1.0), 0);

        let allocatedTotal = 0;
        const sliceMap = new Map<number, number>();

        if (totalWeight > 0 && validWeightItems.length > 0) {
          validWeightItems.forEach((item, dIdx) => {
            const isLast = dIdx === validWeightItems.length - 1;
            if (isLast) {
              const remainder = totalAmount - allocatedTotal;
              sliceMap.set(item.originalIndex, remainder);
            } else {
              const w = item.cue.weight ?? 1.0;
              const slice = Math.floor(totalAmount * (w / totalWeight));
              allocatedTotal += slice;
              sliceMap.set(item.originalIndex, slice);
            }
          });
        }

        const finalDamageable = damageableItems[damageableItems.length - 1];

        targetCuesWithIndices.forEach(item => {
          const visualTargetId = resolveCueVisualTargetId(item.cue, actorId, primaryTargetId, targetId);
          if (sliceMap.has(item.originalIndex)) {
            const sliceAmount = sliceMap.get(item.originalIndex)!;
            const isFinalSlice = item.originalIndex === finalDamageable.originalIndex;
            targetResults.push({
              cueIndex: item.originalIndex,
              cueId: item.cue.cueId,
              cueTime: item.cue.time,
              targetId,
              visualTargetId,
              amount: sliceAmount,
              kind,
              isCrit: isFinalSlice && isCrit,
              isPrimary: item.cue.isPrimary || isFinalSlice,
              targetHp: isFinalSlice ? singleEv.targetHp : undefined,
              targetMaxHp: singleEv.targetMaxHp,
              targetPolicy: item.cue.targetPolicy,
              shieldDamage: isFinalSlice ? singleEv.shieldDamage : undefined,
              shieldRemaining: isFinalSlice ? singleEv.shieldRemaining : undefined,
              text: isFinalSlice ? singleEv.text : undefined,
              statusType: isFinalSlice ? singleEv.statusType : undefined,
              skillName: singleEv.skillName
            });
          } else {
            targetResults.push({
              cueIndex: item.originalIndex,
              cueId: item.cue.cueId,
              cueTime: item.cue.time,
              targetId,
              visualTargetId,
              amount: 0,
              kind: 'VISUAL_ONLY',
              isCrit: false,
              isPrimary: false,
              targetPolicy: item.cue.targetPolicy
            });
          }
        });
      } else {
        // EXACT_IMPACTS 預設：單筆事件直接於第一個有效 Cue (或 Primary Cue) 呈現完整數值
        const primaryOrFirst = damageableItems.find(i => i.cue.isPrimary) || damageableItems[0];
        targetCuesWithIndices.forEach(item => {
          const isTargetCue = item.originalIndex === primaryOrFirst.originalIndex;
          const visualTargetId = resolveCueVisualTargetId(item.cue, actorId, primaryTargetId, targetId);
          targetResults.push({
            cueIndex: item.originalIndex,
            cueId: item.cue.cueId,
            cueTime: item.cue.time,
            targetId,
            visualTargetId,
            amount: isTargetCue ? totalAmount : 0,
            kind: isTargetCue ? kind : 'VISUAL_ONLY',
            isCrit: isTargetCue && isCrit,
            isPrimary: item.cue.isPrimary || isTargetCue,
            targetHp: isTargetCue ? singleEv.targetHp : undefined,
            targetMaxHp: singleEv.targetMaxHp,
            targetPolicy: item.cue.targetPolicy,
            shieldDamage: isTargetCue ? singleEv.shieldDamage : undefined,
            shieldRemaining: isTargetCue ? singleEv.shieldRemaining : undefined,
            text: isTargetCue ? singleEv.text : undefined,
            statusType: isTargetCue ? singleEv.statusType : undefined,
            skillName: singleEv.skillName
          });
        });
      }
    }

    // 填寫 per-target presentation 索引與總數
    targetResults.forEach((resItem, resIdx) => {
      resItem.presentationIndex = resIdx;
      resItem.presentationCount = targetResults.length;
      resItem.cueCount = targetCuesWithIndices.length;
    });

    allResults.push(...targetResults);
  });

  return allResults;
}

/**
 * 將 mapping 階段建立的 fallback Cue 併入本次播放用 Sequence。
 * 只建立 ephemeral copy，不寫回 Repository，讓所有 Cue 共用 Engine 的 PlaybackClock。
 */
export function buildRuntimeSequence(
  sequence: VFXSequence,
  presentations: readonly CombatImpactPresentation[]
): VFXSequence {
  const runtimeCues = [...(sequence.impactCues || [])];
  const byIndex = new Map<number, CombatImpactPresentation>();
  presentations.forEach(item => {
    if (!byIndex.has(item.cueIndex)) byIndex.set(item.cueIndex, item);
  });

  [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([cueIndex, item]) => {
      if (runtimeCues[cueIndex]) return;
      runtimeCues[cueIndex] = {
        cueId: item.cueId,
        time: item.cueTime,
        kind: impactKindToCueKind(item.kind),
        isPrimary: item.isPrimary,
        targetPolicy: item.targetPolicy
      };
    });

  const compactCues = runtimeCues.filter((cue): cue is VFXImpactCue => !!cue);
  const finalCueTime = compactCues.reduce((max, cue) => Math.max(max, cue.time), 0);
  return {
    ...sequence,
    duration: Math.max(sequence.duration, finalCueTime + 0.05),
    impactCues: compactCues
  };
}

/**
 * 🎯 CombatActionPlayer
 * 一次性技能完整播放器 (Single Action VFX Pipeline Player)
 * 職責：
 * 1. 一個 Action 僅呼叫一次 VFXPlayer.play()。
 * 2. 調度 impacts 與 cues 映射。
 * 3. 支援 Promise await、pause、resume、speed 及取消。
 * 4. 內建 Debug Overlay 即時視覺化三端狀態。
 */
export class CombatActionPlayer {
  private fxEngine: Pick<CombatFXEngine, 'playSequence'>;
  private presetRepo: Pick<VFXPresetRepository, 'getSequence'>;

  private static debugOverlayEnabled: boolean = false;
  private static debugOverlayEl: HTMLElement | null = null;

  constructor(
    fxEngine: Pick<CombatFXEngine, 'playSequence'> = CombatFXEngine.getInstance(),
    presetRepo: Pick<VFXPresetRepository, 'getSequence'> = VFXPresetRepository.getInstance()
  ) {
    this.fxEngine = fxEngine;
    this.presetRepo = presetRepo;
  }

  public static setDebugOverlayEnabled(enabled: boolean): void {
    CombatActionPlayer.debugOverlayEnabled = enabled;
    if (!enabled && CombatActionPlayer.debugOverlayEl) {
      CombatActionPlayer.debugOverlayEl.style.display = 'none';
    }
  }

  public static isDebugOverlayEnabled(): boolean {
    return CombatActionPlayer.debugOverlayEnabled;
  }

  private updateDebugOverlay(info: CombatActionDebugInfo): void {
    if (!CombatActionPlayer.debugOverlayEnabled && typeof document !== 'undefined' && !document.getElementById('vfx-debug-overlay')) {
      return;
    }
    if (typeof document === 'undefined') return;

    let el = document.getElementById('vfx-debug-overlay');
    if (!el && CombatActionPlayer.debugOverlayEnabled) {
      el = document.createElement('div');
      el.id = 'vfx-debug-overlay';
      el.style.position = 'fixed';
      el.style.bottom = '12px';
      el.style.right = '12px';
      el.style.zIndex = '99999';
      el.style.padding = '8px 12px';
      el.style.background = 'rgba(15, 23, 42, 0.88)';
      el.style.border = '1px solid #38bdf8';
      el.style.borderRadius = '6px';
      el.style.color = '#f8fafc';
      el.style.fontFamily = 'monospace';
      el.style.fontSize = '12px';
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
      el.style.pointerEvents = 'none';
      document.body.appendChild(el);
      CombatActionPlayer.debugOverlayEl = el;
    }

    if (el) {
      el.style.display = 'block';
      const statusBadge = info.isFallback
        ? '<span style="color:#ef4444;font-weight:bold;">⚠️ FALLBACK</span>'
        : (info.isDegraded
          ? '<span style="color:#f59e0b;font-weight:bold;">⚠️ DEGRADED</span>'
          : '<span style="color:#10b981;font-weight:bold;">🟢 ACTION</span>');
      el.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:4px;">
          ${statusBadge}
          <span style="color:#94a3b8;">${info.actionId}</span>
        </div>
        <div><b>Actor:</b> <span style="color:#fbbf24;">${info.actorId || 'N/A'}</span> ➔ <b>Target:</b> <span style="color:#f43f5e;">${info.targetId || 'N/A'}</span></div>
        <div><b>VFX:</b> <span style="color:#38bdf8;">${info.vfxId}</span></div>
        <div><b>Cue:</b> <span style="color:#a855f7;">${info.activeCueId || 'NONE'} (${info.activeCueIndex ?? -1})</span> | <b>Impacts:</b> ${info.impactCount}</div>
      `;
    }
  }

  public static clearDebugOverlay(immediate: boolean = false): void {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('vfx-debug-overlay');
    if (!el) return;
    if (immediate) {
      el.innerHTML = '<span style="color:#64748b;">💤 IDLE</span>';
    } else {
      setTimeout(() => {
        if (el && (el.innerHTML.includes('ACTION') || el.innerHTML.includes('FALLBACK') || el.innerHTML.includes('DEGRADED'))) {
          el.innerHTML = '<span style="color:#64748b;">💤 IDLE</span>';
        }
      }, 400);
    }
  }

  private clearDebugOverlay(): void {
    CombatActionPlayer.clearDebugOverlay(false);
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
      resolveVisualPoint?: (targetId: string) => ScreenPoint | undefined;
      onPresentImpact?: (item: CombatImpactPresentation, cue?: VFXImpactCue) => void;
      onActionComplete?: () => void;
    }
  ): Promise<void> {
    const vfxId = action.vfxId || 'VFX_DEFAULT_SLASH';
    const sequence = this.presetRepo.getSequence(vfxId);
    const mainTargetId = resolveActionMainTargetId(action);

    this.updateDebugOverlay({
      actionId: action.actionId,
      actorId: action.actorId,
      vfxId,
      targetId: mainTargetId,
      isFallback: options.skipVfx || !sequence,
      impactCount: 0
    });

    const binding = action.skillId ? SkillVfxBindingRegistry.getInstance().getBinding(action.skillId) : undefined;
    const resolvedMode: ImpactPresentationMode =
      binding?.impactPresentationMode ||
      action.presentationMode ||
      sequence?.impactPresentationMode ||
      'EXACT_IMPACTS';
    const resolvedCueMap = binding?.cueMap || action.cueMap;

    let isDegradedAction = false;
    const mapContext: MapImpactsContext = {
      actionId: action.actionId,
      skillId: action.skillId,
      vfxId,
      actorId: action.actorId,
      primaryTargetId: mainTargetId,
      presentationMode: resolvedMode,
      cueMap: resolvedCueMap,
      onDegraded: () => {
        isDegradedAction = true;
        this.updateDebugOverlay({
          actionId: action.actionId,
          actorId: action.actorId,
          vfxId,
          targetId: mainTargetId,
          isFallback: options.skipVfx || !sequence,
          isDegraded: true,
          impactCount: 0
        });
      }
    };

    // 若 skipVfx 或找不到 sequence，直接無特效結算所有呈現項目 (規格 §4.3: 統一使用 shouldPresentImpact)
    if (options?.skipVfx || !sequence) {
      const items = mapImpactsToCues(action.events, sequence?.impactCues || [], mapContext);
      const activeItems = items.filter(i => shouldPresentImpact(i));
      activeItems.forEach(item => {
        options?.onPresentImpact?.(item);
      });
      this.clearDebugOverlay();
      options?.onActionComplete?.();
      return;
    }

    // 計算各目標之呈現項目
    const presentationItems = mapImpactsToCues(
      action.events,
      sequence.impactCues || [],
      mapContext
    );
    const runtimeSequence = buildRuntimeSequence(sequence, presentationItems);

    // 依 cueIndex 建立查找表
    const cueMap = new Map<number, CombatImpactPresentation[]>();
    const cueIdMap = new Map<string, CombatImpactPresentation[]>();
    presentationItems.forEach(item => {
      if (!cueMap.has(item.cueIndex)) cueMap.set(item.cueIndex, []);
      cueMap.get(item.cueIndex)!.push(item);
      if (!cueIdMap.has(item.cueId)) cueIdMap.set(item.cueId, []);
      cueIdMap.get(item.cueId)!.push(item);
    });

    // 呼叫底層 3D FX 引擎，精確播放一次 Canonical Sequence！
    // 🛡️ 遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 11 節驗收標準：
    // 「WebGL 失敗戰鬥仍完成」— 當 WebGL 崩潰、上下文丟失或 Shader 編譯失敗時，絕不得中斷戰鬥！
    const dispatchedItems = new Set<CombatImpactPresentation>();
    let triggeredImpactCount = 0;

    try {
      await this.fxEngine.playSequence(
        runtimeSequence,
        options.fromPoint,
        options.toPoint,
        (_impact: VFXImpactConfig, hitIdx: number, _totalHits: number, cue?: VFXImpactCue) => {
          triggeredImpactCount++;
          this.updateDebugOverlay({
            actionId: action.actionId,
            actorId: action.actorId,
            vfxId,
            targetId: mainTargetId,
            activeCueId: cue?.cueId || `CUE_${hitIdx}`,
            activeCueIndex: hitIdx,
            isFallback: false,
            isDegraded: isDegradedAction,
            impactCount: triggeredImpactCount
          });

          // 當時間軸觸發特定 Cue 時，分發已配對之呈現項目
          const matchedItems = (cue ? cueIdMap.get(cue.cueId) : undefined) || cueMap.get(hitIdx) || [];
          if (matchedItems.length > 0) {
            matchedItems.forEach(item => {
              dispatchedItems.add(item);
              options.onPresentImpact?.(item, cue);
            });
          } else {
            // 若無數值項目，依 Cue 本身類型給予打擊或光環反饋，嚴禁虛構 DAMAGE
            const fallbackKind = cue?.kind === 'HEAL'
              ? 'HEAL'
              : (cue?.kind === 'SHIELD'
                ? 'SHIELD_DAMAGE'
                : (cue?.kind === 'STATUS' ? 'STATUS' : 'VISUAL_ONLY'));
            options.onPresentImpact?.({
              cueIndex: hitIdx,
              cueId: cue?.cueId || `CUE_${hitIdx}`,
              cueTime: cue?.time ?? 0,
              targetId: '',
              amount: 0,
              kind: fallbackKind,
              isCrit: false,
              isPrimary: cue?.isPrimary ?? false
            }, cue);
          }
        },
        undefined,
        options.resolveVisualPoint
          ? (_cue, cueIndex) => {
              const ids = (cueIdMap.get(_cue.cueId) || cueMap.get(cueIndex) || [])
                .map(item => item.visualTargetId || item.targetId)
                .filter((id, index, all) => !!id && all.indexOf(id) === index);
              return ids
                .map(id => options.resolveVisualPoint?.(id))
                .filter((point): point is ScreenPoint => !!point);
            }
          : undefined
      );
    } catch (renderError) {
      console.warn('[CombatActionPlayer] WebGL or VFX rendering failed, executing safe logical impact fallback:', renderError);
      this.updateDebugOverlay({
        actionId: action.actionId,
        actorId: action.actorId,
        vfxId,
        targetId: mainTargetId,
        isFallback: true,
        impactCount: triggeredImpactCount
      });

      // 安全容錯派發：確保所有有效數值與狀態呈現項目 100% 傳遞至 UI，使用統一 shouldPresentImpact
      const activeItems = presentationItems.filter(i => shouldPresentImpact(i));
      activeItems.forEach(item => {
        if (!dispatchedItems.has(item)) {
          dispatchedItems.add(item);
          options.onPresentImpact?.(item);
        }
      });
    } finally {
      this.clearDebugOverlay();
      // 永遠保證戰鬥行動完成回調被觸發，消除卡死隱患
      options.onActionComplete?.();
    }
  }
}

if (typeof window !== 'undefined') {
  (window as any).CombatActionPlayer = CombatActionPlayer;
}
