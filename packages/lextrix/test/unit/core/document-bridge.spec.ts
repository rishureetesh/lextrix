/**
 * Phase 2: editor ↔ experimental Document divergence invariant.
 * Strategy B — editor-first; Document mirrored after modify().
 */
import ChangeSet from 'lextrix-change';
import { describe, expect, test } from 'vitest';
import Lextrix from '../../../src/core.js';
import { createRegistry } from '../__helpers__/factory.js';
import Bold from 'lextrix-formats/formats/bold.js';
import { normalizeHTML } from '../__helpers__/utils.js';

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

describe('experimental Document bridge (Phase 2)', () => {
  test('initial empty editor matches Document', () => {
    const lex = createLextrix();
    const doc = lex.getExperimentalDocument();
    expect(doc).not.toBeNull();
    expectContentsEqual(lex.getContents(), doc!.getContents());
  });

  test('insertText keeps editor and Document in sync', () => {
    const lex = createLextrix('<p>Hello</p>');
    lex.insertText(5, '!', 'user');
    const doc = lex.getExperimentalDocument()!;
    expectContentsEqual(lex.getContents(), doc.getContents());
    expect(doc.revision).toBeGreaterThan(0);
  });

  test('formatText keeps editor and Document in sync', () => {
    const lex = createLextrix('<p>Hello</p>');
    lex.formatText(0, 5, 'bold', true, 'user');
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
  });

  test('deleteText keeps editor and Document in sync', () => {
    const lex = createLextrix('<p>Hello</p>');
    lex.deleteText(0, 2, 'user');
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
  });

  test('updateContents keeps editor and Document in sync', () => {
    const lex = createLextrix('<p>Hi</p>');
    lex.updateContents(new ChangeSet().retain(2).insert(' there'), 'api');
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
  });

  test('experimentalCommit → editor → Document invariant', () => {
    const lex = createLextrix('<p>Hi</p>');
    lex.experimentalCommit(
      (tx) => {
        tx.insert(2, '!');
      },
      { source: 'api', intent: 'phase2-test' },
    );
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
  });

  test('undo/redo keeps Document aligned with editor', () => {
    const lex = createLextrix('<p>Hi</p>');
    lex.insertText(2, '!', 'user');
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    lex.history.undo();
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    lex.history.redo();
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
  });

  test('experimentalDocument: false disables bridge', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const lex = new Lextrix(container, {
      registry: createRegistry([Bold]),
      experimentalDocument: false,
    });
    expect(lex.getExperimentalDocument()).toBeNull();
    expect(() => lex.experimentalTransaction()).toThrow(/experimentalDocument/);
  });

  test('editor mutations advance Document versions linearly', () => {
    const lex = createLextrix('<p>Hi</p>');
    const versionsBefore = lex.getExperimentalVersions().length;
    expect(versionsBefore).toBeGreaterThanOrEqual(1);
    const v0 = lex.getExperimentalVersion()!;
    lex.insertText(2, '!', 'user');
    const v1 = lex.getExperimentalVersion()!;
    expect(v1.id).not.toBe(v0.id);
    expect(lex.getExperimentalVersions().length).toBe(versionsBefore + 1);
    // prior version contents immutable
    expect(lex.getExperimentalDocument()!.documentId).toBe(v0.documentId);
    expectContentsEqual(lex.getContents(), lex.getExperimentalDocument()!.getContents());
  });

  test('empty experimentalCommit does not create a version', () => {
    const lex = createLextrix('<p>Hi</p>');
    const beforeId = lex.getExperimentalVersion()!.id;
    lex.experimentalCommit(() => {
      /* no ops */
    });
    expect(lex.getExperimentalVersion()!.id).toBe(beforeId);
  });

  test('undo/redo advances versions without diverging contents', () => {
    const lex = createLextrix('<p>Hi</p>');
    lex.insertText(2, '!', 'user');
    const afterInsert = lex.getExperimentalVersions().length;
    lex.history.undo();
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    expect(lex.getExperimentalVersions().length).toBeGreaterThan(afterInsert);
    lex.history.redo();
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
  });
});
