/**
 * Phase 10 — client reconnect / ACK / multi-client harness.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/document';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';
import {
  AuthoritativeClientSession,
  DocumentServerSession,
  type CollabControlFrame,
} from '../src/index.js';

describe('Phase 10 client + reconnect', () => {
  it('history ACK advances confirmed; pending cleared for that changeId only', async () => {
    const persistence = new InMemoryAuthoritativePersistence();
    const session = await DocumentServerSession.open(
      'doc_cli',
      { persistence },
      { contents: new ChangeSet([{ insert: 'a\n' }]), createIfMissing: true },
    );
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
      documentId: 'doc_cli',
      validate: true,
    });
    // Align client root id by hydrating from server
    const chain = persistence.loadChain('doc_cli');
    const clientHandle = DocumentHandle.fromVersions(chain);
    const outbound: CollabControlFrame[] = [];
    const client = new AuthoritativeClientSession({
      handle: clientHandle,
      send: (f) => {
        outbound.push(f);
      },
    });

    const change = new ChangeSet([{ insert: 'Z' }]);
    client.submitLocal(change, { changeId: 'local1' });
    const envFrame = outbound.find((f) => f.type === 'envelope');
    expect(envFrame).toBeTruthy();

    session.subscribe((f) => client.onFrame(f));
    const result = await session.accept(envFrame!);
    expect(result.ok).toBe(true);
    // Deliver frames already via subscribe — confirmed should advance
    expect(client.getConfirmedVersion()?.id).toBe(
      result.ok ? result.version.id : null,
    );
    expect(client.getPending()).toHaveLength(0);
  });

  it('reconnect sync + rebase + resubmit same changeId is idempotent', async () => {
    const persistence = new InMemoryAuthoritativePersistence();
    const server = await DocumentServerSession.open(
      'doc_rc',
      { persistence },
      { contents: new ChangeSet([{ insert: 'base\n' }]), createIfMissing: true },
    );

    const clientHandle = DocumentHandle.fromVersions(
      persistence.loadChain('doc_rc'),
    );
    const pendingFrames: CollabControlFrame[] = [];
    const client = new AuthoritativeClientSession({
      handle: clientHandle,
      send: async (f) => {
        pendingFrames.push(f);
        if (f.type === 'envelope') {
          const r = await server.accept(f);
          for (const frame of r.frames) client.onFrame(frame);
        }
        if (f.type === 'sync' && f.role === 'request') {
          const resp = await server.sync(f);
          client.onFrame(resp);
        }
      },
    });

    // Local pending while "disconnected" — apply local without sending
    const offline = new ChangeSet([{ insert: 'OFF' }]);
    client.getHandle().apply(offline, {
      meta: { source: 'user', origin: 'editor', changeId: 'off1' },
    });
    // Manually seed pending as if submitted then disconnected before ACK
    (client as unknown as { pending: Array<{
      changeId: string;
      original: ChangeSet;
      applied: ChangeSet;
      baseVersionId: string;
      inFlight: boolean;
    }> }).pending.push({
      changeId: 'off1',
      original: offline.freeze(),
      applied: offline.freeze(),
      baseVersionId: persistence.loadChain('doc_rc')[0]!.id,
      inFlight: false,
    });

    // Server advances while client offline
    await server.accept({
      changeId: 'remote1',
      documentId: 'doc_rc',
      baseVersionId: server.getHead().id,
      change: new ChangeSet([{ insert: 'R' }]),
      dependsOn: [],
      meta: {},
    });

    // Reconnect
    client.beginReconnectSync();
    // flush async sends
    await new Promise((r) => setTimeout(r, 10));

    // Accept off1 again should be idempotent if already accepted during rebase
    const again = await server.accept({
      changeId: 'off1',
      documentId: 'doc_rc',
      baseVersionId: server.getHead().id,
      change: new ChangeSet([{ insert: 'OFF' }]),
      dependsOn: [],
      meta: {},
    });
    // Either already accepted (duplicate) or newly accepted once
    if (again.ok) {
      const third = await server.accept({
        changeId: 'off1',
        documentId: 'doc_rc',
        baseVersionId: again.version.parentId ?? again.version.id,
        change: new ChangeSet([{ insert: 'OFF' }]),
        dependsOn: [],
        meta: {},
      });
      expect(third.ok && third.duplicate).toBe(true);
    }
    const versions = persistence.loadChain('doc_rc');
    const offCount = versions.filter((v) =>
      JSON.stringify(v.changeFromParent?.ops ?? []).includes('OFF'),
    ).length;
    expect(offCount).toBeLessThanOrEqual(1);
  });
});

describe('Phase 10 multi-client convergence', () => {
  it('3 clients concurrent edits converge', async () => {
    const persistence = new InMemoryAuthoritativePersistence();
    const server = await DocumentServerSession.open(
      'doc_m',
      { persistence },
      { contents: new ChangeSet([{ insert: 'go\n' }]), createIfMissing: true },
    );

    function makeClient(id: string) {
      const handle = DocumentHandle.fromVersions(persistence.loadChain('doc_m'));
      const client = new AuthoritativeClientSession({
        handle,
        createChangeId: () => `${id}_${Math.random().toString(36).slice(2, 8)}`,
        send: async (f) => {
          if (f.type === 'envelope') {
            const r = await server.accept(f);
            for (const frame of r.frames) {
              client.onFrame(frame);
              // fan-out to siblings via outer
              fanout(frame, client);
            }
          }
        },
      });
      return client;
    }

    const clients: AuthoritativeClientSession[] = [];
    const fanout = (frame: CollabControlFrame, except: AuthoritativeClientSession) => {
      for (const c of clients) {
        if (c !== except) c.onFrame(frame);
      }
    };

    const cA = makeClient('A');
    const cB = makeClient('B');
    const cC = makeClient('C');
    clients.push(cA, cB, cC);

    cA.submitLocal(new ChangeSet([{ insert: 'A' }]));
    cB.submitLocal(new ChangeSet([{ retain: 1 }, { insert: 'B' }]));
    cC.submitLocal(new ChangeSet([{ insert: 'C' }]));
    await new Promise((r) => setTimeout(r, 50));

    const opsA = cA.getHandle().getContents().ops;
    const opsB = cB.getHandle().getContents().ops;
    const opsC = cC.getHandle().getContents().ops;
    expect(opsA).toEqual(opsB);
    expect(opsB).toEqual(opsC);
    expect(server.getHead().contents.ops).toEqual(opsA);
  });
});
