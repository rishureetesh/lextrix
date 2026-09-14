/**
 * Phase 10 property: server accept idempotency + OT convergence via session.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from 'lextrix-change';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';
import { DocumentServerSession } from '../src/index.js';
import { generateChangeAgainstDocument } from '../../change/src/testing/generators.js';
import { SeededRandom } from '../../change/src/testing/seeded-random.js';

describe('Phase 10 property', () => {
  it('accept(E); accept(E) is idempotent', async () => {
    const rng = new SeededRandom(1010);
    for (let t = 0; t < 20; t += 1) {
      const persistence = new InMemoryAuthoritativePersistence();
      const session = await DocumentServerSession.open(
        `doc_p_${t}`,
        { persistence },
        {
          contents: new ChangeSet([{ insert: 'prop\n' }]),
          createIfMissing: true,
        },
      );
      const base = session.getHead();
      const change = generateChangeAgainstDocument(rng, base.contents);
      if (change.length() === 0) continue;
      const env = {
        changeId: `e_${t}`,
        documentId: `doc_p_${t}`,
        baseVersionId: base.id,
        change,
        dependsOn: [] as string[],
        meta: {},
      };
      const a = await session.accept(env);
      const b = await session.accept(env);
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      if (a.ok && b.ok) {
        expect(b.duplicate).toBe(true);
        expect(b.version.id).toBe(a.version.id);
        expect(persistence.loadChain(`doc_p_${t}`)).toHaveLength(2);
      }
    }
  });

  it('pairwise concurrent accepts converge with transform priority', async () => {
    for (let t = 0; t < 40; t += 1) {
      const persistence = new InMemoryAuthoritativePersistence();
      const docId = `doc_ot_${t}`;
      const session = await DocumentServerSession.open(
        docId,
        { persistence },
        {
          contents: new ChangeSet([{ insert: 'xy\n' }]),
          createIfMissing: true,
        },
      );
      const v0 = session.getHead();
      // Deterministic concurrent inserts (valid document ops).
      const A = new ChangeSet([{ insert: 'A' }]);
      const B = new ChangeSet([{ retain: 1 }, { insert: 'B' }]);
      const ra = await session.accept({
        changeId: `A_${t}`,
        documentId: docId,
        baseVersionId: v0.id,
        change: A,
        dependsOn: [],
        meta: {},
      });
      const rb = await session.accept({
        changeId: `B_${t}`,
        documentId: docId,
        baseVersionId: v0.id,
        change: B,
        dependsOn: [],
        meta: {},
      });
      expect(ra.ok && rb.ok).toBe(true);
      if (!ra.ok || !rb.ok) continue;
      const left = v0.contents.compose(A).compose(A.transform(B, true));
      expect(session.getHead().contents.ops).toEqual(left.ops);
    }
  });
});
