import { GameState } from '../core/GameState';
import { CombatReport, CombatEvent, CombatEventType, CombatParticipant, StatusEffectType, StatusEffect, tryApplyStatus } from '../models/Combat';
import { FormationRow, TerrainType, EquipmentSlot, getOfficeConfig, DamageType } from '../models/types';
import { Random } from '../core/Random';
import { SKILLS, TargetType, calculateSkillDamage } from '../models/Skill';
import { FormationDB } from '../systems/FormationDB';

export class CombatSystem {
  public static simulateCombat(
    attackerIds: string[], 
    taskDifficulty: number = 10, 
    enemyFeature: string = '', 
    terrain?: TerrainType, 
    totalWaves: number = 1,
    troopAssignments?: Record<string, { type: string, count: number }>,
    enemyLineup?: import('../models/types').MonsterInstance[],
    formationId?: string,
    gridMap?: Record<string, string>
  ): CombatReport {
    const events: CombatEvent[] = [];
    const playerTeam: CombatParticipant[] = [];
    
        const formationActive = formationId && gridMap ? FormationDB.isFormationActive(gridMap, formationId) : false;
    const formationConfig = formationId ? FormationDB.getFormation(formationId) : FormationDB.getFormation('DEFAULT');

    // 1. 初始化我方 (僅初始化一次，狀態延續)
    attackerIds.forEach((id: string) => {
      const adv = GameState.adventurers.find(a => a.id === id);
      if (adv) {
        const stats = adv.getCombatStats();
        
        // 官職戰鬥加成
        if (adv.office) {
          const cfg = getOfficeConfig(adv.office);
          if (cfg && cfg.combatBonusPct) {
            stats.atk = Math.floor(stats.atk * (1 + cfg.combatBonusPct));
            stats.def = Math.floor(stats.def * (1 + cfg.combatBonusPct));
          }
        }
        const troop = troopAssignments?.[id];
        const weapon = adv.equipment ? adv.equipment[EquipmentSlot.WEAPON] : undefined;
        const weaponType = weapon ? weapon.weaponType : undefined;
        
        let skills: string[] = [];
        const jobName = adv.job?.name || '';
        const isAdv = adv.isAdvanced && adv.level >= 10;
        
        if (jobName.includes('戰士')) {
          skills.push('FIGHTER_HEAVY_STRIKE', 'FIGHTER_ARMOR_BREAK');
          if (isAdv && weaponType === 'GREATSWORD') skills.push('GREATSWORD_WHIRLWIND');
          if (isAdv && weaponType === 'DUAL_SWORDS') skills.push('MAGIC_SWORDSMAN_PHANTOM');
        }
        if (jobName.includes('法師')) {
          skills.push('MAGE_ARCANE_MISSILES', 'MAGE_STATIC_FIELD');
          if (isAdv && weaponType === 'STAFF') skills.push('STAFF_METEOR');
          if (isAdv && weaponType === 'SCYTHE') skills.push('SCYTHE_SOUL_REAP');
        }
        if (jobName.includes('弓箭手')) {
          skills.push('ARCHER_PIERCING_SHOT', 'ARCHER_AIMED_SHOT');
          if (isAdv && weaponType === 'BOW') skills.push('SNIPER_FATAL_SNIPE');
          if (isAdv && weaponType === 'MAGIC_BOW') skills.push('SPIRIT_ARCHER_SPIRIT_CHAIN');
        }
        if (jobName.includes('盜賊')) {
          skills.push('THIEF_SURPRISE_ATTACK', 'THIEF_POISON_BLADE');
          if (isAdv && weaponType === 'DAGGERS') {
            skills.push('ASSASSIN_SHADOW_ASSASSINATION');
            stats.evade += 9999; // 先發制人：獲得巨額隱藏閃避值保證優先行動
          }
          if (isAdv && weaponType === 'MAGIC_RING') skills.push('TRICKSTER_TRICK_MAGIC');
        }
        if (jobName.includes('騎士')) {
          skills.push('KNIGHT_SHIELD_BASH', 'KNIGHT_TAUNT');
          if (isAdv && (weaponType === 'SWORD_AND_SHIELD' || weaponType === 'SWORD' || !weaponType)) skills.push('KNIGHT_PALADIN_AEGIS');
          if (isAdv && weaponType === 'RUNE_SHIELD') skills.push('KNIGHT_RUNE_REFLECTION');
        }
        if (jobName.includes('祈禱者')) {
          skills.push('PRAYER_HEAL', 'PRAYER_HOLY_LIGHT');
          if (isAdv && (weaponType === 'HOLY_BOOK' || weaponType === 'TOME' || !weaponType)) skills.push('PRAYER_ARCHBISHOP_MASS_HEAL');
          if (isAdv && weaponType === 'HAMMER') skills.push('PRAYER_INQUISITOR_JUDGMENT');
        }
        
        // [註記] 裝備附加技能檢定：將裝備附帶的額外技能加入可用技能庫
        // 此處預留給未來法杖與戰鐮等裝備，讓法師功能性上升的擴充特性
        if (weapon && weapon.grantedSkill) {
          skills.push(weapon.grantedSkill);
        }

        
        // Grid setup
        let gridR = 0;
        let gridC = 0;
        let gridRow: string = FormationRow.FRONT;
        let hasGrid = false;
        let r_c = '';
        if (gridMap && Object.keys(gridMap).length > 0) {
          for (const [key, val] of Object.entries(gridMap)) {
            if (val === id) {
              r_c = key;
              gridR = parseInt(key.split('_')[0], 10);
              gridC = parseInt(key.split('_')[1], 10);
              gridRow = gridR === 0 ? FormationRow.FRONT : (gridR === 1 ? 'MIDDLE' : FormationRow.BACK);
              hasGrid = true;
              break;
            }
          }
        } else {
           gridRow = adv.formationRow || FormationRow.FRONT;
        }

        // Apply formation buffs if active
        if (formationActive && hasGrid) {
          const r = gridR;
          const c = gridC;
          
          formationConfig.buffRules.forEach(rule => {
            let applies = false;
            if (rule.target === 'ALL') applies = true;
            else if (rule.target === 'FRONT_ROW' && r === 0) applies = true;
            else if (rule.target === 'MIDDLE_ROW' && r === 1) applies = true;
            else if (rule.target === 'BACK_ROW' && r === 2) applies = true;
            else if (rule.target === 'REQUIRED_SLOTS') {
               applies = formationConfig.requiredSlots.some(s => s.row === r && s.col === c);
            }
            
            if (applies) {
               if (rule.stats.atk) stats.atk = Math.floor(stats.atk * rule.stats.atk);
               if (rule.stats.def) stats.def = Math.floor(stats.def * rule.stats.def);
               if (rule.stats.evade) stats.evade = Math.floor(stats.evade * rule.stats.evade);
               if (rule.stats.hit) stats.hit = Math.floor(stats.hit * rule.stats.hit);
            }
          });
        }

        playerTeam.push({
          id: adv.id,
          name: adv.name,
          isPlayer: true,
          row: gridRow,
          gridR: hasGrid ? gridR : undefined,
          gridC: hasGrid ? gridC : undefined,
          maxHp: stats.hp,
          currentHp: stats.hp,
          stats: { ...stats },
          statusEffects: [],
          shieldType: troop?.type,
          shieldMaxHp: troop?.count ? troop.count * 10 : 0, 
          shieldCurrentHp: troop?.count ? troop.count * 10 : 0,
          baseClass: adv.job?.name || '戰士',
          weaponType: weaponType,
          skills: skills,
          isAdvanced: adv.isAdvanced && adv.level >= 10,
          attributes: adv.getEffectiveAttributes()
        });
      }
    });

    // 記錄玩家初始狀態供 UI 繪製，敵方則在 WAVE_START 動態處理
    const initialStates = [...playerTeam].map(p => ({
      id: p.id,
      name: p.name,
      isPlayer: p.isPlayer,
      row: p.row,
      gridR: p.gridR,
      gridC: p.gridC,
      maxHp: p.maxHp
    }));

    let isVictory = false;
    let allWavesCleared = true;

    for (let wave = 1; wave <= totalWaves; wave++) {
      const enemyTeam: CombatParticipant[] = [];
      const currentWaveDiff = taskDifficulty + (wave - 1) * 5;
      const enemyCount = Random.int(1, 3);
      
      for (let i = 0; i < enemyCount; i++) {
        // 若有具體敵方名單，從中依序取用（若不夠則重複取用最後一隻）
        let lineupMonster = undefined;
        if (enemyLineup && enemyLineup.length > 0) {
           lineupMonster = enemyLineup[Math.min(i, enemyLineup.length - 1)];
        }
        
        const eHp = lineupMonster ? lineupMonster.hp : (50 + currentWaveDiff * 5);
        let eDef = lineupMonster ? lineupMonster.defense : (currentWaveDiff * 2);
        let eEvade = lineupMonster ? lineupMonster.evade : (currentWaveDiff * 1.5);
        const eAtk = lineupMonster ? lineupMonster.damage : (10 + currentWaveDiff * 2);

        if (enemyFeature === 'HIGH_DEF' && !lineupMonster) eDef *= 2;
        if (enemyFeature === 'HIGH_EVADE' && !lineupMonster) eEvade *= 2;

        const isFront = Random.next() > 0.5;
        const eGridR = isFront ? 0 : 2; // Simple random placement
        const eGridC = Random.int(0, 2);
        
        enemyTeam.push({
          id: `enemy_${wave}_${i}`,
          name: lineupMonster ? lineupMonster.name : `野外魔物 ${String.fromCharCode(65 + i)}`,
          isPlayer: false,
          row: isFront ? FormationRow.FRONT : FormationRow.BACK,
          gridR: eGridR,
          gridC: eGridC,
          maxHp: eHp,
          currentHp: eHp,
          stats: { hp: eHp, mp: 0, atk: eAtk, def: eDef, hit: 20 + currentWaveDiff, evade: eEvade },
          attributes: { 
            con: 5 + currentWaveDiff, 
            spr: 5 + currentWaveDiff, 
            str: 10 + currentWaveDiff, 
            agi: 10 + currentWaveDiff, 
            int: 10 + currentWaveDiff, 
            luk: 10 + currentWaveDiff, 
            charm: 1, 
            command: 1 
          },
          statusEffects: []
        });
      }

      events.push({ 
        type: CombatEventType.WAVE_START, 
        wave, 
        enemies: enemyTeam.map(e => ({
          id: e.id,
          name: e.name,
          isPlayer: e.isPlayer,
          row: e.row,
          gridR: e.gridR,
          gridC: e.gridC,
          maxHp: e.maxHp
        })),
        text: `--- 第 ${wave} 波戰鬥開始！遭遇了 ${enemyCount} 名敵人。 ---` 
      });

      // 戰鬥主迴圈 (單波次)
      let turn = 1;
      const MAX_TURNS = 20;

      while (turn <= MAX_TURNS) {
        const allParticipants = [...playerTeam, ...enemyTeam].filter(p => p.currentHp > 0);
        if (playerTeam.every(p => p.currentHp <= 0) || enemyTeam.every(p => p.currentHp <= 0)) {
          break; // 單波次一方全滅
        }

        // 依敏捷排序
      allParticipants.sort((a, b) => (b.stats.evade + Random.next() * 20) - (a.stats.evade + Random.next() * 20));

      for (const actor of allParticipants) {
        if (actor.currentHp <= 0) continue;

        CombatSystem.processStatusEffects(actor, events);
        if (actor.currentHp <= 0) continue;

        // 減少冷卻時間
        if (actor.cooldowns) {
          for (const skillId in actor.cooldowns) {
            if (actor.cooldowns[skillId] > 0) actor.cooldowns[skillId]--;
          }
        }

        // Per-turn HP and MP regeneration
        if (actor.attributes) {
          const hpRegen = Math.max(1, Math.floor((actor.attributes.con || 0) * 0.5));
          const mpRegen = Math.max(1, Math.floor((actor.attributes.spr || 0) * 0.5));
          
          if (actor.currentHp < actor.maxHp) {
            actor.currentHp = Math.min(actor.maxHp, actor.currentHp + hpRegen);
            events.push({ type: CombatEventType.HEAL, targetName: actor.name, damage: hpRegen, targetHp: actor.currentHp, targetMaxHp: actor.maxHp, text: `${actor.name} 恢復了 ${hpRegen} 點 HP。` });
          }
          if (actor.stats.mp !== undefined) {
             // We don't have maxMp tracked universally in stats, let's assume 200 for now or whatever current is if it's over 200
             actor.stats.mp = Math.min(actor.stats.mp > 200 ? actor.stats.mp : 200, actor.stats.mp + mpRegen);
             events.push({ type: CombatEventType.HEAL, targetName: actor.name, text: `${actor.name} 恢復了 ${mpRegen} 點 MP。` });
          }
        }

        const isStunned = actor.statusEffects.some(s => s.type === StatusEffectType.STUN);
        if (isStunned) {
          events.push({ type: CombatEventType.MISS, actorName: actor.name, text: `${actor.name} 處於暈眩狀態，無法行動！` });
          continue;
        }

        const enemies = actor.isPlayer ? enemyTeam.filter(e => e.currentHp > 0) : playerTeam.filter(p => p.currentHp > 0);
        if (enemies.length === 0) break;

        const allies = actor.isPlayer ? playerTeam : enemyTeam;
        const frontEnemies = enemies.filter(e => e.row === FormationRow.FRONT);

        let validTargets = enemies;
        const tauntedEnemies = enemies.filter(e => e.statusEffects.some(s => s.type === StatusEffectType.TAUNT));
        
        if (tauntedEnemies.length > 0) {
          validTargets = tauntedEnemies;
        } else {
          // 近戰基礎邏輯：只能攻擊前排，除非前排死光
          if (frontEnemies.length > 0) {
            validTargets = frontEnemies;
          }
        }

        let target = Random.pick(validTargets);

        // 選擇技能 (Smart Casting AI)
        let selectedSkill = null;
        let skillTargets = [target]; // 最終確定的目標

        if (actor.skills && actor.skills.length > 0) {
          const availableSkills = actor.skills
            .map(id => SKILLS[id])
            .filter(s => s && actor.stats.mp >= s.mpCost && !(actor.cooldowns && actor.cooldowns[s.id] > 0));
          
          if (availableSkills.length > 0) {
            let bestWeight = -1;
            for (const s of availableSkills) {
              // 解析該技能的潛在目標
              let tempTargets = [target];
              if (s.targetType === TargetType.FRONT_ENEMIES) tempTargets = frontEnemies.length > 0 ? frontEnemies : validTargets;
              else if (s.targetType === TargetType.ALL_ENEMIES) tempTargets = enemies;
              else if (s.targetType === TargetType.ALL_ALLIES) tempTargets = allies;
              else if (s.targetType === TargetType.ALLY_LOWEST_HP) {
                const aliveAllies = allies.filter(a => a.currentHp > 0).sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp));
                tempTargets = [aliveAllies[0]];
              }
              else if (s.targetType === TargetType.SELF) tempTargets = [actor];
              else if (s.targetType === TargetType.BACK_ENEMY) {
                const backEnemies = enemies.filter(e => e.row === FormationRow.BACK);
                tempTargets = backEnemies.length > 0 ? [Random.pick(backEnemies)] : [target];
              }
              else if (s.targetType === TargetType.COLUMN) {
                tempTargets = target.gridC !== undefined ? enemies.filter(e => e.gridC === target.gridC) : [target];
              }

              // 計算 AI 權重
              const weight = s.aiWeight ? s.aiWeight(actor, tempTargets, enemies, allies) : s.mpCost;
              if (weight > 0 && weight > bestWeight) {
                bestWeight = weight;
                selectedSkill = s;
                skillTargets = tempTargets;
              }
            }
          }
        }

        if (selectedSkill) {
          // 施放技能
          actor.stats.mp -= selectedSkill.mpCost;
          
          // 進入 CD
          if (selectedSkill.cooldown) {
            if (!actor.cooldowns) actor.cooldowns = {};
            actor.cooldowns[selectedSkill.id] = selectedSkill.cooldown;
          }
          
          events.push({
            type: CombatEventType.SKILL_CAST,
            actorId: actor.id, actorName: actor.name,
            text: `${actor.name} 消耗了 ${selectedSkill.mpCost} MP 施放【${selectedSkill.name}】！`
          });
          
          const skillEvents = selectedSkill.execute(actor, skillTargets, enemies, allies);
          events.push(...skillEvents);
          
          // 死靈法師被動：靈魂虹吸 (技能吸血)
          if (actor.isAdvanced && actor.weaponType === 'SCYTHE' && actor.currentHp > 0) {
             const totalSkillDmg = skillEvents.reduce((sum, e) => sum + (e.damage || 0), 0);
             if (totalSkillDmg > 0) {
               const heal = Math.floor(totalSkillDmg * 0.2);
               actor.currentHp = Math.min(actor.maxHp, actor.currentHp + heal);
               events.push({
                 type: CombatEventType.HIT,
                 text: `${actor.name} 觸發【靈魂虹吸】，從造成的傷害中恢復了 ${heal} 點 HP！`
               });
             }
          }
          
          continue; // 技能施放完畢，跳過普攻階段
        }

        let hitChance = Math.max(0.1, Math.min(0.95, 0.7 + (actor.stats.hit - target.stats.evade) / 100));
        if (actor.isAdvanced && actor.weaponType === 'STAFF') hitChance = 1.0; // 法杖被動：必定命中
        if (target.isAdvanced && target.weaponType === 'MAGIC_RING' && target.statusEffects.some(s => s.type === StatusEffectType.TAUNT)) {
          hitChance = 0.0; // 詭術師被動：帶有嘲諷時 100% 閃避
        }
        if (Random.next() > hitChance) {
          events.push({
            type: CombatEventType.MISS,
            actorName: actor.name,
            targetName: target.name,
            text: `${actor.name} 的攻擊被 ${target.name} 閃避了！`
          });
          continue;
        }

        let finalDamage = 0;
        let isCrit = false;

        if (actor.isAdvanced && actor.weaponType === 'HAMMER') {
           const phys = calculateSkillDamage(actor, target, actor.stats.atk * 0.4, DamageType.PHYSICAL);
           const mag = calculateSkillDamage(actor, target, actor.stats.atk * 0.6, DamageType.MAGICAL);
           finalDamage = phys.damage + mag.damage;
           isCrit = phys.isCrit || mag.isCrit;
        } else if (actor.isAdvanced && actor.weaponType === 'DUAL_SWORDS') {
           const phys = calculateSkillDamage(actor, target, actor.stats.atk * 0.5, DamageType.PHYSICAL);
           const mag = calculateSkillDamage(actor, target, actor.stats.atk * 0.5, DamageType.MAGICAL);
           finalDamage = phys.damage + mag.damage;
           isCrit = phys.isCrit || mag.isCrit;
        } else {
           let dType = DamageType.PHYSICAL;
           if (['STAFF', 'HOLY_BOOK'].includes(actor.weaponType || '')) {
             dType = DamageType.MAGICAL;
           } else if (['SCYTHE', 'MAGIC_RING', 'MAGIC_BOW'].includes(actor.weaponType || '')) {
             dType = DamageType.CHAOS;
           }
           let atkPower = actor.stats.atk;
           if (actor.isAdvanced && actor.weaponType === 'DAGGERS' && (target.currentHp / target.maxHp) >= 0.7) {
             atkPower *= 1.3; // 暗殺者被動：普攻對健康目標增傷
           }
           const result = calculateSkillDamage(actor, target, atkPower, dType);
           finalDamage = result.damage;
           isCrit = result.isCrit;
        }

        // -- Phase 4: Shield Interceptor --
        let multiplier = 1;
        if (actor.shieldType && target.shieldType) {
          if (actor.shieldType === 'INFANTRY' && target.shieldType === 'CAVALRY') multiplier = 1.5;
          if (actor.shieldType === 'CAVALRY' && target.shieldType === 'ARCHER') multiplier = 1.5;
          if (actor.shieldType === 'ARCHER' && target.shieldType === 'INFANTRY') multiplier = 1.5;
          
          if (actor.shieldType === 'CAVALRY' && target.shieldType === 'INFANTRY') multiplier = 0.8;
          if (actor.shieldType === 'ARCHER' && target.shieldType === 'CAVALRY') multiplier = 0.8;
          if (actor.shieldType === 'INFANTRY' && target.shieldType === 'ARCHER') multiplier = 0.8;
        }

        const effectiveDamage = Math.floor(finalDamage * multiplier);
        let hpDamage = effectiveDamage;
        let sDamage = 0;

        if (target.shieldCurrentHp && target.shieldCurrentHp > 0) {
          sDamage = Math.min(target.shieldCurrentHp, effectiveDamage);
          target.shieldCurrentHp -= sDamage;
          hpDamage = effectiveDamage - sDamage;
          
          events.push({
            type: target.shieldCurrentHp === 0 ? CombatEventType.SHIELD_BREAK : CombatEventType.SHIELD_DAMAGE,
            actorId: actor.id, actorName: actor.name,
            targetId: target.id, targetName: target.name,
            shieldDamage: sDamage,
            shieldRemaining: target.shieldCurrentHp,
            text: `${actor.name} 攻擊了 ${target.name} 的部隊，造成了 ${sDamage} 點護盾傷害${multiplier !== 1 ? (multiplier > 1 ? ' (兵種剋制!)' : ' (兵種劣勢)') : ''}！${target.shieldCurrentHp === 0 ? '部隊全滅！' : ''}`
          });
        }
        
        if (hpDamage > 0) {
          // -- 法坦被動：苦痛分擔 (死靈法師) --
          if (target.isPlayer) {
            const necromancers = playerTeam.filter(p => p.isAdvanced && p.weaponType === 'SCYTHE' && p.currentHp > 0 && p.id !== target.id);
            if (necromancers.length > 0) {
              const necro = necromancers[0]; // 優先由第一位死靈法師分擔
              const absorbAmount = Math.floor(hpDamage * 0.5);
              const necroDamage = Math.floor(absorbAmount * 0.4); // 反映 20% 原始傷害 (50% * 0.4 = 20%)
              hpDamage -= absorbAmount;
              
              necro.currentHp -= necroDamage;
              events.push({
                type: CombatEventType.HIT,
                text: `${necro.name} 觸發【靈魂虹吸-苦痛分擔】，為 ${target.name} 吸收了 ${absorbAmount} 點傷害，自身承受了 ${necroDamage} 點傷害！`
              });
              if (necro.currentHp <= 0) {
                 necro.currentHp = 0;
                 events.push({ type: CombatEventType.DEATH, targetName: necro.name, text: `${necro.name} 因分擔過多傷害而倒下！` });
              }
            }
          }

          target.currentHp -= hpDamage;
          events.push({
            type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
            actorId: actor.id, actorName: actor.name,
            targetId: target.id, targetName: target.name,
            damage: hpDamage,
            targetHp: target.currentHp,
            targetMaxHp: target.maxHp,
            text: `${actor.name} 攻擊了 ${target.name}，${isCrit ? '致命一擊！' : ''}對本體造成 ${hpDamage} 點傷害。`
          });
          
          // 死靈法師被動：靈魂虹吸 (普攻吸血)
          if (actor.isAdvanced && actor.weaponType === 'SCYTHE' && actor.currentHp > 0) {
            const heal = Math.floor(hpDamage * 0.2);
            actor.currentHp = Math.min(actor.maxHp, actor.currentHp + heal);
            events.push({
              type: CombatEventType.HIT,
              text: `${actor.name} 觸發【靈魂虹吸】，恢復了 ${heal} 點 HP！`
            });
          }
        }
        // -- End Shield Interceptor --

        if (target.currentHp > 0) {
           if (actor.isPlayer && Random.next() < 0.15) {
             events.push(tryApplyStatus(target, { type: StatusEffectType.BLEED, duration: 3 }, actor.name, undefined, `${target.name} 陷入流血狀態！`));
           } else if (!actor.isPlayer && Random.next() < 0.1) {
             events.push(tryApplyStatus(target, { type: StatusEffectType.POISON, duration: 2, value: 5 }, actor.name, undefined, `${target.name} 陷入中毒狀態！`));
           }
        }

        if (target.currentHp <= 0) {
          target.currentHp = 0;
          events.push({ type: CombatEventType.DEATH, targetName: target.name, text: `${target.name} 倒下了！` });
        }
      }
      turn++;
    } // 單波次迴圈結束

