import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';

export class HeroSystem {
  constructor() {
    const eventBus = EventBus.getInstance();

    // 監聽戰鬥勝利，給予英雄經驗值
    eventBus.subscribe(GameEventType.COMBAT_FINISHED, (payload) => {
      if (payload.isVictory) {
        console.log(`[HeroSystem] 戰鬥勝利！參與的英雄 [${payload.participants.join(', ')}] 準備獲得經驗值...`);
      } else {
        console.log(`[HeroSystem] 戰鬥失敗...英雄們需要休養。`);
      }
    });

    // 監聽英雄死亡
    eventBus.subscribe(GameEventType.HERO_DIED, (payload) => {
      console.log(`[HeroSystem] 英雄 ${payload.heroId} 因為 ${payload.reason} 陣亡了。`);
    });
  }
}
