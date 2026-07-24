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

  // 狂戰士被動：裝備巨劍時，無視 15% 防禦力
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
      const isHybrid = caster.weaponType === 'DUAL_SWORDS'; // 魔劍士覆寫
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
      const isHybrid = caster.weaponType === 'DUAL_SWORDS';
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
  // --- 一般進階：狂戰士 ---
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
  },
  // --- 法師系基礎技能 ---
  'MAGE_ARCANE_MISSILES': {
    id: 'MAGE_ARCANE_MISSILES',
    name: '奧術飛彈',
    mpCost: 8,
    targetType: TargetType.SINGLE_ENEMY, // 預設單體，但會根據敵方全體隨機打擊
    description: '消耗 8 MP。隨機對敵方發射 3 枚飛彈，每枚造成 60% 魔法傷害。',
    execute: (caster, targets, allEnemies) => {
      const events: CombatEvent[] = [];
      const aliveEnemies = allEnemies.filter(e => e.currentHp > 0);
      if (aliveEnemies.length === 0) return events;
      
      let totalDamage = 0;
      for (let i = 0; i < 3; i++) {
        const currentAlive = allEnemies.filter(e => e.currentHp > 0);
        if (currentAlive.length === 0) break;
        
        const target = Random.pick(currentAlive);
        const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * 0.6);
        target.currentHp = Math.max(0, target.currentHp - damage);
        totalDamage += damage;
        events.push({
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name,
          targetId: target.id, targetName: target.name,
          damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '奧術飛彈',
          text: `${caster.name} 的飛彈命中了 ${target.name}，造成 ${damage} 點傷害！`
        });
      }
      return events;
    }
  },
  'MAGE_STATIC_FIELD': {
    id: 'MAGE_STATIC_FIELD',
    name: '靜電新星',
    mpCost: 15,
    targetType: TargetType.ALL_ENEMIES,
    description: '消耗 15 MP。對敵方全體附加【感電】(迴避下降，受傷加深)，持續 2 回合。',
    execute: (caster, targets) => {
      const events: CombatEvent[] = [];
      targets.forEach(target => {
        target.statusEffects.push({ type: StatusEffectType.SHOCK, duration: 2 });
        events.push({
          type: CombatEventType.STATUS_APPLY,
          actorId: caster.id, actorName: caster.name,
          targetId: target.id, targetName: target.name,
          statusType: StatusEffectType.SHOCK,
          skillName: '靜電新星',
          text: `${target.name} 被靜電包圍，陷入了感電狀態！`
        });
      });
      return events;
    }
  },
  // --- 進階法師：大魔導士 ---
  'STAFF_METEOR': {
    id: 'STAFF_METEOR',
    name: '隕石轟炸',
    mpCost: 35,
    targetType: TargetType.ALL_ENEMIES,
    description: '消耗 35 MP。對敵方全體造成 150% 魔法傷害。(搭配法杖被動：必定命中且隨最大MP增傷)',
    execute: (caster, targets) => {
      const events: CombatEvent[] = [];
      targets.forEach(target => {
        // 大魔導士被動增傷：每 10 點 Max MP 增加 1% 傷害倍率
        const mpBonus = (caster.stats.mp / 10) * 0.01;
        const multiplier = 1.5 + mpBonus;
        const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * multiplier);
        target.currentHp = Math.max(0, target.currentHp - damage);
        events.push({
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name,
          targetId: target.id, targetName: target.name,
          damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '隕石轟炸',
          text: `${caster.name} 的隕石無情地砸在 ${target.name} 身上，造成了 ${damage} 點毀滅傷害！`
        });
      });
      return events;
    }
  },
  // --- 變異職業：死靈法師 ---
  'SCYTHE_SOUL_REAP': {
    id: 'SCYTHE_SOUL_REAP',
    name: '死神收割',
    mpCost: 30,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 30 MP。對單體造成 250% 傷害，若擊殺目標，則立刻無消耗對血量最低的敵人再次施放。',
    execute: (caster, targets, allEnemies) => {
      const events: CombatEvent[] = [];
      let currentTarget = targets[0];
      
      let chainCount = 0;
      while (currentTarget && currentTarget.currentHp > 0 && chainCount < 5) { // 設上限防死迴圈
        const { damage, isCrit } = calculateSkillDamage(caster, currentTarget, caster.stats.atk * 2.5);
        currentTarget.currentHp = Math.max(0, currentTarget.currentHp - damage);
        
        events.push({
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name,
          targetId: currentTarget.id, targetName: currentTarget.name,
          damage, targetHp: currentTarget.currentHp, targetMaxHp: currentTarget.maxHp,
          skillName: '死神收割',
          text: `${caster.name} 揮舞戰鐮，對 ${currentTarget.name} 造成 ${damage} 點致命傷害！`
        });
        
        // 靈魂虹吸(大招特別回饋，普攻在戰鬥主迴圈結算)
        // 擊殺判定
        if (currentTarget.currentHp <= 0) {
          events.push({
            type: CombatEventType.DEATH,
            targetName: currentTarget.name,
            text: `${currentTarget.name} 的靈魂被收割了！`
          });
          
          // 找下一個血量大於0且血最低的敵人
          const aliveEnemies = allEnemies.filter(e => e.currentHp > 0).sort((a, b) => a.currentHp - b.currentHp);
          if (aliveEnemies.length > 0) {
            currentTarget = aliveEnemies[0];
            chainCount++;
            events.push({
              type: CombatEventType.SKILL_CAST,
              actorId: caster.id, actorName: caster.name,
              skillName: '死神收割',
              text: `${caster.name} 觸發了靈魂連鎖，繼續收割 ${currentTarget.name}！`
            });
          } else {
            break;
          }
        } else {
          break; // 未擊殺則結束連鎖
        }
      }
      return events;
    }
  }
};
