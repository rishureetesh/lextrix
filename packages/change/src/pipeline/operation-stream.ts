import ChangeOp from '../change/change-op.js';
import type { DocumentOperation } from '../operation/kinds.js';
import { fromLegacyOp, operationLength, toLegacyOp } from '../operation/legacy-bridge.js';

type OpKind = 'insert' | 'delete' | 'retain';

/**
 * Non-destructive cursor over document operations for OT pipeline stages.
 */
export class OperationStream {
  private index = 0;
  private offset = 0;

  constructor(private readonly ops: readonly DocumentOperation[]) {}

  static fromLegacy(ops: ChangeOp[]): OperationStream {
    return new OperationStream(ops.map(fromLegacyOp));
  }

  hasNext(): boolean {
    return this.peekLength() < Infinity;
  }

  peek(): DocumentOperation | undefined {
    return this.ops[this.index];
  }

  peekKind(): OpKind | null {
    const op = this.peek();
    return op?.kind ?? null;
  }

  peekLength(): number {
    const op = this.ops[this.index];
    if (!op) return Infinity;
    return operationLength(op) - this.offset;
  }

  next(take = Infinity): DocumentOperation {
    const op = this.ops[this.index];
    if (!op) {
      return { kind: 'retain', count: Infinity };
    }

    const start = this.offset;
    const available = operationLength(op) - start;
    const length = Math.min(take, available);

    if (length >= available) {
      this.index += 1;
      this.offset = 0;
    } else {
      this.offset += length;
    }

    return this.slice(op, start, length);
  }

  rest(): DocumentOperation[] {
    if (!this.hasNext()) {
      return [];
    }
    if (this.offset === 0) {
      return [...this.ops.slice(this.index)];
    }
    const offset = this.offset;
    const index = this.index;
    const next = this.next();
    const rest = this.ops.slice(this.index);
    this.offset = offset;
    this.index = index;
    return [next, ...rest];
  }

  peekType(): 'insert' | 'delete' | 'retain' {
    const op = this.peek();
    return op?.kind ?? 'retain';
  }

  toLegacy(): ChangeOp[] {
    return this.ops.map(toLegacyOp);
  }

  private slice(
    op: DocumentOperation,
    start: number,
    length: number,
  ): DocumentOperation {
    if (op.kind === 'insert' && typeof op.value === 'string') {
      return {
        kind: 'insert',
        value: op.value.slice(start, start + length),
        attributes: op.attributes,
      };
    }
    if (op.kind === 'delete') {
      return { kind: 'delete', count: length };
    }
    if (op.kind === 'retain' && typeof op.count === 'number') {
      return { kind: 'retain', count: length, attributes: op.attributes };
    }
    return op;
  }
}
