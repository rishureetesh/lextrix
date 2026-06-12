import { describe, expect, test, beforeEach, afterEach } from 'vitest';
import Lextrix, { registerBlots } from 'lextrix-core';
import { registerFormats } from 'lextrix-formats';
import { registerModules } from 'lextrix-modules';
describe('imageResize module', () => {
  let container: HTMLDivElement;
  const editors: Lextrix[] = [];
  const testImageSrc =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const createEditor = (
    options: ConstructorParameters<typeof Lextrix>[1] = {},
  ) => {
    const editor = new Lextrix(container, {
      modules: { imageResize: true },
      ...options,
    });
    editors.push(editor);
    return editor;
  };

  beforeEach(() => {
    registerBlots(Lextrix, true);
    registerFormats(Lextrix, true);
    registerModules(Lextrix, true);
    container = document.body.appendChild(document.createElement('div'));
  });

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    while (editors.length) {
      editors.pop()?.destroy();
    }
    container.remove();
  });

  test('shows overlay when an image embed is selected', async () => {
    const editor = createEditor();
    editor.insertEmbed(0, 'image', testImageSrc);
    editor.setSelection(0, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const overlay = container.querySelector('.lxr-image-resize');
    expect(overlay).toBeTruthy();
    expect(overlay?.classList.contains('lxr-hidden')).toBe(false);
    expect(overlay?.parentElement).toBe(editor.container);
  });

  test('hides overlay when selection moves to text', async () => {
    const editor = createEditor();
    editor.setContents([
      { insert: 'Hello ' },
      { insert: { image: testImageSrc } },
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
    createEditor({ modules: { imageResize: { minWidth: 120 } } });
    expect(container.querySelector('.lxr-editor')).toBeTruthy();
  });

  test('aligns overlay with image when editor is offset on the page', async () => {
    container.style.marginTop = '120px';
    container.style.marginLeft = '80px';
    const editor = createEditor();
    editor.insertEmbed(0, 'image', testImageSrc);
    editor.setSelection(0, 1);
    const img = container.querySelector('img') as HTMLImageElement;
    await img.decode();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const overlay = editor.container.querySelector(
      '.lxr-image-resize',
    ) as HTMLDivElement;
    expect(overlay).toBeTruthy();
    expect(overlay.classList.contains('lxr-hidden')).toBe(false);
    const containerRect = editor.container.getBoundingClientRect();
    const imageRect = img.getBoundingClientRect();
    expect(parseFloat(overlay.style.left)).approximately(
      imageRect.left - containerRect.left,
      1,
    );
    expect(parseFloat(overlay.style.top)).approximately(
      imageRect.top - containerRect.top,
      1,
    );
    expect(parseFloat(overlay.style.width)).approximately(imageRect.width, 1);
    expect(parseFloat(overlay.style.height)).approximately(imageRect.height, 1);
    const bounds = editor.getBounds(0, 1);
    expect(bounds).toBeTruthy();
    expect(parseFloat(overlay.style.top)).not.approximately(
      bounds!.top - containerRect.top,
      1,
    );
  });

  test('destroy removes overlay', async () => {
    const editor = createEditor();
    editor.insertEmbed(0, 'image', testImageSrc);
    editor.setSelection(0, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container.querySelector('.lxr-image-resize')).toBeTruthy();
    editor.destroy();
    editors.pop();
    expect(container.querySelector('.lxr-image-resize')).toBeNull();
  });

  test('remount after destroy does not leave orphan overlays', async () => {
    const first = createEditor();
    first.insertEmbed(0, 'image', testImageSrc);
    first.setSelection(0, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    first.destroy();
    editors.pop();

    const second = createEditor();
    second.insertEmbed(0, 'image', testImageSrc);
    second.setSelection(0, 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container.querySelectorAll('.lxr-image-resize').length).toBe(1);
  });
});
