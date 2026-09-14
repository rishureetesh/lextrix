/** Lextrix core — document editor shell. */
import type Lextrix from '../core/lextrix.js';
import { lxrPath } from '../registry-paths.js';
import type {
  ClipboardModule,
  HistoryModule,
  KeyboardModule,
  ToolbarOptions,
  UploaderModule,
} from './contracts/modules.js';

export interface ThemeOptions {
  modules: Record<string, unknown> & {
    toolbar?: null | ToolbarOptions;
  };
}

class Theme {
  static DEFAULTS: ThemeOptions = {
    modules: {},
  };

  static themes = {
    default: Theme,
  };

  constructor(
    protected lextrix: Lextrix,
    protected options: ThemeOptions,
  ) {}

  /**
   * Legacy module map — reads from the canonical PluginHost.
   * @deprecated Prefer `lextrix.getModule(name)` / `lextrix.pluginHost`.
   */
  get modules(): Record<string, unknown> {
    return this.lextrix.pluginHost.asModuleRecord();
  }

  init() {
    Object.keys(this.options.modules).forEach((name) => {
      if (!this.lextrix.pluginHost.has(name)) {
        this.addModule(name);
      }
    });
  }

  addModule(name: 'clipboard'): ClipboardModule;
  addModule(name: 'keyboard'): KeyboardModule;
  addModule(name: 'uploader'): UploaderModule;
  addModule(name: 'history'): HistoryModule;
  addModule(name: string): unknown;
  addModule(name: string) {
    // @ts-expect-error dynamic import from registry
    const ModuleClass = this.lextrix.constructor.import(lxrPath.module(name));
    const instance = new ModuleClass(
      this.lextrix,
      this.options.modules[name] || {},
    );
    this.lextrix.pluginHost.register(name, instance);
    return instance;
  }
}

export interface ThemeConstructor {
  new (lextrix: Lextrix, options: unknown): Theme;
  DEFAULTS: ThemeOptions;
}

export default Theme;
