import fastDiff from 'fast-diff';
import { isEqual } from 'lodash-es';
import ChangeAttributes from './change-attributes.js';
import ChangeIterator from './change-iterator.js';
import type ChangeSet from './change-set.js';

/** Placeholder character for embed values in string diff. */
export const NULL_CHARACTER = String.fromCharCode(0);

export function diffChangeSets(
  a: ChangeSet,
  b: ChangeSet,
  cursor?: number | fastDiff.CursorInfo,
): ChangeSet {
  const ChangeSetCtor = a.constructor as typeof ChangeSet;
  if (a.ops === b.ops) {
    return new ChangeSetCtor();
  }
  const strings = [a, b].map((changeSet) => {
    return changeSet
      .map((op) => {
        if (op.insert != null) {
          return typeof op.insert === 'string' ? op.insert : NULL_CHARACTER;
        }
        const prep = changeSet === b ? 'on' : 'with';
        throw new Error('diff() called ' + prep + ' non-document');
      })
      .join('');
  });
  const retChangeSet = new ChangeSetCtor();
  const diffResult = fastDiff(strings[0], strings[1], cursor, true);
  const thisIter = new ChangeIterator(a.ops);
  const otherIter = new ChangeIterator(b.ops);
  diffResult.forEach((component: fastDiff.Diff) => {
    let length = component[1].length;
    while (length > 0) {
      let opLength = 0;
      switch (component[0]) {
        case fastDiff.INSERT:
          opLength = Math.min(otherIter.peekLength(), length);
          retChangeSet.push(otherIter.next(opLength));
          break;
        case fastDiff.DELETE:
          opLength = Math.min(length, thisIter.peekLength());
          thisIter.next(opLength);
          retChangeSet.delete(opLength);
          break;
        case fastDiff.EQUAL:
          opLength = Math.min(
            thisIter.peekLength(),
            otherIter.peekLength(),
            length,
          );
          const thisChangeOp = thisIter.next(opLength);
          const otherChangeOp = otherIter.next(opLength);
          if (isEqual(thisChangeOp.insert, otherChangeOp.insert)) {
            retChangeSet.retain(
              opLength,
              ChangeAttributes.diff(thisChangeOp.attributes, otherChangeOp.attributes),
            );
          } else {
            retChangeSet.push(otherChangeOp).delete(opLength);
          }
          break;
      }
      length -= opLength;
    }
  });
  return retChangeSet.chop();
}
