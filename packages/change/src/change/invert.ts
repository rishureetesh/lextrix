import type ChangeSet from './change-set.js';
import { fromLegacyOps, toLegacyOps } from '../operation/legacy-bridge.js';
import OperationStreamOT from '../pipeline/operation-stream-ot.js';

export function invertChangeSet(changeSet: ChangeSet, base: ChangeSet): ChangeSet {
  const ChangeSetCtor = changeSet.constructor as typeof ChangeSet;
  const ops = OperationStreamOT.invert(
    fromLegacyOps(changeSet.ops),
    fromLegacyOps(base.ops),
  );
  return new ChangeSetCtor(toLegacyOps(ops));
}
