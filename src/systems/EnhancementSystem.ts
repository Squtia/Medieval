import { Equipment } from '../models/types';
import { Territory } from '../models/Territory';

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
    const roll = Math.random() * 100;
    const isSuccess = roll <= successRate;

    if (isSuccess) {
      eq.enhancementLevel = currentLevel + 1;
      
      // 強化成功，基礎戰鬥數值提升 (假設每級提升 10%)
      if (eq.combatEffects) {
        for (const key in eq.combatEffects) {
          const statKey = key as keyof typeof eq.combatEffects;
          if (eq.combatEffects[statKey]) {
            eq.combatEffects[statKey]! += Math.ceil(eq.combatEffects[statKey]! * 0.1);
          }
        }
      }

      return `✨ 強化成功！【${eq.name}】提升至 +${eq.enhancementLevel}！ (花費 ${cost} 金幣)`;
    } else {
      // 強化失敗
      let penaltyMsg = '';
      if (currentLevel >= 6) {
        eq.enhancementLevel = currentLevel - 1;
        penaltyMsg = `並且受到懲罰退階至 +${eq.enhancementLevel}！`;
      }
      return `💥 強化失敗！【${eq.name}】維持 +${currentLevel}。${penaltyMsg} (花費 ${cost} 金幣)`;
    }
  }
}
