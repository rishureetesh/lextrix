import { describe, expect, test } from 'vitest';
import Lextrix from '../../../src/lextrix.js';

describe('Lextrix.destroy()', () => {
  test('removes auto toolbar inside mount and clears container', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const editor = new Lextrix(mount, {
      theme: 'snow',
      modules: {
        toolbar: [['bold', 'italic']],
      },
    });

    expect(mount.querySelector(':scope > .lxr-toolbar')).not.toBeNull();
    expect(mount.querySelector(':scope > .lxr-editor')).not.toBeNull();

    editor.destroy();

    expect(mount.querySelector('.lxr-toolbar')).toBeNull();
    expect(mount.querySelector('.lxr-editor')).toBeNull();
    expect(mount.childNodes.length).toBe(0);

    mount.remove();
  });

  test('destroy is idempotent', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const editor = new Lextrix(mount, {
      theme: 'snow',
      modules: { toolbar: [['bold']] },
    });

    editor.destroy();
    expect(() => editor.destroy()).not.toThrow();

    mount.remove();
  });

  test('remount after destroy does not stack toolbars', () => {
    const mount = document.createElement('div');
    document.body.appendChild(mount);

    const first = new Lextrix(mount, {
      theme: 'snow',
      modules: { toolbar: [['bold']] },
    });
    first.destroy();

    const second = new Lextrix(mount, {
      theme: 'snow',
      modules: { toolbar: [['bold']] },
    });

    expect(mount.querySelectorAll(':scope > .lxr-toolbar').length).toBe(1);

    second.destroy();
    mount.remove();
  });
});
