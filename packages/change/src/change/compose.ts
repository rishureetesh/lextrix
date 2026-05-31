import { isEqual } from 'lodash-es';
import ChangeAttributes from './change-attributes.js';
import type ChangeOp from './change-op.js';
import ChangeIterator from './change-iterator.js';
import { getEmbedHandler, getEmbedTypeAndData } from './embed-handlers.js';
import type ChangeSet from './change-set.js';

export function composeChangeSets(a: ChangeSet, b: ChangeSet): ChangeSet {
  const ChangeSetCtor = a.constructor as typeof ChangeSet;
  const thisIter = new ChangeIterator(a.ops);
  const otherIter = new ChangeIterator(b.ops);
  const ops: ChangeOp[] = [];
  const firstOther = otherIter.peek();
  if (
    firstOther != null &&
    typeof firstOther.retain === 'number' &&
    firstOther.attributes == null
  ) {
    let firstLeft = firstOther.retain;
    while (
      thisIter.peekType() === 'insert' &&
      thisIter.peekLength() <= firstLeft
    ) {
      firstLeft -= thisIter.peekLength();
      ops.push(thisIter.next());
    }
    if (firstOther.retain - firstLeft > 0) {
      otherIter.next(firstOther.retain - firstLeft);
    }
  }
  const result = new ChangeSetCtor(ops);
  while (thisIter.hasNext() || otherIter.hasNext()) {
    if (otherIter.peekType() === 'insert') {
      result.push(otherIter.next());
    } else if (thisIter.peekType() === 'delete') {
      result.push(thisIter.next());
    } else {
      const length = Math.min(thisIter.peekLength(), otherIter.peekLength());
      const thisChangeOp = thisIter.next(length);
      const otherChangeOp = otherIter.next(length);
      if (otherChangeOp.retain) {
        const newChangeOp: ChangeOp = {};
        if (typeof thisChangeOp.retain === 'number') {
          newChangeOp.retain =
            typeof otherChangeOp.retain === 'number' ? length : otherChangeOp.retain;
        } else {
          if (typeof otherChangeOp.retain === 'number') {
            if (thisChangeOp.retain == null) {
              newChangeOp.insert = thisChangeOp.insert;
            } else {
              newChangeOp.retain = thisChangeOp.retain;
            }
          } else {
            const action = thisChangeOp.retain == null ? 'insert' : 'retain';
            const [embedType, thisData, otherData] = getEmbedTypeAndData(
              thisChangeOp[action],
              otherChangeOp.retain,
            );
            const handler = getEmbedHandler(embedType);
            newChangeOp[action] = {
              [embedType]: handler.compose(
                thisData,
                otherData,
                action === 'retain',
              ),
            };
          }
        }
        const attributes = ChangeAttributes.compose(
          thisChangeOp.attributes,
          otherChangeOp.attributes,
          typeof thisChangeOp.retain === 'number',
        );
        if (attributes) {
          newChangeOp.attributes = attributes;
        }
        result.push(newChangeOp);

        if (
          !otherIter.hasNext() &&
          isEqual(result.ops[result.ops.length - 1], newChangeOp)
        ) {
          const rest = new ChangeSetCtor(thisIter.rest());
          return result.concat(rest).chop();
        }
      } else if (
        typeof otherChangeOp.delete === 'number' &&
        (typeof thisChangeOp.retain === 'number' ||
          (typeof thisChangeOp.retain === 'object' && thisChangeOp.retain !== null))
      ) {
        result.push(otherChangeOp);
      }
    }
  }
  return result.chop();
}
