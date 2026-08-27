import { GameState } from '../../core/GameState';
import { Random } from '../../core/Random';
import { 
  CombatEvent, 
  CombatEventType, 
  CombatReport, 
  CombatParticipantState, 
  SiegeDefenseCombatOptions, 
  StatusEffectType
} from '../../models/Combat';
import { TerrainType, NobleTitle, FormationRow, MonsterInstance, ElementType, MonsterRace } from '../../models/types';
import { LordCommanderSystem } from './LordCommanderSystem';

export type CommanderOrderType = 'SHIELD_WALL' | 'VOLLEY_FIRE' | 'CAVALRY_CHARGE' | 'INSPIRE' | 'STANDBY';

export class InteractiveCombatSession {
  public battleName: string;
  public terrain: TerrainType;
  public currentWave: number = 1;
  public totalWaves: number = 1;
  public turn: number = 1;
  public maxTurns: number = 30;
  public isFinished: boolean = false;
  public isVictory: boolean = false;

  public playerTeam: any[] = [];
  public allTrackedPlayers: any[] = [];
  public enemyTeam: any[] = [];
  public allWavesEnemyLineups: MonsterInstance[][] = [];
  public allWavesEnemyTeams: Record<number, any[]> = {};
  public reserveSquads: { defenderIds: string[]; formationId?: string; gridMap?: Record<string, string> }[] = [];
  public currentSquadIndex: number = 0;

  public assignedTroops: { infantry: number; archer: number; cavalry: number };
  public tacticCds = { SHIELD_WALL: 0, VOLLEY_FIRE: 0, CAVALRY_CHARGE: 0, INSPIRE: 0 };
  public lordAura?: import('./LordCommanderSystem').LordAuraConfig;
  public siegeOptions?: SiegeDefenseCombatOptions;
  public gateMaxHp: number = 0;
  public gateRemainingHp: number = 0;

  // 累計統計
  public allEvents: CombatEvent[] = [];
  public initialStates: CombatParticipantState[] = [];
  public totalDamageDealt: number = 0;
  public damageMap: Record<string, number> = {};

  constructor(
    defenderIds: string[],
    wavesCount: number,
    battleName: string,
    terrain: TerrainType = TerrainType.WILDERNESS,
    waveEnemyLineups?: MonsterInstance[][],
    siegeOptions?: SiegeDefenseCombatOptions,
    formationId?: string,
    gridMap?: Record<string, string>
  ) {
    this.battleName = battleName;
    this.terrain = terrain;
    this.totalWaves = Math.max(1, wavesCount || 1);
    this.siegeOptions = siegeOptions;
    this.reserveSquads = siegeOptions?.reserveSquads ? [...siegeOptions.reserveSquads] : [];
    this.gateMaxHp = siegeOptions?.gateHp || 0;
    this.gateRemainingHp = siegeOptions?.gateHp || 0;

    const infCount = siegeOptions?.infantryCount || siegeOptions?.assignedTroops?.infantry || 0;
    const arcCount = siegeOptions?.assignedTroops?.archer || (siegeOptions?.archerVolleyDmg ? Math.round(Math.pow(siegeOptions.archerVolleyDmg / 35, 2)) : 0) || 0;
    const cavCount = siegeOptions?.cavalryCount || siegeOptions?.assignedTroops?.cavalry || 0;
    this.assignedTroops = { infantry: infCount, archer: arcCount, cavalry: cavCount };

    // 領主光環
    this.lordAura = LordCommanderSystem.getLordAura(siegeOptions?.lordTitle || GameState.myTerritory?.title || NobleTitle.COMMONER);

    // 1. 初始化我方第一梯隊
    this.initPlayerTeam(defenderIds, formationId, gridMap);

    // 2. 初始化波次怪物
    if (waveEnemyLineups && waveEnemyLineups.length > 0) {
      this.allWavesEnemyLineups = waveEnemyLineups;
      this.totalWaves = waveEnemyLineups.length;
    } else {
      this.allWavesEnemyLineups = [this.generateDefaultWaveEnemies(this.totalWaves)];
    }

    this.initWaveEnemies(1);
  }

