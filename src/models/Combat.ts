import { CombatStats, FormationRow, TerrainType, Attributes, SiegeBattleMode, SiegeRole, NobleTitle } from './types';

export enum StatusEffectType {
  BLEED = 'BLEED',
  POISON = 'POISON',
  BURN = 'BURN', // 灼燒 (火系 DOT)
  STUN = 'STUN',
  TAUNT = 'TAUNT',
  FEAR = 'FEAR',
  ARMOR_BREAK = 'ARMOR_BREAK', // 破甲
  SHOCK = 'SHOCK', // 感電
  REGEN_HP = 'REGEN_HP', // 生命恢復
  REGEN_MP = 'REGEN_MP',  // 魔力恢復
  BUFF_PATK = 'BUFF_PATK', // 物理攻擊增益 (%)
  BUFF_MATK = 'BUFF_MATK', // 魔法攻擊增益 (%)
  BUFF_PDEF = 'BUFF_PDEF', // 物理防禦增益 (%)
  BUFF_DEF = 'BUFF_DEF',   // 通用防禦增益 (%)
  BUFF_EVADE = 'BUFF_EVADE', // 閃避率增益 (點數)
  MARK = 'MARK',               // 標記（可疊加，被引爆技能消耗）
  BARRIER = 'BARRIER',         // 吸傷護盾
  DELAYED_BOMB = 'DELAYED_BOMB', // 延遲炸彈
  FIELD_FIRE = 'FIELD_FIRE',   // 火焰場地
  FIELD_HOLY = 'FIELD_HOLY',   // 聖域
  FIELD_CURSE = 'FIELD_CURSE'  // 詛咒場地
}

export interface StatusEffect {
  type: StatusEffectType;
  duration: number; // 剩餘回合數
  value?: number; // 例如每回合扣血量
  stacks?: number; // 疊加層數 (例如中毒)
}

export interface CombatParticipant {
  id: string;
  name: string;
  isPlayer: boolean;
  row: string;
  gridR?: number;
  gridC?: number;
  maxHp: number;
  currentHp: number;
  maxMp?: number;
  currentMp?: number;
  stats: CombatStats; // hp, mp, atk, def, hit, evade, speed
  attributes?: Attributes; // str, int, con, agi, luk (供新版計算使用)
  statusEffects: StatusEffect[];
  // Phase 4: Army Shield System
  shieldType?: string;      // 攜帶的兵種 (例如: 'INFANTRY', 'CAVALRY', 'ARCHER')
  shieldMaxHp?: number;     // 該兵種提供的總護盾值 (基於攜帶數量)
  shieldCurrentHp?: number; // 剩餘護盾值
  
  // 新增：職業與裝備武器，用來判定變異狀態與可用技能
  baseClass?: string;
  weaponType?: string;
  skills?: string[]; // 可使用的技能 ID 列表
  isAdvanced?: boolean; // 轉職開關狀態
  cooldowns?: Record<string, number>; // 技能 CD 狀態
  element?: import('./types').ElementType; // 相容用總元素
  atkElement?: import('./types').ElementType; // 攻擊元素 (來自武器或怪物原生)
  defElement?: import('./types').ElementType; // 防禦元素 (來自防具或怪物原生)
  attackType?: import('./types').AttackType; // 攻擊類型: MELEE, RANGED, MAGIC
  isMagicalAttacker?: boolean; // 是否為法系攻擊者 (相容性標記)
  avatarIcon?: string;        // 專屬 Sprite 圖標 (如 icons_monsters:goblin)

  // 動態戰利品 (供怪獸使用)
  goldReward?: number;
  expReward?: number;
  equipmentDropRate?: number;
}

export enum CombatEventType {
  START = 'START',
  WAVE_START = 'WAVE_START',
  HIT = 'HIT',
  MISS = 'MISS',
  CRIT = 'CRIT',
  SKILL_CAST = 'SKILL_CAST', // 施放技能
  STATUS_APPLY = 'STATUS_APPLY',
  STATUS_DAMAGE = 'STATUS_DAMAGE',
  STATUS_EXPIRE = 'STATUS_EXPIRE',
  HEAL = 'HEAL',
  SHIELD_DAMAGE = 'SHIELD_DAMAGE', // 護盾受到傷害
  SHIELD_BREAK = 'SHIELD_BREAK',   // 護盾破裂
  DEATH = 'DEATH',
  END = 'END',
  
