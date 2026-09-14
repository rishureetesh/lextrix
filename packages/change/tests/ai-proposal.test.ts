/**
 * Phase 6A — AI-neutral proposal producer architecture.
 * Uses DeterministicProposalGenerator (test fixture, not an LLM).
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  DocumentHandle,
  parseChangeProposal,
  ProposalError,
  createInMemoryCollabPair,
} from '../src/experimental/index.js';
import { DeterministicProposalGenerator } from '../src/testing/deterministic-proposal-generator.js';
import { documentsEqual } from '../src/testing/generators.js';

describe('Phase 6A AI-neutral proposals', () => {
  const gen = new DeterministicProposalGenerator();

  it('deterministic AI proposal carries source metadata', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hello\n'),
    });
    const p = gen.generate(handle.currentVersion(), 'append-world');
    expect(p.meta.source).toBe('ai');
    expect(p.meta.intent).toBe('append-world');
    expect(p.meta.explanation).toBeTruthy();
    expect(p.baseVersionId).toBe(handle.currentVersion().id);
  });

  it('metadata survives rebase; original proposal immutable', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hello\n'),
    });
    const p = gen.generate(handle.currentVersion(), 'append-world');
    handle.apply(new ChangeSet().retain(0).insert('Z'));
    const rebased = handle.rebaseProposal(p);
    expect(rebased).not.toBe(p);
    expect(p.baseVersionId).not.toBe(rebased.baseVersionId);
    expect(rebased.meta.source).toBe('ai');
    expect(rebased.meta.intent).toBe('append-world');
    expect(rebased.meta.explanation).toBe(p.meta.explanation);
    expect(rebased.id).toBe(p.id);
  });

  it('serialization round-trips ops and metadata', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('The quick brown fox.\n'),
    });
    const p = gen.generate(handle.currentVersion(), 'replace-quick-fast');
    const json = JSON.stringify(p.toJSON());
    const parsed = parseChangeProposal(json);
    expect(parsed.documentId).toBe(p.documentId);
    expect(parsed.baseVersionId).toBe(p.baseVersionId);
    expect(parsed.change.ops).toEqual(p.change.ops);
    expect(parsed.meta.source).toBe('ai');
    expect(parsed.meta.model).toBe('deterministic-v1');
  });

  it('parseChangeProposal rejects garbage', () => {
    expect(() => parseChangeProposal('{')).toThrow(ProposalError);
    expect(() =>
      parseChangeProposal({ ops: [] } as never),
    ).toThrow(ProposalError);
  });

  it('stale AI proposal rejects; inspect reports stale; rebase then accept', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hello\n'),
    });
    const p = gen.generate(handle.currentVersion(), 'append-world');
    const inspectFresh = handle.inspectProposal(p);
    expect(inspectFresh.ok).toBe(true);
    if (inspectFresh.ok) expect(inspectFresh.stale).toBe(false);

    handle.apply(new ChangeSet().retain(0).insert('>'));
    expect(() => handle.acceptProposal(p)).toThrow(ProposalError);

    const inspectStale = handle.inspectProposal(p);
    expect(inspectStale.ok).toBe(true);
    if (inspectStale.ok) expect(inspectStale.stale).toBe(true);

    const rebased = handle.rebaseProposal(p);
    const result = handle.acceptProposal(rebased);
    expect(result.empty).toBe(false);
    expect(handle.getContents().ops.some((op) => String(op.insert).includes('world') || String(op.insert).includes('Hello'))).toBe(true);
  });

  it('inspect validates against base even when stale', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('The quick brown fox.\n'),
    });
    const p = gen.generate(handle.currentVersion(), 'replace-quick-fast');
    handle.apply(new ChangeSet().retain(0).insert('X'));
    const inspected = handle.inspectProposal(p);
    expect(inspected.ok).toBe(true);
    if (inspected.ok) {
      expect(inspected.stale).toBe(true);
      expect(inspected.baseVersionId).toBe(p.baseVersionId);
    }
    // validateProposal still requires HEAD
    const v = handle.validateProposal(p);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('stale');
  });

  it('metadata does not alter ChangeSet semantics', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const change = new ChangeSet().retain(2).insert('!');
    const a = handle.createProposal(change, {
      meta: { source: 'ai', explanation: 'exclaim' },
    });
    const b = handle.createProposal(change.clone(), {
      meta: { source: 'user' },
    });
    expect(a.change.ops).toEqual(b.change.ops);
    handle.acceptProposal(a);
    expect(handle.getContents().ops).toEqual([{ insert: 'Hi!\n' }]);
  });

  it('concurrent human + AI proposals converge via explicit rebase', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const v0 = handle.currentVersion();
    const human = handle.createProposal(new ChangeSet().retain(5).insert('!'), {
      meta: { source: 'user' },
    });
    const ai = gen.generate(v0, 'insert-prefix');

    // Accept human first
    handle.acceptProposal(human);
    expect(() => handle.acceptProposal(ai)).toThrow(ProposalError);
    const ai2 = handle.rebaseProposal(ai);
    handle.acceptProposal(ai2);

    const expected = new ChangeSet()
      .insert('hello\n')
      .compose(new ChangeSet().retain(5).insert('!'))
      .compose(
        new ChangeSet()
          .retain(5)
          .insert('!')
          .transform(new ChangeSet().insert('>>').retain(6), true),
      );
    // Compare via OT pair from shared base
    const A = new ChangeSet().retain(5).insert('!');
    const B = new ChangeSet().insert('>>').retain(6);
    const left = new ChangeSet()
      .insert('hello\n')
      .compose(A)
      .compose(A.transform(B, true));
    expect(documentsEqual(handle.getContents(), left)).toBe(true);
  });

  it('AI-origin then human ordering also converges', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello\n'),
    });
    const v0 = handle.currentVersion();
    const human = handle.createProposal(new ChangeSet().retain(5).insert('!'), {
      meta: { source: 'user' },
      baseVersionId: v0.id,
    });
    const ai = gen.generate(v0, 'insert-prefix');
    handle.acceptProposal(ai);
    const human2 = handle.rebaseProposal(human);
    handle.acceptProposal(human2);

    const A = new ChangeSet().insert('>>').retain(6);
    const B = new ChangeSet().retain(5).insert('!');
    const left = new ChangeSet()
      .insert('hello\n')
      .compose(A)
      .compose(A.transform(B, true));
    expect(documentsEqual(handle.getContents(), left)).toBe(true);
  });

  it('reject AI proposal mutates nothing', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('x\n'),
    });
    const p = gen.generate(handle.currentVersion(), 'append-world');
    handle.rejectProposal(p);
    expect(handle.listVersions()).toHaveLength(1);
  });

  it('collab adapter remains source-agnostic for AI-tagged changes', () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('ab\n'));
    coordinator.setAutoDeliver(false);
    const baseA = handleA.currentVersion().id;
    const baseB = handleB.currentVersion().id;
    const aiChange = new ChangeSet().retain(0).insert('AI');
    const humanChange = new ChangeSet().retain(0).insert('H');
    handleA.apply(aiChange);
    clientA.submitLocal(aiChange, {
      baseVersionId: baseA,
      meta: { source: 'ai', intent: 'prefix' },
    });
    handleB.apply(humanChange);
    clientB.submitLocal(humanChange, {
      baseVersionId: baseB,
      meta: { source: 'user' },
    });
    coordinator.flush();
    expect(documentsEqual(handleA.getContents(), handleB.getContents())).toBe(
      true,
    );
    clientA.destroy();
    clientB.destroy();
  });
});
