import { CombatEvent, CombatEventType } from '../../models/Combat';
import { ImpactPresentationMode, VFXImpactConfig, VFXImpactCue, VFXPreset } from '../../models/VFX';
import { CombatFXEngine, ScreenPoint } from './CombatFXEngine';
import { VFXPresetRepository } from './VFXPresetRepository';

/**
 * 🎯 CombatImpactPresentation
 * 已解析之打擊/Cue 呈現項目 (Immutable Presentation Item)
 * 禁止 StageAdapter 額外計算 damage * weight 或 damage / count 等二度計算
 */
export interface CombatImpactPresentation {
  cueIndex: number;
  cueId: string;
  targetId: string;
  amount: number;
  kind: 'DAMAGE' | 'HEAL' | 'SHIELD_DAMAGE' | 'STATUS' | 'MISS' | 'VISUAL_ONLY';
  isCrit: boolean;
  isPrimary: boolean;
  targetHp?: number;
  targetMaxHp?: number;
  targetPolicy?: 'PRIMARY_TARGET' | 'EACH_TARGET' | 'CASTER';
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
  events: CombatEvent[];
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
  impactCount: number;
}

/**
 * 🎯 mapImpactsToCues
 * 核心純函式：將戰鬥已結算事件精確配對至視覺時間軸 Cue
 * 嚴格遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 8 節與第 11 節規範：
 * - 任何模式皆不得篡改已結算之傷害/治療總值。
 * - VISUAL_ONLY Cue 不造成傷害 (amount = 0)，純粹視覺反饋。
 * - SPLIT_SINGLE_IMPACT: 嚴格依各 cue.weight 進行整數安全切分，餘數歸於終擊段，各段總和 100% 等於原始 amount。
 * - EXACT_IMPACTS: N 筆 Impact 依序對應 N 個 Cue，多出之 Cue 視為純視覺呈現。
 * - PRIMARY_ONLY: 僅在 isPrimary Cue 呈現原始 amount，其餘 Cue 觸發純視覺反饋。
 * - 目標隔離：多目標事件依 targetId 隔離，絕不跨目標加總。
 */
