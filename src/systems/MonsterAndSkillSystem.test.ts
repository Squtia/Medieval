import { describe, it, expect } from 'vitest';
import { MonsterSystem } from './MonsterSystem';
import { SkillRegistry } from './combat/SkillRegistry';
import { CombatSystem } from './CombatSystem';
import { MonsterProfile, MonsterRace, ElementType, TerrainType, DamageType } from '../models/types';
import monstersJson from '../data/monsters.json';
import { TargetType } from '../models/Skill';
import { GameState } from '../core/GameState';
import { createUniqueAdventurer } from '../data/UniqueAdventurers';

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

  it('傳奇英雄已在隊伍或地牢時，據點波次守軍與戰鬥系統強制觸發代理副將替補，絕不刷出本尊', () => {
    // 1. 創建模擬據點模板，配置守關 Boss 為 enemy_ryan (赤焰戰神雷恩)
    const tpl = {
      id: 'node_ryan_stronghold',
      name: '赤焰要塞',
      waves: [
        {
          waveNumber: 1,
          monsters: [
            { monsterId: 'enemy_ryan', formationRow: 'FRONT' as any, gridR: 0, gridC: 1, powerTier: 2.0 }
          ]
        }
      ]
    };

    // 狀態 A：雷恩尚未被招募/收押，正常生成 enemy_ryan 本尊
    GameState.adventurers = [];
    if (!GameState.myTerritory) (GameState as any).myTerritory = {};
    GameState.myTerritory.dungeonPrisonerHeroIds = [];
    const instancesBefore = monsterSystem.createInstancesFromTemplateWaves(tpl as any);
    expect(instancesBefore.length).toBe(1);
    expect(instancesBefore[0].id).toBe('enemy_ryan');
    expect(instancesBefore[0].name).toContain('雷恩');
    expect(instancesBefore[0].name).not.toContain('【代理副將】');

    // 狀態 B：領主已招降雷恩 (雷恩進入 GameState.adventurers)
    const reynAdv = createUniqueAdventurer('reyn')!;
    expect(reynAdv).not.toBeNull();
    GameState.adventurers = [reynAdv];

    // 再次從據點生成守軍，驗證自動觸發代理副將替補
    const instancesAfter = monsterSystem.createInstancesFromTemplateWaves(tpl as any);
    expect(instancesAfter.length).toBe(1);
    expect(instancesAfter[0].id).not.toBe('enemy_ryan'); // 絕對不能是雷恩
    expect(instancesAfter[0].name).toContain('【代理副將】'); // 自動冠上代理副將

    // 狀態 C：驗證戰鬥系統 (CombatSystem) 的入口防禦
    // 即使有人強行傳入 [enemy_ryan 實例]，CombatSystem 也會自動觸發二次安檢並替換
    const ryanMonster = monsterSystem.getMonsterById('enemy_ryan')!;
    const combatReport = CombatSystem.simulateCombat(
      [reynAdv.id],
      10,
      '',
      TerrainType.PLAINS,
      1,
      undefined,
      [ryanMonster as any],
      undefined,
      undefined,
      undefined,
      [[ryanMonster as any]]
    );

    expect(combatReport).toBeDefined();
    // 驗證戰報中的敵方名稱已自動轉為代理副將，絕非雷恩
    const firstWaveEvent = combatReport.events.find(e => e.type === 'WAVE_START');
    expect(firstWaveEvent).toBeDefined();
    const enemyName = firstWaveEvent?.enemies?.[0]?.name;
    expect(enemyName).toContain('【代理副將】');
    expect(enemyName).not.toBe('赤焰戰神雷恩');
  });
});
