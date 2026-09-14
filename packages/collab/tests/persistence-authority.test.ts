/**
 * Phase 10 — persistence CAS + package boundaries.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/document';
import {
  InMemoryAuthoritativePersistence,
} from 'lextrix-change/persistence';

describe('Phase 10 authoritative persistence', () => {
  it('compareAndAppend succeeds and fences HEAD', () => {
    const store = new InMemoryAuthoritativePersistence();
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'r\n' }]),
      documentId: 'd1',
    });
    const root = handle.currentVersion();
    const r0 = store.compareAndAppend('d1', null, root);
    expect(r0.ok).toBe(true);
    handle.apply(new ChangeSet([{ insert: 'x' }]));
    const v1 = handle.currentVersion();
    const r1 = store.compareAndAppend('d1', root.id, v1);
    expect(r1.ok).toBe(true);
    handle.apply(new ChangeSet([{ insert: 'y' }]));
    const v2 = handle.currentVersion();
    // Wrong expected head
    const bad = store.compareAndAppend('d1', root.id, v2);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toBe('cas_conflict');
  });

  it('hydrate round-trip preserves contents', () => {
    const store = new InMemoryAuthoritativePersistence();
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'h\n' }]),
      documentId: 'd2',
    });
    store.compareAndAppend('d2', null, handle.currentVersion());
    for (let i = 0; i < 5; i += 1) {
      const prev = handle.currentVersion();
      handle.apply(new ChangeSet([{ insert: `${i}` }]));
      store.compareAndAppend('d2', prev.id, handle.currentVersion());
    }
    const chain = store.loadChain('d2');
    const hydrated = DocumentHandle.fromVersions(chain);
    expect(hydrated.getContents().ops).toEqual(handle.getContents().ops);
  });
});

describe('Phase 10 package boundaries', () => {
  it('lextrix-collab depends only on lextrix-change', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['lextrix-change']);
    expect(JSON.stringify(pkg)).not.toMatch(/postgres|redis|ws\b|express|openai/i);
  });

  it('lextrix-change still has no network/db deps', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '../../change');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).not.toContain('pg');
    expect(deps).not.toContain('ws');
    expect(pkg.exports['./persistence']).toBeTruthy();
  });
});
