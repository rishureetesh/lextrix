import { describe, expect, test } from 'vitest';
import Lextron from 'lextron-core/core/lextron.js';
import { lxtPath } from 'lextron-core';
import Toolbar, { addControls } from 'lextron-modules/modules/toolbar.js';
import { normalizeHTML } from '../__helpers__/utils.js';
import { SnowTheme } from 'lextron-themes';
import Clipboard from 'lextron-modules/modules/clipboard.js';
import Keyboard from 'lextron-modules/modules/keyboard.js';
import History from 'lextron-modules/modules/history.js';
import Uploader from 'lextron-modules/modules/uploader.js';
import { createRegistry } from '../__helpers__/factory.js';
import Input from 'lextron-modules/modules/input.js';
import { SizeClass } from 'lextron-formats/formats/size.js';
import Bold from 'lextron-formats/formats/bold.js';
import Link from 'lextron-formats/formats/link.js';
import { AlignClass } from 'lextron-formats/formats/align.js';
import UINode from 'lextron-modules/modules/uiNode.js';

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
        <span class="lxt-formats">
          <button type="button" aria-label="bold" class="lxt-bold" aria-pressed="false"></button>
          <button type="button" aria-label="italic" class="lxt-italic" aria-pressed="false"></button>
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
        <span class="lxt-formats">
          <button type="button" aria-label="bold" class="lxt-bold" aria-pressed="false"></button>
          <button type="button" aria-label="italic" class="lxt-italic" aria-pressed="false"></button>
        </span>
        <span class="lxt-formats">
          <button type="button" aria-label="underline" class="lxt-underline" aria-pressed="false"></button>
          <button type="button" aria-label="strike" class="lxt-strike" aria-pressed="false"></button>
        </span>
      `);
    });

    test('button value', () => {
      const container = createContainer();
      addControls(container, ['bold', { header: '2' }]);
      expect(container).toEqualHTML(`
        <span class="lxt-formats">
          <button type="button" aria-label="bold" class="lxt-bold" aria-pressed="false"></button>
          <button type="button" aria-label="header: 2" class="lxt-header" aria-pressed="false" value="2"></button>
        </span>
      `);
    });

    test('select', () => {
      const container = createContainer();
      addControls(container, [{ size: ['10px', false, '18px', '32px'] }]);
      expect(container).toEqualHTML(`
        <span class="lxt-formats">
          <select class="lxt-size">
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
        <span class="lxt-formats">
          <select class="lxt-font">
            <option selected="selected"></option>
            <option value="sans-serif"></option>
            <option value="monospace"></option>
          </select>
          <select class="lxt-size">
            <option value="10px"></option>
            <option selected="selected"></option>
            <option value="18px"></option>
            <option value="32px"></option>
          </select>
        </span>
        <span class="lxt-formats">
          <button type="button" aria-label="bold" class="lxt-bold" aria-pressed="false"></button>
          <button type="button" aria-label="italic" class="lxt-italic" aria-pressed="false"></button>
          <button type="button" aria-label="underline" class="lxt-underline" aria-pressed="false"></button>
          <button type="button" aria-label="strike" class="lxt-strike" aria-pressed="false"></button>
        </span>
        <span class="lxt-formats">
          <button type="button" aria-label="list: ordered" class="lxt-list" value="ordered" aria-pressed="false"></button>
          <button type="button" aria-label="list: bullet" class="lxt-list" value="bullet" aria-pressed="false"></button>
          <select class="lxt-align">
            <option selected="selected"></option>
            <option value="center"></option>
            <option value="right"></option>
            <option value="justify"></option>
          </select>
        </span>
        <span class="lxt-formats">
          <button type="button" aria-label="link" class="lxt-link" aria-pressed="false"></button>
          <button type="button" aria-label="image" class="lxt-image" aria-pressed="false"></button>
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
        <p class="lxt-align-center">5678</p>
        <p><span class="lxt-size-small">01</span><span class="lxt-size-large">23</span></p>
      `,
      );

      Lextron.register(
        {
          [lxtPath.theme('snow')]: SnowTheme,
          [lxtPath.module('toolbar')]: Toolbar,
          [lxtPath.module('clipboard')]: Clipboard,
          [lxtPath.module('keyboard')]: Keyboard,
          [lxtPath.module('history')]: History,
          [lxtPath.module('uploader')]: Uploader,
          [lxtPath.module('input')]: Input,
          [lxtPath.module('uiNode')]: UINode,
        },
        true,
      );
      const editor = new Lextron(container, {
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
      const boldButton = container.parentNode?.querySelector(
        'button.lxt-bold',
      ) as HTMLButtonElement;
      editor.setSelection(7);
      expect(boldButton.classList.contains('lxt-active')).toBe(true);
      expect(boldButton.getAttribute('aria-pressed')).toBe('true');
      editor.setSelection(2);
      expect(boldButton.classList.contains('lxt-active')).toBe(false);
      expect(boldButton.getAttribute('aria-pressed')).toBe('false');
    });

    test('link', () => {
      const { container, editor } = setup();
      const linkButton = container.parentNode?.querySelector(
        'button.lxt-link',
      ) as HTMLButtonElement;
      editor.setSelection(12);
      expect(linkButton.classList.contains('lxt-active')).toBe(true);
      expect(linkButton.getAttribute('aria-pressed')).toBe('true');
      editor.setSelection(2);
      expect(linkButton.classList.contains('lxt-active')).toBe(false);
      expect(linkButton.getAttribute('aria-pressed')).toBe('false');
    });

    test('dropdown', () => {
      const { container, editor } = setup();
      const sizeSelect = container.parentNode?.querySelector(
        'select.lxt-size',
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
      const centerButton = container.parentNode?.querySelector(
        'button.lxt-align[value="center"]',
      ) as HTMLButtonElement;
      const leftButton = container.parentNode?.querySelector(
        'button.lxt-align[value]',
      ) as HTMLButtonElement;
      editor.setSelection(17);
      expect(centerButton.classList.contains('lxt-active')).toBe(true);
      expect(leftButton.classList.contains('lxt-active')).toBe(false);
      expect(centerButton.getAttribute('aria-pressed')).toBe('true');
      expect(leftButton.getAttribute('aria-pressed')).toBe('false');
      editor.setSelection(2);
      expect(centerButton.classList.contains('lxt-active')).toBe(false);
      expect(leftButton.classList.contains('lxt-active')).toBe(true);
      expect(centerButton.getAttribute('aria-pressed')).toBe('false');
      expect(leftButton.getAttribute('aria-pressed')).toBe('true');
      editor.blur();
      expect(centerButton.classList.contains('lxt-active')).toBe(false);
      expect(leftButton.classList.contains('lxt-active')).toBe(false);
      expect(centerButton.getAttribute('aria-pressed')).toBe('false');
      expect(leftButton.getAttribute('aria-pressed')).toBe('false');
    });

    test('update on format', () => {
      const { container, editor } = setup();
      const boldButton = container?.parentNode?.querySelector('button.lxt-bold');
      editor.setSelection(1, 2);
      expect(boldButton?.classList.contains('lxt-active')).toBe(false);
      editor.format('bold', true, 'user');
      expect(boldButton?.classList.contains('lxt-active')).toBe(true);
    });
  });
});
