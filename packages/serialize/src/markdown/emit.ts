import type { ChangeOp } from 'lextrix-change';
import type { DocumentBlock } from '../change-set-blocks.js';
import { splitChangeSetIntoBlocks } from '../change-set-blocks.js';
import { inlineOpsToMarkdown } from './inline.js';
import type ChangeSet from 'lextrix-change';

const BLOCK_LEVEL_ATTRS = new Set([
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

/** Converts a ChangeSet to markdown source. */
export function changeSetToMarkdown(delta: ChangeSet): string {
  const blocks = splitChangeSetIntoBlocks(delta);
  const segments: string[] = [];
  const orderCounters: Record<number, number> = {};
  let i = 0;

  while (i < blocks.length) {
    while (i < blocks.length && isEmptySpacerBlock(blocks[i])) {
      i += 1;
    }
    if (i >= blocks.length) break;

    const listType = blocks[i].attributes.list;
    if (listType) {
      const { lines, end } = collectListRun(
        blocks,
        i,
        String(listType),
        orderCounters,
      );
      i = end;
      if (lines.length > 0) {
        segments.push(lines.join('\n'));
      }
      if (listType !== 'ordered') {
        resetOrderCounters(orderCounters);
      }
      continue;
    }

    resetOrderCounters(orderCounters);
    const rendered = renderNonListBlock(blocks[i]);
    if (rendered.length > 0) {
      segments.push(rendered);
    }
    i += 1;
  }

  return segments.filter((segment) => segment.length > 0).join('\n\n');
}

function collectListRun(
  blocks: DocumentBlock[],
  start: number,
  listType: string,
  orderCounters: Record<number, number>,
): { lines: string[]; end: number } {
  const lines: string[] = [];
  let i = start;

  while (i < blocks.length) {
    if (isEmptySpacerBlock(blocks[i])) {
      if (listType === 'ordered') {
        let j = i + 1;
        while (j < blocks.length && isEmptySpacerBlock(blocks[j])) {
          j += 1;
        }
        if (j < blocks.length && blocks[j].attributes.list === 'ordered') {
          i = j;
          continue;
        }
      }
      break;
    }

    if (String(blocks[i].attributes.list) !== listType) {
      break;
    }

    lines.push(renderListBlock(blocks[i], orderCounters));
    i += 1;
  }

  return { lines, end: i };
}

function isEmptySpacerBlock(block: DocumentBlock): boolean {
  const hasBlockAttrs = Object.keys(block.attributes).some((key) =>
    BLOCK_LEVEL_ATTRS.has(key),
  );
  if (hasBlockAttrs) return false;

  const hasEmbed = block.content.some(
    (op) => typeof op.insert === 'object' && op.insert !== null,
  );
  if (hasEmbed) return false;

  const text = block.content
    .filter((op) => typeof op.insert === 'string' && op.insert !== '\n')
    .map((op) => op.insert)
    .join('');
  return text.trim().length === 0;
}

function resetOrderCounters(orderCounters: Record<number, number>) {
  Object.keys(orderCounters).forEach((key) => {
    delete orderCounters[Number(key)];
  });
}

function renderListBlock(
  block: DocumentBlock,
  orderCounters: Record<number, number>,
): string {
  const attrs = block.attributes;
  const text = inlineOpsToMarkdown(block.content);
  const indent = Number(attrs.indent ?? 0);
  const listType = String(attrs.list);

  if (listType === 'ordered') {
    for (const level of Object.keys(orderCounters)) {
      if (Number(level) > indent) {
        delete orderCounters[Number(level)];
      }
    }
    orderCounters[indent] = (orderCounters[indent] ?? 0) + 1;
    const pad = '  '.repeat(indent);
    return `${pad}${orderCounters[indent]}. ${text}`;
  }

  const prefix = listPrefix(listType, indent);
  return `${prefix}${text}`;
}

function renderNonListBlock(block: DocumentBlock): string {
  const attrs = block.attributes;
  const rawText = block.content
    .filter((op) => typeof op.insert === 'string')
    .map((op) => op.insert)
    .join('');
  // Literal "---" must not become a thematic break on re-import.
  if (rawText === '---' && Object.keys(attrs).length === 0) {
    return '\\-\\-\\-';
  }

  const text = inlineOpsToMarkdown(block.content);

  if (attrs['code-block']) {
    const language =
      typeof attrs['code-block'] === 'string' ? attrs['code-block'] : '';
    const codeText = block.content
      .filter((op) => typeof op.insert === 'string')
      .map((op) => op.insert)
      .join('');
    return `\`\`\`${language}\n${codeText}\n\`\`\``;
  }

  if (attrs.header) {
    const level = Number(attrs.header);
    return `${'#'.repeat(level)} ${text}`;
  }

  if (attrs.blockquote) {
    return text.split('\n').map((line) => `> ${line}`).join('\n');
  }

  if (attrs.table) {
    const tableMd = tableBlockToMarkdown(block);
    if (tableMd) return tableMd;
  }

  const isStandaloneImage = block.content.some(
    (op) =>
      typeof op.insert === 'object' &&
      op.insert !== null &&
      'image' in op.insert,
  );
  if (isStandaloneImage && text.startsWith('![')) {
    return text;
  }

  return text.trim().length > 0 ? text : '';
}

function listPrefix(listType: string, indent: number): string {
  const pad = '  '.repeat(indent);
  switch (listType) {
    case 'checked':
      return `${pad}- [x] `;
    case 'unchecked':
      return `${pad}- [ ] `;
    default:
      return `${pad}- `;
  }
}

function tableBlockToMarkdown(block: DocumentBlock): string | null {
  const rows = groupTableCells(block.content);
  if (rows.length === 0) return null;

  const lines = rows.map((row) => `| ${row.join(' | ')} |`);
  if (lines.length >= 1) {
    const separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
    lines.splice(1, 0, separator);
  }
  return lines.join('\n');
}

function groupTableCells(content: ChangeOp[]): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let cellText = '';

  const flushCell = () => {
    currentRow.push(cellText);
    cellText = '';
  };

  const flushRow = () => {
    if (currentRow.length === 0) return;
    rows.push(currentRow);
    currentRow = [];
  };

  content.forEach((op) => {
    if (typeof op.insert === 'string' && op.insert !== '\n') {
      cellText += op.insert;
      return;
    }

    if (typeof op.insert === 'object' && op.insert !== null) {
      cellText += inlineOpsToMarkdown([op]);
      return;
    }

    if (op.insert === '\n' && op.attributes?.['table-cell'] === true) {
      flushCell();
      return;
    }

    if (op.insert === '\n' && op.attributes?.['table-row'] === true) {
      flushCell();
      flushRow();
    }
  });

  if (cellText.length > 0) {
    flushCell();
  }
  if (currentRow.length > 0) {
    flushRow();
  }

  return rows;
}
