/**
 * @vitest-environment jsdom
 */
import ChangeSet from 'lextrix-change';
import { describe, expect, test } from 'vitest';
import hljs from 'highlight.js';
import Lextrix from '../../../src/lextrix.js';

const CODE = 'const editor = new Lextrix(container);';

function countOptimize(editor: Lextrix) {
  let optimizeCount = 0;
  const orig = editor.scroll.optimize.bind(editor.scroll);
  editor.scroll.optimize = (...args: unknown[]) => {
    optimizeCount += 1;
    if (optimizeCount > 150) {
      throw new Error(`optimize loop: ${optimizeCount}`);
    }
    return orig(...args);
  };
  return () => optimizeCount;
}

describe('full bundle code-block Enter', () => {
  test('updateContents newline with syntax disabled uses plain CodeBlock', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const editor = new Lextrix(mount, {
      theme: 'snow',
      modules: {
        toolbar: [['code-block']],
        syntax: false,
      },
    });

    editor.setContents([
      { insert: `${CODE}\n`, attributes: { 'code-block': true } },
    ]);

    const getOptimizeCount = countOptimize(editor);

    const index = editor.getLength() - 1;
    editor.updateContents(
      new ChangeSet().retain(index).insert('\n', { 'code-block': true }),
      Lextrix.sources.USER,
    );

    expect(getOptimizeCount()).toBeLessThan(50);
    expect(
      editor.root.querySelectorAll('.lxr-code-block').length,
    ).toBeGreaterThanOrEqual(2);

    editor.destroy();
    mount.remove();
  });

  test('keyboard Enter at end of line with syntax highlighting does not freeze', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const editor = new Lextrix(mount, {
      theme: 'snow',
      modules: {
        toolbar: [['code-block']],
        syntax: { hljs, interval: 60_000 },
      },
    });

    editor.setContents([
      { insert: `${CODE}\n`, attributes: { 'code-block': 'javascript' } },
    ]);

    const getOptimizeCount = countOptimize(editor);
    const index = editor.getLength() - 1;
    editor.setSelection(index, Lextrix.sources.SILENT);

    editor.updateContents(
      new ChangeSet().retain(index).insert('\n', { 'code-block': 'javascript' }),
      Lextrix.sources.USER,
    );

    expect(getOptimizeCount()).toBeLessThan(50);
    expect(editor.root.querySelectorAll('.lxr-code-block').length).toBeGreaterThanOrEqual(
      2,
    );

    editor.destroy();
    mount.remove();
  });
});
