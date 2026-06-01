import type ChangeAttributes from '../change/change-attributes.js';

/** Lextrix-native discriminated operation model (internal). */
export type InsertOperation = {
  kind: 'insert';
  value: string | Record<string, unknown>;
  attributes?: ChangeAttributes;
};

export type DeleteOperation = {
  kind: 'delete';
  count: number;
};

export type RetainOperation = {
  kind: 'retain';
  count: number | Record<string, unknown>;
  attributes?: ChangeAttributes;
};

export type DocumentOperation =
  | InsertOperation
  | DeleteOperation
  | RetainOperation;

export function operationLength(op: DocumentOperation): number {
  switch (op.kind) {
    case 'insert':
      return typeof op.value === 'string' ? op.value.length : 1;
    case 'delete':
      return op.count;
    case 'retain':
      return typeof op.count === 'number' ? op.count : 1;
  }
}
