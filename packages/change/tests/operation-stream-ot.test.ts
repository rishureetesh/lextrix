import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import { fromLegacyOps, toLegacyOps } from '../src/operation/legacy-bridge.js';
import OperationStreamOT from '../src/pipeline/operation-stream-ot.js';
import { eachLineOperations, sliceChangeSetOperations } from '../src/pipeline/operation-stream-nav.js';

describe('OperationStreamOT', () => {
  it('composes insert ops', () => {
    const a = fromLegacyOps(new ChangeSet().insert('Hello').ops);
    const b = fromLegacyOps(new ChangeSet().retain(5).insert(' World').ops);
    expect(toLegacyOps(OperationStreamOT.compose(a, b))).toEqual([
      { insert: 'Hello World' },
    ]);
  });

  it('composes attribute retains', () => {
    const a = fromLegacyOps(
      new ChangeSet().insert('Hello', { bold: true }).ops,
    );
    const b = fromLegacyOps(new ChangeSet().retain(5, { italic: true }).ops);
    expect(toLegacyOps(OperationStreamOT.compose(a, b))).toEqual([
      { insert: 'Hello', attributes: { bold: true, italic: true } },
    ]);
  });

  it('transforms concurrent inserts', () => {
    const a = fromLegacyOps(new ChangeSet().retain(3).insert('a').ops);
    const b = fromLegacyOps(new ChangeSet().retain(3).insert('b').ops);
    expect(toLegacyOps(OperationStreamOT.transform(a, b, true))).toEqual([
      { retain: 4 },
      { insert: 'b' },
    ]);
    expect(toLegacyOps(OperationStreamOT.transform(b, a, false))).toEqual([
      { retain: 3 },
      { insert: 'a' },
    ]);
  });

  it('transformPosition respects insert priority', () => {
    const ops = fromLegacyOps(new ChangeSet().retain(2).insert('ab').ops);
    expect(OperationStreamOT.transformPosition(ops, 2, true)).toBe(2);
    expect(OperationStreamOT.transformPosition(ops, 2, false)).toBe(4);
  });

  it('diffs text with attribute changes', () => {
    const a = fromLegacyOps(
      new ChangeSet().insert('Hello', { bold: true }).ops,
    );
    const b = fromLegacyOps(
      new ChangeSet().insert('Hello', { italic: true }).ops,
    );
    expect(toLegacyOps(OperationStreamOT.diff(a, b))).toEqual([
      { retain: 5, attributes: { bold: null, italic: true } },
    ]);
  });

  it('inverts plain delete', () => {
    const base = fromLegacyOps(new ChangeSet().insert('Hello').ops);
    const change = fromLegacyOps(new ChangeSet().delete(2).ops);
    expect(toLegacyOps(OperationStreamOT.invert(change, base))).toEqual([
      { insert: 'He' },
    ]);
  });

  it('inverts attribute retain', () => {
    const base = fromLegacyOps(
      new ChangeSet().insert('Hello', { bold: true }).ops,
    );
    const change = fromLegacyOps(new ChangeSet().retain(5, { bold: null }).ops);
    expect(toLegacyOps(OperationStreamOT.invert(change, base))).toEqual([
      { retain: 5, attributes: { bold: true } },
    ]);
  });

  it('inverts embed retain via handler', () => {
    ChangeSet.registerEmbed('image', {
      compose: (a, b) => b ?? a,
      transform: (a, b) => b ?? a,
      invert: (_change, base) => base,
    });

    const base = fromLegacyOps([{ insert: { image: 'a.png' } }]);
    const change = fromLegacyOps([{ retain: { image: 'b.png' } }]);

    expect(toLegacyOps(OperationStreamOT.invert(change, base))).toEqual([
      { retain: { image: 'a.png' } },
    ]);
  });
});

describe('OperationStreamNav', () => {
  it('slices by document index', () => {
    const ops = fromLegacyOps(new ChangeSet().insert('Hello World').ops);
    expect(toLegacyOps(sliceChangeSetOperations(ops, 0, 5))).toEqual([
      { insert: 'Hello' },
    ]);
    expect(toLegacyOps(sliceChangeSetOperations(ops, 6, 11))).toEqual([
      { insert: 'World' },
    ]);
  });

  it('eachLine splits on newlines', () => {
    const ops = fromLegacyOps(
      new ChangeSet().insert('Line1\nLine2\n').ops,
    );
    const lines: string[] = [];
    eachLineOperations(ops, (line) => {
      lines.push(
        line
          .map((op) => (op.kind === 'insert' && typeof op.value === 'string' ? op.value : ''))
          .join(''),
      );
    });
    expect(lines).toEqual(['Line1', 'Line2']);
  });

  it('ChangeSet.slice uses OperationStream', () => {
    const doc = new ChangeSet().insert('Hello World');
    expect(doc.slice(0, 5).ops).toEqual([{ insert: 'Hello' }]);
  });

  it('ChangeSet.eachLine uses OperationStream', () => {
    const doc = new ChangeSet().insert('A\nB\n');
    const lines: string[] = [];
    doc.eachLine((line) => {
      lines.push(line.ops.map((op) => op.insert).join(''));
    });
    expect(lines).toEqual(['A', 'B']);
  });
});
