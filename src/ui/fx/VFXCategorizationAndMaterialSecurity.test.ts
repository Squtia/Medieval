import { describe, it, expect, beforeEach } from 'vitest';
import defaultVFXSequences from '../../data/vfx_sequences.json';
import customVFXSequences from '../../data/vfx_custom_sequences.json';
import { VFXPresetRepository } from './VFXPresetRepository';
import { SkillVfxBindingRegistry } from '../../systems/combat/SkillVfxBindingRegistry';
import { VFXSequence } from '../../models/VFX';

describe('VFXCategorizationAndMaterialSecurity - 特效分類、素材防護與多檔案隔離架構驗收', () => {
  let repo: VFXPresetRepository;
  let bindingRegistry: SkillVfxBindingRegistry;

  beforeEach(() => {
    repo = VFXPresetRepository.getInstance();
    bindingRegistry = SkillVfxBindingRegistry.getInstance();
  });

  it('1. 官方 30 款特效必須維持乾淨出廠狀態，嚴格唯讀且 usageType 為 SKILL', () => {
    expect(defaultVFXSequences.length).toBe(30);

    const builtinList = repo.getBuiltInSequences();
    expect(builtinList.length).toBe(30);

    builtinList.forEach(seq => {
      expect(seq.isBuiltin).toBe(true);
      expect(seq.usageType).toBe('SKILL');
      expect(['PHYSICAL', 'ELEMENTAL', 'HOLY_DARK', 'SPECIAL']).toContain(seq.category);
    });
  });

  it('2. 自訂與素材檔案 (vfx_custom_sequences.json) 必須獨立分離，且雙軌聚合至 SSOT', () => {
    expect(Array.isArray(customVFXSequences)).toBe(true);
    const customList = repo.getCustomSequences();
    expect(customList.length).toBe(customVFXSequences.length);

    const all = repo.getAllSequences();
    expect(all.length).toBe(30 + customList.length);

    // 驗證透明調用：官方與自訂皆可透過 getSequence 順利取出
    const officialOne = repo.getSequence('VFX_HEAVY_STRIKE');
    expect(officialOne).toBeDefined();
    expect(officialOne?.name).toBe('巨力重劈 (Heavy Strike)');

    if (customList.length > 0) {
      const customOne = repo.getSequence(customList[0].id);
      expect(customOne).toBeDefined();
      expect(customOne?.id).toBe(customList[0].id);
    }
  });

  it('3. 防護防線：[素材] 特效 (usageType: MATERIAL) 嚴禁綁定給任何技能，違者拋出 Security Violation', () => {
    // 註冊一個測試用的素材特效
    const materialSeq: VFXSequence = {
      schemaVersion: 2,
      id: 'VFX_TEST_PURE_MATERIAL_PARTICLE',
      name: '測試純素材光環粒子',
      category: 'ELEMENTAL',
      usageType: 'MATERIAL', // 標記為素材
      isBuiltin: false,
      description: '純次生圖層素材，禁止綁定技能',
      duration: 0.5,
      tracks: [],
      impactCues: []
    };
    repo.saveCustomPreset(materialSeq);

    // 斷言：嘗試將素材綁定給戰士技能，必須立即被攔截阻斷！
    expect(() => {
      bindingRegistry.registerBinding({
        skillId: 'FIGHTER_HEAVY_STRIKE',
        vfxId: 'VFX_TEST_PURE_MATERIAL_PARTICLE',
        impactPresentationMode: 'EXACT_IMPACTS'
      });
    }).toThrowError(/\[Security Violation\].*素材特效.*不可直接綁定給技能/);

    // 驗證正常技能專用特效 (usageType: SKILL) 可以正常綁定
    const normalSkillVfx: VFXSequence = {
      schemaVersion: 2,
      id: 'VFX_TEST_VALID_SKILL_ACTION',
      name: '測試有效技能招式',
      category: 'PHYSICAL',
      usageType: 'SKILL',
      isBuiltin: false,
      description: '完整技能招式',
      duration: 0.8,
      tracks: [],
      impactCues: [{ cueId: 'c1', time: 0.5, kind: 'IMPACT', isPrimary: true }]
    };
    repo.saveCustomPreset(normalSkillVfx);

    expect(() => {
      bindingRegistry.registerBinding({
        skillId: 'FIGHTER_HEAVY_STRIKE',
        vfxId: 'VFX_TEST_VALID_SKILL_ACTION',
        impactPresentationMode: 'EXACT_IMPACTS'
      });
    }).not.toThrow();

    // 驗證綁定成功
    const currentBinding = bindingRegistry.getBinding('FIGHTER_HEAVY_STRIKE');
    expect(currentBinding?.vfxId).toBe('VFX_TEST_VALID_SKILL_ACTION');

    // 清理測試殘留
    bindingRegistry.restoreDefaultBinding('FIGHTER_HEAVY_STRIKE');
    repo.deletePreset('VFX_TEST_PURE_MATERIAL_PARTICLE');
    repo.deletePreset('VFX_TEST_VALID_SKILL_ACTION');
  });

  it('4. 依用途篩選：getSequencesByUsage 能精確分離技能專用與素材圖層', () => {
    const matSample: VFXSequence = {
      schemaVersion: 2,
      id: 'VFX_MAT_SAMPLE_SPARK',
      name: '火花素材',
      description: '火花粒子素材',
      category: 'ELEMENTAL',
      usageType: 'MATERIAL',
      duration: 0.4,
      tracks: [],
      impactCues: []
    };
    repo.saveCustomPreset(matSample);

    const skillsOnly = repo.getSequencesByUsage('SKILL');
    const materialsOnly = repo.getSequencesByUsage('MATERIAL');

    expect(skillsOnly.every(s => (s.usageType || 'SKILL') === 'SKILL')).toBe(true);
    expect(materialsOnly.every(s => s.usageType === 'MATERIAL')).toBe(true);
    expect(materialsOnly.some(s => s.id === 'VFX_MAT_SAMPLE_SPARK')).toBe(true);

    repo.deletePreset('VFX_MAT_SAMPLE_SPARK');
  });

  it('5. 🛡️ Store 白名單與持久化健全性：updateConfig({ usageType: "MATERIAL" }) 成功寫入，sanitizeSequenceRoot 100% 保留 usageType', async () => {
    const { VFXStudioStore, sanitizeSequenceRoot, VALID_SEQUENCE_ROOT_KEYS } = await import('../../tools/vfx-studio/VFXStudioStore');
    
    // 驗證白名單集合已正式收錄
    expect(VALID_SEQUENCE_ROOT_KEYS.has('usageType')).toBe(true);
    expect(VALID_SEQUENCE_ROOT_KEYS.has('isBuiltin')).toBe(true);

    const store = VFXStudioStore.getInstance();
    const testDraft: any = {
      schemaVersion: 2,
      id: 'VFX_CUSTOM_STORE_TEST',
      name: '測試草稿',
      category: 'SPECIAL',
      usageType: 'SKILL',
      duration: 0.5,
      tracks: []
    };
    store.setSequence(testDraft);
    expect(store.getSequence().usageType).toBe('SKILL');

    // 模擬使用者點擊 [🧩 素材圖層]
    store.updateConfig({ usageType: 'MATERIAL' }, true);
    expect(store.getSequence().usageType).toBe('MATERIAL');

    // 驗證發布清洗函式 sanitizeSequenceRoot 絕不剔除 usageType
    const sanitized = sanitizeSequenceRoot(store.getSequence() as any);
    expect(sanitized.usageType).toBe('MATERIAL');
  });
});
