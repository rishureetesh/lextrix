/**
 * Lextrix change-set — operational transform layer for document changes.
 */
export {
  default,
  default as ChangeSet,
  ChangeOp,
  ChangeIterator,
  ChangeAttributes,
} from './change/change-set.js';
export type { default as ChangeOpType } from './change/change-op.js';
