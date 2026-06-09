import { describe, expect, test } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  changeSetsEquivalent,
  changeSetToMarkdown,
  markdownSerializer,
  mdxSerializer,
  jsonSerializer,
} from 'lextrix-serialize';

const BLOCK_ATTRS = [{}, { header: 1 }, { header: 2 }, { list: 'bullet' }] as const;

const INLINE_ATTRS = [
  {},
  { bold: true },
  { italic: true },
  { strike: true },
  { code: true },
  { link: 'https://example.com' },
] as const;

const WORDS = ['alpha', 'beta', 'gamma', 'the', 'quick', 'brown', 'fox'];

function randomWord(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function randomChangeSet(blockCount = 3): ChangeSet {
  const ops: ChangeSet['ops'] = [];
  for (let i = 0; i < blockCount; i += 1) {
    const segments = 1 + Math.floor(Math.random() * 3);
    for (let j = 0; j < segments; j += 1) {
      const attrs = INLINE_ATTRS[Math.floor(Math.random() * INLINE_ATTRS.length)];
      ops.push({
        insert: randomWord() + (j < segments - 1 ? ' ' : ''),
        ...(Object.keys(attrs).length > 0 ? { attributes: { ...attrs } } : {}),
      });
    }
    const blockAttr = BLOCK_ATTRS[Math.floor(Math.random() * BLOCK_ATTRS.length)];
    ops.push({
      insert: '\n',
      ...(Object.keys(blockAttr).length > 0
        ? { attributes: { ...blockAttr } }
        : {}),
    });
  }
  return new ChangeSet(ops);
}

describe('fuzz: markdown round-trip', () => {
  const serializer = markdownSerializer();

  test('500 random ChangeSets survive export → import', () => {
    for (let i = 0; i < 500; i += 1) {
      const original = randomChangeSet(1 + Math.floor(Math.random() * 5));
      const exported = serializer.export(original);
      const restored = serializer.import(exported);
      const reexported = serializer.export(restored);
      const rerestored = serializer.import(reexported);
      expect(changeSetsEquivalent(restored, rerestored)).toBe(true);
      expect(() => changeSetToMarkdown(rerestored)).not.toThrow();
    }
  });
});

describe('fuzz: json round-trip', () => {
  const serializer = jsonSerializer();

  test('200 random ChangeSets survive JSON round-trip', () => {
    for (let i = 0; i < 200; i += 1) {
      const original = randomChangeSet(1 + Math.floor(Math.random() * 8));
      const restored = serializer.import(serializer.export(original));
      expect(changeSetsEquivalent(original, restored)).toBe(true);
    }
  });
});

describe('fuzz: mdx round-trip (markdown subset)', () => {
  const mdx = mdxSerializer();
  const markdown = markdownSerializer();

  test('200 random ChangeSets: MDX round-trip matches markdown round-trip', () => {
    for (let i = 0; i < 200; i += 1) {
      const original = randomChangeSet(1 + Math.floor(Math.random() * 4));
      const mdExported = markdown.export(original);
      const mdxExported = mdx.export(original);
      const mdRestored = markdown.import(mdExported);
      const mdxRestored = mdx.import(mdxExported);
      expect(changeSetsEquivalent(mdRestored, mdxRestored)).toBe(true);
    }
  });
});

describe('fuzz: no invalid ops produced', () => {
  test('import never produces ops without insert/delete/retain', () => {
    const serializer = markdownSerializer();
    for (let i = 0; i < 100; i += 1) {
      const md = `# ${randomWord()}\n\n**${randomWord()}** ${randomWord()}`;
      const delta = serializer.import(md);
      delta.ops.forEach((op) => {
        const keys = ['insert', 'delete', 'retain'].filter(
          (k) => op[k as keyof typeof op] != null,
        );
        expect(keys.length).toBe(1);
      });
    }
  });
});
