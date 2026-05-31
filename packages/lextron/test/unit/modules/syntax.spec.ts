import hljs from 'highlight.js';
import ChangeSet from 'lextron-change';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import Lextron from '../../../src/core.js';
import { lxtPath } from 'lextron-core';
import Bold from 'lextron-formats/formats/bold.js';
import Syntax, { CodeBlock, CodeToken } from 'lextron-modules/modules/syntax.js';
import { createRegistry } from '../__helpers__/factory.js';
import { normalizeHTML, sleep } from '../__helpers__/utils.js';

const HIGHLIGHT_INTERVAL = 10;

describe('Syntax', () => {
  beforeAll(() => {
    Lextron.register({ [lxtPath.module('syntax')]: Syntax }, true);
    Syntax.register();
    Syntax.DEFAULTS.languages = [
      { key: 'javascript', label: 'JavaScript' },
      { key: 'ruby', label: 'Ruby' },
    ];
  });

  const createLextron = () => {
    const container = document.body.appendChild(document.createElement('div'));
    container.innerHTML = normalizeHTML(
      `<pre data-language="javascript">var test = 1;<br>var bugz = 0;<br></pre>
      <p><br></p>`,
    );
    const editor = new Lextron(container, {
      modules: {
        syntax: {
          hljs,
          interval: HIGHLIGHT_INTERVAL,
        },
      },
      registry: createRegistry([
        Bold,
        CodeToken,
        CodeBlock,
        Lextron.import(lxtPath.format('code-block-container')),
      ]),
    });
    return editor;
  };

  describe('highlighting', () => {
    test('initialize', () => {
      const editor = createLextron();
      expect(editor.root).toEqualHTML(
        `<div class="lxt-code-block-container" spellcheck="false">
          <div class="lxt-code-block" data-language="javascript">var test = 1;</div>
          <div class="lxt-code-block" data-language="javascript">var bugz = 0;</div>
        </div>
        <p><br></p>`,
      );
      expect(editor.getContents()).toEqual(
        new ChangeSet()
          .insert('var test = 1;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('var bugz = 0;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('\n'),
      );
    });

    test('adds token', async () => {
      const editor = createLextron();
      await sleep(HIGHLIGHT_INTERVAL + 1);
      expect(editor.root).toEqualHTML(
        `<div class="lxt-code-block-container" spellcheck="false">
            <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">var</span> test = <span class="lxt-token hljs-number">1</span>;</div>
            <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">var</span> bugz = <span class="lxt-token hljs-number">0</span>;</div>
          </div>
          <p><br></p>`,
      );
      expect(editor.getContents()).toEqual(
        new ChangeSet()
          .insert('var test = 1;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('var bugz = 0;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('\n'),
      );
    });

    test('tokens do not escape', async () => {
      const editor = createLextron();
      editor.deleteText(22, 6);
      await sleep(HIGHLIGHT_INTERVAL + 1);
      expect(editor.root).toEqualHTML(`
          <div class="lxt-code-block-container" spellcheck="false">
            <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">var</span> test = <span class="lxt-token hljs-number">1</span>;</div>
          </div>
          <p>var bugz</p>`);
      expect(editor.getContents()).toEqual(
        new ChangeSet()
          .insert('var test = 1;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('var bugz\n'),
      );
    });

    test('change language', async () => {
      const editor = createLextron();
      editor.formatLine(0, 20, 'code-block', 'ruby');
      await sleep(HIGHLIGHT_INTERVAL + 1);
      expect(editor.root).toEqualHTML(`
          <div class="lxt-code-block-container" spellcheck="false">
            <div class="lxt-code-block" data-language="ruby">var test = <span class="lxt-token hljs-number">1</span>;</div>
            <div class="lxt-code-block" data-language="ruby">var bugz = <span class="lxt-token hljs-number">0</span>;</div>
          </div>
          <p><br></p>`);
      expect(editor.getContents()).toEqual(
        new ChangeSet()
          .insert('var test = 1;')
          .insert('\n', { 'code-block': 'ruby' })
          .insert('var bugz = 0;')
          .insert('\n', { 'code-block': 'ruby' })
          .insert('\n'),
      );
    });

    test('invalid language', async () => {
      const editor = createLextron();
      editor.formatLine(0, 20, 'code-block', 'invalid');
      await sleep(HIGHLIGHT_INTERVAL + 1);
      expect(editor.root).toEqualHTML(`
          <div class="lxt-code-block-container" spellcheck="false">
            <div class="lxt-code-block" data-language="plain">var test = 1;</div>
            <div class="lxt-code-block" data-language="plain">var bugz = 0;</div>
          </div>
          <p><br></p>`);
      expect(editor.getContents()).toEqual(
        new ChangeSet()
          .insert('var test = 1;')
          .insert('\n', { 'code-block': 'plain' })
          .insert('var bugz = 0;')
          .insert('\n', { 'code-block': 'plain' })
          .insert('\n'),
      );
    });

    test('unformat first line', async () => {
      const editor = createLextron();
      editor.formatLine(0, 1, 'code-block', false);
      await sleep(HIGHLIGHT_INTERVAL + 1);
      expect(editor.root).toEqualHTML(`
          <p>var test = 1;</p>
          <div class="lxt-code-block-container" spellcheck="false">
            <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">var</span> bugz = <span class="lxt-token hljs-number">0</span>;</div>
          </div>
          <p><br></p>`);
      expect(editor.getContents()).toEqual(
        new ChangeSet()
          .insert('var test = 1;\nvar bugz = 0;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('\n'),
      );
    });

    test('split container', async () => {
      const editor = createLextron();
      editor.updateContents(new ChangeSet().retain(14).insert('\n'));
      await sleep(HIGHLIGHT_INTERVAL + 1);
      expect(editor.root).toEqualHTML(
        `
          <div class="lxt-code-block-container" spellcheck="false">
            <select class="lxt-ui" contenteditable="false">
              <option value="javascript">JavaScript</option>
              <option value="ruby">Ruby</option>
            </select>
            <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">var</span> test = <span class="lxt-token hljs-number">1</span>;</div>
          </div>
          <p><br></p>
          <div class="lxt-code-block-container" spellcheck="false">
            <select class="lxt-ui" contenteditable="false">
              <option value="javascript">JavaScript</option>
              <option value="ruby">Ruby</option>
            </select>
            <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">var</span> bugz = <span class="lxt-token hljs-number">0</span>;</div>
          </div>
          <p><br></p>`,
      );
      expect(editor.getContents()).toEqual(
        new ChangeSet()
          .insert('var test = 1;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('\nvar bugz = 0;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('\n'),
      );
    });

    test('merge containers', async () => {
      const editor = createLextron();
      editor.updateContents(new ChangeSet().retain(14).insert('\n'));
      await sleep(HIGHLIGHT_INTERVAL + 1);
      editor.deleteText(14, 1);
      await sleep(HIGHLIGHT_INTERVAL + 1);
      expect(editor.root).toEqualHTML(
        `
            <div class="lxt-code-block-container" spellcheck="false">
              <select class="lxt-ui" contenteditable="false">
                <option value="javascript">JavaScript</option>
                <option value="ruby">Ruby</option>
              </select>
              <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">var</span> test = <span class="lxt-token hljs-number">1</span>;</div>
              <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">var</span> bugz = <span class="lxt-token hljs-number">0</span>;</div>
            </div>
            <p><br></p>`,
      );
      expect(editor.getContents()).toEqual(
        new ChangeSet()
          .insert('var test = 1;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('var bugz = 0;')
          .insert('\n', { 'code-block': 'javascript' })
          .insert('\n'),
      );
    });

    describe('allowedChildren', () => {
      beforeAll(() => {
        CodeBlock.allowedChildren.push(Bold);
      });

      afterAll(() => {
        CodeBlock.allowedChildren.pop();
      });

      test('modification', async () => {
        const editor = createLextron();
        editor.formatText(2, 3, 'bold', true);
        await sleep(HIGHLIGHT_INTERVAL + 1);
        expect(editor.root).toEqualHTML(`
          <div class="lxt-code-block-container" spellcheck="false">
            <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">va</span><strong><span class="lxt-token hljs-keyword">r</span> t</strong>est = <span class="lxt-token hljs-number">1</span>;</div>
            <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">var</span> bugz = <span class="lxt-token hljs-number">0</span>;</div>
          </div>
          <p><br></p>`);
        expect(editor.getContents()).toEqual(
          new ChangeSet()
            .insert('va')
            .insert('r t', { bold: true })
            .insert('est = 1;')
            .insert('\n', { 'code-block': 'javascript' })
            .insert('var bugz = 0;')
            .insert('\n', { 'code-block': 'javascript' })
            .insert('\n'),
        );
      });

      test('removal', async () => {
        const editor = createLextron();
        editor.formatText(2, 3, 'bold', true);
        await sleep(HIGHLIGHT_INTERVAL + 1);
        editor.formatLine(0, 15, 'code-block', false);
        expect(editor.root).toEqualHTML(
          `<p>va<strong>r t</strong>est = 1;</p><p>var bugz = 0;</p><p><br></p>`,
        );
        expect(editor.getContents()).toEqual(
          new ChangeSet()
            .insert('va')
            .insert('r t', { bold: true })
            .insert('est = 1;\nvar bugz = 0;\n\n'),
        );
      });

      test('addition', async () => {
        const editor = createLextron();
        editor.setText('var test = 1;\n');
        editor.formatText(2, 3, 'bold', true);
        editor.formatLine(0, 1, 'code-block', 'javascript');
        await sleep(HIGHLIGHT_INTERVAL + 1);
        expect(editor.root).toEqualHTML(`
            <div class="lxt-code-block-container" spellcheck="false">
            <div class="lxt-code-block" data-language="javascript"><span class="lxt-token hljs-keyword">va</span><strong><span class="lxt-token hljs-keyword">r</span> t</strong>est = <span class="lxt-token hljs-number">1</span>;</div>
          </div>`);
        expect(editor.getContents()).toEqual(
          new ChangeSet()
            .insert('va')
            .insert('r t', { bold: true })
            .insert('est = 1;')
            .insert('\n', { 'code-block': 'javascript' }),
        );
      });
    });
  });

  describe('html', () => {
    test('code language', () => {
      const editor = createLextron();
      expect(editor.getSemanticHTML()).toContain('data-language="javascript"');
    });
  });
});
