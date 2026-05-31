/** Lextron core — document editor shell. */
import type Lextron from './lextron.js';

abstract class Module<T extends {} = {}> {
  static DEFAULTS = {};

  readonly lextron: Lextron;
  protected options: Partial<T>;

  constructor(lextron: Lextron, options: Partial<T> = {}) {
    this.lextron = lextron;
    this.options = options;
  }
}

export default Module;
