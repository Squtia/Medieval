import { GAME_EVENTS, GameEvent } from '../data/EventData';
import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';
import { GameEventType } from '../core/GameEvents';
import { Random } from '../core/Random';

export class EventSystem {
  /**
   * 嘗試觸發隨機事件或更新潛伏期 (每次時間推進/迴圈時呼叫)
   */
  public static triggerRandomEvent(): void {
    const territory = GameState.myTerritory;
    if (!territory) return;

    // Backward compatibility initialization
    if (!territory.lastEventTriggerDay) territory.lastEventTriggerDay = {};
    if (!territory.triggeredUniqueEvents) territory.triggeredUniqueEvents = [];
    if (!territory.activeOmens) territory.activeOmens = {};

    const currentDay = GameState.totalDays;

    // 1. 處理現有潛伏期 (Omens)
    for (const [eventId, omen] of Object.entries(territory.activeOmens)) {
      const evt = GAME_EVENTS.find(e => e.id === eventId);
      if (!evt) {
        delete territory.activeOmens[eventId];
        continue;
      }
      
      // 檢查是否依然滿足條件
      if (evt.condition()) {
        // 若條件持續滿足且潛伏期滿，觸發事件
        if (currentDay >= omen.triggerDay) {
          this.executeEvent(evt);
          delete territory.activeOmens[eventId];
        }
      } else {
        // 條件不滿足 (保暖成功)，解除危機
        console.log(`[系統] 危機解除：${evt.title} 的徵兆已經消失。`);
        delete territory.activeOmens[eventId];
      }
    }

    // 2. 觸發新徵兆/事件
    const validEvents = GAME_EVENTS.filter(evt => {
      // 排除已發生過的 Unique 事件
      if (evt.isUnique && territory.triggeredUniqueEvents.includes(evt.id)) return false;
      
      // 排除在冷卻期內的事件
      if (evt.cooldownDays && territory.lastEventTriggerDay[evt.id] !== undefined) {
        if (currentDay - territory.lastEventTriggerDay[evt.id] < evt.cooldownDays) {
          return false;
        }
      }
      
      // 排除已在潛伏期內的事件
      if (territory.activeOmens[evt.id]) return false;
      
      // 排除已在待辦事項的事件
      if (!evt.isImportant && territory.pendingEvents.includes(evt.id)) return false;

      // 檢查條件
      return evt.condition();
    });

    if (validEvents.length > 0) {
      // 隨機挑選 1 個符合條件的來進入潛伏或觸發，避免同一天觸發太多事件
      const chosenEvent = Random.pick(validEvents);

      if (chosenEvent.omenDuration && chosenEvent.omenDuration > 0) {
        // 進入潛伏期
        territory.activeOmens[chosenEvent.id] = {
          triggerDay: currentDay + chosenEvent.omenDuration,
          text: chosenEvent.omenText || `未知的危機即將降臨...`
        };
        console.log(`[系統] ⚠️ 徵兆出現：${territory.activeOmens[chosenEvent.id].text}`);
      } else {
        // 直接爆發
        this.executeEvent(chosenEvent);
      }
    }
  }

  private static executeEvent(evt: GameEvent): void {
    const territory = GameState.myTerritory;
    
    // 記錄觸發狀態
    if (evt.isUnique) territory.triggeredUniqueEvents.push(evt.id);
    territory.lastEventTriggerDay[evt.id] = GameState.totalDays;

    if (evt.isImportant) {
      // 重要事件：直接跳出視窗
      EventBus.getInstance().publish({
        type: GameEventType.GAME_EVENT_TRIGGERED,
        payload: { eventId: evt.id }
      });
    } else {
      // 普通事件：加入待辦事項
      if (!territory.pendingEvents.includes(evt.id)) {
        territory.pendingEvents.push(evt.id);
        console.log(`[系統] 📝 新的待辦事項：【${evt.title}】已經送達您的據點。`);
        EventBus.getInstance().publish({
          type: GameEventType.RESOURCE_CHANGED,
          payload: { resourceType: 'PENDING_EVENTS', amount: 1, currentTotal: territory.pendingEvents.length }
        });
      }
    }
  }
}
