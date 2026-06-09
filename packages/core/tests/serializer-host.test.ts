import { describe, expect, test } from 'vitest';
import {
  SerializerHost,
  createSerializerRegistry,
  jsonSerializer,
  markdownSerializer,
} from 'lextrix-serialize';

describe('SerializerHost integration', () => {
  test('parses markdown headlessly', () => {
    const host = new SerializerHost(
      createSerializerRegistry([markdownSerializer(), jsonSerializer()]),
    );
    const delta = host.parse('# Title', 'markdown');
    const json = host.stringify(delta, 'json');
    expect(JSON.parse(json)).toEqual(
      expect.arrayContaining([
        { insert: 'Title' },
        { insert: '\n', attributes: { header: 1 } },
      ]),
    );
  });

  test('lists registered formats', () => {
    const host = new SerializerHost(
      createSerializerRegistry([markdownSerializer()]),
    );
    expect(host.listFormats()).toEqual(['markdown']);
  });
});
