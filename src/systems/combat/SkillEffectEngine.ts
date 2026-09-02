import { CompositeSkillDefinition, EffectBlock, Skill, TargetType, SkillCondition, SkillTrigger } from '../../models/Skill';
import { CombatParticipant, CombatEvent, CombatEventType, StatusEffectType, tryApplyStatus } from '../../models/Combat';
import { DamageType } from '../../models/types';
import { getPatk, getMatk, calculateSkillDamage } from '../../utils/CombatMath';
import { Random } from '../../core/Random';
import customSkillData from '../../data/CustomSkillData.json';

/**
 * 積木技能解譯 & 執行引擎 (Composite Skill Effect Engine)
 * 將 CompositeSkillDefinition 轉換為 CombatSystem 可呼叫的 Skill 物件並處理各類進階效果與 5 大觸發鉤子
 */
export class SkillEffectEngine {

  /** 將積木定義編譯為可執行的 Skill 物件 */
  public static compile(def: CompositeSkillDefinition): Skill {
    const cost = def.mpCost ?? def.totalMpCost ?? 0;
    return {
      id: def.id,
      name: def.name,
      mpCost: cost,
      targetType: def.blocks[0]?.targetType ?? TargetType.SINGLE_ENEMY,
      description: def.description,
      cooldown: def.cooldown,
      category: def.category,
      icon: def.icon,
      aiWeight: (_caster, targets) => cost * targets.length,
      execute: (caster, targets, allEnemies, allAllies) => {
        const events: CombatEvent[] = [];
        for (const block of def.blocks) {
          if (block.trigger !== 'ACTIVE') continue;
          events.push(...SkillEffectEngine.executeBlock(block, caster, targets, allEnemies ?? [], allAllies ?? []));
        }
        return events;
      }
    };
  }

  /** 積木遞迴最大深度（防止 onTrue/onFalse 巢狀過深造成 Stack Overflow） */
  private static readonly MAX_BLOCK_DEPTH = 20;

  /** 執行單一積木（含條件判斷與分支） */
  public static executeBlock(
    block: EffectBlock,
    caster: CombatParticipant,
    targets: CombatParticipant[],
    allEnemies: CombatParticipant[],
    allAllies: CombatParticipant[],
    _depth: number = 0
  ): CombatEvent[] {
    // 🛡️ 遞迴深度防護：超過上限直接返回空事件，防止惡意或意外的無限巢狀積木
    if (_depth > SkillEffectEngine.MAX_BLOCK_DEPTH) {
      console.warn(`[SkillEffectEngine] 積木遞迴深度超過上限 (${SkillEffectEngine.MAX_BLOCK_DEPTH})，施術者：${caster.name}，已強制中斷。`);
      return [];
    }

    if (block.condition && block.condition.type !== 'NONE') {
      const met = SkillEffectEngine.checkCondition(block.condition, caster, targets, allAllies);
      if (!met) {
        return (block.onFalse ?? []).flatMap(b => SkillEffectEngine.executeBlock(b, caster, targets, allEnemies, allAllies, _depth + 1));
      }
      if (block.onTrue) {
        return block.onTrue.flatMap(b => SkillEffectEngine.executeBlock(b, caster, targets, allEnemies, allAllies, _depth + 1));
      }
    }
    return SkillEffectEngine.applyEffect(block, caster, targets, allEnemies, allAllies);
  }

  /** 判斷條件是否成立 */
  private static checkCondition(
    cond: SkillCondition,
    caster: CombatParticipant,
    targets: CombatParticipant[],
    allies: CombatParticipant[]
  ): boolean {
    const t = targets[0];
    switch (cond.type) {
      case 'NONE': return true;
      case 'TARGET_HP_GTE': return !!t && (t.currentHp / t.maxHp) >= (cond.value ?? 0.7);
      case 'TARGET_HP_LT':  return !!t && (t.currentHp / t.maxHp) < (cond.value ?? 0.3);
      case 'SELF_HP_LT':    return (caster.currentHp / caster.maxHp) < (cond.value ?? 0.3);
      case 'TARGET_HAS_STATUS': return t?.statusEffects.some(s => s.type === cond.status) ?? false;
      case 'ALLY_EXISTS':   return allies.some(a => a.id !== caster.id && a.currentHp > 0);
      case 'NO_ALLY':       return !allies.some(a => a.id !== caster.id && a.currentHp > 0);
      default: return true;
    }
  }

