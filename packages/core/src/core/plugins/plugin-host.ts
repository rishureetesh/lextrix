import type Lextrix from '../lextrix.js';

/** Contract for Lextrix editor plugins. */
export interface LextrixPlugin<TOptions extends object = object> {
  readonly id?: string;
  readonly options: Partial<TOptions>;
  bindEditor(editor: Lextrix): void;
  unbindEditor?(editor: Lextrix): void;
}

export type PluginConstructor<T extends object = object> = new (
  editor: Lextrix,
  options?: Partial<T>,
) => LextrixPlugin<T>;

/** Canonical lifecycle owner for editor plugins/modules. */
export class PluginHost {
  private readonly plugins = new Map<string, LextrixPlugin>();

  register(id: string, plugin: LextrixPlugin): LextrixPlugin {
    this.plugins.set(id, plugin);
    return plugin;
  }

  get<T extends LextrixPlugin = LextrixPlugin>(id: string): T | undefined {
    return this.plugins.get(id) as T | undefined;
  }

  has(id: string): boolean {
    return this.plugins.has(id);
  }

  entries(): Array<[string, LextrixPlugin]> {
    return [...this.plugins.entries()];
  }

  /** Compatibility view for legacy `theme.modules` consumers. */
  asModuleRecord(): Record<string, LextrixPlugin> {
    return Object.fromEntries(this.plugins);
  }

  bindAll(editor: Lextrix): void {
    for (const plugin of this.plugins.values()) {
      plugin.bindEditor(editor);
    }
  }

  unbindAll(editor: Lextrix): void {
    for (const plugin of this.plugins.values()) {
      plugin.unbindEditor?.(editor);
    }
  }
}

export default PluginHost;