  // 守城戰與軍團戰術專屬事件
  SIEGE_GATE_DAMAGE = 'SIEGE_GATE_DAMAGE', // 城門受到傷害
  SIEGE_GATE_BREAK = 'SIEGE_GATE_BREAK',   // 城門破碎
  WATCHTOWER_ATTACK = 'WATCHTOWER_ATTACK', // 箭塔開砲支援
  SQUAD_CHANGE = 'SQUAD_CHANGE',           // 車輪戰替換小隊登場
  ARCHER_VOLLEY = 'ARCHER_VOLLEY',         // 弓兵箭雨齊射
  CAVALRY_CHARGE = 'CAVALRY_CHARGE',       // 騎兵側翼衝鋒
  COMMANDER_TACTIC = 'COMMANDER_TACTIC',   // 領主軍團戰術指令 (通用)
  LORD_AURA_TRIGGER = 'LORD_AURA_TRIGGER', // 領主親征專屬光環觸發
  COMMANDER_SHIELD_WALL = 'COMMANDER_SHIELD_WALL', // 領主展開步兵鋼鐵盾牆
  COMMANDER_INSPIRE = 'COMMANDER_INSPIRE',         // 領主發動全軍鼓舞
  TURN_START = 'TURN_START',                       // 回合開始 (用於回合制親征暫停決策)
  TURN_END = 'TURN_END',                           // 回合結束

  // 攻城戰 (進攻方) 專屬事件
  BATTERING_RAM_ATTACK = 'BATTERING_RAM_ATTACK',   // 撞木衝車破門撞擊
  TREBUCHET_ATTACK = 'TREBUCHET_ATTACK',           // 重型投石機巨石轟擊
  CAVALRY_BREACH_CHARGE = 'CAVALRY_BREACH_CHARGE', // 破城毀滅突入
  ARCHER_REAR_CASUALTY = 'ARCHER_REAR_CASUALTY'    // 弓兵後排陣地戰損
}

export type CombatImpactKind =
  | 'DAMAGE'
  | 'HEAL'
  | 'SHIELD_DAMAGE'
  | 'STATUS_APPLY'
  | 'MISS';

export interface CombatEvent {
  type: CombatEventType;
  actionId?: string;       // 關聯同一次動作（普攻或技能）的唯一 ID
  impactIndex?: number;    // 在該 actionId 下的命中順序 (0, 1, 2...)
  impactCount?: number;    // 該 actionId 總計包含的打擊段數
  impactKind?: CombatImpactKind; // 打擊種類
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  damage?: number;
  healAmount?: number;
  targetHp?: number;
  targetMaxHp?: number;
  targetMp?: number;
  targetMaxMp?: number;
  shieldDamage?: number;
  shieldRemaining?: number;
  statusType?: StatusEffectType;
  skillId?: string;  // 施放的技能 ID
  vfxId?: string;    // 對應的特效工房預設 ID
  skillName?: string; // 施放的技能名稱
  skillTargetId?: string; // SKILL_CAST 專用：技能受術目標 ID（用於特效飛行方向；targetId 在 SKILL_CAST 保留為施術者以更新 MP 條）
  text: string;
  turn?: number; // 標示所屬回合數
  wave?: number; // 標示屬於哪一波
  enemies?: CombatParticipantState[]; // 在 WAVE_START 時，傳遞該波次新敵人的血條狀態
  isQuietRegen?: boolean; // 例行每回合恢復，不輸出對話框文字
  healType?: 'HP' | 'MP';
  
  // 守城與攻城專屬
  gateHp?: number;
  gateMaxHp?: number;
  gateRemainingHp?: number;
  squadIndex?: number;
  squadName?: string;
  newSquadStates?: CombatParticipantState[]; // SQUAD_CHANGE 事件：新登場梯隊的成員初始狀態
  auraDesc?: string;                         // 光環描述
}

export interface CombatParticipantState {
  id: string;
  name: string;
  isPlayer: boolean;
  row: string;
  maxHp: number;
  currentHp?: number;
  maxMp?: number;
  currentMp?: number;
  gridR?: number;
  gridC?: number;
  avatarIndex?: number;
  gender?: string;
  isGuardian?: boolean;
  avatarIcon?: string; // 怪物或特定單位的專屬 Sprite
}

