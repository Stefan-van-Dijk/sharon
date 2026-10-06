export class EventBus {
  #listeners = new Map();

  on(type, listener) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
    this.#listeners.get(type).add(listener);
    return () => this.#listeners.get(type)?.delete(listener);
  }

  emit(type, detail = {}) {
    const event = Object.freeze({ type, detail, at: Date.now() });
    for (const listener of this.#listeners.get(type) ?? []) {
      try {
        listener(event);
      } catch (error) {
        console.error(error);
      }
    }
    return event;
  }
}
