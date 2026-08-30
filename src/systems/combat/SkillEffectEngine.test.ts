import { describe, it, expect } from 'vitest';
import { SkillEffectEngine } from './SkillEffectEngine';
import { SkillRegistry } from './SkillRegistry';
import { CompositeSkillDefinition } from '../../models/Skill';
import { CombatParticipant, StatusEffectType } from '../../models/Combat';

function createMockParticipant(id: string, name: string, isPlayer: boolean, hp = 100, patk = 20, matk = 20, pdef = 10, mdef = 10): CombatParticipant {
  return {
    id,
    name,
    isPlayer,
    row: 'FRONT',
    maxHp: hp,
    currentHp: hp,
    maxMp: 50,
    currentMp: 50,
    stats: {
      hp,
      mp: 50,
      atk: patk,
      patk,
      matk,
      def: pdef,
      pdef,
      mdef,
      hit: 95,
      evade: 5,
      speed: 10,
      critRate: 0,
      critDmg: 150
    },
    statusEffects: []
  };
}

describe('SkillEffectEngine 積木技能引擎測試 (Phase 1)', () => {
  it('應能從 SkillRegistry 取得並正確編譯 CustomSkillData.json 中的技能', () => {
    const flameSkill = SkillRegistry.getSkill('CATACLYSM_FLAME');
    expect(flameSkill).toBeDefined();
    expect(flameSkill?.name).toBe('末日焰炎');
    expect(flameSkill?.mpCost).toBe(30);

    const roarSkill = SkillRegistry.getSkill('DRAGON_ROAR');
    expect(roarSkill).toBeDefined();
    expect(roarSkill?.name).toBe('龍吟咆哮');
    expect(roarSkill?.mpCost).toBe(25);
  });

  it('CATACLYSM_FLAME 應能對全體敵人造成魔法傷害並施加燃燒', () => {
    const flameSkill = SkillRegistry.getSkill('CATACLYSM_FLAME')!;
    const caster = createMockParticipant('dragon_1', '太古黑龍', false, 300, 30, 40);
    const hero1 = createMockParticipant('hero_1', '戰士', true, 100);
    const hero2 = createMockParticipant('hero_2', '法師', true, 80);

    const events = flameSkill.execute(caster, [hero1, hero2], [hero1, hero2], [caster]);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(hero1.currentHp).toBeLessThan(100);
    expect(hero2.currentHp).toBeLessThan(80);
    expect(hero1.statusEffects.some(s => s.type === StatusEffectType.BURN)).toBe(true);
    expect(hero2.statusEffects.some(s => s.type === StatusEffectType.BURN)).toBe(true);
  });

  it('DRAGON_ROAR 應能造成魔法傷害並提升自身攻擊力', () => {
    const roarSkill = SkillRegistry.getSkill('DRAGON_ROAR')!;
    const caster = createMockParticipant('dragon_1', '太古黑龍', false, 300, 30, 40);
    const hero = createMockParticipant('hero_1', '戰士', true, 100);

    roarSkill.execute(caster, [hero], [hero], [caster]);
    expect(hero.currentHp).toBeLessThan(100);
    expect(caster.statusEffects.some(s => s.type === StatusEffectType.BUFF_PATK)).toBe(true);
  });

  it('應能正確處理吸血 (LIFESTEAL) 與多段打擊 (MULTI_HIT)', () => {
    const customDef: CompositeSkillDefinition = {
      id: 'TEST_DRAIN_MULTI',
      name: '吸血連擊',
      icon: '🩸',
      description: '測試吸血與連擊',
      category: 'MONSTER',
      mpCost: 10,
      blocks: [
        {
          trigger: 'ACTIVE',
          effectType: 'LIFESTEAL',
          targetType: 'SINGLE_ENEMY' as any,
          multiplier: 1.0,
          lifeStealRate: 0.5
        },
        {
          trigger: 'ACTIVE',
          effectType: 'MULTI_HIT',
          targetType: 'SINGLE_ENEMY' as any,
          multiplier: 0.5,
          hitCount: 3
        }
      ]
    };

    const skill = SkillEffectEngine.compile(customDef);
    const caster = createMockParticipant('c', '施法者', false, 100, 20, 20);
    caster.currentHp = 50;
    const target = createMockParticipant('t', '目標', true, 100);

    const events = skill.execute(caster, [target], [target], [caster]);
    expect(events.length).toBe(4); // 1 次吸血 + 3 次連擊
    expect(caster.currentHp).toBeGreaterThan(50);
    expect(target.currentHp).toBeLessThan(100);
  });

  it('應能正確處理烙印 (SET_MARK) 與引爆 (DETONATE_MARKS)', () => {
    const markDef: CompositeSkillDefinition = {
      id: 'TEST_MARK',
      name: '標記',
      icon: '✨',
      description: '施加烙印',
      category: 'MONSTER',
      mpCost: 5,
      blocks: [
        {
          trigger: 'ACTIVE',
          effectType: 'SET_MARK',
          targetType: 'SINGLE_ENEMY' as any
        }
      ]
    };

    const detonateDef: CompositeSkillDefinition = {
      id: 'TEST_DETONATE',
      name: '引爆',
      icon: '💥',
      description: '引爆烙印',
      category: 'MONSTER',
      mpCost: 15,
      blocks: [
        {
          trigger: 'ACTIVE',
          effectType: 'DETONATE_MARKS',
          targetType: 'SINGLE_ENEMY' as any,
          multiplier: 2.0
        }
      ]
    };

    const markSkill = SkillEffectEngine.compile(markDef);
    const detonateSkill = SkillEffectEngine.compile(detonateDef);
    const caster = createMockParticipant('c', '法師', false, 100, 10, 30);
    const target = createMockParticipant('t', '目標', true, 200);

    markSkill.execute(caster, [target], [target], [caster]);
    markSkill.execute(caster, [target], [target], [caster]);
    expect(target.statusEffects.find(s => s.type === StatusEffectType.MARK)?.stacks).toBe(2);

    detonateSkill.execute(caster, [target], [target], [caster]);
    expect(target.statusEffects.some(s => s.type === StatusEffectType.MARK)).toBe(false);
    expect(target.currentHp).toBeLessThan(200);
  });

  it('應能正確處理護盾 (APPLY_BARRIER)、斬殺 (EXECUTE) 與驅散 (DISPEL)', () => {
    const barrierDef: CompositeSkillDefinition = {
      id: 'TEST_BARRIER',
      name: '神聖護盾',
      icon: '🛡️',
      description: '測試護盾',
      category: 'MONSTER',
      mpCost: 10,
      blocks: [{ trigger: 'ACTIVE', effectType: 'APPLY_BARRIER', targetType: 'SELF' as any, barrierAmount: 50 }]
    };
    const executeDef: CompositeSkillDefinition = {
      id: 'TEST_EXECUTE',
      name: '處決',
      icon: '🪓',
      description: '測試斬殺',
      category: 'MONSTER',
      mpCost: 10,
      blocks: [{ trigger: 'ACTIVE', effectType: 'EXECUTE', targetType: 'SINGLE_ENEMY' as any, executeThreshold: 0.3, multiplier: 1.0 }]
    };
    const dispelDef: CompositeSkillDefinition = {
      id: 'TEST_DISPEL',
      name: '驅散之光',
      icon: '✨',
      description: '測試驅散',
      category: 'MONSTER',
      mpCost: 5,
      blocks: [{ trigger: 'ACTIVE', effectType: 'DISPEL', targetType: 'SINGLE_ENEMY' as any }]
    };

    const barrierSkill = SkillEffectEngine.compile(barrierDef);
    const executeSkill = SkillEffectEngine.compile(executeDef);
    const dispelSkill = SkillEffectEngine.compile(dispelDef);

    const caster = createMockParticipant('c', '戰士', false, 100, 20, 20);
    const target = createMockParticipant('t', '目標', true, 100);

    // 測試護盾
    barrierSkill.execute(caster, [caster], [target], [caster]);
    expect(caster.statusEffects.some(s => s.type === StatusEffectType.BARRIER && s.value === 50)).toBe(true);

    // 測試驅散
    dispelSkill.execute(target, [caster], [caster], [target]);
    expect(caster.statusEffects.some(s => s.type === StatusEffectType.BARRIER)).toBe(false);

    // 測試斬殺（HP <= 30% 斬殺，否則一般傷害）
    target.currentHp = 20; // 20% HP
    executeSkill.execute(caster, [target], [target], [caster]);
    expect(target.currentHp).toBe(0);
  });

  it('應能正確處理雙修混合傷害 (DAMAGE_MIXED) 與吸魔 (MP_DRAIN)', () => {
    const mixedDef: CompositeSkillDefinition = {
      id: 'TEST_MIXED',
      name: '魔劍雙斬',
      icon: '⚔️',
      description: '測試混合傷害',
      category: 'MONSTER',
      mpCost: 15,
      blocks: [
        { trigger: 'ACTIVE', effectType: 'DAMAGE_MIXED', targetType: 'SINGLE_ENEMY' as any, multiplier: 1.0, physRatio: 0.5 },
        { trigger: 'ACTIVE', effectType: 'MP_DRAIN', targetType: 'SINGLE_ENEMY' as any, multiplier: 1.0 }
      ]
    };

    const skill = SkillEffectEngine.compile(mixedDef);
    const caster = createMockParticipant('c', '魔劍士', false, 100, 20, 20);
    caster.currentMp = 10;
    const target = createMockParticipant('t', '目標', true, 100);
    target.currentMp = 30;

    skill.execute(caster, [target], [target], [caster]);
    expect(target.currentHp).toBeLessThan(100);
    expect(target.currentMp).toBeLessThan(30);
    expect(caster.currentMp).toBeGreaterThan(10);
  });
});
