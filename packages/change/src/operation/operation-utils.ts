import { OperationStream } from '../pipeline/operation-stream.js';
import type {
  DocumentOperation,
  InsertOperation,
  RetainOperation,
} from '../operation/kinds.js';
import { operationLength } from '../operation/kinds.js';

type EmbedPayload = Record<string, unknown>;

export function isEmbedPayload(
  value: unknown,
): value is EmbedPayload {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function embedTypeAndData(
  a: InsertOperation['value'] | RetainOperation['count'],
  b: InsertOperation['value'],
): [string, unknown, unknown] {
  if (!isEmbedPayload(a)) {
    throw new Error(`cannot retain a ${typeof a}`);
  }
  if (!isEmbedPayload(b)) {
    throw new Error(`cannot retain a ${typeof b}`);
  }
  const embedType = Object.keys(a)[0];
  if (!embedType || embedType !== Object.keys(b)[0]) {
    throw new Error(
      `embed types not matched: ${embedType} != ${Object.keys(b)[0]}`,
    );
  }
  return [embedType, a[embedType], b[embedType]];
}

export function opDocumentLength(op: DocumentOperation): number {
  switch (op.kind) {
    case 'insert':
      return operationLength(op);
    case 'delete':
      return -op.count;
    case 'retain':
      return 0;
  }
}

export function sliceOperations(
  ops: readonly DocumentOperation[],
  start = 0,
  end = Infinity,
): DocumentOperation[] {
  const iter = new OperationStream(ops);
  const result: DocumentOperation[] = [];
  let index = 0;
  while (index < end && iter.hasNext()) {
    const nextOp =
      index < start ? iter.next(start - index) : iter.next(end - index);
    if (index >= start) {
      result.push(nextOp);
    }
    index += operationLength(nextOp);
  }
  return result;
}
