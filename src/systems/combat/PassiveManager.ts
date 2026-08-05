import { CombatParticipant, CombatEvent, CombatEventType } from '../../models/Combat';
import { StatusEffectType } from '../../models/Combat';
import { DamageType } from '../../models/types';
import { calculateSkillDamage } from '../../utils/CombatMath';
import { Random } from '../../core/Random';

export class PassiveManager {
  /**
   * 戰鬥初始化時觸發的被動
   */
  public static onCombatStart(participant: CombatParticipant) {
    if (participant.isAdvanced && participant.weaponType === 'DAGGERS') {
      // 先發制人：獲得巨額隱藏閃避值保證優先行動 (也可以用來提升首回合閃避)
      participant.stats.evade += 9999;
    }
  }

  /**
   * 修改普攻命中率
   */
  public static getModifiedHitChance(attacker: CombatParticipant, defender: CombatParticipant, baseHitChance: number): number {
    let hitChance = baseHitChance;
    
    // 法師法杖被動：必定命中
    if (attacker.isAdvanced && attacker.weaponType === 'STAFF') {
      hitChance = 1.0;
    }
    
    // 詭術師被動：帶有嘲諷時 100% 閃避
    if (defender.isAdvanced && defender.weaponType === 'MAGIC_RING' && defender.statusEffects.some(s => s.type === StatusEffectType.TAUNT)) {
      hitChance = 0.0;
    }
    
    return hitChance;
  }

  /**
   * 計算普攻傷害 (替換原本戰鬥迴圈中的寫死邏輯)
   */
  public static calculateBasicAttackDamage(attacker: CombatParticipant, defender: CombatParticipant): { damage: number, isCrit: boolean } {
    let finalDamage = 0;
    let isCrit = false;

    if (attacker.isAdvanced && attacker.weaponType === 'HAMMER') {
      const phys = calculateSkillDamage(attacker, defender, (attacker.stats.patk || attacker.stats.atk || 0) * 0.4, DamageType.PHYSICAL);
      const mag = calculateSkillDamage(attacker, defender, (attacker.stats.matk || attacker.stats.atk || 0) * 0.6, DamageType.MAGICAL);
      finalDamage = phys.damage + mag.damage;
      isCrit = phys.isCrit || mag.isCrit;
    } else if (attacker.isAdvanced && attacker.weaponType === 'DUAL_SWORDS') {
      const phys = calculateSkillDamage(attacker, defender, (attacker.stats.patk || attacker.stats.atk || 0) * 0.5, DamageType.PHYSICAL);
      const mag = calculateSkillDamage(attacker, defender, (attacker.stats.matk || attacker.stats.atk || 0) * 0.5, DamageType.MAGICAL);
      finalDamage = phys.damage + mag.damage;
      isCrit = phys.isCrit || mag.isCrit;
    } else {
      let dType = DamageType.PHYSICAL;
      if (['STAFF', 'HOLY_BOOK', 'SCYTHE', 'MAGIC_RING'].includes(attacker.weaponType || '')) {
        dType = DamageType.MAGICAL;
      }
      let atkPower = dType === DamageType.MAGICAL 
        ? (attacker.stats.matk || attacker.stats.atk || 0) 
        : (attacker.stats.patk || attacker.stats.atk || 0);

      // 暗殺者被動：普攻對健康目標增傷
      if (attacker.isAdvanced && attacker.weaponType === 'DAGGERS' && (defender.currentHp / defender.maxHp) >= 0.7) {
        atkPower *= 1.3;
      }
      
      const result = calculateSkillDamage(attacker, defender, atkPower, dType);
      finalDamage = result.damage;
      isCrit = result.isCrit;
    }

    return { damage: finalDamage, isCrit };
  }

  /**
   * 技能或普攻造成傷害後觸發的被動
   */
  public static onDamageDealt(attacker: CombatParticipant, totalDamageDealt: number, events: CombatEvent[], triggerSource: 'SKILL' | 'BASIC_ATTACK') {
    if (totalDamageDealt <= 0) return;

    // 死靈法師被動：靈魂虹吸 (吸血)
    if (attacker.isAdvanced && attacker.weaponType === 'SCYTHE' && attacker.currentHp > 0) {
      const heal = Math.floor(totalDamageDealt * 0.2);
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + heal);
      events.push({
        type: CombatEventType.HIT,
        text: `${attacker.name} 觸發【靈魂虹吸】，恢復了 ${heal} 點 HP！`
      });
    }
  }

  /**
   * 隊友受到傷害時觸發的被動 (例如：苦痛分擔)
   * 傳回經過吸收後，目標實際應該承受的傷害
   */
  public static onAllyTakingDamage(defender: CombatParticipant, incomingDamage: number, playerTeam: CombatParticipant[], events: CombatEvent[]): number {
    let finalDamage = incomingDamage;
    
    // 法坦被動：苦痛分擔 (死靈法師)
    if (defender.isPlayer) {
      const necromancers = playerTeam.filter(p => p.isAdvanced && p.weaponType === 'SCYTHE' && p.currentHp > 0 && p.id !== defender.id);
      if (necromancers.length > 0) {
        const necro = necromancers[0]; // 優先由第一位死靈法師分擔
        const absorbAmount = Math.floor(finalDamage * 0.5);
        const necroDamage = Math.floor(absorbAmount * 0.4); // 反映 20% 原始傷害 (50% * 0.4 = 20%)
        finalDamage -= absorbAmount;
        
        necro.currentHp -= necroDamage;
        events.push({
          type: CombatEventType.HIT,
          text: `${necro.name} 觸發【靈魂虹吸-苦痛分擔】，為 ${defender.name} 吸收了 ${absorbAmount} 點傷害，自身承受了 ${necroDamage} 點傷害！`
        });
        
        if (necro.currentHp <= 0) {
           necro.currentHp = 0;
           events.push({ type: CombatEventType.DEATH, targetName: necro.name, text: `${necro.name} 因分擔過多傷害而倒下！` });
        }
      }
    }

    return finalDamage;
  }
}