  private initPlayerTeam(defenderIds: string[], formationId?: string, gridMap?: Record<string, string>) {
    this.playerTeam = [];
    const validIds = defenderIds.length > 0 ? defenderIds : (GameState.adventurers.slice(0, 5).map(a => a.id));

    validIds.forEach(id => {
      const adv = GameState.adventurers.find(a => a.id === id);
      if (adv) {
        const stats = adv.getCombatStats();
        // 光環加成
        if (this.lordAura) {
          stats.patk = Math.floor(stats.patk * (1 + this.lordAura.statBonusPct));
          stats.matk = Math.floor(stats.matk * (1 + this.lordAura.statBonusPct));
          stats.pdef = Math.floor(stats.pdef * (1 + this.lordAura.statBonusPct));
          stats.mdef = Math.floor(stats.mdef * (1 + this.lordAura.statBonusPct));
        }

        let slotId: string | undefined;
        if (gridMap) {
          for (const [k, v] of Object.entries(gridMap)) {
            if (v === adv.id) { slotId = k; break; }
          }
        }
        let gridR = 0, gridC = 0, row = FormationRow.FRONT;
        if (slotId && slotId.includes('_')) {
          const parts = slotId.split('_');
          gridR = parseInt(parts[0], 10) || 0;
          gridC = parseInt(parts[1], 10) || 0;
          row = gridR === 0 ? FormationRow.FRONT : (gridR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);
        }

        const maxHp = stats.hp || 100;
        const maxMp = stats.mp || 100;
        const currentHp = typeof adv.getCurrentHp === 'function' ? adv.getCurrentHp() : (adv.currentHp !== undefined ? adv.currentHp : maxHp);
        const currentMp = typeof adv.getCurrentMp === 'function' ? adv.getCurrentMp() : (adv.currentMp !== undefined ? adv.currentMp : maxMp);
        this.playerTeam.push({
          id: adv.id,
          name: adv.name,
          isPlayer: true,
          stats,
          currentHp: Math.min(currentHp, maxHp),
          maxHp: maxHp,
          currentMp: Math.min(currentMp, maxMp),
          maxMp: maxMp,
          statusEffects: [],
          skills: [],
          row,
          gridR,
          gridC,
          avatarIndex: adv.avatarIndex || 0,
          gender: adv.gender,
          isGuardian: adv.isGuardian || false,
          isAdvanced: adv.isAdvanced && adv.level >= 10
        });
      }
    });

    this.playerTeam.forEach(p => {
      if (!this.allTrackedPlayers.some(x => x.id === p.id)) {
        this.allTrackedPlayers.push(p);
      }
    });
  }

  private generateDefaultWaveEnemies(level: number): MonsterInstance[] {
    const list: MonsterInstance[] = [];
    const count = 3;
    for (let i = 0; i < count; i++) {
      list.push({
        id: `enemy_${i}`,
        name: `敵軍斥候 ${i + 1}`,
        hp: 200,
        maxHp: 200,
        damage: 30,
        defense: 15,
        pdef: 15,
        mdef: 10,
        speed: 18,
        evade: 5,
        calculatedPowerScore: 100,
        skills: [],
        element: ElementType.NONE,
        race: MonsterRace.HUMAN,
        appliedRaceTag: MonsterRace.HUMAN,
        compatibleRaces: [MonsterRace.HUMAN],
        terrains: [TerrainType.WILDERNESS],
        powerTier: 1,
        gridR: i < 3 ? 0 : 1,
        gridC: i % 3
      } as MonsterInstance);
    }
    return list;
  }

