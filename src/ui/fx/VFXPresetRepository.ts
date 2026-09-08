import { VFXPreset, VFXSequence, migrateLegacyPreset, sequenceToLegacyPreset } from '../../models/VFX';
import defaultVFXPresets from '../../data/vfx_presets.json';
import { VFXPresetValidator } from './VFXPresetValidator';

export interface VFXStorageSchema {
  version: number;
  customPresets?: VFXPreset[];
  customSequences?: VFXSequence[];
  overrides?: Record<string, Partial<VFXPreset>>;
  overrideSequences?: Record<string, Partial<VFXSequence>>;
  deletedCustomIds?: string[];
}

export const VFX_STORAGE_KEY = 'MEDIEVAL_CUSTOM_VFX_PRESETS';
export const CURRENT_SCHEMA_VERSION = 2;

export class VFXPresetRepository {
  private static instance: VFXPresetRepository | null = null;

  // 1. 官方內建 Canonical Sequence 庫 (Resolved SSOT 基準)
  private builtInSequences: Map<string, VFXSequence> = new Map();
  // 2. 使用者自訂 Canonical Sequence 庫
  private customSequences: Map<string, VFXSequence> = new Map();
  // 3. 官方預設微調覆寫 (Overrides)
  private overrideSequences: Map<string, Partial<VFXSequence>> = new Map();
  // 4. 快取合成字典 (Resolved SSOT!)
  private resolvedSequenceMap: Map<string, VFXSequence> = new Map();
  // 5. 相容快取 Legacy Preset 字典 (向下相容邊界適配層)
  private resolvedPresetMap: Map<string, VFXPreset> = new Map();

  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.loadBuiltIn();
    this.loadFromStorage();
    this.rebuildResolvedMap();
  }

  public static getInstance(): VFXPresetRepository {
    if (!this.instance) {
      this.instance = new VFXPresetRepository();
    }
    return this.instance;
  }

  /**
   * 載入官方內建預設，啟動時全部直接遷移為 Canonical VFXSequence
   */
  private loadBuiltIn(): void {
    this.builtInSequences.clear();
    (defaultVFXPresets as unknown as VFXPreset[]).forEach(p => {
      this.builtInSequences.set(p.id, migrateLegacyPreset(p));
    });
  }

  /**
   * 自 LocalStorage 載入並進行 schema migration 至 Canonical Sequence
   */
  public loadFromStorage(): void {
    this.customSequences.clear();
    this.overrideSequences.clear();

    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(VFX_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        // v1 相容格式：直接存自訂陣列
        parsed.forEach((p: any) => {
          if (p && p.id && !this.builtInSequences.has(p.id)) {
            const seq = p.tracks ? (p as VFXSequence) : migrateLegacyPreset(p);
            this.customSequences.set(p.id, seq);
          }
        });
      } else if (parsed && typeof parsed === 'object') {
        // v2 格式
        const schema = parsed as VFXStorageSchema;
        if (schema.customSequences && Array.isArray(schema.customSequences)) {
          schema.customSequences.forEach(s => {
            if (s && s.id) {
              this.customSequences.set(s.id, s);
            }
          });
        } else if (schema.customPresets && Array.isArray(schema.customPresets)) {
          schema.customPresets.forEach(p => {
            if (p && p.id) {
              this.customSequences.set(p.id, migrateLegacyPreset(p));
            }
          });
        }
        if (schema.overrideSequences && typeof schema.overrideSequences === 'object') {
          Object.entries(schema.overrideSequences).forEach(([id, ov]) => {
            this.overrideSequences.set(id, ov);
          });
        } else if (schema.overrides && typeof schema.overrides === 'object') {
          Object.entries(schema.overrides).forEach(([id, ov]) => {
            this.overrideSequences.set(id, ov as any);
          });
        }
      }
    } catch (err) {
      console.warn('[VFXPresetRepository] Failed to load custom presets from storage:', err);
    }
  }

  /**
   * 保存目前自訂庫與覆寫庫至 LocalStorage (同時維護 canonical 與相容欄位)
   */
  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const customSequences = Array.from(this.customSequences.values());
      const schema: VFXStorageSchema = {
        version: CURRENT_SCHEMA_VERSION,
        customSequences,
        customPresets: customSequences.map(s => sequenceToLegacyPreset(s)),
        overrideSequences: Object.fromEntries(this.overrideSequences.entries()),
        overrides: Object.fromEntries(
          Array.from(this.overrideSequences.entries()).map(([id, ov]) => [
            id,
            sequenceToLegacyPreset(ov as any)
          ])
        )
      };
      localStorage.setItem(VFX_STORAGE_KEY, JSON.stringify(schema));
    } catch (err) {
      console.error('[VFXPresetRepository] Failed to save presets to storage:', err);
    }
  }

  /**
   * 重新合成最終可用的 Sequence SSOT 與相容 Preset 字典
   */
  private rebuildResolvedMap(): void {
    this.resolvedSequenceMap.clear();
    this.resolvedPresetMap.clear();

    // 1. 加入內建 Sequence
    this.builtInSequences.forEach((seq, id) => {
      const override = this.overrideSequences.get(id);
      if (override) {
        this.resolvedSequenceMap.set(id, { ...seq, ...override });
      } else {
        this.resolvedSequenceMap.set(id, { ...seq });
      }
    });

    // 2. 加入自訂 Sequence (覆蓋或擴充)
    this.customSequences.forEach((seq, id) => {
      this.resolvedSequenceMap.set(id, { ...seq });
    });

    // 3. 合成相容字典 (向下相容既有方法呼叫)
    this.resolvedSequenceMap.forEach((seq, id) => {
      this.resolvedPresetMap.set(id, sequenceToLegacyPreset(seq));
    });

    this.notifyListeners();
  }

  public getAllPresets(): VFXPreset[] {
    return Array.from(this.resolvedPresetMap.values());
  }

  public getPreset(id: string): VFXPreset | undefined {
    return this.resolvedPresetMap.get(id);
  }

  public hasPreset(id: string): boolean {
    return this.resolvedSequenceMap.has(id);
  }

  /**
   * 🌟 依據 §9.2 條款：Repository 對外直接提供 resolved Canonical VFXSequence SSOT
   * 絕不再臨時從 legacy preset 重新轉換！若未命中但相容方法 getPreset 有返回值（如單元測試 mock 攔截），安全適配
   */
  public getSequence(id: string): VFXSequence | undefined {
    const seq = this.resolvedSequenceMap.get(id);
    if (seq) return seq;
    // 相容防禦：若 getPreset 被外部 mock 或攔截，安全適配為 sequence
    const fallbackPreset = this.getPreset(id);
    if (fallbackPreset) {
      return migrateLegacyPreset(fallbackPreset);
    }
    return undefined;
  }

  public getAllSequences(): VFXSequence[] {
    return Array.from(this.resolvedSequenceMap.values());
  }

  public hasSequence(id: string): boolean {
    return this.resolvedSequenceMap.has(id);
  }

  /**
   * 🌟 依據 §9.2 條款：直接保存 Canonical VFXSequence
   * 純 Sequence 即使完全沒有 legacy 欄位，也能完整保存於 SSOT
   */
  public saveSequence(sequence: VFXSequence): { success: boolean; error?: string } {
    if (!sequence || !sequence.id) {
      return { success: false, error: 'Sequence 無效或缺少 ID' };
    }

    if (this.builtInSequences.has(sequence.id)) {
      this.overrideSequences.set(sequence.id, { ...sequence });
    } else {
      this.customSequences.set(sequence.id, { ...sequence });
    }

    this.saveToStorage();
    this.rebuildResolvedMap();
    return { success: true };
  }

  /**
   * 🧹 剔除 Editor Session 暫態 (如 Solo, Mute, Selection, Lock)，確保持久化資料純淨
   */
  public static sanitizePresetContent(preset: VFXPreset): VFXPreset {
    const sanitized: any = { ...preset };
    delete sanitized._mainTrackMuted;
    delete sanitized._trackMuteStates;
    delete sanitized._selected;
    delete sanitized.solo;
    delete sanitized.locked;

    if (Array.isArray(sanitized.layers)) {
      sanitized.layers = sanitized.layers.map((l: any) => {
        const cleanL = { ...l };
        delete cleanL._selected;
        delete cleanL.solo;
        delete cleanL.locked;
        return cleanL;
      });
    }

    return sanitized as VFXPreset;
  }

  /**
   * 📝 將編輯器最新草稿寫回 Repository，使其在組裝發布清單時生效
   */
  public upsertDraft(draft: VFXPreset | VFXSequence): { success: boolean; error?: string } {
    if (!draft || !draft.id) {
      return { success: false, error: '草稿無效或缺少 ID' };
    }
    const sequence = (draft as any).tracks ? (draft as VFXSequence) : migrateLegacyPreset(VFXPresetRepository.sanitizePresetContent(draft as VFXPreset));
    return this.saveSequence(sequence);
  }

  /**
   * 儲存或更新自訂 Preset (相容適配層)
   */
  public saveCustomPreset(preset: VFXPreset): { success: boolean; error?: string } {
    const validation = VFXPresetValidator.validatePreset(preset);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('; ') };
    }

    const cleanPreset = VFXPresetRepository.sanitizePresetContent(preset);
    const sequence = migrateLegacyPreset(cleanPreset);
    return this.saveSequence(sequence);
  }

  /**
   * 刪除自訂 Preset（內建預設若有覆寫則還原）
   */
  public deletePreset(id: string): boolean {
    if (this.builtInSequences.has(id)) {
      // 內建預設：清除覆寫
      this.overrideSequences.delete(id);
    } else {
      // 自訂預設：自 customSequences 移除
      this.customSequences.delete(id);
    }

    this.saveToStorage();
    this.rebuildResolvedMap();
    return true;
  }

  /**
   * 還原出廠設定 (清空所有 LocalStorage 覆寫與自訂庫)
   */
  public resetToFactoryDefaults(): void {
    this.customSequences.clear();
    this.overrideSequences.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(VFX_STORAGE_KEY);
    }
    this.rebuildResolvedMap();
  }

  /**
   * 🔄 重新載入預設（例如從伺服器還原 SSOT 快照後）
   */
  public reloadPresets(newPresets?: VFXPreset[]): void {
    if (newPresets && Array.isArray(newPresets)) {
      this.builtInSequences.clear();
      newPresets.forEach(p => this.builtInSequences.set(p.id, migrateLegacyPreset(p)));
    } else {
      this.loadBuiltIn();
    }
    this.rebuildResolvedMap();
  }

  public addChangeListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (e) {
        console.error('[VFXPresetRepository] Listener error:', e);
      }
    });
  }
}
