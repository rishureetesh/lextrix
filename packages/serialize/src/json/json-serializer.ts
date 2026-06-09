import ChangeSet, { type ChangeOp } from 'lextrix-change';
import type { ContentSerializer, SerializerFactory } from '../types.js';

/** Serializes ChangeSet ops to JSON and back. */
export function jsonSerializer(): ContentSerializer {
  return {
    format: 'json',

    import(content: string): ChangeSet {
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new Error('Invalid JSON document: failed to parse JSON');
      }

      const ops = extractChangeOps(parsed);
      validateChangeOps(ops);
      return new ChangeSet(ops);
    },

    export(changeSet: ChangeSet): string {
      return JSON.stringify(changeSet.ops, null, 2);
    },
  };
}

export const createJsonSerializer: SerializerFactory = jsonSerializer;

function extractChangeOps(parsed: unknown): ChangeOp[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    'ops' in parsed &&
    Array.isArray((parsed as { ops: unknown }).ops)
  ) {
    return (parsed as { ops: ChangeOp[] }).ops;
  }
  throw new Error(
    'Invalid JSON document: expected ChangeSet ops array or { ops: [] }',
  );
}

function validateChangeOps(ops: ChangeOp[]): void {
  ops.forEach((op, index) => {
    if (op == null || typeof op !== 'object') {
      throw new Error(`Invalid ChangeOp at index ${index}: expected object`);
    }
    const keys = Object.keys(op).filter(
      (key) => op[key as keyof ChangeOp] != null,
    );
    const hasInsert = 'insert' in op;
    const hasDelete = 'delete' in op;
    const hasRetain = 'retain' in op;
    if (Number(hasInsert) + Number(hasDelete) + Number(hasRetain) !== 1) {
      throw new Error(
        `Invalid ChangeOp at index ${index}: exactly one of insert, delete, retain required`,
      );
    }
    if (keys.length === 0) {
      throw new Error(`Invalid ChangeOp at index ${index}: empty operation`);
    }
  });
}
