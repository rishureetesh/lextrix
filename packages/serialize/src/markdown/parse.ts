import ChangeSet from 'lextrix-change';
import type { DocumentBlock } from '../change-set-blocks.js';
import { blocksToChangeSet } from '../change-set-blocks.js';
import {
  inlineTokensToOps,
  parseInlineMarkdown,
  tokenizeInline,
} from './inline.js';

export interface ParsedMarkdownBlock {
  type:
    | 'paragraph'
    | 'heading'
    | 'blockquote'
    | 'code'
    | 'list'
    | 'table'
    | 'image'
    | 'horizontal-rule';
  text?: string;
  level?: number;
  language?: string;
  listType?: 'bullet' | 'ordered' | 'checked' | 'unchecked';
  indent?: number;
  rows?: string[][];
  src?: string;
  alt?: string;
}

/** Parses markdown source into logical blocks. */
export function parseMarkdownBlocks(source: string): ParsedMarkdownBlock[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ParsedMarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: 'horizontal-rule' });
      i += 1;
      continue;
    }

    const codeFence = line.match(/^```(\w*)/);
    if (codeFence) {
      const language = codeFence[1] || undefined;
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({
        type: 'code',
        text: codeLines.join('\n'),
        language,
      });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2],
      });
      i += 1;
      continue;
    }

    const blockquote = line.match(/^>\s?(.*)$/);
    if (blockquote) {
      const quoteLines: string[] = [blockquote[1]];
      i += 1;
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      blocks.push({ type: 'image', alt: image[1], src: image[2] });
      i += 1;
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const indent = Math.floor(listMatch[1].length / 2);
      const marker = listMatch[2];
      const listType = marker.endsWith('.') ? 'ordered' : 'bullet';
      let text = listMatch[3];

      if (/^\[[ xX]\]\s/.test(text)) {
        const checked = text[1].toLowerCase() === 'x';
        text = text.slice(4);
        blocks.push({
          type: 'list',
          text,
          listType: checked ? 'checked' : 'unchecked',
          indent,
        });
      } else {
        blocks.push({ type: 'list', text, listType, indent });
      }
      i += 1;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length) {
      const table = tryParseTable(lines, i);
      if (table) {
        blocks.push({ type: 'table', rows: table.rows });
        i = table.nextIndex;
        continue;
      }
    }

    const paragraphLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isBlockStart(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
  }

  return blocks;
}

function isBlockStart(line: string): boolean {
  return (
    /^#{1,6}\s/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim()) ||
    /^!\[[^\]]*\]\([^)]+\)$/.test(line) ||
    /^(\s*)([-*+]|\d+\.)\s+/.test(line) ||
    (line.includes('|') && /^\|?[\s:-]+\|/.test(line))
  );
}

function tryParseTable(
  lines: string[],
  start: number,
): { rows: string[][]; nextIndex: number } | null {
  const header = parseTableRow(lines[start]);
  if (!header || start + 1 >= lines.length) return null;

  const separator = lines[start + 1].trim();
  if (!/^\|?[\s|:-]+\|?$/.test(separator) || !separator.includes('-')) {
    return null;
  }

  const rows: string[][] = [header];
  let i = start + 2;
  while (i < lines.length) {
    const row = parseTableRow(lines[i]);
    if (!row) break;
    rows.push(row);
    i += 1;
  }

  return { rows, nextIndex: i };
}

function parseTableRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.includes('|')) return null;
  const cells = trimmed
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
  return cells.length > 0 ? cells : null;
}

/** Converts parsed markdown blocks to a ChangeSet. */
export function markdownBlocksToChangeSet(
  blocks: ParsedMarkdownBlock[],
): ChangeSet {
  const documentBlocks: DocumentBlock[] = blocks
    .map(parsedBlockToDocumentBlock)
    .filter((block): block is DocumentBlock => block !== null);

  if (documentBlocks.length === 0) {
    return new ChangeSet();
  }

  return blocksToChangeSet(documentBlocks);
}

function parsedBlockToDocumentBlock(
  block: ParsedMarkdownBlock,
): DocumentBlock | null {
  switch (block.type) {
    case 'horizontal-rule':
      return { content: [{ insert: '---' }], attributes: {} };

    case 'heading':
      return {
        content: inlineTokensToOps(tokenizeInline(block.text ?? '')),
        attributes: { header: block.level ?? 1 },
      };

    case 'blockquote':
      return {
        content: inlineTokensToOps(tokenizeInline(block.text ?? '')),
        attributes: { blockquote: true },
      };

    case 'code':
      return {
        content: [{ insert: block.text ?? '' }],
        attributes: {
          'code-block': block.language ?? true,
        },
      };

    case 'list': {
      const attrs: Record<string, unknown> = { list: block.listType ?? 'bullet' };
      if (block.indent && block.indent > 0) {
        attrs.indent = block.indent;
      }
      return {
        content: inlineTokensToOps(tokenizeInline(block.text ?? '')),
        attributes: attrs,
      };
    }

    case 'image':
      return {
        content: [
          {
            insert: { image: block.src ?? '' },
            attributes: block.alt ? { alt: block.alt } : undefined,
          },
        ],
        attributes: {},
      };

    case 'table':
      return tableRowsToBlock(block.rows ?? []);

    case 'paragraph':
    default:
      return {
        content: parseInlineMarkdown(block.text ?? ''),
        attributes: {},
      };
  }
}

function tableRowsToBlock(rows: string[][]): DocumentBlock | null {
  if (rows.length === 0) return null;

  const delta = new ChangeSet();
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, cellIndex) => {
      const ops = inlineTokensToOps(tokenizeInline(cell));
      ops.forEach((op) => delta.push(op));
      if (cellIndex < row.length - 1) {
        delta.insert('\n', { 'table-cell': true });
      }
    });
    if (rowIndex < rows.length - 1) {
      delta.insert('\n', { 'table-row': true });
    }
  });

  return {
    content: delta.ops.filter((op) => op.insert != null),
    attributes: { table: true },
  };
}
