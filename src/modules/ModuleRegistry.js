const DEFAULT_MODULES = Object.freeze([
  { id: 'rides', title: 'Ritten' },
  { id: 'time', title: 'Tijd / Taken' },
  { id: 'locations', title: 'Locaties' },
  { id: 'actions', title: 'Acties' },
  { id: 'cards', title: 'Kaarten' },
  { id: 'themes', title: "Thema's" }
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
