import { CombatParticipant, CombatEvent, CombatEventType, StatusEffectType, tryApplyStatus } from './Combat';
import { FormationRow, DamageType } from './types';
import { Random } from '../core/Random';

export enum TargetType {
  SINGLE_ENEMY = 'SINGLE_ENEMY',
  ALL_ENEMIES = 'ALL_ENEMIES',
  FRONT_ENEMIES = 'FRONT_ENEMIES',
  BACK_ENEMY = 'BACK_ENEMY',
  COLUMN = 'COLUMN',
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
   * 技能的冷卻時間 (CD回合數)
   * 若未設定則預設為 0 (無冷卻)
   */
  cooldown?: number;
  /**
   * AI 權重評估：AI 決定是否施放此技能的優先度 (越高越優先)
   * 如果返回 0 或負數，AI 絕對不會施放該技能。
   * 若無提供此函式，預設回傳技能的 mpCost 作為權重。
   */
  aiWeight?: (caster: CombatParticipant, skillTargets: CombatParticipant[], allEnemies: CombatParticipant[], allAllies?: CombatParticipant[]) => number;
  /**
   * 執行技能效果，返回造成的事件
   * @param caster 施放者
   * @param targets 目標陣列
   * @param allEnemies 敵方全體 (用於一些特定技能邏輯)
   * @returns CombatEvent[] 產生的戰鬥事件
   */
  execute: (caster: CombatParticipant, targets: CombatParticipant[], allEnemies: CombatParticipant[], allAllies?: CombatParticipant[]) => CombatEvent[];
}

