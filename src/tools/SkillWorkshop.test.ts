import { describe, it, expect } from 'vitest';
import customSkillData from '../data/CustomSkillData.json';
import { SkillEffectEngine } from '../systems/combat/SkillEffectEngine';
import { SkillRegistry } from '../systems/combat/SkillRegistry';
import { CombatParticipant } from '../models/Combat';

function createMockFighter(id: string, name: string, isPlayer: boolean): CombatParticipant {
  return {
    id,
    name,
    isPlayer,
    row: 'FRONT',
    maxHp: 200,
    currentHp: 200,
    maxMp: 100,
    currentMp: 100,
    stats: {
      hp: 200,
      mp: 100,
      atk: 25,
      patk: 25,
      matk: 25,
      def: 10,
      pdef: 10,
      mdef: 10,
      hit: 90,
      evade: 10,
      speed: 12,
      critRate: 5,
      critDmg: 150
    },
    statusEffects: []
  };
}

describe('SkillWorkshop 技能工坊與積木遷移驗證 (Phase 3)', () => {
  it('CustomSkillData.json 應包含至少 12 個完整積木技能定義', () => {
    expect(Array.isArray(customSkillData)).toBe(true);
    expect(customSkillData.length).toBeGreaterThanOrEqual(12);

    const requiredIds = [
      'CATACLYSM_FLAME', 'DRAGON_ROAR',
      'SKILL_TOXIC_SPRAY', 'SKILL_SAVAGE_REND', 'SKILL_CRUSHING_SLAM',
      'SKILL_BLOOD_DRAIN', 'SKILL_TERROR_SCREECH', 'SKILL_SHADOW_ASSAULT',
      'SKILL_FLAME_BURST', 'SKILL_FROST_BREATH', 'SKILL_IRON_DEFENSE', 'SKILL_FRENZY_ROAR'
    ];

    for (const reqId of requiredIds) {
      const found = (customSkillData as any[]).find(s => s.id === reqId);
      expect(found, `找不到積木技能: ${reqId}`).toBeDefined();
      expect(found.blocks.length).toBeGreaterThan(0);
    }
  });

  it('所有 10 款遷移的通用魔物技能皆可成功編譯並執行', () => {
    const monsterSkillIds = [
      'SKILL_TOXIC_SPRAY', 'SKILL_SAVAGE_REND', 'SKILL_CRUSHING_SLAM',
      'SKILL_BLOOD_DRAIN', 'SKILL_TERROR_SCREECH', 'SKILL_SHADOW_ASSAULT',
      'SKILL_FLAME_BURST', 'SKILL_FROST_BREATH', 'SKILL_IRON_DEFENSE', 'SKILL_FRENZY_ROAR'
    ];

    const caster = createMockFighter('monster_1', '測試魔物', false);
    const target = createMockFighter('hero_1', '測試勇者', true);

    for (const skillId of monsterSkillIds) {
      const skill = SkillRegistry.getSkill(skillId);
      expect(skill, `SkillRegistry 應能取到 ${skillId}`).toBeDefined();

      const events = skill!.execute(caster, [target], [target], [caster]);
      expect(events.length).toBeGreaterThan(0);
    }
  });
});
