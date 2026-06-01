import type ChangeOp from '../change/change-op.js';
import type { DocumentOperation } from '../operation/kinds.js';
import { operationLength } from '../operation/kinds.js';
import { fromLegacyOp, fromLegacyOps, toLegacyOps } from '../operation/legacy-bridge.js';
import { appendNativeOp } from './operation-coalesce.js';

/**
 * Mutable operation buffer with Lextrix-native storage and coalescing.
 * Legacy ChangeOp conversion happens only at public boundaries.
 */
export class OperationBuffer {
  private ops: DocumentOperation[] = [];

  get raw(): readonly DocumentOperation[] {
    return this.ops;
  }

  toLegacyOps(): ChangeOp[] {
    return toLegacyOps(this.ops);
  }

  static fromLegacyOps(ops: ChangeOp[]): OperationBuffer {
    const buffer = new OperationBuffer();
    buffer.ops = fromLegacyOps(ops);
    return buffer;
  }

  append(op: DocumentOperation): this {
    appendNativeOp(this.ops, op);
    return this;
  }

  /** Converts a legacy op once, then merges natively. */
  appendLegacy(newOp: ChangeOp): this {
    return this.append(fromLegacyOp(newOp));
  }

  chopTrailingRetain(): this {
    const last = this.ops[this.ops.length - 1];
    if (
      last?.kind === 'retain' &&
      typeof last.count === 'number' &&
      !last.attributes
    ) {
      this.ops.pop();
    }
    return this;
  }

  documentLength(): number {
    return this.ops.reduce((sum, op) => {
      if (op.kind === 'insert') {
        return sum + operationLength(op);
      }
      if (op.kind === 'delete') {
        return sum - op.count;
      }
      return sum;
    }, 0);
  }

  contentLength(): number {
    return this.ops.reduce((sum, op) => sum + operationLength(op), 0);
  }
}

export default OperationBuffer;
