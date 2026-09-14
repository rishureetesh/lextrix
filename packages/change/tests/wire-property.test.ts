/**
 * Property: parse(serialize(x)) preserves ChangeSet / proposal / envelope ops.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import { DocumentHandle } from '../src/experimental/index.js';
import {
  changeSetsEqual,
  parseChangeProposalWire,
  parseChangeSet,
  parseCollabEnvelope,
  parseDocumentVersion,
  serializeChangeProposal,
  serializeChangeSet,
  serializeCollabEnvelope,
  serializeDocumentVersion,
} from '../src/wire/index.js';
import {
  generateChangeAgainstDocument,
  generateDocument,
} from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

describe('ADR-012 wire properties', () => {
  it('ChangeSet serialize/parse identity (100 seeds)', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const rng = new SeededRandom(9000 + seed);
      const doc = generateDocument(rng, {
        maxSegments: 6,
        maxSegmentLen: 12,
      });
      const change = generateChangeAgainstDocument(rng, doc);
      expect(changeSetsEqual(change, parseChangeSet(serializeChangeSet(change)))).toBe(
        true,
      );
      expect(changeSetsEqual(doc, parseChangeSet(serializeChangeSet(doc)))).toBe(
        true,
      );
    }
  });

  it('proposal accept(parse(serialize(p))) ≡ accept(p)', () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const rng = new SeededRandom(9100 + seed);
      const contents = generateDocument(rng, {
        maxSegments: 4,
        maxSegmentLen: 8,
      });
      const handleA = DocumentHandle.create({ contents: contents.clone() });
      const handleB = DocumentHandle.create({
        contents: contents.clone(),
        documentId: handleA.documentId,
      });
      // Align version ids by using same documentId + same root contents —
      // version ids include documentId but sequence-based ids may differ by time.
      // Use explicit proposal against listed version ids from each handle.
      const change = generateChangeAgainstDocument(rng, contents);
      if (change.length() === 0) continue;

      const pA = handleA.createProposal(change, {
        meta: { source: 'api', origin: 'system' },
      });
      // Rebuild proposal for B against B's current version id with same ops
      const pB = handleB.createProposal(change.clone(), {
        id: pA.id,
        createdAt: pA.createdAt,
        meta: { source: 'api', origin: 'system' },
      });

      const wire = parseChangeProposalWire(serializeChangeProposal(pA));
      // Wire parse keeps documentId/baseVersionId from A — accept on A
      handleA.acceptProposal(wire);
      handleB.acceptProposal(pB);
      expect(JSON.stringify(handleA.getContents().ops)).toBe(
        JSON.stringify(handleB.getContents().ops),
      );
    }
  });

  it('version lineage compose property', () => {
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'base\n' }]),
    });
    for (let i = 0; i < 15; i += 1) {
      handle.apply(new ChangeSet([{ insert: String(i) }]));
    }
    const versions = handle.listVersions();
    for (let i = 1; i < versions.length; i += 1) {
      const parent = versions[i - 1]!;
      const child = versions[i]!;
      const parsed = parseDocumentVersion(serializeDocumentVersion(child));
      expect(parsed.parentId).toBe(parent.id);
      const rebuilt = parent.contents.compose(parsed.changeFromParent!);
      expect(JSON.stringify(rebuilt.ops)).toBe(
        JSON.stringify(child.contents.ops),
      );
    }
  });

  it('collab envelope ops survive serialize/parse', () => {
    const env = {
      changeId: 'c1',
      documentId: 'd1',
      baseVersionId: 'd1:v0',
      change: new ChangeSet([{ insert: 'z' }]),
      meta: { source: 'user' as const, origin: 'editor' as const },
      dependsOn: [] as string[],
    };
    const parsed = parseCollabEnvelope(serializeCollabEnvelope(env));
    expect(parsed.changeId).toBe('c1');
    expect(changeSetsEqual(env.change, parsed.change)).toBe(true);
  });
});
