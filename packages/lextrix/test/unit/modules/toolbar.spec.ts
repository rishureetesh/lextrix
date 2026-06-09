import { describe, expect, test } from 'vitest';
import Lextrix from 'lextrix-core/core/lextrix.js';
import { lxrPath } from 'lextrix-core';
import Toolbar, { addControls } from 'lextrix-modules/modules/toolbar.js';
import { normalizeHTML } from '../__helpers__/utils.js';
import { SnowTheme } from 'lextrix-themes';
import Clipboard from 'lextrix-modules/modules/clipboard.js';
import Keyboard from 'lextrix-modules/modules/keyboard.js';
import History from 'lextrix-modules/modules/history.js';
import Uploader from 'lextrix-modules/modules/uploader.js';
import { createRegistry } from '../__helpers__/factory.js';
import Input from 'lextrix-modules/modules/input.js';
import { SizeClass } from 'lextrix-formats/formats/size.js';
import Bold from 'lextrix-formats/formats/bold.js';
import Link from 'lextrix-formats/formats/link.js';
import { AlignClass } from 'lextrix-formats/formats/align.js';
import UINode from 'lextrix-modules/modules/uiNode.js';

const createContainer = (html = '') => {
  const container = document.body.appendChild(document.createElement('div'));
  container.innerHTML = normalizeHTML(html);
  return container;
};

