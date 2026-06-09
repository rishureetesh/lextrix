import { describe, expect, test } from 'vitest';
import {
  changeSetToMarkdown,
  markdownBlocksToChangeSet,
  parseMarkdownBlocks,
  splitChangeSetIntoBlocks,
} from 'lextrix-serialize';

describe('table block assembly', () => {
  const source = '| A | B |\n| --- | --- |\n| 1 | 2 |';

  test('preserves delimiter ops through blocksToChangeSet', () => {
    const blocks = parseMarkdownBlocks(source);
    const delta = markdownBlocksToChangeSet(blocks);
    const delimiterOps = delta.ops.filter(
      (op) => op.attributes?.['table-cell'] || op.attributes?.['table-row'],
    );
    expect(delimiterOps.length).toBeGreaterThan(0);
  });

  test('splitChangeSetIntoBlocks keeps table as single block', () => {
    const delta = markdownBlocksToChangeSet(parseMarkdownBlocks(source));
    const split = splitChangeSetIntoBlocks(delta);
    const tableBlocks = split.filter((b) => b.attributes.table != null);
    expect(tableBlocks).toHaveLength(1);
    expect(
      tableBlocks[0].content.some((op) => op.attributes?.['table-cell'] === true),
    ).toBe(true);
  });

  test('exports valid GFM from assembled blocks', () => {
    const delta = markdownBlocksToChangeSet(parseMarkdownBlocks(source));
    const exported = changeSetToMarkdown(delta);
    expect(exported).toContain('| A | B |');
    expect(exported).toContain('| 1 | 2 |');
  });
});
