import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';

export class HeroSystem {
  constructor() {
    const eventBus = EventBus.getInstance();

    // OPT-01: 監聽戰鬥勝利，給予英雄經驗値
    eventBus.subscribe(GameEventType.COMBAT_FINISHED, (payload) => {
      if (payload.isVictory) {
        const xpReward = payload.xpReward ?? Math.max(10, Math.floor(payload.lootValue * 2));
        GameState.adventurers
          .filter(a => payload.participants.includes(a.id))
          .forEach(a => {
            a.gainXP(xpReward);
            console.log(`[HeroSystem] 🌟 ${a.name} 獲得了 ${xpReward} 點經驗値！（當前Lv.${a.level}）`);
          });
      } else {
        // 失敗時給予少量安慰經驗
        const xpConsolation = 5;
        GameState.adventurers
          .filter(a => payload.participants.includes(a.id))
          .forEach(a => a.gainXP(xpConsolation));
        console.log(`[HeroSystem] 戰鬥失敗...英雄們需要休養。`);
      }
    });

    // 監聽英雄死亡
    eventBus.subscribe(GameEventType.HERO_DIED, (payload) => {
      console.log(`[HeroSystem] 英雄 ${payload.heroId} 因為 ${payload.reason} 陣亡了。`);
    });
  }
}