  private initWaveEnemies(waveIdx: number) {
    this.currentWave = waveIdx;
    const lineup = this.allWavesEnemyLineups[waveIdx - 1] || this.allWavesEnemyLineups[0] || [];
    this.enemyTeam = [];

    lineup.forEach((m, idx) => {
      const maxHp = m.maxHp || m.hp || 100;
      const currentHp = (m.hp !== undefined && m.hp <= maxHp) ? m.hp : maxHp;
      const stats = {
        hp: maxHp,
        patk: m.damage || 20,
        matk: m.isMagicalAttacker ? (m.damage || 20) : 10,
        pdef: m.pdef ?? m.defense ?? 10,
        mdef: m.mdef ?? m.defense ?? 10,
        speed: m.speed ?? 15,
        critChance: 5,
        critDmgPct: 150,
        counterChance: 0,
        blockChance: 0,
        damageReductionPct: 0
      };
      const gridR = (m as any).gridR ?? (idx < 3 ? 0 : (idx < 6 ? 1 : 2));
      const gridC = (m as any).gridC ?? (idx % 3);
      const row = gridR === 0 ? FormationRow.FRONT : (gridR === 1 ? FormationRow.MIDDLE : FormationRow.BACK);

      const avatarIcon = m.avatarIcon || (m.id ? `icons_monsters:${m.id.replace(/^adv_temp_guard/, 'goblin')}` : 'icons_monsters:goblin');

      const attackType: import('../../models/types').AttackType = m.attackType || (m.isMagicalAttacker ? 'MAGIC' : (m.id === 'crossbowman' ? 'RANGED' : 'MELEE'));

      this.enemyTeam.push({
        id: `enemy_${waveIdx}_${idx}`,
        name: m.name,
        isPlayer: false,
        stats,
        attackType,
        currentHp: currentHp,
        maxHp: maxHp,
        currentMp: 100,
        maxMp: 100,
        statusEffects: [],
        skills: m.skills || [],
        row,
        gridR,
        gridC,
        avatarIndex: idx % 6,
        avatarIcon,
        gender: 'MALE',
        element: m.element || ElementType.NONE
      });
    });
    this.allWavesEnemyTeams[waveIdx] = this.enemyTeam;
  }

  public getInitialEvents(): CombatEvent[] {
    const events: CombatEvent[] = [];

    // 保存初始狀態
    this.initialStates = [...this.playerTeam, ...this.enemyTeam].map(p => ({
      id: p.id,
      name: p.name,
      isPlayer: p.isPlayer,
      row: p.row,
      gridR: p.gridR,
      gridC: p.gridC,
      maxHp: p.maxHp,
      currentHp: p.currentHp,
      maxMp: p.maxMp,
      currentMp: p.currentMp,
      avatarIndex: p.avatarIndex,
      avatarIcon: p.avatarIcon,
      gender: p.gender,
      isGuardian: p.isGuardian,
      isAdvanced: p.isAdvanced
    }));

    // 1. 光環啟動事件
    if (this.lordAura) {
      events.push({
        type: CombatEventType.LORD_AURA_TRIGGER,
        text: `👑 【${this.lordAura.name}】領主親征光環啟動！${this.lordAura.description}`
      });
    }

    // 2. 第 1 波次事件
    const enemiesState: CombatParticipantState[] = this.enemyTeam.map(e => ({
      id: e.id,
      name: e.name,
      isPlayer: false,
      row: e.row,
      gridR: e.gridR,
      gridC: e.gridC,
      maxHp: e.maxHp,
      currentHp: e.currentHp,
      maxMp: e.maxMp,
      currentMp: e.currentMp,
      avatarIndex: e.avatarIndex,
      avatarIcon: e.avatarIcon,
      gender: e.gender
    }));

    events.push({
      type: CombatEventType.WAVE_START,
      wave: 1,
      enemies: enemiesState,
      text: `🌊 ── 第 1 波敵人現身！──`
    });

    events.push({
      type: CombatEventType.TURN_START,
      turn: 1,
      text: `── ⚔️ 第 1 回合開始 ──`
    });

    this.allEvents.push(...events);
    return events;
  }

