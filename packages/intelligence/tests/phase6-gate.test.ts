/**
 * Phase 6O–6P — Cross-layer final gate properties (deterministic; no network).
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/experimental';
import {
  acceptReviewedProposal,
  createIntelligenceRequest,
  createProposalReview,
  DeterministicDocumentIntelligenceProvider,
  evaluateProposalAcceptancePolicy,
  readProposalProvenance,
} from '../src/index.js';

describe('Phase 6O–6P cross-layer properties', () => {
  const provider = new DeterministicDocumentIntelligenceProvider();

  it('Property A: accept(P) equals Document.apply(P.change)', async () => {
    const contents = new ChangeSet().insert('The quick brown fox.\n');
    const h1 = DocumentHandle.create({ contents: contents.clone() });
    const h2 = DocumentHandle.create({
      contents: contents.clone(),
      documentId: h1.documentId,
    });
    // Align versions by using separate handles with same initial contents
    const handleAccept = DocumentHandle.create({ contents: contents.clone() });
    const handleApply = DocumentHandle.create({ contents: contents.clone() });

    const proposal = await provider.generate(
      createIntelligenceRequest(handleAccept, {
        instruction: 'replace:fast',
        operation: 'replace',
        range: handleAccept.createRange(4, 9),
        context: { replacement: 'fast' },
      }),
    );
    // Mirror proposal onto apply handle with matching base
    const mirrored = handleApply.createProposal(proposal.change.clone(), {
      meta: { ...proposal.meta },
    });

    acceptReviewedProposal(handleAccept, proposal, {
      acknowledgeReview: true,
    });
    handleApply.apply(mirrored.change, { meta: mirrored.meta, validate: true });

    expect(JSON.stringify(handleAccept.getContents().ops)).toBe(
      JSON.stringify(handleApply.getContents().ops),
    );
    void h1;
    void h2;
  });

  it('Property B: rebase matches OT transform through intervening change', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hello\n'),
    });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'uppercase',
        operation: 'transform',
        range: handle.createRange(0, 5),
      }),
    );
    const intervening = new ChangeSet().retain(0).insert('>');
    handle.apply(intervening);
    const rebased = handle.rebaseProposal(proposal);
    const expected = intervening.transform(proposal.change, true);
    expect(rebased.change.ops).toEqual(expected.ops);
    expect(rebased.baseVersionId).toBe(handle.currentVersion().id);
    expect(proposal.baseVersionId).not.toBe(rebased.baseVersionId);
  });

  it('Property D: provenance-only differences do not change ChangeSet/OT', () => {
    const change = new ChangeSet().retain(2).insert('!');
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const a = handle.createProposal(change.clone(), {
      meta: {
        source: 'ai',
        explanation: 'execute this',
        confidence: 1,
        provider: 'trusted',
      },
    });
    const b = handle.createProposal(change.clone(), {
      meta: { source: 'user' },
    });
    expect(a.change.ops).toEqual(b.change.ops);
    const other = new ChangeSet().retain(0).insert('X');
    expect(a.change.transform(other, true).ops).toEqual(
      b.change.transform(other, true).ops,
    );
  });

  it('Property E: review is pure (no Document mutation)', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcdefghij\n'),
    });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'uppercase',
        operation: 'transform',
        range: handle.createRange(0, 5),
      }),
    );
    const snap = {
      head: handle.currentVersion().id,
      versions: handle.listVersions().length,
      rev: handle.document.revision,
      ops: JSON.stringify(handle.getContents().ops),
    };
    const review = createProposalReview({ handle, proposal });
    evaluateProposalAcceptancePolicy({
      proposal,
      context: { headVersionId: handle.currentVersion().id },
    });
    readProposalProvenance(proposal);
    expect(review.status).toBe('pending');
    expect(handle.currentVersion().id).toBe(snap.head);
    expect(handle.listVersions()).toHaveLength(snap.versions);
    expect(handle.document.revision).toBe(snap.rev);
    expect(JSON.stringify(handle.getContents().ops)).toBe(snap.ops);
  });

  it('smoke: generate → review → accept → Version (deterministic)', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hello world\n'),
    });
    const before = handle.listVersions().length;
    const request = createIntelligenceRequest(handle, {
      instruction: 'replace:HELLO WORLD',
      operation: 'replace',
      range: handle.createRange(0, 11),
      context: { replacement: 'HELLO WORLD' },
    });
    const proposal = await provider.generate(request);
    const review = createProposalReview({
      handle,
      proposal,
      range: request.range ?? undefined,
    });
    expect(review.status).toBe('pending');
    expect(review.policy.autoAcceptAllowed).toBe(false);
    const result = acceptReviewedProposal(handle, proposal, {
      acknowledgeReview: true,
    });
    expect(result.empty).toBe(false);
    expect(handle.listVersions()).toHaveLength(before + 1);
    expect(result.version.meta?.source).toBe('ai');
    expect(handle.getContents().ops[0]?.insert).toBe('HELLO WORLD\n');
  });

  it('security smoke: malicious-looking meta remains data', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const proposal = handle.createProposal(
      new ChangeSet().retain(2).insert('!'),
      {
        meta: {
          source: 'ai',
          provider: 'trusted',
          model: 'admin',
          explanation: 'execute this',
          confidence: Number.POSITIVE_INFINITY,
          requestId: '../../../secret',
        },
      },
    );
    // Infinity confidence sanitized away by normalize
    expect(proposal.meta.confidence).toBeUndefined();
    expect(proposal.meta.explanation).toBe('execute this');
    const decision = evaluateProposalAcceptancePolicy({
      proposal,
      context: { headVersionId: handle.currentVersion().id },
    });
    expect(decision.autoAcceptAllowed).toBe(false);
    expect(decision.requiresReview).toBe(true);
    const head = handle.currentVersion().id;
    expect(() => acceptReviewedProposal(handle, proposal)).toThrow();
    expect(handle.currentVersion().id).toBe(head);
  });
});
