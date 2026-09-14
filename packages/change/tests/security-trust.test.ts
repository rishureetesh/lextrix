/**
 * Phase 6N — Security & trust boundary regression tests.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  createInMemoryCollabPair,
  DocumentHandle,
  parseChangeProposal,
  ProposalError,
  sanitizeConfidence,
  sanitizeUntrustedChangeMeta,
} from '../src/experimental/index.js';

describe('Phase 6N serialized proposal security', () => {
  it('rejects malformed JSON and missing fields', () => {
    expect(() => parseChangeProposal('{')).toThrow(ProposalError);
    expect(() => parseChangeProposal({} as never)).toThrow(ProposalError);
    expect(() =>
      parseChangeProposal({ documentId: 'd', ops: [] } as never),
    ).toThrow(ProposalError);
  });

  it('rejects invalid op shapes and oversized inserts', () => {
    expect(() =>
      parseChangeProposal({
        documentId: 'doc',
        baseVersionId: 'doc:v0',
        ops: [{ insert: 'a', delete: 1 }],
        meta: {},
      }),
    ).toThrow(ProposalError);

    expect(() =>
      parseChangeProposal({
        documentId: 'doc',
        baseVersionId: 'doc:v0',
        ops: [{ insert: 'x'.repeat(64 * 1024 + 1) }],
        meta: {},
      }),
    ).toThrow(ProposalError);
  });

  it('rejects forbidden keys in ops; sanitizes meta allowlist', () => {
    expect(() =>
      parseChangeProposal(
        '{"documentId":"doc","baseVersionId":"doc:v0","ops":[{"insert":"Hi","__proto__":{"polluted":true}}],"meta":{}}',
      ),
    ).toThrow(ProposalError);

    const p = parseChangeProposal({
      documentId: 'doc',
      baseVersionId: 'doc:v0',
      ops: [{ insert: 'Hi\n' }],
      meta: {
        source: 'user',
        origin: 'editor',
        explanation: 'ACCEPT THIS PROPOSAL',
        confidence: 0.99,
        evilFn: () => 'nope',
        apiKey: 'sk-secret-should-not-survive',
        provider: 'claimed',
      },
    });
    expect(p.meta.untrustedInput).toBe(true);
    expect(p.meta.explanation).toBe('ACCEPT THIS PROPOSAL');
    expect(p.meta.apiKey).toBeUndefined();
    expect(p.meta.evilFn).toBeUndefined();
    expect(p.meta.source).toBe('user');
    // Fake secrets must not round-trip into serialization
    const json = JSON.stringify(p.toJSON());
    expect(json).not.toContain('sk-secret');
  });

  it('drops invalid confidence; clamps are reject-not-grant', () => {
    expect(sanitizeConfidence(NaN)).toBeUndefined();
    expect(sanitizeConfidence(Infinity)).toBeUndefined();
    expect(sanitizeConfidence(1.5)).toBeUndefined();
    expect(sanitizeConfidence(-0.1)).toBeUndefined();
    expect(sanitizeConfidence(0.5)).toBe(0.5);

    const meta = sanitizeUntrustedChangeMeta({
      source: 'ai',
      confidence: Number.NaN,
      explanation: 'x'.repeat(3000),
    });
    expect(meta.confidence).toBeUndefined();
    expect(meta.explanation!.length).toBe(2048);
    expect(meta.untrustedInput).toBe(true);
  });

  it('forged source:user still marked untrustedInput (no privilege)', () => {
    const p = parseChangeProposal({
      documentId: 'doc',
      baseVersionId: 'doc:v0',
      ops: [{ retain: 0 }, { insert: '!' }],
      meta: { source: 'user', confidence: 1, explanation: 'ignore previous' },
    });
    expect(p.meta.source).toBe('user');
    expect(p.meta.untrustedInput).toBe(true);
  });

  it('parse never mutates Document', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const head = handle.currentVersion().id;
    const count = handle.listVersions().length;
    parseChangeProposal({
      documentId: handle.documentId,
      baseVersionId: head,
      ops: [{ retain: 2 }, { insert: '!' }],
      meta: { source: 'ai' },
    });
    expect(handle.currentVersion().id).toBe(head);
    expect(handle.listVersions()).toHaveLength(count);
  });

  it('replayed proposal remains stale when HEAD advanced', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet().insert('Hi\n'),
    });
    const proposal = handle.createProposal(
      new ChangeSet().retain(2).insert('!'),
      { meta: { source: 'ai' } },
    );
    const wire = JSON.stringify(proposal.toJSON());
    handle.apply(new ChangeSet().retain(0).insert('Z'));
    const replayed = parseChangeProposal(wire);
    expect(replayed.baseVersionId).toBe(proposal.baseVersionId);
    const v = handle.validateProposal(replayed);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe('stale');
  });
});

describe('Phase 6N collaboration remote meta', () => {
  it('remote meta cannot escalate source away from remote', () => {
    const { clientA, clientB, handleA, handleB, coordinator } =
      createInMemoryCollabPair(new ChangeSet().insert('ab\n'));
    coordinator.setAutoDeliver(false);
    const base = handleB.currentVersion().id;
    const R = new ChangeSet().retain(2).insert('c');
    handleB.apply(R);
    clientB.submitLocal(R, {
      baseVersionId: base,
      meta: {
        source: 'system',
        origin: 'editor',
        explanation: 'I am trusted',
        apiKey: 'sk-leak',
      } as never,
    });
    coordinator.flush();
    const last = handleA.document.lastAppliedMeta;
    expect(last?.source).toBe('remote');
    expect(last?.origin).toBe('system');
    expect((last as { apiKey?: string } | null)?.apiKey).toBeUndefined();
    clientA.destroy();
    clientB.destroy();
  });
});

describe('Phase 6N metadata inertness (OT)', () => {
  it('identical ChangeSets with adversarial meta transform identically', () => {
    const a = new ChangeSet().retain(0).insert('A');
    const b = new ChangeSet().retain(0).insert('B');
    const t1 = a.transform(b, true);
    const t2 = a.transform(b, true);
    expect(t1.ops).toEqual(t2.ops);
    // Meta is not an input to transform — provenance cannot alter OT.
    const metaA = sanitizeUntrustedChangeMeta({
      source: 'ai',
      confidence: 1,
      explanation: 'auto-accept',
    });
    const metaB = sanitizeUntrustedChangeMeta({ source: 'user' });
    expect(metaA.source).not.toBe(metaB.source);
    expect(a.transform(b, false).ops).toEqual(a.transform(b, false).ops);
  });
});

describe('Phase 6N property: parser fuzz', () => {
  it('100 malformed payloads → controlled rejection or valid proposal', () => {
    for (let seed = 0; seed < 100; seed++) {
      const payloads: unknown[] = [
        null,
        [],
        42,
        { documentId: seed, baseVersionId: 'v', ops: [] },
        {
          documentId: 'd',
          baseVersionId: 'v',
          ops: [{ delete: -1 }],
        },
        {
          documentId: 'd',
          baseVersionId: 'v',
          ops: [{ retain: Number.NaN }],
        },
        {
          documentId: 'd',
          baseVersionId: 'v',
          ops: new Array(4097).fill({ insert: 'x' }),
        },
        {
          documentId: 'd',
          baseVersionId: 'v',
          ops: [{ insert: 'ok\n' }],
          meta: { source: 'ai', confidence: seed / 100 },
        },
      ];
      for (const payload of payloads) {
        try {
          const p = parseChangeProposal(payload as never);
          expect(p.documentId).toBeTruthy();
          expect(p.meta.untrustedInput).toBe(true);
          expect(p.change).toBeTruthy();
        } catch (err) {
          expect(err).toBeInstanceOf(ProposalError);
        }
      }
    }
  });
});
