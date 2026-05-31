import ChangeSet from 'lextron-change';
import { describe, expect, test, vitest } from 'vitest';
import Lextron from '../../../src/core.js';
import { getLastChangeIndex } from 'lextron-modules/modules/history.js';
import type { HistoryOptions } from 'lextron-modules/modules/history.js';
import { createRegistry, createScroll } from '../__helpers__/factory.js';
import { sleep } from '../__helpers__/utils.js';
import Bold from 'lextron-formats/formats/bold.js';
import Image from 'lextron-formats/formats/image.js';
import Link from 'lextron-formats/formats/link.js';
import { AlignClass } from 'lextron-formats/formats/align.js';

describe('History', () => {
  const scroll = createScroll(
    '',
    createRegistry([Bold, Image, Link, AlignClass]),
  );

  describe('getLastChangeIndex', () => {
    test('delete', () => {
      const delta = new ChangeSet().retain(4).delete(2);
      expect(getLastChangeIndex(scroll, delta)).toEqual(4);
    });

    test('delete with inserts', () => {
      const delta = new ChangeSet().retain(4).insert('test').delete(2);
      expect(getLastChangeIndex(scroll, delta)).toEqual(8);
    });

    test('insert text', () => {
      const delta = new ChangeSet().retain(4).insert('testing');
      expect(getLastChangeIndex(scroll, delta)).toEqual(11);
    });

    test('insert embed', () => {
      const delta = new ChangeSet().retain(4).insert({ image: true });
      expect(getLastChangeIndex(scroll, delta)).toEqual(5);
    });

    test('insert with deletes', () => {
      const delta = new ChangeSet().retain(4).delete(3).insert('!');
      expect(getLastChangeIndex(scroll, delta)).toEqual(5);
    });

    test('format', () => {
      const delta = new ChangeSet().retain(4).retain(3, { bold: true });
      expect(getLastChangeIndex(scroll, delta)).toEqual(7);
    });

    test('format newline', () => {
      const delta = new ChangeSet().retain(4).retain(1, { align: 'left' });
      expect(getLastChangeIndex(scroll, delta)).toEqual(4);
    });

    test('format mixed', () => {
      const delta = new ChangeSet()
        .retain(4)
        .retain(1, { align: 'left', bold: true });
      expect(getLastChangeIndex(scroll, delta)).toEqual(4);
    });

    test('insert newline', () => {
      const delta = new ChangeSet().retain(4).insert('a\n');
      expect(getLastChangeIndex(scroll, delta)).toEqual(5);
    });

    test('mutliple newline inserts', () => {
      const delta = new ChangeSet().retain(4).insert('ab\n\n');
      expect(getLastChangeIndex(scroll, delta)).toEqual(7);
    });
  });

  describe('undo/redo', () => {
    const setup = (options?: Partial<HistoryOptions>) => {
      const container = document.body.appendChild(
        document.createElement('div'),
      );
      container.innerHTML = '<div><p>The lazy fox</p></div>';
      const editor = new Lextron(container, {
        modules: {
          history: { delay: 400, ...options },
        },
        registry: scroll.registry,
      });
      return { editor, original: editor.getContents() };
    };

    test('limits undo stack size', () => {
      const { editor } = setup({ delay: 0, maxStack: 2 });
      ['A', 'B', 'C'].forEach((text) => {
        editor.insertText(0, text);
      });
      expect(editor.history.stack.undo.length).toEqual(2);
    });

    test('emits selection changes', () => {
      const { editor } = setup({ delay: 0 });
      editor.insertText(0, 'foo');
      const change = vitest.fn();
      editor.on('selection-change', change);
      editor.history.undo();

      expect(change).toHaveBeenCalledOnce();
      expect(change).toHaveBeenCalledWith(expect.anything(), null, 'user');
    });

    test('user change', () => {
      const { editor, original } = setup({ delay: 0 });
      (editor.root.firstChild as HTMLElement).innerHTML = 'The lazy foxes';
      editor.update();
      const changed = editor.getContents();
      expect(changed).not.toEqual(original);
      editor.history.undo();
      expect(editor.getContents()).toEqual(original);
      editor.history.redo();
      expect(editor.getContents()).toEqual(changed);
    });

    test('merge changes', () => {
      const { editor, original } = setup();
      expect(editor.history.stack.undo.length).toEqual(0);
      editor.updateContents(new ChangeSet().retain(12).insert('e'));
      expect(editor.history.stack.undo.length).toEqual(1);
      editor.updateContents(new ChangeSet().retain(13).insert('s'));
      expect(editor.history.stack.undo.length).toEqual(1);
      editor.history.undo();
      expect(editor.getContents()).toEqual(original);
      expect(editor.history.stack.undo.length).toEqual(0);
    });

    test('dont merge changes', async () => {
      const { editor } = setup();
      expect(editor.history.stack.undo.length).toEqual(0);
      editor.updateContents(new ChangeSet().retain(12).insert('e'));
      expect(editor.history.stack.undo.length).toEqual(1);
      // @ts-expect-error
      await sleep((editor.history.options.delay as number) * 1.25);
      editor.updateContents(new ChangeSet().retain(13).insert('s'));
      expect(editor.history.stack.undo.length).toEqual(2);
    });

    test('multiple undos', async () => {
      const { editor, original } = setup();
      expect(editor.history.stack.undo.length).toEqual(0);
      editor.updateContents(new ChangeSet().retain(12).insert('e'));
      const contents = editor.getContents();
      // @ts-expect-error
      await sleep((editor.history.options.delay as number) * 1.25);
      editor.updateContents(new ChangeSet().retain(13).insert('s'));
      editor.history.undo();
      expect(editor.getContents()).toEqual(contents);
      editor.history.undo();
      expect(editor.getContents()).toEqual(original);
    });

    test('transform api change', () => {
      const { editor } = setup();
      // @ts-expect-error
      editor.history.options.userOnly = true;
      editor.updateContents(
        new ChangeSet().retain(12).insert('es'),
        Lextron.sources.USER,
      );
      editor.history.lastRecorded = 0;
      editor.updateContents(
        new ChangeSet().retain(14).insert('!'),
        Lextron.sources.USER,
      );
      editor.history.undo();
      editor.updateContents(new ChangeSet().retain(4).delete(5), Lextron.sources.API);
      expect(editor.getContents()).toEqual(new ChangeSet().insert('The foxes\n'));
      editor.history.undo();
      expect(editor.getContents()).toEqual(new ChangeSet().insert('The fox\n'));
      editor.history.redo();
      expect(editor.getContents()).toEqual(new ChangeSet().insert('The foxes\n'));
      editor.history.redo();
      expect(editor.getContents()).toEqual(new ChangeSet().insert('The foxes!\n'));
    });

    test('transform preserve intention', () => {
      const { editor } = setup({ userOnly: true });
      const url = 'https://www.google.com/';
      editor.updateContents(
        new ChangeSet().insert(url, { link: url }),
        Lextron.sources.USER,
      );
      editor.history.lastRecorded = 0;
      editor.updateContents(
        new ChangeSet().delete(url.length).insert('Google', { link: url }),
        Lextron.sources.API,
      );
      editor.history.lastRecorded = 0;
      editor.updateContents(
        new ChangeSet().retain(editor.getLength() - 1).insert('!'),
        Lextron.sources.USER,
      );
      editor.history.lastRecorded = 0;
      expect(editor.getContents()).toEqual(
        new ChangeSet().insert('Google', { link: url }).insert('The lazy fox!\n'),
      );
      editor.history.undo();
      expect(editor.getContents()).toEqual(
        new ChangeSet().insert('Google', { link: url }).insert('The lazy fox\n'),
      );
      editor.history.undo();
      expect(editor.getContents()).toEqual(
        new ChangeSet().insert('Google', { link: url }).insert('The lazy fox\n'),
      );
    });

    test('ignore remote changes', () => {
      const { editor } = setup();
      // @ts-expect-error
      editor.history.options.delay = 0;
      // @ts-expect-error
      editor.history.options.userOnly = true;
      editor.setText('\n');
      editor.insertText(0, 'a', Lextron.sources.USER);
      editor.insertText(1, 'b', Lextron.sources.API);
      editor.insertText(2, 'c', Lextron.sources.USER);
      editor.insertText(3, 'd', Lextron.sources.API);
      expect(editor.getText()).toEqual('abcd\n');
      editor.history.undo();
      expect(editor.getText()).toEqual('abd\n');
      editor.history.undo();
      expect(editor.getText()).toEqual('bd\n');
      editor.history.redo();
      expect(editor.getText()).toEqual('abd\n');
      editor.history.redo();
      expect(editor.getText()).toEqual('abcd\n');
    });

    test('correctly transform against remote changes', () => {
      const { editor } = setup({ delay: 0, userOnly: true });
      editor.setText('b\n');
      editor.insertText(1, 'd', Lextron.sources.USER);
      editor.insertText(0, 'a', Lextron.sources.USER);
      editor.insertText(2, 'c', Lextron.sources.API);
      expect(editor.getText()).toEqual('abcd\n');
      editor.history.undo();
      expect(editor.getText()).toEqual('bcd\n');
      editor.history.undo();
      expect(editor.getText()).toEqual('bc\n');
      editor.history.redo();
      expect(editor.getText()).toEqual('bcd\n');
      editor.history.redo();
      expect(editor.getText()).toEqual('abcd\n');
    });

    test('correctly transform against remote changes breaking up an insert', () => {
      const { editor } = setup({ delay: 0, userOnly: true });
      editor.setText('\n');
      editor.insertText(0, 'ABC', Lextron.sources.USER);
      editor.insertText(3, '4', Lextron.sources.API);
      editor.insertText(2, '3', Lextron.sources.API);
      editor.insertText(1, '2', Lextron.sources.API);
      editor.insertText(0, '1', Lextron.sources.API);
      expect(editor.getText()).toEqual('1A2B3C4\n');
      editor.history.undo();
      expect(editor.getText()).toEqual('1234\n');
      editor.history.redo();
      expect(editor.getText()).toEqual('1A2B3C4\n');
      editor.history.undo();
      expect(editor.getText()).toEqual('1234\n');
      editor.history.redo();
      expect(editor.getText()).toEqual('1A2B3C4\n');
    });
  });
});
