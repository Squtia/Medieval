import { NobleTitle } from '../../models/types';
import { CombatParticipant, StatusEffectType, StatusEffect } from '../../models/Combat';

export interface LordAuraConfig {
  name: string;
  description: string;
  statBonusPct: number;       // 基礎攻防百分比 (如 0.10 代表 +10%)
  mpRegenPerTurn: number;     // 每回合額外 MP 恢復
  dmgReductionPct: number;    // 傷害減免 (騎士/男爵天賦)
  critBonusPct: number;       // 暴擊加成
}

export interface LegionSkillEffect {
  type: 'SHIELD_WALL' | 'VOLLEY_FIRE' | 'CAVALRY_CHARGE';
  name: string;
  icon: string;
  cooldownTurns: number;
  description: string;
  minTroops: number;
}

export class LordCommanderSystem {
  /**
   * 取得領主當前爵位對應的親征光環效果
   * 支援日後爵位天賦系統無縫疊加
   */
  public static getLordAura(title: NobleTitle = NobleTitle.COMMONER): LordAuraConfig {
    let statBonusPct = 0.10;      // 基礎領主威嚴：全軍攻防 +10%
    let mpRegenPerTurn = 2;       // 每回合額外 +2 MP
    let dmgReductionPct = 0;
    let critBonusPct = 0;

    switch (title) {
      case NobleTitle.KNIGHT:
        dmgReductionPct = 0.05;   // 騎士：全軍 +5% 傷害減免
        break;
      case NobleTitle.BARON:
        dmgReductionPct = 0.05;
        critBonusPct = 5;         // 男爵：全軍 +5% 暴擊率
        statBonusPct = 0.12;
        break;
      case NobleTitle.VISCOUNT:
        dmgReductionPct = 0.08;
        critBonusPct = 8;
        statBonusPct = 0.14;
        mpRegenPerTurn = 3;
        break;
      case NobleTitle.COUNT:
        dmgReductionPct = 0.10;
        critBonusPct = 10;
        statBonusPct = 0.16;
        mpRegenPerTurn = 4;
        break;
      case NobleTitle.MARQUIS:
        dmgReductionPct = 0.12;
        critBonusPct = 12;
        statBonusPct = 0.18;
        mpRegenPerTurn = 4;
        break;
      case NobleTitle.DUKE:
        dmgReductionPct = 0.15;
        critBonusPct = 15;
        statBonusPct = 0.20;
        mpRegenPerTurn = 5;
        break;
    }

    return {
      name: '👑 領主威嚴 (Lord\'s Presence)',
      description: `全軍士氣高昂：攻防 +${Math.round(statBonusPct * 100)}%，每回合額外恢復 +${mpRegenPerTurn} MP${dmgReductionPct > 0 ? `，減傷 +${Math.round(dmgReductionPct * 100)}%` : ''}${critBonusPct > 0 ? `，暴擊 +${critBonusPct}%` : ''}`,
      statBonusPct,
      mpRegenPerTurn,
      dmgReductionPct,
      critBonusPct
    };
  }

  /**
   * 計算【鋼鐵盾牆】步兵護盾值與格擋加成
   * 1 名步兵提供 60 點全隊防禦護盾池
   */
  public static calculateShieldWall(infantryCount: number): { shieldHp: number; blockChanceBonus: number } {
    const validCount = Math.max(0, infantryCount || 0);
    const shieldHp = Math.floor(validCount * 60);
    const blockChanceBonus = validCount > 0 ? 30 : 0;
    return { shieldHp, blockChanceBonus };
  }

  /**
   * 計算【漫天箭雨】弓兵齊射傷害
   * 平滑對數曲線傷害：sqrt(count) * 32
   */
  public static calculateVolleyFire(archerCount: number): number {
    const validCount = Math.max(0, archerCount || 0);
    if (validCount <= 0) return 0;
    return Math.max(15, Math.floor(Math.sqrt(validCount) * 32));
  }

  /**
   * 計算【破陣衝鋒】騎兵突擊傷害與暈眩機率
   * 傷害：sqrt(count) * 45
   */
  public static calculateCavalryCharge(cavalryCount: number): { damage: number; stunChance: number } {
    const validCount = Math.max(0, cavalryCount || 0);
    if (validCount <= 0) return { damage: 0, stunChance: 0 };
    const damage = Math.max(20, Math.floor(Math.sqrt(validCount) * 45));
    // 兵力越多暈眩/破甲機率越高 (最高 75%)
    const stunChance = Math.min(0.75, 0.35 + validCount * 0.02);
    return { damage, stunChance };
  }

  /**
   * 計算【全軍鼓舞】領主自帶戰術加成
   * 本回合全體傷害 +15%、暴擊率 +10%
   */
  public static calculateInspireRally(): { dmgBonusPct: number; critBonusPct: number } {
    return { dmgBonusPct: 15, critBonusPct: 10 };
  }
}
