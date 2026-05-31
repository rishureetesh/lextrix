/** Lextron core — document editor shell. */
import type Lextron from '../core/lextron.js';
import { lxtPath } from '../registry-paths.js';
import type Clipboard from 'lextron-modules/modules/clipboard.js';
import type History from 'lextron-modules/modules/history.js';
import type Keyboard from 'lextron-modules/modules/keyboard.js';
import type { ToolbarProps } from 'lextron-modules/modules/toolbar.js';
import type Uploader from 'lextron-modules/modules/uploader.js';

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
    protected lextron: Lextron,
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
    const ModuleClass = this.lextron.constructor.import(lxtPath.module(name));
    this.modules[name] = new ModuleClass(
      this.lextron,
      this.options.modules[name] || {},
    );
    return this.modules[name];
  }
}

export interface ThemeConstructor {
  new (lextron: Lextron, options: unknown): Theme;
  DEFAULTS: ThemeOptions;
}

export default Theme;
