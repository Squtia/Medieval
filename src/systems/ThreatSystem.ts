import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { GameState } from '../core/GameState';
import { Random } from '../core/Random';

export class ThreatSystem {
  constructor() {
    const eventBus = EventBus.getInstance();

    // 監聽天數流逝推動災難倒數
    eventBus.subscribe(GameEventType.DAY_PASSED, (payload) => {
      const threat = GameState.threat;
      threat.daysRemaining--;
      // 倒數資訊僅供 debug，不顯示在遊戲日誌中

      if (threat.daysRemaining <= 3 && threat.daysRemaining > 0 && !threat.warningIssued) {
        threat.warningIssued = true;
        eventBus.publish({
          type: GameEventType.THREAT_WARNING,
          payload: { threatName: threat.name, daysRemaining: threat.daysRemaining, severity: threat.severity }
        });
      }

      if (threat.daysRemaining <= 0) {
        // 觸發災難
        eventBus.publish({
          type: GameEventType.THREAT_ARRIVED,
          payload: {
            threatName: threat.name,
            severity: threat.severity
          }
        });
        
        // 重置倒數
        threat.daysRemaining = Random.int(15, 25);
        threat.warningIssued = false;
        threat.prepared = false;
      }
    });
  }
}