export interface CombatReport {
  isVictory: boolean;
  participants: string[]; // 我方參與者 IDs
  lootValue: number;
  events: CombatEvent[];
  playerHpMap: Record<string, number>; // 紀錄戰鬥結束後我方剩餘血量
  playerMpMap?: Record<string, number>; // 紀錄戰鬥結束後我方剩餘魔力
  battleLog: string; // 最終簡短結果
  initialStates: CombatParticipantState[];
  mvpName?: string; // MVP 名稱
  totalDamageDealt?: number; // 總造成傷害
  terrain?: TerrainType; // 發生戰鬥的地形
  waveIndex?: number; // 用於進度討伐時標記波次
  shieldLoss?: Record<string, Record<string, number>>; // 記錄每個參與者損失的各兵種數量

  // 領主親征專屬
  isLordCampaign?: boolean;
  lordAura?: import('../systems/combat/LordCommanderSystem').LordAuraConfig;
  commanderTroops?: { infantry: number; archer: number; cavalry: number; };

  // 攻守戰役統一抽象 (桌遊棋盤接口)
  battleMode?: SiegeBattleMode;
  playerRole?: SiegeRole;

  // 守城戰專屬 (相容)
  isDefenseSiege?: boolean;
  isFieldInterception?: boolean;
  gateMaxHp?: number;
  gateRemainingHp?: number;
  survivingInfantry?: number;
  survivingWaves?: import('./Narrative').SurvivingMonsterState[][];
  survivingEnemyLegion?: { infantry: number; archer: number; cavalry: number; };

  // 攻城戰專屬 (相容)
  isOffensiveSiege?: boolean;
  survivingArchers?: number;
  engines?: { ramCount: number; trebuchetCount: number; };

  // 累加戰利品
  totalEarnedGold?: number;
  totalEarnedExp?: number;
  droppedEquipment?: string[]; // 裝備 ID 或名稱
}

export interface CombatHistoryRecord {
  id: string; // 時間戳或其他唯一識別
  day: number; // 發生天數
  nodeName: string; // 發生地點
  report: CombatReport;
}

export function tryApplyStatus(
  target: CombatParticipant,
  effect: StatusEffect,
  actorName?: string,
  skillName?: string,
  customApplyText?: string,
  targetTeam?: CombatParticipant[]
): CombatEvent {
  const isBuff = [
    StatusEffectType.REGEN_HP,
    StatusEffectType.REGEN_MP,
    StatusEffectType.BUFF_PATK,
    StatusEffectType.BUFF_MATK,
    StatusEffectType.BUFF_PDEF,
    StatusEffectType.BUFF_DEF,
    StatusEffectType.BUFF_EVADE
  ].includes(effect.type);

  if (!isBuff && target.isAdvanced && target.weaponType === 'MAGIC_RING') {
    if (targetTeam) {
      const aliveAllies = targetTeam.filter(p => p.id !== target.id && p.currentHp > 0);
      if (aliveAllies.length > 0) {
        return {
          type: CombatEventType.MISS,
          targetId: target.id,
          targetName: target.name,
          text: `${target.name} 處於【無敵】狀態，免疫了負面狀態！`
        };
      }
    }
  }

  let resistChance = 0;
  if (target.attributes) {
    resistChance = ((target.attributes.con || 0) + (target.attributes.spr || 0)) * 0.01;
  }
  
  if (Math.random() < resistChance) {
    return {
      type: CombatEventType.MISS,
      targetId: target.id,
      targetName: target.name,
      text: `${target.name} 抵抗了負面狀態！`
    };
  } else {
    target.statusEffects.push(effect);
    return {
      type: CombatEventType.STATUS_APPLY,
      targetId: target.id,
      targetName: target.name,
      statusType: effect.type,
      skillName: skillName,
      text: customApplyText || `${target.name} 被附加了狀態！`
    };
  }
}

export interface SiegeDefenseCombatOptions {
  isSiege: boolean;
  battleMode?: SiegeBattleMode; // 統一戰役模式
  playerRole?: SiegeRole;       // 玩家接入席位 (ATTACKER / DEFENDER)
  gateHp: number;
  watchtowerDmg?: number;
  archerVolleyDmg?: number;
  cavalryCount?: number;
  infantryCount?: number;
  isFieldInterception?: boolean;
  isLordCampaign?: boolean;
  lordTitle?: NobleTitle;
  assignedTroops?: { infantry: number; archer: number; cavalry: number; };
  reserveSquads?: { defenderIds: string[]; formationId?: string; gridMap?: Record<string, string> }[];
  enemyLegion?: { enabled?: boolean; infantry?: number; archer?: number; cavalry?: number; };
  isOffensiveSiege?: boolean; // 是否為進攻方攻城戰
  engines?: {
    ramCount: number;
    trebuchetCount: number;
  };
}
