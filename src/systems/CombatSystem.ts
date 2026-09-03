import { GameState } from '../core/GameState';
import { EquipmentGenerator } from './EquipmentGenerator';
import { CombatReport, CombatEvent, CombatEventType, CombatParticipant, StatusEffectType, StatusEffect, tryApplyStatus } from '../models/Combat';
import { FormationRow, TerrainType, EquipmentSlot, getOfficeConfig, DamageType, ElementType } from '../models/types';
import { Random } from '../core/Random';
import { TargetType } from '../models/Skill';
import { SKILLS, getSkillVfxId } from '../data/SkillData';
import { SkillRegistry } from './combat/SkillRegistry';
import { GambitEvaluator } from './combat/GambitEvaluator';
import { calculateSkillDamage, getEvade } from '../utils/CombatMath';
import { FormationDB } from '../systems/FormationDB';
import { PassiveManager } from './combat/PassiveManager';
import { SkillEffectEngine } from './combat/SkillEffectEngine';
import { LordCommanderSystem } from './combat/LordCommanderSystem';
import { FactionArmyGenerator } from './map/FactionArmyGenerator';

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
    initialHpMpOverride?: { hp: Record<string, number>, mp: Record<string, number> },
    waveEnemyLineups?: import('../models/types').MonsterInstance[][],
    siegeOptions?: {
      isSiege: boolean;
      gateHp: number;
      watchtowerDmg?: number;
      archerVolleyDmg?: number;   // 弓兵民兵每 2 回合齊射傷害
      cavalryCount?: number;      // 騎兵數量（每 3 回合出城衝鋒）
      infantryCount?: number;     // 步兵數量
      isFieldInterception?: boolean; // 野外大軍攔截戰
      isLordCampaign?: boolean;   // 👑 領主親自率軍親征
      lordTitle?: import('../models/types').NobleTitle;
      assignedTroops?: { infantry: number; archer: number; cavalry: number; };
      reserveSquads?: { defenderIds: string[]; formationId?: string; gridMap?: Record<string, string> }[];
      enemyLegion?: { enabled?: boolean; infantry?: number; archer?: number; cavalry?: number; };
    }
  ): CombatReport {
    const events: CombatEvent[] = [];
    const playerTeam: CombatParticipant[] = [];
    const isFieldInterception = !!siegeOptions?.isFieldInterception;
    const isDefenseSiege = siegeOptions?.isSiege && !isFieldInterception;
    let gateRemainingHp = isDefenseSiege ? siegeOptions.gateHp : undefined;
    const watchtowerDmg = isDefenseSiege ? (siegeOptions?.watchtowerDmg || 0) : 0;
    const archerVolleyDmg = siegeOptions?.archerVolleyDmg || 0;
    const cavalryCount = siegeOptions?.cavalryCount || 0; // 騎兵數量（衝鋒用）
    const enemyLegion = siegeOptions?.enemyLegion;
    const reserveSquadsQueue = siegeOptions?.reserveSquads ? [...siegeOptions.reserveSquads] : [];
    let currentSquadIndex = 0;

    // 兵力統計提升至作用域頂部供全模擬與報表使用
    const infCount = siegeOptions?.infantryCount || siegeOptions?.assignedTroops?.infantry || 0;
    const arcCount = siegeOptions?.assignedTroops?.archer || (siegeOptions?.archerVolleyDmg ? Math.round(Math.pow(siegeOptions.archerVolleyDmg / 35, 2)) : 0) || 0;
    const activeCavCount = cavalryCount || siegeOptions?.assignedTroops?.cavalry || 0;
    
    // 👑 領主親征判定與光環計算（僅限親自出征，委託派遣不帶光環）
    const isLordCampaign = siegeOptions?.isLordCampaign === true;
    const lordAura = isLordCampaign ? LordCommanderSystem.getLordAura(siegeOptions?.lordTitle || GameState.myTerritory?.title) : undefined;

    if (lordAura) {
      events.push({
        type: CombatEventType.LORD_AURA_TRIGGER,
        auraDesc: lordAura.description,
        text: `👑 【領主親征光環啟動】${lordAura.name}！${lordAura.description}`
      });
    }
    
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

        // 👑 領主親征光環全體攻防與暴擊加成
        if (lordAura) {
          stats.patk = Math.floor(stats.patk * (1 + lordAura.statBonusPct));
          stats.matk = Math.floor(stats.matk * (1 + lordAura.statBonusPct));
          stats.pdef = Math.floor(stats.pdef * (1 + lordAura.statBonusPct));
          stats.mdef = Math.floor(stats.mdef * (1 + lordAura.statBonusPct));
          stats.critRate = Math.min(100, (stats.critRate || 5) + lordAura.critBonusPct);
          stats.atk = Math.max(stats.patk, stats.matk);
          stats.def = stats.pdef;
        }
        const troop = troopAssignments?.[id];
        const weapon = adv.equipment ? adv.equipment[EquipmentSlot.WEAPON] : undefined;
        const armor = adv.equipment ? adv.equipment[EquipmentSlot.ARMOR] : undefined;
        const weaponType = weapon ? weapon.weaponType : undefined;
        
        let skills: string[] = [];
        const jobName = adv.job?.name || '';
        const isAdv = adv.isAdvanced && adv.level >= 10;
        
        const lvl = adv.level || 1;
        // 優先使用客製化技能 (Custom Skills SSOT)
        if (adv.customSkills && Array.isArray(adv.customSkills) && adv.customSkills.length > 0) {
          skills.push(...adv.customSkills);
        } else {
          const isWarrior = ['戰士', '狂戰士', '魔劍士', '狂戰', '魔劍'].some(j => jobName.includes(j));
          const isMage = ['法師', '大魔導士', '死靈法師', '魔導', '死靈'].some(j => jobName.includes(j));
          const isArcher = ['弓箭手', '神射手', '精靈使', '弓手', '神射', '精靈'].some(j => jobName.includes(j));
          const isThief = ['盜賊', '暗殺者', '詭術師', '刺客', '暗殺', '詭術'].some(j => jobName.includes(j));
          const isKnight = ['騎士', '聖騎士', '符文騎士', '聖騎', '符文'].some(j => jobName.includes(j));
          const isPrayer = ['祈禱者', '大主教', '異端拷問官', '神官', '主教', '拷問官'].some(j => jobName.includes(j));

          if (isWarrior) {
            if (lvl >= 2) skills.push('FIGHTER_HEAVY_STRIKE');
            if (lvl >= 5) skills.push('FIGHTER_ARMOR_BREAK');
            if (isAdv && weaponType === 'GREATSWORD') skills.push('GREATSWORD_WHIRLWIND');
            if (isAdv && weaponType === 'DUAL_SWORDS') skills.push('MAGIC_SWORDSMAN_PHANTOM');
          }
          if (isMage) {
            if (lvl >= 2) {
              // 元素法杖轉化機制
              const elem = weapon?.element;
              if (weaponType === 'STAFF' && elem && elem !== ElementType.NONE) {
                switch (elem) {
                  case ElementType.FIRE: skills.push('MAGE_FIRE_BOLT'); break;
                  case ElementType.ICE: skills.push('MAGE_ICE_SPIKE'); break;
                  case ElementType.LIGHTNING: skills.push('MAGE_LIGHTNING_BOLT'); break;
                  case ElementType.HOLY: skills.push('MAGE_HOLY_SMITE'); break;
                  case ElementType.DARK: skills.push('MAGE_DARK_ORB'); break;
                  default: skills.push('MAGE_ARCANE_MISSILES'); break;
                }
              } else {
                skills.push('MAGE_ARCANE_MISSILES');
              }
            }
            if (lvl >= 5) skills.push('MAGE_STATIC_FIELD');
            if (isAdv && weaponType === 'STAFF') skills.push('STAFF_METEOR');
            if (isAdv && weaponType === 'SCYTHE') skills.push('SCYTHE_SOUL_REAP');
          }
          if (isArcher) {
            if (lvl >= 2) skills.push('ARCHER_PIERCING_SHOT');
            if (lvl >= 5) skills.push('ARCHER_AIMED_SHOT');
            if (isAdv && weaponType === 'BOW') skills.push('SNIPER_FATAL_SNIPE');
            if (isAdv && weaponType === 'MAGIC_BOW') skills.push('SPIRIT_ARCHER_SPIRIT_CHAIN');
          }
          if (isThief) {
            if (lvl >= 2) skills.push('THIEF_SURPRISE_ATTACK');
            if (lvl >= 5) skills.push('THIEF_POISON_BLADE');
            if (isAdv && weaponType === 'DAGGERS') {
              skills.push('ASSASSIN_SHADOW_ASSASSINATION');
            }
            if (isAdv && weaponType === 'MAGIC_RING') skills.push('TRICKSTER_TRICK_MAGIC');
          }
          if (isKnight) {
            if (lvl >= 2) skills.push('KNIGHT_SHIELD_BASH');
            if (lvl >= 5) skills.push('KNIGHT_TAUNT');
            if (isAdv && weaponType === 'SWORD_AND_SHIELD') skills.push('KNIGHT_PALADIN_AEGIS');
            if (isAdv && weaponType === 'RUNE_SHIELD') skills.push('KNIGHT_RUNE_REFLECTION');
          }
          if (isPrayer) {
            if (lvl >= 2) skills.push('PRAYER_HEAL');
            if (lvl >= 5) skills.push('PRAYER_HOLY_LIGHT');
            if (isAdv && weaponType === 'HOLY_BOOK') skills.push('PRAYER_ARCHBISHOP_MASS_HEAL');
            if (isAdv && weaponType === 'HAMMER') skills.push('PRAYER_INQUISITOR_JUDGMENT');
          }
        }

        
        // [註記] 裝備附加技能檢定：將武器與防具/飾品附帶的 extraSkills 注入可用技能庫
        const allEquippedItems = Object.values(adv.equipment || {}).filter(Boolean) as any[];
        for (const eq of allEquippedItems) {
          if (eq.grantedSkill && !skills.includes(eq.grantedSkill)) {
            skills.push(eq.grantedSkill);
          }
          if (eq.extraSkills && Array.isArray(eq.extraSkills)) {
            for (const skId of eq.extraSkills) {
              if (skId && !skills.includes(skId)) {
                skills.push(skId);
              }
            }
          }
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
        let currentHp = typeof adv.getCurrentHp === 'function' ? adv.getCurrentHp() : (adv.currentHp !== undefined ? adv.currentHp : stats.hp);
        let currentMp = typeof adv.getCurrentMp === 'function' ? adv.getCurrentMp() : (adv.currentMp !== undefined ? adv.currentMp : maxMpBase);
        
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
          maxMp: stats.mp,
          currentMp: currentMp,
          stats: stats,
          attributes: attributes,
          statusEffects: [],
          shieldType: troop?.type,
          shieldMaxHp: troop?.count ? troop.count * 50 : 0,    // 修復 Bug4：公式統一為 ×50
          shieldCurrentHp: troop?.count ? troop.count * 50 : 0, // 修復 Bug4
          baseClass: adv.job?.name || '戰士',
          weaponType: weaponType,
          atkElement: weapon?.element || ElementType.NONE,
          defElement: armor?.element || ElementType.NONE,
          element: armor?.element || weapon?.element || ElementType.NONE,
          skills: skills,
          isAdvanced: adv.isAdvanced && adv.level >= 10,
        });
        PassiveManager.onCombatStart(playerTeam[playerTeam.length - 1]);
      }
    });

    // 追蹤所有登場過的參戰傭兵（包含第 1 梯隊與後續增援梯隊）
    const allTrackedPlayers: CombatParticipant[] = [...playerTeam];

    // 記錄玩家初始狀態供 UI 繪製，敵方則在 WAVE_START 動態處理
    const initialStates = [...playerTeam].map(p => {
      const adv = GameState.adventurers.find(a => a.id === p.id);
      const maxMp = p.maxMp ?? 100;
      return {
        id: p.id,
        name: p.name,
        isPlayer: p.isPlayer,
        row: p.row,
        gridR: p.gridR,
        gridC: p.gridC,
        maxHp: p.maxHp,
        maxMp: maxMp,
        currentMp: p.currentMp ?? maxMp,
        avatarIndex: adv?.avatarIndex ?? 0,
        avatarIcon: (adv as any)?.avatarIcon,
        gender: adv?.gender,
        isGuardian: adv?.isGuardian ?? false
      };
    });

    let isVictory = false;
    let allWavesCleared = true;
    let totalEarnedGold = 0;
    let totalEarnedExp = 0;
    const droppedEquipment: string[] = [];
    const allWavesEnemyTeams: Record<number, CombatParticipant[]> = {};
    let lastActiveWave = 1;

    // 構建當前不可用英雄名冊 (SSOT)
    const allCapturedPrisoners: { id: string; characterKey?: string; boundMonsterId?: string }[] = [];
    const territoryPrisonerHeroIds = GameState.myTerritory?.dungeonPrisonerHeroIds || [];
    territoryPrisonerHeroIds.forEach(hid => {
      allCapturedPrisoners.push({ id: hid });
    });
    const factions = GameState.mapSystem?.getFactions() || [];
    factions.forEach(f => {
      if (f.capturedChampionIds) {
        f.capturedChampionIds.forEach(cid => {
          const champ = f.champions?.find(c => c.id === cid);
          allCapturedPrisoners.push({
            id: cid,
            characterKey: (champ as any)?.characterKey,
            boundMonsterId: (champ as any)?.boundMonsterId
          });
        });
      }
    });
    const unavailableSet = FactionArmyGenerator.buildUnavailableCharacterSet(
      (GameState.adventurers as any) || [],
      allCapturedPrisoners,
      []
    );

    for (let wave = 1; wave <= totalWaves; wave++) {
      lastActiveWave = wave;
      const enemyTeam: CombatParticipant[] = [];
      allWavesEnemyTeams[wave] = enemyTeam;
      const occupiedEnemyGrids = new Set<string>();
      const currentWaveDiff = taskDifficulty + (wave - 1) * 5;
      
      // 判斷當前波次的敵人陣容
      let currentWaveLineup: import('../models/types').MonsterInstance[] | undefined = undefined;
      if (waveEnemyLineups && waveEnemyLineups[wave - 1]) {
        currentWaveLineup = waveEnemyLineups[wave - 1];
      } else if (enemyLineup && enemyLineup.length > 0) {
        if (totalWaves > 1 && wave < totalWaves) {
          // 非最終波：過濾掉首領/Boss，改由普通小怪/護衛出場
          const minions = enemyLineup.filter(m => !m.name.includes('👑') && !m.name.includes('首領') && !m.name.includes('Boss') && (m.powerTier || 1.0) < 2.0);
          currentWaveLineup = minions.length > 0 ? minions : enemyLineup;
        } else {
          // 最終決戰波：全員到齊 (含 Boss)
          currentWaveLineup = enemyLineup;
        }
      }

      const enemyCount = (currentWaveLineup && currentWaveLineup.length > 0) ? currentWaveLineup.length : Random.int(1, 3);
      
      for (let i = 0; i < enemyCount; i++) {
        let lineupMonster: any = undefined;
        if (currentWaveLineup && currentWaveLineup.length > 0) {
           lineupMonster = currentWaveLineup[Math.min(i, currentWaveLineup.length - 1)];
        }
        
        // 戰鬥前二次安檢：若敵人為已被收服之具名英雄，強制觸發副將接替引擎
        if (lineupMonster) {
          const isUnavailable = (
            (lineupMonster.characterKey && unavailableSet.has(lineupMonster.characterKey)) ||
            (lineupMonster.id && unavailableSet.has(lineupMonster.id))
          );
          if (isUnavailable) {
            lineupMonster = FactionArmyGenerator.resolveTroopMember(
              lineupMonster.id,
              'f_neutral',
              unavailableSet,
              currentWaveDiff
            );
          }
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
        let eGridR = 0;
        let eGridC = 0;
        let isFront = true;

        if (lineupMonster && lineupMonster.gridR !== undefined && lineupMonster.gridC !== undefined) {
          eGridR = lineupMonster.gridR;
          eGridC = lineupMonster.gridC;
          isFront = eGridR === 0;
        } else if (lineupMonster && lineupMonster.formationRow) {
          isFront = lineupMonster.formationRow === FormationRow.FRONT;
          eGridR = isFront ? 0 : (lineupMonster.formationRow === FormationRow.MIDDLE ? 1 : 2);
          let attempts = 0;
          do {
            eGridC = Random.int(0, 2);
            attempts++;
          } while (occupiedEnemyGrids.has(`${eGridR}_${eGridC}`) && attempts < 10);
        } else {
          let attempts = 0;
          do {
            isFront = Random.next() > 0.5;
            eGridR = isFront ? 0 : 2;
            eGridC = Random.int(0, 2);
            attempts++;
          } while (occupiedEnemyGrids.has(`${eGridR}_${eGridC}`) && attempts < 10);
        }
        occupiedEnemyGrids.add(`${eGridR}_${eGridC}`);
        
        const avatarIcon = lineupMonster?.avatarIcon || (lineupMonster?.id ? `icons_monsters:${lineupMonster.id}` : 'icons_monsters:goblin');
        const calculatedRow = lineupMonster?.formationRow || (eGridR === 0 ? FormationRow.FRONT : (eGridR === 1 ? FormationRow.MIDDLE : FormationRow.BACK));

        enemyTeam.push({
          id: `enemy_${wave}_${i}`,
          name: lineupMonster ? lineupMonster.name : `野外魔物 ${String.fromCharCode(65 + i)}`,
          isPlayer: false,
          row: calculatedRow,
          gridR: eGridR,
          gridC: eGridC,
          maxHp: eHp,
          currentHp: eHp,
          maxMp: 50 + currentWaveDiff * 5,
          currentMp: 50 + currentWaveDiff * 5,
          atkElement: lineupMonster?.element || ElementType.NONE,
          defElement: lineupMonster?.element || ElementType.NONE,
          element: lineupMonster?.element || ElementType.NONE,
          attackType: lineupMonster?.attackType || (lineupMonster?.isMagicalAttacker ? 'MAGIC' : (lineupMonster?.id === 'crossbowman' ? 'RANGED' : 'MELEE')),
          isMagicalAttacker: lineupMonster?.isMagicalAttacker || false,
          avatarIcon: avatarIcon,
          stats: { hp: eHp, mp: 50 + currentWaveDiff * 5, patk: eAtk, matk: eAtk, pdef: ePdef, mdef: eMdef, hit: 20 + currentWaveDiff, evade: eEvade, speed: 10 + currentWaveDiff, critRate: 5, critDmg: 150, atk: eAtk, def: eDef },
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
          skills: lineupMonster?.skills ? [...lineupMonster.skills] : [],
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
          maxMp: e.maxMp || 50,
          currentMp: e.currentMp || 50,
          avatarIcon: e.avatarIcon
        })),
        text: `--- 第 ${wave} 波戰鬥開始！遭遇了 ${enemyCount} 名敵人。 ---` 
      });

      // 戰鬥主迴圈 (單波次)
      let turn = 1;
      const MAX_TURNS = 20;

      const processDeaths = (killer?: CombatParticipant) => {
        const allParticipants = [...playerTeam, ...enemyTeam];
        for (const p of allParticipants) {
          if (p.currentHp <= 0 && !(p as any).isDead) {
            (p as any).isDead = true;
            p.currentHp = 0;
            events.push({ type: CombatEventType.DEATH, targetName: p.name, text: `${p.name} 倒下了！` });

            if (killer && killer.currentHp > 0) {
              const killerEnemies = killer.isPlayer ? enemyTeam : playerTeam;
              const killerAllies = killer.isPlayer ? playerTeam : enemyTeam;
              events.push(...SkillEffectEngine.triggerHooks('ON_KILL', killer, [p], killerEnemies, killerAllies));
            }

            if (!p.isPlayer) {
              totalEarnedGold += p.goldReward || 0;
              totalEarnedExp += p.expReward || 0;
              if (p.equipmentDropRate && Random.next() < p.equipmentDropRate) {
                const equip = EquipmentGenerator.dropRandomEquipment(Math.max(5, Math.floor(currentWaveDiff / 2)));
                if (equip) {
                  GameState.myTerritory.addEquipmentToWarehouse(equip);
                  droppedEquipment.push(equip.name);
                }
              }
            }
          }
        }
      };

      // Bug6 修復：while 內部直接處理梯隊替換，確保殘血敵軍繼續被新梯隊接戰
      while (true) {
        // ── 勝負判定 ──
        // 1. 敵軍全滅 → 此波次清除
        if (enemyTeam.every(e => e.currentHp <= 0)) break;

        // 2. 我方全滅 → 嘗試派出備用梯隊（繼續對戰同一批殘血敵軍！）
        if (playerTeam.every(p => p.currentHp <= 0)) {
          if (reserveSquadsQueue.length > 0) {
            const nextSquad = reserveSquadsQueue.shift()!;
            currentSquadIndex++;
            const squadTitle = currentSquadIndex === 1 ? '第 2 梯隊 (主力部隊)' : '第 3 梯隊 (城門衛隊)';

            // Bug5 修復：正確推導梯隊成員技能與元素
            playerTeam.length = 0;
            nextSquad.defenderIds.forEach(id => {
              const adv = GameState.adventurers.find(a => a.id === id);
              if (adv) {
                const stats = adv.getCombatStats();
                const sWeapon = adv.equipment?.[EquipmentSlot.WEAPON];
                const sArmor = adv.equipment?.[EquipmentSlot.ARMOR];
                const sWeaponType = sWeapon?.weaponType;

                // 推導技能清單（優先使用 customSkills SSOT）
                const sSkills: string[] = [];
                if (adv.customSkills && Array.isArray(adv.customSkills) && adv.customSkills.length > 0) {
                  sSkills.push(...adv.customSkills);
                } else {
                  const sJobName = adv.job?.name || '';
                  const sIsAdv = adv.isAdvanced && adv.level >= 10;
                  const sLvl = adv.level || 1;
                  const sIsWarrior = ['戰士','狂戰士','魔劍士','狂戰','魔劍'].some(j => sJobName.includes(j));
                  const sIsMage   = ['法師','大魔導士','死靈法師','魔導','死靈'].some(j => sJobName.includes(j));
                  const sIsArcher = ['弓箭手','神射手','精靈使','弓手','神射','精靈'].some(j => sJobName.includes(j));
                  const sIsThief  = ['盜賊','暗殺者','詭術師','刺客','暗殺','詭術'].some(j => sJobName.includes(j));
                  const sIsKnight = ['騎士','聖騎士','符文騎士','聖騎','符文'].some(j => sJobName.includes(j));
                  const sIsPrayer = ['祈禱者','大主教','異端拷問官','神官','主教','拷問官'].some(j => sJobName.includes(j));
                  if (sIsWarrior) { if (sLvl>=2) sSkills.push('FIGHTER_HEAVY_STRIKE'); if (sLvl>=5) sSkills.push('FIGHTER_ARMOR_BREAK'); if (sIsAdv && sWeaponType==='GREATSWORD') sSkills.push('GREATSWORD_WHIRLWIND'); if (sIsAdv && sWeaponType==='DUAL_SWORDS') sSkills.push('MAGIC_SWORDSMAN_PHANTOM'); }
                  if (sIsMage) { if (sLvl>=2) { const se=sWeapon?.element; if (sWeaponType==='STAFF'&&se&&se!==ElementType.NONE){switch(se){case ElementType.FIRE:sSkills.push('MAGE_FIRE_BOLT');break;case ElementType.ICE:sSkills.push('MAGE_ICE_SPIKE');break;case ElementType.LIGHTNING:sSkills.push('MAGE_LIGHTNING_BOLT');break;case ElementType.HOLY:sSkills.push('MAGE_HOLY_SMITE');break;case ElementType.DARK:sSkills.push('MAGE_DARK_ORB');break;default:sSkills.push('MAGE_ARCANE_MISSILES');}}else{sSkills.push('MAGE_ARCANE_MISSILES');}} if (sLvl>=5) sSkills.push('MAGE_STATIC_FIELD'); if (sIsAdv&&sWeaponType==='STAFF') sSkills.push('STAFF_METEOR'); if (sIsAdv&&sWeaponType==='SCYTHE') sSkills.push('SCYTHE_SOUL_REAP'); }
                  if (sIsArcher) { if (sLvl>=2) sSkills.push('ARCHER_PIERCING_SHOT'); if (sLvl>=5) sSkills.push('ARCHER_AIMED_SHOT'); if (sIsAdv&&sWeaponType==='BOW') sSkills.push('SNIPER_FATAL_SNIPE'); if (sIsAdv&&sWeaponType==='MAGIC_BOW') sSkills.push('SPIRIT_ARCHER_SPIRIT_CHAIN'); }
                  if (sIsThief)  { if (sLvl>=2) sSkills.push('THIEF_SURPRISE_ATTACK'); if (sLvl>=5) sSkills.push('THIEF_POISON_BLADE'); if (sIsAdv&&sWeaponType==='DAGGERS') sSkills.push('ASSASSIN_SHADOW_ASSASSINATION'); if (sIsAdv&&sWeaponType==='MAGIC_RING') sSkills.push('TRICKSTER_TRICK_MAGIC'); }
                  if (sIsKnight) { if (sLvl>=2) sSkills.push('KNIGHT_SHIELD_BASH'); if (sLvl>=5) sSkills.push('KNIGHT_TAUNT'); if (sIsAdv&&sWeaponType==='SWORD_AND_SHIELD') sSkills.push('KNIGHT_PALADIN_AEGIS'); if (sIsAdv&&sWeaponType==='RUNE_SHIELD') sSkills.push('KNIGHT_RUNE_REFLECTION'); }
                  if (sIsPrayer) { if (sLvl>=2) sSkills.push('PRAYER_HEAL'); if (sLvl>=5) sSkills.push('PRAYER_HOLY_LIGHT'); if (sIsAdv&&sWeaponType==='HOLY_BOOK') sSkills.push('PRAYER_ARCHBISHOP_MASS_HEAL'); if (sIsAdv&&sWeaponType==='HAMMER') sSkills.push('PRAYER_INQUISITOR_JUDGMENT'); }
                }
                // 裝備附加技能
                Object.values(adv.equipment||{}).filter(Boolean).forEach((eq:any) => { if(eq.grantedSkill&&!sSkills.includes(eq.grantedSkill))sSkills.push(eq.grantedSkill); (eq.extraSkills||[]).forEach((sk:string)=>{if(sk&&!sSkills.includes(sk))sSkills.push(sk);}); });

                let sGridR = 0, sGridC = 0;
                let sGridRow: string = FormationRow.FRONT;
                let hasGrid = false;
                if (nextSquad.gridMap) {
                  for (const [k, v] of Object.entries(nextSquad.gridMap)) {
                    if (v === id) {
                      sGridR = parseInt(k.split('_')[0], 10);
                      sGridC = parseInt(k.split('_')[1], 10);
                      sGridRow = sGridR === 0 ? FormationRow.FRONT : (sGridR === 1 ? 'MIDDLE' : FormationRow.BACK);
                      hasGrid = true;
                      break;
                    }
                  }
                }

                playerTeam.push({
                  id: adv.id,
                  name: adv.name,
                  isPlayer: true,
                  row: sGridRow,
                  gridR: hasGrid ? sGridR : undefined,
                  gridC: hasGrid ? sGridC : undefined,
                  maxHp: stats.hp,
                  currentHp: stats.hp,
                  maxMp: stats.mp,
                  currentMp: stats.mp,
                  stats: stats,
                  attributes: adv.getEffectiveAttributes ? adv.getEffectiveAttributes() : (adv as any).attributes,
                  statusEffects: [],
                  baseClass: adv.job?.name || '戰士',
                  weaponType: sWeaponType,
                  atkElement: sWeapon?.element || ElementType.NONE, // Bug5 修復：元素補全
                  defElement: sArmor?.element || ElementType.NONE,
                  element: sArmor?.element || sWeapon?.element || ElementType.NONE,
                  skills: sSkills,  // Bug5 修復：完整技能清單
                  isAdvanced: adv.isAdvanced && adv.level >= 10
                });
              }
            });

            if (playerTeam.length > 0) {
              playerTeam.forEach(p => {
                if (!allTrackedPlayers.some(x => x.id === p.id)) {
                  allTrackedPlayers.push(p);
                }
              });

              // 傳遞新梯隊成員狀態給 UI（供重繪玩家卡片）
              const newSquadStates = playerTeam.map(p => {
                const a = GameState.adventurers.find(x => x.id === p.id);
                return { id: p.id, name: p.name, isPlayer: true, row: p.row, gridR: p.gridR, gridC: p.gridC, maxHp: p.maxHp, maxMp: p.maxMp ?? 100, currentMp: p.currentMp ?? (p.maxMp ?? 100), avatarIndex: a?.avatarIndex ?? 0, gender: a?.gender as string, isGuardian: a?.isGuardian ?? false };
              });
              events.push({
                type: CombatEventType.SQUAD_CHANGE,
                squadIndex: currentSquadIndex,
                squadName: squadTitle,
                newSquadStates,
                text: `🚩 【${squadTitle} 增援登場！】全軍誓死守衛領地！`
              });
              turn = 1; // 重置回合計數，給新梯隊完整回合數
              continue;  // 繼續 while → 殘血敵軍繼續被新梯隊接戰！
            }
          }
          break; // 所有梯隊皆全滅，戰敗
        }

        // 3. 超過最大回合 → 超時
        if (turn > MAX_TURNS) break;

        events.push({
          type: CombatEventType.TURN_START,
          turn: turn,
          text: `── ⚔️ 第 ${turn} 回合開始 ──`
        });

        const allParticipants = [...playerTeam, ...enemyTeam].filter(p => p.currentHp > 0);

        // 依敏捷排序
      allParticipants.sort((a, b) => (b.stats.speed + Random.next() * 20) - (a.stats.speed + Random.next() * 20));

      // 👑 步兵【鋼鐵盾牆】（第 1 回合與每 3 回合展開）
      if (infCount > 0 && turn % 3 === 1 && playerTeam.some(p => p.currentHp > 0)) {
        const { shieldHp, blockChanceBonus } = LordCommanderSystem.calculateShieldWall(infCount);
        // 為所有存活玩家前排成員施加格擋增益
        playerTeam.filter(p => p.currentHp > 0 && (p.row === FormationRow.FRONT || p.gridR === 0)).forEach(frontP => {
          frontP.statusEffects.push({ type: StatusEffectType.BUFF_DEF, duration: 1, value: blockChanceBonus });
        });
        const label = isLordCampaign ? '【👑 領主軍令·鋼鐵盾牆】' : '【🛡️ 隨行軍團·步兵護盾】';
        const subject = isLordCampaign ? `步兵軍團（${infCount}人）` : `隨行步兵（${infCount}人）`;
        events.push({
          type: CombatEventType.COMMANDER_SHIELD_WALL,
          shieldRemaining: shieldHp,
          text: `🛡️ ${label}${subject}立起重盾方陣！前排獲得 +${blockChanceBonus}% 格擋增益！`
        });
      }

      // 👑 騎兵【破陣衝鋒】（每 3 回合側翼/破陣衝鋒）
      if (activeCavCount > 0 && turn % 3 === 1 && enemyTeam.some(e => e.currentHp > 0)) {
        const aliveEnemies = enemyTeam.filter(e => e.currentHp > 0);
        if (aliveEnemies.length > 0) {
          const cTarget = Random.pick(aliveEnemies);
          const { damage: cavalryDmg, stunChance } = LordCommanderSystem.calculateCavalryCharge(activeCavCount);
          cTarget.currentHp = Math.max(0, cTarget.currentHp - cavalryDmg);

          // 判定是否為 BOSS / 首領級魔物 (BOSS 免疫暈眩，轉為攻擊力降低 20% 與減速)
          const isBoss = (cTarget.id && (cTarget.id.includes('boss') || cTarget.id.includes('dragon'))) ||
                         (cTarget.name && (cTarget.name.includes('太古') || cTarget.name.includes('龍') || cTarget.name.includes('首領') || cTarget.name.includes('領主'))) ||
                         cTarget.maxHp >= 3000;

          let stunText = '';
          if (Math.random() < stunChance) {
            if (isBoss) {
              cTarget.statusEffects.push({ type: StatusEffectType.BUFF_PATK, duration: 2, value: -20 });
              stunText = '（太古首領受到重裝衝擊，攻擊力下降 20%！）';
            } else {
              cTarget.statusEffects.push({ type: StatusEffectType.STUN, duration: 1 });
              stunText = '敵人被重裝撞飛，暈眩 1 回合！';
            }
          }

          const label = isLordCampaign ? '【👑 領主軍令·破陣衝鋒】' : '【🐎 隨行軍團·側翼衝擊】';
          const subject = isLordCampaign ? `騎兵軍團（${activeCavCount}騎）` : `隨行騎兵（${activeCavCount}騎）`;
          events.push({
            type: CombatEventType.CAVALRY_CHARGE,
            targetId: cTarget.id,
            targetName: cTarget.name,
            damage: cavalryDmg,
            targetHp: cTarget.currentHp,
            targetMaxHp: cTarget.maxHp,
            text: `🐎 ${label}${subject}疾馳破陣！對 ${cTarget.name} 造成 ${cavalryDmg} 點重創！${stunText}`
          });
          processDeaths();
        }
      }

      // 👑 弓兵【漫天箭雨】（每 2 回合齊射一次）
      if (arcCount > 0 && turn % 2 === 1 && enemyTeam.some(e => e.currentHp > 0)) {
        const aliveEnemies = enemyTeam.filter(e => e.currentHp > 0);
        if (aliveEnemies.length > 0) {
          const vTarget = Random.pick(aliveEnemies);
          const targetDef = vTarget.stats?.pdef ?? vTarget.stats?.def ?? 0;
          const effectiveVolleyDmg = archerVolleyDmg > 0
            ? Math.max(1, Math.floor(archerVolleyDmg * (100 / (100 + targetDef))))
            : LordCommanderSystem.calculateVolleyFire(arcCount, targetDef);
          vTarget.currentHp = Math.max(0, vTarget.currentHp - effectiveVolleyDmg);
          // 箭雨附加破甲
          vTarget.statusEffects.push({ type: StatusEffectType.ARMOR_BREAK, duration: 2, value: 20 });
          const label = isLordCampaign ? '【👑 領主軍令·漫天箭雨】' : '【🏹 隨行軍團·箭雨支援】';
          const subject = isLordCampaign ? `弓兵軍團（${arcCount}人）` : `隨行弓兵（${arcCount}人）`;
          events.push({
            type: CombatEventType.ARCHER_VOLLEY,
            targetId: vTarget.id,
            targetName: vTarget.name,
            damage: effectiveVolleyDmg,
            targetHp: vTarget.currentHp,
            targetMaxHp: vTarget.maxHp,
            text: `🏹 ${label}${subject}萬箭齊發！對 ${vTarget.name} 造成 ${effectiveVolleyDmg} 點穿刺傷害並附加破甲！${targetDef > 0 ? '(防禦減免後)' : ''}`
          });
          processDeaths();
        }
      }

      // 守城戰專屬：哨所箭塔每回合向隨機敵軍發動支援砲擊
      if (watchtowerDmg > 0 && enemyTeam.some(e => e.currentHp > 0)) {
        const aliveEnemies = enemyTeam.filter(e => e.currentHp > 0);
        if (aliveEnemies.length > 0) {
          const tTarget = Random.pick(aliveEnemies);
          tTarget.currentHp = Math.max(0, tTarget.currentHp - watchtowerDmg);
          events.push({
            type: CombatEventType.WATCHTOWER_ATTACK,
            actorName: '領地哨所箭塔',
            targetId: tTarget.id,
            targetName: tTarget.name,
            damage: watchtowerDmg,
            targetHp: tTarget.currentHp,
            targetMaxHp: tTarget.maxHp,
            text: `🏹 領地箭塔發射弩砲，對 ${tTarget.name} 造成 ${watchtowerDmg} 點穿甲打擊！`
          });
          processDeaths(tTarget);
        }
      }

      // 敵方隨行軍團行動 (Enemy Legion)
      if (enemyLegion && enemyLegion.enabled) {
        // 敵方騎兵每 3 回合衝鋒我方
        const eCav = enemyLegion.cavalry || 0;
        if (eCav > 0 && turn % 3 === 1 && playerTeam.some(p => p.currentHp > 0)) {
          const alivePlayers = playerTeam.filter(p => p.currentHp > 0);
          if (alivePlayers.length > 0) {
            const pTarget = Random.pick(alivePlayers);
            const eCavDmg = Math.max(10, Math.floor(Math.sqrt(eCav) * 28));
            pTarget.currentHp = Math.max(0, pTarget.currentHp - eCavDmg);
            events.push({
              type: CombatEventType.CAVALRY_CHARGE,
              actorName: '敵方鐵騎部隊',
              targetId: pTarget.id,
              targetName: pTarget.name,
              damage: eCavDmg,
              targetHp: pTarget.currentHp,
              targetMaxHp: pTarget.maxHp,
              text: `🐎 敵方鐵騎部隊發動衝鋒！重創了 ${pTarget.name}（造成 ${eCavDmg} 點傷害）！`
            });
            processDeaths();
          }
        }

        // 敵方弓兵每 2 回合箭雨齊射
        const eArc = enemyLegion.archer || 0;
        if (eArc > 0 && turn % 2 === 1 && playerTeam.some(p => p.currentHp > 0)) {
          const alivePlayers = playerTeam.filter(p => p.currentHp > 0);
          if (alivePlayers.length > 0) {
            const pTarget = Random.pick(alivePlayers);
            const eArcDmg = Math.max(10, Math.floor(Math.sqrt(eArc) * 35));
            pTarget.currentHp = Math.max(0, pTarget.currentHp - eArcDmg);
            events.push({
              type: CombatEventType.ARCHER_VOLLEY,
              actorName: '敵方弓兵部隊',
              targetId: pTarget.id,
              targetName: pTarget.name,
              damage: eArcDmg,
              targetHp: pTarget.currentHp,
              targetMaxHp: pTarget.maxHp,
              text: `🏹 敵方弓兵部隊展開漫天箭雨！對 ${pTarget.name} 造成 ${eArcDmg} 點穿刺傷害！`
            });
            processDeaths();
          }
        }
      }

      for (const actor of allParticipants) {
        if (actor.currentHp <= 0 || (actor as any).isDead) continue;

        CombatSystem.processStatusEffects(actor, events, actor.isPlayer ? playerTeam : enemyTeam);
        processDeaths();
        if (actor.currentHp <= 0 || (actor as any).isDead) continue;

        // 減少冷卻時間
        if (actor.cooldowns) {
          for (const skillId in actor.cooldowns) {
            if (actor.cooldowns[skillId] > 0) actor.cooldowns[skillId]--;
          }
        }

        // Per-turn HP and MP regeneration (僅存活單位可回血回魔)
        if (actor.currentHp > 0 && actor.attributes) {
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
          if (actor.currentMp !== undefined) {
             actor.currentMp = Math.min(actor.maxMp ?? 100, actor.currentMp + mpRegen);
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

        const allies = (actor.isPlayer ? playerTeam : enemyTeam).filter(a => a.currentHp > 0);

        // 觸發回合開始與 HP 門檻鉤子 (Phase 2)
        events.push(...SkillEffectEngine.triggerHooks('ON_TURN_START', actor, [actor], enemies, allies));
        events.push(...SkillEffectEngine.triggerHooks('ON_HP_THRESHOLD', actor, [actor], enemies, allies));
        processDeaths(actor);
        if (actor.currentHp <= 0) continue;

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
             selectedSkill = SkillRegistry.getSkill(gambitResult.skillId);
          }
          skillTargets = gambitResult.targets;
        } else {
          // 選擇技能 (Smart Casting AI - 只有在沒觸發 Gambit 時執行)
          if (actor.skills && actor.skills.length > 0) {
          const availableSkills = actor.skills
            .map(id => SkillRegistry.getSkill(id))
            .filter((s): s is import('../models/Skill').Skill => !!s && actor.currentMp !== undefined && actor.currentMp >= s.mpCost && !(actor.cooldowns && actor.cooldowns[s.id] > 0));
          
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
          // 守城戰技能判定：
          // 若為近戰物理單體技能且城門未破且目標選中中後排，若有前排則打前排，若無前排則衝擊城牆耐久度
          const isRangedOrAoeOrMagic = selectedSkill.targetType === TargetType.ALL_ENEMIES ||
            selectedSkill.targetType === TargetType.COLUMN ||
            selectedSkill.targetType === TargetType.BACK_ENEMY ||
            actor.isMagicalAttacker ||
            selectedSkill.id.includes('FIRE') || selectedSkill.id.includes('ICE') || selectedSkill.id.includes('LIGHTNING') ||
            selectedSkill.id.includes('SNIPE') || selectedSkill.id.includes('PIERC') || selectedSkill.id.includes('METEOR') ||
            selectedSkill.id.includes('MAGE') || selectedSkill.id.includes('PRAYER');

          if (!actor.isPlayer && isDefenseSiege && !isRangedOrAoeOrMagic && gateRemainingHp !== undefined && gateRemainingHp > 0) {
            const frontDefenders = playerTeam.filter(p => p.currentHp > 0 && (p.row === FormationRow.FRONT || p.gridR === 0));
            // 若前排已空，或隨機抽中打城牆，則近戰技能衝擊城牆
            if (frontDefenders.length === 0 || Math.random() < 0.5) {
              const skillGateDmg = Math.max(1, Math.floor(actor.stats.atk * 0.8));
              const actualGateDmg = Math.min(gateRemainingHp, skillGateDmg);
              gateRemainingHp -= actualGateDmg;
              events.push({
                type: gateRemainingHp <= 0 ? CombatEventType.SIEGE_GATE_BREAK : CombatEventType.SIEGE_GATE_DAMAGE,
                actorId: actor.id,
                actorName: actor.name,
                damage: actualGateDmg,
                gateRemainingHp: gateRemainingHp,
                text: `💥 ${actor.name} 施展【${selectedSkill.name}】猛烈轟擊城牆，造成 ${actualGateDmg} 點攻城傷害！${gateRemainingHp <= 0 ? '💥 城牆徹底被攻破！' : `(城牆剩餘耐久度 ${gateRemainingHp})`}`
              });
              processDeaths();
              continue;
            } else {
              // 轉為攻擊前排守軍
              skillTargets = [Random.pick(frontDefenders)];
            }
          }

          // 施放技能
          actor.currentMp = (actor.currentMp || 0) - selectedSkill.mpCost;
          
          // 進入 CD
          if (selectedSkill.cooldown) {
            if (!actor.cooldowns) actor.cooldowns = {};
            actor.cooldowns[selectedSkill.id] = selectedSkill.cooldown;
          }
          
          const actorMaxMp = actor.attributes?.spr ? actor.attributes.spr * 5 : 100;
          events.push({
            type: CombatEventType.SKILL_CAST,
            actorId: actor.id, actorName: actor.name,
            targetId: actor.id,            // 保留為施術者自身，用於 MP 條更新
            skillTargetId: skillTargets[0]?.id, // 特效飛行目標：技能第一個受術目標
            skillId: selectedSkill.id,
            skillName: selectedSkill.name,
            vfxId: selectedSkill.vfxId || getSkillVfxId(selectedSkill.id),
            targetMp: actor.currentMp || 0,
            targetMaxMp: actor.maxMp || 100,
            text: `${actor.name} 消耗了 ${selectedSkill.mpCost} MP 施放【${selectedSkill.name}】！`
          });
          
          const skillEvents = selectedSkill.execute(actor, skillTargets, enemies, allies);
          const finalSkillEvents: CombatEvent[] = [];

          // 守城戰掩體減傷 + 全技能軍團護盾攔截 (Army Shield Interceptor)
          skillEvents.forEach(se => {
            if (se.damage && se.damage > 0 && se.targetId) {
              const targetTeam = actor.isPlayer ? enemyTeam : playerTeam;
              const target = targetTeam.find(p => p.id === se.targetId);

              if (target) {
                // 1. 守城戰城垛掩體減傷 25%
                if (!actor.isPlayer && isDefenseSiege) {
                  const originalDmg = se.damage;
                  const reducedDmg = Math.max(1, Math.floor(originalDmg * 0.75));
                  const damageDiff = originalDmg - reducedDmg;
                  target.currentHp = Math.min(target.maxHp, target.currentHp + damageDiff);
                  se.damage = reducedDmg;
                  se.targetHp = target.currentHp;
                }

                // 2. 軍團步兵護盾攔截 (Shield Interceptor)
                if (target.shieldCurrentHp !== undefined && target.shieldCurrentHp > 0) {
                  const incomingDmg = se.damage;
                  const shieldAbsorb = Math.min(target.shieldCurrentHp, incomingDmg);
                  target.shieldCurrentHp -= shieldAbsorb;
                  const hpDmg = incomingDmg - shieldAbsorb;

                  // 回補被技能直接扣掉的 HP（轉由護盾承受）
                  target.currentHp = Math.min(target.maxHp, target.currentHp + shieldAbsorb);
                  se.damage = hpDmg;
                  se.targetHp = target.currentHp;
                  se.shieldDamage = shieldAbsorb;
                  se.shieldRemaining = target.shieldCurrentHp;

                  finalSkillEvents.push({
                    type: target.shieldCurrentHp === 0 ? CombatEventType.SHIELD_BREAK : CombatEventType.SHIELD_DAMAGE,
                    actorId: actor.id,
                    actorName: actor.name,
                    targetId: target.id,
                    targetName: target.name,
                    shieldDamage: shieldAbsorb,
                    shieldRemaining: target.shieldCurrentHp,
                    text: `🛡️ ${target.name} 的部隊護盾吸收了 ${shieldAbsorb} 點技能傷害！${target.shieldCurrentHp === 0 ? ' (部隊護盾破碎！)' : `(剩餘護盾 ${target.shieldCurrentHp})`}`
                  });
                }
              }
            }
            if (!se.skillId) se.skillId = selectedSkill.id;
            if (!se.skillName) se.skillName = selectedSkill.name;
            if (!se.vfxId) se.vfxId = selectedSkill.vfxId || getSkillVfxId(selectedSkill.id);
            finalSkillEvents.push(se);
          });

          events.push(...finalSkillEvents);
          
          const totalSkillDmg = skillEvents.reduce((sum, e) => sum + (e.damage || 0), 0);
          PassiveManager.onDamageDealt(actor, totalSkillDmg, events, 'SKILL');
          
          processDeaths(actor);
          continue; // 技能施放完畢，跳過普攻階段
        }

        const targetTeam = actor.isPlayer ? enemyTeam : playerTeam;
        let targetEvade = getEvade(target);
        if (target.isAdvanced && target.weaponType === 'MAGIC_RING' && !PassiveManager.isTricksterInvulnerable(target, targetTeam)) {
          // 場上沒有隊友時自身獲得閃避 +15
          targetEvade += 15;
        }

        let baseHitChance = Math.max(0.1, Math.min(0.95, 0.7 + (actor.stats.hit - targetEvade) / 100));
        let hitChance = PassiveManager.getModifiedHitChance(actor, target, baseHitChance, targetTeam);
        if (Random.next() > hitChance) {
          events.push({
            type: CombatEventType.MISS,
            actorName: actor.name,
            targetName: target.name,
            text: `${actor.name} 的攻擊被 ${target.name} 閃避了！`
          });
          continue;
        }

        // 詭術師被動：有隊友在場時無敵，免疫傷害
        if (PassiveManager.isTricksterInvulnerable(target, targetTeam)) {
          events.push({
            type: CombatEventType.MISS,
            actorName: actor.name,
            targetName: target.name,
            text: `${target.name} 處於【無敵】狀態，免疫了攻擊！`
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

        // 守城戰專屬近戰目標判定：
        // 1. 前排存活時：近戰普攻可打前排守軍，也可打城牆
        // 2. 前排全滅但城牆耐久 > 0 時：近戰普攻 100% 擊打城牆
        // 3. 前排全滅且城牆耐久歸 0 時：敵軍湧入城內，近戰可直接攻擊中後排守軍
        const isMeleeActor = actor.attackType === 'MELEE' || (!actor.attackType && !actor.isMagicalAttacker && actor.weaponType !== 'BOW' && actor.weaponType !== 'MAGIC_BOW' && actor.weaponType !== 'STAFF' && actor.weaponType !== 'HOLY_BOOK');
        if (!actor.isPlayer && isDefenseSiege && isMeleeActor && gateRemainingHp !== undefined && gateRemainingHp > 0) {
          const frontDefenders = playerTeam.filter(p => p.currentHp > 0 && (p.row === FormationRow.FRONT || p.gridR === 0));
          const targetIsFront = target.row === FormationRow.FRONT || target.gridR === 0;

          // 若前排已空，或隨機抽中打城牆，或目標非前排（受城牆阻擋），則傷害結算給城牆
          if (frontDefenders.length === 0 || !targetIsFront || Math.random() < 0.45) {
            const gateDmg = Math.min(gateRemainingHp, effectiveDamage);
            gateRemainingHp -= gateDmg;
            events.push({
              type: gateRemainingHp <= 0 ? CombatEventType.SIEGE_GATE_BREAK : CombatEventType.SIEGE_GATE_DAMAGE,
              actorId: actor.id,
              actorName: actor.name,
              damage: gateDmg,
              gateRemainingHp: gateRemainingHp,
              text: `⚔️ ${actor.name} 猛攻要塞城門，造成 ${gateDmg} 點攻城傷害！${gateRemainingHp <= 0 ? '💥 城門徹底被攻破！敵軍湧入城內！' : `(城牆剩餘耐久度 ${gateRemainingHp})`}`
            });
            processDeaths(actor);
            continue; // 城牆吸收了本次近戰打擊
          }
          // 否則：近戰打擊由前排守軍 (target) 承受！
        }

        // 守城戰城垛掩體減傷
        if (target.isPlayer && isDefenseSiege) {
          hpDamage = Math.floor(hpDamage * 0.75);
        }

        if (target.shieldCurrentHp && target.shieldCurrentHp > 0) {
          sDamage = Math.min(target.shieldCurrentHp, hpDamage);
          target.shieldCurrentHp -= sDamage;
          hpDamage = hpDamage - sDamage;
          
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
          const normalAttackType = actor.attackType || (actor.isMagicalAttacker ? 'MAGIC' : (actor.weaponType === 'BOW' || actor.weaponType === 'MAGIC_BOW' ? 'RANGED' : 'MELEE'));
          const normalVfxId = getSkillVfxId(undefined, normalAttackType);

          events.push({
            type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
            actorId: actor.id, actorName: actor.name,
            targetId: target.id, targetName: target.name,
            damage: hpDamage,
            targetHp: target.currentHp,
            targetMaxHp: target.maxHp,
            vfxId: normalVfxId,
            text: `${actor.name} 攻擊了 ${target.name}，${isCrit ? '致命一擊！' : ''}對本體造成 ${hpDamage} 點傷害。`
          });
          
          PassiveManager.onDamageDealt(actor, hpDamage, events, 'BASIC_ATTACK');

          // Phase 2 爆擊與受傷鉤子
          if (isCrit) {
            events.push(...SkillEffectEngine.triggerHooks('ON_CRIT', actor, [target], enemies, allies));
          }
          events.push(...SkillEffectEngine.triggerHooks('ON_HIT_TAKEN', target, [actor], allies, targetTeam));
          events.push(...SkillEffectEngine.triggerHooks('ON_HP_THRESHOLD', target, [target], allies, targetTeam));
        }
        // -- End Shield Interceptor --

        if (target.currentHp > 0) {
           if (actor.isPlayer && Random.next() < 0.15) {
             events.push(tryApplyStatus(target, { type: StatusEffectType.BLEED, duration: 3 }, actor.name, undefined, `${target.name} 陷入流血狀態！`, targetTeam));
           } else if (!actor.isPlayer && Random.next() < 0.1) {
             events.push(tryApplyStatus(target, { type: StatusEffectType.POISON, duration: 2, value: 5 }, actor.name, undefined, `${target.name} 陷入中毒狀態！`, targetTeam));
           }
        }

        processDeaths(actor);
      }
      events.push({
        type: CombatEventType.TURN_END,
        turn: turn,
        text: `── 第 ${turn} 回合結束 ──`
      });
      turn++;
    } // 單波次 while 結束

      // post-while：波次結算
      if (playerTeam.every(p => p.currentHp <= 0)) {
        break; // 所有梯隊皆全滅，戰敗結束
      }
      if (!enemyTeam.every(enemy => enemy.currentHp <= 0)) {
        allWavesCleared = false;
        break; // 未能清除此波次（超時或其他原因）
      }
    } // 總波次 for 迴圈結束

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
    
    allTrackedPlayers.forEach(p => {
      playerHpMap[p.id] = p.currentHp;
      playerMpMap[p.id] = p.currentMp || 0;
      if (p.shieldType && p.shieldMaxHp !== undefined && p.shieldCurrentHp !== undefined) {
        const lostHp = p.shieldMaxHp - p.shieldCurrentHp;
        const lostTroops = Math.ceil(lostHp / 50); // 修復：對應 ×50 公式
        if (lostTroops > 0) {
          shieldLoss[p.id] = { [p.shieldType]: lostTroops };
        }
      }
    });


    let totalDamageDealt = 0;
    const damageMap: Record<string, number> = {};
    events.forEach(e => {
      if ((e.type === CombatEventType.HIT || e.type === CombatEventType.CRIT) && e.actorId && e.damage) {
        if (allTrackedPlayers.find(p => p.id === e.actorId)) {
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
    const mvpName = allTrackedPlayers.find(p => p.id === mvpId)?.name || '無';

    // 統計所有波次的殘存狀態 (供野外攔截戰戰況 1:1 繼承至守城戰)
    const survivingWaves: import('../models/Narrative').SurvivingMonsterState[][] = [];
    if (waveEnemyLineups && waveEnemyLineups.length > 0) {
      waveEnemyLineups.forEach((wLineup, wIdx) => {
        const waveStates: import('../models/Narrative').SurvivingMonsterState[] = [];
        const thisWaveEnemyTeam = allWavesEnemyTeams[wIdx + 1] || [];
        wLineup.forEach((m, mIdx) => {
          const matchInst = thisWaveEnemyTeam.find(e => e.id === `enemy_${wIdx + 1}_${mIdx}` || e.name === m.name);
          const isDead = matchInst ? matchInst.currentHp <= 0 : (wIdx < lastActiveWave - 1);
          const curHp = matchInst ? matchInst.currentHp : (isDead ? 0 : m.hp);
          waveStates.push({
            monsterId: m.id || 'bandit',
            currentHp: curHp,
            maxHp: m.hp || matchInst?.maxHp || 100,
            isDead: isDead,
            gridR: m.gridR,
            gridC: m.gridC,
            slotId: m.slotId,
            powerTier: (m as any).powerTier,
            skills: m.skills,
            element: m.element
          });
        });
        survivingWaves.push(waveStates);
      });
    }

    // 🏥 戰後傭兵即時血量 1:1 寫回與重傷瀕死判定 (全梯隊參戰成員 100% 寫回)
    allTrackedPlayers.forEach(p => {
      const adv = (GameState.adventurers || []).find(a => a.id === p.id);
      if (adv) {
        if (p.currentHp <= 0) {
          if (typeof adv.applyWound === 'function') {
            adv.applyWound();
          } else {
            (adv as any).isWounded = true;
            (adv as any).currentHp = 1;
            (adv as any).currentMp = 0;
          }
        } else {
          if (typeof adv.setCurrentHp === 'function') {
            adv.setCurrentHp(p.currentHp);
            adv.setCurrentMp(p.currentMp || 0);
          } else {
            (adv as any).currentHp = p.currentHp;
            (adv as any).currentMp = p.currentMp || 0;
          }
        }
      }
    });

    return {
      isVictory,
      participants: allTrackedPlayers.map(p => p.id),
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
      isLordCampaign,
      lordAura,
      commanderTroops: {
        infantry: infCount,
        archer: arcCount,
        cavalry: activeCavCount
      },
      isDefenseSiege,
      isFieldInterception,
      gateMaxHp: siegeOptions?.gateHp,
      gateRemainingHp: gateRemainingHp,
      survivingWaves: survivingWaves.length > 0 ? survivingWaves : undefined,
      survivingEnemyLegion: enemyLegion ? {
        infantry: enemyLegion.infantry || 0,
        archer: enemyLegion.archer || 0,
        cavalry: enemyLegion.cavalry || 0
      } : undefined,
      totalEarnedGold,
      totalEarnedExp,
      droppedEquipment
    };
  }

  private static processStatusEffects(actor: CombatParticipant, events: CombatEvent[], allies?: CombatParticipant[]) {
    const activeEffects = [];
    const isInvuln = allies ? PassiveManager.isTricksterInvulnerable(actor, allies) : false;

    for (const effect of actor.statusEffects) {
      if (effect.type === StatusEffectType.BLEED) {
        if (!isInvuln) {
          const dmg = Math.max(1, Math.floor(actor.maxHp * 0.05));
          actor.currentHp -= dmg;
          events.push({ type: CombatEventType.STATUS_DAMAGE, targetName: actor.name, damage: dmg, targetHp: actor.currentHp, text: `${actor.name} 因流血受到 ${dmg} 點傷害。`});
        }
      } else if (effect.type === StatusEffectType.POISON) {
        if (!isInvuln) {
          const stacks = effect.stacks || 1;
          const dmg = (effect.value || 5) * stacks;
          actor.currentHp -= dmg;
          events.push({ type: CombatEventType.STATUS_DAMAGE, targetName: actor.name, damage: dmg, targetHp: actor.currentHp, text: `${actor.name} 因中毒 (${stacks}層) 受到 ${dmg} 點傷害。`});
        }
      } else if (effect.type === StatusEffectType.BURN) {
        if (!isInvuln) {
          const dmg = (effect.value || 8);
          actor.currentHp -= dmg;
          events.push({ type: CombatEventType.STATUS_DAMAGE, targetName: actor.name, damage: dmg, targetHp: actor.currentHp, text: `${actor.name} 受到灼燒燃燒，承受 ${dmg} 點火焰傷害。`});
        }
      } else if (effect.type === StatusEffectType.REGEN_HP) {
        const heal = effect.value || 10;
        actor.currentHp = Math.min(actor.maxHp, actor.currentHp + heal);
        events.push({ type: CombatEventType.HEAL, targetName: actor.name, damage: heal, targetHp: actor.currentHp, text: `${actor.name} 受益於生命恢復，回復了 ${heal} 點 HP。`});
      } else if (effect.type === StatusEffectType.REGEN_MP) {
        const healMp = effect.value || 5;
        if (actor.currentMp !== undefined) {
          actor.currentMp = Math.min(actor.maxMp ?? 100, actor.currentMp + healMp);
        }
        events.push({ type: CombatEventType.HEAL, targetName: actor.name, text: `${actor.name} 受益於魔力恢復，回復了 ${healMp} 點 MP。`});
      }

      if (actor.currentHp <= 0) {
        actor.currentHp = 0;
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
