import { VFXPreset } from '../../models/VFX';
import defaultVFXPresets from '../../data/vfx_presets.json';
import { VFXPresetValidator } from './VFXPresetValidator';

export interface VFXStorageSchema {
  version: number;
  customPresets: VFXPreset[];
  overrides?: Record<string, Partial<VFXPreset>>;
  deletedCustomIds?: string[];
}

export const VFX_STORAGE_KEY = 'MEDIEVAL_CUSTOM_VFX_PRESETS';
export const CURRENT_SCHEMA_VERSION = 2;

export class VFXPresetRepository {
  private static instance: VFXPresetRepository | null = null;

  // 1. 官方內建預設庫 (SSOT Source)
  private builtInMap: Map<string, VFXPreset> = new Map();
  // 2. 使用者自訂擴充預設庫
  private customMap: Map<string, VFXPreset> = new Map();
  // 3. 官方預設微調覆寫 (Overrides)
  private overrideMap: Map<string, Partial<VFXPreset>> = new Map();
  // 4. 快取合成字典
  private resolvedMap: Map<string, VFXPreset> = new Map();

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
   * 載入官方內建預設
   */
  private loadBuiltIn(): void {
    this.builtInMap.clear();
    (defaultVFXPresets as unknown as VFXPreset[]).forEach(p => {
      this.builtInMap.set(p.id, { ...p });
    });
  }

  /**
   * 自 LocalStorage 載入並進行 schema migration
   */
  public loadFromStorage(): void {
    this.customMap.clear();
    this.overrideMap.clear();

    if (typeof localStorage === 'undefined') return;

    try {
      const raw = localStorage.getItem(VFX_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        // v1 相容格式：直接存自訂陣列
        parsed.forEach((p: any) => {
          if (p && p.id && !this.builtInMap.has(p.id)) {
            this.customMap.set(p.id, p);
          }
        });
      } else if (parsed && typeof parsed === 'object') {
        // v2 格式
        const schema = parsed as VFXStorageSchema;
        if (schema.customPresets && Array.isArray(schema.customPresets)) {
          schema.customPresets.forEach(p => {
            if (p && p.id) {
              this.customMap.set(p.id, p);
            }
          });
        }
        if (schema.overrides && typeof schema.overrides === 'object') {
          Object.entries(schema.overrides).forEach(([id, ov]) => {
            this.overrideMap.set(id, ov);
          });
        }
      }
    } catch (err) {
      console.warn('[VFXPresetRepository] Failed to load custom presets from storage:', err);
    }
  }

  /**
   * 保存目前自訂庫與覆寫庫至 LocalStorage
   */
  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const schema: VFXStorageSchema = {
        version: CURRENT_SCHEMA_VERSION,
        customPresets: Array.from(this.customMap.values()),
        overrides: Object.fromEntries(this.overrideMap.entries())
      };
      localStorage.setItem(VFX_STORAGE_KEY, JSON.stringify(schema));
    } catch (err) {
      console.error('[VFXPresetRepository] Failed to save presets to storage:', err);
    }
  }

  /**
   * 重新合成最終可用的 Preset 字典
   */
  private rebuildResolvedMap(): void {
    this.resolvedMap.clear();

    // 1. 加入內建預設
    this.builtInMap.forEach((preset, id) => {
      const override = this.overrideMap.get(id);
      if (override) {
        this.resolvedMap.set(id, { ...preset, ...override });
      } else {
        this.resolvedMap.set(id, { ...preset });
      }
    });

    // 2. 加入自訂預設 (覆蓋或擴充)
    this.customMap.forEach((preset, id) => {
      this.resolvedMap.set(id, { ...preset });
    });

    this.notifyListeners();
  }

  public getAllPresets(): VFXPreset[] {
    return Array.from(this.resolvedMap.values());
  }

  public getPreset(id: string): VFXPreset | undefined {
    return this.resolvedMap.get(id);
  }

  public hasPreset(id: string): boolean {
    return this.resolvedMap.has(id);
  }

  /**
   * 儲存或更新自訂 Preset
   */
  public saveCustomPreset(preset: VFXPreset): { success: boolean; error?: string } {
    const validation = VFXPresetValidator.validatePreset(preset);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('; ') };
    }

    // 若為內建 ID，寫入 overrideMap；否則寫入 customMap
    if (this.builtInMap.has(preset.id)) {
      this.overrideMap.set(preset.id, { ...preset });
    } else {
      this.customMap.set(preset.id, { ...preset });
    }

    this.saveToStorage();
    this.rebuildResolvedMap();
    return { success: true };
  }

  /**
   * 刪除自訂 Preset（內建預設若有覆寫則還原）
   */
  public deletePreset(id: string): boolean {
    if (this.builtInMap.has(id)) {
      // 內建預設：清除覆寫
      this.overrideMap.delete(id);
    } else {
      // 自訂預設：自 customMap 移除
      this.customMap.delete(id);
    }

    this.saveToStorage();
    this.rebuildResolvedMap();
    return true;
  }

  /**
   * 還原出廠設定 (清空所有 LocalStorage 覆寫與自訂庫)
   */
  public resetToFactoryDefaults(): void {
    this.customMap.clear();
    this.overrideMap.clear();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(VFX_STORAGE_KEY);
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
