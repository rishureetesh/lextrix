import type { LextrixPlugin } from './plugins/plugin-host.js';

/** Base class for editor plugins. */
abstract class Module<T extends object = object> implements LextrixPlugin<T> {
  static DEFAULTS = {};

  readonly lextrix;
  readonly options: Partial<T>;

  constructor(lextrix: import('./lextrix.js').default, options: Partial<T> = {}) {
    this.lextrix = lextrix;
    this.options = options;
  }

  get id(): string {
    return this.constructor.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  bindEditor(_editor: import('./lextrix.js').default): void {
    // Modules self-register in constructors; bindEditor reserved for explicit lifecycle.
  }
}

export default Module;
