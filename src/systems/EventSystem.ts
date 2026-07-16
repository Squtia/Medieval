import { GameEvent, GAME_EVENTS } from '../data/EventData';
import { openEventModal } from '../ui/ModalController';
import { GameState } from '../core/GameState';
import { UIManager } from '../ui/UIManager';

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

    // 當壓力值達標時，嘗試觸發事件
    if (territory.eventPressure >= 100) {
      // 篩選出符合條件的事件
      const validEvents = GAME_EVENTS.filter(evt => evt.condition());
      
      if (validEvents.length > 0) {
        // 隨機挑選一個符合條件的事件
        const chosenEvent = validEvents[Math.floor(Math.random() * validEvents.length)];
        
        if (chosenEvent.isImportant) {
          // 重要事件：直接跳出視窗
          openEventModal(chosenEvent);
        } else {
          // 普通事件：加入待辦事項
          if (!territory.pendingEvents.includes(chosenEvent.id)) {
            territory.pendingEvents.push(chosenEvent.id);
            console.log(`[系統] 📝 新的待辦事項：【${chosenEvent.title}】已經送達您的據點。`);
            UIManager.updateUI(); // 觸發 UI 更新以顯示提示
          }
        }
      }

      // 重置壓力值
      territory.eventPressure = 0;
    }
  }
}
