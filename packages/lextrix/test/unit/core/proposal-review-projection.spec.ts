/**
 * Phase 6K — Review → accept → Hybrid B+ editor projection.
 */
import ChangeSet from 'lextrix-change';
import { describe, expect, test } from 'vitest';
import Lextrix from '../../../src/core.js';
import { createRegistry } from '../__helpers__/factory.js';
import Bold from 'lextrix-formats/formats/bold.js';
import { normalizeHTML } from '../__helpers__/utils.js';
import {
  createProposalReview,
  rejectReviewedProposal,
} from 'lextrix-intelligence';

function normalizeOps(ops: ChangeSet['ops']) {
  return ops.map((op) => {
    if (!op.attributes) return { ...op };
    const keys = Object.keys(op.attributes).sort();
    const attributes: Record<string, unknown> = {};
    for (const k of keys) attributes[k] = op.attributes[k];
    return { ...op, attributes };
  });
}

function expectContentsEqual(a: ChangeSet, b: ChangeSet) {
  expect(normalizeOps(a.ops)).toEqual(normalizeOps(b.ops));
}

function createLextrix(html = '') {
  const container = document.createElement('div');
  if (html) container.innerHTML = normalizeHTML(html);
  document.body.appendChild(container);
  return new Lextrix(container, {
    registry: createRegistry([Bold]),
  });
}

describe('Phase 6K review + editor projection', () => {
  test('review is pure against live editor document', () => {
    const lex = createLextrix('<p>Hello</p>');
    const handle = lex.getExperimentalHandle()!;
    const proposal = handle.createProposal(
      new ChangeSet().retain(5).insert('!'),
      { meta: { source: 'ai', provider: 'test', explanation: 'exclaim' } },
    );
    const reconcileBefore = (
      lex as unknown as {
        documentBridge: { getReconcileCount: () => number };
      }
    ).documentBridge.getReconcileCount();
    const versionsBefore = lex.getExperimentalVersions().length;
    const editorOps = lex.getContents().ops;

    const review = createProposalReview({ handle, proposal });
    expect(review.status).toBe('pending');
    expect(lex.getExperimentalVersions()).toHaveLength(versionsBefore);
    expect(lex.getContents().ops).toEqual(editorOps);
    expect(
      (
        lex as unknown as {
          documentBridge: { getReconcileCount: () => number };
        }
      ).documentBridge.getReconcileCount(),
    ).toBe(reconcileBefore);
    lex.destroy();
  });

  test('acceptProposalAndProject: Document then editor; no feedback loop', () => {
    const lex = createLextrix('<p>Hello</p>');
    const handle = lex.getExperimentalHandle()!;
    const proposal = handle.createProposal(
      new ChangeSet().retain(5).insert('!'),
      {
        meta: {
          source: 'ai',
          provider: 'test',
          explanation: 'exclaim',
          intent: 'review-accept',
        },
      },
    );
    const reconcileBefore = (
      lex as unknown as {
        documentBridge: { getReconcileCount: () => number };
      }
    ).documentBridge.getReconcileCount();
    const versionsBefore = lex.getExperimentalVersions().length;

    const review = createProposalReview({ handle, proposal });
    expect(review.status).toBe('pending');
    expect(review.policy.requiresReview).toBe(true);

    // Explicit application decision after review; Lextrix projects via Hybrid B+.
    const result = lex.acceptProposalAndProject(proposal);
    expect(result.empty).toBe(false);
    expect(result.projection.status).toBe('ok');
    expect(lex.getExperimentalVersions().length).toBe(versionsBefore + 1);
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    expect(lex.getExperimentalDocument()!.lastAppliedMeta?.source).toBe('ai');
    expect(
      (
        lex as unknown as {
          documentBridge: { getReconcileCount: () => number };
        }
      ).documentBridge.getReconcileCount(),
    ).toBe(reconcileBefore);
    expect(lex.getProjectionDepth()).toBe(0);
    lex.destroy();
  });

  test('reject leaves editor and document unchanged', () => {
    const lex = createLextrix('<p>Hello</p>');
    const handle = lex.getExperimentalHandle()!;
    const proposal = handle.createProposal(
      new ChangeSet().retain(5).insert('!'),
      { meta: { source: 'ai' } },
    );
    const ops = lex.getContents().ops;
    const versions = lex.getExperimentalVersions().length;
    rejectReviewedProposal(handle, proposal);
    expect(lex.getContents().ops).toEqual(ops);
    expect(lex.getExperimentalVersions()).toHaveLength(versions);
    lex.destroy();
  });

  test('stale review does not project; explicit rebase then accept projects', () => {
    const lex = createLextrix('<p>Hello</p>');
    const handle = lex.getExperimentalHandle()!;
    const proposal = handle.createProposal(
      new ChangeSet().retain(5).insert('!'),
      { meta: { source: 'ai', provider: 'test' } },
    );
    // Advance HEAD via external (document+editor)
    lex.applyExternalChange(new ChangeSet().retain(0).insert('>'), {
      meta: { source: 'user' },
    });
    const review = createProposalReview({ handle, proposal });
    expect(review.status).toBe('stale');

    const rebased = handle.rebaseProposal(proposal);
    const refreshed = createProposalReview({ handle, proposal: rebased });
    expect(refreshed.status).toBe('pending');

    const result = lex.acceptProposalAndProject(rebased);
    expect(result.projection.status).toBe('ok');
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    lex.destroy();
  });

  test('selection maps through acceptProposalAndProject', () => {
    const lex = createLextrix('<p>Hello</p>');
    lex.setSelection(3, 0, 'silent');
    const handle = lex.getExperimentalHandle()!;
    const proposal = handle.createProposal(
      new ChangeSet().retain(0).insert('XX'),
      { meta: { source: 'ai' } },
    );
    lex.acceptProposalAndProject(proposal);
    const sel = lex.getSelection();
    expect(sel).not.toBeNull();
    expect(sel!.index).toBe(5);
    lex.destroy();
  });

  test('projectAppliedChange alone does not double-apply', () => {
    const lex = createLextrix('<p>Hi</p>');
    const handle = lex.getExperimentalHandle()!;
    const change = new ChangeSet().retain(2).insert('!');
    handle.apply(change, { meta: { source: 'ai', origin: 'system' } });
    const versions = lex.getExperimentalVersions().length;
    const result = lex.projectAppliedChange(change);
    expect(result.status).toBe('ok');
    expect(lex.getExperimentalVersions()).toHaveLength(versions);
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    lex.destroy();
  });
});
