/**
 * Phase 6J — Proposal review workflow (pure + orchestration).
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/experimental';
import {
  acceptReviewedProposal,
  createIntelligenceRequest,
  createProposalReview,
  DeterministicDocumentIntelligenceProvider,
  ProposalReviewError,
  rebaseReviewedProposal,
  rejectReviewedProposal,
} from '../src/index.js';

describe('Phase 6J proposal review', () => {
  const provider = new DeterministicDocumentIntelligenceProvider();

  async function makeProposal(text = 'The quick brown fox.\n') {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert(text),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'uppercase',
      operation: 'transform',
      range: handle.createRange(4, 9),
    });
    const proposal = await provider.generate(request);
    return { handle, proposal, request };
  }

  it('valid proposal → pending review with provenance and policy', async () => {
    const { handle, proposal, request } = await makeProposal();
    const beforeVersions = handle.listVersions().length;
    const beforeRev = handle.document.revision;
    const beforeContents = handle.getContents().ops;

    const review = createProposalReview({
      handle,
      proposal,
      range: request.range,
    });

    expect(review.status).toBe('pending');
    expect(review.policy.requiresReview).toBe(true);
    expect(review.policy.eligible).toBe(true);
    expect(review.provenance.source).toBe('ai');
    expect(review.provenance.provider).toBe('deterministic');
    expect(review.range).toEqual({ start: 4, end: 9 });
    expect(review.inspect.ok).toBe(true);
    if (review.inspect.ok) expect(review.inspect.stale).toBe(false);

    // Purity
    expect(handle.listVersions()).toHaveLength(beforeVersions);
    expect(handle.document.revision).toBe(beforeRev);
    expect(handle.getContents().ops).toEqual(beforeContents);
  });

  it('stale proposal → stale status; no auto-rebase', async () => {
    const { handle, proposal } = await makeProposal();
    handle.apply(new ChangeSet().retain(0).insert('>'));
    const review = createProposalReview({ handle, proposal });
    expect(review.status).toBe('stale');
    expect(review.policy.requiresRebase).toBe(true);
    expect(review.policy.eligible).toBe(false);
    expect(proposal.baseVersionId).not.toBe(handle.currentVersion().id);
  });

  it('invalid proposal → invalid status', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const other = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const proposal = other.createProposal(new ChangeSet().retain(2).insert('!'), {
      meta: { source: 'ai' },
    });
    const review = createProposalReview({ handle, proposal });
    expect(review.status).toBe('invalid');
  });

  it('preview equals compose on base; creates no Version', async () => {
    const { handle, proposal } = await makeProposal();
    const before = handle.listVersions().length;
    const review = createProposalReview({ handle, proposal });
    const expected = handle
      .getVersion(proposal.baseVersionId)
      .contents.compose(proposal.change);
    expect(review.previewContents.ops).toEqual(expected.ops);
    expect(handle.listVersions()).toHaveLength(before);
  });

  it('explicit rebase refreshes review; provenance preserved', async () => {
    const { handle, proposal } = await makeProposal(
      'abcdefghijklmnopqrstuvwxyz\n',
    );
    handle.apply(new ChangeSet().retain(0).insert('Z'));
    const originalMeta = { ...proposal.meta };
    const rebased = rebaseReviewedProposal(handle, proposal);
    expect(rebased).not.toBe(proposal);
    expect(rebased.meta.provider).toBe(originalMeta.provider);
    expect(rebased.meta.explanation).toBe(originalMeta.explanation);
    expect(rebased.baseVersionId).toBe(handle.currentVersion().id);

    const review = createProposalReview({ handle, proposal: rebased });
    expect(review.status).toBe('pending');
    expect(review.policy.requiresRebase).toBe(false);
  });

  it('accept requires acknowledgeReview for AI; then creates Version', async () => {
    const { handle, proposal } = await makeProposal();
    expect(() => acceptReviewedProposal(handle, proposal)).toThrow(
      ProposalReviewError,
    );
    try {
      acceptReviewedProposal(handle, proposal);
    } catch (err) {
      expect(err).toBeInstanceOf(ProposalReviewError);
      expect((err as ProposalReviewError).code).toBe('review_required');
    }

    const before = handle.listVersions().length;
    const result = acceptReviewedProposal(handle, proposal, {
      acknowledgeReview: true,
    });
    expect(result.empty).toBe(false);
    expect(handle.listVersions()).toHaveLength(before + 1);
    expect(result.version.meta?.source).toBe('ai');
  });

  it('stale accept throws without mutating', async () => {
    const { handle, proposal } = await makeProposal();
    handle.apply(new ChangeSet().retain(0).insert('X'));
    const versions = handle.listVersions().length;
    expect(() =>
      acceptReviewedProposal(handle, proposal, { acknowledgeReview: true }),
    ).toThrow(ProposalReviewError);
    expect(handle.listVersions()).toHaveLength(versions);
  });

  it('reject mutates nothing', async () => {
    const { handle, proposal } = await makeProposal();
    const ops = handle.getContents().ops;
    const versions = handle.listVersions().length;
    const result = rejectReviewedProposal(handle, proposal);
    expect(result.rejected).toBe(true);
    expect(handle.getContents().ops).toEqual(ops);
    expect(handle.listVersions()).toHaveLength(versions);
  });

  it('multiple proposals independently reviewable', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcdefghij\n'),
    });
    const a = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'uppercase',
        operation: 'transform',
        range: handle.createRange(0, 3),
      }),
    );
    const b = await provider.generate(
      createIntelligenceRequest(handle, {
        instruction: 'uppercase',
        operation: 'transform',
        range: handle.createRange(3, 6),
      }),
    );
    const ra = createProposalReview({ handle, proposal: a });
    const rb = createProposalReview({ handle, proposal: b });
    expect(ra.proposal.id).not.toBe(rb.proposal.id);
    expect(ra.status).toBe('pending');
    expect(rb.status).toBe('pending');
  });

  it('collaboration: HEAD advances → stale → rebase → accept', async () => {
    const { handle, proposal } = await makeProposal('Hello world text\n');
    // Simulate concurrent local/remote edit
    handle.apply(new ChangeSet().retain(0).insert('>'), {
      meta: { source: 'user', origin: 'editor' },
    });
    const stale = createProposalReview({ handle, proposal });
    expect(stale.status).toBe('stale');

    const rebased = rebaseReviewedProposal(handle, proposal);
    const refreshed = createProposalReview({ handle, proposal: rebased });
    expect(refreshed.status).toBe('pending');

    acceptReviewedProposal(handle, rebased, { acknowledgeReview: true });
    expect(handle.getContents().ops.some((op) => typeof op.insert === 'string')).toBe(
      true,
    );
  });
});

describe('Phase 6J property: review purity', () => {
  const provider = new DeterministicDocumentIntelligenceProvider();

  it('100 seeds: createProposalReview does not alter Document', async () => {
    for (let seed = 0; seed < 100; seed++) {
      const handle = DocumentHandle.create({
        contents: new ChangeSet().insert(`seed-${seed}-abcdefghij\n`),
      });
      const end = 5 + (seed % 5);
      const proposal = await provider.generate(
        createIntelligenceRequest(handle, {
          instruction: 'uppercase',
          operation: 'transform',
          range: handle.createRange(0, end),
        }),
      );
      const snap = {
        versions: handle.listVersions().length,
        revision: handle.document.revision,
        ops: JSON.stringify(handle.getContents().ops),
        head: handle.currentVersion().id,
      };
      createProposalReview({ handle, proposal });
      expect(handle.listVersions()).toHaveLength(snap.versions);
      expect(handle.document.revision).toBe(snap.revision);
      expect(JSON.stringify(handle.getContents().ops)).toBe(snap.ops);
      expect(handle.currentVersion().id).toBe(snap.head);
    }
  });
});
