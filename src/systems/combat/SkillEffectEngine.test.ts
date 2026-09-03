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

  describe('Phase 6 積木技能核心擴充測試', () => {
    it('完成條件驗證: 可建立「單體傷害 → 自我治療 → 全隊 Buff」且三個 block 各自作用於正確目標', () => {
      const comboDef: CompositeSkillDefinition = {
        id: 'TEST_COMBO_MULTI_TARGET',
        name: '狂戰恩賜',
        icon: '⚔️',
        description: '打擊單體敵人，自我包紮，並激勵全體隊友',
        category: 'HERO_ADVANCED',
        mpCost: 20,
        blocks: [
          // Block 1: 單體敵人傷害
          {
            trigger: 'ACTIVE',
            effectType: 'DAMAGE_PHYSICAL',
            targetType: 'SINGLE_ENEMY' as any,
            multiplier: 1.2
          },
          // Block 2: 自我治療
          {
            trigger: 'ACTIVE',
            effectType: 'HEAL',
            targetType: 'SELF' as any,
            multiplier: 0.5
          },
          // Block 3: 全隊 Buff
          {
            trigger: 'ACTIVE',
            effectType: 'BUFF_ALLIES',
            targetType: 'ALL_ALLIES' as any,
            buffType: 'BUFF_PATK',
            buffValue: 25,
            buffDuration: 3
          }
        ]
      };

      const skill = SkillEffectEngine.compile(comboDef);

      const caster = createMockParticipant('hero_berserker', '狂戰士', true, 100, 30, 10);
      caster.currentHp = 40; // 施術者受損 HP
      const ally = createMockParticipant('hero_priest', '牧師', true, 80, 10, 25);
      const enemy = createMockParticipant('orc_boss', '獸人首領', false, 200, 20, 10);

      const allAllies = [caster, ally];
      const allEnemies = [enemy];

      // 執行：傳入主目標 enemy
      skill.execute(caster, [enemy], allEnemies, allAllies);

      // 1. 敵方首領承受傷害
      expect(enemy.currentHp).toBeLessThan(200);

      // 2. 施術者狂戰士自我治療回血
      expect(caster.currentHp).toBeGreaterThan(40);

      // 3. 全體隊友（含狂戰士與牧師）皆獲得 BUFF_PATK
      expect(caster.statusEffects.some(s => s.type === StatusEffectType.BUFF_PATK)).toBe(true);
      expect(ally.statusEffects.some(s => s.type === StatusEffectType.BUFF_PATK)).toBe(true);
      // 敵方絕對不應獲得友軍 BUFF
      expect(enemy.statusEffects.some(s => s.type === StatusEffectType.BUFF_PATK)).toBe(false);
    });

    it('應支援 block HP cost (扣除自身生命) 與 mark cost (消耗印記)', () => {
      const sacrificeDef: CompositeSkillDefinition = {
        id: 'TEST_SACRIFICE_STRIKE',
        name: '鮮血引爆',
        icon: '🩸',
        description: '消耗自身生命並引爆目標印記',
        category: 'HERO_ADVANCED',
        blocks: [
          {
            trigger: 'ACTIVE',
            cost: { hpPercent: 15, consumeMarks: true },
            effectType: 'DAMAGE_PHYSICAL',
            targetType: 'SINGLE_ENEMY' as any,
            multiplier: 1.5
          }
        ]
      };

      const skill = SkillEffectEngine.compile(sacrificeDef);
      const caster = createMockParticipant('blood_mage', '血巫', true, 100, 25, 20);
      const target = createMockParticipant('enemy_target', '目標', false, 150);
      target.statusEffects.push({ type: StatusEffectType.MARK, duration: 3, stacks: 2 });

      skill.execute(caster, [target], [target], [caster]);

      // 施術者自身扣減了 15% HP (15 點)
      expect(caster.currentHp).toBe(85);
      // 目標受傷害
      expect(target.currentHp).toBeLessThan(150);
      // 目標身上的 MARK 已被 consumeMarks 消除
      expect(target.statusEffects.some(s => s.type === StatusEffectType.MARK)).toBe(false);
    });

    it('應支援縮放策略 (scaleType: BY_SELF_LOST_HP 與 BY_MARK_STACKS)', () => {
      const revengeDef: CompositeSkillDefinition = {
        id: 'TEST_REVENGE',
        name: '死裡反撲',
        icon: '🔥',
        description: '損失生命越多傷害越高',
        category: 'HERO_ADVANCED',
        blocks: [
          {
            trigger: 'ACTIVE',
            scaleType: 'BY_SELF_LOST_HP',
            effectType: 'DAMAGE_PHYSICAL',
            targetType: 'SINGLE_ENEMY' as any,
            multiplier: 1.0
          }
        ]
      };

      const skill = SkillEffectEngine.compile(revengeDef);

      // Full HP 測試
      const casterFull = createMockParticipant('c1', '滿血戰士', true, 100, 30);
      const target1 = createMockParticipant('t1', '目標1', false, 200, 0, 0, 0, 0);
      skill.execute(casterFull, [target1], [target1], [casterFull]);
      const normalDmg = 200 - target1.currentHp;

      // Low HP (10% HP，損失 90%) 測試
      const casterDying = createMockParticipant('c2', '殘血戰士', true, 100, 30);
      casterDying.currentHp = 10;
      const target2 = createMockParticipant('t2', '目標2', false, 200, 0, 0, 0, 0);
      skill.execute(casterDying, [target2], [target2], [casterDying]);
      const boostedDmg = 200 - target2.currentHp;

      expect(boostedDmg).toBeGreaterThan(normalDmg);
    });

    it('應支援條件判斷 IS_CRIT 暴擊追擊', () => {
      const critFollowupDef: CompositeSkillDefinition = {
        id: 'TEST_CRIT_FOLLOWUP',
        name: '暴擊追殺',
        icon: '⚡',
        description: '若暴擊則追加物理打擊',
        category: 'HERO_ADVANCED',
        blocks: [
          {
            trigger: 'ACTIVE',
            condition: { type: 'IS_CRIT' },
            effectType: 'DAMAGE_PHYSICAL',
            targetType: 'SINGLE_ENEMY' as any,
            multiplier: 2.0
          }
        ]
      };

      const caster = createMockParticipant('c', '刺客', true, 100, 20);
      const target = createMockParticipant('t', '敵人', false, 100);

      // 上一段沒有暴擊 -> 條件不成立，回傳空事件
      const nonCritEvents = SkillEffectEngine.executeBlock(
        critFollowupDef.blocks[0],
        caster,
        [target],
        [target],
        [caster],
        0,
        false
      );
      expect(nonCritEvents.length).toBe(0);

      // 上一段發生暴擊 -> 條件成立，觸發追擊
      const critEvents = SkillEffectEngine.executeBlock(
        critFollowupDef.blocks[0],
        caster,
        [target],
        [target],
        [caster],
        0,
        true
      );
      expect(critEvents.length).toBeGreaterThan(0);
    });

    it('SkillRegistry 與 SkillEffectEngine.triggerHooks 應統一支援動態自訂技能', () => {
      const dynamicDef: CompositeSkillDefinition = {
        id: 'DYNAMIC_RETALIATE',
        name: '荊棘反震',
        icon: '🛡️',
        description: '受擊後反擊敵人',
        category: 'EQUIPMENT',
        blocks: [
          {
            trigger: 'ON_HIT_TAKEN',
            effectType: 'DAMAGE_PHYSICAL',
            targetType: 'SINGLE_ENEMY' as any,
            multiplier: 0.8
          }
        ]
      };

      // 1. 動態註冊
      SkillRegistry.registerCompositeSkill(dynamicDef);
      expect(SkillRegistry.hasSkill('DYNAMIC_RETALIATE')).toBe(true);

      // 2. 透過 triggerHooks 觸發 ON_HIT_TAKEN
      const tank = createMockParticipant('tank', '重裝衛士', true, 150, 25);
      tank.skills = ['DYNAMIC_RETALIATE'];
      const attacker = createMockParticipant('attacker', '襲擊者', false, 100);

      const hookEvents = SkillEffectEngine.triggerHooks(
        'ON_HIT_TAKEN',
        tank,
        [attacker],
        [attacker],
        [tank]
      );

      expect(hookEvents.length).toBeGreaterThan(0);
      expect(attacker.currentHp).toBeLessThan(100);
    });
  });
});