  /**
   * 實時單步執行一個回合 (Step Turn)
   * 傳入玩家本回合下達的指令
   */
  public stepTurn(order: CommanderOrderType): CombatEvent[] {
    if (this.isFinished) return [];

    const turnEvents: CombatEvent[] = [];

    // 👑 1. 執行玩家本回合下達的軍令（單一指令結算）
    if (order === 'SHIELD_WALL') {
      const infCount = this.assignedTroops.infantry;
      if (infCount > 0 && this.tacticCds.SHIELD_WALL <= 0) {
        this.tacticCds.SHIELD_WALL = 3;
        const { shieldHp, blockChanceBonus } = LordCommanderSystem.calculateShieldWall(infCount);
        this.playerTeam.filter(p => p.currentHp > 0 && (p.row === FormationRow.FRONT || p.gridR === 0)).forEach(frontP => {
          frontP.statusEffects.push({ type: StatusEffectType.BUFF_DEF, duration: 1, value: blockChanceBonus });
        });
        turnEvents.push({
          type: CombatEventType.COMMANDER_SHIELD_WALL,
          shieldRemaining: shieldHp,
          text: `🛡️ 【👑 領主軍令·鋼鐵盾牆】步兵軍團（${infCount}人）立起重盾方陣！前排獲得 +${blockChanceBonus}% 格擋增益！`
        });
      }
    } else if (order === 'VOLLEY_FIRE') {
      const arcCount = this.assignedTroops.archer;
      if (arcCount > 0 && this.tacticCds.VOLLEY_FIRE <= 0) {
        this.tacticCds.VOLLEY_FIRE = 2;
        const volleyDmg = LordCommanderSystem.calculateVolleyFire(arcCount);
        const aliveEnemies = this.enemyTeam.filter(e => e.currentHp > 0);
        aliveEnemies.forEach(vTarget => {
          vTarget.currentHp = Math.max(0, vTarget.currentHp - volleyDmg);
          vTarget.statusEffects.push({ type: StatusEffectType.ARMOR_BREAK, duration: 2, value: 20 });
          turnEvents.push({
            type: CombatEventType.ARCHER_VOLLEY,
            targetId: vTarget.id,
            targetName: vTarget.name,
            damage: volleyDmg,
            targetHp: vTarget.currentHp,
            targetMaxHp: vTarget.maxHp,
            text: `🏹 【👑 領主軍令·漫天箭雨】弓兵軍團（${arcCount}人）萬箭齊發！對 ${vTarget.name} 造成 ${volleyDmg} 點穿刺傷害並附加破甲！`
          });
        });
        this.processDeaths(turnEvents);
      }
    } else if (order === 'CAVALRY_CHARGE') {
      const cavCount = this.assignedTroops.cavalry;
      if (cavCount > 0 && this.tacticCds.CAVALRY_CHARGE <= 0) {
        this.tacticCds.CAVALRY_CHARGE = 4;
        const aliveEnemies = this.enemyTeam.filter(e => e.currentHp > 0);
        if (aliveEnemies.length > 0) {
          const cTarget = Random.pick(aliveEnemies);
          const { damage: cavalryDmg, stunChance } = LordCommanderSystem.calculateCavalryCharge(cavCount);
          cTarget.currentHp = Math.max(0, cTarget.currentHp - cavalryDmg);

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

          turnEvents.push({
            type: CombatEventType.CAVALRY_CHARGE,
            targetId: cTarget.id,
            targetName: cTarget.name,
            damage: cavalryDmg,
            targetHp: cTarget.currentHp,
            targetMaxHp: cTarget.maxHp,
            text: `🐎 【👑 領主軍令·破陣衝鋒】騎兵軍團（${cavCount}騎）疾馳破陣！對 ${cTarget.name} 造成 ${cavalryDmg} 點重創！${stunText}`
          });
          this.processDeaths(turnEvents);
        }
      }
    } else if (order === 'INSPIRE') {
      if (this.tacticCds.INSPIRE <= 0) {
        this.tacticCds.INSPIRE = 3;
        const { dmgBonusPct } = LordCommanderSystem.calculateInspireRally();
        this.playerTeam.filter(p => p.currentHp > 0).forEach(p => {
          p.statusEffects.push({ type: StatusEffectType.BUFF_PATK, duration: 1, value: dmgBonusPct });
        });
        turnEvents.push({
          type: CombatEventType.COMMANDER_INSPIRE,
          text: `🎺 【👑 領主軍令·全軍鼓舞】領主拔劍高呼！全軍士氣大振（傷害 +${dmgBonusPct}%）！`
        });
      }
    } else {
      turnEvents.push({
        type: CombatEventType.COMMANDER_TACTIC,
        text: `⏩ 【領主號令·全軍待命】領主審時度勢保留兵力，下令全軍正常交鋒！`
      });
    }

    // ⚔️ 2. 雙方全員依敏捷速度進行本回合交鋒
    const allParticipants = [...this.playerTeam, ...this.enemyTeam].filter(p => p.currentHp > 0);
    allParticipants.sort((a, b) => (b.stats.speed + Random.next() * 20) - (a.stats.speed + Random.next() * 20));

    for (const actor of allParticipants) {
      if (actor.currentHp <= 0) continue;

      // 結算行動前狀態 (DOT)
      this.tickActorPreTurn(actor, turnEvents);
      if (actor.currentHp <= 0) {
        this.processDeaths(turnEvents);
        continue;
      }

      // 暈眩跳過
      const isStunned = actor.statusEffects.some((s: any) => s.type === StatusEffectType.STUN);
      if (isStunned) {
        turnEvents.push({ type: CombatEventType.MISS, actorName: actor.name, text: `${actor.name} 處於暈眩狀態，無法行動！` });
        continue;
      }

      const enemies = actor.isPlayer ? this.enemyTeam.filter(e => e.currentHp > 0) : this.playerTeam.filter(p => p.currentHp > 0);
      if (enemies.length === 0) break;

      // 選擇目標並攻擊
      const target = this.pickTarget(enemies);
      if (!target) break;

      this.executeAction(actor, target, turnEvents);
      this.processDeaths(turnEvents);

      if (this.enemyTeam.every(e => e.currentHp <= 0) || this.playerTeam.every(p => p.currentHp <= 0)) {
        break;
      }
    }

    // 🏰 守城戰專屬：哨所箭塔每回合開砲
    if (this.siegeOptions?.isSiege && (this.siegeOptions.watchtowerDmg || 0) > 0) {
      const aliveEnemies = this.enemyTeam.filter(e => e.currentHp > 0);
      if (aliveEnemies.length > 0) {
        const wtTarget = this.pickTarget(aliveEnemies);
        if (wtTarget) {
          const wtDmg = this.siegeOptions.watchtowerDmg || 25;
          wtTarget.currentHp = Math.max(0, wtTarget.currentHp - wtDmg);
          turnEvents.push({
            type: CombatEventType.WATCHTOWER_ATTACK,
            targetId: wtTarget.id,
            targetName: wtTarget.name,
            damage: wtDmg,
            targetHp: wtTarget.currentHp,
            targetMaxHp: wtTarget.maxHp,
            text: `🏹 【🏰 守城要塞·哨所箭塔】駐防守軍萬箭齊發！對 ${wtTarget.name} 造成 ${wtDmg} 點箭塔砲擊傷害！`
          });
          this.processDeaths(turnEvents);
        }
      }
    }



    // 🔄 3. 回合結尾處理
    turnEvents.push({
      type: CombatEventType.TURN_END,
      turn: this.turn,
      text: `── 第 ${this.turn} 回合結束 ──`
    });

    // 技能 CD 嚴格精準遞減 1
    if (this.tacticCds.SHIELD_WALL > 0) this.tacticCds.SHIELD_WALL--;
    if (this.tacticCds.VOLLEY_FIRE > 0) this.tacticCds.VOLLEY_FIRE--;
    if (this.tacticCds.CAVALRY_CHARGE > 0) this.tacticCds.CAVALRY_CHARGE--;
    if (this.tacticCds.INSPIRE > 0) this.tacticCds.INSPIRE--;

    // 4. 檢查勝負與波次狀態
    const enemyAllDead = this.enemyTeam.every(e => e.currentHp <= 0);
    const playerAllDead = this.playerTeam.every(p => p.currentHp <= 0);

    if (enemyAllDead) {
      if (this.currentWave < this.totalWaves) {
        // 晉級下一波
        this.initWaveEnemies(this.currentWave + 1);
        const nextEnemiesState: CombatParticipantState[] = this.enemyTeam.map(e => ({
          id: e.id,
          name: e.name,
          isPlayer: false,
          row: e.row,
          gridR: e.gridR,
          gridC: e.gridC,
          maxHp: e.maxHp,
          currentHp: e.currentHp,
          maxMp: e.maxMp,
          currentMp: e.currentMp,
          avatarIndex: e.avatarIndex,
          avatarIcon: e.avatarIcon,
          gender: e.gender
        }));
        turnEvents.push({
          type: CombatEventType.WAVE_START,
          wave: this.currentWave,
          enemies: nextEnemiesState,
          text: `🌊 ── 第 ${this.currentWave} 波敵人現身！──`
        });
        this.turn++;
        turnEvents.push({
          type: CombatEventType.TURN_START,
          turn: this.turn,
          text: `── ⚔️ 第 ${this.turn} 回合開始 ──`
        });
      } else {
        // 全波次勝利！
        this.isFinished = true;
        this.isVictory = true;
        turnEvents.push({
          type: CombatEventType.END,
          text: '🏆 我方部隊奮勇作戰，成功清剿了所有敵人！'
        });
      }
    } else if (playerAllDead) {
      // 檢查是否有備用梯隊
      if (this.reserveSquads.length > 0) {
        const nextSquad = this.reserveSquads.shift()!;
        this.currentSquadIndex++;
        const squadTitle = `第 ${this.currentSquadIndex + 1} 梯隊`;
        this.initPlayerTeam(nextSquad.defenderIds, nextSquad.formationId, nextSquad.gridMap);

        const newSquadStates: CombatParticipantState[] = this.playerTeam.map(p => ({
          id: p.id,
          name: p.name,
          isPlayer: true,
          row: p.row,
          gridR: p.gridR,
          gridC: p.gridC,
          maxHp: p.maxHp,
          maxMp: p.maxMp,
          currentMp: p.currentMp,
          avatarIndex: p.avatarIndex,
          gender: p.gender
        }));

        turnEvents.push({
          type: CombatEventType.SQUAD_CHANGE,
          squadIndex: this.currentSquadIndex,
          squadName: squadTitle,
          newSquadStates,
          text: `🚩 【${squadTitle} 增援登場！】全軍誓死守衛領地！`
        });

        this.turn++;
        turnEvents.push({
          type: CombatEventType.TURN_START,
          turn: this.turn,
          text: `── ⚔️ 第 ${this.turn} 回合開始 ──`
        });
      } else {
        // 所有梯隊全滅，戰敗
        this.isFinished = true;
        this.isVictory = false;
        turnEvents.push({
          type: CombatEventType.END,
          text: '💀 我方部隊全滅，戰鬥失敗！'
        });
      }
    } else {
      this.turn++;
      if (this.turn > this.maxTurns) {
        this.isFinished = true;
        this.isVictory = false;
        turnEvents.push({
          type: CombatEventType.END,
          text: '⏱️ 戰鬥超時，我方被迫撤退！'
        });
      } else {
        turnEvents.push({
          type: CombatEventType.TURN_START,
          turn: this.turn,
          text: `── ⚔️ 第 ${this.turn} 回合開始 ──`
        });
      }
    }

    this.allEvents.push(...turnEvents);
    return turnEvents;
  }

