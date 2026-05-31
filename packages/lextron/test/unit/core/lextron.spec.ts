import '../../../src/lextron.js';
import ChangeSet from 'lextron-change';
import { LeafBlot, Registry } from 'lextron-dom';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vitest,
  vi,
} from 'vitest';
import type { MockedFunction } from 'vitest';
import Emitter from 'lextron-core/core/emitter.js';
import Theme from 'lextron-core/core/theme.js';
import Toolbar from 'lextron-modules/modules/toolbar.js';
import Lextron, {
  expandConfig,
  globalRegistry,
  overload,
} from 'lextron-core/core/lextron.js';
import { Range } from 'lextron-core/core/selection.js';
import { SnowTheme } from 'lextron-themes';
import { lxtPath } from 'lextron-core';
import { normalizeHTML } from '../__helpers__/utils.js';

const createContainer = (html: string | { html: string } = '') => {
  const container = document.createElement('div');
  container.innerHTML = normalizeHTML(html);
  document.body.appendChild(container);
  return container;
};

describe('Lextron', () => {
  test('imports', () => {
    Object.keys(Lextron.imports).forEach((path) => {
      expect(Lextron.import(path)).toBeTruthy();
    });
  });

  describe('register', () => {
    const imports = { ...Lextron.imports };
    afterEach(() => {
      Lextron.imports = imports;
    });

    test('register(path, target)', () => {
      class Counter {}
      Lextron.register(lxtPath.module('counter'), Counter);

      expect(Lextron.imports).toHaveProperty(lxtPath.module('counter'), Counter);
      expect(Lextron.import(lxtPath.module('counter'))).toEqual(Counter);
    });

    test('register(formats)', () => {
      class MyCounterBlot extends LeafBlot {
        static blotName = 'my-counter';
        static className = 'lxt-my-counter';
      }
      Lextron.register(MyCounterBlot);

      expect(Lextron.imports).toHaveProperty(lxtPath.format('my-counter'), MyCounterBlot);
      expect(Lextron.import(lxtPath.format('my-counter'))).toEqual(MyCounterBlot);
    });

    test('register(targets)', () => {
      class ABlot extends LeafBlot {
        static blotName = 'a-blot';
        static className = 'lxt-a-blot';
      }
      class AModule {}
      Lextron.register({
        [lxtPath.format('a-blot')]: ABlot,
        [lxtPath.module('a-module')]: AModule,
      });

      expect(Lextron.import(lxtPath.format('a-blot'))).toEqual(ABlot);
      expect(Lextron.import(lxtPath.module('a-module'))).toEqual(AModule);
    });

    test('rejects legacy bare import paths', () => {
      expect(() => Lextron.register('modules/legacy', class {})).toThrow(
        /Legacy import path/,
      );
      expect(() => Lextron.import('delta')).toThrow(/Legacy import key/);
      expect(() => Lextron.import('parchment')).toThrow(/Legacy import key/);
    });
  });

  describe('construction', () => {
    test('empty', () => {
      const editor = new Lextron(createContainer());
      expect(editor.getContents()).toEqual(new ChangeSet().insert('\n'));
      expect(editor.root.innerHTML).toMatchInlineSnapshot('"<p><br></p>"');
    });

    test('text', () => {
      const editor = new Lextron(createContainer('0123'));
      expect(editor.getContents()).toEqual(new ChangeSet().insert('0123\n'));
      expect(editor.root.innerHTML).toMatchInlineSnapshot('"<p>0123</p>"');
    });

    test('newlines', () => {
      const editor = new Lextron(
        createContainer('<p><br></p><p><br></p><p><br></p>'),
      );
      expect(editor.getContents()).toEqual(new ChangeSet().insert('\n\n\n'));
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p><br></p><p><br></p><p><br></p>"',
      );
    });

    test('formatted ending', () => {
      const editor = new Lextron(
        createContainer('<p class="lxt-align-center">Test</p>'),
      );
      expect(editor.getContents()).toEqual(
        new ChangeSet().insert('Test').insert('\n', { align: 'center' }),
      );
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p class="lxt-align-center">Test</p>"',
      );
    });
  });

  describe('api', () => {
    const setup = () => {
      const editor = new Lextron(createContainer('<p>0123<em>45</em>67</p>'));
      const oldChangeSet = editor.getContents();
      vitest.spyOn(editor.emitter, 'emit');
      return { editor, oldChangeSet };
    };

    test('deleteText()', () => {
      const { editor, oldChangeSet } = setup();
      editor.deleteText(3, 2);
      const change = new ChangeSet().retain(3).delete(2);
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p>012<em>5</em>67</p>"',
      );
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        change,
        oldChangeSet,
        Emitter.sources.API,
      );
    });

    test('format()', () => {
      const { editor, oldChangeSet } = setup();
      editor.setSelection(3, 2);
      editor.format('bold', true);
      const change = new ChangeSet().retain(3).retain(2, { bold: true });
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p>012<strong>3<em>4</em></strong><em>5</em>67</p>"',
      );
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        change,
        oldChangeSet,
        Emitter.sources.API,
      );
      expect(editor.getSelection()).toEqual(new Range(3, 2));
    });

    test('formatLine()', () => {
      const { editor, oldChangeSet } = setup();
      editor.formatLine(1, 1, 'header', 2);
      const change = new ChangeSet().retain(8).retain(1, { header: 2 });
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<h2>0123<em>45</em>67</h2>"',
      );
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        change,
        oldChangeSet,
        Emitter.sources.API,
      );
    });

    describe('formatText()', () => {
      test('single format', () => {
        const { editor, oldChangeSet } = setup();
        editor.formatText(3, 2, 'bold', true);
        const change = new ChangeSet().retain(3).retain(2, { bold: true });
        expect(editor.root.innerHTML).toMatchInlineSnapshot(
          '"<p>012<strong>3<em>4</em></strong><em>5</em>67</p>"',
        );
        expect(editor.emitter.emit).toHaveBeenCalledWith(
          Emitter.events.TEXT_CHANGE,
          change,
          oldChangeSet,
          Emitter.sources.API,
        );
      });

      test('format object', () => {
        const { editor, oldChangeSet } = setup();
        editor.formatText(3, 2, { bold: true });
        const change = new ChangeSet().retain(3).retain(2, { bold: true });
        expect(editor.root.innerHTML).toMatchInlineSnapshot(
          '"<p>012<strong>3<em>4</em></strong><em>5</em>67</p>"',
        );
        expect(editor.emitter.emit).toHaveBeenCalledWith(
          Emitter.events.TEXT_CHANGE,
          change,
          oldChangeSet,
          Emitter.sources.API,
        );
      });
    });

    test('insertEmbed()', () => {
      const { editor, oldChangeSet } = setup();
      editor.insertEmbed(5, 'image', '/assets/favicon.png');
      const change = new ChangeSet()
        .retain(5)
        .insert({ image: '/assets/favicon.png' }, { italic: true });
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p>0123<em>4<img src="/assets/favicon.png">5</em>67</p>"',
      );
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        change,
        oldChangeSet,
        Emitter.sources.API,
      );
    });

    test('insertText()', () => {
      const { editor, oldChangeSet } = setup();
      editor.insertText(5, '|', 'bold', true);
      const change = new ChangeSet()
        .retain(5)
        .insert('|', { bold: true, italic: true });
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p>0123<em>4</em><strong><em>|</em></strong><em>5</em>67</p>"',
      );
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        change,
        oldChangeSet,
        Emitter.sources.API,
      );
    });

    test('enable/disable', () => {
      const { editor } = setup();
      editor.disable();
      expect(editor.root.getAttribute('contenteditable')).toEqual('false');
      editor.enable();
      expect(editor.root.getAttribute('contenteditable')).toBeTruthy();
    });

    test('getBounds() index', () => {
      const { editor } = setup();
      expect(editor.getBounds(1)).toBeTruthy();
    });

    test('getBounds() range', () => {
      const { editor } = setup();
      expect(editor.getBounds(new Range(3, 4))).toBeTruthy();
    });

    test('getFormat()', () => {
      const { editor } = setup();
      const formats = editor.getFormat(5);
      expect(formats).toEqual({ italic: true });
    });

    test('getSelection()', () => {
      const { editor } = setup();
      expect(editor.getSelection()).toEqual(null);
      const range = new Range(1, 2);
      editor.setSelection(range);
      expect(editor.getSelection()).toEqual(range);
    });

    test('removeFormat()', () => {
      const { editor, oldChangeSet } = setup();
      editor.removeFormat(5, 1);
      const change = new ChangeSet().retain(5).retain(1, { italic: null });
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p>0123<em>4</em>567</p>"',
      );
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        change,
        oldChangeSet,
        Emitter.sources.API,
      );
    });

    test('updateContents() delta', () => {
      const { editor, oldChangeSet } = setup();
      const delta = new ChangeSet().retain(5).insert('|');
      editor.updateContents(delta);
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p>0123<em>4</em>|<em>5</em>67</p>"',
      );
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        delta,
        oldChangeSet,
        Emitter.sources.API,
      );
    });

    test('updateContents() ops array', () => {
      const { editor, oldChangeSet } = setup();
      const delta = new ChangeSet().retain(5).insert('|');
      editor.updateContents(delta.ops);
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p>0123<em>4</em>|<em>5</em>67</p>"',
      );
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        delta,
        oldChangeSet,
        Emitter.sources.API,
      );
    });
  });

  describe('events', () => {
    const setup = () => {
      const editor = new Lextron(createContainer('<p>0123</p>'));
      editor.update();
      vitest.spyOn(editor.emitter, 'emit');
      const oldChangeSet = editor.getContents();
      return { editor, oldChangeSet };
    };

    test('api text insert', () => {
      const { editor, oldChangeSet } = setup();
      editor.insertText(2, '!');
      const delta = new ChangeSet().retain(2).insert('!');
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        delta,
        oldChangeSet,
        Emitter.sources.API,
      );
    });

    test('user text insert', async () => {
      const { editor, oldChangeSet } = setup();
      (editor.root.firstChild?.firstChild as Text).data = '01!23';
      const delta = new ChangeSet().retain(2).insert('!');

      await new Promise((r) => setTimeout(r, 1));
      expect(editor.emitter.emit).toHaveBeenCalledWith(
        Emitter.events.TEXT_CHANGE,
        delta,
        oldChangeSet,
        Emitter.sources.USER,
      );
    });

    const editTest = (
      oldText: string,
      oldSelection: number | Range,
      newText: string,
      newSelection: number | Range,
      expectedDelta: ChangeSet,
    ) => {
      return async () => {
        const { editor } = setup();
        editor.setText(`${oldText}\n`);
        // @ts-expect-error
        editor.setSelection(oldSelection);
        editor.update();
        const oldContents = editor.getContents();
        const textNode = editor.root.firstChild?.firstChild as Text;
        textNode.data = newText;
        if (typeof newSelection === 'number') {
          editor.selection.setNativeRange(textNode, newSelection);
        } else {
          editor.selection.setNativeRange(
            textNode,
            newSelection.index,
            textNode,
            newSelection.index + newSelection.length,
          );
        }
        await new Promise((r) => setTimeout(r, 1));
        const calls = (
          editor.emitter.emit as MockedFunction<typeof editor.emitter.emit>
        ).mock.calls;
        if (calls[calls.length - 1][1] === Emitter.events.SELECTION_CHANGE) {
          calls.pop();
        }
        const args = calls.pop();
        expect(args).toEqual([
          Emitter.events.TEXT_CHANGE,
          expectedDelta,
          oldContents,
          Emitter.sources.USER,
        ]);
      };
    };

    describe('insert a in aaaa', () => {
      test(
        'at index 0',
        editTest('aaaa', 0, 'aaaaa', 1, new ChangeSet().insert('a')),
      );
      test(
        'at index 1',
        editTest('aaaa', 1, 'aaaaa', 2, new ChangeSet().retain(1).insert('a')),
      );
      test(
        'at index 2',
        editTest('aaaa', 2, 'aaaaa', 3, new ChangeSet().retain(2).insert('a')),
      );
      test(
        'at index 3',
        editTest('aaaa', 3, 'aaaaa', 4, new ChangeSet().retain(3).insert('a')),
      );
    });

    describe('insert a in xaa', () => {
      test(
        'at index 1',
        editTest('xaa', 1, 'xaaa', 2, new ChangeSet().retain(1).insert('a')),
      );
      test(
        'at index 2',
        editTest('xaa', 2, 'xaaa', 3, new ChangeSet().retain(2).insert('a')),
      );
      test(
        'at index 3',
        editTest('xaa', 3, 'xaaa', 4, new ChangeSet().retain(3).insert('a')),
      );
    });

    describe('insert aa in ax', () => {
      test(
        'at index 0',
        editTest('ax', 0, 'aaax', 2, new ChangeSet().insert('aa')),
      );
      test(
        'at index 1',
        editTest('ax', 1, 'aaax', 3, new ChangeSet().retain(1).insert('aa')),
      );
    });

    describe('delete a in xaa', () => {
      test(
        'at index 1',
        editTest('xaa', 2, 'xa', 1, new ChangeSet().retain(1).delete(1)),
      );
      test(
        'at index 2',
        editTest('xaa', 3, 'xa', 2, new ChangeSet().retain(2).delete(1)),
      );
    });

    describe('forward-delete a in xaa', () => {
      test(
        'at index 1',
        editTest('xaa', 1, 'xa', 1, new ChangeSet().retain(1).delete(1)),
      );
      test(
        'at index 2',
        editTest('xaa', 2, 'xa', 2, new ChangeSet().retain(2).delete(1)),
      );
    });

    test(
      'replace yay with y',
      editTest(
        'yay',
        new Range(0, 3),
        'y',
        1,
        new ChangeSet().insert('y').delete(3),
      ),
    );
  });

  describe('setContents()', () => {
    test('empty', () => {
      const editor = new Lextron(createContainer(''));
      const delta = new ChangeSet().insert('\n');
      editor.setContents(delta);
      expect(editor.getContents()).toEqual(delta);
      expect(editor.root.innerHTML).toMatchInlineSnapshot('"<p><br></p>"');
    });

    test('single line', () => {
      const editor = new Lextron(createContainer(''));
      const delta = new ChangeSet().insert('Hello World!\n');
      editor.setContents(delta);
      expect(editor.getContents()).toEqual(delta);
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p>Hello World!</p>"',
      );
    });

    test('multiple lines', () => {
      const editor = new Lextron(createContainer(''));
      const delta = new ChangeSet().insert('Hello\n\nWorld!\n');
      editor.setContents(delta);
      expect(editor.getContents()).toEqual(delta);
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p>Hello</p><p><br></p><p>World!</p>"',
      );
    });

    test('basic formats', () => {
      const editor = new Lextron(createContainer(''));
      const delta = new ChangeSet()
        .insert('Welcome')
        .insert('\n', { header: 1 })
        .insert('Hello\n')
        .insert('World')
        .insert('!', { bold: true })
        .insert('\n');
      editor.setContents(delta);
      expect(editor.getContents()).toEqual(delta);
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<h1>Welcome</h1><p>Hello</p><p>World<strong>!</strong></p>"',
      );
    });

    test('array of operations', () => {
      const editor = new Lextron(createContainer(''));
      const delta = new ChangeSet()
        .insert('test')
        .insert('123', { bold: true })
        .insert('\n');
      editor.setContents(delta.ops);
      expect(editor.getContents()).toEqual(delta);
    });

    test('json', () => {
      const editor = new Lextron(createContainer(''));
      const delta = new ChangeSet().insert('test\n');
      editor.setContents(delta);
      expect(editor.getContents()).toEqual(new ChangeSet(delta));
    });

    test('no trailing newline', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      editor.setContents(new ChangeSet().insert('0123'));
      expect(editor.getContents()).toEqual(new ChangeSet().insert('0123\n'));
    });

    test('inline formatting', () => {
      const editor = new Lextron(
        createContainer('<p><strong>Bold</strong></p><p>Not bold</p>'),
      );
      const contents = editor.getContents();
      const delta = editor.setContents(contents);
      expect(editor.getContents()).toEqual(contents);
      expect(delta).toEqual(contents.delete(contents.length()));
    });

    test('block embed', () => {
      const editor = new Lextron(createContainer('<p>Hello World!</p>'));
      const contents = new ChangeSet().insert({ video: '#' });
      editor.setContents(contents);
      expect(editor.getContents()).toEqual(contents);
    });
  });

  describe('getText()', () => {
    test('return all text by default', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      expect(editor.getText()).toMatchInlineSnapshot(`
        "Welcome
        "
      `);
    });

    test('works when only provide index', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      expect(editor.getText(2)).toMatchInlineSnapshot(`
        "lcome
        "
      `);
    });

    test('works when provide index and length', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      expect(editor.getText(2, 3)).toMatchInlineSnapshot(`
        "lco"
      `);
    });

    test('works with range', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      expect(editor.getText({ index: 1, length: 2 })).toMatchInlineSnapshot(
        '"el"',
      );
    });
  });

  describe('getSemanticHTML()', () => {
    test('return all html by default', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      expect(editor.getSemanticHTML()).toMatchInlineSnapshot(`
        "<h1>Welcome</h1>"
      `);
    });

    test('works when only provide index', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      expect(editor.getSemanticHTML(2)).toMatchInlineSnapshot(`
        "lcome"
      `);
    });

    test('works when provide index and length', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      expect(editor.getSemanticHTML(2, 3)).toMatchInlineSnapshot(`
        "lco"
      `);
    });

    test('works with range', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      expect(editor.getText({ index: 1, length: 2 })).toMatchInlineSnapshot(
        '"el"',
      );
    });
  });

  describe('setText()', () => {
    test('overwrite', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      editor.setText('abc');
      expect(editor.root.innerHTML).toMatchInlineSnapshot('"<p>abc</p>"');
    });

    test('set to newline', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      editor.setText('\n');
      expect(editor.root.innerHTML).toMatchInlineSnapshot('"<p><br></p>"');
    });

    test('multiple newlines', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      editor.setText('\n\n');
      expect(editor.root.innerHTML).toMatchInlineSnapshot(
        '"<p><br></p><p><br></p>"',
      );
    });

    test('content with trailing newline', () => {
      const editor = new Lextron(createContainer('<h1>Welcome</h1>'));
      editor.setText('abc\n');
      expect(editor.root.innerHTML).toMatchInlineSnapshot('"<p>abc</p>"');
    });

    test('return carriage', () => {
      const editor = new Lextron(createContainer('<p>Test</p>'));
      editor.setText('\r');
      expect(editor.root.innerHTML).toMatchInlineSnapshot('"<p><br></p>"');
    });

    test('return carriage newline', () => {
      const editor = new Lextron(createContainer('<p>Test</p>'));
      editor.setText('\r\n');
      expect(editor.root.innerHTML).toMatchInlineSnapshot('"<p><br></p>"');
    });
  });

  describe('expandConfig', () => {
    const testContainerId = 'testContainer';
    beforeEach(() => {
      const testContainer = document.createElement('div');
      testContainer.id = testContainerId;
      document.body.appendChild(testContainer);
    });

    test('user overwrite lextron', () => {
      const config = expandConfig(`#${testContainerId}`, {
        placeholder: 'Test',
        readOnly: true,
      });
      expect(config.placeholder).toEqual('Test');
      expect(config.readOnly).toEqual(true);
    });

    test('convert css selectors', () => {
      const config = expandConfig(`#${testContainerId}`, {
        bounds: `#${testContainerId}`,
      });
      expect(config.bounds).toEqual(
        document.querySelector(`#${testContainerId}`),
      );
      expect(config.container).toEqual(
        document.querySelector(`#${testContainerId}`),
      );
    });

    test('convert module true to {}', () => {
      const config = expandConfig(`#${testContainerId}`, {
        modules: {
          syntax: true,
        },
      });
      expect(config.modules.syntax).toMatchObject({
        interval: 1000,
      });
    });

    describe('theme defaults', () => {
      test('for Snow', () => {
        const config = expandConfig(`#${testContainerId}`, {
          modules: {
            toolbar: true,
          },
          theme: 'snow',
        });
        expect(config.theme).toEqual(SnowTheme);
        // @ts-expect-error
        expect(config.modules.toolbar.handlers.image).toEqual(
          SnowTheme.DEFAULTS.modules.toolbar?.handlers?.image,
        );
      });

      test('for false', () => {
        const config = expandConfig(`#${testContainerId}`, {
          // @ts-expect-error
          theme: false,
        });
        expect(config.theme).toEqual(Theme);
      });

      test('for undefined', () => {
        const config = expandConfig(`#${testContainerId}`, {
          theme: undefined,
        });
        expect(config.theme).toEqual(Theme);
      });

      test('for null', () => {
        const config = expandConfig(`#${testContainerId}`, {
          // @ts-expect-error
          theme: null,
        });
        expect(config.theme).toEqual(Theme);
      });
    });

    test('lextron < module < theme < user', () => {
      const oldTheme = Theme.DEFAULTS.modules;
      const oldToolbar = Toolbar.DEFAULTS;
      Toolbar.DEFAULTS = {
        option: 2,
        module: true,
      };
      Theme.DEFAULTS.modules = {
        toolbar: {
          option: 1,
          theme: true,
        },
      };
      const config = expandConfig(`#${testContainerId}`, {
        modules: {
          toolbar: {
            option: 0,
            user: true,
          },
        },
      });
      expect(config.modules.toolbar).toEqual({
        option: 0,
        module: true,
        theme: true,
        user: true,
      });
      Theme.DEFAULTS.modules = oldTheme;
      Toolbar.DEFAULTS = oldToolbar;
    });

    test('toolbar default', () => {
      const config = expandConfig(`#${testContainerId}`, {
        modules: {
          toolbar: true,
        },
      });
      expect(config.modules.toolbar).toEqual(Toolbar.DEFAULTS);
    });

    test('toolbar disabled', () => {
      const config = expandConfig(`#${testContainerId}`, {
        modules: {
          toolbar: false,
        },
        theme: 'snow',
      });
      expect(config.modules.toolbar).toBe(undefined);
    });

    test('toolbar selector', () => {
      const config = expandConfig(`#${testContainerId}`, {
        modules: {
          toolbar: {
            container: `#${testContainerId}`,
          },
        },
      });
      expect(config.modules.toolbar).toEqual({
        container: `#${testContainerId}`,
        handlers: Toolbar.DEFAULTS.handlers,
      });
    });

    test('toolbar container shorthand', () => {
      const config = expandConfig(`#${testContainerId}`, {
        modules: {
          toolbar: document.querySelector(`#${testContainerId}`),
        },
      });
      expect(config.modules.toolbar).toEqual({
        container: document.querySelector(`#${testContainerId}`),
        handlers: Toolbar.DEFAULTS.handlers,
      });
    });

    test('toolbar container shorthand with theme options', () => {
      const config = expandConfig(`#${testContainerId}`, {
        modules: {
          toolbar: document.querySelector(`#${testContainerId}`),
        },
        theme: 'snow',
      });
      for (const [format, handler] of Object.entries(
        SnowTheme.DEFAULTS.modules.toolbar!.handlers ?? {},
      )) {
        // @ts-expect-error
        expect(config.modules.toolbar.handlers[format]).toBe(handler);
      }
    });

    test('toolbar format array', () => {
      const config = expandConfig(`#${testContainerId}`, {
        modules: {
          toolbar: ['bold'],
        },
      });
      expect(config.modules.toolbar).toEqual({
        container: ['bold'],
        handlers: Toolbar.DEFAULTS.handlers,
      });
    });

    test('toolbar custom handler, default container', () => {
      const handler = () => {}; // eslint-disable-line func-style
      const config = expandConfig(`#${testContainerId}`, {
        modules: {
          toolbar: {
            handlers: {
              bold: handler,
            },
          },
        },
      });
      // @ts-expect-error
      expect(config.modules.toolbar.container).toEqual(null);
      // @ts-expect-error
      expect(config.modules.toolbar.handlers.bold).toEqual(handler);
      // @ts-expect-error
      expect(config.modules.toolbar.handlers.clean).toEqual(
        // @ts-expect-error
        Toolbar.DEFAULTS.handlers.clean,
      );
    });

    test('registry defaults to globalRegistry', () => {
      const config = expandConfig(`#${testContainerId}`, {});
      expect(config.registry).toBe(globalRegistry);
    });

    test('registry with undefined values', () => {
      const config = expandConfig(`#${testContainerId}`, {
        registry: undefined,
      });
      expect(config.registry).toBe(globalRegistry);
    });

    describe('formats', () => {
      test('null value allows all formats', () => {
        const config = expandConfig(`#${testContainerId}`, {
          formats: null,
        });

        expect(config.registry.query('cursor')).toBeTruthy();
        expect(config.registry.query('bold')).toBeTruthy();
      });

      test('undefined value allows all formats', () => {
        const config = expandConfig(`#${testContainerId}`, {
          formats: undefined,
        });

        expect(config.registry.query('cursor')).toBeTruthy();
        expect(config.registry.query('bold')).toBeTruthy();
      });

      test('always allows core formats', () => {
        const config = expandConfig(`#${testContainerId}`, {
          formats: ['bold'],
        });

        expect(config.registry.query('cursor')).toBeTruthy();
        expect(config.registry.query('break')).toBeTruthy();
      });

      test('limits allowed formats', () => {
        const config = expandConfig(`#${testContainerId}`, {
          formats: ['bold'],
        });

        expect(config.registry.query('italic')).toBeFalsy();
        expect(config.registry.query('bold')).toBeTruthy();
      });

      test('ignores unknown formats', () => {
        const name = 'my-unregistered-format';
        const config = expandConfig(`#${testContainerId}`, {
          formats: [name],
        });

        expect(config.registry.query(name)).toBeFalsy();
      });

      test('registers list container when there is a list', () => {
        expect(
          expandConfig(`#${testContainerId}`, {
            formats: ['bold'],
          }).registry.query('list-container'),
        ).toBeFalsy();

        expect(
          expandConfig(`#${testContainerId}`, {
            formats: ['list'],
          }).registry.query('list-container'),
        ).toBeTruthy();
      });

      test('provides both registry and formats', () => {
        const registry = new Registry();
        const config = expandConfig(`#${testContainerId}`, {
          registry,
          formats: ['bold'],
        });

        expect(config.registry).toBe(registry);
        expect(config.registry.query('bold')).toBeFalsy();
      });
    });
  });

  describe('overload', () => {
    test('(index:number, length:number)', () => {
      const [index, length, formats, source] = overload(0, 1);
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({});
      expect(source).toBe(Lextron.sources.API);
    });

    test('(index:number, length:number, format:string, value:boolean, source:string)', () => {
      const [index, length, formats, source] = overload(
        0,
        1,
        'bold',
        true,
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ bold: true });
      expect(source).toBe(Lextron.sources.USER);
    });

    test('(index:number, length:number, format:string, value:string, source:string)', () => {
      const [index, length, formats, source] = overload(
        0,
        1,
        'color',
        Lextron.sources.USER,
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ color: Lextron.sources.USER });
      expect(source).toBe(Lextron.sources.USER);
    });

    test('(index:number, length:number, format:string, value:string)', () => {
      const [index, length, formats, source] = overload(
        0,
        1,
        'color',
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ color: Lextron.sources.USER });
      expect(source).toBe(Lextron.sources.API);
    });

    test('(index:number, length:number, format:object)', () => {
      const [index, length, formats, source] = overload(0, 1, { bold: true });
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ bold: true });
      expect(source).toBe(Lextron.sources.API);
    });

    test('(index:number, length:number, format:object, source:string)', () => {
      const [index, length, formats, source] = overload(
        0,
        1,
        { bold: true },
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ bold: true });
      expect(source).toBe(Lextron.sources.USER);
    });

    test('(index:number, length:number, source:string)', () => {
      const [index, length, formats, source] = overload(
        0,
        1,
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({});
      expect(source).toBe(Lextron.sources.USER);
    });

    test('(index:number, source:string)', () => {
      const [index, length, formats, source] = overload(0, Lextron.sources.USER);
      expect(index).toBe(0);
      expect(length).toBe(0);
      expect(formats).toEqual({});
      expect(source).toBe(Lextron.sources.USER);
    });

    test('(range:range)', () => {
      const [index, length, formats, source] = overload(new Range(0, 1));
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({});
      expect(source).toBe(Lextron.sources.API);
    });

    test('(range:range, format:string, value:boolean, source:string)', () => {
      const [index, length, formats, source] = overload(
        new Range(0, 1),
        'bold',
        true,
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ bold: true });
      expect(source).toBe(Lextron.sources.USER);
    });

    test('(range:range, format:string, value:string, source:string)', () => {
      const [index, length, formats, source] = overload(
        new Range(0, 1),
        'color',
        Lextron.sources.API,
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ color: Lextron.sources.API });
      expect(source).toBe(Lextron.sources.USER);
    });

    test('(range:range, format:string, value:string)', () => {
      const [index, length, formats, source] = overload(
        new Range(0, 1),
        'color',
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ color: Lextron.sources.USER });
      expect(source).toBe(Lextron.sources.API);
    });

    test('(range:range, format:object)', () => {
      const [index, length, formats, source] = overload(new Range(0, 1), {
        bold: true,
      });
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ bold: true });
      expect(source).toBe(Lextron.sources.API);
    });

    test('(range:range, format:object, source:string)', () => {
      const [index, length, formats, source] = overload(
        new Range(0, 1),
        { bold: true },
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({ bold: true });
      expect(source).toBe(Lextron.sources.USER);
    });

    test('(range:range, source:string)', () => {
      const [index, length, formats, source] = overload(
        new Range(0, 1),
        Lextron.sources.USER,
      );
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({});
      expect(source).toBe(Lextron.sources.USER);
    });

    test('(range:range)', () => {
      const [index, length, formats, source] = overload(new Range(0, 1));
      expect(index).toBe(0);
      expect(length).toBe(1);
      expect(formats).toEqual({});
      expect(source).toBe(Lextron.sources.API);
    });

    test('(range:range, dummy:number)', () => {
      // @ts-expect-error
      const [index, length, formats, source] = overload(new Range(10, 1), 0);
      expect(index).toBe(10);
      expect(length).toBe(1);
      expect(formats).toEqual({});
      expect(source).toBe(Lextron.sources.API);
    });

    test('(range:range, dummy:number, format:string, value:boolean)', () => {
      // @ts-expect-error
      const [index, length, formats, source] = overload(
        new Range(10, 1),
        0,
        'bold',
        true,
      );
      expect(index).toBe(10);
      expect(length).toBe(1);
      expect(formats).toEqual({ bold: true });
      expect(source).toBe(Lextron.sources.API);
    });

    test('(range:range, dummy:number, format:object, source:string)', () => {
      // @ts-expect-error
      const [index, length, formats, source] = overload(
        new Range(10, 1),
        0,
        { bold: true },
        Lextron.sources.USER,
      );
      expect(index).toBe(10);
      expect(length).toBe(1);
      expect(formats).toEqual({ bold: true });
      expect(source).toBe(Lextron.sources.USER);
    });
  });

  describe('placeholder', () => {
    const setup = () => {
      const container = createContainer('<p></p>');
      const editor = new Lextron(container, {
        placeholder: 'a great day to be a placeholder',
      });
      return { editor };
    };

    test('blank editor', () => {
      const { editor } = setup();
      expect(editor.root.dataset.placeholder).toEqual(
        'a great day to be a placeholder',
      );
      expect([...editor.root.classList]).toContain('lxt-blank');
    });

    test('with text', () => {
      const { editor } = setup();
      editor.setText('test');
      expect([...editor.root.classList]).not.toContain('lxt-blank');
    });

    test('formatted line', () => {
      const { editor } = setup();
      editor.formatLine(0, 1, 'list', 'ordered');
      expect([...editor.root.classList]).not.toContain('lxt-blank');
    });
  });

  describe('scrollSelectionIntoView', () => {
    const createContents = (separator: string) =>
      new Array(200)
        .fill(0)
        .map((_, i) => `text ${i + 1}`)
        .join(separator);

    const viewportRatio = (element: Element): Promise<number> => {
      return new Promise((resolve) => {
        const observer = new IntersectionObserver((entries) => {
          resolve(entries[0].intersectionRatio);
          observer.disconnect();
        });
        observer.observe(element);
        // Firefox doesn't call IntersectionObserver callback unless
        // there are rafs.
        requestAnimationFrame(() => {});
      });
    };

    test('scroll upward', async () => {
      document.body.style.height = '500px';
      const container = document.body.appendChild(
        document.createElement('div'),
      );

      Object.assign(container.style, {
        height: '100px',
        overflow: 'scroll',
      });

      const editorContainer = container.appendChild(
        document.createElement('div'),
      );
      Object.assign(editorContainer.style, {
        height: '100px',
        overflow: 'scroll',
        border: '10px solid red',
      });

      const space = container.appendChild(document.createElement('div'));
      space.style.height = '800px';

      const editor = new Lextron(editorContainer);

      const text = createContents('\n');
      editor.setContents(new ChangeSet().insert(text));
      editor.setSelection({ index: text.indexOf('text 10'), length: 4 }, 'user');

      container.scrollTop = -500;

      expect(
        await viewportRatio(
          editorContainer.querySelector('p:nth-child(10)') as HTMLElement,
        ),
      ).toBeGreaterThan(0.9);
      expect(
        await viewportRatio(
          editorContainer.querySelector('p:nth-child(11)') as HTMLElement,
        ),
      ).toEqual(0);
    });

    test('scroll downward', async () => {
      document.body.style.height = '500px';
      const container = document.body.appendChild(
        document.createElement('div'),
      );

      Object.assign(container.style, {
        height: '100px',
        overflow: 'scroll',
      });

      const space = container.appendChild(document.createElement('div'));
      space.style.height = '80px';

      const editorContainer = container.appendChild(
        document.createElement('div'),
      );
      Object.assign(editorContainer.style, {
        height: '100px',
        overflow: 'scroll',
        border: '10px solid red',
      });

      const editor = new Lextron(editorContainer);

      const text = createContents('\n');
      editor.setContents(new ChangeSet().insert(text));
      editor.setSelection(
        { index: text.indexOf('text 100'), length: 4 },
        'user',
      );

      expect(
        await viewportRatio(
          editorContainer.querySelector('p:nth-child(100)') as HTMLElement,
        ),
      ).toBeGreaterThan(0.9);
      expect(
        await viewportRatio(
          editorContainer.querySelector('p:nth-child(101)') as HTMLElement,
        ),
      ).toEqual(0);
    });

    test('scroll-padding', async () => {
      const container = document.body.appendChild(
        document.createElement('div'),
      );
      const editor = new Lextron(container);
      Object.assign(editor.root.style, {
        scrollPaddingBottom: '50px',
        height: '200px',
        overflow: 'auto',
      });
      const text = createContents('\n');
      editor.setContents(new ChangeSet().insert(text));
      editor.setSelection({ index: text.indexOf('text 10'), length: 4 }, 'user');
      expect(
        await viewportRatio(
          container.querySelector('p:nth-child(10)') as HTMLElement,
        ),
      ).toBeGreaterThan(0.9);
      expect(
        await viewportRatio(
          container.querySelector('p:nth-child(11)') as HTMLElement,
        ),
      ).toBeGreaterThan(0.9);
      editor.root.style.scrollPaddingBottom = '0';
      editor.setSelection(1, 'user');
      editor.setSelection({ index: text.indexOf('text 10'), length: 4 }, 'user');
      expect(
        await viewportRatio(
          container.querySelector('p:nth-child(11)') as HTMLElement,
        ),
      ).toBe(0);
    });

    test('inline scroll', async () => {
      const container = document.body.appendChild(
        document.createElement('div'),
      );

      Object.assign(container.style, {
        width: '200px',
        display: 'flex',
        overflow: 'scroll',
      });

      const space = container.appendChild(document.createElement('div'));
      space.style.width = '80px';

      const editorContainer = container.appendChild(
        document.createElement('div'),
      );
      Object.assign(editorContainer.style, {
        width: '100px',
        overflow: 'scroll',
        border: '10px solid red',
      });

      const editor = new Lextron(editorContainer);

      Object.assign(editor.root.style, {
        overflow: 'scroll',
        whiteSpace: 'nowrap',
      });

      const text = createContents(' ');
      const text100Index = text.indexOf('text 100');
      const delta = new ChangeSet()
        .insert(text)
        .compose(new ChangeSet().retain(text100Index).retain(8, { bold: true }));
      editor.setContents(delta);
      editor.setSelection({ index: text100Index, length: 8 }, 'user');

      expect(
        await viewportRatio(
          editorContainer.querySelector('strong') as HTMLElement,
        ),
      ).toBeGreaterThan(0.9);

      editor.setSelection(0, 'user');
      expect(
        await viewportRatio(
          editorContainer.querySelector('strong') as HTMLElement,
        ),
      ).toEqual(0);
    });

    test('scroll smoothly', async () => {
      document.body.style.height = '500px';
      const container = document.body.appendChild(
        document.createElement('div'),
      );

      Object.assign(container.style, {
        height: '100px',
        overflow: 'scroll',
      });

      const space = container.appendChild(document.createElement('div'));
      space.style.height = '80px';

      const editorContainer = container.appendChild(
        document.createElement('div'),
      );
      Object.assign(editorContainer.style, {
        height: '100px',
        overflow: 'scroll',
        border: '10px solid red',
      });

      const editor = new Lextron(editorContainer);

      const text = createContents('\n');
      editor.setContents(new ChangeSet().insert(text));
      editor.setSelection(
        { index: text.indexOf('text 100'), length: 4 },
        'silent',
      );
      editor.scrollSelectionIntoView({ smooth: true });

      await vi.waitFor(async () => {
        expect(
          await viewportRatio(
            editorContainer.querySelector('p:nth-child(100)') as HTMLElement,
          ),
        ).toBeGreaterThan(0.9);
        expect(
          await viewportRatio(
            editorContainer.querySelector('p:nth-child(101)') as HTMLElement,
          ),
        ).toEqual(0);
      });
    });
  });
});
