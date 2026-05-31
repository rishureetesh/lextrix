import ChangeSet from 'lextron-change';
import Editor from 'lextron-core/core/editor.js';
import {
  createScroll as baseCreateScroll,
  createRegistry,
} from '../__helpers__/factory.js';
import { ColorStyle } from 'lextron-formats/formats/color.js';
import { describe, expect, test } from 'vitest';
import Bold from 'lextron-formats/formats/bold.js';

const createScroll = (html: string) =>
  baseCreateScroll(html, createRegistry([ColorStyle, Bold]));

describe('Color', () => {
  test('add', () => {
    const editor = new Editor(createScroll('<p>0123</p>'));
    editor.formatText(1, 2, { color: 'red' });
    expect(editor.getChangeSet()).toEqual(
      new ChangeSet().insert('0').insert('12', { color: 'red' }).insert('3\n'),
    );
    expect(editor.scroll.domNode).toEqualHTML(
      '<p>0<span style="color: red;">12</span>3</p>',
    );
  });

  test('remove', () => {
    const editor = new Editor(
      createScroll('<p>0<strong style="color: red;">12</strong>3</p>'),
    );
    editor.formatText(1, 2, { color: false });
    const delta = new ChangeSet()
      .insert('0')
      .insert('12', { bold: true })
      .insert('3\n');
    expect(editor.getChangeSet()).toEqual(delta);
    expect(editor.scroll.domNode).toEqualHTML('<p>0<strong>12</strong>3</p>');
  });

  test('remove unwrap', () => {
    const editor = new Editor(
      createScroll('<p>0<span style="color: red;">12</span>3</p>'),
    );
    editor.formatText(1, 2, { color: false });
    expect(editor.getChangeSet()).toEqual(new ChangeSet().insert('0123\n'));
    expect(editor.scroll.domNode).toEqualHTML('<p>0123</p>');
  });

  test('invalid scope', () => {
    const editor = new Editor(createScroll('<p>0123</p>'));
    editor.formatText(4, 1, { color: 'red' });
    expect(editor.getChangeSet()).toEqual(new ChangeSet().insert('0123\n'));
    expect(editor.scroll.domNode).toEqualHTML('<p>0123</p>');
  });
});
