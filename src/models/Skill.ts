import { CombatParticipant, CombatEvent, CombatEventType, StatusEffectType } from './Combat';
import { FormationRow } from './types';
import { Random } from '../core/Random';

export enum TargetType {
  SINGLE_ENEMY = 'SINGLE_ENEMY',
  ALL_ENEMIES = 'ALL_ENEMIES',
  FRONT_ENEMIES = 'FRONT_ENEMIES',
  SELF = 'SELF',
  ALLY_LOWEST_HP = 'ALLY_LOWEST_HP',
  ALL_ALLIES = 'ALL_ALLIES'
}

export interface Skill {
  id: string;
  name: string;
  mpCost: number;
  targetType: TargetType;
  description: string;
  /**
   * 執行技能效果，返回造成的事件
   * @param caster 施放者
   * @param targets 目標陣列
   * @param allEnemies 敵方全體 (用於一些特定技能邏輯)
   * @returns CombatEvent[] 產生的戰鬥事件
   */
  execute: (caster: CombatParticipant, targets: CombatParticipant[], allEnemies: CombatParticipant[]) => CombatEvent[];
}

// 通用的傷害計算與防禦減免函式 (給技能使用)
export function calculateSkillDamage(
  caster: CombatParticipant, 
  target: CombatParticipant, 
  baseDmg: number, 
  isHybrid: boolean = false
): { damage: number, isCrit: boolean } {
  const critChance = 0.05 + (caster.stats.hit / 500);
  const isCrit = Random.next() < critChance;
  let finalBase = baseDmg;
  if (isCrit) finalBase *= 1.5;

  let effectiveDef = target.stats.def;
  // 若目標處於破甲，減少 20%
  if (target.statusEffects.some(s => s.type === StatusEffectType.ARMOR_BREAK)) {
    effectiveDef = effectiveDef * 0.8;
  }

  // 大劍士被動：裝備巨劍時，無視 15% 防禦力
  if (caster.weaponType === 'GREATSWORD') {
    effectiveDef = effectiveDef * 0.85;
  }

  const dmgReduction = effectiveDef / (effectiveDef + 50);
  let finalDamage = Math.max(1, Math.floor(finalBase * (1 - dmgReduction)));
  finalDamage = Math.floor(finalDamage * (0.9 + Random.next() * 0.2));

  return { damage: finalDamage, isCrit };
}

export const SKILLS: Record<string, Skill> = {
  // --- 戰士系基礎技能 ---
  'FIGHTER_HEAVY_STRIKE': {
    id: 'FIGHTER_HEAVY_STRIKE',
    name: '奮力一擊',
    mpCost: 5,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 5 MP。造成 130% 物理傷害。',
    execute: (caster, targets) => {
      const target = targets[0];
      const isHybrid = caster.weaponType === 'DUAL_BLADES'; // 魔劍士覆寫
      const baseAtk = isHybrid ? (caster.stats.atk + caster.stats.mp/5) : caster.stats.atk; // 簡化：因為怪物系統沒分matk，假設 mp 上限/5 代表 INT
      const dmgMultiplier = isHybrid ? 0.8 : 1.3; // 若為混傷 80%，否則 130%
      
      const { damage, isCrit } = calculateSkillDamage(caster, target, baseAtk * dmgMultiplier, isHybrid);
      target.currentHp = Math.max(0, target.currentHp - damage);

      return [{
        type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
        actorId: caster.id, actorName: caster.name,
        targetId: target.id, targetName: target.name,
        damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '奮力一擊',
        text: `${caster.name} 使用了 奮力一擊！對 ${target.name} 造成了 ${damage} 點${isHybrid?'混合':'物理'}傷害！`
      }];
    }
  },
  'FIGHTER_ARMOR_BREAK': {
    id: 'FIGHTER_ARMOR_BREAK',
    name: '破甲碎擊',
    mpCost: 12,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 12 MP。造成 100% 物理傷害，必定附加破甲(防禦-20%)。',
    execute: (caster, targets) => {
      const target = targets[0];
      const isHybrid = caster.weaponType === 'DUAL_BLADES';
      const baseAtk = isHybrid ? (caster.stats.atk + caster.stats.mp/5) : caster.stats.atk;
      const dmgMultiplier = isHybrid ? 0.8 : 1.0;
      
      const { damage, isCrit } = calculateSkillDamage(caster, target, baseAtk * dmgMultiplier, isHybrid);
      target.currentHp = Math.max(0, target.currentHp - damage);
      
      // 附加破甲
      target.statusEffects.push({ type: StatusEffectType.ARMOR_BREAK, duration: 2 });

      return [
        {
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name,
          targetId: target.id, targetName: target.name,
          damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '破甲碎擊',
          text: `${caster.name} 使用了 破甲碎擊！對 ${target.name} 造成了 ${damage} 點傷害！`
        },
        {
          type: CombatEventType.STATUS_APPLY,
          targetId: target.id, targetName: target.name,
          statusType: StatusEffectType.ARMOR_BREAK,
          text: `${target.name} 的防禦被瓦解了！`
        }
      ];
    }
  },
  // --- 一般進階：大劍士 ---
  'GREATSWORD_WHIRLWIND': {
    id: 'GREATSWORD_WHIRLWIND',
    name: '旋風斬',
    mpCost: 30,
    targetType: TargetType.FRONT_ENEMIES,
    description: '消耗 30 MP。對敵方前排全體造成 180% 物理傷害 (若目標破甲則 250%)。',
    execute: (caster, targets) => {
      const events: CombatEvent[] = [];
      targets.forEach(target => {
        const isArmorBroken = target.statusEffects.some(s => s.type === StatusEffectType.ARMOR_BREAK);
        const multiplier = isArmorBroken ? 2.5 : 1.8;
        const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * multiplier);
        target.currentHp = Math.max(0, target.currentHp - damage);
        events.push({
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name,
          targetId: target.id, targetName: target.name,
          damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '旋風斬',
          text: `${caster.name} 對 ${target.name} 造成了 ${damage} 點物理傷害！`
        });
      });
      return events;
    }
  },
  // --- 變異職業：魔劍士 ---
  'MAGIC_SWORDSMAN_PHANTOM': {
    id: 'MAGIC_SWORDSMAN_PHANTOM',
    name: '幻影連擊',
    mpCost: 30,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 30 MP。對單體連續攻擊 4 次，每次造成 (ATK+MATK) 50% 混合傷害。',
    execute: (caster, targets) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      let totalDamage = 0;
      const baseHybridAtk = caster.stats.atk + caster.stats.mp/5; // 模擬 MATK

      for (let i = 0; i < 4; i++) {
        if (target.currentHp <= 0) break;
        const { damage, isCrit } = calculateSkillDamage(caster, target, baseHybridAtk * 0.5, true);
        target.currentHp = Math.max(0, target.currentHp - damage);
        totalDamage += damage;
        events.push({
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name,
          targetId: target.id, targetName: target.name,
          damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '幻影連擊',
          text: `${caster.name} 的連擊第 ${i+1} 下對 ${target.name} 造成了 ${damage} 點混合傷害！`
        });
      }
      return events;
    }
  }
};
