import ChangeAttributes from './change-attributes.js';
import ChangeOp from './change-op.js';
import ChangeIterator from './change-iterator.js';
import { getEmbedHandler } from './embed-handlers.js';
import type ChangeSet from './change-set.js';

export function transformChangeSets(
  a: ChangeSet,
  b: ChangeSet,
  priority = false,
): ChangeSet {
  const ChangeSetCtor = a.constructor as typeof ChangeSet;
  const thisIter = new ChangeIterator(a.ops);
  const otherIter = new ChangeIterator(b.ops);
  const result = new ChangeSetCtor();
  while (thisIter.hasNext() || otherIter.hasNext()) {
    if (
      thisIter.peekType() === 'insert' &&
      (priority || otherIter.peekType() !== 'insert')
    ) {
      result.retain(ChangeOp.length(thisIter.next()));
    } else if (otherIter.peekType() === 'insert') {
      result.push(otherIter.next());
    } else {
      const length = Math.min(thisIter.peekLength(), otherIter.peekLength());
      const thisChangeOp = thisIter.next(length);
      const otherChangeOp = otherIter.next(length);
      if (thisChangeOp.delete) {
        continue;
      } else if (otherChangeOp.delete) {
        result.push(otherChangeOp);
      } else {
        const thisData = thisChangeOp.retain;
        const otherData = otherChangeOp.retain;
        let transformedData: ChangeOp['retain'] =
          typeof otherData === 'object' && otherData !== null
            ? otherData
            : length;
        if (
          typeof thisData === 'object' &&
          thisData !== null &&
          typeof otherData === 'object' &&
          otherData !== null
        ) {
          const embedType = Object.keys(thisData)[0];
          if (embedType === Object.keys(otherData)[0]) {
            const handler = getEmbedHandler(embedType);
            if (handler) {
              transformedData = {
                [embedType]: handler.transform(
                  thisData[embedType],
                  otherData[embedType],
                  priority,
                ),
              };
            }
          }
        }

        result.retain(
          transformedData,
          ChangeAttributes.transform(
            thisChangeOp.attributes,
            otherChangeOp.attributes,
            priority,
          ),
        );
      }
    }
  }
  return result.chop();
}

export function transformPosition(
  changeSet: ChangeSet,
  index: number,
  priority = false,
): number {
  priority = !!priority;
  const thisIter = new ChangeIterator(changeSet.ops);
  let offset = 0;
  while (thisIter.hasNext() && offset <= index) {
    const length = thisIter.peekLength();
    const nextType = thisIter.peekType();
    thisIter.next();
    if (nextType === 'delete') {
      index -= Math.min(length, index - offset);
      continue;
    } else if (nextType === 'insert' && (offset < index || !priority)) {
      index += length;
    }
    offset += length;
  }
  return index;
}
