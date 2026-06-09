import ChangeSet, { type ChangeOp } from 'lextrix-change';

/** Block-level ChangeSet attribute keys. */
const BLOCK_ATTRIBUTE_KEYS = new Set([
  'header',
  'blockquote',
  'list',
  'indent',
  'code-block',
  'table',
  'mdx-component',
  'align',
  'direction',
]);

const TABLE_DELIMITER_KEYS = new Set(['table-cell', 'table-row']);

function isTableDelimiterNewline(op: ChangeOp): boolean {
  return (
    op.insert === '\n' &&
    (op.attributes?.['table-cell'] === true || op.attributes?.['table-row'] === true)
  );
}

function isTableDelimiterAttribute(key: string): boolean {
  return TABLE_DELIMITER_KEYS.has(key);
}

/** A single logical document block derived from a ChangeSet. */
export interface DocumentBlock {
  /** Inline content ops (text and inline embeds) before the block terminator. */
  content: ChangeOp[];
  /** Block-level attributes (from the newline op or trailing block embed). */
  attributes: Record<string, unknown>;
}

function isBlockAttribute(key: string): boolean {
  return BLOCK_ATTRIBUTE_KEYS.has(key);
}

function stripBlockAttributes(
  attributes: Record<string, unknown> = {},
): Record<string, unknown> {
  const inline: Record<string, unknown> = {};
  Object.entries(attributes).forEach(([key, value]) => {
    if (!isBlockAttribute(key) || isTableDelimiterAttribute(key)) {
      inline[key] = value;
    }
  });
  return inline;
}

function extractBlockAttributes(
  content: ChangeOp[],
  newlineAttributes: Record<string, unknown> = {},
): Record<string, unknown> {
  if (Object.keys(newlineAttributes).length > 0) {
    return { ...newlineAttributes };
  }

  const blockAttributes: Record<string, unknown> = {};
  content.forEach((op) => {
    Object.entries(op.attributes ?? {}).forEach(([key, value]) => {
      if (isBlockAttribute(key)) {
        blockAttributes[key] = value;
      }
    });
  });
  return blockAttributes;
}

function sanitizeContentOps(content: ChangeOp[]): ChangeOp[] {
  return content.map((op) => {
    if (!op.attributes) return op;
    const inlineAttributes = stripBlockAttributes(op.attributes);
    if (Object.keys(inlineAttributes).length === 0) {
      const { attributes: _, ...rest } = op;
      return rest;
    }
    return { ...op, attributes: inlineAttributes };
  });
}

/** Splits a ChangeSet into logical blocks at newline boundaries. */
export function splitChangeSetIntoBlocks(delta: ChangeSet): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  let currentContent: ChangeOp[] = [];

  const pushBlock = (newlineAttributes: Record<string, unknown> = {}) => {
    blocks.push({
      content: sanitizeContentOps(currentContent),
      attributes: extractBlockAttributes(currentContent, newlineAttributes),
    });
    currentContent = [];
  };

  delta.forEach((op) => {
    const insert = op.insert;
    if (insert == null) return;

    if (typeof insert !== 'string') {
      const key = Object.keys(insert)[0];
      if (!key) return;
      currentContent.push(op);
      return;
    }

    if (insert === '\n' && isTableDelimiterNewline(op)) {
      currentContent.push(op);
      return;
    }

    const parts = insert.split('\n');
    parts.slice(0, -1).forEach((text) => {
      if (text.length > 0) {
        currentContent.push({ insert: text, attributes: op.attributes });
      }
      pushBlock(op.attributes ?? {});
    });

    const last = parts[parts.length - 1];
    if (last.length > 0) {
      currentContent.push({ insert: last, attributes: op.attributes });
    }
  });

  if (currentContent.length > 0) {
    pushBlock({});
  }

  return blocks;
}

/** Builds a ChangeSet from logical blocks. */
export function blocksToChangeSet(blocks: DocumentBlock[]): ChangeSet {
  const ops: ChangeOp[] = [];

  blocks.forEach((block, index) => {
    const isTableBlock = block.attributes.table != null;
    const content = block.content.filter((op) => {
      if (op.insert !== '\n') return true;
      return isTableBlock && isTableDelimiterNewline(op);
    });
    content.forEach((op) => ops.push(op));

    const text = content
      .filter((op) => typeof op.insert === 'string')
      .map((op) => op.insert)
      .join('');

    const hasBlockEmbed = content.some(
      (op) => typeof op.insert === 'object' && op.insert !== null,
    );

    const isLast = index === blocks.length - 1;
    const needsTerminator =
      Object.keys(block.attributes).length > 0 ||
      !isLast ||
      text.length > 0 ||
      hasBlockEmbed;

    if (needsTerminator) {
      const newlineOp: ChangeOp = { insert: '\n' };
      if (Object.keys(block.attributes).length > 0) {
        newlineOp.attributes = block.attributes;
      }
      ops.push(newlineOp);
    }
  });

  return new ChangeSet(ops);
}
