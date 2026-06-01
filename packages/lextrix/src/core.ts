import Lextrix, { registerBlots } from 'lextrix-core';
import { registerCoreModules } from 'lextrix-modules';
import { ChangeAttributes, ChangeIterator, ChangeSet } from 'lextrix-change';

export { default as Module } from 'lextrix-core/core/module.js';
export type {
  Bounds,
  DebugLevel,
  EmitterSource,
  ExpandedLextrixOptions,
  LextrixOptions,
} from 'lextrix-core';
export { ChangeAttributes, ChangeIterator, ChangeSet };
export type { ChangeOp } from 'lextrix-change';

registerBlots(Lextrix);
registerCoreModules(Lextrix);

export default Lextrix;
