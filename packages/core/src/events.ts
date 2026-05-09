export type EventHandler<TPayload> = (payload: TPayload) => void;

export type EventMap = Record<string, unknown>;

export interface EventBus<TEvents extends EventMap = EventMap> {
  on<K extends keyof TEvents & string>(name: K, handler: EventHandler<TEvents[K]>): () => void;
  off<K extends keyof TEvents & string>(name: K, handler: EventHandler<TEvents[K]>): boolean;
  emit<K extends keyof TEvents & string>(name: K, payload: TEvents[K]): void;
}

export function createEventBus<TEvents extends EventMap = EventMap>(): EventBus<TEvents> {
  const handlers = new Map<string, Set<EventHandler<unknown>>>();

  function on<K extends keyof TEvents & string>(
    name: K,
    handler: EventHandler<TEvents[K]>,
  ): () => void {
    let set = handlers.get(name);
    if (!set) {
      set = new Set();
      handlers.set(name, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => {
      off(name, handler);
    };
  }

  function off<K extends keyof TEvents & string>(
    name: K,
    handler: EventHandler<TEvents[K]>,
  ): boolean {
    const set = handlers.get(name);
    if (!set) return false;
    const removed = set.delete(handler as EventHandler<unknown>);
    if (set.size === 0) handlers.delete(name);
    return removed;
  }

  function emit<K extends keyof TEvents & string>(name: K, payload: TEvents[K]): void {
    const set = handlers.get(name);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        (handler as EventHandler<TEvents[K]>)(payload);
      } catch (err) {
        console.error(`[playerstack] handler for "${name}" threw:`, err);
      }
    }
  }

  return { on, off, emit };
}