describe('Toolbar', () => {
  describe('add controls', () => {
    test('single level', () => {
      const container = createContainer();
      addControls(container, ['bold', 'italic']);
      expect(container).toEqualHTML(`
        <span class="lxr-formats">
          <button type="button" aria-label="bold" class="lxr-bold" aria-pressed="false"></button>
          <button type="button" aria-label="italic" class="lxr-italic" aria-pressed="false"></button>
        </span>
      `);
    });

    test('nested group', () => {
      const container = createContainer();
      addControls(container, [
        ['bold', 'italic'],
        ['underline', 'strike'],
      ]);
      expect(container).toEqualHTML(`
        <span class="lxr-formats">
          <button type="button" aria-label="bold" class="lxr-bold" aria-pressed="false"></button>
          <button type="button" aria-label="italic" class="lxr-italic" aria-pressed="false"></button>
        </span>
        <span class="lxr-formats">
          <button type="button" aria-label="underline" class="lxr-underline" aria-pressed="false"></button>
          <button type="button" aria-label="strike" class="lxr-strike" aria-pressed="false"></button>
        </span>
      `);
    });

    test('button value', () => {
      const container = createContainer();
      addControls(container, ['bold', { header: '2' }]);
      expect(container).toEqualHTML(`
        <span class="lxr-formats">
          <button type="button" aria-label="bold" class="lxr-bold" aria-pressed="false"></button>
          <button type="button" aria-label="header: 2" class="lxr-header" aria-pressed="false" value="2"></button>
        </span>
      `);
    });

    test('select', () => {
      const container = createContainer();
      addControls(container, [{ size: ['10px', false, '18px', '32px'] }]);
      expect(container).toEqualHTML(`
        <span class="lxr-formats">
          <select class="lxr-size">
            <option value="10px"></option>
            <option selected="selected"></option>
            <option value="18px"></option>
            <option value="32px"></option>
          </select>
        </span>
      `);
    });

    test('everything', () => {
      const container = createContainer();
      addControls(container, [
        [
          { font: [false, 'sans-serif', 'monospace'] },
          { size: ['10px', false, '18px', '32px'] },
        ],
        ['bold', 'italic', 'underline', 'strike'],
        [
          { list: 'ordered' },
          { list: 'bullet' },
          { align: [false, 'center', 'right', 'justify'] },
        ],
        ['link', 'image'],
      ]);
      expect(container).toEqualHTML(`
        <span class="lxr-formats">
          <select class="lxr-font">
            <option selected="selected"></option>
            <option value="sans-serif"></option>
            <option value="monospace"></option>
          </select>
          <select class="lxr-size">
            <option value="10px"></option>
            <option selected="selected"></option>
            <option value="18px"></option>
            <option value="32px"></option>
          </select>
        </span>
        <span class="lxr-formats">
          <button type="button" aria-label="bold" class="lxr-bold" aria-pressed="false"></button>
          <button type="button" aria-label="italic" class="lxr-italic" aria-pressed="false"></button>
          <button type="button" aria-label="underline" class="lxr-underline" aria-pressed="false"></button>
          <button type="button" aria-label="strike" class="lxr-strike" aria-pressed="false"></button>
        </span>
        <span class="lxr-formats">
          <button type="button" aria-label="list: ordered" class="lxr-list" value="ordered" aria-pressed="false"></button>
          <button type="button" aria-label="list: bullet" class="lxr-list" value="bullet" aria-pressed="false"></button>
          <select class="lxr-align">
            <option selected="selected"></option>
            <option value="center"></option>
            <option value="right"></option>
            <option value="justify"></option>
          </select>
        </span>
        <span class="lxr-formats">
          <button type="button" aria-label="link" class="lxr-link" aria-pressed="false"></button>
          <button type="button" aria-label="image" class="lxr-image" aria-pressed="false"></button>
        </span>
      `);
    });
  });

  describe('active', () => {
    const setup = () => {
      const container = createContainer(
        `
        <p>0123</p>
        <p><strong>5678</strong></p>
        <p><a href="http://iamreetesh.com/">0123</a></p>
        <p class="lxr-align-center">5678</p>
        <p><span class="lxr-size-small">01</span><span class="lxr-size-large">23</span></p>
      `,
      );

      Lextrix.register(
        {
          [lxrPath.theme('snow')]: SnowTheme,
          [lxrPath.module('toolbar')]: Toolbar,
          [lxrPath.module('clipboard')]: Clipboard,
          [lxrPath.module('keyboard')]: Keyboard,
          [lxrPath.module('history')]: History,
          [lxrPath.module('uploader')]: Uploader,
          [lxrPath.module('input')]: Input,
          [lxrPath.module('uiNode')]: UINode,
        },
        true,
      );
      const editor = new Lextrix(container, {
        modules: {
          toolbar: [
            ['bold', 'link'],
            [{ size: ['small', false, 'large'] }],
            [{ align: '' }, { align: 'center' }],
          ],
        },
        theme: 'snow',
        registry: createRegistry([SizeClass, Bold, AlignClass, Link]),
      });
      return { container, editor };
    };

    test('toggle button', () => {
      const { container, editor } = setup();
      const boldButton = container.querySelector(
        'button.lxr-bold',
      ) as HTMLButtonElement;
      editor.setSelection(7);
      expect(boldButton.classList.contains('lxr-active')).toBe(true);
      expect(boldButton.getAttribute('aria-pressed')).toBe('true');
      editor.setSelection(2);
      expect(boldButton.classList.contains('lxr-active')).toBe(false);
      expect(boldButton.getAttribute('aria-pressed')).toBe('false');
    });

    test('link', () => {
      const { container, editor } = setup();
      const linkButton = container.querySelector(
        'button.lxr-link',
      ) as HTMLButtonElement;
      editor.setSelection(12);
      expect(linkButton.classList.contains('lxr-active')).toBe(true);
      expect(linkButton.getAttribute('aria-pressed')).toBe('true');
      editor.setSelection(2);
      expect(linkButton.classList.contains('lxr-active')).toBe(false);
      expect(linkButton.getAttribute('aria-pressed')).toBe('false');
    });

    test('dropdown', () => {
      const { container, editor } = setup();
      const sizeSelect = container.querySelector(
        'select.lxr-size',
      ) as HTMLSelectElement;
      editor.setSelection(21);
      expect(sizeSelect.selectedIndex).toEqual(0);
      editor.setSelection(23);
      expect(sizeSelect.selectedIndex).toEqual(2);
      editor.setSelection(21, 2);
      expect(sizeSelect.selectedIndex).toBeLessThan(0);
      editor.setSelection(2);
      expect(sizeSelect.selectedIndex).toEqual(1);
    });

    test('custom button', () => {
      const { container, editor } = setup();
      const centerButton = container.querySelector(
        'button.lxr-align[value="center"]',
      ) as HTMLButtonElement;
      const leftButton = container.parentNode?.querySelector(
        'button.lxr-align[value]',
      ) as HTMLButtonElement;
      editor.setSelection(17);
      expect(centerButton.classList.contains('lxr-active')).toBe(true);
      expect(leftButton.classList.contains('lxr-active')).toBe(false);
      expect(centerButton.getAttribute('aria-pressed')).toBe('true');
      expect(leftButton.getAttribute('aria-pressed')).toBe('false');
      editor.setSelection(2);
      expect(centerButton.classList.contains('lxr-active')).toBe(false);
      expect(leftButton.classList.contains('lxr-active')).toBe(true);
      expect(centerButton.getAttribute('aria-pressed')).toBe('false');
      expect(leftButton.getAttribute('aria-pressed')).toBe('true');
      editor.blur();
      expect(centerButton.classList.contains('lxr-active')).toBe(false);
      expect(leftButton.classList.contains('lxr-active')).toBe(false);
      expect(centerButton.getAttribute('aria-pressed')).toBe('false');
      expect(leftButton.getAttribute('aria-pressed')).toBe('false');
    });

    test('update on format', () => {
      const { container, editor } = setup();
      const boldButton = container?.parentNode?.querySelector('button.lxr-bold');
      editor.setSelection(1, 2);
      expect(boldButton?.classList.contains('lxr-active')).toBe(false);
      editor.format('bold', true, 'user');
      expect(boldButton?.classList.contains('lxr-active')).toBe(true);
    });
  });
});
