/**
 * Phase 6L–6M — Collaboration hardening & failure semantics.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  CausalDependencyError,
  createChangeId,
  createInMemoryCollabPair,
  DocumentHandle,
  ProposalError,
  RebaseError,
} from '../src/experimental/index.js';
import { DeterministicProposalGenerator } from '../src/testing/deterministic-proposal-generator.js';
import { documentsEqual } from '../src/testing/generators.js';

describe('Phase 6L–6M collaboration hardening', () => {
  it('duplicate remote delivery mutates once', () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('ab\n'));
    coordinator.setAutoDeliver(false);
    const base = handleB.currentVersion().id;
    const R = new ChangeSet().retain(2).insert('c');
    handleB.apply(R);
    const env = clientB.submitLocal(R, { baseVersionId: base });
    coordinator.flush();
    const versions = handleA.listVersions().length;
    const rev = handleA.document.revision;
    const again = clientA.ingestRemote(env);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.duplicate).toBe(true);
    expect(handleA.listVersions()).toHaveLength(versions);
    expect(handleA.document.revision).toBe(rev);
    clientA.destroy();
    clientB.destroy();
  });

  it('duplicate publish is idempotent (no second accept order entry)', () => {
    const { clientA, handleA, coordinator } = createInMemoryCollabPair(
      new ChangeSet().insert('x\n'),
    );
    coordinator.setAutoDeliver(false);
    const base = handleA.currentVersion().id;
    const L = new ChangeSet().retain(1).insert('y');
    handleA.apply(L);
    const env = clientA.submitLocal(L, {
      baseVersionId: base,
      changeId: 'fixed-id',
    });
    const orderLen = coordinator.getAcceptedOrder().length;
    coordinator.publish(env); // duplicate
    expect(coordinator.getAcceptedOrder()).toHaveLength(orderLen);
    clientA.destroy();
  });

  it('duplicate ACK is idempotent; pending stays empty', () => {
    const { clientA, handleA, coordinator } = createInMemoryCollabPair(
      new ChangeSet().insert('x\n'),
    );
    const base = handleA.currentVersion().id;
    const L = new ChangeSet().retain(1).insert('y');
    handleA.apply(L);
    clientA.submitLocal(L, { baseVersionId: base });
    // autoDeliver acks once
    expect(clientA.getPending()).toHaveLength(0);
    clientA.acknowledge(coordinator.getAcceptedOrder()[0]!);
    clientA.acknowledge(coordinator.getAcceptedOrder()[0]!);
    expect(clientA.getPending()).toHaveLength(0);
    clientA.destroy();
  });

  it('missing dependsOn throws CausalDependencyError without accepting', () => {
    const { coordinator, handleA } = createInMemoryCollabPair(
      new ChangeSet().insert('hi\n'),
    );
    const before = coordinator.getAcceptedOrder().length;
    expect(() =>
      coordinator.publish({
        changeId: createChangeId('orphan'),
        documentId: handleA.documentId,
        baseVersionId: handleA.currentVersion().id,
        change: new ChangeSet().retain(0).insert('Z'),
        dependsOn: ['never-published'],
        meta: { source: 'user' },
      }),
    ).toThrow(CausalDependencyError);
    expect(coordinator.getAcceptedOrder()).toHaveLength(before);
    expect(coordinator.has('never-published')).toBe(false);
  });

  it('wrong_document ingest does not mutate', () => {
    const { clientA, handleA } = createInMemoryCollabPair(
      new ChangeSet().insert('hi\n'),
    );
    const other = DocumentHandle.create({
      contents: new ChangeSet().insert('hi\n'),
    });
    const versions = handleA.listVersions().length;
    const result = clientA.ingestRemote({
      changeId: createChangeId('x'),
      documentId: other.documentId,
      baseVersionId: other.currentVersion().id,
      change: new ChangeSet().retain(0).insert('!'),
      dependsOn: [],
      meta: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.category).toBe('wrong_document');
      expect(result.documentMutated).toBe(false);
    }
    expect(handleA.listVersions()).toHaveLength(versions);
    clientA.destroy();
  });

  it('AI proposal concurrent with remote: stale → rebase → accept', () => {
    const gen = new DeterministicProposalGenerator();
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('Hello\n'));
    coordinator.setAutoDeliver(false);

    const proposal = gen.generate(handleA.currentVersion(), 'append-world');
    const baseB = handleB.currentVersion().id;
    const remote = new ChangeSet().retain(0).insert('>');
    handleB.apply(remote);
    clientB.submitLocal(remote, { baseVersionId: baseB });
    coordinator.flush();

    expect(proposal.baseVersionId).not.toBe(handleA.currentVersion().id);
    expect(() => handleA.acceptProposal(proposal)).toThrow(ProposalError);

    const originalMeta = { ...proposal.meta };
    const rebased = handleA.rebaseProposal(proposal);
    expect(proposal.meta).toEqual(originalMeta);
    expect(rebased.meta.source).toBe('ai');
    expect(rebased.baseVersionId).toBe(handleA.currentVersion().id);
    handleA.acceptProposal(rebased);
    expect(documentsEqual(handleA.getContents(), handleB.getContents())).toBe(
      false,
    ); // B never got AI accept — only A accepted
    // A has both remote and AI
    const text = handleA
      .getContents()
      .ops.map((op) => (typeof op.insert === 'string' ? op.insert : ''))
      .join('');
    expect(text.includes('>')).toBe(true);
    expect(text.includes('world') || text.includes('Hello')).toBe(true);
    clientA.destroy();
    clientB.destroy();
  });

  it('multi-pending locals + remote converge', () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('ab\n'));
    coordinator.setAutoDeliver(false);
    const v0a = handleA.listVersions()[0]!.id;
    const L1 = new ChangeSet().retain(2).insert('1');
    const L2 = new ChangeSet().retain(3).insert('2');
    handleA.apply(L1);
    clientA.submitLocal(L1, { baseVersionId: v0a });
    const afterL1 = handleA.currentVersion().id;
    handleA.apply(L2);
    clientA.submitLocal(L2, { baseVersionId: afterL1 });

    const baseB = handleB.currentVersion().id;
    const R = new ChangeSet().retain(0).insert('Z');
    handleB.apply(R);
    clientB.submitLocal(R, { baseVersionId: baseB });
    coordinator.flush();

    expect(documentsEqual(handleA.getContents(), handleB.getContents())).toBe(
      true,
    );
    clientA.destroy();
    clientB.destroy();
  });
});

describe('Phase 6L–6M failure atomicity', () => {
  it('failed accept leaves HEAD/versions unchanged; proposal immutable', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const p = handle.createProposal(new ChangeSet().retain(2).insert('!'), {
      meta: { source: 'ai', explanation: 'x', provider: 't' },
    });
    handle.apply(new ChangeSet().retain(0).insert('Z'));
    const before = {
      head: handle.currentVersion().id,
      count: handle.listVersions().length,
      rev: handle.document.revision,
      meta: { ...p.meta },
      base: p.baseVersionId,
      ops: p.change.ops,
    };
    expect(() => handle.acceptProposal(p)).toThrow(ProposalError);
    expect(handle.currentVersion().id).toBe(before.head);
    expect(handle.listVersions()).toHaveLength(before.count);
    expect(handle.document.revision).toBe(before.rev);
    expect(p.meta).toEqual(before.meta);
    expect(p.baseVersionId).toBe(before.base);
    expect(p.change.ops).toEqual(before.ops);
  });

  it('failed rebase (unrelated) leaves proposal and document unchanged', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const other = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const p = handle.createProposal(new ChangeSet().retain(2).insert('!'), {
      meta: { source: 'ai', model: 'm' },
    });
    const snap = {
      meta: { ...p.meta },
      base: p.baseVersionId,
      head: handle.currentVersion().id,
      count: handle.listVersions().length,
    };
    expect(() => handle.rebaseProposal(p, other.currentVersion())).toThrow(
      RebaseError,
    );
    expect(p.meta).toEqual(snap.meta);
    expect(p.baseVersionId).toBe(snap.base);
    expect(handle.currentVersion().id).toBe(snap.head);
    expect(handle.listVersions()).toHaveLength(snap.count);
  });

  it('successful rebase preserves provenance; original immutable', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const p = handle.createProposal(new ChangeSet().retain(2).insert('!'), {
      meta: {
        source: 'ai',
        provider: 'openai',
        model: 'x',
        explanation: 'bang',
        confidence: 0.5,
      },
    });
    const meta = { ...p.meta };
    handle.apply(new ChangeSet().retain(0).insert('Z'));
    const rebased = handle.rebaseProposal(p);
    expect(p.meta).toEqual(meta);
    expect(p.baseVersionId).not.toBe(rebased.baseVersionId);
    expect(rebased.meta.provider).toBe('openai');
    expect(rebased.meta.confidence).toBe(0.5);
  });
});

describe('Phase 6L–6M property: duplicate delivery', () => {
  it('80 seeds: apply(R); apply(R) ≡ apply(R)', () => {
    for (let seed = 0; seed < 80; seed++) {
      const { clientA, clientB, handleA, handleB, coordinator } =
        createInMemoryCollabPair(
          new ChangeSet().insert(`s${seed}abcdef\n`),
        );
      coordinator.setAutoDeliver(false);
      const base = handleB.currentVersion().id;
      const R = new ChangeSet()
        .retain(seed % 3)
        .insert(`R${seed}`);
      handleB.apply(R);
      const env = clientB.submitLocal(R, {
        baseVersionId: base,
        changeId: `dup-${seed}`,
      });
      coordinator.flush();
      const once = JSON.stringify(handleA.getContents().ops);
      const versions = handleA.listVersions().length;
      clientA.ingestRemote(env);
      expect(JSON.stringify(handleA.getContents().ops)).toBe(once);
      expect(handleA.listVersions()).toHaveLength(versions);
      clientA.destroy();
      clientB.destroy();
    }
  });
});
