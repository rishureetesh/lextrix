import type { ChangeOp } from 'lextrix-change';
import type { DocumentBlock } from '../change-set-blocks.js';
import { splitChangeSetIntoBlocks } from '../change-set-blocks.js';
import { inlineOpsToMarkdown } from './inline.js';
import type ChangeSet from 'lextrix-change';

/** Converts a ChangeSet to markdown source. */
export function changeSetToMarkdown(delta: ChangeSet): string {
  const blocks = splitChangeSetIntoBlocks(delta);
  const segments: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    if (block.attributes.list) {
      const listLines: string[] = [];
      while (i < blocks.length && blocks[i].attributes.list) {
        listLines.push(renderListBlock(blocks[i]));
        i += 1;
      }
      segments.push(listLines.join('\n'));
      continue;
    }

    segments.push(renderNonListBlock(block));
    i += 1;
  }

  return segments.filter((segment) => segment.length > 0).join('\n\n');
}

function renderListBlock(block: DocumentBlock): string {
  const attrs = block.attributes;
  const text = inlineOpsToMarkdown(block.content);
  const indent = Number(attrs.indent ?? 0);
  const prefix = listPrefix(String(attrs.list), indent);
  return `${prefix}${text}`;
}

function renderNonListBlock(block: DocumentBlock): string {
  const attrs = block.attributes;
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

  if (text === '---' && Object.keys(attrs).length === 0) {
    return '---';
  }

  return text.trim().length > 0 ? text : '';
}

function listPrefix(listType: string, indent: number): string {
  const pad = '  '.repeat(indent);
  switch (listType) {
    case 'ordered':
      return `${pad}1. `;
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
