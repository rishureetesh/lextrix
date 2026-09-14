/**
 * Final validation — security / wire / package boundary hardening.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isCollabControlFrame } from '../src/frames.js';
import { DocumentServerSession } from '../src/server-session.js';
import ChangeSet from 'lextrix-change';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Final validation — security', () => {
  it('client-proposed actor in envelope meta is overwritten by resolveActorMeta', async () => {
    const persistence = new InMemoryAuthoritativePersistence();
    const session = await DocumentServerSession.open(
      'doc_sec',
      {
        persistence,
        resolveActorMeta: ({ actorId }) => ({
          actorId: actorId ?? 'server-stamped',
          source: 'human',
        }),
      },
      { contents: new ChangeSet([{ insert: '\n' }]), createIfMissing: true },
    );
    const r = await session.accept(
      {
        changeId: 'sec1',
        documentId: 'doc_sec',
        baseVersionId: session.getHead().id,
        change: new ChangeSet([{ insert: 'A' }]),
        dependsOn: [],
        meta: { actorId: 'forged-client', source: 'ai' },
      },
      { actorId: 'trusted' },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.version.meta?.actorId).toBe('trusted');
  });

  it('malformed envelope fails closed', async () => {
    const persistence = new InMemoryAuthoritativePersistence();
    const session = await DocumentServerSession.open(
      'doc_mal',
      { persistence },
      { contents: new ChangeSet([{ insert: '\n' }]), createIfMissing: true },
    );
    const r = await session.accept({ not: 'an envelope' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('invalid_envelope');
    expect(persistence.loadChain('doc_mal')).toHaveLength(1);
  });

  it('isCollabControlFrame discriminates presence and rejects garbage', () => {
    expect(isCollabControlFrame({ type: 'presence', role: 'update', documentId: 'd' })).toBe(
      true,
    );
    expect(isCollabControlFrame({ type: 'sync', role: 'request', documentId: 'd' })).toBe(
      true,
    );
    expect(isCollabControlFrame({ type: 'changeset' })).toBe(false);
    expect(isCollabControlFrame(null)).toBe(false);
    expect(isCollabControlFrame({ type: 'hack' })).toBe(false);
  });
});

describe('Final validation — package boundaries', () => {
  it('lextrix-collab depends only on lextrix-change', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.dependencies ?? {})).toEqual(['lextrix-change']);
  });

  it('lextrix-server has expected vendor deps only', () => {
    const pkg = JSON.parse(
      readFileSync(join(root, '../server/package.json'), 'utf8'),
    );
    const deps = Object.keys(pkg.dependencies ?? {}).sort();
    expect(deps).toEqual(['lextrix-change', 'lextrix-collab', 'pg', 'ws'].sort());
    expect(deps).not.toContain('openai');
    expect(deps).not.toContain('redis');
  });
});
