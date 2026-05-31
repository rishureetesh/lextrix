/** Lextron core — document editor shell. */
export { registerBlots } from './register-blots.js';
export { lxtPath, resolveImportKey, isBlotOrFormatPath } from './registry-paths.js';
export { default as Module } from './core/module.js';
export { default as Theme } from './core/theme.js';
export {
  default,
  default as Lextron,
  Dom,
  Range,
  expandConfig,
  globalRegistry,
  overload,
} from './core/lextron.js';
export type {
  Bounds,
  DebugLevel,
  EmitterSource,
  ExpandedLextronOptions,
  LextronOptions,
} from './core/lextron.js';
export type { ThemeOptions } from './core/theme.js';
