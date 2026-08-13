import { GameEventType, GameEventPayloads, GameEvent } from './GameEvents';

type EventHandler<T extends GameEventType> = (payload: GameEventPayloads[T]) => void;

interface Subscription<T extends GameEventType> {
  handler: EventHandler<T>;
  scope: string;
}

export class EventBus {
  private static instance: EventBus;
  private listeners: { [K in GameEventType]?: Subscription<K>[] } = {};

  private constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public subscribe<T extends GameEventType>(eventType: T, handler: EventHandler<T>, scope: string = 'system'): () => void {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType]!.push({ handler: handler as any, scope });
    return () => this.unsubscribe(eventType, handler);
  }

  public unsubscribe<T extends GameEventType>(eventType: T, handler: EventHandler<T>): void {
    if (!this.listeners[eventType]) return;
    this.listeners[eventType] = this.listeners[eventType]!.filter(sub => sub.handler !== handler) as any;
  }

  public publish<T extends GameEventType>(event: GameEvent<T>): void {
    const handlers = this.listeners[event.type];
    if (handlers) {
      handlers.forEach(sub => sub.handler(event.payload));
    }
  }

  /**
   * 清除特定 scope 的事件訂閱 (預設為 'system')
   * 用於重新開局或讀檔時，防止系統事件重複訂閱，同時保留 'ui' 相關的訂閱
   */
  public clearAll(scope: string = 'system'): void {
    for (const key in this.listeners) {
      const eventType = key as GameEventType;
      if (this.listeners[eventType]) {
        this.listeners[eventType] = this.listeners[eventType]!.filter(sub => sub.scope !== scope) as any;
      }
    }
  }
}
