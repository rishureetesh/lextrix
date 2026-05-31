import Lextron, { registerBlots } from 'lextron-core';
import { registerCoreModules } from 'lextron-modules';
import { ChangeAttributes, ChangeIterator, ChangeSet } from 'lextron-change';

export { default as Module } from 'lextron-core/core/module.js';
export type {
  Bounds,
  DebugLevel,
  EmitterSource,
  ExpandedLextronOptions,
  LextronOptions,
} from 'lextron-core';
export { ChangeAttributes, ChangeIterator, ChangeSet };
export type { ChangeOp } from 'lextron-change';

registerBlots(Lextron);
registerCoreModules(Lextron);

export default Lextron;
