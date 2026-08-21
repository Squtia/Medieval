import { describe, it, expect } from 'vitest';
import { MonsterSystem } from './MonsterSystem';
import { SkillRegistry } from './combat/SkillRegistry';
import { CombatSystem } from './CombatSystem';
import { MonsterProfile, MonsterRace, ElementType, TerrainType, DamageType } from '../models/types';
import monstersJson from '../data/monsters.json';
import { TargetType } from '../models/Skill';

describe('Monster Profiles & SkillRegistry Single Source of Truth', () => {
  const monsterSystem = new MonsterSystem();

  it('SkillRegistry accurately retrieves and classifies hero and monster skills', () => {
    // 驗證通用怪物技能
    const toxicSpray = SkillRegistry.getSkill('SKILL_TOXIC_SPRAY');
    expect(toxicSpray).toBeDefined();
    expect(toxicSpray?.name).toBe('劇毒噴吐');
    expect(toxicSpray?.category).toBe('MONSTER');

    const savageRend = SkillRegistry.getSkill('SKILL_SAVAGE_REND');
    expect(savageRend).toBeDefined();
    expect(savageRend?.name).toBe('撕裂爪擊');

    // 驗證冒險者基礎與進階技能
    const heavyStrike = SkillRegistry.getSkill('FIGHTER_HEAVY_STRIKE');
    expect(heavyStrike).toBeDefined();
    expect(heavyStrike?.category).toBe('HERO_BASE');

    const meteor = SkillRegistry.getSkill('STAFF_METEOR');
    expect(meteor).toBeDefined();
    expect(meteor?.category).toBe('HERO_ADVANCED');

    // 驗證分類獲取
    const monsterSkills = SkillRegistry.getAllMonsterSkills();
    expect(monsterSkills.length).toBeGreaterThanOrEqual(10);
    expect(monsterSkills.some(s => s.id === 'SKILL_CRUSHING_SLAM')).toBe(true);
  });

  it('SkillRegistry supports dynamic skill registration without double coding', () => {
    const customId = 'SKILL_TEST_CHAOS_BITE';
    SkillRegistry.registerSkill({
      id: customId,
      name: '混沌撕咬',
      mpCost: 10,
      targetType: TargetType.SINGLE_ENEMY,
      category: 'MONSTER',
      description: '造成 120% 物理傷害並附加 30% 混沌傷害。',
      execute: (caster, targets) => []
    });

    expect(SkillRegistry.hasSkill(customId)).toBe(true);
    const fetched = SkillRegistry.getSkill(customId);
    expect(fetched?.name).toBe('混沌撕咬');
    expect(fetched?.category).toBe('MONSTER');
  });

  it('MonsterSystem generates differentiated stats based on 8 Stat Profiles under locked budget', () => {
    const trollBase = monstersJson.find(m => m.id === 'troll')!; // JUGGERNAUT
    const wolfBase = monstersJson.find(m => m.id === 'wild_wolf')!; // ASSASSIN
    const golemBase = monstersJson.find(m => m.id === 'golem')!; // TANK
    const shamanBase = monstersJson.find(m => m.id === 'shaman')!; // MAGE

    const trollInst = monsterSystem.createMonsterInstance(trollBase as any, MonsterRace.MONSTER, ElementType.NONE, 2);
    const wolfInst = monsterSystem.createMonsterInstance(wolfBase as any, MonsterRace.MONSTER, ElementType.NONE, 2);
    const golemInst = monsterSystem.createMonsterInstance(golemBase as any, MonsterRace.MONSTER, ElementType.NONE, 2);
    const shamanInst = monsterSystem.createMonsterInstance(shamanBase as any, MonsterRace.HUMAN, ElementType.NONE, 2);

    // 驗證 Profile 特徵
    expect(trollInst.profile).toBe(MonsterProfile.JUGGERNAUT);
    expect(wolfInst.profile).toBe(MonsterProfile.ASSASSIN);
    expect(golemInst.profile).toBe(MonsterProfile.TANK);
    expect(shamanInst.profile).toBe(MonsterProfile.MAGE);

    // 巨魔 (JUGGERNAUT) 具備超高血量
    expect(trollInst.hp).toBeGreaterThan(200);
    // 肉盾傀儡物理防禦顯著高於法師薩滿
    expect((golemInst.pdef || 0)).toBeGreaterThan((shamanInst.pdef || 0));
    // 薩滿為法系攻擊者
    expect(shamanInst.isMagicalAttacker).toBe(true);
    // 刺客野狼具有刺客定位
    expect(wolfInst.profile).toBe(MonsterProfile.ASSASSIN);
    // 怪物正確帶入技能清單
    expect(trollInst.skills).toContain('SKILL_CRUSHING_SLAM');
    expect(wolfInst.skills).toContain('SKILL_SAVAGE_REND');
  });

  it('CombatSystem executes monster skills seamlessly in combat simulation', () => {
    const lizardBase = monstersJson.find(m => m.id === 'lizard')!;
    const lizardInst = monsterSystem.createMonsterInstance(lizardBase as any, MonsterRace.MONSTER, ElementType.NONE, 3);
    expect(lizardInst.skills).toContain('SKILL_TOXIC_SPRAY');

    // 進行一場戰鬥模擬
    const report = CombatSystem.simulateCombat(
      [],
      3,
      '',
      TerrainType.PLAINS,
      1,
      undefined,
      [lizardInst],
      undefined,
      undefined,
      undefined,
      [[lizardInst]]
    );

    expect(report).toBeDefined();
    expect(report.events.length).toBeGreaterThan(0);
  });
});
