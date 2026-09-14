/**
 * ChangeSet ops wire validation (ADR-012).
 * Same semantic ops as the engine — no second operation model.
 */
import type ChangeOp from '../change/change-op.js';
import { WireError } from './errors.js';
import { WIRE_LIMITS } from './schema.js';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function assertNoForbiddenKeys(
  keys: string[],
  context: string,
): void {
  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new WireError(
        'forbidden_key',
        `wire: forbidden key "${key}" in ${context}`,
      );
    }
  }
}

function copyPlainObject(
  value: Record<string, unknown>,
  context: string,
  maxKeys: number,
  maxJsonChars: number,
): Record<string, unknown> {
  const keys = Object.keys(value);
  assertNoForbiddenKeys(keys, context);
  if (keys.length > maxKeys) {
    throw new WireError(
      'limit_exceeded',
      `wire: too many keys in ${context} (max ${maxKeys})`,
    );
  }
  const jsonLen = JSON.stringify(value).length;
  if (jsonLen > maxJsonChars) {
    throw new WireError(
      'limit_exceeded',
      `wire: ${context} JSON exceeds ${maxJsonChars} chars`,
    );
  }
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const v = value[key];
    // Shallow copy only — nested objects copied as JSON-safe primitives/objects.
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[key] = v;
    } else if (Array.isArray(v)) {
      out[key] = [...v];
    } else if (v && typeof v === 'object') {
      out[key] = { ...(v as Record<string, unknown>) };
    } else {
      throw new WireError(
        'malformed_op',
        `wire: unsupported value type in ${context}.${key}`,
      );
    }
  }
  return out;
}

function parseAttributes(
  raw: unknown,
  index: number,
): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new WireError(
      'malformed_op',
      `wire: invalid attributes at op ${index}`,
    );
  }
  return copyPlainObject(
    raw as Record<string, unknown>,
    `attributes@${index}`,
    WIRE_LIMITS.maxAttributeKeys,
    WIRE_LIMITS.maxEmbedJsonChars,
  );
}

/**
 * Validate and shallow-copy untrusted ops into engine ChangeOp[].
 * Supports string inserts, embed object inserts, numeric delete/retain,
 * and object retain embeds (engine-compatible).
 */
export function parseWireOps(ops: unknown): ChangeOp[] {
  if (!Array.isArray(ops)) {
    throw new WireError('invalid_type', 'wire: ops must be an array');
  }
  if (ops.length > WIRE_LIMITS.maxOps) {
    throw new WireError(
      'limit_exceeded',
      `wire: ops exceed limit (${WIRE_LIMITS.maxOps})`,
    );
  }

  let insertChars = 0;
  const out: ChangeOp[] = [];

  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new WireError('malformed_op', `wire: invalid op at ${i}`);
    }
    const rec = op as Record<string, unknown>;
    const keys = Object.keys(rec);
    assertNoForbiddenKeys(keys, `op@${i}`);

    // Unknown op fields (beyond insert|delete|retain|attributes) are ignored
    // for forward compatibility — but exactly one kind is required.
    const hasInsert = Object.prototype.hasOwnProperty.call(rec, 'insert');
    const hasDelete = Object.prototype.hasOwnProperty.call(rec, 'delete');
    const hasRetain = Object.prototype.hasOwnProperty.call(rec, 'retain');
    const kinds = [hasInsert, hasDelete, hasRetain].filter(Boolean).length;
    if (kinds !== 1) {
      throw new WireError(
        'malformed_op',
        `wire: op at ${i} must have exactly one of insert|delete|retain`,
      );
    }

    if (hasInsert) {
      const insert = rec.insert;
      if (typeof insert === 'string') {
        if (insert.length > WIRE_LIMITS.maxSingleInsertChars) {
          throw new WireError(
            'limit_exceeded',
            `wire: insert too large at ${i}`,
          );
        }
        insertChars += insert.length;
        if (insertChars > WIRE_LIMITS.maxInsertChars) {
          throw new WireError(
            'limit_exceeded',
            'wire: total insert length exceeds limit',
          );
        }
        const next: ChangeOp = { insert };
        const attrs = parseAttributes(rec.attributes, i);
        if (attrs) next.attributes = attrs;
        out.push(next);
      } else if (insert && typeof insert === 'object' && !Array.isArray(insert)) {
        const next: ChangeOp = {
          insert: copyPlainObject(
            insert as Record<string, unknown>,
            `embed@${i}`,
            WIRE_LIMITS.maxEmbedKeys,
            WIRE_LIMITS.maxEmbedJsonChars,
          ),
        };
        const attrs = parseAttributes(rec.attributes, i);
        if (attrs) next.attributes = attrs;
        out.push(next);
      } else {
        throw new WireError('malformed_op', `wire: invalid insert at ${i}`);
      }
      continue;
    }

    if (hasDelete) {
      const del = rec.delete;
      if (typeof del !== 'number' || !Number.isFinite(del) || del < 0) {
        throw new WireError('malformed_op', `wire: invalid delete at ${i}`);
      }
      out.push({ delete: del });
      continue;
    }

    const retain = rec.retain;
    if (typeof retain === 'number') {
      if (!Number.isFinite(retain) || retain < 0) {
        throw new WireError('malformed_op', `wire: invalid retain at ${i}`);
      }
      const next: ChangeOp = { retain };
      const attrs = parseAttributes(rec.attributes, i);
      if (attrs) next.attributes = attrs;
      out.push(next);
    } else if (retain && typeof retain === 'object' && !Array.isArray(retain)) {
      const next: ChangeOp = {
        retain: copyPlainObject(
          retain as Record<string, unknown>,
          `retain-embed@${i}`,
          WIRE_LIMITS.maxEmbedKeys,
          WIRE_LIMITS.maxEmbedJsonChars,
        ),
      };
      const attrs = parseAttributes(rec.attributes, i);
      if (attrs) next.attributes = attrs;
      out.push(next);
    } else {
      throw new WireError('malformed_op', `wire: invalid retain at ${i}`);
    }
  }

  return out;
}

/** Serialize ops for wire — shallow JSON-safe copies. */
export function serializeWireOps(ops: readonly ChangeOp[]): ChangeOp[] {
  return ops.map((op) => {
    const next: ChangeOp = { ...op };
    if (op.attributes) {
      next.attributes = { ...op.attributes };
    }
    if (op.insert && typeof op.insert === 'object') {
      next.insert = { ...(op.insert as Record<string, unknown>) };
    }
    if (op.retain && typeof op.retain === 'object') {
      next.retain = { ...(op.retain as Record<string, unknown>) };
    }
    return next;
  });
}

export function assertWireId(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > WIRE_LIMITS.maxIdLength
  ) {
    throw new WireError('invalid_id', `wire: invalid ${field}`);
  }
  return value;
}

export function parseJsonInput(input: unknown): unknown {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch (err) {
      throw new WireError(
        'invalid_json',
        `wire: invalid JSON (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }
  return input;
}

export function asRecord(data: unknown, context: string): Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new WireError('invalid_type', `wire: ${context} expected object`);
  }
  const rec = data as Record<string, unknown>;
  assertNoForbiddenKeys(Object.keys(rec), context);
  return rec;
}
