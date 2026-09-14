/**
 * Phase 6L–6M — Review + AI proposal failure semantics (intelligence layer).
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  DocumentHandle,
  createInMemoryCollabPair,
} from 'lextrix-change/experimental';
import {
  acceptReviewedProposal,
  createIntelligenceRequest,
  createProposalReview,
  DeterministicDocumentIntelligenceProvider,
  ProposalReviewError,
  rebaseReviewedProposal,
} from '../src/index.js';

describe('Phase 6M review during collaboration', () => {
  const provider = new DeterministicDocumentIntelligenceProvider();

  it('review at Vn becomes stale when HEAD advances; inspect remains pure', async () => {
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
    const review = createProposalReview({ handle, proposal });
    expect(review.status).toBe('pending');
    expect(review.currentVersionId).toBe(handle.currentVersion().id);

    handle.apply(new ChangeSet().retain(0).insert('>'));
    const versions = handle.listVersions().length;
    const stale = createProposalReview({ handle, proposal });
    expect(stale.status).toBe('stale');
    expect(stale.currentVersionId).toBe(handle.currentVersion().id);
    expect(stale.baseVersionId).toBe(proposal.baseVersionId);
    // Re-inspecting does not mutate
    createProposalReview({ handle, proposal });
    expect(handle.listVersions()).toHaveLength(versions);
  });

  it('AI + remote: stale → explicit rebase → re-review → accept', async () => {
    const { handleA, handleB, clientA, clientB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('Hello world\n'));
    coordinator.setAutoDeliver(false);

    const proposal = await provider.generate(
      createIntelligenceRequest(handleA, {
        instruction: 'uppercase',
        operation: 'transform',
        range: handleA.createRange(0, 5),
      }),
    );
    const baseB = handleB.currentVersion().id;
    const remote = new ChangeSet().retain(0).insert('Z');
    handleB.apply(remote);
    clientB.submitLocal(remote, { baseVersionId: baseB });
    coordinator.flush();

    const stale = createProposalReview({ handle: handleA, proposal });
    expect(stale.status).toBe('stale');
    expect(() =>
      acceptReviewedProposal(handleA, proposal, { acknowledgeReview: true }),
    ).toThrow(ProposalReviewError);

    const rebased = rebaseReviewedProposal(handleA, proposal);
    const refreshed = createProposalReview({
      handle: handleA,
      proposal: rebased,
    });
    expect(refreshed.status).toBe('pending');
    acceptReviewedProposal(handleA, rebased, { acknowledgeReview: true });
    expect(handleA.getContents().ops.some((op) => op.insert)).toBe(true);
    clientA.destroy();
    clientB.destroy();
  });

  it('policy_blocked accept does not mutate', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abc\n'),
    });
    const proposal = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'uppercase',
        operation: 'transform',
        range: handle.createRange(0, 3),
      }),
    );
    const head = handle.currentVersion().id;
    try {
      acceptReviewedProposal(handle, proposal, {
        acknowledgeReview: true,
        policyContext: { allowedSources: ['user'] },
      });
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ProposalReviewError);
      expect((err as ProposalReviewError).code).toBe('policy_blocked');
    }
    expect(handle.currentVersion().id).toBe(head);
  });
});

describe('Phase 6M property: review purity under concurrency', () => {
  const provider = new DeterministicDocumentIntelligenceProvider();

  it('50 seeds: review after remote does not mutate Document', async () => {
    for (let seed = 0; seed < 50; seed++) {
      const handle = DocumentHandle.create({
        contents: new ChangeSet().insert(`seed${seed}abcdef\n`),
      });
      const proposal = await provider.generate(
        createIntelligenceRequest(handle, {
          instruction: 'uppercase',
          operation: 'transform',
          range: handle.createRange(0, 4 + (seed % 3)),
        }),
      );
      handle.apply(new ChangeSet().retain(0).insert(String(seed % 10)));
      const snap = {
        ops: JSON.stringify(handle.getContents().ops),
        versions: handle.listVersions().length,
        rev: handle.document.revision,
      };
      const review = createProposalReview({ handle, proposal });
      expect(review.status).toBe('stale');
      expect(JSON.stringify(handle.getContents().ops)).toBe(snap.ops);
      expect(handle.listVersions()).toHaveLength(snap.versions);
      expect(handle.document.revision).toBe(snap.rev);
    }
  });
});
