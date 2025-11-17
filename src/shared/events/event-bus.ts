// shared/events/event-bus.ts
type EventHandler = (data: any) => void | Promise<void>;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  async emit(event: string, data: any) {
    const handlers = this.handlers.get(event) || [];
    await Promise.all(handlers.map(h => h(data)));
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.handlers.get(event) || [];
    this.handlers.set(event, handlers.filter(h => h !== handler));
  }
}

export const eventBus = new EventBus();
export type { EventHandler };
