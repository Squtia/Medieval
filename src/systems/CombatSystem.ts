import { GameState } from '../core/GameState';
import { CombatReport, CombatEvent, CombatEventType, CombatParticipant, StatusEffectType, StatusEffect } from '../models/Combat';
import { FormationRow, TerrainType } from '../models/types';
import { Random } from '../core/Random';

export class CombatSystem {
  public static simulateCombat(
    attackerIds: string[], 
    taskDifficulty: number = 10, 
    enemyFeature: string = '', 
    terrain?: TerrainType, 
    totalWaves: number = 1,
    troopAssignments?: Record<string, { type: string, count: number }>,
    enemyLineup?: import('../models/types').MonsterInstance[]
  ): CombatReport {
    const events: CombatEvent[] = [];
    const playerTeam: CombatParticipant[] = [];
    
    // 1. 初始化我方 (僅初始化一次，狀態延續)
    attackerIds.forEach((id: string) => {
      const adv = GameState.adventurers.find(a => a.id === id);
      if (adv) {
        const stats = adv.getCombatStats();
        const troop = troopAssignments?.[id];
        playerTeam.push({
          id: adv.id,
          name: adv.name,
          isPlayer: true,
          row: adv.formationRow || FormationRow.FRONT,
          maxHp: stats.hp,
          currentHp: stats.hp,
          stats: { ...stats },
          statusEffects: [],
          shieldType: troop?.type,
          shieldMaxHp: troop?.count ? troop.count * 10 : 0, // 假設每兵力提供 10 點護盾值
          shieldCurrentHp: troop?.count ? troop.count * 10 : 0
        });
      }
    });

    // 記錄玩家初始狀態供 UI 繪製，敵方則在 WAVE_START 動態處理
    const initialStates = [...playerTeam].map(p => ({
      id: p.id,
      name: p.name,
      isPlayer: p.isPlayer,
      row: p.row,
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
        const eName = lineupMonster ? `${lineupMonster.name} ${i + 1}` : `怪物 ${i + 1}`;

        if (enemyFeature === 'HIGH_DEF' && !lineupMonster) eDef *= 2;
        if (enemyFeature === 'HIGH_EVADE' && !lineupMonster) eEvade *= 2;

        enemyTeam.push({
          id: `enemy_w${wave}_${i}`,
          name: eName,
          isPlayer: false,
          row: Random.next() > 0.5 ? FormationRow.FRONT : FormationRow.BACK,
          maxHp: eHp,
          currentHp: eHp,
          stats: { hp: eHp, mp: 0, atk: eAtk, def: eDef, hit: 20 + currentWaveDiff, evade: eEvade },
          statusEffects: []
        });
      }

      events.push({ 
        type: CombatEventType.WAVE_START, 
        wave, 
        enemies: enemyTeam.map(e => ({ id: e.id, name: e.name, isPlayer: e.isPlayer, row: e.row, maxHp: e.maxHp })),
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

        const isStunned = actor.statusEffects.some(s => s.type === StatusEffectType.STUN);
        if (isStunned) {
          events.push({ type: CombatEventType.MISS, actorName: actor.name, text: `${actor.name} 處於暈眩狀態，無法行動！` });
          continue;
        }

        const enemies = actor.isPlayer ? enemyTeam.filter(e => e.currentHp > 0) : playerTeam.filter(p => p.currentHp > 0);
        if (enemies.length === 0) break;

        // 近戰基礎邏輯：只能攻擊前排，除非前排死光
        let validTargets = enemies;
        const frontEnemies = enemies.filter(e => e.row === FormationRow.FRONT);
        if (frontEnemies.length > 0) {
          validTargets = frontEnemies;
        }

        let target = validTargets.find(e => e.statusEffects.some(s => s.type === StatusEffectType.TAUNT));
        if (!target) {
          target = Random.pick(validTargets);
        }

        const hitChance = Math.max(0.1, Math.min(0.95, 0.7 + (actor.stats.hit - target.stats.evade) / 100));
        if (Random.next() > hitChance) {
          events.push({
            type: CombatEventType.MISS,
            actorName: actor.name,
            targetName: target.name,
            text: `${actor.name} 的攻擊被 ${target.name} 閃避了！`
          });
          continue;
        }

        const critChance = 0.05 + (actor.stats.hit / 500);
        const isCrit = Random.next() < critChance;
        let baseDamage = actor.stats.atk;
        if (isCrit) baseDamage *= 1.5;

        const dmgReduction = target.stats.def / (target.stats.def + 50);
        let finalDamage = Math.max(1, Math.floor(baseDamage * (1 - dmgReduction)));
        finalDamage = Math.floor(finalDamage * (0.9 + Random.next() * 0.2));

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
        }
        // -- End Shield Interceptor --

        if (target.currentHp > 0) {
           if (actor.isPlayer && Random.next() < 0.15) {
             target.statusEffects.push({ type: StatusEffectType.BLEED, duration: 3 });
             events.push({ type: CombatEventType.STATUS_APPLY, targetId: target.id, targetName: target.name, statusType: StatusEffectType.BLEED, text: `${target.name} 陷入流血狀態！` });
           } else if (!actor.isPlayer && Random.next() < 0.1) {
             target.statusEffects.push({ type: StatusEffectType.POISON, duration: 2, value: 5 });
             events.push({ type: CombatEventType.STATUS_APPLY, targetId: target.id, targetName: target.name, statusType: StatusEffectType.POISON, text: `${target.name} 陷入中毒狀態！` });
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
