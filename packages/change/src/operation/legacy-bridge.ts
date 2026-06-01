import type ChangeOp from '../change/change-op.js';
import type {
  DeleteOperation,
  DocumentOperation,
  InsertOperation,
  RetainOperation,
} from './kinds.js';
import { operationLength } from './kinds.js';

function legacyAttributes(
  attributes?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (attributes == null || Object.keys(attributes).length === 0) {
    return undefined;
  }
  return attributes;
}

export function fromLegacyOp(op: ChangeOp): DocumentOperation {
  if (op.insert != null) {
    const insert: InsertOperation = { kind: 'insert', value: op.insert };
    const attributes = legacyAttributes(op.attributes);
    if (attributes) insert.attributes = attributes;
    return insert;
  }
  if (typeof op.delete === 'number') {
    return { kind: 'delete', count: op.delete } satisfies DeleteOperation;
  }
  const retain: RetainOperation = { kind: 'retain', count: op.retain ?? 0 };
  const attributes = legacyAttributes(op.attributes);
  if (attributes) retain.attributes = attributes;
  return retain;
}

export function toLegacyOp(op: DocumentOperation): ChangeOp {
  switch (op.kind) {
    case 'insert': {
      const legacy: ChangeOp = { insert: op.value };
      const attributes = legacyAttributes(op.attributes);
      if (attributes) legacy.attributes = attributes;
      return legacy;
    }
    case 'delete':
      return { delete: op.count };
    case 'retain': {
      const legacy: ChangeOp = { retain: op.count };
      const attributes = legacyAttributes(op.attributes);
      if (attributes) legacy.attributes = attributes;
      return legacy;
    }
  }
}

export function fromLegacyOps(ops: ChangeOp[]): DocumentOperation[] {
  return ops.map(fromLegacyOp);
}

export function toLegacyOps(ops: DocumentOperation[]): ChangeOp[] {
  return ops.map(toLegacyOp);
}

export { operationLength };
