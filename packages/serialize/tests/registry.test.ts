import { describe, expect, test } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  SerializerHost,
  SerializerRegistry,
  createSerializerRegistry,
  jsonSerializer,
  markdownSerializer,
  mdxSerializer,
  registerSerializer,
  getGlobalSerializerRegistry,
} from 'lextrix-serialize';

describe('serializer registry', () => {
  test('registers and resolves serializers', () => {
    const registry = new SerializerRegistry();
    registry.register(jsonSerializer());
    registry.register(markdownSerializer());

    expect(registry.list()).toEqual(['json', 'markdown']);
    expect(registry.resolve('json').format).toBe('json');
  });

  test('throws for unknown format', () => {
    const registry = createSerializerRegistry();
    expect(() => registry.resolve('docx')).toThrow(/No serializer registered/);
  });

  test('registerSerializer adds to global registry', () => {
    const custom = {
      format: `custom-test-format-${Date.now()}`,
      import: (_content: string) =>
        new ChangeSet([{ insert: 'custom' }, { insert: '\n' }]),
      export: () => 'custom',
    };
    registerSerializer(custom);
    expect(getGlobalSerializerRegistry().has(custom.format)).toBe(true);
    expect(custom.import('')).toBeInstanceOf(ChangeSet);
  });

  test('resolve falls back to extended format', () => {
    const registry = createSerializerRegistry([mdxSerializer()]);
    expect(registry.resolve('markdown').format).toBe('mdx');
  });

  test('SerializerHost headless parse and stringify', () => {
    const host = new SerializerHost(
      createSerializerRegistry([markdownSerializer()]),
    );
    const delta = host.parse('# Hello', 'markdown');
    const output = host.stringify(delta, 'markdown');
    expect(output).toBe('# Hello');
  });
});
