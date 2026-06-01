import ChangeSet from 'lextrix-change';
import {
  createScroll as baseCreateScroll,
  createRegistry,
} from '../__helpers__/factory.js';
import Editor from 'lextrix-core/core/editor.js';
import List, { ListContainer } from 'lextrix-formats/formats/list.js';
import IndentClass from 'lextrix-formats/formats/indent.js';
import { describe, expect, test } from 'vitest';

const createScroll = (html: string) =>
  baseCreateScroll(html, createRegistry([ListContainer, List, IndentClass]));

describe('Indent', () => {
  test('+1', () => {
    const editor = new Editor(
      createScroll('<ol><li data-list="bullet">0123</li></ol>'),
    );
    editor.formatText(4, 1, { indent: '+1' });
    expect(editor.getChangeSet()).toEqual(
      new ChangeSet().insert('0123').insert('\n', { list: 'bullet', indent: 1 }),
    );
    expect(editor.scroll.domNode).toEqualHTML(`
      <ol>
        <li class="lxr-indent-1" data-list="bullet">0123</li>
      </ol>
    `);
  });

  test('-1', () => {
    const editor = new Editor(
      createScroll(
        '<ol><li data-list="bullet" class="lxr-indent-1">0123</li></ol>',
      ),
    );
    editor.formatText(4, 1, { indent: '-1' });
    expect(editor.getChangeSet()).toEqual(
      new ChangeSet().insert('0123').insert('\n', { list: 'bullet' }),
    );
    expect(editor.scroll.domNode).toEqualHTML(`
      <ol>
        <li data-list="bullet">0123</li>
      </ol>
    `);
  });

  test('1', () => {
    const editor = new Editor(createScroll('<p>abc</p>'));
    editor.formatText(3, 1, { indent: 1 });
    expect(editor.getChangeSet()).toEqual(
      new ChangeSet().insert('abc').insert('\n', { indent: 1 }),
    );
    expect(editor.scroll.domNode).toEqualHTML(`<p class="lxr-indent-1">abc</p>`);
  });
});
