/**
 * Phase 6H–6I — Provenance, explainability & acceptance policy.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  DocumentHandle,
  parseChangeProposal,
  createInMemoryCollabPair,
} from 'lextrix-change/experimental';
import {
  buildAiProposalMeta,
  createIntelligenceRequest,
  DeterministicDocumentIntelligenceProvider,
  evaluateProposalAcceptancePolicy,
  isAiSourced,
  readProposalProvenance,
} from '../src/index.js';

describe('Phase 6H–6I provenance', () => {
  const provider = new DeterministicDocumentIntelligenceProvider();

  it('AI source, provider, model, explanation, confidence are preserved', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('The quick brown fox.\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'uppercase',
      operation: 'transform',
      range: handle.createRange(4, 9),
    });
    const proposal = await provider.generate(request);
    const prov = readProposalProvenance(proposal);
    expect(prov.source).toBe('ai');
    expect(isAiSourced(prov)).toBe(true);
    expect(prov.provider).toBe('deterministic');
    expect(prov.model).toBe('deterministic-v1');
    expect(prov.explanation).toMatch(/^deterministic:transform:/);
    expect(prov.confidence).toBe(1);
    expect(prov.proposalId).toBe(proposal.id);
    expect(prov.baseVersionId).toBe(request.baseVersionId);
    expect(Object.isFrozen(proposal.meta)).toBe(true);
  });

  it('provenance survives rebase; original immutable', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcdefghijklmnop\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'shorten',
      operation: 'shorten',
      range: handle.createRange(0, 16),
      context: { maxLength: 6 },
    });
    const proposal = await provider.generate(request);
    const beforeMeta = { ...proposal.meta };
    handle.apply(new ChangeSet().retain(0).insert('>'));
    const rebased = handle.rebaseProposal(proposal);
    expect(rebased).not.toBe(proposal);
    expect(proposal.meta).toEqual(beforeMeta);
    expect(rebased.meta.source).toBe('ai');
    expect(rebased.meta.provider).toBe(beforeMeta.provider);
    expect(rebased.meta.model).toBe(beforeMeta.model);
    expect(rebased.meta.explanation).toBe(beforeMeta.explanation);
    expect(rebased.meta.confidence).toBe(beforeMeta.confidence);
    expect(rebased.baseVersionId).toBe(handle.currentVersion().id);
    expect(proposal.baseVersionId).not.toBe(rebased.baseVersionId);
  });

  it('provenance survives serialize → parse', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'rewrite',
      operation: 'rewrite',
      range: handle.createRange(0, 11),
    });
    const proposal = await provider.generate(request);
    const parsed = parseChangeProposal(JSON.stringify(proposal.toJSON()));
    expect(parsed.meta.source).toBe('ai');
    expect(parsed.meta.provider).toBe('deterministic');
    expect(parsed.meta.model).toBe('deterministic-v1');
    expect(parsed.meta.explanation).toBe(proposal.meta.explanation);
    expect(parsed.meta.confidence).toBe(1);
    expect(parsed.change.ops).toEqual(proposal.change.ops);
  });

  it('accepted version retains provenance meta; version JSON includes meta', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hello world\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'replace:HELLO WORLD',
      operation: 'replace',
      range: handle.createRange(0, 11),
      context: { replacement: 'HELLO WORLD' },
    });
    const proposal = await provider.generate(request);
    const result = handle.acceptProposal(proposal);
    expect(result.version.meta?.source).toBe('ai');
    expect(result.version.meta?.provider).toBe('deterministic');
    expect(result.version.meta?.explanation).toBe(proposal.meta.explanation);
    const json = result.version.toJSON();
    expect(json.meta?.source).toBe('ai');
    expect(json.meta?.provider).toBe('deterministic');
  });

  it('buildAiProposalMeta produces generic provenance only', () => {
    const meta = buildAiProposalMeta({
      provider: 'openai',
      model: 'gpt-4o-mini',
      explanation: 'tighten wording',
      confidence: 0.42,
      requestId: 'resp_test',
      intent: 'rewrite',
    });
    expect(meta.source).toBe('ai');
    expect(meta.origin).toBe('system');
    expect(meta.provider).toBe('openai');
    expect(meta.confidence).toBe(0.42);
    expect(meta.requestId).toBe('resp_test');
  });
});

describe('Phase 6H–6I acceptance policy', () => {
  const provider = new DeterministicDocumentIntelligenceProvider();

  it('AI proposal requires review; auto-accept never allowed', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abc\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'uppercase',
      operation: 'transform',
      range: handle.createRange(0, 3),
    });
    const proposal = await provider.generate(request);
    const versionsBefore = handle.listVersions().length;
    const decision = evaluateProposalAcceptancePolicy({
      proposal,
      context: { headVersionId: handle.currentVersion().id },
    });
    expect(decision.requiresReview).toBe(true);
    expect(decision.autoAcceptAllowed).toBe(false);
    expect(decision.eligible).toBe(true);
    expect(decision.requiresRebase).toBe(false);
    expect(decision.reasons).toContain('requires_review');
    expect(decision.reasons).toContain('auto_accept_disallowed');
    expect(decision.reasons).toContain('eligible_for_accept');
    // Policy is pure — document unchanged.
    expect(handle.listVersions()).toHaveLength(versionsBefore);
    expect(handle.currentVersion().id).toBe(proposal.baseVersionId);
  });

  it('stale proposal requires rebase; not eligible for direct accept', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abcdefghijklmnop\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'shorten',
      operation: 'shorten',
      range: handle.createRange(0, 16),
      context: { maxLength: 5 },
    });
    const proposal = await provider.generate(request);
    handle.apply(new ChangeSet().retain(0).insert('Z'));
    const decision = evaluateProposalAcceptancePolicy({
      proposal,
      context: { headVersionId: handle.currentVersion().id },
    });
    expect(decision.eligible).toBe(false);
    expect(decision.requiresRebase).toBe(true);
    expect(decision.reasons).toContain('stale');
    expect(decision.reasons).toContain('requires_rebase');
    expect(decision.autoAcceptAllowed).toBe(false);
  });

  it('source allowlist can deny AI without mutating document', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('abc\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'uppercase',
      operation: 'transform',
      range: handle.createRange(0, 3),
    });
    const proposal = await provider.generate(request);
    const head = handle.currentVersion().id;
    const decision = evaluateProposalAcceptancePolicy({
      proposal,
      context: {
        headVersionId: head,
        allowedSources: ['user'],
      },
    });
    expect(decision.eligible).toBe(false);
    expect(decision.reasons).toContain('source_not_allowed');
    expect(handle.currentVersion().id).toBe(head);
  });

  it('policy eligible still requires engine acceptProposal', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('xyz\n'),
    });
    const request = createIntelligenceRequest(handle, {
      instruction: 'replace:XYZ',
      operation: 'replace',
      range: handle.createRange(0, 3),
      context: { replacement: 'XYZ' },
    });
    const proposal = await provider.generate(request);
    const decision = evaluateProposalAcceptancePolicy({
      proposal,
      context: { headVersionId: handle.currentVersion().id },
    });
    expect(decision.eligible).toBe(true);
    // Application must still call engine APIs.
    handle.acceptProposal(proposal);
    expect(handle.getContents().ops[0]?.insert).toBe('XYZ\n');
  });

  it('confidence is not treated as correctness by policy', async () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('hi\n'),
    });
    const proposal = handle.createProposal(
      new ChangeSet().retain(2).insert('!'),
      {
        meta: buildAiProposalMeta({
          provider: 'test',
          model: 'x',
          explanation: 'add bang',
          confidence: 0.999,
        }),
      },
    );
    const decision = evaluateProposalAcceptancePolicy({
      proposal,
      context: { headVersionId: handle.currentVersion().id },
    });
    expect(proposal.meta.confidence).toBe(0.999);
    expect(decision.autoAcceptAllowed).toBe(false);
    expect(decision.requiresReview).toBe(true);
  });
});

describe('Phase 6H–6I collaboration / OT independence', () => {
  it('provenance survives collab rebase; metadata does not change transform ops', async () => {
    const { coordinator, handleA, handleB } = createInMemoryCollabPair(
      new ChangeSet().insert('Hello\n'),
    );
    coordinator.setAutoDeliver(false);
    const provider = new DeterministicDocumentIntelligenceProvider();
    const request = createIntelligenceRequest(handleA, {
      instruction: 'uppercase',
      operation: 'transform',
      range: handleA.createRange(0, 5),
    });
    const aiProposal = await provider.generate(request);

    // Concurrent human edit on B advances that replica; A rebases explicitly.
    handleB.apply(new ChangeSet().retain(0).insert('>'), {
      meta: { source: 'user', origin: 'editor' },
    });
    handleA.apply(new ChangeSet().retain(0).insert('>'), {
      meta: { source: 'user', origin: 'editor' },
    });

    const rebased = handleA.rebaseProposal(aiProposal);
    expect(rebased.meta.source).toBe('ai');
    expect(rebased.meta.provider).toBe('deterministic');
    expect(rebased.meta.explanation).toBe(aiProposal.meta.explanation);

    const change = rebased.change.clone();
    const a = handleA.createProposal(change, {
      meta: { source: 'ai', explanation: 'x', provider: 'a' },
    });
    const b = handleA.createProposal(change.clone(), {
      meta: { source: 'user' },
    });
    expect(a.change.ops).toEqual(b.change.ops);

    const human = new ChangeSet().retain(0).insert('H');
    const ai = new ChangeSet().retain(0).insert('A');
    expect(human.transform(ai, true).ops).toEqual(
      human.transform(ai, true).ops,
    );
  });
});

describe('Phase 6H–6I property: metadata round-trip / rebase', () => {
  it('100 seeds: serialize+parse and rebase preserve provenance keys', async () => {
    const provider = new DeterministicDocumentIntelligenceProvider();
    for (let seed = 0; seed < 100; seed++) {
      const handle = DocumentHandle.create({
        contents: new ChangeSet().insert(`seed-${seed}-abcdefghij\n`),
      });
      const end = 10 + (seed % 5);
      const request = createIntelligenceRequest(handle, {
        instruction: 'uppercase',
        operation: 'transform',
        range: handle.createRange(0, end),
      });
      const proposal = await provider.generate(request);
      const parsed = parseChangeProposal(proposal.toJSON());
      expect(parsed.meta.source).toBe(proposal.meta.source);
      expect(parsed.meta.provider).toBe(proposal.meta.provider);
      expect(parsed.meta.model).toBe(proposal.meta.model);
      expect(parsed.meta.explanation).toBe(proposal.meta.explanation);
      expect(parsed.meta.confidence).toBe(proposal.meta.confidence);

      handle.apply(new ChangeSet().retain(0).insert(String(seed % 10)));
      const rebased = handle.rebaseProposal(parsed);
      expect(rebased.meta.provider).toBe(parsed.meta.provider);
      expect(rebased.meta.model).toBe(parsed.meta.model);
      expect(rebased.meta.explanation).toBe(parsed.meta.explanation);
      expect(rebased.meta.confidence).toBe(parsed.meta.confidence);
      expect(rebased.meta.source).toBe('ai');
    }
  });

  it('50 seeds: transform result identical regardless of proposal meta', () => {
    for (let seed = 0; seed < 50; seed++) {
      const a = new ChangeSet().retain(seed % 5).insert(`A${seed}`);
      const b = new ChangeSet().retain(seed % 3).insert(`B${seed}`);
      const withAiMeta = a.transform(b, seed % 2 === 0);
      const withUserMeta = a.transform(b, seed % 2 === 0);
      expect(withAiMeta.ops).toEqual(withUserMeta.ops);
    }
  });
});
