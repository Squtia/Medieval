import { CombatParticipant, CombatEvent } from './Combat';

export enum TargetType {
  SINGLE_ENEMY = 'SINGLE_ENEMY',
  ALL_ENEMIES = 'ALL_ENEMIES',
  FRONT_ENEMIES = 'FRONT_ENEMIES',
  BACK_ENEMY = 'BACK_ENEMY',
  COLUMN = 'COLUMN',
  SELF = 'SELF',
  ALLY_LOWEST_HP = 'ALLY_LOWEST_HP',
  ALL_ALLIES = 'ALL_ALLIES'
}

export type SkillCategory = 'HERO_BASE' | 'HERO_ADVANCED' | 'MONSTER' | 'EQUIPMENT';

export interface Skill {
  id: string;
  name: string;
  mpCost: number;
  targetType: TargetType;
  description: string;
  cooldown?: number;
  category?: SkillCategory;
  icon?: string;
  aiWeight?: (caster: CombatParticipant, skillTargets: CombatParticipant[], allEnemies?: CombatParticipant[], allAllies?: CombatParticipant[]) => number;
  execute: (caster: CombatParticipant, targets: CombatParticipant[], allEnemies?: CombatParticipant[], allAllies?: CombatParticipant[]) => CombatEvent[];
}

export interface SkillDisplayInfo {
  skill: Skill;
  isLearned: boolean;
  lockReason?: string;
  category: 'BASE' | 'ADVANCED' | 'EQUIPMENT';
}

export interface PassiveDisplayInfo {
  name: string;
  description: string;
  icon: string;
  isActive: boolean;
}

// ===== 積木技能系統 (Composite Skill System) =====

export type SkillTrigger =
  | 'ACTIVE'          // 主動施放（預設）
  | 'ON_HIT_TAKEN'    // 受到攻擊後（Phase 2 引擎鉤子）
  | 'ON_KILL'         // 擊殺目標後（Phase 2）
  | 'ON_CRIT'         // 爆擊命中後（Phase 2）
  | 'ON_HP_THRESHOLD' // HP 低於 X% 首次（Phase 2）
  | 'ON_TURN_START'   // 每回合開始（Phase 2）
  | 'ON_MARK_STACK';  // 累積 N 層標記後自動爆發

export interface SkillCost {
  mpCost?: number;
  hpPercent?: number;      // 消耗自身 HP 的 X%
  consumeMarks?: boolean;  // 消耗目標 MARK 層數
}

export type SkillConditionType =
  | 'NONE' | 'TARGET_HP_GTE' | 'TARGET_HP_LT' | 'SELF_HP_LT'
  | 'TARGET_HAS_STATUS' | 'ALLY_EXISTS' | 'NO_ALLY' | 'IS_CRIT';

export interface SkillCondition {
  type: SkillConditionType;
  value?: number;    // 數值門檻（HP%）
  status?: string;   // 目標狀態類型
}

export type SkillEffectType =
  | 'DAMAGE_PHYSICAL' | 'DAMAGE_MAGICAL' | 'DAMAGE_MIXED' | 'DAMAGE_TRUE'
  | 'HEAL' | 'LIFESTEAL' | 'MULTI_HIT'
  | 'APPLY_STATUS' | 'SET_MARK' | 'DETONATE_MARKS'
  | 'APPLY_BARRIER' | 'CHAIN_DAMAGE' | 'EXECUTE'
  | 'DISPEL' | 'STEAL_BUFF' | 'DELAYED_BOMB' | 'MP_DRAIN'
  | 'FORCE_ROW_CHANGE' | 'FIELD_EFFECT'
  | 'BUFF_SELF' | 'BUFF_ALLIES';

export type SkillScaleType =
  | 'FIXED' | 'BY_MARK_STACKS' | 'BY_SELF_LOST_HP'
  | 'BY_KILL_COUNT' | 'BY_ALLY_COUNT' | 'BY_STATUS_COUNT';

export interface EffectBlock {
  trigger: SkillTrigger;
  cost?: SkillCost;
  condition?: SkillCondition;
  effectType: SkillEffectType;
  targetType: TargetType;
  // 傷害/治療
  multiplier?: number;
  element?: string;          // 'FIRE'|'ICE'|'LIGHTNING'|'HOLY'|'DARK'|'NONE'
  physRatio?: number;        // 混合傷害物理比例（0~1）
  hitCount?: number;         // 多段攻擊次數
  lifeStealRate?: number;    // 吸血比例（0~1）
  chainCount?: number;       // 連鎖跳次數
  executeThreshold?: number; // 斬殺 HP 門檻（0~1）
  // 狀態
  statusType?: string;
  statusDuration?: number;
  statusValue?: number;
  statusChance?: number;     // 附加機率（省略=必定）
  // 增益
  buffType?: string;         // StatusEffectType 字串
  buffValue?: number;
  buffDuration?: number;
  // 護盾
  barrierAmount?: number;
  // 延遲炸彈
  delayTurns?: number;
  delayEffect?: EffectBlock;
  // 戰場效果
  fieldType?: string;        // 'FIRE_FIELD'|'HOLY_GROUND'|'CURSE_FIELD'
  fieldDuration?: number;
  // 縮放
  scaleType?: SkillScaleType;
  // 條件分支
  onTrue?: EffectBlock[];
  onFalse?: EffectBlock[];
}

export interface CompositeSkillDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: SkillCategory;
  totalMpCost: number;
  cooldown?: number;
  blocks: EffectBlock[];
}
