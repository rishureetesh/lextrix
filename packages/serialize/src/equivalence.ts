import ChangeSet, { type ChangeOp } from 'lextrix-change';

export interface EquivalenceOptions {
  /** Ignore block attribute placement (newline vs content op). */
  normalizeBlockAttributes?: boolean;
}

/** Normalizes a ChangeSet for structural comparison in round-trip tests. */
export function normalizeChangeSet(
  delta: ChangeSet,
  options: EquivalenceOptions = {},
): ChangeOp[] {
  const { normalizeBlockAttributes = true } = options;
  return delta.ops.flatMap((op) =>
    expandCoalescedNewlines(normalizeOp(op, normalizeBlockAttributes)),
  );
}

/** Splits coalesced `text\\n` inserts into separate text + newline ops. */
function expandCoalescedNewlines(op: ChangeOp): ChangeOp[] {
  if (typeof op.insert !== 'string' || !op.insert.includes('\n')) {
    return [op];
  }

  const attrs = op.attributes ?? {};
  const { block, inline } = splitBlockAttributes(attrs);
  const inlineOnly =
    Object.keys(inline).length > 0 ? inline : undefined;
  const blockOnly =
    Object.keys(block).length > 0 ? block : undefined;

  const parts = op.insert.split('\n');
  const results: ChangeOp[] = [];
  parts.slice(0, -1).forEach((text) => {
    if (text.length > 0) {
      results.push({
        insert: text,
        ...(inlineOnly ? { attributes: inlineOnly } : {}),
      });
    }
    results.push({
      insert: '\n',
      ...(blockOnly ? { attributes: blockOnly } : {}),
    });
  });
  const last = parts[parts.length - 1];
  if (last.length > 0) {
    results.push({
      insert: last,
      ...(inlineOnly ? { attributes: inlineOnly } : {}),
    });
  }
  return results.length > 0 ? results : [op];
}

/** Returns true when two ChangeSets are structurally equivalent. */
export function changeSetsEquivalent(
  a: ChangeSet,
  b: ChangeSet,
  options?: EquivalenceOptions,
): boolean {
  const normA = normalizeChangeSet(a, options);
  const normB = normalizeChangeSet(b, options);
  return JSON.stringify(normA) === JSON.stringify(normB);
}

function normalizeOp(
  op: ChangeOp,
  normalizeBlockAttributes: boolean,
): ChangeOp {
  const result: ChangeOp = { ...op };
  if (result.attributes) {
    result.attributes = sortAttributes(result.attributes);
    if (normalizeBlockAttributes && typeof result.insert === 'string') {
      const { block, inline } = splitBlockAttributes(result.attributes);
      if (Object.keys(block).length > 0 && !result.insert.includes('\n')) {
        result.attributes = inline;
      }
    }
  }
  if (typeof result.insert === 'string' && result.insert.includes('\n')) {
    const parts = result.insert.split('\n');
    if (parts.length === 2 && parts[1] === '') {
      result.insert = '\n';
    }
  }
  return result;
}

const BLOCK_KEYS = new Set([
  'header', 'blockquote', 'list', 'indent', 'code-block', 'table',
  'mdx-component', 'align', 'direction',
]);

const TABLE_DELIMITER_KEYS = new Set(['table-cell', 'table-row']);

function splitBlockAttributes(attrs: Record<string, unknown>) {
  const block: Record<string, unknown> = {};
  const inline: Record<string, unknown> = {};
  Object.entries(attrs).forEach(([key, value]) => {
    if (TABLE_DELIMITER_KEYS.has(key)) inline[key] = value;
    else if (BLOCK_KEYS.has(key)) block[key] = value;
    else inline[key] = value;
  });
  return { block, inline };
}

function sortAttributes(
  attrs: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b)),
  );
}
