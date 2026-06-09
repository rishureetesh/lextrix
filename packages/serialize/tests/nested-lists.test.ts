import { describe, expect, test } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  changeSetToMarkdown,
  changeSetsEquivalent,
  markdownSerializer,
  mdxSerializer,
} from 'lextrix-serialize';

const markdown = markdownSerializer();
const mdx = mdxSerializer();

describe('nested lists', () => {
  test('parses nested bullet list from markdown', () => {
    const source = '- Parent\n  - Child\n  - Sibling child';
    const delta = markdown.import(source);
    expect(delta.ops).toEqual([
      { insert: 'Parent' },
      { insert: '\n', attributes: { list: 'bullet' } },
      { insert: 'Child' },
      { insert: '\n', attributes: { list: 'bullet', indent: 1 } },
      { insert: 'Sibling child' },
      { insert: '\n', attributes: { list: 'bullet', indent: 1 } },
    ]);
  });

  test('exports nested bullet list to markdown', () => {
    const delta = new ChangeSet([
      { insert: 'Parent' },
      { insert: '\n', attributes: { list: 'bullet' } },
      { insert: 'Child' },
      { insert: '\n', attributes: { list: 'bullet', indent: 1 } },
    ]);
    expect(changeSetToMarkdown(delta)).toBe('- Parent\n  - Child');
  });

  test('parses nested ordered list', () => {
    const source = '1. First\n   1. Nested\n2. Second';
    const delta = markdown.import(source);
    expect(delta.ops).toEqual([
      { insert: 'First' },
      { insert: '\n', attributes: { list: 'ordered' } },
      { insert: 'Nested' },
      { insert: '\n', attributes: { list: 'ordered', indent: 1 } },
      { insert: 'Second' },
      { insert: '\n', attributes: { list: 'ordered' } },
    ]);
  });

  test('parses mixed nesting depths', () => {
    const source = '- A\n  - B\n    - C';
    const delta = markdown.import(source);
    expect(delta.ops).toEqual([
      { insert: 'A' },
      { insert: '\n', attributes: { list: 'bullet' } },
      { insert: 'B' },
      { insert: '\n', attributes: { list: 'bullet', indent: 1 } },
      { insert: 'C' },
      { insert: '\n', attributes: { list: 'bullet', indent: 2 } },
    ]);
  });

  test('markdown round-trip preserves nested structure', () => {
    const source = '- Parent\n  - Child\n    - Grandchild';
    const restored = markdown.import(markdown.export(markdown.import(source)));
    expect(changeSetsEquivalent(markdown.import(source), restored)).toBe(true);
  });

  test('mdx round-trip preserves nested structure', () => {
    const source = '- Parent\n  - Child';
    const restored = mdx.import(mdx.export(mdx.import(source)));
    expect(changeSetsEquivalent(mdx.import(source), restored)).toBe(true);
  });
});
