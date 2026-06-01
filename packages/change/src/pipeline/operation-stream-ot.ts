import fastDiff from 'fast-diff';
import { isEqual } from 'lodash-es';
import ChangeAttributes from '../change/change-attributes.js';
import { getEmbedHandler } from '../change/embed-handlers.js';
import { OperationBuffer } from '../document/operation-buffer.js';
import type { DocumentOperation, RetainOperation } from '../operation/kinds.js';
import { operationLength } from '../operation/kinds.js';
import { embedTypeAndData, isEmbedPayload, sliceOperations } from '../operation/operation-utils.js';
import { toLegacyOp } from '../operation/legacy-bridge.js';
import { OperationStream } from './operation-stream.js';

/** NULL placeholder for embed values in string diff. */
export const NULL_CHARACTER = String.fromCharCode(0);

function concatBuffers(a: OperationBuffer, b: OperationBuffer): OperationBuffer {
  const out = new OperationBuffer();
  for (const op of a.raw) out.append(op);
  for (const op of b.raw) out.append(op);
  return out;
}

function bufferFromRest(stream: OperationStream): OperationBuffer {
  const buffer = new OperationBuffer();
  for (const op of stream.rest()) {
    buffer.append(op);
  }
  return buffer;
}

/** Operational-transform algorithms over DocumentOperation streams. */
export class OperationStreamOT {
  static compose(
    a: readonly DocumentOperation[],
    b: readonly DocumentOperation[],
  ): DocumentOperation[] {
    const thisIter = new OperationStream(a);
    const otherIter = new OperationStream(b);
    const prefix = new OperationBuffer();

    const firstOther = otherIter.peek();
    if (
      firstOther?.kind === 'retain' &&
      typeof firstOther.count === 'number' &&
      firstOther.attributes == null
    ) {
      let firstLeft = firstOther.count;
      while (
        thisIter.peekType() === 'insert' &&
        thisIter.peekLength() <= firstLeft
      ) {
        firstLeft -= thisIter.peekLength();
        prefix.append(thisIter.next());
      }
      if (firstOther.count - firstLeft > 0) {
        otherIter.next(firstOther.count - firstLeft);
      }
    }

    const result = new OperationBuffer();
    for (const op of prefix.raw) result.append(op);

    while (thisIter.hasNext() || otherIter.hasNext()) {
      if (otherIter.peekType() === 'insert') {
        result.append(otherIter.next());
      } else if (thisIter.peekType() === 'delete') {
        result.append(thisIter.next());
      } else {
        const length = Math.min(thisIter.peekLength(), otherIter.peekLength());
        const thisOp = thisIter.next(length);
        const otherOp = otherIter.next(length);

        if (otherOp.kind === 'retain') {
          const newOp = OperationStreamOT.composeRetainPair(thisOp, otherOp, length);
          result.append(newOp);

          if (
            !otherIter.hasNext() &&
            result.raw.length > 0 &&
            isEqual(
              toLegacyOp(result.raw[result.raw.length - 1]!),
              toLegacyOp(newOp),
            )
          ) {
            return concatBuffers(result, bufferFromRest(thisIter))
              .chopTrailingRetain()
              .raw.slice();
          }
        } else if (otherOp.kind === 'delete' && thisOp.kind === 'retain') {
          result.append(otherOp);
        }
      }
    }

    return result.chopTrailingRetain().raw.slice();
  }

