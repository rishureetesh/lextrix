import { describe, expect, test } from 'vitest';
import {
  changeSetsEquivalent,
  jsonSerializer,
  markdownSerializer,
  mdxSerializer,
} from 'lextrix-serialize';
import { FIXTURES } from './fixtures/index.js';

const markdown = markdownSerializer();
const mdx = mdxSerializer();
const json = jsonSerializer();

describe('round-trip: JSON', () => {
  FIXTURES.forEach((fixture) => {
    if (fixture.lossy?.includes('json')) return;

    test(`${fixture.id}: ChangeSet → JSON → ChangeSet`, () => {
      const exported = json.export(fixture.changeSet);
      const restored = json.import(exported);
      expect(changeSetsEquivalent(fixture.changeSet, restored)).toBe(true);
    });
  });
});

describe('round-trip: Markdown', () => {
  FIXTURES.forEach((fixture) => {
    if (fixture.lossy?.includes('markdown')) return;

    test(`${fixture.id}: ChangeSet → Markdown → ChangeSet`, () => {
      const exported = markdown.export(fixture.changeSet);
      const restored = markdown.import(exported);
      expect(changeSetsEquivalent(fixture.changeSet, restored)).toBe(true);
    });
  });

  test('markdown fixture source round-trips', () => {
    FIXTURES.forEach((fixture) => {
      if (fixture.lossy?.includes('markdown')) return;
      const fromMd = markdown.import(fixture.markdown);
      const back = markdown.export(fromMd);
      const again = markdown.import(back);
      expect(changeSetsEquivalent(fromMd, again)).toBe(true);
    });
  });
});

describe('round-trip: MDX', () => {
  FIXTURES.forEach((fixture) => {
    if (fixture.lossy?.includes('mdx')) return;

    test(`${fixture.id}: ChangeSet → MDX → ChangeSet`, () => {
      const exported = mdx.export(fixture.changeSet);
      const restored = mdx.import(exported);
      expect(changeSetsEquivalent(fixture.changeSet, restored)).toBe(true);
    });
  });
});

describe('round-trip: cross-format via ChangeSet hub', () => {
  test('markdown export → mdx import preserves structure', () => {
    const fixture = FIXTURES.find((f) => f.id === 'heading')!;
    const md = markdown.export(fixture.changeSet);
    const viaMdx = mdx.import(md);
    expect(changeSetsEquivalent(fixture.changeSet, viaMdx)).toBe(true);
  });

  test('no direct markdown → mdx string conversion exists', () => {
    const md = '# Hello';
    const delta = markdown.import(md);
    const mdxOut = mdx.export(delta);
    expect(mdxOut).toBe('# Hello');
    expect(mdx.import(mdxOut).ops).toEqual(delta.ops);
  });
});

describe('intentional lossy conversions', () => {
  test('documents fixtures marked as lossy', () => {
    const lossy = FIXTURES.filter((f) => f.lossy && f.lossy.length > 0);
    expect(lossy.length).toBeGreaterThan(0);
    lossy.forEach((fixture) => {
      expect(fixture.lossy).toBeDefined();
    });
  });
});