export function mapImpactsToCues(
  events: CombatEvent[],
  cues: VFXImpactCue[] = [],
  mode: ImpactPresentationMode = 'EXACT_IMPACTS'
): CombatImpactPresentation[] {
  function resolveEventKind(ev: CombatEvent): 'DAMAGE' | 'HEAL' | 'SHIELD_DAMAGE' | 'STATUS' | 'MISS' {
    if (ev.type === CombatEventType.HEAL) return 'HEAL';
    if (ev.type === CombatEventType.SHIELD_DAMAGE) return 'SHIELD_DAMAGE';
    if (ev.type === CombatEventType.STATUS_APPLY) return 'STATUS';
    if (ev.type === CombatEventType.MISS) return 'MISS';
    return 'DAMAGE';
  }

  // 篩選有效結算事件 (HIT, CRIT, HEAL, SHIELD_DAMAGE, STATUS_APPLY, MISS)
  const impactEvents = events.filter(e =>
    e.type === CombatEventType.HIT ||
    e.type === CombatEventType.CRIT ||
    e.type === CombatEventType.HEAL ||
    e.type === CombatEventType.SHIELD_DAMAGE ||
    e.type === CombatEventType.STATUS_APPLY ||
    e.type === CombatEventType.MISS
  );

  if (impactEvents.length === 0) return [];

  // 若預設未定義 Cues，建立單一 Fallback Cue
  const effectiveCues: VFXImpactCue[] = cues.length > 0
    ? cues
    : [{ cueId: 'CUE_DEFAULT', time: 0.15, weight: 1.0, isPrimary: true, kind: 'IMPACT' }];

  const results: CombatImpactPresentation[] = [];

  // 依 targetId 分組進行目標隔離處理
  const targetMap = new Map<string, CombatEvent[]>();
  impactEvents.forEach(ev => {
    const tid = ev.targetId || 'UNKNOWN';
    if (!targetMap.has(tid)) targetMap.set(tid, []);
    targetMap.get(tid)!.push(ev);
  });

  targetMap.forEach((targetEvents, targetId) => {
    // 1. 若事件本身即有多段真實傷害 (多筆 HIT/CRIT/STATUS 事件)，一律採 EXACT 對齊
    if (targetEvents.length > 1) {
      const alignedCues = [...effectiveCues];
      if (alignedCues.length < targetEvents.length) {
        console.warn(`[CombatActionPlayer] Cue count (${alignedCues.length}) insufficient for real impacts (${targetEvents.length}). Expanding runtime fallback cues.`);
        while (alignedCues.length < targetEvents.length) {
          const newIdx = alignedCues.length;
          alignedCues.push({
            cueId: `CUE_FALLBACK_${newIdx}`,
            time: 0.15 + newIdx * 0.1,
            weight: 1.0,
            isPrimary: newIdx === targetEvents.length - 1,
            kind: 'IMPACT'
          });
        }
      }

      let eventIdx = 0;
      alignedCues.forEach((cue, cIdx) => {
        if (cue.kind === 'VISUAL_ONLY' || eventIdx >= targetEvents.length) {
          // 純視覺或已耗盡事件
          results.push({
            cueIndex: cIdx,
            cueId: cue.cueId,
            targetId,
            amount: 0,
            kind: 'VISUAL_ONLY',
            isCrit: false,
            isPrimary: false,
            targetPolicy: cue.targetPolicy
          });
          return;
        }

        const ev = targetEvents[eventIdx++];
        const kind = resolveEventKind(ev);
        results.push({
          cueIndex: cIdx,
          cueId: cue.cueId,
          targetId,
          amount: kind === 'STATUS' ? 0 : (ev.damage || ev.healAmount || 0),
          kind,
          isCrit: ev.type === CombatEventType.CRIT,
          isPrimary: cue.isPrimary || eventIdx === targetEvents.length,
          targetHp: ev.targetHp,
          targetMaxHp: ev.targetMaxHp,
          targetPolicy: cue.targetPolicy
        });
      });
      return;
    }

    // 2. 該目標僅有單筆已結算事件
    const singleEv = targetEvents[0];
    const kind = resolveEventKind(singleEv);
    const totalAmount = kind === 'STATUS' ? 0 : (singleEv.damage || singleEv.healAmount || 0);
    const isCrit = singleEv.type === CombatEventType.CRIT;

    // 隔離出具備數值承載能力之 Cues (排除 VISUAL_ONLY)
    const damageableIndices = effectiveCues
      .map((c, idx) => ({ cue: c, idx }))
      .filter(item => item.cue.kind !== 'VISUAL_ONLY');

    if (damageableIndices.length === 0) {
      // 全為純視覺 Cue，全部輸出 amount = 0
      effectiveCues.forEach((cue, cIdx) => {
        results.push({
          cueIndex: cIdx,
          cueId: cue.cueId,
          targetId,
          amount: 0,
          kind: 'VISUAL_ONLY',
          isCrit: false,
          isPrimary: false,
          targetPolicy: cue.targetPolicy
        });
      });
      return;
    }

    if (mode === 'PRIMARY_ONLY') {
      // 僅在 primary cue 呈現完整數值，其餘純視覺 (amount = 0)
      const primaryItem = damageableIndices.find(item => item.cue.isPrimary) || damageableIndices[damageableIndices.length - 1];

      effectiveCues.forEach((cue, cIdx) => {
        const isPri = cIdx === primaryItem.idx;
        results.push({
          cueIndex: cIdx,
          cueId: cue.cueId,
          targetId,
          amount: isPri ? totalAmount : 0,
          kind: isPri ? kind : 'VISUAL_ONLY',
          isCrit: isPri && isCrit,
          isPrimary: isPri,
          targetHp: isPri ? singleEv.targetHp : undefined,
          targetMaxHp: singleEv.targetMaxHp,
          targetPolicy: cue.targetPolicy
        });
      });
    } else if (mode === 'SPLIT_SINGLE_IMPACT' && damageableIndices.length > 1 && totalAmount > 0) {
      // 🎯 嚴格依各 weight 權重進行整數安全切分 (Integer Safe Weighted Split)
      const totalWeight = damageableIndices.reduce((sum, item) => sum + Math.max(0.01, item.cue.weight ?? 1.0), 0);
      let allocatedTotal = 0;
      const sliceMap = new Map<number, number>();

      damageableIndices.forEach((item, dIdx) => {
        const isLast = dIdx === damageableIndices.length - 1;
        if (isLast) {
          // 終擊段吸收餘數，守護不變量：總和 100% 精確等於 totalAmount
          const remainder = totalAmount - allocatedTotal;
          sliceMap.set(item.idx, remainder);
        } else {
          const w = Math.max(0.01, item.cue.weight ?? 1.0);
          const slice = Math.floor(totalAmount * (w / totalWeight));
          allocatedTotal += slice;
          sliceMap.set(item.idx, slice);
        }
      });

      effectiveCues.forEach((cue, cIdx) => {
        if (sliceMap.has(cIdx)) {
          const sliceAmount = sliceMap.get(cIdx)!;
          const isFinalSlice = cIdx === damageableIndices[damageableIndices.length - 1].idx;
          results.push({
            cueIndex: cIdx,
            cueId: cue.cueId,
            targetId,
            amount: sliceAmount,
            kind,
            isCrit: isFinalSlice && isCrit,
            isPrimary: cue.isPrimary || isFinalSlice,
            targetHp: isFinalSlice ? singleEv.targetHp : undefined,
            targetMaxHp: singleEv.targetMaxHp,
            targetPolicy: cue.targetPolicy
          });
        } else {
          // 純視覺 Cue
          results.push({
            cueIndex: cIdx,
            cueId: cue.cueId,
            targetId,
            amount: 0,
            kind: 'VISUAL_ONLY',
            isCrit: false,
            isPrimary: false,
            targetPolicy: cue.targetPolicy
          });
        }
      });
    } else {
      // 🎯 EXACT_IMPACTS 預設：單筆事件直接於第一個有效 Cue 呈現完整數值
      const firstTargetIdx = damageableIndices[0].idx;
      effectiveCues.forEach((cue, cIdx) => {
        const isFirst = cIdx === firstTargetIdx;
        results.push({
          cueIndex: cIdx,
          cueId: cue.cueId,
          targetId,
          amount: isFirst ? totalAmount : 0,
          kind: isFirst ? kind : 'VISUAL_ONLY',
          isCrit: isFirst && isCrit,
          isPrimary: cue.isPrimary || isFirst,
          targetHp: isFirst ? singleEv.targetHp : undefined,
          targetMaxHp: singleEv.targetMaxHp,
          targetPolicy: cue.targetPolicy
        });
      });
    }
  });

  return results;
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
  private fxEngine: CombatFXEngine;
  private presetRepo: VFXPresetRepository;

  private static debugOverlayEnabled: boolean = false;
  private static debugOverlayEl: HTMLElement | null = null;

  constructor() {
    this.fxEngine = CombatFXEngine.getInstance();
    this.presetRepo = VFXPresetRepository.getInstance();
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
        : '<span style="color:#10b981;font-weight:bold;">🟢 ACTION</span>';
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

  private clearDebugOverlay(): void {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('vfx-debug-overlay');
    if (el) {
      setTimeout(() => {
        if (el && el.innerHTML.includes('ACTION')) {
          el.innerHTML = '<span style="color:#64748b;">💤 IDLE</span>';
        }
      }, 400);
    }
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
    const mainTargetId = action.events.find(e => e.targetId)?.targetId || '';

    this.updateDebugOverlay({
      actionId: action.actionId,
      actorId: action.actorId,
      vfxId,
      targetId: mainTargetId,
      isFallback: options.skipVfx || !preset,
      impactCount: 0
    });

    // 若 skipVfx 或找不到 preset，直接無特效結算所有呈現項目
    if (options.skipVfx || !preset) {
      const mode = preset?.impactPresentationMode || 'EXACT_IMPACTS';
      const items = mapImpactsToCues(action.events, preset?.impactCues || [], mode);
      const activeItems = items.filter(i => i.amount > 0 || i.kind === 'MISS' || i.kind === 'STATUS');
      activeItems.forEach(item => {
        options.onPresentImpact?.(item);
      });
      this.clearDebugOverlay();
      options.onActionComplete?.();
      return;
    }

    // 計算各目標之呈現項目
    const presentationItems = mapImpactsToCues(
      action.events,
      preset.impactCues || [],
      preset.impactPresentationMode || 'EXACT_IMPACTS'
    );

    // 依 cueIndex 建立查找表
    const cueMap = new Map<number, CombatImpactPresentation[]>();
    presentationItems.forEach(item => {
      if (!cueMap.has(item.cueIndex)) cueMap.set(item.cueIndex, []);
      cueMap.get(item.cueIndex)!.push(item);
    });

    // 呼叫底層 3D FX 引擎，精確播放一次 Preset！
    // 🛡️ 遵循 docs/VFX_STUDIO_REBUILD_GEMINI_3_8_FLASH.md 第 11 節驗收標準：
    // 「WebGL 失敗戰鬥仍完成」— 當 WebGL 崩潰、上下文丟失或 Shader 編譯失敗時，絕不得中斷戰鬥！
    const dispatchedItems = new Set<CombatImpactPresentation>();
    let triggeredImpactCount = 0;

    try {
      await this.fxEngine.playPresetConfig(
        preset,
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
            impactCount: triggeredImpactCount
          });

          // 當時間軸觸發特定 Cue 時，分發已配對之呈現項目
          const matchedItems = cueMap.get(hitIdx) || [];
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
              targetId: '',
              amount: 0,
              kind: fallbackKind,
              isCrit: false,
              isPrimary: cue?.isPrimary ?? false
            }, cue);
          }
        }
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

      // 安全容錯派發：確保所有有效數值與狀態呈現項目 100% 傳遞至 UI，不吞事件也不派發幽靈項目
      const activeItems = presentationItems.filter(i => i.amount > 0 || i.kind === 'MISS' || i.kind === 'STATUS');
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
