import { VFXPreset, VFXSequence, VFXUsageType, presetToSequence } from '../../models/VFX';
import defaultVFXSequences from '../../data/vfx_sequences.json';
import customVFXSequences from '../../data/vfx_custom_sequences.json';
import { VFXPresetValidator } from './VFXPresetValidator';

export interface VFXStorageSchema {
  version: number;
  customSequences?: VFXSequence[];
  customPresets?: VFXSequence[];
  overrideSequences?: Record<string, Partial<VFXSequence>>;
  overrides?: Record<string, Partial<VFXSequence>>;
  deletedCustomIds?: string[];
}

export const VFX_STORAGE_KEY = 'MEDIEVAL_CUSTOM_VFX_PRESETS';
export const CURRENT_SCHEMA_VERSION = 2;

export class VFXPresetRepository {
  private static instance: VFXPresetRepository | null = null;

  // 1. 官方內建 Canonical Sequence 庫 (Resolved SSOT 基準，30款唯讀)
  private builtInSequences: Map<string, VFXSequence> = new Map();
  // 2. 使用者自訂 Canonical Sequence 庫 (包含新技能特效與獨立素材)
  private customSequences: Map<string, VFXSequence> = new Map();
  // 3. 官方預設微調覆寫 (Overrides)
  private overrideSequences: Map<string, Partial<VFXSequence>> = new Map();
  // 4. 快取合成字典 (Resolved SSOT!)
  private resolvedSequenceMap: Map<string, VFXSequence> = new Map();

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
   * 載入官方內建標準 30 款 Canonical Sequence (唯讀保護)
   */
  private loadBuiltIn(): void {
    this.builtInSequences.clear();
    (defaultVFXSequences as unknown as VFXSequence[]).forEach(seq => {
      const normalized: VFXSequence = {
        ...seq,
        usageType: seq.usageType || 'SKILL',
        isBuiltin: true
      };
      Object.freeze(normalized);
      this.builtInSequences.set(normalized.id, normalized);
    });
  }

  /**
   * 自磁碟與 LocalStorage 載入自訂與素材 Sequence
   */
  public loadFromStorage(): void {
    this.customSequences.clear();
    this.overrideSequences.clear();

    // 1. 載入磁碟獨立自訂檔案庫 (vfx_custom_sequences.json)
    if (Array.isArray(customVFXSequences)) {
      (customVFXSequences as unknown as VFXSequence[]).forEach(seq => {
        if (!this.builtInSequences.has(seq.id)) {
          const normalized: VFXSequence = {
            ...seq,
            usageType: seq.usageType || 'SKILL',
            isBuiltin: false
          };
          this.customSequences.set(normalized.id, normalized);
        }
      });
    }

    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(VFX_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        // v1 相容格式：直接存自訂陣列
        parsed.forEach((p: any) => {
          if (p && p.id && !this.builtInSequences.has(p.id)) {
            this.customSequences.set(p.id, p as VFXSequence);
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
        overrideSequences: Object.fromEntries(this.overrideSequences.entries()),
        customPresets: customSequences as any[],
        overrides: Object.fromEntries(this.overrideSequences.entries())
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
    // 1. 加入內建 Sequence
    this.builtInSequences.forEach((seq, id) => {
      const override = this.overrideSequences.get(id);
      if (override) {
        this.resolvedSequenceMap.set(id, { ...seq, ...override });
      } else {
        this.resolvedSequenceMap.set(id, { ...seq });
      }
    });

    // 2. 加入自訂 Sequence (若已有 override 覆寫，以最新草稿 override 為準，防止 LocalStorage 舊殘留快照逆向覆蓋)
    this.customSequences.forEach((seq, id) => {
      if (this.overrideSequences.has(id)) {
        return;
      }
      this.resolvedSequenceMap.set(id, { ...seq });
    });

    this.notifyListeners();
  }

  public getAllPresets(): VFXSequence[] {
    return this.getAllSequences();
  }

  public getPreset(id: string): VFXSequence | undefined {
    return this.getSequence(id);
  }

  public hasPreset(id: string): boolean {
    return this.resolvedSequenceMap.has(id);
  }

  /**
   * 🌟 依據 §9.2 條款：Repository 對外直接提供 resolved Canonical VFXSequence SSOT
   */
  public getSequence(id: string): VFXSequence | undefined {
    return this.resolvedSequenceMap.get(id);
  }

  public getAllSequences(): VFXSequence[] {
    return Array.from(this.resolvedSequenceMap.values());
  }

  /**
   * 🌟 取得官方 30 款出廠基準特效 (唯讀保護)
   */
  public getBuiltInSequences(): VFXSequence[] {
    return Array.from(this.builtInSequences.values());
  }

  /**
   * 🌟 取得所有自訂創作與獨立素材特效
   */
  public getCustomSequences(): VFXSequence[] {
    return Array.from(this.customSequences.values());
  }

  /**
   * 🌟 依據用途標籤篩選特效 ('SKILL' 技能專用 | 'MATERIAL' 獨立素材)
   */
  public getSequencesByUsage(usage: VFXUsageType): VFXSequence[] {
    return this.getAllSequences().filter(s => (s.usageType || 'SKILL') === usage);
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
      // 🛡️ 徹底拔除 LocalStorage 中自訂時期的舊殘留，避免逆向污染
      this.customSequences.delete(sequence.id);
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
  public upsertDraft(draft: VFXSequence): { success: boolean; error?: string } {
    if (!draft || !draft.id) {
      return { success: false, error: '草稿無效或缺少 ID' };
    }
    return this.saveSequence(draft);
  }

  /**
   * 儲存或更新自訂 Preset (相容適配層，自動升級為 Sequence SSOT)
   */
  public saveCustomPreset(preset: VFXPreset | VFXSequence): { success: boolean; error?: string } {
    if (!preset || !preset.id) {
      return { success: false, error: '預設無效或缺少 ID' };
    }
    const seq = (preset as any).tracks && Array.isArray((preset as any).tracks)
      ? (preset as VFXSequence)
      : presetToSequence(preset as VFXPreset);
    return this.saveSequence(seq);
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
  public reloadPresets(newPresets?: VFXSequence[]): void {
    if (newPresets && Array.isArray(newPresets)) {
      this.builtInSequences.clear();
      newPresets.forEach(p => {
        this.builtInSequences.set(p.id, p);
        this.overrideSequences.delete(p.id);
        this.customSequences.delete(p.id);
      });
      this.saveToStorage();
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
