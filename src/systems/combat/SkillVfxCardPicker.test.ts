import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SkillVfxBindingRegistry } from './SkillVfxBindingRegistry';
import { getAllUnifiedSkills } from '../../tools/vfx-studio/SkillVfxPickerModal';
import { getSkillVfxId } from '../../data/SkillData';

// 標準 Node 環境 localStorage Mock 實作
const testStorage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => testStorage.has(key) ? testStorage.get(key)! : null),
  setItem: vi.fn((key: string, val: string) => { testStorage.set(key, String(val)); }),
  removeItem: vi.fn((key: string) => { testStorage.delete(key); }),
  clear: vi.fn(() => { testStorage.clear(); }),
  get length() { return testStorage.size; },
  key: vi.fn((idx: number) => Array.from(testStorage.keys())[idx] ?? null)
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});

describe('SkillVfxCardPicker - 全領域技能卡片選取綁定器測試', () => {
  let registry: SkillVfxBindingRegistry;

  beforeEach(() => {
    localStorage.clear();
    registry = SkillVfxBindingRegistry.getInstance();
    // 重置為預設狀態
    registry.restoreDefaultBinding('FIGHTER_HEAVY_STRIKE');
    registry.restoreDefaultBinding('奮力一擊');
    registry.restoreDefaultBinding('DRAGON_ROAR');
    registry.restoreDefaultBinding('CAVALRY_CHARGE');
  });

  it('1. 全領域技能聚合清單應涵蓋英雄、怪物、攻城與自訂四大分類', () => {
    const all = getAllUnifiedSkills();
    expect(all.length).toBeGreaterThan(30);

    const categories = new Set(all.map(s => s.category));
    expect(categories.has('HERO')).toBe(true);
    expect(categories.has('MONSTER')).toBe(true);
    expect(categories.has('SIEGE')).toBe(true);

    // 檢查英雄技能
    const heavyStrike = all.find(s => s.id === 'FIGHTER_HEAVY_STRIKE');
    expect(heavyStrike).toBeDefined();
    expect(heavyStrike?.name).toBe('奮力一擊');
    expect(heavyStrike?.icon).toBe('⚔️');

    // 檢查怪物技能
    const dragonRoar = all.find(s => s.id === 'DRAGON_ROAR');
    expect(dragonRoar).toBeDefined();
    expect(dragonRoar?.category).toBe('MONSTER');

    // 檢查攻城技能
    const cavalry = all.find(s => s.id === 'CAVALRY_CHARGE');
    expect(cavalry).toBeDefined();
    expect(cavalry?.category).toBe('SIEGE');
  });

  it('2. 覆蓋綁定技能特效至新特效，應同步更新記憶體與持久化 LocalStorage', () => {
    // 預設為 VFX_HEAVY_STRIKE
    expect(registry.getVfxForSkill('FIGHTER_HEAVY_STRIKE')).toBe('VFX_HEAVY_STRIKE');
    expect(registry.isBindingModified('FIGHTER_HEAVY_STRIKE')).toBe(false);

    // 覆蓋綁定為自訂特效
    const customVfxId = 'VFX_CUSTOM_SUPER_FIRE';
    registry.setSkillBinding('FIGHTER_HEAVY_STRIKE', customVfxId);

    // 驗證記憶體即時生效
    expect(registry.getVfxForSkill('FIGHTER_HEAVY_STRIKE')).toBe(customVfxId);
    expect(registry.isBindingModified('FIGHTER_HEAVY_STRIKE')).toBe(true);

    // 驗證反查索引同步更新
    const boundSkills = registry.getSkillsForVfx(customVfxId);
    expect(boundSkills.some(b => b.skillId === 'FIGHTER_HEAVY_STRIKE')).toBe(true);

    // 驗證 LocalStorage 持久化
    const saved = localStorage.getItem('MEDIEVAL_SKILL_VFX_BINDINGS');
    expect(saved).not.toBeNull();
    const parsed = JSON.parse(saved!);
    const savedVfxId = parsed.version === 2 ? parsed.overrides['FIGHTER_HEAVY_STRIKE']?.vfxId : parsed['FIGHTER_HEAVY_STRIKE'];
    expect(savedVfxId).toBe(customVfxId);

    // 驗證實戰調用 getSkillVfxId 也優先讀出自訂特效
    expect(getSkillVfxId('FIGHTER_HEAVY_STRIKE')).toBe(customVfxId);
  });

  it('3. 點擊還原官方預設，應恢復原始特效並清除自訂修改標記', () => {
    const customVfxId = 'VFX_CUSTOM_ICE_BLAST';
    registry.setSkillBinding('DRAGON_ROAR', customVfxId);
    expect(registry.getVfxForSkill('DRAGON_ROAR')).toBe(customVfxId);
    expect(registry.isBindingModified('DRAGON_ROAR')).toBe(true);

    // 執行還原
    const ok = registry.restoreDefaultBinding('DRAGON_ROAR');
    expect(ok).toBe(true);

    // 驗證回到官方預設
    expect(registry.getVfxForSkill('DRAGON_ROAR')).toBe('VFX_DRAGON_ROAR');
    expect(registry.isBindingModified('DRAGON_ROAR')).toBe(false);

    // 驗證舊的自訂特效反查清單中不再有該技能
    const boundSkills = registry.getSkillsForVfx(customVfxId);
    expect(boundSkills.some(b => b.skillId === 'DRAGON_ROAR')).toBe(false);
  });
});
