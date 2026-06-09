import { describe, expect, test } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  SerializationError,
  findLossyMarkdownIssues,
  getMarkdownExportWarnings,
  findNativeTableCells,
  markdownSerializer,
  mdxSerializer,
  validateMarkdownExport,
} from 'lextrix-serialize';

describe('serialization safety', () => {
  test('detects native editor table row-ids', () => {
    const delta = new ChangeSet([
      { insert: 'A1' },
      { insert: '\n', attributes: { table: 'a' } },
    ]);
    const issues = findNativeTableCells(delta);
    expect(issues).toHaveLength(1);
    expect(issues[0].safety).toBe('unsupported');
    expect(issues[0].message).toContain('exportContent("html")');
  });

  test('blocks markdown export of native editor tables', () => {
    const delta = new ChangeSet([
      { insert: 'A1' },
      { insert: '\n', attributes: { table: 'row-1' } },
    ]);
    expect(() => markdownSerializer().export(delta)).toThrow(SerializationError);
    expect(() => markdownSerializer().export(delta)).toThrow(
      /TABLE_EXPORT_UNSUPPORTED|native editor table/i,
    );
  });

  test('blocks mdx export of native editor tables', () => {
    const delta = new ChangeSet([
      { insert: 'B1' },
      { insert: '\n', attributes: { table: 'b' } },
    ]);
    expect(() => mdxSerializer().export(delta)).toThrow(SerializationError);
  });

  test('allows markdown export of GFM-imported tables', () => {
    const source = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const delta = markdownSerializer().import(source);
    expect(() => markdownSerializer().export(delta)).not.toThrow();
    const exported = markdownSerializer().export(delta);
    expect(exported).toContain('| A | B |');
    expect(exported).toContain('| 1 | 2 |');
  });

  test('documents lossy bold+italic conversion', () => {
    const delta = new ChangeSet([
      {
        insert: 'text',
        attributes: { bold: true, italic: true },
      },
      { insert: '\n' },
    ]);
    const issues = findLossyMarkdownIssues(delta);
    expect(issues.some((i) => i.feature === 'bold+italic')).toBe(true);
  });

  test('warns when color is present for markdown export', () => {
    const delta = new ChangeSet([
      { insert: 'red', attributes: { color: '#f00' } },
      { insert: '\n' },
    ]);
    const issues = getMarkdownExportWarnings(delta);
    expect(issues.some((i) => i.feature === 'color' && i.safety === 'lossy')).toBe(
      true,
    );
  });

  test('validateMarkdownExport passes for flat lists', () => {
    const delta = new ChangeSet([
      { insert: 'Item' },
      { insert: '\n', attributes: { list: 'bullet' } },
    ]);
    expect(() => validateMarkdownExport(delta)).not.toThrow();
  });
});
