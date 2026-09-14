/**
 * Phase 5B — in-memory collaboration adapter convergence.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  createInMemoryCollabPair,
  InMemoryCollabCoordinator,
  InMemoryCollaborationAdapter,
  DocumentHandle,
} from '../src/experimental/index.js';
import { documentsEqual } from '../src/testing/generators.js';

describe('InMemoryCollaborationAdapter', () => {
  it('two clients concurrent same-index inserts converge', () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('hello\n'));
    coordinator.setAutoDeliver(false);

    const baseA = handleA.currentVersion().id;
    const baseB = handleB.currentVersion().id;
    const A1 = new ChangeSet().retain(0).insert('A');
    const B1 = new ChangeSet().retain(0).insert('B');

    handleA.apply(A1);
    clientA.submitLocal(A1, { baseVersionId: baseA });
    handleB.apply(B1);
    clientB.submitLocal(B1, { baseVersionId: baseB });

    coordinator.flush();

    expect(documentsEqual(handleA.getContents(), handleB.getContents())).toBe(
      true,
    );
    // Quill + accept order: A before B ⇒ final text starts with AB
    const text = handleA
      .getContents()
      .ops.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
      .join('');
    expect(text.startsWith('AB')).toBe(true);
    clientA.destroy();
    clientB.destroy();
  });

  it('three clients converge on concurrent inserts', () => {
    const coordinator = new InMemoryCollabCoordinator();
    coordinator.setAutoDeliver(false);
    const contents = new ChangeSet().insert('x\n');
    const handleA = DocumentHandle.create({ contents, validate: true });
    const handleB = DocumentHandle.create({
      contents: contents.clone(),
      documentId: handleA.documentId,
      validate: true,
    });
    const handleC = DocumentHandle.create({
      contents: contents.clone(),
      documentId: handleA.documentId,
      validate: true,
    });
    const clientA = new InMemoryCollaborationAdapter(handleA, coordinator);
    const clientB = new InMemoryCollaborationAdapter(handleB, coordinator);
    const clientC = new InMemoryCollaborationAdapter(handleC, coordinator);

    const base = handleA.currentVersion().id;
    // Separate clients have different version ids — use each client's base
    const ca = new ChangeSet().retain(0).insert('1');
    const cb = new ChangeSet().retain(0).insert('2');
    const cc = new ChangeSet().retain(0).insert('3');
    handleA.apply(ca);
    clientA.submitLocal(ca, { baseVersionId: handleA.listVersions()[0]!.id });
    handleB.apply(cb);
    clientB.submitLocal(cb, { baseVersionId: handleB.listVersions()[0]!.id });
    handleC.apply(cc);
    clientC.submitLocal(cc, { baseVersionId: handleC.listVersions()[0]!.id });
    void base;
    coordinator.flush();

    expect(documentsEqual(handleA.getContents(), handleB.getContents())).toBe(
      true,
    );
    expect(documentsEqual(handleB.getContents(), handleC.getContents())).toBe(
      true,
    );
    clientA.destroy();
    clientB.destroy();
    clientC.destroy();
  });

  it('remote while local pending reconciles', () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('hello\n'));
    coordinator.setAutoDeliver(false);

    const baseA = handleA.currentVersion().id;
    const baseB = handleB.currentVersion().id;
    const L1 = new ChangeSet().retain(5).insert('!');
    const R1 = new ChangeSet().retain(0).insert('Z');

    handleA.apply(L1);
    clientA.submitLocal(L1, { baseVersionId: baseA });
    handleB.apply(R1);
    clientB.submitLocal(R1, { baseVersionId: baseB });
    coordinator.flush();

    expect(documentsEqual(handleA.getContents(), handleB.getContents())).toBe(
      true,
    );
    expect(clientA.getPending().length).toBe(0);
    clientA.destroy();
    clientB.destroy();
  });

  it('multiple pending locals rebase against one remote', () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('ab\n'));
    coordinator.setAutoDeliver(false);

    const v0a = handleA.currentVersion().id;
    const L1 = new ChangeSet().retain(2).insert('1');
    handleA.apply(L1);
    clientA.submitLocal(L1, { baseVersionId: v0a, changeId: 'L1' });
    const v1a = handleA.currentVersion().id;
    const L2 = new ChangeSet().retain(3).insert('2');
    handleA.apply(L2);
    clientA.submitLocal(L2, { baseVersionId: v1a, changeId: 'L2' });

    expect(clientA.getPending()).toHaveLength(2);

    const v0b = handleB.currentVersion().id;
    const R = new ChangeSet().retain(0).insert('R');
    handleB.apply(R);
    clientB.submitLocal(R, { baseVersionId: v0b, changeId: 'R1' });
    coordinator.flush();

    expect(documentsEqual(handleA.getContents(), handleB.getContents())).toBe(
      true,
    );
    // A's locals were acked via echo; pending empty after flush of own ids.
    // R was remote for A; L1/L2 were acked when their envelopes delivered.
    expect(clientA.getPending().length).toBe(0);
    clientA.destroy();
    clientB.destroy();
  });

  it('duplicate remote delivery applies once', () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('ab\n'));
    const base = handleB.currentVersion().id;
    const R = new ChangeSet().retain(2).insert('c');
    handleB.apply(R);
    const env = clientB.submitLocal(R, { baseVersionId: base });

    const before = handleA.listVersions().length;
    const again = clientA.ingestRemote(env);
    expect(again.ok && again.duplicate).toBe(true);
    expect(handleA.listVersions().length).toBe(before);
    expect(coordinator.has(env.changeId)).toBe(true);
    clientA.destroy();
    clientB.destroy();
  });

  it('ack clears pending', () => {
    const { clientA, handleA } = createInMemoryCollabPair(
      new ChangeSet().insert('x\n'),
    );
    const base = handleA.currentVersion().id;
    const L = new ChangeSet().retain(1).insert('y');
    handleA.apply(L);
    const env = clientA.submitLocal(L, { baseVersionId: base });
    expect(clientA.getPending().length).toBe(0);
    expect(env.changeId).toBeTruthy();
    clientA.destroy();
  });

  it('historical versions immutable after collab', () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('hello\n'));
    coordinator.setAutoDeliver(false);
    const v0ops = handleA.currentVersion().contents.ops;
    const baseA = handleA.currentVersion().id;
    const baseB = handleB.currentVersion().id;
    handleA.apply(new ChangeSet().retain(5).insert('!'));
    clientA.submitLocal(new ChangeSet().retain(5).insert('!'), {
      baseVersionId: baseA,
    });
    handleB.apply(new ChangeSet().retain(0).insert('Z'));
    clientB.submitLocal(new ChangeSet().retain(0).insert('Z'), {
      baseVersionId: baseB,
    });
    coordinator.flush();
    expect(handleA.getVersionBySequence(0).contents.ops).toEqual(v0ops);
    clientA.destroy();
    clientB.destroy();
  });
});
