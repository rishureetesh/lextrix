import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import Lextrix, { registerBlots } from 'lextrix-core';
import { registerFormats } from 'lextrix-formats';
import { registerModules } from 'lextrix-modules';
describe('imageResize module', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    registerBlots(Lextrix, true);
    registerFormats(Lextrix, true);
    registerModules(Lextrix, true);
    container = document.body.appendChild(document.createElement('div'));
  });

  afterEach(() => {
    container.remove();
  });

  test('shows overlay when an image embed is selected', async () => {
    const editor = new Lextrix(container, {
      modules: { imageResize: true },
    });
    editor.insertEmbed(0, 'image', '/assets/favicon.png');
    editor.setSelection(0, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const overlay = container.querySelector('.lxr-image-resize');
    expect(overlay).toBeTruthy();
    expect(overlay?.classList.contains('lxr-hidden')).toBe(false);
  });

  test('hides overlay when selection moves to text', async () => {
    const editor = new Lextrix(container, {
      modules: { imageResize: true },
    });
    editor.setContents([
      { insert: 'Hello ' },
      { insert: { image: '/assets/favicon.png' } },
      { insert: ' world' },
    ]);
    editor.setSelection(6, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    editor.setSelection(0, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const overlay = container.querySelector('.lxr-image-resize');
    expect(overlay?.classList.contains('lxr-hidden')).toBe(true);
  });

  test('accepts minWidth option', () => {
    const editor = new Lextrix(container, {
      modules: { imageResize: { minWidth: 120 } },
    });
    expect(editor.getModule('imageResize')).toBeTruthy();
  });});
