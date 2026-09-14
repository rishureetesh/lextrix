import ChangeSet from 'lextrix-change';
import { describe, expect, test, vitest } from 'vitest';
import Lextrix from '../../../src/core.js';
import { getLastChangeIndex } from 'lextrix-modules/modules/history.js';
import type History from 'lextrix-modules/modules/history.js';
import type { HistoryOptions } from 'lextrix-modules/modules/history.js';
import { createRegistry, createScroll } from '../__helpers__/factory.js';
import { sleep } from '../__helpers__/utils.js';
import Bold from 'lextrix-formats/formats/bold.js';
import Image from 'lextrix-formats/formats/image.js';
import Link from 'lextrix-formats/formats/link.js';
import { AlignClass } from 'lextrix-formats/formats/align.js';

function historyOf(editor: Lextrix): History {
  return editor.history as History;
}

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
      const editor = new Lextrix(container, {
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
      expect(historyOf(editor).stack.undo.length).toEqual(2);
    });

    test('emits selection changes', () => {
      const { editor } = setup({ delay: 0 });
      editor.insertText(0, 'foo');
      const change = vitest.fn();
      editor.on('selection-change', change);
      historyOf(editor).undo();

      expect(change).toHaveBeenCalledOnce();
      expect(change).toHaveBeenCalledWith(expect.anything(), null, 'user');
    });

    test('user change', () => {
      const { editor, original } = setup({ delay: 0 });
      (editor.root.firstChild as HTMLElement).innerHTML = 'The lazy foxes';
      editor.update();
      const changed = editor.getContents();
      expect(changed).not.toEqual(original);
      historyOf(editor).undo();
      expect(editor.getContents()).toEqual(original);
      historyOf(editor).redo();
      expect(editor.getContents()).toEqual(changed);
    });

    test('merge changes', () => {
      const { editor, original } = setup();
      expect(historyOf(editor).stack.undo.length).toEqual(0);
      editor.updateContents(new ChangeSet().retain(12).insert('e'));
      expect(historyOf(editor).stack.undo.length).toEqual(1);
      editor.updateContents(new ChangeSet().retain(13).insert('s'));
      expect(historyOf(editor).stack.undo.length).toEqual(1);
      historyOf(editor).undo();
      expect(editor.getContents()).toEqual(original);
      expect(historyOf(editor).stack.undo.length).toEqual(0);
    });

    test('dont merge changes', async () => {
      const { editor } = setup();
      expect(historyOf(editor).stack.undo.length).toEqual(0);
      editor.updateContents(new ChangeSet().retain(12).insert('e'));
      expect(historyOf(editor).stack.undo.length).toEqual(1);
      await sleep((historyOf(editor).options.delay as number) * 1.25);
      editor.updateContents(new ChangeSet().retain(13).insert('s'));
      expect(historyOf(editor).stack.undo.length).toEqual(2);
    });

    test('multiple undos', async () => {
      const { editor, original } = setup();
      expect(historyOf(editor).stack.undo.length).toEqual(0);
      editor.updateContents(new ChangeSet().retain(12).insert('e'));
      const contents = editor.getContents();
      await sleep((historyOf(editor).options.delay as number) * 1.25);
      editor.updateContents(new ChangeSet().retain(13).insert('s'));
      historyOf(editor).undo();
      expect(editor.getContents()).toEqual(contents);
      historyOf(editor).undo();
      expect(editor.getContents()).toEqual(original);
    });

    test('transform api change', () => {
      const { editor } = setup();
      historyOf(editor).options.userOnly = true;
      editor.updateContents(
        new ChangeSet().retain(12).insert('es'),
        Lextrix.sources.USER,
      );
      historyOf(editor).lastRecorded = 0;
      editor.updateContents(
        new ChangeSet().retain(14).insert('!'),
        Lextrix.sources.USER,
      );
      historyOf(editor).undo();
      editor.updateContents(new ChangeSet().retain(4).delete(5), Lextrix.sources.API);
      expect(editor.getContents()).toEqual(new ChangeSet().insert('The foxes\n'));
      historyOf(editor).undo();
      expect(editor.getContents()).toEqual(new ChangeSet().insert('The fox\n'));
      historyOf(editor).redo();
      expect(editor.getContents()).toEqual(new ChangeSet().insert('The foxes\n'));
      historyOf(editor).redo();
      expect(editor.getContents()).toEqual(new ChangeSet().insert('The foxes!\n'));
    });

    test('transform preserve intention', () => {
      const { editor } = setup({ userOnly: true });
      const url = 'https://www.google.com/';
      editor.updateContents(
        new ChangeSet().insert(url, { link: url }),
        Lextrix.sources.USER,
      );
      historyOf(editor).lastRecorded = 0;
      editor.updateContents(
        new ChangeSet().delete(url.length).insert('Google', { link: url }),
        Lextrix.sources.API,
      );
      historyOf(editor).lastRecorded = 0;
      editor.updateContents(
        new ChangeSet().retain(editor.getLength() - 1).insert('!'),
        Lextrix.sources.USER,
      );
      historyOf(editor).lastRecorded = 0;
      expect(editor.getContents()).toEqual(
        new ChangeSet().insert('Google', { link: url }).insert('The lazy fox!\n'),
      );
      historyOf(editor).undo();
      expect(editor.getContents()).toEqual(
        new ChangeSet().insert('Google', { link: url }).insert('The lazy fox\n'),
      );
      historyOf(editor).undo();
      expect(editor.getContents()).toEqual(
        new ChangeSet().insert('Google', { link: url }).insert('The lazy fox\n'),
      );
    });

    test('ignore remote changes', () => {
      const { editor } = setup();
      historyOf(editor).options.delay = 0;
      historyOf(editor).options.userOnly = true;
      editor.setText('\n');
      editor.insertText(0, 'a', Lextrix.sources.USER);
      editor.insertText(1, 'b', Lextrix.sources.API);
      editor.insertText(2, 'c', Lextrix.sources.USER);
      editor.insertText(3, 'd', Lextrix.sources.API);
      expect(editor.getText()).toEqual('abcd\n');
      historyOf(editor).undo();
      expect(editor.getText()).toEqual('abd\n');
      historyOf(editor).undo();
      expect(editor.getText()).toEqual('bd\n');
      historyOf(editor).redo();
      expect(editor.getText()).toEqual('abd\n');
      historyOf(editor).redo();
      expect(editor.getText()).toEqual('abcd\n');
    });

    test('correctly transform against remote changes', () => {
      const { editor } = setup({ delay: 0, userOnly: true });
      editor.setText('b\n');
      editor.insertText(1, 'd', Lextrix.sources.USER);
      editor.insertText(0, 'a', Lextrix.sources.USER);
      editor.insertText(2, 'c', Lextrix.sources.API);
      expect(editor.getText()).toEqual('abcd\n');
      historyOf(editor).undo();
      expect(editor.getText()).toEqual('bcd\n');
      historyOf(editor).undo();
      expect(editor.getText()).toEqual('bc\n');
      historyOf(editor).redo();
      expect(editor.getText()).toEqual('bcd\n');
      historyOf(editor).redo();
      expect(editor.getText()).toEqual('abcd\n');
    });

    test('correctly transform against remote changes breaking up an insert', () => {
      const { editor } = setup({ delay: 0, userOnly: true });
      editor.setText('\n');
      editor.insertText(0, 'ABC', Lextrix.sources.USER);
      editor.insertText(3, '4', Lextrix.sources.API);
      editor.insertText(2, '3', Lextrix.sources.API);
      editor.insertText(1, '2', Lextrix.sources.API);
      editor.insertText(0, '1', Lextrix.sources.API);
      expect(editor.getText()).toEqual('1A2B3C4\n');
      historyOf(editor).undo();
      expect(editor.getText()).toEqual('1234\n');
      historyOf(editor).redo();
      expect(editor.getText()).toEqual('1A2B3C4\n');
      historyOf(editor).undo();
      expect(editor.getText()).toEqual('1234\n');
      historyOf(editor).redo();
      expect(editor.getText()).toEqual('1A2B3C4\n');
    });
  });
});
