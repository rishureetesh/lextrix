import { describe, expect, test } from 'vitest';
import ChangeSet from 'lextrix-change';
import { jsonSerializer } from 'lextrix-serialize';

describe('json serializer', () => {
  test('round-trips ChangeSet ops', () => {
    const delta = new ChangeSet()
      .insert('Hello', { bold: true })
      .insert('\n', { header: 1 });
    const serializer = jsonSerializer();
    const json = serializer.export(delta);
    const restored = serializer.import(json);
    expect(restored.ops).toEqual(delta.ops);
  });

  test('accepts ops array directly', () => {
    const ops = [{ insert: 'test\n' }];
    const restored = jsonSerializer().import(JSON.stringify(ops));
    expect(restored.ops).toEqual(ops);
  });

  test('rejects invalid JSON', () => {
    expect(() => jsonSerializer().import('not json')).toThrow(/failed to parse/);
  });

  test('rejects invalid op shape', () => {
    expect(() => jsonSerializer().import('[{}]')).toThrow(/insert, delete, retain/);
  });
});
