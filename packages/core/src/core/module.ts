/** Lextrix core — document editor shell. */
import type Lextrix from './lextrix.js';

abstract class Module<T extends {} = {}> {
  static DEFAULTS = {};

  readonly lextrix: Lextrix;
  protected options: Partial<T>;

  constructor(lextrix: Lextrix, options: Partial<T> = {}) {
    this.lextrix = lextrix;
    this.options = options;
  }
}

export default Module;