  /** 執行效果本體 */
  private static applyEffect(
    block: EffectBlock,
    caster: CombatParticipant,
    targets: CombatParticipant[],
    allEnemies: CombatParticipant[],
    _allAllies: CombatParticipant[]
  ): CombatEvent[] {
    const events: CombatEvent[] = [];
    const mult = block.multiplier ?? 1.0;

    switch (block.effectType) {
      case 'DAMAGE_PHYSICAL':
        targets.forEach(target => {
          const { damage, isCrit } = calculateSkillDamage(caster, target, getPatk(caster) * mult, DamageType.PHYSICAL);
          target.currentHp = Math.max(0, target.currentHp - damage);
          events.push({
            type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            damage,
            targetHp: target.currentHp,
            targetMaxHp: target.maxHp,
            text: `${caster.name} 對 ${target.name} 造成 ${damage} 點物理傷害！`
          });
        });
        break;

      case 'DAMAGE_MAGICAL':
        targets.forEach(target => {
          const { damage, isCrit } = calculateSkillDamage(caster, target, getMatk(caster) * mult, DamageType.MAGICAL);
          target.currentHp = Math.max(0, target.currentHp - damage);
          events.push({
            type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            damage,
            targetHp: target.currentHp,
            targetMaxHp: target.maxHp,
            text: `${caster.name} 對 ${target.name} 造成 ${damage} 點魔法傷害！`
          });
        });
        break;

      case 'DAMAGE_MIXED': {
        const physRatio = Math.max(0, Math.min(1, block.physRatio ?? 0.5));
        const magRatio = 1 - physRatio;
        targets.forEach(target => {
          const physBase = getPatk(caster) * mult * physRatio;
          const magBase = getMatk(caster) * mult * magRatio;
          const pRes = calculateSkillDamage(caster, target, physBase, DamageType.PHYSICAL);
          const mRes = calculateSkillDamage(caster, target, magBase, DamageType.MAGICAL);
          const totalDmg = pRes.damage + mRes.damage;
          const isCrit = pRes.isCrit || mRes.isCrit;
          target.currentHp = Math.max(0, target.currentHp - totalDmg);
          events.push({
            type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            damage: totalDmg,
            targetHp: target.currentHp,
            targetMaxHp: target.maxHp,
            text: `${caster.name} 對 ${target.name} 施放雙修打擊，造成 ${totalDmg} 點混合傷害 (物 ${pRes.damage} + 魔 ${mRes.damage})！`
          });
        });
        break;
      }

      case 'DAMAGE_TRUE':
        targets.forEach(target => {
          const damage = Math.floor(target.maxHp * mult);
          target.currentHp = Math.max(0, target.currentHp - damage);
          events.push({
            type: CombatEventType.HIT,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            damage,
            targetHp: target.currentHp,
            targetMaxHp: target.maxHp,
            text: `${caster.name} 對 ${target.name} 造成 ${damage} 點真實傷害（無視防禦）！`
          });
        });
        break;

      case 'LIFESTEAL':
        targets.forEach(target => {
          const { damage } = calculateSkillDamage(caster, target, getPatk(caster) * mult, DamageType.PHYSICAL);
          target.currentHp = Math.max(0, target.currentHp - damage);
          const heal = Math.max(1, Math.floor(damage * (block.lifeStealRate ?? 0.5)));
          caster.currentHp = Math.min(caster.maxHp, caster.currentHp + heal);
          events.push({
            type: CombatEventType.HIT,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            damage,
            targetHp: target.currentHp,
            targetMaxHp: target.maxHp,
            text: `${caster.name} 吸取生命精華對 ${target.name} 造成 ${damage} 點傷害，恢復 ${heal} HP！`
          });
        });
        break;

      case 'MULTI_HIT': {
        const hitCount = block.hitCount ?? 2;
        targets.forEach(target => {
          for (let i = 0; i < hitCount; i++) {
            const { damage, isCrit } = calculateSkillDamage(caster, target, getPatk(caster) * mult, DamageType.PHYSICAL);
            target.currentHp = Math.max(0, target.currentHp - damage);
            events.push({
              type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
              actorId: caster.id,
              actorName: caster.name,
              targetId: target.id,
              targetName: target.name,
              damage,
              targetHp: target.currentHp,
              targetMaxHp: target.maxHp,
              text: `${caster.name} 第 ${i + 1} 擊命中 ${target.name}，造成 ${damage} 點傷害！`
            });
          }
        });
        break;
      }

      case 'APPLY_STATUS':
        if (block.statusType) {
          targets.forEach(target => {
            if (block.statusChance === undefined || Random.next() < block.statusChance) {
              events.push(tryApplyStatus(target, {
                type: block.statusType as StatusEffectType,
                duration: block.statusDuration ?? 2,
                value: block.statusValue,
                stacks: 1
              }, caster.name, undefined, undefined, allEnemies));
            }
          });
        }
        break;

      case 'SET_MARK':
        targets.forEach(target => {
          const existing = target.statusEffects.find(s => s.type === StatusEffectType.MARK);
          if (existing) {
            existing.stacks = (existing.stacks ?? 0) + 1;
          } else {
            target.statusEffects.push({
              type: StatusEffectType.MARK,
              duration: block.statusDuration ?? 3,
              stacks: 1,
              value: block.statusValue ?? 50
            });
          }
          const stacks = target.statusEffects.find(s => s.type === StatusEffectType.MARK)?.stacks ?? 1;
          events.push({
            type: CombatEventType.STATUS_APPLY,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            text: `${target.name} 被附加了【烙印】！(${stacks} 層)`
          });
        });
        break;

      case 'DETONATE_MARKS':
        targets.forEach(target => {
          const mark = target.statusEffects.find(s => s.type === StatusEffectType.MARK);
          if (mark) {
            const stacks = mark.stacks ?? 1;
            const dmgPerStack = Math.floor(getMatk(caster) * mult);
            const total = dmgPerStack * stacks;
            target.currentHp = Math.max(0, target.currentHp - total);
            target.statusEffects = target.statusEffects.filter(s => s.type !== StatusEffectType.MARK);
            events.push({
              type: CombatEventType.CRIT,
              actorId: caster.id,
              actorName: caster.name,
              targetId: target.id,
              targetName: target.name,
              damage: total,
              targetHp: target.currentHp,
              targetMaxHp: target.maxHp,
              text: `${caster.name} 引爆了 ${stacks} 層【烙印】！對 ${target.name} 造成 ${total} 點爆炸傷害！`
            });
          }
        });
        break;

      case 'APPLY_BARRIER': {
        const barrierVal = block.barrierAmount ?? Math.floor(getMatk(caster) * mult);
        targets.forEach(target => {
          const existing = target.statusEffects.find(s => s.type === StatusEffectType.BARRIER);
          if (existing) {
            existing.value = (existing.value ?? 0) + barrierVal;
            existing.duration = Math.max(existing.duration, block.statusDuration ?? 2);
          } else {
            target.statusEffects.push({
              type: StatusEffectType.BARRIER,
              duration: block.statusDuration ?? 2,
              value: barrierVal
            });
          }
          events.push({
            type: CombatEventType.STATUS_APPLY,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            text: `${target.name} 獲得了吸傷護盾（吸收 ${barrierVal} 點傷害）！`
          });
        });
        break;
      }

      case 'CHAIN_DAMAGE': {
        const chainCount = block.chainCount ?? 3;
        let currentTarget: CombatParticipant | undefined = targets[0];
        for (let i = 0; i < chainCount && currentTarget; i++) {
          const { damage, isCrit } = calculateSkillDamage(caster, currentTarget, getMatk(caster) * mult * Math.pow(0.85, i), DamageType.MAGICAL);
          currentTarget.currentHp = Math.max(0, currentTarget.currentHp - damage);
          events.push({
            type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
            actorId: caster.id,
            actorName: caster.name,
            targetId: currentTarget.id,
            targetName: currentTarget.name,
            damage,
            targetHp: currentTarget.currentHp,
            targetMaxHp: currentTarget.maxHp,
            text: `⚡ 連鎖彈跳第 ${i + 1} 擊命中 ${currentTarget.name}，造成 ${damage} 點魔法傷害！`
          });
          const remaining = allEnemies.filter(e => e.currentHp > 0 && e.id !== currentTarget?.id);
          currentTarget = remaining.length > 0 ? Random.pick(remaining) : undefined;
        }
        break;
      }

      case 'EXECUTE': {
        const threshold = block.executeThreshold ?? 0.25;
        targets.forEach(target => {
          const hpPct = target.currentHp / target.maxHp;
          if (hpPct <= threshold) {
            const damage = target.currentHp;
            target.currentHp = 0;
            events.push({
              type: CombatEventType.CRIT,
              actorId: caster.id,
              actorName: caster.name,
              targetId: target.id,
              targetName: target.name,
              damage,
              targetHp: 0,
              targetMaxHp: target.maxHp,
              text: `⚔️【一擊必殺】${caster.name} 觸發斬殺，直接終結了殘血的 ${target.name}！`
            });
          } else {
            const { damage } = calculateSkillDamage(caster, target, getPatk(caster) * mult, DamageType.PHYSICAL);
            target.currentHp = Math.max(0, target.currentHp - damage);
            events.push({
              type: CombatEventType.HIT,
              actorId: caster.id,
              actorName: caster.name,
              targetId: target.id,
              targetName: target.name,
              damage,
              targetHp: target.currentHp,
              targetMaxHp: target.maxHp,
              text: `${caster.name} 對 ${target.name} 進行斬擊，造成 ${damage} 點傷害（未達斬殺門檻）。`
            });
          }
        });
        break;
      }

      case 'DISPEL': {
        targets.forEach(target => {
          const buffCount = target.statusEffects.filter(s => s.type.startsWith('BUFF_') || s.type === StatusEffectType.BARRIER).length;
          target.statusEffects = target.statusEffects.filter(s => !s.type.startsWith('BUFF_') && s.type !== StatusEffectType.BARRIER);
          events.push({
            type: CombatEventType.STATUS_EXPIRE,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            text: `✨ ${caster.name} 驅散了 ${target.name} 身上的 ${buffCount} 個增益狀態！`
          });
        });
        break;
      }

      case 'STEAL_BUFF': {
        targets.forEach(target => {
          const buffIdx = target.statusEffects.findIndex(s => s.type.startsWith('BUFF_'));
          if (buffIdx >= 0) {
            const stolen = target.statusEffects.splice(buffIdx, 1)[0];
            caster.statusEffects.push({ ...stolen });
            events.push({
              type: CombatEventType.STATUS_APPLY,
              actorId: caster.id,
              actorName: caster.name,
              targetId: target.id,
              targetName: target.name,
              text: `🦹 ${caster.name} 竊取了 ${target.name} 的【${stolen.type}】增益效果！`
            });
          }
        });
        break;
      }

      case 'DELAYED_BOMB': {
        targets.forEach(target => {
          const turns = block.delayTurns ?? 2;
          target.statusEffects.push({
            type: StatusEffectType.DELAYED_BOMB,
            duration: turns,
            value: Math.floor(getMatk(caster) * mult)
          });
          events.push({
            type: CombatEventType.STATUS_APPLY,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            text: `💣 ${target.name} 被植入了【延遲定時炸彈】（${turns} 回合後引爆）！`
          });
        });
        break;
      }

      case 'MP_DRAIN': {
        const drainAmount = Math.max(5, Math.floor((block.multiplier ?? 1.0) * 15));
        targets.forEach(target => {
          const actualDrain = Math.min(target.currentMp || 0, drainAmount);
          target.currentMp = Math.max(0, (target.currentMp || 0) - actualDrain);
          caster.currentMp = Math.min(caster.maxMp || 100, (caster.currentMp || 0) + actualDrain);
          events.push({
            type: CombatEventType.HIT,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            text: `🔮 ${caster.name} 從 ${target.name} 身上抽取了 ${actualDrain} 點魔力！`
          });
        });
        break;
      }

      case 'FORCE_ROW_CHANGE': {
        targets.forEach(target => {
          const oldRow = target.row;
          target.row = oldRow === 'FRONT' ? 'BACK' : 'FRONT';
          events.push({
            type: CombatEventType.HIT,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            text: `💨 ${caster.name} 發動擊退衝擊，將 ${target.name} 從 ${oldRow === 'FRONT' ? '前排震退至後排' : '後排拉至前排'}！`
          });
        });
        break;
      }

      case 'FIELD_EFFECT': {
        const fieldType = block.fieldType || 'FIELD_FIRE';
        const duration = block.fieldDuration ?? 3;
        allEnemies.concat(_allAllies).forEach(p => {
          if (p.currentHp > 0) {
            p.statusEffects.push({
              type: fieldType as StatusEffectType,
              duration,
              value: block.statusValue ?? 15
            });
          }
        });
        events.push({
          type: CombatEventType.STATUS_APPLY,
          actorId: caster.id,
          actorName: caster.name,
          text: `🌌 戰場籠罩在【${fieldType}】環境效果之中（持續 ${duration} 回合）！`
        });
        break;
      }

      case 'BUFF_SELF':
        if (block.buffType) {
          caster.statusEffects.push({
            type: block.buffType as StatusEffectType,
            duration: block.buffDuration ?? 2,
            value: block.buffValue ?? 20
          });
          events.push({
            type: CombatEventType.STATUS_APPLY,
            actorId: caster.id,
            actorName: caster.name,
            targetId: caster.id,
            targetName: caster.name,
            text: `${caster.name} 獲得增益效果（${block.buffType} +${block.buffValue ?? 20}%，${block.buffDuration ?? 2}回合）！`
          });
        }
        break;

      case 'BUFF_ALLIES':
        _allAllies.filter(a => a.currentHp > 0).forEach(ally => {
          if (block.buffType) {
            ally.statusEffects.push({
              type: block.buffType as StatusEffectType,
              duration: block.buffDuration ?? 2,
              value: block.buffValue ?? 20
            });
            events.push({
              type: CombatEventType.STATUS_APPLY,
              actorId: caster.id,
              actorName: caster.name,
              targetId: ally.id,
              targetName: ally.name,
              text: `${ally.name} 獲得增益效果！`
            });
          }
        });
        break;

      case 'HEAL':
        targets.filter(t => t.currentHp > 0).forEach(target => {
          const healAmt = Math.floor(getMatk(caster) * mult);
          target.currentHp = Math.min(target.maxHp, target.currentHp + healAmt);
          events.push({
            type: CombatEventType.HEAL,
            actorId: caster.id,
            actorName: caster.name,
            targetId: target.id,
            targetName: target.name,
            damage: healAmt,
            targetHp: target.currentHp,
            targetMaxHp: target.maxHp,
            healType: 'HP',
            text: `${caster.name} 治療了 ${target.name}，恢復 ${healAmt} 點 HP！`
          });
        });
        break;

      case 'RESURRECT':
        const deadAllies = _allAllies.filter(a => a.currentHp <= 0);
        const targetToRevive = targets.find(t => t.currentHp <= 0) || deadAllies[0];
        if (targetToRevive) {
          const reviveHp = Math.max(1, Math.floor(targetToRevive.maxHp * (mult || 0.35)));
          targetToRevive.currentHp = reviveHp;
          (targetToRevive as any).isDead = false;
          events.push({
            type: CombatEventType.HEAL,
            actorId: caster.id,
            actorName: caster.name,
            targetId: targetToRevive.id,
            targetName: targetToRevive.name,
            damage: reviveHp,
            targetHp: targetToRevive.currentHp,
            targetMaxHp: targetToRevive.maxHp,
            healType: 'HP',
            text: `✨ ${caster.name} 施展神聖復甦，將 ${targetToRevive.name} 復活歸隊（恢復 ${reviveHp} 點 HP）！`
          });
        }
        break;

      default:
        break;
    }

    return events;
  }

  /** 觸發鉤子執行器 (供 CombatSystem 在 5 大觸發時機調用) */
  public static triggerHooks(
    trigger: SkillTrigger,
    actor: CombatParticipant,
    targets: CombatParticipant[],
    allEnemies: CombatParticipant[],
    allAllies: CombatParticipant[]
  ): CombatEvent[] {
    const events: CombatEvent[] = [];
    if (!actor.skills) return events;

    const customList = customSkillData as unknown as CompositeSkillDefinition[];
    for (const skillId of actor.skills) {
      const def = customList.find(d => d.id === skillId);
      if (!def) continue;

      for (const block of def.blocks) {
        if (block.trigger === trigger) {
          events.push(...SkillEffectEngine.executeBlock(block, actor, targets, allEnemies, allAllies));
        }
      }
    }
    return events;
  }
}
