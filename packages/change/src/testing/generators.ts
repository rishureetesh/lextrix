/**
 * Generators for valid Lextrix document ChangeSets and changes.
 * Used by property/fuzz tests — deterministic via SeededRandom.
 */
import ChangeSet from '../change/change-set.js';
import type ChangeOp from '../change/change-op.js';
import { SeededRandom } from './seeded-random.js';

const ASCII =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ';
const UNICODE_EXTRAS = 'αβγδεζηθικ你好世界🙂🚀';

const INLINE_ATTR_KEYS = ['bold', 'italic', 'underline', 'code'] as const;

function randomText(rng: SeededRandom, maxLen: number): string {
  const len = rng.int(1, maxLen + 1);
  let out = '';
  for (let i = 0; i < len; i += 1) {
    if (rng.bool(0.08)) {
      out += rng.pick([...UNICODE_EXTRAS]);
    } else {
      out += rng.pick([...ASCII]);
    }
  }
  return out;
}

function randomInlineAttrs(
  rng: SeededRandom,
): Record<string, unknown> | undefined {
  if (!rng.bool(0.35)) return undefined;
  const attrs: Record<string, unknown> = {};
  for (const key of INLINE_ATTR_KEYS) {
    if (rng.bool(0.4)) attrs[key] = true;
  }
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

/**
 * Build an insert-only document ChangeSet (canonical DocumentState contents).
 * Always ends with a trailing newline (Quill document convention).
 */
export function generateDocument(
  rng: SeededRandom,
  options: { maxSegments?: number; maxSegmentLen?: number } = {},
): ChangeSet {
  const maxSegments = options.maxSegments ?? 6;
  const maxSegmentLen = options.maxSegmentLen ?? 12;
  const segments = rng.int(1, maxSegments + 1);
  const doc = new ChangeSet();
  for (let i = 0; i < segments; i += 1) {
    const text = randomText(rng, maxSegmentLen);
    const withBreak = rng.bool(0.4) ? `${text}\n` : text;
    doc.insert(withBreak, randomInlineAttrs(rng));
  }
  // Ensure trailing newline for document form
  const text = getDocumentText(doc);
  if (!text.endsWith('\n')) {
    doc.insert('\n');
  }
  return doc;
}

export function getDocumentText(doc: ChangeSet): string {
  let text = '';
  for (const op of doc.ops) {
    if (typeof op.insert === 'string') text += op.insert;
    else if (op.insert && typeof op.insert === 'object') text += '\uFFFC';
  }
  return text;
}

export function isDocumentChangeSet(cs: ChangeSet): boolean {
  return cs.ops.every((op) => op.insert != null && op.delete == null);
}

/**
 * Generate a change applicable to `doc` (same length constraints as Quill deltas).
 */
export function generateChangeAgainstDocument(
  rng: SeededRandom,
  doc: ChangeSet,
): ChangeSet {
  const docLen = doc.length();
  if (docLen <= 0) {
    return new ChangeSet().insert(randomText(rng, 4) + '\n');
  }

  const kind = rng.pick(['insert', 'delete', 'format', 'replace', 'noop'] as const);
  const change = new ChangeSet();

  switch (kind) {
    case 'noop':
      return change.retain(docLen);

    case 'insert': {
      const index = rng.int(0, docLen);
      // Prefer not to insert after final newline exclusively in weird ways
      const at = Math.min(index, Math.max(0, docLen - 1));
      if (at > 0) change.retain(at);
      change.insert(randomText(rng, 8), randomInlineAttrs(rng));
      const rest = docLen - at;
      if (rest > 0) change.retain(rest);
      return change;
    }

    case 'delete': {
      if (docLen <= 1) {
        return change.retain(docLen);
      }
      // Keep at least the final newline when possible
      const maxDelEnd = docLen - 1;
      const start = rng.int(0, maxDelEnd);
      const delLen = rng.int(1, maxDelEnd - start + 1);
      if (start > 0) change.retain(start);
      change.delete(delLen);
      const rest = docLen - start - delLen;
      if (rest > 0) change.retain(rest);
      return change;
    }

    case 'format': {
      const start = rng.int(0, docLen);
      const len = rng.int(1, docLen - start + 1);
      if (start > 0) change.retain(start);
      change.retain(len, randomInlineAttrs(rng) ?? { bold: true });
      const rest = docLen - start - len;
      if (rest > 0) change.retain(rest);
      return change;
    }

    case 'replace': {
      if (docLen <= 1) {
        return change.insert(randomText(rng, 3));
      }
      const start = rng.int(0, docLen - 1);
      const delLen = rng.int(1, docLen - start);
      if (start > 0) change.retain(start);
      change.delete(delLen);
      change.insert(randomText(rng, 6), randomInlineAttrs(rng));
      const rest = docLen - start - delLen;
      if (rest > 0) change.retain(rest);
      return change;
    }
  }
}

/** Two concurrent changes against the same document (independent RNG forks). */
export function generateConcurrentPair(
  rng: SeededRandom,
  doc: ChangeSet,
): [ChangeSet, ChangeSet] {
  const a = generateChangeAgainstDocument(rng, doc);
  const b = generateChangeAgainstDocument(rng, doc);
  return [a, b];
}

/** Deep equality for ChangeSet ops (order-sensitive, JSON-stable enough). */
export function changeSetsEqual(a: ChangeSet, b: ChangeSet): boolean {
  return JSON.stringify(normalizeOps(a.ops)) === JSON.stringify(normalizeOps(b.ops));
}

function normalizeOps(ops: ChangeOp[]): ChangeOp[] {
  return ops.map((op) => {
    const next: ChangeOp = {};
    if (op.insert !== undefined) next.insert = op.insert;
    if (op.delete !== undefined) next.delete = op.delete;
    if (op.retain !== undefined) next.retain = op.retain;
    if (op.attributes && Object.keys(op.attributes).length > 0) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(op.attributes).sort()) {
        sorted[key] = op.attributes[key];
      }
      next.attributes = sorted;
    }
    return next;
  });
}

export function documentsEqual(a: ChangeSet, b: ChangeSet): boolean {
  return changeSetsEqual(a, b);
}
