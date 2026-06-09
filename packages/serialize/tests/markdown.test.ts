import { describe, expect, test } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  changeSetToMarkdown,
  markdownBlocksToChangeSet,
  markdownSerializer,
  parseMarkdownBlocks,
} from 'lextrix-serialize';

describe('markdown serializer', () => {
  test('parses headings', () => {
    const delta = markdownSerializer().import('# Hello\n\n## World');
    expect(delta.ops).toEqual([
      { insert: 'Hello' },
      { insert: '\n', attributes: { header: 1 } },
      { insert: 'World' },
      { insert: '\n', attributes: { header: 2 } },
    ]);
  });

  test('exports headings', () => {
    const delta = new ChangeSet()
      .insert('Hello')
      .insert('\n', { header: 1 })
      .insert('World')
      .insert('\n', { header: 2 });
    expect(changeSetToMarkdown(delta)).toBe('# Hello\n\n## World');
  });

  test('round-trips bold and italic', () => {
    const source = 'Hello **bold** and *italic*';
    const delta = markdownSerializer().import(source);
    expect(changeSetToMarkdown(delta)).toBe(source);
  });

  test('parses blockquotes', () => {
    const blocks = parseMarkdownBlocks('> Quote line\n> Second line');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('blockquote');
    expect(blocks[0].text).toBe('Quote line\nSecond line');
  });

  test('parses code blocks', () => {
    const source = '```typescript\nconst x = 1;\n```';
    const delta = markdownSerializer().import(source);
    expect(delta.ops).toEqual([
      { insert: 'const x = 1;' },
      { insert: '\n', attributes: { 'code-block': 'typescript' } },
    ]);
  });

  test('parses lists', () => {
    const delta = markdownSerializer().import('- Item 1\n- Item 2');
    expect(delta.ops).toEqual([
      { insert: 'Item 1' },
      { insert: '\n', attributes: { list: 'bullet' } },
      { insert: 'Item 2' },
      { insert: '\n', attributes: { list: 'bullet' } },
    ]);
  });

  test('parses links', () => {
    const delta = markdownSerializer().import('[Lextrix](https://lextrix.dev)');
    expect(delta.ops).toEqual([
      { insert: 'Lextrix', attributes: { link: 'https://lextrix.dev' } },
      { insert: '\n' },
    ]);
  });

  test('parses images', () => {
    const delta = markdownSerializer().import('![alt text](https://example.com/a.png)');
    expect(delta.ops).toEqual([
      {
        insert: { image: 'https://example.com/a.png' },
        attributes: { alt: 'alt text' },
      },
      { insert: '\n' },
    ]);
  });

  test('parses GFM tables', () => {
    const source = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const blocks = parseMarkdownBlocks(source);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('table');
    expect(blocks[0].rows).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  test('markdownBlocksToChangeSet produces valid ops', () => {
    const blocks = parseMarkdownBlocks('# Title\n\nParagraph.');
    const delta = markdownBlocksToChangeSet(blocks);
    expect(delta.length()).toBeGreaterThan(0);
  });
});
