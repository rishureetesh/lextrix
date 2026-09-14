/**
 * Single extension protocol over Lextrix path registration (Open/Closed).
 * Prefer these helpers over raw Lextrix.register(path, target) for new code.
 */
import type Lextrix from './lextrix.js';
import { lxrPath } from '../registry-paths.js';

type LextrixCtor = typeof Lextrix;

export const ExtensionHost = {
  registerFormat(
    LextrixClass: LextrixCtor,
    name: string,
    target: unknown,
    overwrite = false,
  ): void {
    LextrixClass.register(lxrPath.format(name), target, overwrite);
  },

  registerModule(
    LextrixClass: LextrixCtor,
    name: string,
    target: unknown,
    overwrite = false,
  ): void {
    LextrixClass.register(lxrPath.module(name), target, overwrite);
  },

  registerTheme(
    LextrixClass: LextrixCtor,
    name: string,
    target: unknown,
    overwrite = false,
  ): void {
    LextrixClass.register(lxrPath.theme(name), target, overwrite);
  },

  registerAttributor(
    LextrixClass: LextrixCtor,
    scope: string,
    name: string,
    target: unknown,
    overwrite = false,
  ): void {
    LextrixClass.register(lxrPath.attributor(scope, name), target, overwrite);
  },
} as const;

export default ExtensionHost;
