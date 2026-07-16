import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';

export class CombatSystem {
  constructor() {
    const eventBus = EventBus.getInstance();

    // 監聽戰鬥請求
    eventBus.subscribe(GameEventType.COMBAT_REQUESTED, (payload) => {
      console.log(`[CombatSystem] 收到戰鬥請求！發起者: [${payload.attackerIds.join(', ')}], 目標: ${payload.targetId}`);
      
      // 這裡應該會有非同步的戰鬥計算邏輯...
      // 模擬戰鬥結果並發佈事件
      setTimeout(() => {
        const isVictory = Math.random() > 0.5; // 50% 勝率模擬
        eventBus.publish({
          type: GameEventType.COMBAT_FINISHED,
          payload: {
            isVictory,
            participants: payload.attackerIds,
            lootValue: isVictory ? 100 : 0,
            battleLog: isVictory ? '我方以壓倒性優勢獲勝！' : '敵軍火力太強，我方撤退。'
          }
        });
      }, 1000);
    });
  }
}
