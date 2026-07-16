import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';

export class ThreatSystem {
  private daysUntilNextThreat = 10; // 預設 10 天後發生災難

  constructor() {
    const eventBus = EventBus.getInstance();

    // 監聽天數流逝推動災難倒數
    eventBus.subscribe(GameEventType.DAY_PASSED, (payload) => {
      this.daysUntilNextThreat--;
      console.log(`[ThreatSystem] 距離下一次災難還有 ${this.daysUntilNextThreat} 天...`);

      if (this.daysUntilNextThreat <= 0) {
        // 觸發災難
        eventBus.publish({
          type: GameEventType.THREAT_ARRIVED,
          payload: {
            threatName: '凜冬寒流',
            severity: 5
          }
        });
        
        // 重置倒數
        this.daysUntilNextThreat = Math.floor(Math.random() * 10) + 15; // 15~25天
      }
    });
  }
}
