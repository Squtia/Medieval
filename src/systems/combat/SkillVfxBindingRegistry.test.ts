import { describe, it, expect, beforeEach } from 'vitest';
import { SkillVfxBindingRegistry } from './SkillVfxBindingRegistry';

describe('Phase 4: SkillVfxBindingRegistry 解耦與雙向查詢測試', () => {
  let registry: SkillVfxBindingRegistry;

  beforeEach(() => {
    registry = SkillVfxBindingRegistry.getInstance();
  });

  it('應成功自 skill_vfx_bindings.json 載入所有技能綁定資料', () => {
    const all = registry.getAllBindings();
    expect(all.length).toBeGreaterThan(40);
    
    // 驗證核心戰士技能
    const heavyStrike = registry.getBinding('FIGHTER_HEAVY_STRIKE');
    expect(heavyStrike).toBeDefined();
    expect(heavyStrike?.vfxId).toBe('VFX_HEAVY_STRIKE');
    expect(heavyStrike?.impactPresentationMode).toBe('EXACT_IMPACTS');

    // 驗證旋風斬之 SPLIT_SINGLE_IMPACT 多段演出
    const whirlwind = registry.getBinding('GREATSWORD_WHIRLWIND');
    expect(whirlwind).toBeDefined();
    expect(whirlwind?.vfxId).toBe('VFX_WHIRLWIND');
    expect(whirlwind?.impactPresentationMode).toBe('SPLIT_SINGLE_IMPACT');
  });

  it('應支援依特效 ID 反查被哪些技能引用 (getSkillsForVfx)', () => {
    const boundToHeavyStrike = registry.getSkillsForVfx('VFX_HEAVY_STRIKE');
    expect(boundToHeavyStrike.length).toBeGreaterThanOrEqual(4);
    const skillIds = boundToHeavyStrike.map(b => b.skillId);
    expect(skillIds).toContain('FIGHTER_HEAVY_STRIKE');
    expect(skillIds).toContain('奮力一擊');
    expect(skillIds).toContain('FIGHTER_ARMOR_BREAK');
  });

  it('應支援未知技能 fallback 預設特效', () => {
    const fallback = registry.getVfxForSkill('NON_EXISTENT_SKILL_XYZ');
    expect(fallback).toBe('VFX_HEAVY_STRIKE');

    const customFallback = registry.getVfxForSkill('NON_EXISTENT_SKILL_XYZ', 'VFX_FIREBALL');
    expect(customFallback).toBe('VFX_FIREBALL');
  });

  it('應支援動態註冊與更新新技能綁定 (registerBinding)', () => {
    registry.registerBinding({
      skillId: 'CUSTOM_TEST_ULTIMATE',
      vfxId: 'VFX_METEOR_STRIKE',
      impactPresentationMode: 'PRIMARY_ONLY'
    });

    expect(registry.getVfxForSkill('CUSTOM_TEST_ULTIMATE')).toBe('VFX_METEOR_STRIKE');
    expect(registry.getPresentationMode('CUSTOM_TEST_ULTIMATE')).toBe('PRIMARY_ONLY');

    const meteorSkills = registry.getSkillsForVfx('VFX_METEOR_STRIKE');
    expect(meteorSkills.some(b => b.skillId === 'CUSTOM_TEST_ULTIMATE')).toBe(true);
  });

  it('應能正確輸出相容舊版 SKILL_VFX_MAP 的字典物件 (toMap)', () => {
    const map = registry.toMap();
    expect(typeof map).toBe('object');
    expect(map['FIGHTER_HEAVY_STRIKE']).toBe('VFX_HEAVY_STRIKE');
    expect(map['MAGE_FIRE_BOLT']).toBe('VFX_FIREBALL');
    expect(map['PRAYER_HEAL']).toBe('VFX_HOLY_LIGHT');
  });
});