  private pickTarget(enemies: any[]): any {
    // 優先前排
    const front = enemies.filter(e => e.row === FormationRow.FRONT || e.gridR === 0);
    if (front.length > 0) return Random.pick(front);
    const mid = enemies.filter(e => e.row === FormationRow.MIDDLE || e.gridR === 1);
    if (mid.length > 0) return Random.pick(mid);
    return Random.pick(enemies);
  }

  private executeAction(actor: any, target: any, events: CombatEvent[]) {
    const isSiege = (this.siegeOptions?.isSiege && this.gateRemainingHp > 0) ?? false;
    
    // 依據標準 attackType 判定攻擊距離與傷害類型 (預設 MELEE)
    const attackType: import('../../models/types').AttackType = actor.attackType || (actor.isMagicalAttacker ? 'MAGIC' : (actor.weaponType === 'BOW' || actor.weaponType === 'MAGIC_BOW' ? 'RANGED' : (actor.weaponType === 'STAFF' || actor.weaponType === 'HOLY_BOOK' ? 'MAGIC' : 'MELEE')));
    const isMelee = attackType === 'MELEE';
    const isPhysical = attackType !== 'MAGIC';

    // 🏰 守城戰專屬：近戰敵怪城牆 100% 絕對阻隔法則
    if (!actor.isPlayer && isSiege && isMelee) {
      const frontDefenders = this.playerTeam.filter(p => p.currentHp > 0 && (p.row === FormationRow.FRONT || p.gridR === 0));
      const targetIsFront = target.row === FormationRow.FRONT || target.gridR === 0;

      // 1. 若我方前排已無人：近戰敵怪 100% 絕對被城牆阻隔，無法攻擊中後排守軍，全部傷害轉打城門！
      // 2. 若我方有前排：非前排目標或 40% 機率打擊城門！
      if (frontDefenders.length === 0 || !targetIsFront || Random.next() < 0.4) {
        const rawGateDmg = Math.max(5, Math.floor((actor.stats.patk || 20) * 0.8));
        const gateDmg = Math.min(this.gateRemainingHp, rawGateDmg);
        this.gateRemainingHp = Math.max(0, this.gateRemainingHp - gateDmg);
        events.push({
          type: this.gateRemainingHp <= 0 ? CombatEventType.SIEGE_GATE_BREAK : CombatEventType.SIEGE_GATE_DAMAGE,
          actorId: actor.id,
          actorName: actor.name,
          damage: gateDmg,
          gateRemainingHp: this.gateRemainingHp,
          text: this.gateRemainingHp <= 0
            ? `💥 【⚠️ 城門告急】${actor.name} 猛烈衝擊城門造成 ${gateDmg} 點傷害！城門已被徹底攻破！敵軍湧入城內！`
            : `🛡️ 【🏰 城門阻擋】${actor.name} 受城門阻隔無法攻擊後排守軍，轉而撞擊要塞城牆造成 ${gateDmg} 點攻城傷害！(剩餘耐久：${this.gateRemainingHp} / ${this.gateMaxHp})`
        });
        return; // 城牆完全吸收了本次近戰傷害，保護後排！
      }
    }

    const atk = isPhysical ? actor.stats.patk : actor.stats.matk;
    const def = isPhysical ? target.stats.pdef : target.stats.mdef;

    let baseDmg = Math.max(1, atk * 1.5 - def * 0.5 + (Random.next() * 10 - 5));
    if (target.isPlayer && isSiege) {
      baseDmg = Math.max(1, Math.floor(baseDmg * 0.75)); // 🏰 城垛掩體減傷 25%
    }
    const isCrit = Random.next() < (actor.stats.critChance || 5) / 100;
    const finalDmg = Math.floor(isCrit ? baseDmg * ((actor.stats.critDmgPct || 150) / 100) : baseDmg);

    target.currentHp = Math.max(0, target.currentHp - finalDmg);

    if (actor.isPlayer) {
      this.totalDamageDealt += finalDmg;
      this.damageMap[actor.id] = (this.damageMap[actor.id] || 0) + finalDmg;
    }

    events.push({
      type: isCrit ? CombatEventType.CRIT : CombatEventType.HIT,
      actorId: actor.id,
      actorName: actor.name,
      targetId: target.id,
      targetName: target.name,
      damage: finalDmg,
      targetHp: target.currentHp,
      targetMaxHp: target.maxHp,
      text: `${actor.name} 對 ${target.name} 發動攻擊，造成 ${finalDmg} 點傷害！${isCrit ? '💥 暴擊！' : ''}${target.isPlayer && isSiege ? ' 🛡️(城垛掩體減傷)' : ''}`
    });
  }

