import { Adventurer } from '../../models/Adventurer';
import { CombatParticipant } from '../../models/Combat';
import { FormationRow } from '../../models/types';
import { GambitRule, GambitConditionType } from '../../models/Gambit';
import { SKILLS } from '../../data/SkillData';
import { TargetType } from '../../models/Skill';
import { Random } from '../../core/Random';

export class GambitEvaluator {
  public static evaluate(
    actor: CombatParticipant,
    playerTeam: CombatParticipant[],
    enemyTeam: CombatParticipant[]
  ): { skillId: string, targets: CombatParticipant[] } | null {
    
    const adv = actor as unknown as Adventurer;
    if (!adv.gambits || adv.gambits.length === 0) return null;

    const allies = actor.isPlayer ? playerTeam.filter(p => p.currentHp > 0) : enemyTeam.filter(e => e.currentHp > 0);
    const enemies = actor.isPlayer ? enemyTeam.filter(e => e.currentHp > 0) : playerTeam.filter(p => p.currentHp > 0);
    const frontEnemies = enemies.filter(e => e.row === FormationRow.FRONT);
    const backEnemies = enemies.filter(e => e.row === FormationRow.BACK);
    
    for (const rule of adv.gambits) {
      if (!rule.isActive) continue;
      
      const skillId = rule.actionSkillId;
      const isDefaultAttack = skillId === 'DEFAULT_ATTACK';
      const skill = isDefaultAttack ? null : SKILLS[skillId];
      
      if (!isDefaultAttack && !skill) continue;

      if (!isDefaultAttack && skill) {
        if (actor.stats.mp < skill.mpCost) continue;
        if (actor.cooldowns && actor.cooldowns[skill.id] > 0) continue;
      }

      let potentialConditionTargets: CombatParticipant[] = [];

      switch (rule.conditionType) {
        case GambitConditionType.ALWAYS:
          potentialConditionTargets = enemies; 
          break;
        case GambitConditionType.SELF_HP_BELOW_X:
          if ((actor.currentHp / actor.maxHp) * 100 < Number(rule.conditionValue)) {
            potentialConditionTargets = [actor];
          }
          break;
        case GambitConditionType.ALLY_HP_BELOW_X:
          potentialConditionTargets = allies.filter(a => (a.currentHp / a.maxHp) * 100 < Number(rule.conditionValue));
          break;
        case GambitConditionType.ENEMY_HP_BELOW_X:
          potentialConditionTargets = enemies.filter(e => (e.currentHp / e.maxHp) * 100 < Number(rule.conditionValue));
          break;
        case GambitConditionType.ENEMY_HP_ABOVE_X:
          potentialConditionTargets = enemies.filter(e => (e.currentHp / e.maxHp) * 100 > Number(rule.conditionValue));
          break;
        case GambitConditionType.ENEMY_FRONT_ROW:
          potentialConditionTargets = frontEnemies;
          break;
        case GambitConditionType.ENEMY_BACK_ROW:
          potentialConditionTargets = backEnemies;
          break;
        case GambitConditionType.ENEMY_HAS_DEBUFF:
          if (rule.conditionValue) {
             potentialConditionTargets = enemies.filter(e => e.statusEffects.some(s => s.type === rule.conditionValue));
          } else {
             potentialConditionTargets = enemies.filter(e => e.statusEffects.length > 0);
          }
          break;
        case GambitConditionType.ALLY_HAS_DEBUFF:
          if (rule.conditionValue) {
             potentialConditionTargets = allies.filter(a => a.statusEffects.some(s => s.type === rule.conditionValue));
          } else {
             potentialConditionTargets = allies.filter(a => a.statusEffects.length > 0);
          }
          break;
      }

      if (potentialConditionTargets.length === 0) continue;

      let finalTargets = this.resolveSkillTargets(
        isDefaultAttack ? null : skill, 
        actor, 
        potentialConditionTargets, 
        enemies, 
        allies, 
        frontEnemies, 
        backEnemies
      );
      
      if (finalTargets && finalTargets.length > 0) {
        return { skillId: skillId, targets: finalTargets };
      }
    }

    return null;
  }

  private static resolveSkillTargets(
    skill: any | null,
    actor: CombatParticipant,
    conditionTargets: CombatParticipant[],
    enemies: CombatParticipant[],
    allies: CombatParticipant[],
    frontEnemies: CombatParticipant[],
    backEnemies: CombatParticipant[]
  ): CombatParticipant[] | null {
    
    // 如果是 DEFAULT_ATTACK (普攻)，視為 TargetType.SINGLE_ENEMY 處理
    const targetType = skill ? skill.targetType : TargetType.SINGLE_ENEMY;

    if (targetType === TargetType.SINGLE_ENEMY) {
      let valid = conditionTargets.filter(t => enemies.includes(t));
      
      const meleeWeapons = ['GREATSWORD', 'DUAL_SWORDS', 'SWORD_AND_SHIELD', 'RUNE_SHIELD', 'DAGGERS', 'HAMMER'];
      const isMelee = meleeWeapons.includes(actor.weaponType || '');
      
      if (isMelee && frontEnemies.length > 0) {
        valid = valid.filter(t => t.row === FormationRow.FRONT);
      }
      
      const taunted = enemies.filter(e => e.statusEffects.some(s => s.type === 'TAUNT'));
      if (taunted.length > 0) {
        valid = valid.filter(t => taunted.includes(t));
      }

      if (valid.length === 0) return null;
      return [Random.pick(valid)];
    } 
    else if (targetType === TargetType.ALL_ENEMIES) {
      return enemies;
    }
    else if (targetType === TargetType.FRONT_ENEMIES) {
      return frontEnemies.length > 0 ? frontEnemies : enemies;
    }
    else if (targetType === TargetType.BACK_ENEMY) {
      let valid = conditionTargets.filter(t => backEnemies.includes(t));
      if (valid.length === 0 && backEnemies.length > 0) valid = backEnemies;
      if (valid.length === 0) return [Random.pick(enemies)];
      return [Random.pick(valid)];
    }
    else if (targetType === TargetType.COLUMN) {
      let primary = Random.pick(conditionTargets.filter(t => enemies.includes(t)));
      if (!primary) primary = Random.pick(enemies);
      if (!primary) return null;
      return enemies.filter(e => e.gridC === primary.gridC);
    }
    else if (targetType === TargetType.SELF) {
      return [actor];
    }
    else if (targetType === TargetType.ALLY_LOWEST_HP) {
      const aliveAllies = allies.filter(a => a.currentHp > 0).sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp));
      return [aliveAllies[0]];
    }
    else if (targetType === TargetType.ALL_ALLIES) {
      return allies;
    }

    return null;
  }
}
