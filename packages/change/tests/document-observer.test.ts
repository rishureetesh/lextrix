/**
 * Phase 8 — DocumentHandle observers (ADR-017) + ownership regressions.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  DocumentError,
  DocumentHandle,
  type DocumentChangeEvent,
} from '../src/experimental/index.js';
import { DocumentHandle as StableHandle } from '../src/document/index.js';

describe('Phase 8 DocumentHandle.subscribe', () => {
  it('notifies synchronously in apply order', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    const types: string[] = [];
    handle.subscribe((e) => {
      types.push(`${e.type}:${e.version.sequence}`);
    });
    handle.apply(new ChangeSet([{ insert: '1' }]));
    handle.apply(new ChangeSet([{ insert: '2' }]));
    handle.apply(new ChangeSet([{ insert: '3' }]));
    expect(types).toEqual(['applied:1', 'applied:2', 'applied:3']);
  });

  it('empty apply emits no event', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    let n = 0;
    handle.subscribe(() => {
      n += 1;
    });
    handle.apply(new ChangeSet());
    expect(n).toBe(0);
    expect(handle.listVersions()).toHaveLength(1);
  });

  it('empty transaction commit emits no event', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    let n = 0;
    handle.subscribe(() => {
      n += 1;
    });
    handle.commitTransaction(() => {
      /* no ops */
    });
    expect(n).toBe(0);
  });

  it('unsubscribe is idempotent and stops delivery', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    let n = 0;
    const unsub = handle.subscribe(() => {
      n += 1;
    });
    handle.apply(new ChangeSet([{ insert: 'x' }]));
    expect(n).toBe(1);
    unsub();
    unsub();
    handle.apply(new ChangeSet([{ insert: 'y' }]));
    expect(n).toBe(1);
  });

  it('duplicate subscribe delivers twice', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    let n = 0;
    const listener = () => {
      n += 1;
    };
    handle.subscribe(listener);
    handle.subscribe(listener);
    handle.apply(new ChangeSet([{ insert: 'x' }]));
    expect(n).toBe(2);
  });

  it('restore emits type restored', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'v0\n' }]),
    });
    const v0 = handle.currentVersion();
    handle.apply(new ChangeSet([{ insert: 'x' }]));
    const events: DocumentChangeEvent[] = [];
    handle.subscribe((e) => events.push(e));
    handle.restoreVersion(v0);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('restored');
    expect(events[0]!.document.contents.ops).toEqual(v0.contents.ops);
  });

  it('observer failure does not rollback Document; notifies all; rethrows', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    const seen: number[] = [];
    handle.subscribe(() => {
      seen.push(1);
      throw new Error('boom');
    });
    handle.subscribe(() => {
      seen.push(2);
    });
    const before = handle.listVersions().length;
    expect(() => handle.apply(new ChangeSet([{ insert: 'x' }]))).toThrow(
      DocumentError,
    );
    expect(seen).toEqual([1, 2]);
    expect(handle.listVersions().length).toBe(before + 1);
  });

  it('reentrancy from observer is forbidden', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    handle.subscribe(() => {
      handle.apply(new ChangeSet([{ insert: 'nested' }]));
    });
    let err: unknown;
    try {
      handle.apply(new ChangeSet([{ insert: 'x' }]));
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DocumentError);
    expect((err as DocumentError).code).toBe('observer_failed');
    expect((err as DocumentError).causeError).toBeInstanceOf(DocumentError);
    expect(((err as DocumentError).causeError as DocumentError).code).toBe(
      'reentrancy',
    );
    // Outer mutation still committed before observer ran
    expect(handle.listVersions().length).toBe(2);
  });

  it('transaction commit notifies once', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'hi\n' }]),
    });
    let n = 0;
    handle.subscribe(() => {
      n += 1;
    });
    handle.commitTransaction((tx) => {
      tx.insert(0, '>>');
    });
    expect(n).toBe(1);
  });

  it('stable lextrix-change/document export works', () => {
    const handle = StableHandle.create({
      contents: new ChangeSet([{ insert: 'z\n' }]),
    });
    let n = 0;
    handle.subscribe(() => {
      n += 1;
    });
    handle.apply(new ChangeSet([{ insert: '!' }]));
    expect(n).toBe(1);
  });
});

describe('Phase 8 ownership & identity', () => {
  it('same documentId on two Handles is not shared state', () => {
    const a = DocumentHandle.create({
      documentId: 'shared',
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    const b = DocumentHandle.create({
      documentId: 'shared',
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    a.apply(new ChangeSet([{ insert: 'X' }]));
    expect(a.listVersions()).toHaveLength(2);
    expect(b.listVersions()).toHaveLength(1);
  });

  it('sequence and revision stay aligned but are distinct fields', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'r\n' }]),
    });
    expect(handle.currentVersion().sequence).toBe(0);
    expect(handle.currentVersion().revision).toBe(0);
    expect(handle.document.versionId).toBe(handle.currentVersion().id);
    handle.apply(new ChangeSet([{ insert: 'x' }]));
    expect(handle.currentVersion().sequence).toBe(1);
    expect(handle.currentVersion().revision).toBe(1);
    expect(handle.document.versionId).toBe(handle.currentVersion().id);
  });

  it('listVersions is a frozen copy', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    const list = handle.listVersions();
    expect(Object.isFrozen(list)).toBe(true);
  });

  it('fromVersions hydrates a linear chain', () => {
    const src = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'base\n' }]),
    });
    src.apply(new ChangeSet([{ insert: '1' }]));
    src.apply(new ChangeSet([{ insert: '2' }]));
    const chain = src.listVersions();
    const hydrated = DocumentHandle.fromVersions(chain);
    expect(hydrated.documentId).toBe(src.documentId);
    expect(hydrated.listVersions()).toHaveLength(3);
    expect(JSON.stringify(hydrated.getContents().ops)).toBe(
      JSON.stringify(src.getContents().ops),
    );
    hydrated.apply(new ChangeSet([{ insert: '3' }]));
    expect(hydrated.listVersions()).toHaveLength(4);
    expect(src.listVersions()).toHaveLength(3);
  });

  it('nested transaction throws DocumentError', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    handle.transaction();
    expect(() => handle.transaction()).toThrow(DocumentError);
  });
});
