export enum GambitConditionType {
  ALWAYS = 'ALWAYS',
  SELF_HP_BELOW_X = 'SELF_HP_BELOW_X',
  ALLY_HP_BELOW_X = 'ALLY_HP_BELOW_X',
  ENEMY_HP_BELOW_X = 'ENEMY_HP_BELOW_X',
  ENEMY_HP_ABOVE_X = 'ENEMY_HP_ABOVE_X',
  ENEMY_FRONT_ROW = 'ENEMY_FRONT_ROW',
  ENEMY_BACK_ROW = 'ENEMY_BACK_ROW',
  ENEMY_HAS_DEBUFF = 'ENEMY_HAS_DEBUFF',
  ALLY_HAS_DEBUFF = 'ALLY_HAS_DEBUFF',
}

export interface GambitRule {
  isActive: boolean;
  conditionType: GambitConditionType;
  conditionValue?: number | string; // e.g. 30 for 30%, or 'ARMOR_BREAK'
  actionSkillId: string; // The skill to use, e.g. 'FIGHTER_ARMOR_BREAK' or 'DEFAULT_ATTACK'
}

export const GAMBIT_CONDITION_LABELS: Record<GambitConditionType, string> = {
  [GambitConditionType.ALWAYS]: '無條件',
  [GambitConditionType.SELF_HP_BELOW_X]: '自身 HP < X%',
  [GambitConditionType.ALLY_HP_BELOW_X]: '隊友 HP < X%',
  [GambitConditionType.ENEMY_HP_BELOW_X]: '敵方 HP < X%',
  [GambitConditionType.ENEMY_HP_ABOVE_X]: '敵方 HP > X%',
  [GambitConditionType.ENEMY_FRONT_ROW]: '目標為敵方前排',
  [GambitConditionType.ENEMY_BACK_ROW]: '目標為敵方後排',
  [GambitConditionType.ENEMY_HAS_DEBUFF]: '敵方有特定負面狀態',
  [GambitConditionType.ALLY_HAS_DEBUFF]: '隊友有負面狀態',
};
