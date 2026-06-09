import { describe, expect, test } from 'vitest';
import {
  changeSetsEquivalent,
  markdownSerializer,
  mdxSerializer,
} from 'lextrix-serialize';

const markdown = markdownSerializer();
const mdx = mdxSerializer();

const GFM_TABLE = '| Name | Value |\n| --- | --- |\n| Foo | 42 |\n| Bar | 99 |';

describe('GFM table round-trip', () => {
  test('markdown import → export → import preserves structure', () => {
    const initial = markdown.import(GFM_TABLE);
    const exported = markdown.export(initial);
    const restored = markdown.import(exported);
    expect(changeSetsEquivalent(initial, restored)).toBe(true);
  });

  test('mdx export matches markdown export for GFM tables', () => {
    const initial = mdx.import(GFM_TABLE);
    expect(mdx.export(initial)).toBe(markdown.export(initial));
  });

  test('mdx import → export → import preserves structure', () => {
    const initial = mdx.import(GFM_TABLE);
    const exported = mdx.export(initial);
    const restored = mdx.import(exported);
    expect(changeSetsEquivalent(initial, restored)).toBe(true);
  });

  test('exported markdown is valid GFM table', () => {
    const exported = markdown.export(markdown.import(GFM_TABLE));
    expect(exported).toMatch(/\| Name \| Value \|/);
    expect(exported).toMatch(/\| --- \| --- \|/);
    expect(exported).toMatch(/\| Foo \| 42 \|/);
    expect(exported).toMatch(/\| Bar \| 99 \|/);
  });
});