  private static composeRetainPair(
    thisOp: DocumentOperation,
    otherOp: Extract<DocumentOperation, { kind: 'retain' }>,
    length: number,
  ): DocumentOperation {
    const retainCount = otherOp.count;

    if (thisOp.kind === 'retain') {
      let count: RetainOperation['count'];
      if (typeof thisOp.count === 'number') {
        count = typeof retainCount === 'number' ? length : retainCount;
      } else if (typeof retainCount === 'number') {
        count = thisOp.count;
      } else {
        const [embedType, thisData, otherData] = embedTypeAndData(
          thisOp.count,
          retainCount as Record<string, unknown>,
        );
        const handler = getEmbedHandler(embedType);
        count = {
          [embedType]: handler.compose(thisData, otherData, true),
        };
      }
      const attributes = ChangeAttributes.compose(
        thisOp.attributes,
        otherOp.attributes,
        typeof thisOp.count === 'number',
      );
      return attributes
        ? { kind: 'retain', count, attributes }
        : { kind: 'retain', count };
    }

    if (thisOp.kind === 'insert') {
      if (typeof retainCount === 'number') {
        const attributes = ChangeAttributes.compose(
          thisOp.attributes,
          otherOp.attributes,
          false,
        );
        return attributes
          ? { kind: 'insert', value: thisOp.value, attributes }
          : { kind: 'insert', value: thisOp.value };
      }

      const [embedType, thisData, otherData] = embedTypeAndData(
        thisOp.value,
        retainCount as Record<string, unknown>,
      );
      const handler = getEmbedHandler(embedType);
      const attributes = ChangeAttributes.compose(
        thisOp.attributes,
        otherOp.attributes,
        false,
      );
      return {
        kind: 'insert',
        value: { [embedType]: handler.compose(thisData, otherData, false) },
        ...(attributes ? { attributes } : {}),
      };
    }

    throw new Error('Unexpected compose pair');
  }

  static diff(
    a: readonly DocumentOperation[],
    b: readonly DocumentOperation[],
    cursor?: number | fastDiff.CursorInfo,
  ): DocumentOperation[] {
    const strings = [a, b].map((ops, i) =>
      ops
        .map((op) => {
          if (op.kind === 'insert') {
            return typeof op.value === 'string' ? op.value : NULL_CHARACTER;
          }
          const prep = i === 1 ? 'on' : 'with';
          throw new Error(`diff() called ${prep} non-document`);
        })
        .join(''),
    );

    const result = new OperationBuffer();
    const diffResult = fastDiff(strings[0], strings[1], cursor, true);
    const thisIter = new OperationStream(a);
    const otherIter = new OperationStream(b);

    diffResult.forEach((component: fastDiff.Diff) => {
      let length = component[1].length;
      while (length > 0) {
        let opLength = 0;
        switch (component[0]) {
          case fastDiff.INSERT:
            opLength = Math.min(otherIter.peekLength(), length);
            result.append(otherIter.next(opLength));
            break;
          case fastDiff.DELETE:
            opLength = Math.min(length, thisIter.peekLength());
            thisIter.next(opLength);
            result.append({ kind: 'delete', count: opLength });
            break;
          case fastDiff.EQUAL: {
            opLength = Math.min(
              thisIter.peekLength(),
              otherIter.peekLength(),
              length,
            );
            const thisOp = thisIter.next(opLength);
            const otherOp = otherIter.next(opLength);
            if (
              thisOp.kind === 'insert' &&
              otherOp.kind === 'insert' &&
              isEqual(thisOp.value, otherOp.value)
            ) {
              result.append({
                kind: 'retain',
                count: opLength,
                attributes: ChangeAttributes.diff(
                  thisOp.attributes,
                  otherOp.attributes,
                ),
              });
            } else if (otherOp.kind === 'insert') {
              result.append(otherOp);
              result.append({ kind: 'delete', count: opLength });
            }
            break;
          }
        }
        length -= opLength;
      }
    });

    return result.chopTrailingRetain().raw.slice();
  }

