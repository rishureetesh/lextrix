import { describe, expect, test } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  blocksToChangeSet,
  splitChangeSetIntoBlocks,
} from 'lextrix-serialize';

describe('change-set-blocks', () => {
  test('splits block attributes from newline ops', () => {
    const delta = new ChangeSet()
      .insert('Hello')
      .insert('\n', { header: 1 })
      .insert('World')
      .insert('\n', { header: 2 });

    const blocks = splitChangeSetIntoBlocks(delta);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].content).toEqual([{ insert: 'Hello' }]);
    expect(blocks[0].attributes).toEqual({ header: 1 });
    expect(blocks[1].attributes).toEqual({ header: 2 });
  });

  test('extracts block attrs from content ops (legacy shape)', () => {
    const delta = new ChangeSet()
      .insert('Quote', { blockquote: true })
      .insert('\n');

    const blocks = splitChangeSetIntoBlocks(delta);
    expect(blocks[0].attributes).toEqual({ blockquote: true });
    expect(blocks[0].content).toEqual([{ insert: 'Quote' }]);
  });

  test('round-trips through blocksToChangeSet', () => {
    const original = new ChangeSet()
      .insert('A', { bold: true })
      .insert('\n', { list: 'bullet' })
      .insert({ image: 'https://example.com/a.png' })
      .insert('\n');

    const restored = blocksToChangeSet(splitChangeSetIntoBlocks(original));
    expect(restored.ops).toEqual(original.ops);
  });
});
