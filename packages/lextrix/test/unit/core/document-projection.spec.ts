/**
 * Phase 5B — Hybrid B+ Document → Editor projection.
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

describe('Hybrid B+ Document → Editor projection (Phase 5B)', () => {
  test('remote change: Document apply then editor contents equal', () => {
    const lex = createLextrix('<p>Hello</p>');
    const beforeVersions = lex.getExperimentalVersions().length;
    const beforeReconcile = (
      lex as unknown as {
        documentBridge: { getReconcileCount: () => number };
      }
    ).documentBridge.getReconcileCount();

    const remote = new ChangeSet().retain(5).insert('!');
    const result = lex.applyExternalChange(remote, {
      meta: { intent: 'remote-test' },
    });

    expect(result.status).toBe('ok');
    expect(result.desynchronized).toBe(false);
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    expect(lex.getExperimentalVersions().length).toBe(beforeVersions + 1);
    // Projection must not also reconcile (no feedback loop).
    expect(
      (
        lex as unknown as {
          documentBridge: { getReconcileCount: () => number };
        }
      ).documentBridge.getReconcileCount(),
    ).toBe(beforeReconcile);
    expect(lex.getProjectionDepth()).toBe(0);
    lex.destroy();
  });

  test('selection maps through external insert before cursor', () => {
    const lex = createLextrix('<p>Hello</p>');
    lex.setSelection(3, 0, 'silent');
    lex.applyExternalChange(new ChangeSet().retain(0).insert('XX'));
    const sel = lex.getSelection();
    expect(sel).not.toBeNull();
    expect(sel!.index).toBe(5);
    expect(sel!.length).toBe(0);
    lex.destroy();
  });

  test('selection maps through external delete before selection', () => {
    const lex = createLextrix('<p>Hello</p>');
    lex.setSelection(3, 2, 'silent');
    lex.applyExternalChange(new ChangeSet().retain(0).delete(2));
    const sel = lex.getSelection();
    expect(sel!.index).toBe(1);
    expect(sel!.length).toBe(2);
    lex.destroy();
  });

  test('history transforms on remote; undo stack not polluted as user entry', () => {
    const lex = createLextrix('<p>Hi</p>');
    lex.insertText(2, '!', 'user');
    const undoBefore = lex.history.stack.undo.length;
    lex.applyExternalChange(new ChangeSet().retain(0).insert('Z'));
    // Remote should transform existing undo entries, not add a user record.
    expect(lex.history.stack.undo.length).toBe(undoBefore);
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    lex.destroy();
  });

  test('projectionDepth restores after thrown project (bridge unit)', () => {
    const lex = createLextrix('<p>Hi</p>');
    const bridge = (
      lex as unknown as {
        documentBridge: {
          runAsProjection: <T>(fn: () => T) => T;
          getProjectionDepth: () => number;
        };
      }
    ).documentBridge;
    expect(() =>
      bridge.runAsProjection(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(bridge.getProjectionDepth()).toBe(0);
    expect(lex.getProjectionDepth()).toBe(0);
    lex.destroy();
  });

  test('local editor path unchanged after projection', () => {
    const lex = createLextrix('<p>Hi</p>');
    lex.applyExternalChange(new ChangeSet().retain(2).insert('!'));
    lex.insertText(0, '>', 'user');
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    lex.destroy();
  });

  test('versions immutable after projection', () => {
    const lex = createLextrix('<p>Hello</p>');
    const v0 = lex.getExperimentalVersion()!;
    const ops0 = [...v0.contents.ops];
    lex.applyExternalChange(new ChangeSet().retain(5).insert('!'));
    expect(v0.contents.ops).toEqual(ops0);
    lex.destroy();
  });

  test('AI-tagged external change uses Hybrid B+ (no special AI path)', () => {
    const lex = createLextrix('<p>Hello</p>');
    const remote = new ChangeSet().retain(5).insert('!');
    const result = lex.applyExternalChange(remote, {
      meta: { source: 'ai', intent: 'exclaim', explanation: 'test' },
    });
    expect(result.status).toBe('ok');
    expectContentsEqual(
      lex.getContents(),
      lex.getExperimentalDocument()!.getContents(),
    );
    expect(lex.getExperimentalDocument()!.lastAppliedMeta?.source).toBe('ai');
    lex.destroy();
  });
});
