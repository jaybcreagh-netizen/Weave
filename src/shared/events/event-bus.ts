// shared/events/event-bus.ts
type EventHandler = (data: any) => void | Promise<void>;


export interface InteractionCreatedEvent {
  interactionId: string;
  friends: any[]; // Using any[] to avoid circular dependency with FriendModel for now, or import type if possible. 
  // Ideally we should use IDs or a lightweight DTO. 
  // But existing code passes full FriendModel.
  // Let's use any for now to break the cycle at the type level if needed, 
  // but better to import types if they are only types.
  data: any;
}

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
    // Execute all handlers
    // We don't await them to block the main flow if we want fire-and-forget, 
    // but the original plan said "async emit". 
    // Let's keep Promise.all to ensure we catch errors if needed or just wait for them.
    // However, for side effects, best to not block if not critical. 
    // The previous implementation used await Promise.all. I will stick to it.
    await Promise.all(handlers.map(h => h(data)));
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.handlers.get(event) || [];
    this.handlers.set(event, handlers.filter(h => h !== handler));
  }
}

export const eventBus = new EventBus();
export type { EventHandler };
