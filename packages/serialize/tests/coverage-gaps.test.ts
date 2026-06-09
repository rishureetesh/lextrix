import { describe, expect, test } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  SerializerHost,
  changeSetToMarkdown,
  createDefaultSerializers,
  createSerializerRegistry,
  getGlobalMdxComponentRegistry,
  getGlobalSerializerRegistry,
  jsonSerializer,
  markdownSerializer,
  registerMdxComponent,
  registerSerializer,
  unregisterSerializer,
} from 'lextrix-serialize';
import type { SerializerAdapter } from 'lextrix-serialize';

describe('coverage: defaults and registry', () => {
  test('createDefaultSerializers returns all built-in formats', () => {
    const serializers = createDefaultSerializers();
    expect(serializers.map((s) => s.format)).toEqual([
      'json',
      'html',
      'markdown',
      'mdx',
    ]);
  });

  test('mergeFrom registers formats not already present', () => {
    const target = createSerializerRegistry([jsonSerializer()]);
    const source = createSerializerRegistry([markdownSerializer()]);
    target.mergeFrom(source);
    expect(target.list()).toEqual(['json', 'markdown']);
    expect(target.resolve('markdown').format).toBe('markdown');
  });

  test('unregisterSerializer removes global format', () => {
    const format = `temp-format-${Date.now()}`;
    const custom = {
      format,
      import: () => new ChangeSet(),
      export: () => '',
    };
    registerSerializer(custom);
    expect(getGlobalSerializerRegistry().has(format)).toBe(true);
    expect(unregisterSerializer(format)).toBe(true);
    expect(getGlobalSerializerRegistry().has(format)).toBe(false);
  });
});

describe('coverage: SerializerHost', () => {
  test('export without adapter throws', () => {
    const host = new SerializerHost(createSerializerRegistry([markdownSerializer()]));
    expect(() => host.export('markdown')).toThrow(/no editor adapter bound/);
  });

  test('setAdapter enables export and import', () => {
    const delta = new ChangeSet([{ insert: 'Hello' }, { insert: '\n' }]);
    const adapter: SerializerAdapter = {
      getChangeSet: () => delta,
      setChangeSet: () => {},
    };
    const host = new SerializerHost(
      createSerializerRegistry([markdownSerializer()]),
      adapter,
    );
    expect(host.listFormats()).toEqual(['markdown']);
    expect(host.export('markdown')).toBe('Hello');
    expect(host.import('# Title', 'markdown').ops).toEqual([
      { insert: 'Title' },
      { insert: '\n', attributes: { header: 1 } },
    ]);
    host.setAdapter(adapter);
    expect(host.export({ format: 'markdown', index: 0, length: 5 })).toBe('Hello');
  });
});

describe('coverage: json validation', () => {
  const serializer = jsonSerializer();

  test('rejects non-array document shape', () => {
    expect(() => serializer.import('{"foo": 1}')).toThrow(/expected ChangeSet ops/);
  });

  test('rejects null op', () => {
    expect(() => serializer.import('[null]')).toThrow(/expected object/);
  });

  test('rejects empty operation', () => {
    expect(() => serializer.import('[{"insert": null}]')).toThrow(/empty operation/);
  });
});

describe('coverage: markdown emit edge cases', () => {
  test('exports task list prefixes', () => {
    const checked = new ChangeSet([
      { insert: 'Done' },
      { insert: '\n', attributes: { list: 'checked' } },
    ]);
    const unchecked = new ChangeSet([
      { insert: 'Todo' },
      { insert: '\n', attributes: { list: 'unchecked' } },
    ]);
    expect(changeSetToMarkdown(checked)).toContain('- [x] Done');
    expect(changeSetToMarkdown(unchecked)).toContain('- [ ] Todo');
  });

  test('exports ordered list with indent', () => {
    const delta = new ChangeSet([
      { insert: 'Nested' },
      { insert: '\n', attributes: { list: 'ordered', indent: 1 } },
    ]);
    expect(changeSetToMarkdown(delta)).toContain('  1. Nested');
  });

  test('exports horizontal rule text (escaped in markdown)', () => {
    const delta = new ChangeSet([{ insert: '---' }, { insert: '\n' }]);
    expect(changeSetToMarkdown(delta)).toBe('\\-\\-\\-');
  });

  test('exports GFM table from imported markdown', () => {
    const source = '| A | B |\n| --- | --- |\n| 1 | 2 |';
    const delta = markdownSerializer().import(source);
    const md = changeSetToMarkdown(delta);
    expect(md).toContain('|');
    expect(md).toContain('A');
    expect(md).toContain('B');
  });

  test('exports standalone image block', () => {
    const delta = new ChangeSet([
      {
        insert: { image: 'https://example.com/x.png' },
        attributes: { alt: 'Alt' },
      },
      { insert: '\n' },
    ]);
    expect(changeSetToMarkdown(delta)).toBe('![Alt](https://example.com/x.png)');
  });
});

describe('coverage: MDX component registry', () => {
  test('registerMdxComponent and registry methods', () => {
    const tag = `Alert-${Date.now()}`;
    registerMdxComponent({ tag, fromChangeSet: () => '<Alert />' });
    const registry = getGlobalMdxComponentRegistry();
    expect(registry.has(tag)).toBe(true);
    expect(registry.list()).toContain(tag.toLowerCase());
    expect(registry.get(tag)?.tag).toBe(tag);
    expect(registry.unregister(tag)).toBe(true);
    expect(registry.has(tag)).toBe(false);
  });
});
