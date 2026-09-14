/** Canonical lifecycle owner for editor plugins/modules. */
import type Lextrix from '../lextrix.js';

/** Contract for Lextrix editor plugins (Interface Segregation + lifecycle). */
export interface LextrixPlugin<TOptions extends object = object> {
  readonly id?: string;
  readonly options: Partial<TOptions>;
  bindEditor(editor: Lextrix): void;
  unbindEditor?(editor: Lextrix): void;
  /** Release DOM listeners, emitter subscriptions, and owned UI. */
  destroy?(): void;
}

export type PluginConstructor<T extends object = object> = new (
  editor: Lextrix,
  options?: Partial<T>,
) => LextrixPlugin<T>;

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

  /** @deprecated Prefer PluginHost.get / entries — kept for legacy theme.modules. */
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

  /**
   * Tear down every registered plugin. Prefer this over name-based special cases
   * on the Lextrix facade (Single Responsibility: host owns plugin lifecycle).
   */
  destroyAll(editor: Lextrix): void {
    for (const plugin of this.plugins.values()) {
      try {
        if (typeof plugin.destroy === 'function') {
          plugin.destroy();
        } else {
          plugin.unbindEditor?.(editor);
        }
      } catch {
        // Continue tearing down remaining plugins.
      }
    }
    this.plugins.clear();
  }
}

export default PluginHost;
