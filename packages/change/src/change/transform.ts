import type ChangeSet from './change-set.js';
import { fromLegacyOps, toLegacyOps } from '../operation/legacy-bridge.js';
import OperationStreamOT from '../pipeline/operation-stream-ot.js';

export function transformChangeSets(
  a: ChangeSet,
  b: ChangeSet,
  priority = false,
): ChangeSet {
  const ChangeSetCtor = a.constructor as typeof ChangeSet;
  const ops = OperationStreamOT.transform(
    fromLegacyOps(a.ops),
    fromLegacyOps(b.ops),
    priority,
  );
  return new ChangeSetCtor(toLegacyOps(ops));
}

export function transformPosition(
  changeSet: ChangeSet,
  index: number,
  priority = false,
): number {
  return OperationStreamOT.transformPosition(
    fromLegacyOps(changeSet.ops),
    index,
    priority,
  );
}
