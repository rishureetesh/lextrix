import ChangeAttributes from './change-attributes.js';
import ChangeOp from './change-op.js';
import ChangeIterator from './change-iterator.js';
import { getEmbedHandler, getEmbedTypeAndData } from './embed-handlers.js';
import type ChangeSet from './change-set.js';

export function invertChangeSet(changeSet: ChangeSet, base: ChangeSet): ChangeSet {
  const ChangeSetCtor = changeSet.constructor as typeof ChangeSet;
  const inverted = new ChangeSetCtor();
  changeSet.reduce((baseIndex, op) => {
    if (op.insert) {
      inverted.delete(ChangeOp.length(op));
    } else if (typeof op.retain === 'number' && op.attributes == null) {
      inverted.retain(op.retain);
      return baseIndex + op.retain;
    } else if (op.delete || typeof op.retain === 'number') {
      const length = (op.delete || op.retain) as number;
      const slice = base.slice(baseIndex, baseIndex + length);
      slice.forEach((baseChangeOp) => {
        if (op.delete) {
          inverted.push(baseChangeOp);
        } else if (op.retain && op.attributes) {
          inverted.retain(
            ChangeOp.length(baseChangeOp),
            ChangeAttributes.invert(op.attributes, baseChangeOp.attributes),
          );
        }
      });
      return baseIndex + length;
    } else if (typeof op.retain === 'object' && op.retain !== null) {
      const slice = base.slice(baseIndex, baseIndex + 1);
      const baseChangeOp = new ChangeIterator(slice.ops).next();
      const [embedType, opData, baseChangeOpData] = getEmbedTypeAndData(
        op.retain,
        baseChangeOp.insert,
      );
      const handler = getEmbedHandler(embedType);
      inverted.retain(
        { [embedType]: handler.invert(opData, baseChangeOpData) },
        ChangeAttributes.invert(op.attributes, baseChangeOp.attributes),
      );
      return baseIndex + 1;
    }
    return baseIndex;
  }, 0);
  return inverted.chop();
}
