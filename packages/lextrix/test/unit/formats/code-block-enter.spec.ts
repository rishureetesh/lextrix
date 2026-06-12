/**
 * @vitest-environment jsdom
 *
 * Regression: Enter in a syntax-highlighted code block must not spin optimize forever.
 * Root cause was SyntaxCodeBlock.optimize() removing Break blots while
 * Block.defaultChild re-inserted them on empty lines (ParentBlot.optimize).
 */
import ChangeSet from 'lextrix-change';
import { describe, expect, test } from 'vitest';
import hljs from 'highlight.js';
import Lextrix from '../../../src/lextrix.js';

const CODE = 'const editor = new Lextrix(container);';

describe('code-block Enter (SyntaxCodeBlock registered)', () => {
  test('insert newline at end of line completes in bounded optimize passes', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const editor = new Lextrix(mount, {
      modules: {
        toolbar: false,
        syntax: { hljs, interval: 60_000 },
      },
    });

    editor.setContents([
      { insert: `${CODE}\n`, attributes: { 'code-block': 'javascript' } },
    ]);

    let optimizeCount = 0;
    const orig = editor.scroll.optimize.bind(editor.scroll);
    editor.scroll.optimize = (...args: unknown[]) => {
      optimizeCount += 1;
      if (optimizeCount > 150) {
        throw new Error(`optimize loop: ${optimizeCount} calls`);
      }
      return orig(...args);
    };

    const index = editor.getLength() - 1;
    editor.updateContents(
      new ChangeSet().retain(index).insert('\n', { 'code-block': 'javascript' }),
      Lextrix.sources.USER,
    );

    expect(optimizeCount).toBeLessThan(50);
    expect(editor.root.querySelectorAll('.lxr-code-block').length).toBeGreaterThanOrEqual(
      2,
    );

    editor.destroy();
    mount.remove();
  });
});
