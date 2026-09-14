/**
 * Phase 9 — transport envelope-only, ACK ladder, confirmed vs HEAD.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  COLLAB_ACK_LEVELS,
  InMemoryCollaborationTransport,
  isCollabAckLevel,
  TransportError,
} from '../src/collaboration/index.js';
import {
  CausalDependencyError,
  createInMemoryCollabPair,
} from '../src/experimental/collaboration.js';
import {
  parseCollabEnvelope,
  serializeCollabEnvelope,
} from '../src/wire/index.js';

describe('Phase 9 transport', () => {
  it('carries serialized envelopes without understanding ChangeSet ops', () => {
    const { clientA, handleA } = createInMemoryCollabPair(
      new ChangeSet([{ insert: 'hi\n' }]),
    );
    const change = new ChangeSet([{ insert: '!' }]);
    const base = handleA.currentVersion().id;
    handleA.apply(change);
    const env = clientA.submitLocal(change, { baseVersionId: base });
    const wire = serializeCollabEnvelope(env);

    const transport = new InMemoryCollaborationTransport();
    let received: unknown;
    transport.onMessage((msg) => {
      received = msg;
    });
    transport.send(wire);

    expect(received).toEqual(wire);
    // Transport never inspects ops — only opaque wire
    expect(transport.sent).toHaveLength(1);
    const parsed = parseCollabEnvelope(received);
    expect(parsed.changeId).toBe(env.changeId);
    expect(parsed.change.ops).toEqual(env.change.ops);
    clientA.destroy();
  });

  it('envelope round trip preserves normative fields', () => {
    const { clientA, handleA } = createInMemoryCollabPair(
      new ChangeSet([{ insert: 'x\n' }]),
    );
    const change = new ChangeSet([{ retain: 1 }, { insert: 'Y' }]);
    const base = handleA.currentVersion().id;
    handleA.apply(change);
    const env = clientA.submitLocal(change, { baseVersionId: base });
    const again = parseCollabEnvelope(serializeCollabEnvelope(env));
    expect(again.changeId).toBe(env.changeId);
    expect(again.documentId).toBe(env.documentId);
    expect(again.baseVersionId).toBe(env.baseVersionId);
    expect(again.dependsOn).toEqual(env.dependsOn);
    expect(again.change.ops).toEqual(env.change.ops);
    clientA.destroy();
  });

  it('disconnect raises transport_error class', () => {
    const t = new InMemoryCollaborationTransport();
    t.disconnect();
    expect(() => t.send({ kind: 'collab-envelope' })).toThrow(TransportError);
  });
});

describe('Phase 9 ACK ladder', () => {
  it('defines four distinct levels', () => {
    expect(COLLAB_ACK_LEVELS).toEqual([
      'received',
      'persisted',
      'accepted',
      'history',
    ]);
    for (const level of COLLAB_ACK_LEVELS) {
      expect(isCollabAckLevel(level)).toBe(true);
    }
    expect(isCollabAckLevel('ack')).toBe(false);
    expect(isCollabAckLevel('ok')).toBe(false);
  });

  it('received/persisted do not clear pending or set confirmed', () => {
    const { clientA, handleA, coordinator } = createInMemoryCollabPair(
      new ChangeSet([{ insert: 'a\n' }]),
    );
    coordinator.setAutoDeliver(false);
    const change = new ChangeSet([{ insert: 'b' }]);
    const base = handleA.currentVersion().id;
    handleA.apply(change);
    const env = clientA.submitLocal(change, { baseVersionId: base });
    expect(clientA.getPending()).toHaveLength(1);
    expect(clientA.getConfirmedVersion()).toBeNull();

    clientA.processAck({ changeId: env.changeId, level: 'received' });
    expect(clientA.getAckLevel(env.changeId)).toBe('received');
    expect(clientA.getPending()).toHaveLength(1);
    expect(clientA.getConfirmedVersion()).toBeNull();

    clientA.processAck({ changeId: env.changeId, level: 'persisted' });
    expect(clientA.getAckLevel(env.changeId)).toBe('persisted');
    expect(clientA.getPending()).toHaveLength(1);
    expect(clientA.getConfirmedVersion()).toBeNull();

    clientA.destroy();
  });

  it('accepted clears pending; history sets confirmed ≠ HEAD when pending remain', () => {
    const { clientA, handleA, coordinator } = createInMemoryCollabPair(
      new ChangeSet([{ insert: 'a\n' }]),
    );
    coordinator.setAutoDeliver(false);
    const c1 = new ChangeSet([{ insert: '1' }]);
    const c2 = new ChangeSet([{ insert: '2' }]);
    const base1 = handleA.currentVersion().id;
    handleA.apply(c1);
    const env1 = clientA.submitLocal(c1, { baseVersionId: base1 });
    const after1 = handleA.currentVersion();
    const base2 = after1.id;
    handleA.apply(c2);
    const env2 = clientA.submitLocal(c2, { baseVersionId: base2 });
    expect(clientA.getPending()).toHaveLength(2);
    expect(clientA.getLocalHead().id).toBe(handleA.currentVersion().id);

    clientA.processAck({ changeId: env1.changeId, level: 'accepted' });
    expect(clientA.getPending()).toHaveLength(1);
    expect(clientA.getConfirmedVersion()).toBeNull();

    clientA.processAck({
      changeId: env1.changeId,
      level: 'history',
      versionId: after1.id,
    });
    expect(clientA.getConfirmedVersion()?.id).toBe(after1.id);
    expect(clientA.getLocalHead().id).not.toBe(after1.id);
    expect(clientA.getAckLevel(env2.changeId)).toBeUndefined();
    clientA.destroy();
  });
});

describe('Phase 9 causality', () => {
  it('missing dependsOn is rejected', () => {
    const { clientA, handleA, coordinator } = createInMemoryCollabPair(
      new ChangeSet([{ insert: 'a\n' }]),
    );
    coordinator.setAutoDeliver(false);
    const c1 = new ChangeSet([{ insert: '1' }]);
    const c2 = new ChangeSet([{ insert: '2' }]);
    const base = handleA.currentVersion().id;
    handleA.apply(c1);
    clientA.submitLocal(c1, { baseVersionId: base });
    handleA.apply(c2);
    // Force publish with fake dependsOn missing
    expect(() =>
      coordinator.publish({
        changeId: 'orphan',
        documentId: handleA.documentId,
        baseVersionId: handleA.currentVersion().id,
        change: c2,
        dependsOn: ['never-published'],
        meta: {},
      }),
    ).toThrow(CausalDependencyError);
    clientA.destroy();
  });

  it('duplicate changeId publish is idempotent', () => {
    const { clientA, handleA, coordinator } = createInMemoryCollabPair(
      new ChangeSet([{ insert: 'a\n' }]),
    );
    coordinator.setAutoDeliver(false);
    const c = new ChangeSet([{ insert: 'x' }]);
    const base = handleA.currentVersion().id;
    handleA.apply(c);
    const env = clientA.submitLocal(c, { baseVersionId: base });
    expect(() => coordinator.publish(env)).not.toThrow();
    expect(coordinator.getAcceptedOrder()).toEqual([env.changeId]);
    clientA.destroy();
  });
});
