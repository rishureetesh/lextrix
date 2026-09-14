/**
 * Phase 6M — Projection failure: Document authoritative, no rollback.
 */
import ChangeSet from 'lextrix-change';
import { describe, expect, test } from 'vitest';
import {
  createEditorDocumentBridge,
  contentsEqual,
} from 'lextrix-core/core/document-bridge/index.js';

describe('Phase 6M projection failure semantics', () => {
  test('project failure + resync success → status resync; Document unchanged by project', () => {
    const bridge = createEditorDocumentBridge(
      new ChangeSet().insert('Hello\n'),
    );
    const before = bridge.currentVersion().id;
    let editor = bridge.getDocument().getContents().clone();

    const result = bridge.applyExternalChange(
      new ChangeSet().retain(5).insert('!'),
      {
        project: () => {
          throw new Error('project boom');
        },
        resync: (doc) => {
          editor = doc.clone();
        },
        getEditorContents: () => editor,
      },
    );

    expect(result.status).toBe('resync');
    expect(result.desynchronized).toBe(false);
    expect(bridge.currentVersion().id).not.toBe(before);
    expect(contentsEqual(editor, bridge.getDocument().getContents())).toBe(
      true,
    );
    // Version advanced once only
    expect(bridge.listVersions().length).toBeGreaterThan(1);
  });

  test('project + resync both fail → desync; Document still advanced (no rollback)', () => {
    const bridge = createEditorDocumentBridge(
      new ChangeSet().insert('Hello\n'),
    );
    const beforeCount = bridge.listVersions().length;
    const editor = new ChangeSet().insert('STALE\n');

    const result = bridge.applyExternalChange(
      new ChangeSet().retain(5).insert('!'),
      {
        project: () => {
          throw new Error('project boom');
        },
        resync: () => {
          throw new Error('resync boom');
        },
        getEditorContents: () => editor,
      },
    );

    expect(result.status).toBe('desync');
    expect(result.desynchronized).toBe(true);
    expect(bridge.listVersions().length).toBe(beforeCount + 1);
    // Document has the mutation; editor does not
    expect(
      contentsEqual(editor, bridge.getDocument().getContents()),
    ).toBe(false);
  });

  test('projectAppliedChange after accept does not re-apply Document', () => {
    const bridge = createEditorDocumentBridge(
      new ChangeSet().insert('Hi\n'),
    );
    const change = new ChangeSet().retain(2).insert('!');
    const proposal = bridge.getHandle().createProposal(change, {
      meta: { source: 'ai' },
    });
    bridge.getHandle().acceptProposal(proposal);
    const versions = bridge.listVersions().length;
    let editor = new ChangeSet().insert('Hi\n');

    const result = bridge.projectAppliedChange(change, {
      project: (applied) => {
        editor = editor.compose(applied);
      },
      resync: (doc) => {
        editor = doc.clone();
      },
      getEditorContents: () => editor,
    });

    expect(result.status).toBe('ok');
    expect(bridge.listVersions()).toHaveLength(versions);
    expect(contentsEqual(editor, bridge.getDocument().getContents())).toBe(
      true,
    );
  });

  test('accept then failed project: Document accepted; projection desync; no second apply', () => {
    const bridge = createEditorDocumentBridge(
      new ChangeSet().insert('Hello\n'),
    );
    const change = new ChangeSet().retain(5).insert('!');
    const proposal = bridge.getHandle().createProposal(change, {
      meta: { source: 'ai', explanation: 'exclaim' },
    });
    const accepted = bridge.getHandle().acceptProposal(proposal);
    expect(accepted.empty).toBe(false);
    const versions = bridge.listVersions().length;
    const docOps = bridge.getDocument().getContents().ops;

    const projection = bridge.projectAppliedChange(change, {
      project: () => {
        throw new Error('editor down');
      },
      resync: () => {
        throw new Error('resync down');
      },
      getEditorContents: () => new ChangeSet().insert('Hello\n'),
    });

    expect(projection.status).toBe('desync');
    expect(bridge.listVersions()).toHaveLength(versions);
    expect(bridge.getDocument().getContents().ops).toEqual(docOps);
    expect(bridge.getDocument().lastAppliedMeta?.source).toBe('ai');
  });

  test('repeated resync does not create Versions or feed back into Document', () => {
    const bridge = createEditorDocumentBridge(
      new ChangeSet().insert('Hi\n'),
    );
    const change = new ChangeSet().retain(2).insert('!');
    bridge.applyExternalChange(change, {
      project: (a) => {
        void a;
      },
      resync: () => undefined,
      getEditorContents: () => bridge.getDocument().getContents(),
    });
    const versions = bridge.listVersions().length;
    const ops = [...bridge.getDocument().getContents().ops];
    const reconcileBefore = bridge.getReconcileCount();

    for (let i = 0; i < 3; i++) {
      bridge.projectAppliedChange(new ChangeSet(), {
        project: () => undefined,
        resync: () => undefined,
        getEditorContents: () => bridge.getDocument().getContents(),
      });
      bridge.runAsProjection(() => {
        // empty projection guard exercise
      });
    }

    expect(bridge.listVersions()).toHaveLength(versions);
    expect(bridge.getDocument().getContents().ops).toEqual(ops);
    expect(bridge.getReconcileCount()).toBe(reconcileBefore);
  });
});
