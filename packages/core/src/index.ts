/** Lextrix core — document editor shell. */
export { registerBlots } from './register-blots.js';
export { lxrPath, resolveImportKey, isBlotOrFormatPath } from './registry-paths.js';
export { default as Module } from './core/module.js';
export { default as Theme } from './core/theme.js';
export {
  default,
  default as Lextrix,
  Dom,
  Range,
  expandConfig,
  globalRegistry,
  overload,
} from './core/lextrix.js';
export type {
  Bounds,
  DebugLevel,
  EmitterSource,
  ExpandedLextrixOptions,
  LextrixOptions,
} from './core/lextrix.js';
export type { ThemeOptions } from './core/theme.js';
