import { GameEventType, GameEventPayloads, GameEvent } from './GameEvents';

type EventHandler<T extends GameEventType> = (payload: GameEventPayloads[T]) => void;

export class EventBus {
  private static instance: EventBus;
  private listeners: { [K in GameEventType]?: EventHandler<K>[] } = {};

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe<T extends GameEventType>(eventType: T, handler: EventHandler<T>): void {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType]!.push(handler as any);
  }

  public unsubscribe<T extends GameEventType>(eventType: T, handler: EventHandler<T>): void {
    if (!this.listeners[eventType]) return;
    this.listeners[eventType] = this.listeners[eventType]!.filter(h => h !== handler) as any;
  }

  public publish<T extends GameEventType>(event: GameEvent<T>): void {
    const handlers = this.listeners[event.type];
    if (handlers) {
      handlers.forEach(handler => handler(event.payload));
    }
  }

  /**
   * 清除所有事件訂閱 (用於重新開局或讀檔時，防止重複訂閱造成事件觸發多次)
   */
  public clearAll(): void {
    this.listeners = {};
  }
}
