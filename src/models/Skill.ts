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

export interface Skill {
  id: string;
  name: string;
  mpCost: number;
  targetType: TargetType;
  description: string;
  cooldown?: number;
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
