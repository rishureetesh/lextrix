/** Lextrix core — document editor shell. */
import type Lextrix from '../core/lextrix.js';
import { lxrPath } from '../registry-paths.js';
import type Clipboard from 'lextrix-modules/modules/clipboard.js';
import type History from 'lextrix-modules/modules/history.js';
import type Keyboard from 'lextrix-modules/modules/keyboard.js';
import type { ToolbarProps } from 'lextrix-modules/modules/toolbar.js';
import type Uploader from 'lextrix-modules/modules/uploader.js';

export interface ThemeOptions {
  modules: Record<string, unknown> & {
    toolbar?: null | ToolbarProps;
  };
}

class Theme {
  static DEFAULTS: ThemeOptions = {
    modules: {},
  };

  static themes = {
    default: Theme,
  };

  modules: ThemeOptions['modules'] = {};

  constructor(
    protected lextrix: Lextrix,
    protected options: ThemeOptions,
  ) {}

  init() {
    Object.keys(this.options.modules).forEach((name) => {
      if (this.modules[name] == null) {
        this.addModule(name);
      }
    });
  }

  addModule(name: 'clipboard'): Clipboard;
  addModule(name: 'keyboard'): Keyboard;
  addModule(name: 'uploader'): Uploader;
  addModule(name: 'history'): History;
  addModule(name: string): unknown;
  addModule(name: string) {
    // @ts-expect-error
    const ModuleClass = this.lextrix.constructor.import(lxrPath.module(name));
    this.modules[name] = new ModuleClass(
      this.lextrix,
      this.options.modules[name] || {},
    );
    return this.modules[name];
  }
}

export interface ThemeConstructor {
  new (lextrix: Lextrix, options: unknown): Theme;
  DEFAULTS: ThemeOptions;
}

export default Theme;
