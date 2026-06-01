import { cloneDeep, isEqual } from 'lodash-es';
import type ChangeAttributes from '../change/change-attributes.js';
import type {
  DeleteOperation,
  DocumentOperation,
  InsertOperation,
  RetainOperation,
} from '../operation/kinds.js';

function operationAttributes(
  op: DocumentOperation,
): ChangeAttributes | undefined {
  if (op.kind === 'delete') {
    return undefined;
  }
  return op.attributes;
}

/**
 * Coalescing push over native operations (same semantics as legacy ChangeOp push).
 */
export function pushNativeOp(
  ops: DocumentOperation[],
  newOp: DocumentOperation,
): void {
  let index = ops.length;
  let lastOp = ops[index - 1];

  if (lastOp != null) {
    if (lastOp.kind === 'delete' && newOp.kind === 'delete') {
      ops[index - 1] = {
        kind: 'delete',
        count: lastOp.count + newOp.count,
      } satisfies DeleteOperation;
      return;
    }

    // Prefer insert before delete at the same index.
    if (lastOp.kind === 'delete' && newOp.kind === 'insert') {
      index -= 1;
      lastOp = ops[index - 1];
      if (lastOp == null) {
        ops.unshift(newOp);
        return;
      }
    }

    if (isEqual(operationAttributes(newOp), operationAttributes(lastOp))) {
      if (
        lastOp.kind === 'insert' &&
        newOp.kind === 'insert' &&
        typeof lastOp.value === 'string' &&
        typeof newOp.value === 'string'
      ) {
        const merged: InsertOperation = {
          kind: 'insert',
          value: lastOp.value + newOp.value,
        };
        if (typeof newOp.attributes === 'object') {
          merged.attributes = newOp.attributes;
        }
        ops[index - 1] = merged;
        return;
      }

      if (
        lastOp.kind === 'retain' &&
        newOp.kind === 'retain' &&
        typeof lastOp.count === 'number' &&
        typeof newOp.count === 'number'
      ) {
        const merged: RetainOperation = {
          kind: 'retain',
          count: lastOp.count + newOp.count,
        };
        if (typeof newOp.attributes === 'object') {
          merged.attributes = newOp.attributes;
        }
        ops[index - 1] = merged;
        return;
      }
    }
  }

  if (index === ops.length) {
    ops.push(newOp);
  } else {
    ops.splice(index, 0, newOp);
  }
}

/** Appends a native operation with merge semantics. */
export function appendNativeOp(
  ops: DocumentOperation[],
  newOp: DocumentOperation,
): void {
  pushNativeOp(ops, cloneDeep(newOp));
}

export default pushNativeOp;
