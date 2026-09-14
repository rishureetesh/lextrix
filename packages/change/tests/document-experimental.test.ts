/**
 * Experimental DocumentState — headless Node tests (Phase 1).
 * Must not touch window/document/DOM.
 */
import { describe, expect, it } from 'vitest';
import ChangeSet from '../src/change/change-set.js';
import {
  createDocument,
  DEFAULT_DOCUMENT_SCHEMA,
} from '../src/experimental/index.js';
import { generateChangeAgainstDocument, generateDocument } from '../src/testing/generators.js';
import { SeededRandom } from '../src/testing/seeded-random.js';

describe('experimental Document (headless)', () => {
  it('runs without browser globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('createDocument → apply → getContents without DOM', () => {
    const doc = createDocument({
      contents: new ChangeSet().insert('Hello\n'),
    });
    const change = new ChangeSet().retain(5).insert('!');
    const next = doc.apply(change);
    expect(next.getContents().ops).toEqual([{ insert: 'Hello!\n' }]);
    // Original unchanged
    expect(doc.getContents().ops).toEqual([{ insert: 'Hello\n' }]);
  });

  it('empty createDocument yields newline document', () => {
    const doc = createDocument();
    expect(doc.getContents().ops).toEqual([{ insert: '\n' }]);
  });

  it('rejects non-document contents when validating', () => {
    expect(() =>
      createDocument({
        contents: new ChangeSet().retain(1).delete(1),
      }),
    ).toThrow(/Invalid document contents/);
  });

  it('apply validates result is still a document', () => {
    const doc = createDocument({
      contents: new ChangeSet().insert('A\n'),
    });
    // compose of document with a pure retain of full length stays insert-only
    const next = doc.apply(new ChangeSet().retain(2, { bold: true }));
    expect(DEFAULT_DOCUMENT_SCHEMA.validate(next.getContents()).ok).toBe(true);
  });

  it('fuzz: random apply sequences stay valid documents', () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 200; i += 1) {
      const caseSeed = rng.int(0, 0x7fffffff);
      const local = new SeededRandom(caseSeed);
      let doc = createDocument({ contents: generateDocument(local) });
      for (let step = 0; step < 5; step += 1) {
        const change = generateChangeAgainstDocument(local, doc.getContents());
        try {
          doc = doc.apply(change);
        } catch (err) {
          throw new Error(
            `FuzzFailure seed=${caseSeed} step=${step} ${String(err)}`,
          );
        }
        expect(doc.validate().ok, `seed=${caseSeed}`).toBe(true);
      }
    }
  });

  it('toJSON exposes ops + schema name + revision + ids', () => {
    const doc = createDocument({
      contents: new ChangeSet().insert('x\n'),
      documentId: 'doc_test',
    });
    expect(doc.toJSON()).toEqual({
      ops: [{ insert: 'x\n' }],
      schema: 'default',
      revision: 0,
      documentId: 'doc_test',
      versionId: 'doc_test:v0',
    });
  });
});