  static transform(
    a: readonly DocumentOperation[],
    b: readonly DocumentOperation[],
    priority = false,
  ): DocumentOperation[] {
    const thisIter = new OperationStream(a);
    const otherIter = new OperationStream(b);
    const result = new OperationBuffer();

    while (thisIter.hasNext() || otherIter.hasNext()) {
      if (
        thisIter.peekType() === 'insert' &&
        (priority || otherIter.peekType() !== 'insert')
      ) {
        result.append({
          kind: 'retain',
          count: operationLength(thisIter.next()),
        });
      } else if (otherIter.peekType() === 'insert') {
        result.append(otherIter.next());
      } else {
        const length = Math.min(thisIter.peekLength(), otherIter.peekLength());
        const thisOp = thisIter.next(length);
        const otherOp = otherIter.next(length);

        if (thisOp.kind === 'delete') {
          continue;
        }
        if (otherOp.kind === 'delete') {
          result.append(otherOp);
        } else if (thisOp.kind === 'retain' && otherOp.kind === 'retain') {
          let count: RetainOperation['count'] =
            typeof otherOp.count === 'object' && otherOp.count !== null
              ? otherOp.count
              : length;

          if (
            typeof thisOp.count === 'object' &&
            thisOp.count !== null &&
            typeof otherOp.count === 'object' &&
            otherOp.count !== null
          ) {
            const embedType = Object.keys(thisOp.count)[0];
            if (embedType === Object.keys(otherOp.count)[0]) {
              const handler = getEmbedHandler(embedType);
              count = {
                [embedType]: handler.transform(
                  thisOp.count[embedType],
                  otherOp.count[embedType],
                  priority,
                ),
              };
            }
          }

          result.append({
            kind: 'retain',
            count,
            attributes: ChangeAttributes.transform(
              thisOp.attributes,
              otherOp.attributes,
              priority,
            ),
          });
        }
      }
    }

    return result.chopTrailingRetain().raw.slice();
  }

  static transformPosition(
    ops: readonly DocumentOperation[],
    index: number,
    priority = false,
  ): number {
    const iter = new OperationStream(ops);
    let offset = 0;
    while (iter.hasNext() && offset <= index) {
      const length = iter.peekLength();
      const nextType = iter.peekType();
      iter.next();
      if (nextType === 'delete') {
        index -= Math.min(length, index - offset);
        continue;
      }
      if (nextType === 'insert' && (offset < index || !priority)) {
        index += length;
      }
      offset += length;
    }
    return index;
  }

  static invert(
    change: readonly DocumentOperation[],
    base: readonly DocumentOperation[],
  ): DocumentOperation[] {
    const inverted = new OperationBuffer();
    let baseIndex = 0;

    for (const op of change) {
      if (op.kind === 'insert') {
        inverted.append({ kind: 'delete', count: operationLength(op) });
        continue;
      }

      if (
        op.kind === 'retain' &&
        typeof op.count === 'number' &&
        op.attributes == null
      ) {
        inverted.append({ kind: 'retain', count: op.count });
        baseIndex += op.count;
        continue;
      }

      if (op.kind === 'delete' || (op.kind === 'retain' && typeof op.count === 'number')) {
        const length =
          op.kind === 'delete' ? op.count : (op.count as number);
        const slice = sliceOperations(base, baseIndex, baseIndex + length);
        for (const baseOp of slice) {
          if (op.kind === 'delete') {
            inverted.append(baseOp);
          } else if (op.attributes) {
            const attributes = ChangeAttributes.invert(
              op.attributes,
              baseOp.kind === 'insert' ? baseOp.attributes : undefined,
            );
            const retainOp: DocumentOperation = {
              kind: 'retain',
              count: operationLength(baseOp),
            };
            if (attributes && Object.keys(attributes).length > 0) {
              retainOp.attributes = attributes;
            }
            inverted.append(retainOp);
          }
        }
        baseIndex += length;
        continue;
      }

      if (op.kind === 'retain' && isEmbedPayload(op.count)) {
        const slice = sliceOperations(base, baseIndex, baseIndex + 1);
        const baseOp = slice[0];
        if (baseOp?.kind === 'insert' && isEmbedPayload(baseOp.value)) {
          const [embedType, opData, baseData] = embedTypeAndData(
            op.count,
            baseOp.value,
          );
          const handler = getEmbedHandler(embedType);
          const attributes = ChangeAttributes.invert(
            op.attributes,
            baseOp.attributes,
          );
          const invertedOp: DocumentOperation = {
            kind: 'retain',
            count: { [embedType]: handler.invert(opData, baseData) },
          };
          if (attributes && Object.keys(attributes).length > 0) {
            invertedOp.attributes = attributes;
          }
          inverted.append(invertedOp);
        }
        baseIndex += 1;
      }
    }

    return inverted.chopTrailingRetain().raw.slice();
  }
}

export default OperationStreamOT;
