/**
 * Phase 9 — hydration / corruption property tests.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import { DocumentError } from '../src/experimental/document-error.js';
import { DocumentHandle } from '../src/experimental/document-handle.js';
import { DocumentVersion } from '../src/experimental/version.js';
import { InMemoryDocumentPersistence } from '../src/persistence/index.js';
import {
  parseDocumentVersion,
  serializeDocumentVersion,
} from '../src/wire/index.js';
import { generateChangeAgainstDocument } from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

describe('Phase 9 hydration property', () => {
  it('wire round-trip hydrate preserves HEAD', () => {
    const rng = new SeededRandom(9001);
    for (let trial = 0; trial < 40; trial += 1) {
      const handle = DocumentHandle.create({
        contents: new ChangeSet([{ insert: 'seed\n' }]),
        validate: false,
      });
      for (let i = 0; i < 5; i += 1) {
        const ch = generateChangeAgainstDocument(rng, handle.getContents());
        if (ch.length() > 0) {
          handle.apply(ch, { validate: false });
        }
      }
      const wireChain = handle.listVersions().map((v) => serializeDocumentVersion(v));
      const versions = wireChain.map((w) => parseDocumentVersion(w));
      const hydrated = DocumentHandle.fromVersions(versions, { validate: false });
      expect(hydrated.getContents().ops).toEqual(handle.getContents().ops);
      expect(hydrated.currentVersion().id).toBe(handle.currentVersion().id);
    }
  });

  it('random corruption of lineage fields is rejected', () => {
    const rng = new SeededRandom(42);
    const handle = DocumentHandle.create({
      contents: new ChangeSet([{ insert: 'base\n' }]),
    });
    for (let i = 0; i < 8; i += 1) {
      handle.apply(new ChangeSet([{ insert: `${i}` }]));
    }
    const good = handle.listVersions();
    const mutators: Array<(vs: DocumentVersion[]) => DocumentVersion[]> = [
      (vs) =>
        vs.map((v, i) =>
          i === 3
            ? new DocumentVersion({ ...v, parentId: 'bogus' })
            : v,
        ),
      (vs) =>
        vs.map((v, i) =>
          i === 2
            ? new DocumentVersion({ ...v, documentId: 'wrong-doc' })
            : v,
        ),
      (vs) =>
        vs.map((v, i) =>
          i === 4
            ? new DocumentVersion({
                ...v,
                contents: new ChangeSet([{ insert: 'mut\n' }]).freeze(),
              })
            : v,
        ),
      (vs) =>
        vs.map((v, i) =>
          i === 5
            ? new DocumentVersion({
                ...v,
                changeFromParent: new ChangeSet([{ insert: 'bad' }]).freeze(),
              })
            : v,
        ),
      (vs) =>
        vs.map((v, i) =>
          i === 1 ? new DocumentVersion({ ...v, sequence: 99 }) : v,
        ),
    ];
    for (let t = 0; t < 30; t += 1) {
      const mut = mutators[rng.int(0, mutators.length - 1)]!;
      const corrupt = mut(good.map((v) => v));
      expect(() => DocumentHandle.fromVersions(corrupt)).toThrow(DocumentError);
    }
  });

  it('persistence idempotency append(V)^N', () => {
    const { versions } = (() => {
      const h = DocumentHandle.create({
        contents: new ChangeSet([{ insert: 'p\n' }]),
      });
      h.apply(new ChangeSet([{ insert: 'q' }]));
      return { versions: h.listVersions() };
    })();
    const store = new InMemoryDocumentPersistence();
    for (let n = 0; n < 20; n += 1) {
      for (const v of versions) store.appendVersion(v);
    }
    expect(store.loadChain(versions[0]!.documentId)).toHaveLength(versions.length);
  });
});
