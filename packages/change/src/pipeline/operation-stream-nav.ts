import type ChangeAttributes from '../change/change-attributes.js';
import type { DocumentOperation } from '../operation/kinds.js';
import { operationLength } from '../operation/kinds.js';
import { fromLegacyOps, toLegacyOps } from '../operation/legacy-bridge.js';
import { sliceOperations } from '../operation/operation-utils.js';
import { OperationStream } from './operation-stream.js';

/** Slice a document operation stream by document index range. */
export function sliceChangeSetOperations(
  ops: readonly DocumentOperation[],
  start = 0,
  end = Infinity,
): DocumentOperation[] {
  return sliceOperations(ops, start, end);
}

export type LinePredicate = (
  lineOps: DocumentOperation[],
  attributes: ChangeAttributes,
  lineIndex: number,
) => boolean | void;

/** Walk insert-only document ops line-by-line (newline-delimited). */
export function eachLineOperations(
  ops: readonly DocumentOperation[],
  predicate: LinePredicate,
  newline = '\n',
): void {
  const iter = new OperationStream(ops);
  let line: DocumentOperation[] = [];
  let lineIndex = 0;

  while (iter.hasNext()) {
    if (iter.peekType() !== 'insert') {
      return;
    }

    const peek = iter.peek();
    if (peek?.kind !== 'insert') {
      return;
    }

    const start = operationLength(peek) - iter.peekLength();
    const text = typeof peek.value === 'string' ? peek.value : null;
    const newlineAt =
      text != null ? text.indexOf(newline, start) - start : -1;

    if (newlineAt < 0) {
      line.push(iter.next());
    } else if (newlineAt > 0) {
      line.push(iter.next(newlineAt));
    } else {
      const newlineOp = iter.next(1);
      if (newlineOp.kind !== 'insert') {
        return;
      }
      if (predicate(line, newlineOp.attributes ?? {}, lineIndex) === false) {
        return;
      }
      lineIndex += 1;
      line = [];
    }
  }

  if (line.length > 0) {
    predicate(line, {}, lineIndex);
  }
}

/** Legacy bridge helpers for ChangeSet compatibility wrappers. */
export function sliceLegacyOps(
  ops: readonly import('../change/change-op.js').default[],
  start = 0,
  end = Infinity,
) {
  return toLegacyOps(sliceChangeSetOperations(fromLegacyOps([...ops]), start, end));
}

export default {
  sliceChangeSetOperations,
  eachLineOperations,
  sliceLegacyOps,
};
