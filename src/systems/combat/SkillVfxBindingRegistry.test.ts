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

  it('✅ 驗證 Phase 8 情境 12: 所有技能與 6 大武器普攻綁定之 VFX ID 皆 100% 指向已存在之合法預設', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const { BasicAttackVfxRepository } = await import('./BasicAttackVfxRepository');
    const { SKILLS } = await import('../../data/SkillData');

    // 1. 讀取專案核心 SSOT vfx_presets.json
    const vfxPresetsPath = path.resolve(__dirname, '../../data/vfx_presets.json');
    const rawData = fs.readFileSync(vfxPresetsPath, 'utf-8');
    const presets = JSON.parse(rawData);
    const availableVfxIds = new Set<string>(presets.map((p: any) => p.id));

    expect(availableVfxIds.size).toBeGreaterThanOrEqual(30);

    // 2. 遍歷 SkillVfxBindingRegistry 中的所有綁定
    const allBindings = registry.getAllBindings();
    const missingInRegistry: string[] = [];
    allBindings.forEach(b => {
      if (!availableVfxIds.has(b.vfxId)) {
        missingInRegistry.push(`Skill [${b.skillId}] maps to missing VFX ID: "${b.vfxId}"`);
      }
    });
    expect(missingInRegistry, `發現無效的技能特效引用：\n${missingInRegistry.join('\n')}`).toHaveLength(0);

    // 3. 遍歷 SKILLS 中的所有技能 (SKILLS 為 Record<string, any> 字典)
    const missingInSkills: string[] = [];
    Object.entries(SKILLS).forEach(([skillId, skill]: [string, any]) => {
      const vfxId = registry.getVfxForSkill(skillId) || registry.getVfxForSkill(skill.name);
      if (!availableVfxIds.has(vfxId)) {
        missingInSkills.push(`SKILLS [${skillId} (${skill.name})] maps to missing VFX ID: "${vfxId}"`);
      }
    });
    expect(missingInSkills, `發現 SKILLS 中的無效特效引用：\n${missingInSkills.join('\n')}`).toHaveLength(0);

    // 4. 遍歷 6 大武器普攻之 getBasicAttackVfxId 與 BasicAttackVfxRepository
    const { getBasicAttackVfxId } = await import('../../data/SkillData');
    const basicAttackRepo = BasicAttackVfxRepository.getInstance();
    const weaponTypes = ['GREATSWORD', 'BOW', 'STAFF', 'DAGGERS', 'SWORD_AND_SHIELD', 'HOLY_BOOK'];
    const missingInWeapons: string[] = [];

    // 檢驗 6 大武器預設普攻
    weaponTypes.forEach(w => {
      const vfxId = getBasicAttackVfxId({ weaponType: w });
      if (!availableVfxIds.has(vfxId)) {
        missingInWeapons.push(`Default weapon [${w}] attack maps to missing VFX ID: "${vfxId}"`);
      }
    });

    // 檢驗自訂普攻綁定字典 (Record<string, string>)
    const weaponBindings = basicAttackRepo.getAllBindings();
    Object.entries(weaponBindings).forEach(([key, vfxId]) => {
      if (!availableVfxIds.has(vfxId)) {
        missingInWeapons.push(`Custom binding [${key}] maps to missing VFX ID: "${vfxId}"`);
      }
    });
    expect(missingInWeapons, `發現武器普攻中的無效特效引用：\n${missingInWeapons.join('\n')}`).toHaveLength(0);
  });
});