      if (playerTeam.every(p => p.currentHp <= 0)) {
         break; // 英雄全滅，提早結束總波次迴圈
      }
      if (!enemyTeam.every(enemy => enemy.currentHp <= 0)) {
        allWavesCleared = false;
        break;
      }
    } // 總波次迴圈結束

    isVictory = playerTeam.some(p => p.currentHp > 0) && allWavesCleared;
    const timedOut = playerTeam.some(p => p.currentHp > 0) && !allWavesCleared;
    const battleLog = isVictory
      ? '我方部隊奮勇作戰，成功清剿了所有敵人！'
      : timedOut
        ? '戰鬥陷入僵局，我方在傷亡擴大前選擇撤退。'
        : '敵軍火力太強，我方部隊被迫撤退。';
    events.push({ type: CombatEventType.END, text: battleLog });

    const playerHpMap: Record<string, number> = {};
    const shieldLoss: Record<string, Record<string, number>> = {};
    
    playerTeam.forEach(p => {
      playerHpMap[p.id] = p.currentHp;
      if (p.shieldType && p.shieldMaxHp !== undefined && p.shieldCurrentHp !== undefined) {
        const lostHp = p.shieldMaxHp - p.shieldCurrentHp;
        const lostTroops = Math.ceil(lostHp / 10);
        if (lostTroops > 0) {
          shieldLoss[p.id] = { [p.shieldType]: lostTroops };
        }
      }
    });

    let totalDamageDealt = 0;
    const damageMap: Record<string, number> = {};
    events.forEach(e => {
      if ((e.type === CombatEventType.HIT || e.type === CombatEventType.CRIT) && e.actorId && e.damage) {
        if (playerTeam.find(p => p.id === e.actorId)) {
          totalDamageDealt += e.damage;
          damageMap[e.actorId] = (damageMap[e.actorId] || 0) + e.damage;
        }
      }
    });
    let mvpId = '';
    let maxDmg = -1;
    Object.entries(damageMap).forEach(([id, dmg]) => {
      if (dmg > maxDmg) { maxDmg = dmg; mvpId = id; }
    });
    const mvpName = playerTeam.find(p => p.id === mvpId)?.name || '無';

    return {
      isVictory,
      participants: playerTeam.map(p => p.id),
      lootValue: 0, // 由 DispatchSystem 負責發獎勵
      events,
      playerHpMap,
      battleLog,
      initialStates,
      mvpName,
      totalDamageDealt,
      terrain,
      shieldLoss
    };
  }

  private static processStatusEffects(actor: CombatParticipant, events: CombatEvent[]) {
    const activeEffects = [];
    for (const effect of actor.statusEffects) {
      if (effect.type === StatusEffectType.BLEED) {
        const dmg = Math.max(1, Math.floor(actor.maxHp * 0.05));
        actor.currentHp -= dmg;
        events.push({ type: CombatEventType.STATUS_DAMAGE, targetName: actor.name, damage: dmg, targetHp: actor.currentHp, text: `${actor.name} 因流血受到 ${dmg} 點傷害。`});
      } else if (effect.type === StatusEffectType.POISON) {
        const dmg = effect.value || 5;
        actor.currentHp -= dmg;
        events.push({ type: CombatEventType.STATUS_DAMAGE, targetName: actor.name, damage: dmg, targetHp: actor.currentHp, text: `${actor.name} 因中毒受到 ${dmg} 點傷害。`});
      } else if (effect.type === StatusEffectType.REGEN_HP) {
        const heal = effect.value || 10;
        actor.currentHp = Math.min(actor.maxHp, actor.currentHp + heal);
        events.push({ type: CombatEventType.HEAL, targetName: actor.name, damage: heal, targetHp: actor.currentHp, text: `${actor.name} 受益於生命恢復，回復了 ${heal} 點 HP。`});
      } else if (effect.type === StatusEffectType.REGEN_MP) {
        const healMp = effect.value || 5;
        actor.stats.mp = Math.min(200, actor.stats.mp + healMp);
        events.push({ type: CombatEventType.HEAL, targetName: actor.name, text: `${actor.name} 受益於魔力恢復，回復了 ${healMp} 點 MP。`});
      }

      if (actor.currentHp <= 0) {
        actor.currentHp = 0;
        events.push({ type: CombatEventType.DEATH, targetName: actor.name, text: `${actor.name} 傷重倒地！` });
        return; 
      }

      effect.duration--;
      if (effect.duration > 0) {
        activeEffects.push(effect);
      }
    }
    actor.statusEffects = activeEffects;
  }
}
