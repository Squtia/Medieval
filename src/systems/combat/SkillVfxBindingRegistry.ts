import { SkillVfxBinding, ImpactPresentationMode } from '../../models/VFX';
import rawBindings from '../../data/skill_vfx_bindings.json';

/**
 * 🔗 技能與特效獨立解耦綁定註冊表 (Skill-VFX Binding Registry)
 * 職責：
 * 1. 作為技能 ID 與視覺特效 (VFXPreset) 的唯一解耦 SSOT
 * 2. 支援雙向查詢：技能查特效、特效反查被哪些技能引用
 * 3. 支援演出呈現模式 (ImpactPresentationMode) 與時間軸 Cue 映射
 */
export class SkillVfxBindingRegistry {
  private static instance: SkillVfxBindingRegistry;

  private defaultBindingsMap: Map<string, SkillVfxBinding> = new Map();
  private bindingsMap: Map<string, SkillVfxBinding> = new Map();
  private vfxToSkillsMap: Map<string, SkillVfxBinding[]> = new Map();

  private constructor() {
    this.initDefaultBindings();
    this.loadCustomBindingsFromStorage();
  }

  public static getInstance(): SkillVfxBindingRegistry {
    if (!SkillVfxBindingRegistry.instance) {
      SkillVfxBindingRegistry.instance = new SkillVfxBindingRegistry();
    }
    return SkillVfxBindingRegistry.instance;
  }

  private initDefaultBindings(): void {
    const list = (rawBindings || []) as SkillVfxBinding[];
    for (const item of list) {
      const copy: SkillVfxBinding = { ...item };
      this.defaultBindingsMap.set(copy.skillId, copy);
      this.bindingsMap.set(copy.skillId, { ...copy });
    }
    this.rebuildVfxToSkillsIndex();
  }

  /**
   * 重建 vfxId -> skills 反查索引，避免切換時舊殘留
   */
  private rebuildVfxToSkillsIndex(): void {
    this.vfxToSkillsMap.clear();
    for (const binding of this.bindingsMap.values()) {
      const existing = this.vfxToSkillsMap.get(binding.vfxId) || [];
      if (!existing.some(b => b.skillId === binding.skillId)) {
        existing.push(binding);
        this.vfxToSkillsMap.set(binding.vfxId, existing);
      }
    }
  }

  /**
   * 從 LocalStorage 載入使用者覆寫的自訂技能綁定
   */
  public loadCustomBindingsFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('MEDIEVAL_SKILL_VFX_BINDINGS');
      if (!raw) return;
      const customMap = JSON.parse(raw) as Record<string, string>;
      if (!customMap || typeof customMap !== 'object') return;

      for (const [skillId, vfxId] of Object.entries(customMap)) {
        if (!skillId || !vfxId) continue;
        const current = this.bindingsMap.get(skillId);
        const mode = current?.impactPresentationMode || 'EXACT_IMPACTS';
        this.bindingsMap.set(skillId, {
          skillId,
          vfxId,
          impactPresentationMode: mode
        });
      }
      this.rebuildVfxToSkillsIndex();
    } catch {
      // 忽略解析錯誤
    }
  }

  /**
   * 持久化自訂綁定至 LocalStorage (只儲存與官方預設相異之項)
   */
  private saveCustomBindingsToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const customMap: Record<string, string> = {};
      for (const [skillId, binding] of this.bindingsMap.entries()) {
        const defaultBinding = this.defaultBindingsMap.get(skillId);
        if (!defaultBinding || defaultBinding.vfxId !== binding.vfxId) {
          customMap[skillId] = binding.vfxId;
        }
      }
      localStorage.setItem('MEDIEVAL_SKILL_VFX_BINDINGS', JSON.stringify(customMap));
    } catch {
      // 忽略儲存錯誤
    }
  }

  /**
   * 註冊或更新一筆技能特效綁定
   */
  public registerBinding(binding: SkillVfxBinding): void {
    this.bindingsMap.set(binding.skillId, binding);
    this.rebuildVfxToSkillsIndex();
    this.saveCustomBindingsToStorage();
  }

  /**
   * 便捷指派技能特效（覆蓋綁定），並持久化
   */
  public setSkillBinding(skillId: string, vfxId: string, mode?: ImpactPresentationMode): void {
    const existing = this.bindingsMap.get(skillId);
    const impactPresentationMode = mode || existing?.impactPresentationMode || 'EXACT_IMPACTS';
    this.registerBinding({
      skillId,
      vfxId,
      impactPresentationMode
    });
  }

  /**
   * 還原單一技能為官方預設特效
   */
  public restoreDefaultBinding(skillId: string): boolean {
    const defaultBinding = this.defaultBindingsMap.get(skillId);
    if (defaultBinding) {
      this.bindingsMap.set(skillId, { ...defaultBinding });
    } else {
      this.bindingsMap.delete(skillId);
    }
    this.rebuildVfxToSkillsIndex();
    this.saveCustomBindingsToStorage();
    return !!defaultBinding;
  }

  /**
   * 判斷指定技能是否已被自訂修改
   */
  public isBindingModified(skillId: string): boolean {
    const current = this.bindingsMap.get(skillId);
    const def = this.defaultBindingsMap.get(skillId);
    if (!def) return !!current; // 若無預設但有自訂，視為已修改
    return current?.vfxId !== def.vfxId;
  }

  /**
   * 取得指定技能的官方預設特效 ID
   */
  public getDefaultVfxId(skillId: string): string | undefined {
    return this.defaultBindingsMap.get(skillId)?.vfxId;
  }

  /**
   * 依技能 ID 取得完整綁定資訊
   */
  public getBinding(skillId: string): SkillVfxBinding | undefined {
    return this.bindingsMap.get(skillId);
  }

  /**
   * 依技能 ID 取得對應的 VFX ID（若無綁定則回傳預設 'VFX_HEAVY_STRIKE'）
   */
  public getVfxForSkill(skillId: string, fallbackVfx: string = 'VFX_HEAVY_STRIKE'): string {
    const b = this.bindingsMap.get(skillId);
    return b ? b.vfxId : fallbackVfx;
  }

  /**
   * 依特效 ID 反查所有引用該特效的技能清單
   */
  public getSkillsForVfx(vfxId: string): SkillVfxBinding[] {
    return this.vfxToSkillsMap.get(vfxId) || [];
  }

  /**
   * 取得所有綁定清單
   */
  public getAllBindings(): SkillVfxBinding[] {
    return Array.from(this.bindingsMap.values());
  }

  /**
   * 匯出為相容舊系統的 key-value 字典對照表
   */
  public toMap(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const [k, v] of this.bindingsMap.entries()) {
      map[k] = v.vfxId;
    }
    return map;
  }

  /**
   * 取得指定技能的打擊反饋呈現模式
   */
  public getPresentationMode(skillId: string): ImpactPresentationMode {
    const b = this.bindingsMap.get(skillId);
    return b?.impactPresentationMode || 'EXACT_IMPACTS';
  }
}
