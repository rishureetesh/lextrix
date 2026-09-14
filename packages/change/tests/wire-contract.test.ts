/**
 * Phase 7 — Wire contract round-trips, golden vectors, security fixtures.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  CausalDependencyError,
  createInMemoryCollabPair,
  DocumentHandle,
  parseChangeProposal,
} from '../src/experimental/index.js';
import {
  changeSetsEqual,
  documentVersionsEqual,
  parseChangeProposalWire,
  parseChangeSet,
  parseCollabEnvelope,
  parseDocumentVersion,
  proposalsEqual,
  serializeChangeProposal,
  serializeChangeSet,
  serializeCollabEnvelope,
  serializeDocumentVersion,
  WIRE_SCHEMA_VERSION,
  WireError,
} from '../src/wire/index.js';

describe('ADR-012 ChangeSet wire', () => {
  it('round-trips empty, insert, delete, retain, attributes, embed', () => {
    const cases = [
      new ChangeSet(),
      new ChangeSet([{ insert: 'Hello' }]),
      new ChangeSet([{ insert: 'ab' }, { delete: 1 }, { retain: 1 }]),
      new ChangeSet([
        { insert: 'x', attributes: { bold: true } },
        { retain: 1, attributes: { italic: true } },
      ]),
      new ChangeSet([{ insert: { image: 'https://example.com/a.png' } }]),
      new ChangeSet([
        { insert: 'a' },
        { retain: { image: true } },
        { insert: 'b' },
      ]),
    ];
    for (const cs of cases) {
      const wire = serializeChangeSet(cs);
      expect(wire.schemaVersion).toBe(WIRE_SCHEMA_VERSION);
      expect(wire.kind).toBe('changeset');
      const parsed = parseChangeSet(wire);
      expect(changeSetsEqual(cs, parsed)).toBe(true);
      expect(changeSetsEqual(cs, parseChangeSet(JSON.stringify(wire)))).toBe(
        true,
      );
    }
  });

  it('accepts legacy bare ops array', () => {
    const parsed = parseChangeSet([{ insert: 'legacy' }]);
    expect(parsed.ops).toEqual([{ insert: 'legacy' }]);
  });

  it('rejects unknown schemaVersion', () => {
    expect(() =>
      parseChangeSet({
        schemaVersion: 99,
        kind: 'changeset',
        ops: [],
      }),
    ).toThrow(WireError);
  });
});

describe('ADR-012 Version wire', () => {
  it('round-trips root and child with changeFromParent', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'root\n' }]),
    });
    const v0 = handle.currentVersion();
    handle.apply(new ChangeSet([{ retain: 4 }, { insert: '!' }]), {
      meta: { source: 'user', origin: 'system' },
    });
    const v1 = handle.currentVersion();

    const s0 = serializeDocumentVersion(v0);
    expect(s0.changeFromParent).toBeNull();
    expect(s0.parentId).toBeNull();
    expect(s0.contents.ops.length).toBeGreaterThan(0);

    const s1 = serializeDocumentVersion(v1);
    expect(s1.parentId).toBe(v0.id);
    expect(s1.changeFromParent).not.toBeNull();
    expect(s1.changeFromParent!.ops.length).toBeGreaterThan(0);

    const p0 = parseDocumentVersion(s0);
    const p1 = parseDocumentVersion(JSON.stringify(s1));
    expect(documentVersionsEqual(v0, p0)).toBe(true);
    expect(documentVersionsEqual(v1, p1)).toBe(true);

    // Lineage: applying changeFromParent to parent contents ≈ child contents
    const rebuilt = v0.contents.compose(p1.changeFromParent!);
    expect(JSON.stringify(rebuilt.ops)).toBe(JSON.stringify(v1.contents.ops));
  });

  it('DocumentVersion.toJSON includes lineage', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'a\n' }]),
    });
    handle.apply(new ChangeSet([{ insert: 'b' }]));
    const json = handle.currentVersion().toJSON();
    expect(json.schemaVersion).toBe(1);
    expect(json.kind).toBe('version');
    expect(json.changeFromParent).not.toBeNull();
    expect(json.contents.ops).toEqual(json.ops);
  });
});

describe('ADR-012 Proposal wire', () => {
  it('round-trips and accept preserves semantics', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'Hello world\n' }]),
    });
    const base = handle.currentVersion();
    const proposal = handle.createProposal(
      new ChangeSet([{ retain: 6 }, { insert: 'brave ' }]),
      {
        meta: {
          source: 'ai',
          origin: 'system',
          provider: 'test',
          confidence: 0.5,
        },
      },
    );

    const wire = serializeChangeProposal(proposal);
    expect(wire.kind).toBe('proposal');
    expect(wire.change.ops).toEqual(wire.ops);

    const parsed = parseChangeProposalWire(wire);
    expect(proposalsEqual(proposal, parsed)).toBe(true);
    expect(parsed.meta.untrustedInput).toBe(true);

    const viaExperimental = parseChangeProposal(JSON.stringify(wire));
    expect(viaExperimental.change.ops).toEqual(proposal.change.ops);

    const before = handle.document.contents;
    const result = handle.acceptProposal(parsed);
    expect(result.empty).toBe(false);
    expect(before.compose(proposal.change).ops).toEqual(
      handle.document.contents.ops,
    );
    expect(base.id).not.toBe(handle.currentVersion().id);
  });

  it('AI proposal round-trip keeps provenance inert for OT', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'x\n' }]),
    });
    const p = handle.createProposal(new ChangeSet([{ insert: 'y' }]), {
      meta: {
        source: 'ai',
        origin: 'system',
        explanation: 'because',
        confidence: 0.9,
      },
    });
    const again = parseChangeProposal(serializeChangeProposal(p));
    expect(again.meta.explanation).toBe('because');
    expect(again.meta.untrustedInput).toBe(true);
  });
});

describe('ADR-012 Collab envelope wire', () => {
  it('round-trip preserves ops, ids, dependsOn; duplicate publish idempotent', () => {
    const { clientA, handleA, coordinator } = createInMemoryCollabPair(
      new ChangeSet([{ insert: 'Hello\n' }]),
    );
    coordinator.setAutoDeliver(false);

    const base = handleA.currentVersion().id;
    const change = new ChangeSet([{ retain: 5 }, { insert: '!' }]);
    handleA.apply(change);
    const env = clientA.submitLocal(change, { baseVersionId: base });

    const wire = serializeCollabEnvelope(env);
    expect(wire.kind).toBe('collab-envelope');
    expect(wire.schemaVersion).toBe(1);

    const parsed = parseCollabEnvelope(JSON.stringify(wire));
    expect(parsed.changeId).toBe(env.changeId);
    expect(parsed.documentId).toBe(env.documentId);
    expect(parsed.baseVersionId).toBe(env.baseVersionId);
    expect(parsed.dependsOn).toEqual(env.dependsOn);
    expect(JSON.stringify(parsed.change.ops)).toBe(
      JSON.stringify(env.change.ops),
    );

    // Duplicate changeId publish is idempotent
    expect(() => coordinator.publish(parsed)).not.toThrow();
  });

  it('missing dependency still rejects at coordinator', () => {
    const { coordinator } = createInMemoryCollabPair();
    const bad = parseCollabEnvelope({
      schemaVersion: 1,
      kind: 'collab-envelope',
      changeId: 'c1',
      documentId: 'd1',
      baseVersionId: 'd1:v0',
      change: { ops: [{ insert: 'x' }] },
      meta: { source: 'remote', origin: 'system' },
      dependsOn: ['missing_pred'],
    });
    expect(() => coordinator.publish(bad)).toThrow(CausalDependencyError);
  });
});

describe('ADR-012 security / malformed fixtures', () => {
  const rejects = (input: unknown) => {
    expect(() => parseChangeProposalWire(input)).toThrow();
  };

  it('rejects malformed and oversized payloads', () => {
    rejects('{');
    rejects(null);
    rejects([]);
    rejects({ schemaVersion: 1, kind: 'proposal' });
    rejects({
      schemaVersion: 1,
      kind: 'proposal',
      documentId: 'd',
      baseVersionId: 'v',
      change: { ops: [{ insert: 'a', delete: 1 }] },
    });
    rejects({
      schemaVersion: 1,
      kind: 'proposal',
      documentId: 'd',
      baseVersionId: 'v',
      change: {
        ops: [JSON.parse('{"insert":"x","__proto__":{"polluted":true}}')],
      },
    });
    rejects({
      schemaVersion: 99,
      kind: 'proposal',
      documentId: 'd',
      baseVersionId: 'v',
      change: { ops: [] },
    });
    rejects({
      schemaVersion: 1,
      kind: 'proposal',
      documentId: 'd',
      baseVersionId: 'v',
      change: {
        ops: [{ insert: 'a'.repeat(70 * 1024) }],
      },
    });
  });

  it('strips malicious meta and marks untrusted', () => {
    const p = parseChangeProposalWire({
      schemaVersion: 1,
      kind: 'proposal',
      documentId: 'doc',
      baseVersionId: 'doc:v0',
      change: { ops: [{ insert: 'ok' }] },
      meta: {
        source: 'user',
        origin: 'editor',
        apiKey: 'SECRET',
        evilFn: () => 1,
        confidence: 2,
        explanation: 'x'.repeat(5000),
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(p.meta.untrustedInput).toBe(true);
    expect((p.meta as { apiKey?: string }).apiKey).toBeUndefined();
    expect(p.meta.confidence).toBeUndefined();
    expect(p.meta.explanation!.length).toBeLessThanOrEqual(2048);
  });

  it('ignores unknown top-level fields (forward compat)', () => {
    const p = parseChangeProposalWire({
      schemaVersion: 1,
      kind: 'proposal',
      documentId: 'doc',
      baseVersionId: 'doc:v0',
      change: { ops: [{ insert: 'a' }] },
      meta: { source: 'api', origin: 'system' },
      createdAt: '2026-01-01T00:00:00.000Z',
      futureField: { nested: true },
    });
    expect(p.change.ops).toEqual([{ insert: 'a' }]);
  });
});
