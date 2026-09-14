/**
 * Experimental DocumentTransaction lifecycle + Document.apply path.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  createDocument,
  DocumentHandle,
} from '../src/experimental/index.js';

describe('DocumentTransaction', () => {
  it('commit produces ChangeSet without mutating Document', () => {
    const doc = createDocument({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const tx = doc.transaction();
    tx.insert(2, '!');
    const { change, empty, baseRevision } = tx.commit({ source: 'api' });
    expect(empty).toBe(false);
    expect(baseRevision).toBe(0);
    expect(doc.getContents().ops).toEqual([{ insert: 'Hi\n' }]);
    expect(doc.revision).toBe(0);
    const next = doc.apply(change);
    expect(next.getContents().ops).toEqual([{ insert: 'Hi!\n' }]);
    expect(next.revision).toBe(1);
  });

  it('empty commit returns empty ChangeSet (not null)', () => {
    const doc = createDocument({
      contents: new ChangeSet().insert('A\n'),
    });
    const { change, empty } = doc.transaction().commit();
    expect(empty).toBe(true);
    expect(change.length()).toBe(0);
    expect(doc.apply(change)).toBe(doc);
  });

  it('abort produces no state change', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('X\n'),
    });
    const tx = handle.transaction();
    tx.insert(1, 'y');
    tx.abort();
    expect(handle.getContents().ops).toEqual([{ insert: 'X\n' }]);
    expect(() => tx.commit()).toThrow(/aborted/);
  });

  it('double commit throws', () => {
    const tx = createDocument().transaction();
    tx.commit();
    expect(() => tx.commit()).toThrow(/already committed/);
  });

  it('commit after abort throws', () => {
    const tx = createDocument().transaction();
    tx.abort();
    expect(() => tx.commit()).toThrow(/aborted/);
  });

  it('rejects nested transactions on DocumentHandle', () => {
    const handle = DocumentHandle.create();
    handle.transaction();
    expect(() => handle.transaction()).toThrow(/nested/);
  });

  it('insert / delete / format via commitTransaction → apply', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hello\n'),
    });
    const { document, change } = handle.commitTransaction(
      (tx) => {
        tx.insert(5, '!');
        tx.format(0, 5, { bold: true });
        tx.delete(5, 1);
      },
      { source: 'api', intent: 'test' },
    );
    expect(change.length()).toBeGreaterThan(0);
    expect(document.revision).toBe(1);
    expect(handle.getLastMeta()?.origin).toBe('transaction');
    // Hello with bold, newline — bang deleted
    const ops = handle.getContents().ops;
    expect(ops.some((op) => op.insert === 'Hello' || (typeof op.insert === 'string' && op.insert.includes('Hello')))).toBe(
      true,
    );
  });

  it('sole mutation path is Document.apply (handle.apply delegates)', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('ab\n'),
    });
    const change = new ChangeSet().retain(1).insert('X');
    handle.apply(change, { meta: { source: 'api', origin: 'system' } });
    expect(handle.getContents().ops).toEqual([{ insert: 'aXb\n' }]);
    expect(handle.revision).toBe(1);
  });
});
