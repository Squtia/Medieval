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

  private bindingsMap: Map<string, SkillVfxBinding> = new Map();
  private vfxToSkillsMap: Map<string, SkillVfxBinding[]> = new Map();

  private constructor() {
    this.initDefaultBindings();
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
      this.registerBinding(item);
    }
  }

  /**
   * 註冊或更新一筆技能特效綁定
   */
  public registerBinding(binding: SkillVfxBinding): void {
    this.bindingsMap.set(binding.skillId, binding);

    const existing = this.vfxToSkillsMap.get(binding.vfxId) || [];
    if (!existing.some(b => b.skillId === binding.skillId)) {
      existing.push(binding);
      this.vfxToSkillsMap.set(binding.vfxId, existing);
    }
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
