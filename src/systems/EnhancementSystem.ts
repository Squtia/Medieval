import { Equipment, CombatStats } from '../models/types';
import { Territory } from '../models/Territory';
import { Random } from '../core/Random';

export class EnhancementSystem {
  /**
   * 強化費用 (每級增加 100 金幣)
   */
  public static getEnhancementCost(currentLevel: number): number {
    return 100 + (currentLevel * 100);
  }

  /**
   * 取得強化成功率 (百分比)
   * +0 ~ +2: 100%
   * +3 ~ +5: 80%
   * +6 ~ +9: 40%
   */
  public static getSuccessRate(currentLevel: number): number {
    if (currentLevel <= 2) return 100;
    if (currentLevel <= 5) return 80;
    return 40;
  }

  /**
   * 確保裝備儲存原始基底屬性並套用特定強化等級的戰鬥屬性
   */
  public static applyEnhancementLevel(eq: Equipment, targetLevel: number): void {
    eq.enhancementLevel = targetLevel;

    // 確保擁有原始基底屬性紀錄 (只會記錄一次，不會被強化累積污染)
    if (!eq.baseCombatEffects) {
      eq.baseCombatEffects = JSON.parse(JSON.stringify(eq.combatEffects || {}));
    }

    if (!eq.combatEffects) {
      eq.combatEffects = {};
    }

    const base = eq.baseCombatEffects!;
    const mult = 1 + (0.10 * targetLevel); // 每級絕對增加 10% 原始基底

    for (const key in base) {
      const k = key as keyof CombatStats;
      const baseVal = base[k];
      if (typeof baseVal === 'number') {
        eq.combatEffects[k] = Math.round(baseVal * mult);
      }
    }
  }

  /**
   * 執行裝備強化
   * @param territory 玩家領地 (用於扣除金幣)
   * @param eq 目標裝備
   * @returns 強化結果字串，用於日誌顯示
   */
  public static enhance(territory: Territory, eq: Equipment): string {
    const currentLevel = eq.enhancementLevel || 0;
    
    if (currentLevel >= 10) {
      return `⚠️ 【${eq.name}】已達到強化上限 (+10)！`;
    }

    const cost = this.getEnhancementCost(currentLevel);
    if (territory.gold < cost) {
      return `⚠️ 金幣不足！強化需要 ${cost} 金幣。`;
    }

    // 扣除費用
    territory.gold -= cost;
    
    const successRate = this.getSuccessRate(currentLevel);
    const roll = Random.next() * 100;
    const isSuccess = roll <= successRate;

    if (isSuccess) {
      this.applyEnhancementLevel(eq, currentLevel + 1);
      return `✨ 強化成功！【${eq.name}】提升至 +${eq.enhancementLevel}！ (花費 ${cost} 金幣)`;
    } else {
      // 強化失敗
      let penaltyMsg = '';
      if (currentLevel >= 6) {
        this.applyEnhancementLevel(eq, currentLevel - 1);
        penaltyMsg = `並且受到懲罰退階至 +${eq.enhancementLevel}！`;
      } else {
        this.applyEnhancementLevel(eq, currentLevel);
      }
      return `💥 強化失敗！【${eq.name}】維持 +${eq.enhancementLevel}。${penaltyMsg} (花費 ${cost} 金幣)`;
    }
  }
}
