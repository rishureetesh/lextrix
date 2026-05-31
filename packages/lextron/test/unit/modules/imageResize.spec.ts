import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import Lextron, { registerBlots } from 'lextron-core';
import { registerFormats } from 'lextron-formats';
import { registerModules } from 'lextron-modules';
describe('imageResize module', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    registerBlots(Lextron, true);
    registerFormats(Lextron, true);
    registerModules(Lextron, true);
    container = document.body.appendChild(document.createElement('div'));
  });

  afterEach(() => {
    container.remove();
  });

  test('shows overlay when an image embed is selected', async () => {
    const editor = new Lextron(container, {
      modules: { imageResize: true },
    });
    editor.insertEmbed(0, 'image', '/assets/favicon.png');
    editor.setSelection(0, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const overlay = container.querySelector('.lxt-image-resize');
    expect(overlay).toBeTruthy();
    expect(overlay?.classList.contains('lxt-hidden')).toBe(false);
  });

  test('hides overlay when selection moves to text', async () => {
    const editor = new Lextron(container, {
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
    const overlay = container.querySelector('.lxt-image-resize');
    expect(overlay?.classList.contains('lxt-hidden')).toBe(true);
  });

  test('accepts minWidth option', () => {
    const editor = new Lextron(container, {
      modules: { imageResize: { minWidth: 120 } },
    });
    expect(editor.getModule('imageResize')).toBeTruthy();
  });});
