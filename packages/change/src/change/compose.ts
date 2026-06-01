import type ChangeSet from './change-set.js';
import { fromLegacyOps, toLegacyOps } from '../operation/legacy-bridge.js';
import OperationStreamOT from '../pipeline/operation-stream-ot.js';

export function composeChangeSets(a: ChangeSet, b: ChangeSet): ChangeSet {
  const ChangeSetCtor = a.constructor as typeof ChangeSet;
  const ops = OperationStreamOT.compose(fromLegacyOps(a.ops), fromLegacyOps(b.ops));
  return new ChangeSetCtor(toLegacyOps(ops));
}
