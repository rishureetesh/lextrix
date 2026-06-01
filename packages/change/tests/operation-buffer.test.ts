import { describe, expect, it } from 'vitest';
import { OperationBuffer } from '../src/document/operation-buffer.js';
import { pushNativeOp } from '../src/document/operation-coalesce.js';
import { toLegacyOps } from '../src/operation/legacy-bridge.js';

describe('OperationBuffer native coalescing', () => {
  it('merges adjacent deletes', () => {
    const buffer = new OperationBuffer();
    buffer.append({ kind: 'delete', count: 2 });
    buffer.append({ kind: 'delete', count: 3 });
    expect(buffer.raw).toEqual([{ kind: 'delete', count: 5 }]);
  });

  it('places insert before delete at the same index', () => {
    const buffer = new OperationBuffer();
    buffer.append({ kind: 'delete', count: 1 });
    buffer.append({ kind: 'insert', value: 'a' });
    expect(toLegacyOps([...buffer.raw])).toEqual([
      { insert: 'a' },
      { delete: 1 },
    ]);
  });

  it('merges adjacent string inserts with equal attributes', () => {
    const buffer = new OperationBuffer();
    buffer.append({ kind: 'insert', value: 'Hello' });
    buffer.append({ kind: 'insert', value: ' World' });
    expect(buffer.raw).toEqual([{ kind: 'insert', value: 'Hello World' }]);
  });

  it('merges attributed string inserts when attributes match', () => {
    const buffer = new OperationBuffer();
    buffer.append({
      kind: 'insert',
      value: 'a',
      attributes: { bold: true },
    });
    buffer.append({
      kind: 'insert',
      value: 'b',
      attributes: { bold: true },
    });
    expect(buffer.raw).toEqual([
      { kind: 'insert', value: 'ab', attributes: { bold: true } },
    ]);
  });

  it('does not merge inserts with different attributes', () => {
    const buffer = new OperationBuffer();
    buffer.append({
      kind: 'insert',
      value: 'a',
      attributes: { bold: true },
    });
    buffer.append({
      kind: 'insert',
      value: 'b',
      attributes: { italic: true },
    });
    expect(buffer.raw).toEqual([
      { kind: 'insert', value: 'a', attributes: { bold: true } },
      { kind: 'insert', value: 'b', attributes: { italic: true } },
    ]);
  });

  it('merges adjacent numeric retains with equal attributes', () => {
    const buffer = new OperationBuffer();
    buffer.append({ kind: 'retain', count: 2 });
    buffer.append({ kind: 'retain', count: 3 });
    expect(buffer.raw).toEqual([{ kind: 'retain', count: 5 }]);
  });

  it('merges attributed retains when attributes match', () => {
    const buffer = new OperationBuffer();
    buffer.append({
      kind: 'retain',
      count: 2,
      attributes: { bold: true },
    });
    buffer.append({
      kind: 'retain',
      count: 3,
      attributes: { bold: true },
    });
    expect(buffer.raw).toEqual([
      { kind: 'retain', count: 5, attributes: { bold: true } },
    ]);
  });

  it('inserts before delete when a prior op exists', () => {
    const ops = [
      { kind: 'retain' as const, count: 1 },
      { kind: 'delete' as const, count: 2 },
    ];
    pushNativeOp(ops, { kind: 'insert', value: 'x' });
    expect(toLegacyOps(ops)).toEqual([
      { retain: 1 },
      { insert: 'x' },
      { delete: 2 },
    ]);
  });

  it('appendLegacy converts once and matches ChangeSet.push semantics', () => {
    const buffer = OperationBuffer.fromLegacyOps([{ insert: 'Hello' }]);
    buffer.appendLegacy({ insert: ' World' });
    expect(buffer.toLegacyOps()).toEqual([{ insert: 'Hello World' }]);
  });

  it('chops trailing plain retain', () => {
    const buffer = new OperationBuffer();
    buffer.append({ kind: 'insert', value: 'a' });
    buffer.append({ kind: 'retain', count: 1 });
    buffer.chopTrailingRetain();
    expect(buffer.raw).toEqual([{ kind: 'insert', value: 'a' }]);
  });

  it('computes lengths without legacy conversion', () => {
    const buffer = new OperationBuffer();
    buffer.append({ kind: 'insert', value: 'abc' });
    buffer.append({ kind: 'delete', count: 1 });
    expect(buffer.contentLength()).toBe(4);
    expect(buffer.documentLength()).toBe(2);
  });
});
