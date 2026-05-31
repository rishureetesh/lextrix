import Lextron, { Dom, Range, registerBlots } from 'lextron-core';
import { registerFormats } from 'lextron-formats';
import { registerModules } from 'lextron-modules';
import { registerUI } from 'lextron-ui';
import { registerThemes } from 'lextron-themes';
import {
  ChangeAttributes,
  ChangeIterator,
  ChangeOp,
  ChangeSet,
} from 'lextron-change';

export { default as Module } from 'lextron-core/core/module.js';
export type {
  Bounds,
  DebugLevel,
  EmitterSource,
  ExpandedLextronOptions,
  LextronOptions,
} from 'lextron-core';
export { ChangeAttributes, ChangeIterator, ChangeOp, ChangeSet, Dom, Range };

registerBlots(Lextron);
registerFormats(Lextron, true);
registerModules(Lextron, true);
registerUI(Lextron, true);
registerThemes(Lextron, true);

export default Lextron;
