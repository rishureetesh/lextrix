/**
 * Phase 11 WebSocket + AuthZ host tests (no Postgres required).
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';
import { serializeCollabEnvelope } from 'lextrix-change/wire';
import { InMemoryDocumentOwnership } from 'lextrix-collab';
import { CollabHost } from '../src/host.js';
import { createCountingObserver } from '../src/observe.js';
import type { WsCollabConnection } from '../src/ws/index.js';

class SyncedOwnership extends InMemoryDocumentOwnership {
  constructor(
    private p: InMemoryAuthoritativePersistence,
    opts: ConstructorParameters<typeof InMemoryDocumentOwnership>[0],
  ) {
    super(opts);
  }
  override async acquire(documentId: string) {
    const epoch = this.p.bumpOwnerEpoch(documentId);
    const base = await super.acquire(documentId);
    return { ...base, ownerEpoch: epoch };
  }
}

function fakeConn(id: string): {
  conn: WsCollabConnection;
  sent: unknown[];
} {
  const sent: unknown[] = [];
  return {
    sent,
    conn: {
      id,
      send: (f) => {
        sent.push(f);
      },
      close: () => {},
    },
  };
}

describe('Phase 11 host AuthZ + frames', () => {
  it('rejects unauthorized submit', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const ownership = new SyncedOwnership(persist, { ownerId: 'h1' });
    const host = new CollabHost({
      persistence: persist,
      ownership,
      ownerId: 'h1',
      auth: {
        authenticate: () => ({ principalId: 'u1' }),
        authorize: ({ op }) => op !== 'submit',
      },
    });
    const { conn, sent } = fakeConn('c1');
    await host.onConnect(conn, { headers: {} });
    await host.onMessage(conn, {
      type: 'envelope',
      body: serializeCollabEnvelope({
        changeId: 'x',
        documentId: 'd_auth',
        baseVersionId: 'd_auth:v0',
        change: new ChangeSet([{ insert: 'Z' }]),
        dependsOn: [],
        meta: {},
      }),
    });
    expect(
      sent.some((f) => (f as { code?: string }).code === 'authorization_failed'),
    ).toBe(true);
  });

  it('accepts authorized submit and records metrics', async () => {
    const persist = new InMemoryAuthoritativePersistence();
    const ownership = new SyncedOwnership(persist, { ownerId: 'h2' });
    const { observe, counts } = createCountingObserver();
    const host = new CollabHost({
      persistence: persist,
      ownership,
      ownerId: 'h2',
      auth: {
        authenticate: () => ({ principalId: 'u2' }),
        authorize: () => true,
      },
      observe,
    });
    const { conn, sent } = fakeConn('c2');
    await host.onConnect(conn, { token: 'u2', headers: {} });

    await host.onMessage(conn, {
      type: 'sync',
      role: 'request',
      documentId: 'd_ok',
    });
    const syncResp = sent.find(
      (f) => (f as { type?: string }).type === 'sync',
    ) as { headVersionId?: string } | undefined;
    expect(syncResp?.headVersionId).toBeTruthy();

    await host.onMessage(conn, {
      type: 'envelope',
      body: serializeCollabEnvelope({
        changeId: 'ok1',
        documentId: 'd_ok',
        baseVersionId: syncResp!.headVersionId!,
        change: new ChangeSet([{ insert: '!' }]),
        dependsOn: [],
        meta: {},
      }),
    });
    expect(counts.get('accepted') ?? 0).toBeGreaterThan(0);
    expect(counts.get('history_ack') ?? 0).toBeGreaterThan(0);
  });
});
