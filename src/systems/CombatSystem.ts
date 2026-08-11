import { GameState } from '../core/GameState';
import { EquipmentGenerator } from './EquipmentGenerator';
import { CombatReport, CombatEvent, CombatEventType, CombatParticipant, StatusEffectType, StatusEffect, tryApplyStatus } from '../models/Combat';
import { FormationRow, TerrainType, EquipmentSlot, getOfficeConfig, DamageType, ElementType } from '../models/types';
import { Random } from '../core/Random';
import { TargetType } from '../models/Skill';
import { SKILLS } from '../data/SkillData';
import { GambitEvaluator } from './combat/GambitEvaluator';
import { calculateSkillDamage } from '../utils/CombatMath';
import { FormationDB } from '../systems/FormationDB';
import { PassiveManager } from './combat/PassiveManager';

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
    gridMap?: Record<string, string>,
    initialHpMpOverride?: { hp: Record<string, number>, mp: Record<string, number> }
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
            stats.patk = Math.floor(stats.patk * (1 + cfg.combatBonusPct));
            stats.matk = Math.floor(stats.matk * (1 + cfg.combatBonusPct));
            stats.pdef = Math.floor(stats.pdef * (1 + cfg.combatBonusPct));
            stats.mdef = Math.floor(stats.mdef * (1 + cfg.combatBonusPct));
            stats.atk = Math.max(stats.patk, stats.matk);
            stats.def = stats.pdef;
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
          }
          if (isAdv && weaponType === 'MAGIC_RING') skills.push('TRICKSTER_TRICK_MAGIC');
        }
        if (jobName.includes('騎士')) {
          skills.push('KNIGHT_SHIELD_BASH', 'KNIGHT_TAUNT');
          if (isAdv && weaponType === 'SWORD_AND_SHIELD') skills.push('KNIGHT_PALADIN_AEGIS');
          if (isAdv && weaponType === 'RUNE_SHIELD') skills.push('KNIGHT_RUNE_REFLECTION');
        }
        if (jobName.includes('祈禱者')) {
          skills.push('PRAYER_HEAL', 'PRAYER_HOLY_LIGHT');
          if (isAdv && weaponType === 'HOLY_BOOK') skills.push('PRAYER_ARCHBISHOP_MASS_HEAL');
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

        const attributes = adv.getEffectiveAttributes();
        const maxMpBase = attributes?.spr ? attributes.spr * 5 : (stats.mp || 100);
        let currentHp = stats.hp;
        let currentMp = maxMpBase;
        
        if (initialHpMpOverride) {
           if (initialHpMpOverride.hp[adv.id] !== undefined) currentHp = initialHpMpOverride.hp[adv.id];
           if (initialHpMpOverride.mp[adv.id] !== undefined) currentMp = initialHpMpOverride.mp[adv.id];
        }

        playerTeam.push({
          id: adv.id,
          name: adv.name,
          isPlayer: true,
          row: gridRow,
          gridR: hasGrid ? gridR : undefined,
          gridC: hasGrid ? gridC : undefined,
          maxHp: stats.hp,
          currentHp: currentHp,
          stats: { ...stats, mp: currentMp },
          attributes: attributes,
          statusEffects: [],
          shieldType: troop?.type,
          shieldMaxHp: troop?.count ? troop.count * 10 : 0, 
          shieldCurrentHp: troop?.count ? troop.count * 10 : 0,
          baseClass: adv.job?.name || '戰士',
          weaponType: weaponType,
          element: weapon?.element || ElementType.NONE,
          skills: skills,
          isAdvanced: adv.isAdvanced && adv.level >= 10,
        });
        PassiveManager.onCombatStart(playerTeam[playerTeam.length - 1]);
      }
    });

    // 記錄玩家初始狀態供 UI 繪製，敵方則在 WAVE_START 動態處理
    const initialStates = [...playerTeam].map(p => {
      const adv = GameState.adventurers.find(a => a.id === p.id);
      const maxMp = p.attributes?.spr ? p.attributes.spr * 5 : (p.stats.mp || 100);
      return {
        id: p.id,
        name: p.name,
        isPlayer: p.isPlayer,
        row: p.row,
        gridR: p.gridR,
        gridC: p.gridC,
        maxHp: p.maxHp,
        maxMp: maxMp,
        currentMp: p.stats.mp ?? maxMp,
        avatarIndex: adv?.avatarIndex ?? 0
      };
    });

    let isVictory = false;
    let allWavesCleared = true;
    let totalEarnedGold = 0;
    let totalEarnedExp = 0;
    const droppedEquipment: string[] = [];

    for (let wave = 1; wave <= totalWaves; wave++) {
      const enemyTeam: CombatParticipant[] = [];
      const occupiedEnemyGrids = new Set<string>();
      const currentWaveDiff = taskDifficulty + (wave - 1) * 5;
      const enemyCount = (enemyLineup && enemyLineup.length > 0) ? enemyLineup.length : Random.int(1, 3);
      
      for (let i = 0; i < enemyCount; i++) {
        // 若有具體敵方名單，從中依序取用
        let lineupMonster = undefined;
        if (enemyLineup && enemyLineup.length > 0) {
           lineupMonster = enemyLineup[Math.min(i, enemyLineup.length - 1)];
        }
        
        const eHp = lineupMonster ? lineupMonster.hp : (50 + currentWaveDiff * 5);
        let ePdef = lineupMonster ? (lineupMonster.pdef || lineupMonster.defense) : (currentWaveDiff * 2);
        let eMdef = lineupMonster ? (lineupMonster.mdef || lineupMonster.defense) : (currentWaveDiff * 2);
        let eDef = ePdef;
        let eEvade = lineupMonster ? lineupMonster.evade : (currentWaveDiff * 1.5);
        const eAtk = lineupMonster ? lineupMonster.damage : (10 + currentWaveDiff * 2);

        if (enemyFeature === 'HIGH_DEF' && !lineupMonster) {
          ePdef *= 2;
          eMdef *= 2;
          eDef *= 2;
        }
        if (enemyFeature === 'HIGH_EVADE' && !lineupMonster) eEvade *= 2;

        let eGridR = 0;
        let eGridC = 0;
        let attempts = 0;
        let isFront = true;
        do {
           isFront = Random.next() > 0.5;
           eGridR = isFront ? 0 : 2; // Simple random placement
           eGridC = Random.int(0, 2);
           attempts++;
        } while (occupiedEnemyGrids.has(`${eGridR}_${eGridC}`) && attempts < 10);
        occupiedEnemyGrids.add(`${eGridR}_${eGridC}`);
        
        enemyTeam.push({
          id: `enemy_${wave}_${i}`,
          name: lineupMonster ? lineupMonster.name : `野外魔物 ${String.fromCharCode(65 + i)}`,
          isPlayer: false,
          row: isFront ? FormationRow.FRONT : FormationRow.BACK,
          gridR: eGridR,
          gridC: eGridC,
          maxHp: eHp,
          currentHp: eHp,
          element: lineupMonster?.element || ElementType.NONE,
          stats: { hp: eHp, mp: 50 + currentWaveDiff * 5, patk: eAtk, matk: eAtk, pdef: ePdef, mdef: eMdef, hit: 20 + currentWaveDiff, evade: eEvade, critRate: 5, critDmg: 150, atk: eAtk, def: eDef },
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
          statusEffects: [],
          goldReward: lineupMonster?.goldReward,
          expReward: lineupMonster?.expReward,
          equipmentDropRate: lineupMonster?.equipmentDropRate
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
          maxHp: e.maxHp,
          maxMp: e.stats.mp || 50,
          currentMp: e.stats.mp || 50
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

        // Per-turn HP and MP regeneration (削弱為 CON/SPR * 0.2，並標記為 isQuietRegen 避開對話框洗版)
        if (actor.attributes) {
          const hpRegen = Math.max(1, Math.floor((actor.attributes.con || 0) * 0.2));
          const mpRegen = Math.max(1, Math.floor((actor.attributes.spr || 0) * 0.2));
          
          if (actor.currentHp < actor.maxHp) {
            actor.currentHp = Math.min(actor.maxHp, actor.currentHp + hpRegen);
            events.push({
              type: CombatEventType.HEAL,
              actorId: actor.id,
              targetId: actor.id,
              targetName: actor.name,
              damage: hpRegen,
              targetHp: actor.currentHp,
              targetMaxHp: actor.maxHp,
              isQuietRegen: true,
              healType: 'HP',
              text: `${actor.name} 恢復了 ${hpRegen} 點 HP。`
            });
          }
          if (actor.stats.mp !== undefined) {
             actor.stats.mp = Math.min(actor.stats.mp > 200 ? actor.stats.mp : 200, actor.stats.mp + mpRegen);
             events.push({
               type: CombatEventType.HEAL,
               actorId: actor.id,
               targetId: actor.id,
               targetName: actor.name,
               damage: mpRegen,
               isQuietRegen: true,
               healType: 'MP',
               text: `${actor.name} 恢復了 ${mpRegen} 點 MP。`
             });
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

        // 先讓 GAMBIT 進行決策
        let gambitResult = GambitEvaluator.evaluate(actor, playerTeam, enemyTeam);
        let selectedSkill = null;
        let skillTargets = [target]; // 最終確定的目標

        if (gambitResult) {
          if (gambitResult.skillId !== 'DEFAULT_ATTACK') {
             selectedSkill = SKILLS[gambitResult.skillId];
          }
          skillTargets = gambitResult.targets;
        } else {
          // 選擇技能 (Smart Casting AI - 只有在沒觸發 Gambit 時執行)
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
        // end of gambit else block
        }

        if (selectedSkill) {
          // 施放技能
          actor.stats.mp -= selectedSkill.mpCost;
          
          // 進入 CD
          if (selectedSkill.cooldown) {
            if (!actor.cooldowns) actor.cooldowns = {};
            actor.cooldowns[selectedSkill.id] = selectedSkill.cooldown;
          }
          
          const actorMaxMp = actor.attributes?.spr ? actor.attributes.spr * 5 : 100;
          events.push({
            type: CombatEventType.SKILL_CAST,
            actorId: actor.id, actorName: actor.name,
            targetId: actor.id,
            targetMp: actor.stats.mp,
            targetMaxMp: actorMaxMp,
            text: `${actor.name} 消耗了 ${selectedSkill.mpCost} MP 施放【${selectedSkill.name}】！`
          });
          
          const skillEvents = selectedSkill.execute(actor, skillTargets, enemies, allies);
          events.push(...skillEvents);
          
          const totalSkillDmg = skillEvents.reduce((sum, e) => sum + (e.damage || 0), 0);
          PassiveManager.onDamageDealt(actor, totalSkillDmg, events, 'SKILL');
          
          continue; // 技能施放完畢，跳過普攻階段
        }

        let baseHitChance = Math.max(0.1, Math.min(0.95, 0.7 + (actor.stats.hit - target.stats.evade) / 100));
        let hitChance = PassiveManager.getModifiedHitChance(actor, target, baseHitChance);
        if (Random.next() > hitChance) {
          events.push({
            type: CombatEventType.MISS,
            actorName: actor.name,
            targetName: target.name,
            text: `${actor.name} 的攻擊被 ${target.name} 閃避了！`
          });
          continue;
        }

        const result = PassiveManager.calculateBasicAttackDamage(actor, target);
        let finalDamage = result.damage;
        let isCrit = result.isCrit;

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
          hpDamage = PassiveManager.onAllyTakingDamage(target, hpDamage, playerTeam, events);

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
          
          PassiveManager.onDamageDealt(actor, hpDamage, events, 'BASIC_ATTACK');
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

          if (!target.isPlayer) {
            totalEarnedGold += target.goldReward || 0;
            totalEarnedExp += target.expReward || 0;
            if (target.equipmentDropRate && Random.next() < target.equipmentDropRate) {
              const equip = EquipmentGenerator.dropRandomEquipment(Math.max(5, Math.floor(currentWaveDiff / 2)));
              if (equip) {
                GameState.myTerritory.addEquipmentToWarehouse(equip);
                droppedEquipment.push(equip.name);
              }
            }
          }
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
    const playerMpMap: Record<string, number> = {};
    const shieldLoss: Record<string, Record<string, number>> = {};
    
    playerTeam.forEach(p => {
      playerHpMap[p.id] = p.currentHp;
      playerMpMap[p.id] = p.stats.mp || 0;
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
      lootValue: Math.floor(Math.random() * 50) + 50,
      events,
      playerHpMap,
      playerMpMap,
      battleLog,
      initialStates,
      mvpName,
      totalDamageDealt,
      terrain,
      shieldLoss,
      totalEarnedGold,
      totalEarnedExp,
      droppedEquipment
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
