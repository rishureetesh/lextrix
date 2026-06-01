import type fastDiff from 'fast-diff';
import type ChangeSet from './change-set.js';
import { fromLegacyOps, toLegacyOps } from '../operation/legacy-bridge.js';
import OperationStreamOT, { NULL_CHARACTER } from '../pipeline/operation-stream-ot.js';

export { NULL_CHARACTER };

export function diffChangeSets(
  a: ChangeSet,
  b: ChangeSet,
  cursor?: number | fastDiff.CursorInfo,
): ChangeSet {
  const ChangeSetCtor = a.constructor as typeof ChangeSet;
  if (a.ops === b.ops) {
    return new ChangeSetCtor();
  }
  const ops = OperationStreamOT.diff(fromLegacyOps(a.ops), fromLegacyOps(b.ops), cursor);
  return new ChangeSetCtor(toLegacyOps(ops));
}
