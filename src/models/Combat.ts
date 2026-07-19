import { CombatStats, FormationRow, TerrainType } from './types';

export enum StatusEffectType {
  BLEED = 'BLEED',
  POISON = 'POISON',
  STUN = 'STUN',
  TAUNT = 'TAUNT',
  FEAR = 'FEAR'
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
  row: FormationRow;
  maxHp: number;
  currentHp: number;
  stats: CombatStats; // hp, mp, atk, def, hit, evade
  statusEffects: StatusEffect[];
}

export enum CombatEventType {
  START = 'START',
  WAVE_START = 'WAVE_START',
  HIT = 'HIT',
  MISS = 'MISS',
  CRIT = 'CRIT',
  STATUS_APPLY = 'STATUS_APPLY',
  STATUS_DAMAGE = 'STATUS_DAMAGE',
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
  statusType?: StatusEffectType;
  text: string;
  wave?: number; // 標示屬於哪一波
  enemies?: CombatParticipantState[]; // 在 WAVE_START 時，傳遞該波次新敵人的血條狀態
}

export interface CombatParticipantState {
  id: string;
  name: string;
  isPlayer: boolean;
  row: FormationRow;
  maxHp: number;
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
}

export interface CombatHistoryRecord {
  id: string; // 時間戳或其他唯一識別
  day: number; // 發生天數
  nodeName: string; // 發生地點
  report: CombatReport;
}
