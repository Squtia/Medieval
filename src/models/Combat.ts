import { CombatStats, FormationRow, TerrainType } from './types';

export enum StatusEffectType {
  BLEED = 'BLEED',
  POISON = 'POISON',
  STUN = 'STUN',
  TAUNT = 'TAUNT',
  FEAR = 'FEAR',
  ARMOR_BREAK = 'ARMOR_BREAK', // 破甲
  SHOCK = 'SHOCK' // 感電
}

export interface StatusEffect {
  type: StatusEffectType;
  duration: number; // 剩餘回合數
  value?: number; // 例如每回合扣血量或層數
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
  stats: CombatStats; // hp, mp, atk, def, hit, evade
  statusEffects: StatusEffect[];
  // Phase 4: Army Shield System
  shieldType?: string;      // 攜帶的兵種 (例如: 'INFANTRY', 'CAVALRY', 'ARCHER')
  shieldMaxHp?: number;     // 該兵種提供的總護盾值 (基於攜帶數量)
  shieldCurrentHp?: number; // 剩餘護盾值
  
  // 新增：職業與裝備武器，用來判定變異狀態與可用技能
  baseClass?: string;
  weaponType?: string;
  skills?: string[]; // 可使用的技能 ID 列表
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
  SHIELD_DAMAGE = 'SHIELD_DAMAGE', // 護盾受到傷害
  SHIELD_BREAK = 'SHIELD_BREAK',   // 護盾破裂
  DEATH = 'DEATH',
  END = 'END'
}

export interface CombatEvent {
  type: CombatEventType;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  damage?: number;
  targetHp?: number;
  targetMaxHp?: number;
  shieldDamage?: number;
  shieldRemaining?: number;
  statusType?: StatusEffectType;
  skillName?: string; // 施放的技能名稱
  text: string;
  wave?: number; // 標示屬於哪一波
  enemies?: CombatParticipantState[]; // 在 WAVE_START 時，傳遞該波次新敵人的血條狀態
}

export interface CombatParticipantState {
  id: string;
  name: string;
  isPlayer: boolean;
  row: string;
  maxHp: number;
  gridR?: number;
  gridC?: number;
}

export interface CombatReport {
  isVictory: boolean;
  participants: string[]; // 我方參與者 IDs
  lootValue: number;
  events: CombatEvent[];
  playerHpMap: Record<string, number>; // 紀錄戰鬥結束後我方剩餘血量
  battleLog: string; // 最終簡短結果
  initialStates: CombatParticipantState[];
  mvpName?: string; // MVP 名稱
  totalDamageDealt?: number; // 總造成傷害
  terrain?: TerrainType; // 發生戰鬥的地形
  waveIndex?: number; // 用於進度討伐時標記波次
  shieldLoss?: Record<string, Record<string, number>>; // 記錄每個參與者損失的各兵種數量 { participantId: { INFANTRY: 50 } }
}

export interface CombatHistoryRecord {
  id: string; // 時間戳或其他唯一識別
  day: number; // 發生天數
  nodeName: string; // 發生地點
  report: CombatReport;
}
