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
   * 計算【漫天箭雨】弓兵齊射傷害 (支援受擊目標 PDEF 防禦減傷)
   * 基礎傷害：sqrt(count) * 32
   * 減傷公式：Raw * (100 / (100 + targetDef))
   */
  public static calculateVolleyFire(archerCount: number, targetDef: number = 0): number {
    const validCount = Math.max(0, archerCount || 0);
    if (validCount <= 0) return 0;
    const rawDmg = Math.max(15, Math.floor(Math.sqrt(validCount) * 32));
    if (targetDef <= 0) return rawDmg;
    return Math.max(1, Math.floor(rawDmg * (100 / (100 + targetDef))));
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
   * 計算【撞木衝車】破門撞擊與多台輪流交替機制
   * 物理合理性：城門窄小僅容一台衝車正面撞擊，多台衝車在陣前交替輪替以降低冷卻時間
   * 門檻：每台需步兵人數 ≥ 10 人 (N 台需 ≥ N*10 人)
   * 1 台：每 2 回合撞擊 1 次 (冷卻 1 回合)
   * 2 台：交替接力，每 1 回合無間斷連續撞擊 (0 CD)
   * 3 台：三台高速輪替，每回合撞擊且有 50% 機率觸發二次連鎖撞擊
   */
  public static calculateBatteringRamDamage(infantryCount: number): { canOperate: boolean; damage: number; reason?: string } {
    const res = this.calculateBatteringRamCycle(1, infantryCount, 1);
    return {
      canOperate: res.canOperate,
      damage: res.totalDamage,
      reason: res.reason
    };
  }

  public static calculateBatteringRamCycle(
    ramCount: number,
    infantryCount: number,
    turn: number
  ): { canOperate: boolean; willStrike: boolean; strikeCount: number; damagePerStrike: number; totalDamage: number; reason?: string } {
    const validRams = Math.max(0, ramCount || 0);
    const validInf = Math.max(0, infantryCount || 0);

    if (validRams <= 0) {
      return { canOperate: false, willStrike: false, strikeCount: 0, damagePerStrike: 0, totalDamage: 0 };
    }

    const reqInf = validRams * 10;
    if (validInf < reqInf) {
      return {
        canOperate: false,
        willStrike: true,
        strikeCount: 1,
        damagePerStrike: validInf * 5,
        totalDamage: validInf * 5,
        reason: `推車步兵不足 ${reqInf} 人 (現有 ${validInf} 人)，${validRams} 台巨型衝車原地癱瘓，步兵改以刀劍斧頭劈砍城門！`
      };
    }

    // 判斷本回合是否撞擊 (1 台隔回合撞，2台以上每回合撞)
    let willStrike = true;
    let strikeCount = 1;

    if (validRams === 1) {
      // 1 台衝車：第 1, 3, 5... 回合撞擊，偶數回合倒車蓄力重整
      willStrike = (turn % 2 === 1);
      if (!willStrike) {
        return {
          canOperate: true,
          willStrike: false,
          strikeCount: 0,
          damagePerStrike: 0,
          totalDamage: 0,
          reason: '1 號衝車正在倒車蓄力重新校準撞角，本回合待命蓄能！'
        };
      }
    } else if (validRams === 2) {
      // 2 台衝車：交替接力，每回合連續撞擊
      willStrike = true;
      strikeCount = 1;
    } else if (validRams >= 3) {
      // 3 台衝車：三台輪流衝撞，每回合 1 次且 50% 機率觸發二次連鎖撞擊
      willStrike = true;
      strikeCount = Math.random() < 0.5 ? 2 : 1;
    }

    const extraInfBonus = Math.max(0, validInf - reqInf) * 5;
    const damagePerStrike = 400 + extraInfBonus;
    const totalDamage = damagePerStrike * strikeCount;

    return {
      canOperate: true,
      willStrike,
      strikeCount,
      damagePerStrike,
      totalDamage
    };
  }

  /**
   * 計算【重型投石機】多台齊射與邊際遞減傷害
   * 遞減算式：第 1 台 100% (800)、第 2 台 70% (560)、第 3 台 49% (392)
   */
  public static calculateTrebuchetDamage(): { gateDamage: number; stunChance: number } {
    return this.calculateTrebuchetVolley(1);
  }

  public static calculateTrebuchetVolley(trebuchetCount: number): { gateDamage: number; stunChance: number; perEngineDamages: number[] } {
    const validCount = Math.max(0, trebuchetCount || 0);
    if (validCount <= 0) return { gateDamage: 0, stunChance: 0, perEngineDamages: [] };

    const baseDmg = 800;
    const perEngineDamages: number[] = [];
    let totalGateDmg = 0;

    for (let i = 0; i < validCount; i++) {
      const factor = Math.pow(0.7, i); // 1.0, 0.7, 0.49...
      const engineDmg = Math.round(baseDmg * factor);
      perEngineDamages.push(engineDmg);
      totalGateDmg += engineDmg;
    }

    return {
      gateDamage: totalGateDmg,
      stunChance: Math.min(0.95, 0.80 + (validCount - 1) * 0.08),
      perEngineDamages
    };
  }

  /**
   * 計算弓兵後排陣地生命力 (Rear-Guard HP Pool)
   * 每 1 名弓兵自帶 40 點生命力
   */
  public static calculateArcherRearHp(archerCount: number): number {
    return Math.max(0, (archerCount || 0) * 40);
  }

  /**
   * 根據剩餘陣地生命力計算生還弓兵數
   */
  public static calculateSurvivingArchers(remainingRearHp: number): number {
    return Math.max(0, Math.floor((remainingRearHp || 0) / 40));
  }

  /**
   * 計算【全軍鼓舞】領主自帶戰術加成
   * 本回合全體傷害 +15%、暴擊率 +10%
   */
  public static calculateInspireRally(): { dmgBonusPct: number; critBonusPct: number } {
    return { dmgBonusPct: 15, critBonusPct: 10 };
  }
}

/**
 * 攻城器械上限與天賦註冊提供者 (為未來爵位天賦樹方案 B/C 預留標準接口)
 */
export class SiegeEngineRegistry {
  public static getMaxLimit(
    type: import('../../models/types').SiegeEngineType,
    title?: NobleTitle,
    traits?: string[]
  ): number {
    let baseLimit = 3; // 基礎上限各 3 台

    // 未來爵位加成接口
    if (title === NobleTitle.DUKE) {
      baseLimit += 2;
    } else if (title === NobleTitle.MARQUIS || title === NobleTitle.COUNT) {
      baseLimit += 1;
    }

    // 未來天賦加成接口
    if (traits && traits.includes('siege_master')) {
      baseLimit += 1;
    }

    return baseLimit;
  }
}

