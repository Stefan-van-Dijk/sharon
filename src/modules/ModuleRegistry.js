const DEFAULT_MODULES = Object.freeze([
  { id: 'rides', title: 'Ritten', icon: '🚗' },
  { id: 'time', title: 'Tijd / Taken', icon: '📋' },
  { id: 'locations', title: 'Locaties', icon: '⌖' },
  { id: 'actions', title: 'Acties', icon: '⚡' },
  { id: 'cards', title: 'Kaarten', icon: '▣' },
  { id: 'themes', title: "Thema's", icon: '◈' }
]);

export class ModuleRegistry {
  #context;
  #modules = new Map();

  constructor(context) {
    this.#context = context;
  }

  async registerDefaults() {
    for (const module of DEFAULT_MODULES) {
      this.#modules.set(module.id, Object.freeze({ ...module }));
      this.#context.events.emit('module.ready', { id: module.id });
    }
  }

  list() {
    return [...this.#modules.values()];
  }

  get(id) {
    return this.#modules.get(id) ?? null;
  }
}