  private tickActorPreTurn(actor: any, events: CombatEvent[]) {
    // 光環 MP 恢復 (+2 MP)
    const mpRegen = (this.lordAura?.mpRegenPerTurn || 2);
    if (actor.isPlayer && actor.currentMp !== undefined) {
      actor.currentMp = Math.min(actor.maxMp || 100, actor.currentMp + mpRegen);
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

    // 結算流血與中毒
    const activeDots = actor.statusEffects.filter((s: any) => s.type === StatusEffectType.BLEED || s.type === StatusEffectType.POISON);
    activeDots.forEach((dot: any) => {
      const dotDmg = Math.max(5, Math.floor(actor.maxHp * 0.05));
      actor.currentHp = Math.max(0, actor.currentHp - dotDmg);
      events.push({
        type: CombatEventType.STATUS_DAMAGE,
        actorName: actor.name,
        targetId: actor.id,
        targetName: actor.name,
        damage: dotDmg,
        targetHp: actor.currentHp,
        targetMaxHp: actor.maxHp,
        statusType: dot.type,
        text: `${actor.name} 受到 ${dot.type === StatusEffectType.BLEED ? '流血' : '中毒'} 傷害 ${dotDmg} 點！`
      });
      dot.duration--;
    });
    actor.statusEffects = actor.statusEffects.filter((s: any) => s.duration > 0);
  }

  private processDeaths(events: CombatEvent[]) {
    [...this.playerTeam, ...this.enemyTeam].forEach(p => {
      if (p.currentHp <= 0 && !p.isDeadLogged) {
        p.isDeadLogged = true;
        events.push({
          type: CombatEventType.DEATH,
          actorId: p.id,
          actorName: p.name,
          text: `💀 ${p.name} 倒下了！`
        });
      }
    });
  }

  public generateFinalReport(): CombatReport {
    let mvpId = '';
    let maxDmg = -1;
    Object.entries(this.damageMap).forEach(([id, dmg]) => {
      if (dmg > maxDmg) { maxDmg = dmg; mvpId = id; }
    });
    const mvpName = (this.allTrackedPlayers || this.playerTeam).find(p => p.id === mvpId)?.name || '無';

    const playerHpMap: Record<string, number> = {};
    const playerMpMap: Record<string, number> = {};
    const participantsToSettle = (this.allTrackedPlayers && this.allTrackedPlayers.length > 0) ? this.allTrackedPlayers : this.playerTeam;

    participantsToSettle.forEach(p => {
      playerHpMap[p.id] = p.currentHp;
      playerMpMap[p.id] = p.currentMp || 0;

      // 🏥 戰後傭兵即時血量 1:1 寫回與重傷瀕死判定 (全梯隊成員 100% 寫回)
      const adv = (GameState.adventurers || []).find((a: any) => a.id === p.id);
      if (adv) {
        if (p.currentHp <= 0) {
          adv.applyWound(); // 陣亡 ➔ 標記重傷 Debuff，HP 鎖定 1
        } else {
          adv.setCurrentHp(p.currentHp);
          adv.setCurrentMp(p.currentMp || 0);
        }
      }
    });

    // 統計所有波次的殘存狀態 (供野外攔截戰戰況 1:1 繼承至守城戰)
    const survivingWaves: import('../../models/Narrative').SurvivingMonsterState[][] = [];
    if (this.allWavesEnemyLineups && this.allWavesEnemyLineups.length > 0) {
      this.allWavesEnemyLineups.forEach((wLineup, wIdx) => {
        const waveIdx = wIdx + 1;
        const waveStates: import('../../models/Narrative').SurvivingMonsterState[] = [];
        const thisWaveEnemyTeam = this.allWavesEnemyTeams[waveIdx] || (waveIdx === this.currentWave ? this.enemyTeam : []);

        wLineup.forEach((m, mIdx) => {
          const matchInst = thisWaveEnemyTeam.find(e => e.id === `enemy_${waveIdx}_${mIdx}` || e.name === m.name);
          const isDead = matchInst ? matchInst.currentHp <= 0 : (waveIdx < this.currentWave);
          const curHp = matchInst ? matchInst.currentHp : (isDead ? 0 : (m.hp || m.maxHp || 100));

          waveStates.push({
            monsterId: m.id || 'bandit',
            currentHp: curHp,
            maxHp: m.maxHp || m.hp || matchInst?.maxHp || 100,
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

    return {
      isVictory: this.isVictory,
      participants: participantsToSettle.map(p => p.id),
      lootValue: Math.floor(Math.random() * 50) + 50,
      events: this.allEvents,
      playerHpMap,
      playerMpMap,
      battleLog: this.isVictory ? '我方部隊奮勇作戰，成功清剿了所有敵人！' : '敵軍火力太強，我方部隊被迫撤退。',
      initialStates: this.initialStates,
      mvpName,
      totalDamageDealt: this.totalDamageDealt,
      terrain: this.terrain,
      isLordCampaign: true,
      lordAura: this.lordAura,
      commanderTroops: this.assignedTroops,
      isDefenseSiege: this.siegeOptions?.isSiege ?? false,
      isFieldInterception: this.siegeOptions?.isFieldInterception ?? false,
      survivingWaves: survivingWaves.length > 0 ? survivingWaves : undefined,
      gateMaxHp: this.gateMaxHp,
      gateRemainingHp: this.gateRemainingHp,
      totalEarnedGold: this.isVictory ? 150 : 0,
      totalEarnedExp: this.isVictory ? 300 : 50
    };
  }
}
