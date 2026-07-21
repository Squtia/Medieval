import { GAME_EVENTS } from '../data/EventData';
import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { Random } from '../core/Random';

export class EventSystem {
  /**
   * 嘗試觸發隨機事件 (每次時間推進/迴圈時呼叫)
   */
  public static triggerRandomEvent(): void {
    const territory = GameState.myTerritory;
    if (!territory) return;

    // 計算這回合增加的壓力值 (基礎 10 + 聲望加成 + 冒險者數量加成)
    const pressureGain = 10 + (territory.prestige * 0.05) + (GameState.adventurers.length * 2);
    territory.eventPressure += pressureGain;

    // BAL-03: 將觸發門滿提高至 200，避免玉家中後期被事件轟炸
    if (territory.eventPressure >= 200) {
      // 篩選出符合條件的事件
      const validEvents = GAME_EVENTS.filter(evt =>
        evt.condition() && (evt.isImportant || !territory.pendingEvents.includes(evt.id))
      );
      
      if (validEvents.length > 0) {
        // 隨機挑選一個符合條件的事件
        const chosenEvent = Random.pick(validEvents);
        
        if (chosenEvent.isImportant) {
          // 重要事件：直接跳出視窗
          EventBus.getInstance().publish({
            type: GameEventType.GAME_EVENT_TRIGGERED,
            payload: { eventId: chosenEvent.id }
          });
        } else {
          // 普通事件：加入待辦事項
          if (!territory.pendingEvents.includes(chosenEvent.id)) {
            territory.pendingEvents.push(chosenEvent.id);
            console.log(`[系統] 📝 新的待辦事項：【${chosenEvent.title}】已經送達您的據點。`);
            EventBus.getInstance().publish({
              type: GameEventType.RESOURCE_CHANGED,
              payload: { resourceType: 'PENDING_EVENTS', amount: 1, currentTotal: territory.pendingEvents.length }
            });
          }
        }
        // 只有實際排入事件後才重置，避免暫時沒有合法事件時白白清空進度。
        territory.eventPressure = 0;
      } else {
        // 保留已累積的門檻，條件一旦成立便可在下個回合觸發。
        territory.eventPressure = 200;
      }
    }
  }
}