// 通用的傷害計算與防禦減免函式 (給技能使用)
export function calculateSkillDamage(
  caster: CombatParticipant, 
  target: CombatParticipant, 
  baseDmg: number, 
  damageType: DamageType = DamageType.PHYSICAL,
  forcedCrit?: boolean,
  forcedCritChance?: number
): { damage: number, isCrit: boolean } {
  let critChance = forcedCritChance !== undefined ? forcedCritChance : (0.05 + (caster.stats.hit / 500));
  
  if (caster.isAdvanced) {
    if (caster.weaponType === 'BOW') critChance += 0.20;
    else if (caster.weaponType === 'MAGIC_BOW') critChance += 0.25;
    else if (caster.weaponType === 'DAGGERS') critChance += 0.10;
  }
  
  const isCrit = forcedCrit || (Random.next() < critChance);
  
  // 1. 根據傷害屬性附加攻防方屬性倍率
  let atkMultiplier = 1.0;
  let defMultiplier = 1.0;
  
  if (damageType === DamageType.PHYSICAL) {
    atkMultiplier += (caster.attributes?.str || 0) / 100;
    defMultiplier += (target.attributes?.str || 0) / 100;
  } else if (damageType === DamageType.MAGICAL) {
    atkMultiplier += (caster.attributes?.int || 0) / 100;
    defMultiplier += (target.attributes?.int || 0) / 100;
  } else if (damageType === DamageType.CHAOS) {
    const cAvg = ((caster.attributes?.str || 0) + (caster.attributes?.int || 0)) / 2;
    const tAvg = ((target.attributes?.str || 0) + (target.attributes?.int || 0)) / 2;
    atkMultiplier += cAvg / 100;
    defMultiplier += tAvg / 100;
  }

  let finalBase = baseDmg * atkMultiplier;
  
  let critMult = 1.5;
  if (caster.isAdvanced && caster.weaponType === 'BOW') {
    critMult = 2.0;
  }
  
  if (isCrit) finalBase *= critMult;

  let effectiveDef = target.stats.def * defMultiplier;
  
  // 2. 狀態與被動防禦減免
  // 若目標處於破甲，減少 20%
  if (target.statusEffects.some(s => s.type === StatusEffectType.ARMOR_BREAK)) {
    effectiveDef = effectiveDef * 0.8;
  }

  // 狂戰士被動：裝備巨劍且已轉職時，無視 15% 防禦力
  if (caster.isAdvanced && caster.weaponType === 'GREATSWORD') {
    effectiveDef = effectiveDef * 0.85;
  }

  // 3. 最終傷害結算 (護甲公式)
  let dmgReduction = 0;
  if (damageType !== DamageType.CHAOS) {
    dmgReduction = effectiveDef / (effectiveDef + 50);
  }
  let finalDamage = Math.max(1, Math.floor(finalBase * (1 - dmgReduction)));

  // 4. 進階職業被動防禦減免
  if (target.isAdvanced && target.weaponType === 'SWORD_AND_SHIELD') { // 聖騎士
    if (damageType === DamageType.PHYSICAL) finalDamage *= 0.7;
    if (damageType === DamageType.MAGICAL) finalDamage *= 0.9;
  } else if (target.isAdvanced && target.weaponType === 'RUNE_SHIELD') { // 符文騎士
    if (damageType === DamageType.MAGICAL) finalDamage *= 0.7;
    if (damageType === DamageType.PHYSICAL) finalDamage *= 0.9;
  }

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
    aiWeight: () => 50,
    execute: (caster, targets) => {
      const target = targets[0];
      const isHybrid = caster.weaponType === 'DUAL_SWORDS'; // 魔劍士覆寫
      let damage = 0;
      let isCrit = false;

      if (isHybrid) {
        const phys = calculateSkillDamage(caster, target, caster.stats.atk * 0.65, DamageType.PHYSICAL); // 130% 的 50%
        const mag = calculateSkillDamage(caster, target, caster.stats.atk * 0.65, DamageType.MAGICAL);
        damage = phys.damage + mag.damage;
        isCrit = phys.isCrit || mag.isCrit;
      } else {
        const result = calculateSkillDamage(caster, target, caster.stats.atk * 1.3, DamageType.PHYSICAL);
        damage = result.damage;
        isCrit = result.isCrit;
      }
      
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
    aiWeight: (caster, targets) => {
      if (targets[0].statusEffects.some(s => s.type === StatusEffectType.ARMOR_BREAK)) return 0;
      return 80;
    },
    execute: (caster, targets) => {
      const target = targets[0];
      const isHybrid = caster.weaponType === 'DUAL_SWORDS';
      let damage = 0;
      let isCrit = false;

      if (isHybrid) {
        const phys = calculateSkillDamage(caster, target, caster.stats.atk * 0.5, DamageType.PHYSICAL); // 100% 的 50%
        const mag = calculateSkillDamage(caster, target, caster.stats.atk * 0.5, DamageType.MAGICAL);
        damage = phys.damage + mag.damage;
        isCrit = phys.isCrit || mag.isCrit;
      } else {
        const result = calculateSkillDamage(caster, target, caster.stats.atk * 1.0, DamageType.PHYSICAL);
        damage = result.damage;
        isCrit = result.isCrit;
      }
      
      target.currentHp = Math.max(0, target.currentHp - damage);
      
      const events: CombatEvent[] = [
        {
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name,
          targetId: target.id, targetName: target.name,
          damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '破甲碎擊',
          text: `${caster.name} 使用了 破甲碎擊！對 ${target.name} 造成了 ${damage} 點傷害！`
        }
      ];
      
      if (target.currentHp > 0) {
        events.push(tryApplyStatus(target, { type: StatusEffectType.ARMOR_BREAK, duration: 2 }, caster.name, '破甲碎擊', `${target.name} 的防禦被瓦解了！`));
      }

      return events;
    }
  },
  // --- 一般進階：狂戰士 ---
  'GREATSWORD_WHIRLWIND': {
    id: 'GREATSWORD_WHIRLWIND',
    name: '旋風斬',
    mpCost: 30,
    targetType: TargetType.FRONT_ENEMIES,
    description: '消耗 30 MP。對敵方前排全體造成 180% 物理傷害 (若目標破甲則 250%)。',
    cooldown: 2,
    aiWeight: (caster, targets) => {
      const hasArmorBroken = targets.some(t => t.statusEffects.some(s => s.type === StatusEffectType.ARMOR_BREAK));
      return hasArmorBroken ? 200 : 100;
    },
    execute: (caster, targets) => {
      const events: CombatEvent[] = [];
      targets.forEach(target => {
        const isArmorBroken = target.statusEffects.some(s => s.type === StatusEffectType.ARMOR_BREAK);
        const multiplier = isArmorBroken ? 2.5 : 1.8;
        const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * multiplier, DamageType.PHYSICAL);
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
    description: '消耗 30 MP。對單體連續攻擊 4 次，每次造成 30% 物理與 70% 魔法的混合傷害。',
    cooldown: 2,
    aiWeight: () => 120,
    execute: (caster, targets) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      let totalDamage = 0;

      for (let i = 0; i < 4; i++) {
        if (target.currentHp <= 0) break;
        const phys = calculateSkillDamage(caster, target, caster.stats.atk * 0.3, DamageType.PHYSICAL);
        const mag = calculateSkillDamage(caster, target, caster.stats.atk * 0.7, DamageType.MAGICAL);
        const damage = phys.damage + mag.damage;
        const isCrit = phys.isCrit || mag.isCrit;
        
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
    aiWeight: () => 60,
    execute: (caster, targets, allEnemies) => {
      const events: CombatEvent[] = [];
      const aliveEnemies = allEnemies.filter(e => e.currentHp > 0);
      if (aliveEnemies.length === 0) return events;
      
      let totalDamage = 0;
      for (let i = 0; i < 3; i++) {
        const currentAlive = allEnemies.filter(e => e.currentHp > 0);
        if (currentAlive.length === 0) break;
        
        const target = Random.pick(currentAlive);
        const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * 0.6, DamageType.MAGICAL);
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
    aiWeight: (caster, targets) => {
      const allShocked = targets.every(t => t.statusEffects.some(s => s.type === StatusEffectType.SHOCK));
      return allShocked ? 0 : 90;
    },
    execute: (caster, targets) => {
      const events: CombatEvent[] = [];
      targets.forEach(target => {
        events.push(tryApplyStatus(target, { type: StatusEffectType.SHOCK, duration: 2 }, caster.name, '靜電新星', `${target.name} 被靜電包圍，陷入了感電狀態！`));
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
    cooldown: 2,
    aiWeight: () => 150,
    execute: (caster, targets) => {
      const events: CombatEvent[] = [];
      targets.forEach(target => {
        // 大魔導士被動增傷：每 10 點 Max MP 增加 1% 傷害倍率
        const mpBonus = (caster.stats.mp / 10) * 0.01;
        const multiplier = 1.5 + mpBonus;
        const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * multiplier, DamageType.MAGICAL);
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
    cooldown: 2,
    aiWeight: (caster, targets) => {
      const hpRatio = targets[0].currentHp / targets[0].maxHp;
      return hpRatio < 0.4 ? 200 : 150; // 血量低容易擊殺連鎖，權重提升
    },
    execute: (caster, targets, allEnemies) => {
      const events: CombatEvent[] = [];
      let currentTarget = targets[0];
      
      let chainCount = 0;
      while (currentTarget && currentTarget.currentHp > 0 && chainCount < 5) { // 設上限防死迴圈
        const { damage, isCrit } = calculateSkillDamage(caster, currentTarget, caster.stats.atk * 2.5, DamageType.CHAOS);
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
  },
  // --- 騎士系基礎技能 ---
  'KNIGHT_SHIELD_BASH': {
    id: 'KNIGHT_SHIELD_BASH',
    name: '盾擊',
    mpCost: 15,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 15 MP。造成物理傷害，並有極高機率附加暈眩。',
    aiWeight: () => 70,
    execute: (caster, targets) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * 1.2, DamageType.PHYSICAL);
      target.currentHp = Math.max(0, target.currentHp - damage);
      
      events.push({
        type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
        actorId: caster.id, actorName: caster.name,
        targetId: target.id, targetName: target.name,
        damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '盾擊',
        text: `${caster.name} 舉盾猛擊 ${target.name}，造成 ${damage} 點物理傷害！`
      });

      if (Random.next() < 0.7) {
        events.push(tryApplyStatus(target, { type: StatusEffectType.STUN, duration: 1 }, caster.name, '盾擊', `${target.name} 被盾擊震昏了！`));
      }
      return events;
    }
  },
  'KNIGHT_TAUNT': {
    id: 'KNIGHT_TAUNT',
    name: '掩護',
    mpCost: 20,
    targetType: TargetType.SELF,
    description: '消耗 20 MP。為自身附加嘲諷狀態，持續 2 回合。',
    aiWeight: (caster) => {
      if (caster.statusEffects.some(s => s.type === StatusEffectType.TAUNT)) return 0;
      return 100;
    },
    execute: (caster) => {
      caster.statusEffects.push({ type: StatusEffectType.TAUNT, duration: 2 });
      return [{
        type: CombatEventType.STATUS_APPLY,
        actorId: caster.id, actorName: caster.name,
        targetId: caster.id, targetName: caster.name,
        statusType: StatusEffectType.TAUNT,
        skillName: '掩護',
        text: `${caster.name} 舉起盾牌吸引了所有敵人的注意！`
      }];
    }
  },
  // --- 進階騎士：聖騎士 ---
  'KNIGHT_PALADIN_AEGIS': {
    id: 'KNIGHT_PALADIN_AEGIS',
    name: '神聖庇護',
    mpCost: 35,
    targetType: TargetType.ALL_ALLIES,
    description: '消耗 35 MP。為全體隊友提供基於自身防禦力的高額生命恢復 (模擬護盾)。',
    cooldown: 2,
    aiWeight: (caster, targets, allEnemies, allies) => {
      if (!allies || allies.length === 0) return 0;
      const avgHp = allies.reduce((sum, a) => sum + (a.currentHp / a.maxHp), 0) / allies.length;
      if (avgHp > 0.8) return 0;
      return 200 - Math.floor(avgHp * 100);
    },
    execute: (caster, targets) => {
      const events: CombatEvent[] = [];
      const shieldAmount = Math.floor(caster.stats.def * 2.5);
      
      targets.forEach(target => {
        const heal = shieldAmount;
        target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
        events.push({
          type: CombatEventType.HEAL,
          actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
          damage: heal, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '神聖庇護',
          text: `${caster.name} 施放神聖庇護，為 ${target.name} 恢復了 ${heal} 點生命！`
        });
      });
      return events;
    }
  },
  // --- 變異騎士：符文騎士 ---
  'KNIGHT_RUNE_REFLECTION': {
    id: 'KNIGHT_RUNE_REFLECTION',
    name: '符文反制',
    mpCost: 40,
    targetType: TargetType.ALL_ENEMIES,
    description: '消耗 40 MP。對全體敵人造成無視防禦的混沌傷害，並為全體隊友附加 2 回合生命恢復。',
    cooldown: 2,
    aiWeight: () => 150,
    execute: (caster, targets, allEnemies, allies) => {
      const events: CombatEvent[] = [];
      targets.forEach(target => {
        const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * 1.5, DamageType.CHAOS);
        target.currentHp = Math.max(0, target.currentHp - damage);
        events.push({
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
          damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '符文反制',
          text: `${caster.name} 引爆符文，對 ${target.name} 造成了 ${damage} 點混沌傷害！`
        });
      });
      
      if (allies) {
        allies.forEach(ally => {
          if (ally.currentHp > 0) {
            ally.statusEffects.push({ type: StatusEffectType.REGEN_HP, duration: 2, value: Math.floor(caster.stats.def * 0.5) });
            events.push({
              type: CombatEventType.STATUS_APPLY,
              actorName: caster.name, targetName: ally.name, statusType: StatusEffectType.REGEN_HP,
              text: `${ally.name} 獲得了符文的生命恢復效果！`
            });
          }
        });
      }
      return events;
    }
  },
  // --- 祈禱者系基礎技能 ---
  'PRAYER_HEAL': {
    id: 'PRAYER_HEAL',
    name: '治療術',
    mpCost: 15,
    targetType: TargetType.ALLY_LOWEST_HP,
    description: '消耗 15 MP。恢復單一隊友大量生命值。',
    aiWeight: (caster, targets) => {
      const target = targets[0];
      if (!target || target.currentHp <= 0) return 0;
      const hpRatio = target.currentHp / target.maxHp;
      if (hpRatio > 0.8) return 0;
      return 200 - Math.floor(hpRatio * 150);
    },
    execute: (caster, targets) => {
      const target = targets[0];
      let baseHeal = (caster.attributes?.int || caster.stats.atk) * 2.0;
      if (caster.isAdvanced && caster.weaponType === 'HOLY_BOOK') {
        baseHeal *= 1.3;
      }
      const heal = Math.floor(baseHeal * (0.9 + Random.next() * 0.2));
      target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
      return [{
        type: CombatEventType.HEAL,
        actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
        damage: heal, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '治療術',
        text: `${caster.name} 施放治療術，讓 ${target.name} 恢復了 ${heal} 點生命！`
      }];
    }
  },
  'PRAYER_HOLY_LIGHT': {
    id: 'PRAYER_HOLY_LIGHT',
    name: '聖光擊',
    mpCost: 20,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 20 MP。造成魔法傷害。(裝備戰鎚時轉為混合傷害)',
    aiWeight: () => 60,
    execute: (caster, targets) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      let totalDamage = 0;
      let isTotalCrit = false;

      if (caster.isAdvanced && caster.weaponType === 'HAMMER') {
         const phys = calculateSkillDamage(caster, target, caster.stats.atk * 1.5 * 0.4, DamageType.PHYSICAL);
         const mag = calculateSkillDamage(caster, target, caster.stats.atk * 1.5 * 0.6, DamageType.MAGICAL);
         totalDamage = phys.damage + mag.damage;
         isTotalCrit = phys.isCrit || mag.isCrit;
      } else {
         const result = calculateSkillDamage(caster, target, caster.stats.atk * 1.5, DamageType.MAGICAL);
         totalDamage = result.damage;
         isTotalCrit = result.isCrit;
      }

      target.currentHp = Math.max(0, target.currentHp - totalDamage);
      events.push({
        type: isTotalCrit ? CombatEventType.CRIT : CombatEventType.HIT,
        actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
        damage: totalDamage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '聖光擊',
        text: `${caster.name} 召喚聖光打擊 ${target.name}，造成了 ${totalDamage} 點傷害！`
      });
      return events;
    }
  },
  // --- 進階祈禱者：大主教 ---
  'PRAYER_ARCHBISHOP_MASS_HEAL': {
    id: 'PRAYER_ARCHBISHOP_MASS_HEAL',
    name: '神聖之雨',
    mpCost: 45,
    targetType: TargetType.ALL_ALLIES,
    description: '消耗 45 MP。為全體隊友恢復大量生命，並消除所有負面狀態。',
    cooldown: 2,
    aiWeight: (caster, targets, allEnemies, allies) => {
      if (!allies || allies.length === 0) return 0;
      const avgHp = allies.reduce((sum, a) => sum + (a.currentHp / a.maxHp), 0) / allies.length;
      const needsDispel = allies.some(a => a.statusEffects.some(s => ['BLEED', 'POISON', 'STUN', 'ARMOR_BREAK', 'SHOCK'].includes(s.type)));
      if (avgHp > 0.8 && !needsDispel) return 0;
      return needsDispel ? 300 : (200 - Math.floor(avgHp * 150));
    },
    execute: (caster, targets) => {
      const events: CombatEvent[] = [];
      let baseHeal = (caster.attributes?.int || caster.stats.atk) * 1.5;
      baseHeal *= 1.3; 
      targets.forEach(target => {
        const heal = Math.floor(baseHeal * (0.9 + Random.next() * 0.2));
        target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
        target.statusEffects = target.statusEffects.filter(s => ['TAUNT', 'REGEN_HP', 'REGEN_MP'].includes(s.type));
        events.push({
          type: CombatEventType.HEAL,
          actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
          damage: heal, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '神聖之雨',
          text: `${caster.name} 降下神聖之雨，${target.name} 恢復了 ${heal} 點生命並清除了負面狀態！`
        });
      });
      return events;
    }
  },
  // --- 變異祈禱者：異端拷問官 ---
  'PRAYER_INQUISITOR_JUDGMENT': {
    id: 'PRAYER_INQUISITOR_JUDGMENT',
    name: '終焉審判',
    mpCost: 50,
    targetType: TargetType.SINGLE_ENEMY, // 確認單體
    description: '消耗 50 MP。對單體造成高額混合傷害 (70% 物理 + 30% 魔法)，並為全體隊友恢復中量 HP 與微量 MP。',
    cooldown: 2,
    aiWeight: () => 180,
    execute: (caster, targets, allEnemies, allies) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      
      const phys = calculateSkillDamage(caster, target, caster.stats.atk * 3.0 * 0.7, DamageType.PHYSICAL);
      const mag = calculateSkillDamage(caster, target, caster.stats.atk * 3.0 * 0.3, DamageType.MAGICAL);
      const totalDamage = phys.damage + mag.damage;
      const isTotalCrit = phys.isCrit || mag.isCrit;
      
      target.currentHp = Math.max(0, target.currentHp - totalDamage);
      events.push({
        type: isTotalCrit ? CombatEventType.CRIT : CombatEventType.HIT,
        actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
        damage: totalDamage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '終焉審判',
        text: `${caster.name} 降下終焉審判，對 ${target.name} 造成了 ${totalDamage} 點混合傷害！`
      });

      if (allies) {
        let healHp = Math.floor((caster.attributes?.int || caster.stats.atk) * 1.0);
        let healMp = Math.floor((caster.attributes?.int || caster.stats.atk) * 0.1) || 5;
        allies.forEach(ally => {
          if (ally.currentHp > 0) {
            ally.currentHp = Math.min(ally.maxHp, ally.currentHp + healHp);
            ally.stats.mp = Math.min(200, ally.stats.mp + healMp); 
            events.push({
              type: CombatEventType.HEAL,
              actorName: caster.name, targetName: ally.name,
              text: `${ally.name} 受到審判的賜福，恢復了 ${healHp} 點 HP 與 ${healMp} 點 MP！`
            });
          }
        });
      }
      return events;
    }
  },
  // --- 弓箭手系基礎技能 ---
  'ARCHER_PIERCING_SHOT': {
    id: 'ARCHER_PIERCING_SHOT',
    name: '貫穿射擊',
    mpCost: 10,
    targetType: TargetType.COLUMN,
    description: '消耗 10 MP。直線一排攻擊，造成 90% 物理傷害，並附加「破甲」狀態。',
    aiWeight: (caster, targets) => {
      const hasArmorBroken = targets.some(t => t.statusEffects.some(s => s.type === StatusEffectType.ARMOR_BREAK));
      return hasArmorBroken ? 40 : 80;
    },
    execute: (caster, targets, allEnemies) => {
      const events: CombatEvent[] = [];
      for (const target of targets) {
        let baseDmg = caster.stats.atk * 0.9;
        if (caster.isAdvanced && caster.weaponType === 'MAGIC_BOW') {
          const phys = calculateSkillDamage(caster, target, baseDmg, DamageType.PHYSICAL);
          const mag = calculateSkillDamage(caster, target, caster.stats.atk * 0.15, DamageType.MAGICAL, phys.isCrit);
          const totalDmg = phys.damage + mag.damage;
          target.currentHp = Math.max(0, target.currentHp - totalDmg);
          events.push({
            type: phys.isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
            actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
            damage: totalDmg, targetHp: target.currentHp, targetMaxHp: target.maxHp,
            skillName: '貫穿射擊',
            text: `${caster.name} 發射貫穿射擊，對 ${target.name} 造成 ${totalDmg} 點混合傷害！`
          });
        } else {
          const { damage, isCrit } = calculateSkillDamage(caster, target, baseDmg, DamageType.PHYSICAL);
          target.currentHp = Math.max(0, target.currentHp - damage);
          events.push({
            type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
            actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
            damage: damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
            skillName: '貫穿射擊',
            text: `${caster.name} 發射貫穿射擊，對 ${target.name} 造成 ${damage} 點物理傷害！`
          });
        }
        if (target.currentHp > 0) {
          events.push(tryApplyStatus(target, { type: StatusEffectType.ARMOR_BREAK, duration: 2 }, caster.name, '貫穿射擊', `${target.name} 的護甲被擊碎了！`));
        }
      }
      return events;
    }
  },
  'ARCHER_AIMED_SHOT': {
    id: 'ARCHER_AIMED_SHOT',
    name: '精準射擊',
    mpCost: 8,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 8 MP。對單體造成 150% 物理傷害。',
    aiWeight: () => 60,
    execute: (caster, targets, allEnemies) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      let baseDmg = caster.stats.atk * 1.5;
      if (caster.isAdvanced && caster.weaponType === 'MAGIC_BOW') {
        const phys = calculateSkillDamage(caster, target, baseDmg, DamageType.PHYSICAL);
        const mag = calculateSkillDamage(caster, target, caster.stats.atk * 0.15, DamageType.MAGICAL, phys.isCrit);
        const totalDmg = phys.damage + mag.damage;
        target.currentHp = Math.max(0, target.currentHp - totalDmg);
        events.push({
          type: phys.isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
          damage: totalDmg, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '精準射擊',
          text: `${caster.name} 精準射擊，對 ${target.name} 造成 ${totalDmg} 點混合傷害！`
        });
      } else {
        const { damage, isCrit } = calculateSkillDamage(caster, target, baseDmg, DamageType.PHYSICAL);
        target.currentHp = Math.max(0, target.currentHp - damage);
        events.push({
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
          damage: damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '精準射擊',
          text: `${caster.name} 精準射擊，對 ${target.name} 造成 ${damage} 點物理傷害！`
        });
      }
      return events;
    }
  },
  // --- 一般弓箭手：神射手 ---
  'SNIPER_FATAL_SNIPE': {
    id: 'SNIPER_FATAL_SNIPE',
    name: '致命狙擊',
    mpCost: 50,
    targetType: TargetType.BACK_ENEMY,
    description: '消耗 50 MP。對後排單一敵人造成 200% 物理傷害。',
    cooldown: 2,
    aiWeight: () => 180,
    execute: (caster, targets, allEnemies) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * 2.0, DamageType.PHYSICAL);
      target.currentHp = Math.max(0, target.currentHp - damage);
      events.push({
        type: CombatEventType.CRIT,
        actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
        damage: damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '致命狙擊',
        text: `${caster.name} 屏氣凝神，一發致命狙擊貫穿了 ${target.name}，造成 ${damage} 點毀滅性傷害！`
      });
      return events;
    }
  },
  // --- 變異弓箭手：精靈使 ---
  'SPIRIT_ARCHER_SPIRIT_CHAIN': {
    id: 'SPIRIT_ARCHER_SPIRIT_CHAIN',
    name: '風精靈之舞',
    mpCost: 35,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 35 MP。發動 80% 物理攻擊，若爆擊則發動 100% 魔法攻擊，最高連鎖 10 次。',
    cooldown: 2,
    aiWeight: () => 160,
    execute: (caster, targets, allEnemies) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      
      let baseCrit = 0.05 + (caster.stats.hit / 500) + 0.25; // Base + Hit + Passive
      let currentCritChance = baseCrit;
      let chainCount = 0;
      let totalDmg = 0;
      
      const phys = calculateSkillDamage(caster, target, caster.stats.atk * 0.8, DamageType.PHYSICAL, false, currentCritChance);
      totalDmg += phys.damage;
      target.currentHp = Math.max(0, target.currentHp - phys.damage);
      events.push({
        type: phys.isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
        actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
        damage: phys.damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '風精靈之舞',
        text: `${caster.name} 射出物理箭矢，對 ${target.name} 造成 ${phys.damage} 點傷害！`
      });
      
      let isLastCrit = phys.isCrit;
      
      while (isLastCrit && chainCount < 10 && target.currentHp > 0) {
        chainCount++;
        currentCritChance = Math.max(0.15, currentCritChance - 0.10);
        const mag = calculateSkillDamage(caster, target, caster.stats.atk * 1.0, DamageType.MAGICAL, false, currentCritChance);
        totalDmg += mag.damage;
        target.currentHp = Math.max(0, target.currentHp - mag.damage);
        events.push({
          type: mag.isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
          damage: mag.damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '風精靈之舞',
          text: `精靈追擊 (${chainCount})！對 ${target.name} 造成 ${mag.damage} 點魔法傷害！`
        });
        isLastCrit = mag.isCrit;
      }
      
      return events;
    }
  },
  // --- 盜賊系基礎技能 ---
  'THIEF_SURPRISE_ATTACK': {
    id: 'THIEF_SURPRISE_ATTACK',
    name: '突襲',
    mpCost: 10,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 10 MP。血量 >= 70% 傷害提升至 150%。',
    aiWeight: (caster, targets) => {
      const target = targets[0];
      const isTrickster = caster.isAdvanced && caster.weaponType === 'MAGIC_RING';
      const isAssassin = caster.isAdvanced && caster.weaponType === 'DAGGERS';
      const hpRatio = target.currentHp / target.maxHp;
      
      let weight = 50;
      if (isTrickster) {
        const poison = target.statusEffects.find(s => s.type === StatusEffectType.POISON);
        if (poison && poison.stacks) {
          weight = 50 + (poison.stacks * 50); // 每層毒素 +50，滿層 300 絕對優先
        }
      } else if (isAssassin && hpRatio >= 0.7) {
        weight = 120; // 血量高時優先打
      }
      return weight;
    },
    execute: (caster, targets, allEnemies) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      const hpRatio = target.currentHp / target.maxHp;
      let mult = hpRatio >= 0.7 ? 1.5 : 0.8;
      
      if (caster.isAdvanced && caster.weaponType === 'DAGGERS' && hpRatio >= 0.7) {
        mult *= 1.3; // 暗殺者被動增傷
      }
      
      if (caster.isAdvanced && caster.weaponType === 'MAGIC_RING') {
        mult *= 0.5; // 50% Chaos base
        let poisonStacks = 0;
        const poisonEffect = target.statusEffects.find(s => s.type === StatusEffectType.POISON);
        if (poisonEffect && poisonEffect.stacks) {
          poisonStacks = poisonEffect.stacks;
          mult *= (1 + poisonStacks * 0.10); // +10% per stack
          target.statusEffects = target.statusEffects.filter(s => s.type !== StatusEffectType.POISON);
        }
        
        const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * mult, DamageType.CHAOS);
        target.currentHp = Math.max(0, target.currentHp - damage);
        events.push({
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
          damage: damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '突襲',
          text: `${caster.name} 突襲並引爆了毒素(共 ${poisonStacks} 層)，造成 ${damage} 點混沌傷害！`
        });
      } else {
        const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * mult, DamageType.PHYSICAL);
        target.currentHp = Math.max(0, target.currentHp - damage);
        events.push({
          type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
          actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
          damage: damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
          skillName: '突襲',
          text: `${caster.name} 突襲了 ${target.name}，造成 ${damage} 點物理傷害！`
        });
      }
      return events;
    }
  },
  'THIEF_POISON_BLADE': {
    id: 'THIEF_POISON_BLADE',
    name: '淬毒之刃',
    mpCost: 12,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 12 MP。造成 80% 物理傷害附加中毒。詭術師施展轉為 20% 混沌傷害且毒素可疊加。',
    aiWeight: (caster, targets) => {
      const target = targets[0];
      const isTrickster = caster.isAdvanced && caster.weaponType === 'MAGIC_RING';
      const poison = target.statusEffects.find(s => s.type === StatusEffectType.POISON);
      if (isTrickster) {
        if (!poison) return 150; // 沒毒優先上
        if (poison.stacks === 5) return 0; // 滿毒不放，交給突襲引爆
        return 100;
      }
      return poison ? 0 : 80; // 其他職業如果有毒就換招
    },
    execute: (caster, targets, allEnemies) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      const hpRatio = target.currentHp / target.maxHp;
      let dmgMult = 0.8;
      let dmgType = DamageType.PHYSICAL;
      let isTrickster = caster.isAdvanced && caster.weaponType === 'MAGIC_RING';
      let isAssassin = caster.isAdvanced && caster.weaponType === 'DAGGERS';
      
      if (isTrickster) {
        dmgMult = 0.2;
        dmgType = DamageType.CHAOS;
      } else if (isAssassin && hpRatio >= 0.7) {
        dmgMult *= 1.3;
      }

      const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * dmgMult, dmgType);
      target.currentHp = Math.max(0, target.currentHp - damage);
      events.push({
        type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
        actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
        damage: damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '淬毒之刃',
        text: `${caster.name} 揮舞淬毒之刃，造成 ${damage} 點${isTrickster ? '混沌' : '物理'}傷害！`
      });
      
      if (target.currentHp > 0) {
        if (isTrickster) {
          const stacksToAdd = isCrit ? 2 : 1;
          let existing = target.statusEffects.find(s => s.type === StatusEffectType.POISON);
          if (existing) {
            existing.stacks = Math.min(5, (existing.stacks || 1) + stacksToAdd);
            existing.duration = Math.max(existing.duration, 3);
            events.push({ type: CombatEventType.STATUS_APPLY, targetId: target.id, targetName: target.name, statusType: StatusEffectType.POISON, text: `${target.name} 中毒了 (增加 ${stacksToAdd} 層)！` });
          } else {
            events.push(tryApplyStatus(target, { type: StatusEffectType.POISON, duration: 3, stacks: stacksToAdd, value: 5 }, caster.name, '淬毒之刃', `${target.name} 中毒了 (增加 ${stacksToAdd} 層)！`));
          }
        } else {
          let existing = target.statusEffects.find(s => s.type === StatusEffectType.POISON);
          if (existing) {
            existing.duration = Math.max(existing.duration, 3);
            existing.stacks = 1;
            events.push({ type: CombatEventType.STATUS_APPLY, targetId: target.id, targetName: target.name, statusType: StatusEffectType.POISON, text: `${target.name} 陷入了中毒狀態！` });
          } else {
            events.push(tryApplyStatus(target, { type: StatusEffectType.POISON, duration: 3, stacks: 1, value: 5 }, caster.name, '淬毒之刃', `${target.name} 陷入了中毒狀態！`));
          }
        }
      }
      return events;
    }
  },
  // --- 一般盜賊：暗殺者 ---
  'ASSASSIN_SHADOW_ASSASSINATION': {
    id: 'ASSASSIN_SHADOW_ASSASSINATION',
    name: '瞬影殺',
    mpCost: 30,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 30 MP。對單體造成 180% 物理傷害。血量 >= 70% 必爆擊且附加流血。',
    cooldown: 2,
    aiWeight: (caster, targets) => {
      const target = targets[0];
      if ((target.currentHp / target.maxHp) >= 0.7) return 200; // 條件滿足，必出
      return 80;
    },
    execute: (caster, targets, allEnemies) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      const isHealthy = (target.currentHp / target.maxHp) >= 0.7;
      
      const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * 1.8, DamageType.PHYSICAL, isHealthy);
      target.currentHp = Math.max(0, target.currentHp - damage);
      events.push({
        type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
        actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
        damage: damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '瞬影殺',
        text: `${caster.name} 化為暗影，對 ${target.name} 造成 ${damage} 點致命傷害！`
      });
      
      if (isHealthy && target.currentHp > 0) {
        events.push(tryApplyStatus(target, { type: StatusEffectType.BLEED, duration: 3 }, caster.name, '瞬影殺', `${target.name} 被割裂出血！`));
      }
      
      return events;
    }
  },
  // --- 變異盜賊：詭術師 ---
  'TRICKSTER_TRICK_MAGIC': {
    id: 'TRICKSTER_TRICK_MAGIC',
    name: '欺詐魔術',
    mpCost: 35,
    targetType: TargetType.SINGLE_ENEMY,
    description: '消耗 35 MP。造成 100% 混沌傷害。血量>=70%自身嘲諷迴避，<70%目標流血。',
    cooldown: 2,
    aiWeight: (caster, targets) => {
      const target = targets[0];
      const isHealthy = (target.currentHp / target.maxHp) >= 0.7;
      if (isHealthy && !caster.statusEffects.some(s => s.type === StatusEffectType.TAUNT)) {
         return 150; // 滿血且未嘲諷，非常有價值
      }
      return 80;
    },
    execute: (caster, targets, allEnemies) => {
      const target = targets[0];
      const events: CombatEvent[] = [];
      const { damage, isCrit } = calculateSkillDamage(caster, target, caster.stats.atk * 1.0, DamageType.CHAOS);
      target.currentHp = Math.max(0, target.currentHp - damage);
      events.push({
        type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
        actorId: caster.id, actorName: caster.name, targetId: target.id, targetName: target.name,
        damage: damage, targetHp: target.currentHp, targetMaxHp: target.maxHp,
        skillName: '欺詐魔術',
        text: `${caster.name} 施展魔術，對 ${target.name} 造成 ${damage} 點混沌傷害！`
      });
      
      if (target.currentHp > 0) {
        const isHealthy = (target.currentHp / target.maxHp) >= 0.7;
        if (isHealthy) {
          caster.statusEffects.push({ type: StatusEffectType.TAUNT, duration: 2 }); // Duration 2 because it decays at end of turn
          events.push({ type: CombatEventType.STATUS_APPLY, targetId: caster.id, targetName: caster.name, statusType: StatusEffectType.TAUNT, text: `${caster.name} 嘲諷了敵人並獲得完美迴避！` });
        } else {
          events.push(tryApplyStatus(target, { type: StatusEffectType.BLEED, duration: 2 }, caster.name, '欺詐魔術', `${target.name} 陷入流血狀態！`));
        }
      }
      return events;
    }
  }
};
