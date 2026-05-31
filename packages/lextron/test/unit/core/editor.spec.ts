import ChangeSet from 'lextron-change';
import Editor from 'lextron-core/core/editor.js';
import Block from 'lextron-core/blots/block.js';
import { Range } from 'lextron-core/core/selection.js';
import Scroll from 'lextron-core/blots/scroll.js';
import { Registry } from 'lextron-dom';
import Text from 'lextron-core/blots/text.js';
import Emitter from 'lextron-core/core/emitter.js';
import Break from 'lextron-core/blots/break.js';
import { describe, expect, test } from 'vitest';
import { createRegistry } from '../__helpers__/factory.js';
import List, { ListContainer } from 'lextron-formats/formats/list.js';
import Bold from 'lextron-formats/formats/bold.js';
import Image from 'lextron-formats/formats/image.js';
import Link from 'lextron-formats/formats/link.js';
import { FontClass } from 'lextron-formats/formats/font.js';
import Header from 'lextron-formats/formats/header.js';
import Italic from 'lextron-formats/formats/italic.js';
import { AlignClass } from 'lextron-formats/formats/align.js';
import Video from 'lextron-formats/formats/video.js';
import Strike from 'lextron-formats/formats/strike.js';
import Underline from 'lextron-formats/formats/underline.js';
import CodeBlock, { CodeBlockContainer } from 'lextron-formats/formats/code.js';
import { SizeClass } from 'lextron-formats/formats/size.js';
import Blockquote from 'lextron-formats/formats/blockquote.js';
import IndentClass from 'lextron-formats/formats/indent.js';
import { ColorClass } from 'lextron-formats/formats/color.js';
import Lextron from '../../../src/core.js';
import { normalizeHTML } from '../__helpers__/utils.js';

const createEditor = (htmlOrContents: string | ChangeSet) => {
  const container = document.createElement('div');
  if (typeof htmlOrContents === 'string') {
    container.innerHTML = normalizeHTML(htmlOrContents);
  }
  document.body.appendChild(container);
  const editor = new Lextron(container, {
    registry: createRegistry([
      ListContainer,
      List,
      IndentClass,
      Bold,
      Image,
      ColorClass,
      Link,
      FontClass,
      Header,
      Italic,
      AlignClass,
      Video,
      Strike,
      Underline,
      CodeBlock,
      CodeBlockContainer,
      Blockquote,
      SizeClass,
    ]),
  });
  if (typeof htmlOrContents !== 'string') {
    editor.setContents(htmlOrContents);
  }
  return editor.editor;
};

describe('Editor', () => {
  describe('insert', () => {
    test('text', () => {
      const editor = createEditor('<p><strong>0123</strong></p>');
      editor.insertText(2, '!!');
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet().insert('01!!23', { bold: true }).insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><strong>01!!23</strong></p>',
      );
    });

    test('embed', () => {
      const editor = createEditor('<p><strong>0123</strong></p>');
      editor.insertEmbed(2, 'image', '/assets/favicon.png');
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet()
          .insert('01', { bold: true })
          .insert({ image: '/assets/favicon.png' }, { bold: true })
          .insert('23', { bold: true })
          .insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><strong>01<img src="/assets/favicon.png">23</strong></p>',
      );
    });

    test('on empty line', () => {
      const editor = createEditor('<p>0</p><p><br></p><p>3</p>');
      editor.insertText(2, '!');
      expect(editor.getChangeSet()).toEqual(new ChangeSet().insert('0\n!\n3\n'));
      expect(editor.scroll.domNode).toEqualHTML('<p>0</p><p>!</p><p>3</p>');
    });

    test('end of document', () => {
      const editor = createEditor('<p>Hello</p>');
      editor.insertText(6, 'World!');
      expect(editor.getChangeSet()).toEqual(new ChangeSet().insert('Hello\nWorld!\n'));
      expect(editor.scroll.domNode).toEqualHTML('<p>Hello</p><p>World!</p>');
    });

    test('end of document with newline', () => {
      const editor = createEditor('<p>Hello</p>');
      editor.insertText(6, 'World!\n');
      expect(editor.getChangeSet()).toEqual(new ChangeSet().insert('Hello\nWorld!\n'));
      expect(editor.scroll.domNode).toEqualHTML('<p>Hello</p><p>World!</p>');
    });

    test('embed at end of document with newline', () => {
      const editor = createEditor('<p>Hello</p>');
      editor.insertEmbed(6, 'image', '/assets/favicon.png');
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet()
          .insert('Hello\n')
          .insert({ image: '/assets/favicon.png' })
          .insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>Hello</p><p><img src="/assets/favicon.png"></p>',
      );
    });

    test('newline splitting', () => {
      const editor = createEditor('<p><strong>0123</strong></p>');
      editor.insertText(2, '\n');
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet()
          .insert('01', { bold: true })
          .insert('\n')
          .insert('23', { bold: true })
          .insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(`
        <p><strong>01</strong></p>
        <p><strong>23</strong></p>`);
    });

    test('prepend newline', () => {
      const editor = createEditor('<p><strong>0123</strong></p>');
      editor.insertText(0, '\n');
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet().insert('\n').insert('0123', { bold: true }).insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(`
        <p><br></p>
        <p><strong>0123</strong></p>`);
    });

    test('append newline', () => {
      const editor = createEditor('<p><strong>0123</strong></p>');
      editor.insertText(4, '\n');
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet().insert('0123', { bold: true }).insert('\n\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(`
        <p><strong>0123</strong></p>
        <p><br></p>`);
    });

    test('multiline text', () => {
      const editor = createEditor('<p><strong>0123</strong></p>');
      editor.insertText(2, '\n!!\n!!\n');
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet()
          .insert('01', { bold: true })
          .insert('\n')
          .insert('!!', { bold: true })
          .insert('\n')
          .insert('!!', { bold: true })
          .insert('\n')
          .insert('23', { bold: true })
          .insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(`
        <p><strong>01</strong></p>
        <p><strong>!!</strong></p>
        <p><strong>!!</strong></p>
        <p><strong>23</strong></p>`);
    });

    test('multiple newlines', () => {
      const editor = createEditor('<p><strong>0123</strong></p>');
      editor.insertText(2, '\n\n');
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet()
          .insert('01', { bold: true })
          .insert('\n\n')
          .insert('23', { bold: true })
          .insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(`
        <p><strong>01</strong></p>
        <p><br></p>
        <p><strong>23</strong></p>`);
    });

    test('text removing formatting', () => {
      const editor = createEditor('<p><s>01</s></p>');
      editor.insertText(2, '23', { bold: false, strike: false });
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet().insert('01', { strike: true }).insert('23\n'),
      );
    });
  });

  describe('delete', () => {
    test('inner node', () => {
      const editor = createEditor('<p><strong><em>0123</em></strong></p>');
      editor.deleteText(1, 2);
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet().insert('03', { bold: true, italic: true }).insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><strong><em>03</em></strong></p>',
      );
    });

    test('parts of multiple lines', () => {
      const editor = createEditor('<p><em>0123</em></p><p><em>5678</em></p>');
      editor.deleteText(2, 5);
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet().insert('0178', { italic: true }).insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML('<p><em>0178</em></p>');
    });

    test('entire line keeping newline', () => {
      const editor = createEditor('<p><strong><em>0123</em></strong></p>');
      editor.deleteText(0, 4);
      expect(editor.getChangeSet()).toEqual(new ChangeSet().insert('\n'));
      expect(editor.scroll.domNode).toEqualHTML('<p><br></p>');
    });

    test('newline', () => {
      const editor = createEditor('<p><em>0123</em></p><p><em>5678</em></p>');
      editor.deleteText(4, 1);
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet().insert('01235678', { italic: true }).insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML('<p><em>01235678</em></p>');
    });

    test('entire document', () => {
      const editor = createEditor('<p><strong><em>0123</em></strong></p>');
      editor.deleteText(0, 5);
      expect(editor.getChangeSet()).toEqual(new ChangeSet().insert('\n'));
      expect(editor.scroll.domNode).toEqualHTML('<p><br></p>');
    });

    test('multiple complete lines', () => {
      const editor = createEditor(
        '<p><em>012</em></p><p><em>456</em></p><p><em>890</em></p>',
      );
      editor.deleteText(0, 8);
      expect(editor.getChangeSet()).toEqual(
        new ChangeSet().insert('890', { italic: true }).insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML('<p><em>890</em></p>');
    });
  });

  describe('format', () => {
    test('line', () => {
      const editor = createEditor('<p>0123</p>');
      editor.formatLine(1, 1, { header: 1 });
      expect(editor.scroll.domNode).toEqualHTML('<h1>0123</h1>');
    });
  });

  describe('removeFormat', () => {
    test('unwrap', () => {
      const editor = createEditor('<p>0<em>12</em>3</p>');
      editor.removeFormat(1, 2);
      expect(editor.scroll.domNode).toEqualHTML('<p>0123</p>');
    });

    test('split inline', () => {
      const editor = createEditor('<p>0<strong><em>12</em></strong>3</p>');
      editor.removeFormat(1, 1);
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>01<strong><em>2</em></strong>3</p>',
      );
    });

    test('partial line', () => {
      const editor = createEditor(
        '<h1>01</h1><ol><li data-list="ordered">34</li></ol>',
      );
      editor.removeFormat(1, 3);
      expect(editor.scroll.domNode).toEqualHTML('<p>01</p><p>34</p>');
    });

    test('remove embed', () => {
      const editor = createEditor('<p>0<img src="/assets/favicon.png">2</p>');
      editor.removeFormat(1, 1);
      expect(editor.scroll.domNode).toEqualHTML('<p>02</p>');
    });

    test('combined', () => {
      const editor = createEditor(
        `
        <h1>01<img src="/assets/favicon.png">3</h1>
        <ol>
          <li data-list="ordered">5<strong>6<em>78</em>9</strong>0</li>
        </ol>
      `,
      );
      editor.removeFormat(1, 7);
      expect(editor.scroll.domNode).toEqualHTML(`
        <p>013</p>
        <p>567<strong><em>8</em>9</strong>0</p>
      `);
    });

    test('end of document', () => {
      const editor = createEditor(
        `
        <ol>
          <li data-list="ordered">0123</li>
          <li data-list="ordered">5678</li>
        </ol>
      `,
      );
      editor.removeFormat(0, 12);
      expect(editor.scroll.domNode).toEqualHTML(`
        <p>0123</p>
        <p>5678</p>
      `);
    });
  });

  describe('applyChangeSet', () => {
    test('insert', () => {
      const editor = createEditor('<p></p>');
      editor.applyChangeSet(new ChangeSet().insert('01'));
      expect(editor.scroll.domNode).toEqualHTML('<p>01</p>');
    });

    test('attributed insert', () => {
      const editor = createEditor('<p>0123</p>');
      editor.applyChangeSet(new ChangeSet().retain(2).insert('|', { bold: true }));
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>01<strong>|</strong>23</p>',
      );
    });

    test('format', () => {
      const editor = createEditor('<p>01</p>');
      editor.applyChangeSet(new ChangeSet().retain(2, { bold: true }));
      expect(editor.scroll.domNode).toEqualHTML('<p><strong>01</strong></p>');
    });

    test('discontinuous formats', () => {
      const editor = createEditor('');
      const delta = new ChangeSet()
        .insert('ab', { bold: true })
        .insert('23\n45')
        .insert('cd', { bold: true });
      editor.applyChangeSet(delta);
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><strong>ab</strong>23</p><p>45<strong>cd</strong></p>',
      );
    });

    test('unformatted insert', () => {
      const editor = createEditor('<p><em>01</em></p>');
      editor.applyChangeSet(new ChangeSet().retain(1).insert('|'));
      expect(editor.scroll.domNode).toEqualHTML('<p><em>0</em>|<em>1</em></p>');
    });

    test('insert at format boundary', () => {
      const editor = createEditor('<p><em>0</em><u>1</u></p>');
      editor.applyChangeSet(new ChangeSet().retain(1).insert('|', { strike: true }));
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><em>0</em><s>|</s><u>1</u></p>',
      );
    });

    test('unformatted newline', () => {
      const editor = createEditor('<h1>01</h1>');
      editor.applyChangeSet(new ChangeSet().retain(2).insert('\n'));
      expect(editor.scroll.domNode).toEqualHTML('<p>01</p><h1><br></h1>');
    });

    test('formatted embed', () => {
      const editor = createEditor('');
      editor.applyChangeSet(
        new ChangeSet().insert({ image: '/assets/favicon.png' }, { italic: true }),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><em><img src="/assets/favicon.png"></em></p>',
      );
    });

    test('insert text before block embed', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(new ChangeSet().retain(5).insert('5678'));
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><p>5678</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
    });

    test('insert attributed text before block embed', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(new ChangeSet().retain(5).insert('5678', { bold: true }));
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><p><strong>5678</strong></p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
    });

    test('insert text with newline before block embed', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(new ChangeSet().retain(5).insert('5678\n'));
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><p>5678</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
    });

    test('insert formatted lines before block embed', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(
        new ChangeSet().retain(5).insert('a\nb').insert('\n', { header: 1 }),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><p>a</p><h1>b</h1><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
    });

    test('insert attributed text with newline before block embed', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(
        new ChangeSet().retain(5).insert('5678', { bold: true }).insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><p><strong>5678</strong></p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
    });

    test('multiple inserts and deletes', () => {
      const editor = createEditor('<p>0123</p>');
      editor.applyChangeSet(
        new ChangeSet()
          .retain(1)
          .insert('a')
          .delete(2)
          .insert('cd')
          .delete(1)
          .insert('efg'),
      );
      expect(editor.scroll.domNode).toEqualHTML('<p>0acdefg</p>');
    });

    test('insert text with delete in existing block', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(
        new ChangeSet()
          .retain(4)
          .insert('abc')
          // Retain newline at end of block being inserted into.
          .retain(1)
          .delete(1),
      );
      expect(editor.scroll.domNode).toEqualHTML('<p>0123abc</p>');
    });

    test('insert text with delete before block embed', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(
        new ChangeSet()
          .retain(5)
          // Explicit newline required to maintain correct index calculation for the delete.
          .insert('abc\n')
          .delete(1),
      );
      expect(editor.scroll.domNode).toEqualHTML('<p>0123</p><p>abc</p>');
    });

    test('insert inline embed with delete in existing block', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(
        new ChangeSet()
          .retain(4)
          .insert({ image: '/assets/favicon.png' })
          // Retain newline at end of block being inserted into.
          .retain(1)
          .delete(1),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123<img src="/assets/favicon.png"></p>',
      );
    });

    test('insert inline embed with delete before block embed', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(
        new ChangeSet()
          .retain(5)
          .insert({ image: '/assets/favicon.png' })
          // Explicit newline required to maintain correct index calculation for the delete.
          .insert('\n')
          .delete(1),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><p><img src="/assets/favicon.png"></p>',
      );
    });

    test('insert inline embed with delete before block embed using delete op first', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(
        new ChangeSet()
          .retain(5)
          .delete(1)
          .insert({ image: '/assets/favicon.png' })
          // Explicit newline required to maintain correct index calculation for the delete.
          .insert('\n'),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><p><img src="/assets/favicon.png"></p>',
      );
    });

    test('insert inline embed and text with delete before block embed', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(
        new ChangeSet()
          .retain(5)
          .insert({ image: '/assets/favicon.png' })
          // Explicit newline required to maintain correct index calculation for the delete.
          .insert('abc\n')
          .delete(1),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><p><img src="/assets/favicon.png">abc</p>',
      );
    });

    test('insert inline embed to the middle of formatted content', () => {
      const editor = createEditor('<p><strong>0123</strong></p>');
      editor.applyChangeSet(
        new ChangeSet().retain(2).insert({ image: '/assets/favicon.png' }),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><strong>01</strong><img src="/assets/favicon.png"><strong>23</strong></p>',
      );
    });

    test('insert inline embed between plain text and formatted content', () => {
      const editor = createEditor('<p>a<strong>b</strong></p>');
      editor.applyChangeSet(new ChangeSet().retain(1).insert({ image: '#' }));
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>a<img src="#"><strong>b</strong></p>',
      );
    });

    test('prepend inline embed to another inline embed with same attributes', () => {
      const editor = createEditor('<p><img src="#" alt="hi"/></p>');
      editor.applyChangeSet(new ChangeSet().insert({ image: '#' }, { alt: 'hi' }));
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><img src="#" alt="hi"><img src="#" alt="hi"></p>',
      );
    });

    test('insert block embed with delete before block embed', () => {
      const editor = createEditor(
        '<p>0123</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
      editor.applyChangeSet(
        new ChangeSet().retain(5).insert({ video: '#changed' }).delete(1),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><iframe src="#changed" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>',
      );
    });

    test('deletes block embed and appends text', () => {
      const editor = createEditor(
        `<p><br></p><iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe><p>b</p>`,
      );
      editor.applyChangeSet(new ChangeSet().retain(1).insert('a').delete(1));
      expect(editor.scroll.domNode).toEqualHTML('<p><br></p><p>ab</p>');
    });

    test('multiple delete block embed and append texts', () => {
      const editor = createEditor(
        `<p><br></p><iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe><iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe><p>b</p>`,
      );
      editor.applyChangeSet(
        new ChangeSet().retain(1).insert('a').delete(1).insert('!').delete(1),
      );
      expect(editor.scroll.domNode).toEqualHTML('<p><br></p><p>a!b</p>');
    });

    test('multiple nonconsecutive delete block embed and append texts', () => {
      const editor = createEditor(
        `<p><br></p>
         <iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe>
         <p>a</p>
         <iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe>
         <p>bb</p>
         <iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe>
         <p>ccc</p>
         <iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe>
         <p>dddd</p>`,
      );
      const old = editor.getChangeSet();
      const delta = new ChangeSet()
        .retain(1)
        .insert('1')
        .delete(1)
        .retain(2)
        .insert('2')
        .delete(1)
        .retain(3)
        .insert('3')
        .delete(1)
        .retain(4)
        .insert('4')
        .delete(1);
      editor.applyChangeSet(delta);
      expect(editor.getChangeSet()).toEqual(old.compose(delta));
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><br></p><p>1a</p><p>2bb</p><p>3ccc</p><p>4dddd</p>',
      );
    });

    describe('block embed', () => {
      test('improper block embed insert', () => {
        const editor = createEditor('<p>0123</p>');
        editor.applyChangeSet(new ChangeSet().retain(2).insert({ video: '#' }));
        expect(editor.scroll.domNode).toEqualHTML(
          '<p>01</p><iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe><p>23</p>',
        );
      });

      describe('insert and delete', () => {
        test('prepend', () => {
          const editor = createEditor('<p>0123</p>');
          editor.applyChangeSet(new ChangeSet().insert({ video: '#' }).delete(2));
          expect(editor.scroll.domNode).toEqualHTML(
            '<iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe><p>23</p>',
          );
        });

        test('insert to the middle of text', () => {
          const editor = createEditor(`<p>abc</p>`);
          editor.applyChangeSet(
            new ChangeSet().retain(1).insert({ video: '#' }).delete(2),
          );
          expect(editor.scroll.domNode).toEqualHTML(
            '<p>a</p><iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe><p><br></p>',
          );
        });

        test('insert after \\n', () => {
          const editor = createEditor(`<p>a</p><p>cda</p>`);
          editor.applyChangeSet(
            new ChangeSet().retain(2).insert({ video: '#' }).delete(2),
          );
          expect(editor.scroll.domNode).toEqualHTML(
            '<p>a</p><iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe><p>a</p>',
          );
        });

        test('insert after an inline embed', () => {
          const editor = createEditor(
            `<p><img src="/assets/favicon.png"></p><p>abc</p>`,
          );
          editor.applyChangeSet(
            new ChangeSet().retain(1).insert({ video: '#' }).delete(2),
          );
          expect(editor.scroll.domNode).toEqualHTML(
            '<p><img src="/assets/favicon.png"></p><iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe><p>bc</p>',
          );
        });

        test('insert after a block embed', () => {
          const editor = createEditor(
            `<iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe><p>abc</p>`,
          );
          editor.applyChangeSet(
            new ChangeSet().retain(1).insert({ video: '#' }).delete(2),
          );
          expect(editor.scroll.domNode).toEqualHTML(
            '<iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe><iframe class="lxt-video" frameborder="0" allowfullscreen="true" src="#"></iframe><p>c</p>',
          );
        });
      });

      test('append formatted block embed', () => {
        const editor = createEditor('<p>0123</p><p><br></p>');
        editor.applyChangeSet(
          new ChangeSet().retain(5).insert({ video: '#' }, { align: 'right' }),
        );
        expect(editor.scroll.domNode).toEqualHTML(
          '<p>0123</p><iframe src="#" class="lxt-video lxt-align-right" frameborder="0" allowfullscreen="true"></iframe><p><br></p>',
        );
      });
    });

    test('append', () => {
      const editor = createEditor('<p>0123</p>');
      editor.applyChangeSet(new ChangeSet().retain(5).insert('5678'));
      expect(editor.scroll.domNode).toEqualHTML('<p>0123</p><p>5678</p>');
    });

    test('append newline', () => {
      const editor = createEditor('<p>0123</p>');
      editor.applyChangeSet(new ChangeSet().retain(5).insert('\n', { header: 2 }));
      expect(editor.scroll.domNode).toEqualHTML('<p>0123</p><h2><br></h2>');
    });

    test('append text with newline', () => {
      const editor = createEditor('<p>0123</p>');
      editor.applyChangeSet(
        new ChangeSet().retain(5).insert('5678').insert('\n', { header: 2 }),
      );
      expect(editor.scroll.domNode).toEqualHTML('<p>0123</p><h2>5678</h2>');
    });

    test('append non-isolated newline', () => {
      const editor = createEditor('<p>0123</p>');
      editor.applyChangeSet(new ChangeSet().retain(5).insert('5678\n', { header: 2 }));
      expect(editor.scroll.domNode).toEqualHTML('<p>0123</p><h2>5678</h2>');
    });

    test('eventual append', () => {
      const editor = createEditor('<p>0123</p>');
      editor.applyChangeSet(
        new ChangeSet()
          .retain(2)
          .insert('ab\n', { header: 1 })
          .retain(3)
          .insert('cd\n', { header: 2 }),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<h1>01ab</h1><p>23</p><h2>cd</h2>',
      );
    });

    test('append text, embed and newline', () => {
      const editor = createEditor('<p>0123</p>');
      editor.applyChangeSet(
        new ChangeSet()
          .retain(5)
          .insert('5678')
          .insert({ image: '/assets/favicon.png' })
          .insert('\n', { header: 2 }),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><h2>5678<img src="/assets/favicon.png"></h2>',
      );
    });

    test('append multiple lines', () => {
      const editor = createEditor('<p>0123</p>');
      editor.applyChangeSet(
        new ChangeSet()
          .retain(5)
          .insert('56')
          .insert('\n', { header: 1 })
          .insert('89')
          .insert('\n', { header: 2 }),
      );
      expect(editor.scroll.domNode).toEqualHTML(
        '<p>0123</p><h1>56</h1><h2>89</h2>',
      );
    });

    test('code block', () => {
      const editor = createEditor(
        '<p>0</p><div class="lxt-code-block-container"><div class="lxt-code-block">1</div><div class="lxt-code-block">23</div></div><p><br></p>',
      );
      editor.applyChangeSet(new ChangeSet().delete(4).retain(1).delete(2));
      expect(editor.scroll.domNode.innerHTML).toEqual('<p>2</p>');
    });

    test('prepending bold with a newline and unformatted text', () => {
      const editor = createEditor('<p><strong>a</strong></p>');
      editor.applyChangeSet(new ChangeSet().insert('\n1'));
      expect(editor.scroll.domNode).toEqualHTML(
        '<p><br></p><p>1<strong>a</strong></p>',
      );
    });
  });

  describe('insertContents', () => {
    const video =
      '<iframe src="#" class="lxt-video" frameborder="0" allowfullscreen="true"></iframe>';

    test('ignores empty delta', () => {
      const editor = createEditor('<p>1</p>');
      editor.insertContents(0, new ChangeSet());
      expect(editor.getChangeSet().ops).toEqual([{ insert: '1\n' }]);

      editor.insertContents(0, new ChangeSet().retain(100));
      expect(editor.getChangeSet().ops).toEqual([{ insert: '1\n' }]);
    });

    test('prepend to paragraph', () => {
      const editor = createEditor('<p>2</p>');
      editor.insertContents(0, new ChangeSet().insert('1'));
      expect(editor.getChangeSet().ops).toEqual([{ insert: '12\n' }]);

      editor.insertContents(
        0,
        new ChangeSet()
          .insert('a', { bold: true })
          .insert('\n', { header: 1 })
          .insert('b', { bold: true }),
      );

      expect(editor.getChangeSet().ops).toEqual([
        { insert: 'a', attributes: { bold: true } },
        { insert: '\n', attributes: { header: 1 } },
        { insert: 'b', attributes: { bold: true } },
        { insert: '12\n' },
      ]);
    });

    test('prepend to list item', () => {
      const editor = createEditor('<ol><li data-list="bullet">2</li></ol>');
      editor.insertContents(0, new ChangeSet().insert('1'));
      expect(editor.getChangeSet().ops).toEqual([
        { insert: '12' },
        { insert: '\n', attributes: { list: 'bullet' } },
      ]);

      editor.insertContents(
        0,
        new ChangeSet()
          .insert('a', { bold: true })
          .insert('\n', { header: 1 })
          .insert('b', { bold: true }),
      );

      expect(editor.getChangeSet().ops).toEqual([
        { insert: 'a', attributes: { bold: true } },
        { insert: '\n', attributes: { header: 1 } },
        { insert: 'b', attributes: { bold: true } },
        { insert: '12' },
        { insert: '\n', attributes: { list: 'bullet' } },
      ]);
    });

    test('insert before formatting', () => {
      class MyBlot extends Block {
        static className = 'my-blot';
        static blotName = 'my-blot';

        formatAt(index: number, length: number, name: string, value: string) {
          super.formatAt(index, length, name, value);
          if (name === 'test-style' && !!this.prev) {
            this.domNode.setAttribute('test-style', value);
          }
        }
      }

      const registry = new Registry();
      registry.register(MyBlot, Block, Break, Text);
      const editor = new Editor(
        new Scroll(registry, document.createElement('div'), {
          emitter: new Emitter(),
        }),
      );

      editor.insertContents(
        0,
        new ChangeSet()
          .insert('\n')
          .insert('hi')
          .insert('\n', { 'my-blot': true, 'test-style': 'random' }),
      );
      expect(editor.scroll.domNode.innerHTML).toContain('test-style="random"');
    });

    describe('prepend to block embed', () => {
      test('without ending with \\n', () => {
        const editor = createEditor(`${video}`);
        editor.insertContents(0, new ChangeSet().insert('a'));
        expect(editor.getChangeSet().ops).toEqual([
          { insert: 'a\n' },
          { insert: { video: '#' } },
        ]);
      });

      test('empty first line', () => {
        const editor = createEditor(`<p></p>${video}`);
        editor.insertContents(1, new ChangeSet().insert('\nworld\n'));
        expect(editor.getChangeSet().ops).toEqual([
          { insert: '\n\nworld\n' },
          { insert: { video: '#' } },
        ]);
      });

      test('multiple lines', () => {
        const editor = createEditor(`${video}`);
        editor.insertContents(
          0,
          new ChangeSet().insert('a').insert('\n', { header: 1 }),
        );
        expect(editor.getChangeSet().ops).toEqual([
          { insert: 'a' },
          { insert: '\n', attributes: { header: 1 } },
          { insert: { video: '#' } },
        ]);
      });
    });

    describe('append', () => {
      test('appends to editor', () => {
        const editor = createEditor('<p>1</p>');
        editor.insertContents(2, new ChangeSet().insert('a'));
        expect(editor.getChangeSet().ops).toEqual([{ insert: '1\na\n' }]);
        editor.insertContents(
          4,
          new ChangeSet().insert('b').insert('\n', { header: 1 }),
        );
        expect(editor.getChangeSet().ops).toEqual([
          { insert: '1\na\nb' },
          { insert: '\n', attributes: { header: 1 } },
        ]);
      });

      test('appends to paragraph', () => {
        const editor = createEditor('<p>1</p><p>2</p>');
        editor.insertContents(2, new ChangeSet().insert('a'));
        expect(editor.getChangeSet().ops).toEqual([{ insert: '1\na2\n' }]);
        editor.insertContents(
          2,
          new ChangeSet().insert('b').insert('\n', { header: 1 }),
        );
        expect(editor.getChangeSet().ops).toEqual([
          { insert: '1\nb' },
          { insert: '\n', attributes: { header: 1 } },
          { insert: 'a2\n' },
        ]);
      });

      test('appends to block embed', () => {
        const editor = createEditor(`${video}<p>2</p>`);
        editor.insertContents(1, new ChangeSet().insert('1'));
        expect(editor.getChangeSet().ops).toEqual([
          { insert: { video: '#' } },
          { insert: '12\n' },
        ]);
        editor.insertContents(
          1,
          new ChangeSet().insert('b').insert('\n', { header: 1 }),
        );
        expect(editor.getChangeSet().ops).toEqual([
          { insert: { video: '#' } },
          { insert: 'b' },
          { insert: '\n', attributes: { header: 1 } },
          { insert: '12\n' },
        ]);
      });
    });

    test('prepends a formatted block embed', () => {
      const editor = createEditor(`<p></p>`);
      editor.insertContents(
        0,
        new ChangeSet().insert({ video: '#' }, { width: '300' }),
      );
      expect(editor.getChangeSet().ops).toEqual([
        { insert: { video: '#' }, attributes: { width: '300' } },
        { insert: '\n' },
      ]);
    });

    test('prepends two formatted block embeds', () => {
      const editor = createEditor(`<p></p>`);
      editor.insertContents(
        0,
        new ChangeSet()
          .insert({ video: '#' }, { width: '300' })
          .insert({ video: '#' }, { width: '600' }),
      );
      expect(editor.getChangeSet().ops).toEqual([
        { insert: { video: '#' }, attributes: { width: '300' } },
        { insert: { video: '#' }, attributes: { width: '600' } },
        { insert: '\n' },
      ]);
    });

    test('inserts formatted block embeds (styles)', () => {
      const editor = createEditor(`<p></p>`);
      editor.insertContents(
        0,
        new ChangeSet()
          .insert('a\n')
          .insert({ video: '#' }, { width: '300' })
          .insert({ video: '#' }, { width: '300' })
          .insert('\nd'),
      );
      expect(editor.getChangeSet().ops).toEqual([
        { insert: 'a\n' },
        { insert: { video: '#' }, attributes: { width: '300' } },
        { insert: { video: '#' }, attributes: { width: '300' } },
        { insert: '\nd\n' },
      ]);
    });

    test('inserts formatted block embeds (attributor)', () => {
      const editor = createEditor(`<p></p>`);
      editor.insertContents(
        0,
        new ChangeSet()
          .insert('a\n')
          .insert({ video: '#' }, { align: 'center' })
          .insert({ video: '#' }, { align: 'center' })
          .insert('\nd'),
      );
      expect(editor.getChangeSet().ops).toEqual([
        { insert: 'a\n' },
        { insert: { video: '#' }, attributes: { align: 'center' } },
        { insert: { video: '#' }, attributes: { align: 'center' } },
        { insert: '\nd\n' },
      ]);
    });

    test('inserts inline embeds to bold text', () => {
      const editor = createEditor(`<p><strong>ab</strong></p>`);
      editor.insertContents(1, new ChangeSet().insert({ image: '#' }));
      expect(editor.getChangeSet().ops).toEqual([
        { insert: 'a', attributes: { bold: true } },
        { insert: { image: '#' } },
        { insert: 'b', attributes: { bold: true } },
        { insert: '\n' },
      ]);
    });

    test('inserts multiple lines to a container', () => {
      const editor = createEditor(`<ol><li data-list="ordered"></li></ol>`);
      editor.insertContents(
        0,
        new ChangeSet()
          .insert('world', { font: 'monospace' })
          .insert('\n', { list: 'bullet' })
          .insert('\n'),
      );
      expect(editor.getChangeSet().ops).toEqual([
        { insert: 'world', attributes: { font: 'monospace' } },
        { insert: '\n', attributes: { list: 'bullet' } },
        { insert: '\n' },
        { insert: '\n', attributes: { list: 'ordered' } },
      ]);
    });

    describe('invalid delta', () => {
      const getEditorChangeSet = (modify: (editor: Editor) => void) => {
        const editor = createEditor(`<p></p>`);
        modify(editor);
        return editor.getChangeSet().ops;
      };

      test('conflict block formats', () => {
        const change = new ChangeSet()
          .insert('a')
          .insert('\n', { header: 1, list: 'bullet' })
          .insert('b')
          .insert('\n', { header: 1, list: 'bullet' });

        expect(
          getEditorChangeSet((editor) => editor.insertContents(0, change)),
        ).toEqual(getEditorChangeSet((editor) => editor.applyChangeSet(change)));
      });

      test('block embeds with line formats', () => {
        const change = new ChangeSet()
          .insert('a\n')
          .insert({ video: '#' }, { header: 1 })
          .insert({ video: '#' }, { header: 1 })
          .insert('\n', { header: 1 });

        expect(
          getEditorChangeSet((editor) => editor.insertContents(0, change)),
        ).toEqual(getEditorChangeSet((editor) => editor.applyChangeSet(change)));
      });

      test('missing \\n before block embeds', () => {
        const change = new ChangeSet()
          .insert('a')
          .insert({ video: '#' })
          .insert('b\n');

        expect(
          getEditorChangeSet((editor) => editor.insertContents(0, change)),
        ).toEqual(getEditorChangeSet((editor) => editor.applyChangeSet(change)));
      });
    });
  });

  describe('getFormat()', () => {
    test('unformatted', () => {
      const editor = createEditor('<p>0123</p>');
      expect(editor.getFormat(1)).toEqual({});
    });

    test('formatted', () => {
      const editor = createEditor('<h1><em>0123</em></h1>');
      expect(editor.getFormat(1)).toEqual({ header: 1, italic: true });
    });

    test('cursor', () => {
      const editor = createEditor(
        '<h1><strong><em>0123</em></strong></h1><h2><u>5678</u></h2>',
      );
      expect(editor.getFormat(2)).toEqual({
        bold: true,
        italic: true,
        header: 1,
      });
    });

    test('cursor with preformat', () => {
      const editor = createEditor('<h1><strong><em>0123</em></strong></h1>');
      const lextron = Lextron.find(editor.scroll.domNode.parentElement!) as Lextron;
      lextron.selection.setRange(new Range(2));
      lextron.selection.format('underline', true);
      lextron.selection.format('color', 'red');
      expect(editor.getFormat(2)).toEqual({
        bold: true,
        italic: true,
        header: 1,
        color: 'red',
        underline: true,
      });
    });

    test('across leaves', () => {
      const editor = createEditor(
        `
        <h1>
          <strong class="lxt-size-small"><em>01</em></strong>
          <em class="lxt-size-large"><u>23</u></em>
          <em class="lxt-size-huge"><u>45</u></em>
        </h1>
      `,
      );
      expect(editor.getFormat(1, 4)).toEqual({
        italic: true,
        header: 1,
        size: ['small', 'large', 'huge'],
      });
    });

    test('across leaves repeated', () => {
      const editor = createEditor(
        `
        <h1>
          <strong class="lxt-size-small"><em>01</em></strong>
          <em class="lxt-size-large"><u>23</u></em>
          <em class="lxt-size-huge"><u>45</u></em>
          <em class="lxt-size-small"><u>45</u></em>
        </h1>
      `,
      );
      expect(editor.getFormat(1, 4)).toEqual({
        italic: true,
        header: 1,
        size: ['small', 'large', 'huge'],
      });
    });

    test('across lines repeated', () => {
      const editor = createEditor(
        `
        <h1 class="lxt-align-right"><em>01</em></h1>
        <h1 class="lxt-align-center"><em>34</em></h1>
        <h1 class="lxt-align-right"><em>36</em></h1>
        <h1 class="lxt-align-center"><em>33</em></h1>
      `,
      );
      expect(editor.getFormat(1, 3)).toEqual({
        italic: true,
        header: 1,
        align: ['right', 'center'],
      });
    });
    test('across lines', () => {
      const editor = createEditor(
        `
        <h1 class="lxt-align-right"><em>01</em></h1>
        <h1 class="lxt-align-center"><em>34</em></h1>
      `,
      );
      expect(editor.getFormat(1, 3)).toEqual({
        italic: true,
        header: 1,
        align: ['right', 'center'],
      });
    });
  });

  describe('getHTML', () => {
    test('inline', () => {
      expect(
        createEditor('<blockquote>Test</blockquote>').getHTML(1, 2),
      ).toEqual('es');

      expect(
        createEditor('<blockquote>Test</blockquote>').getHTML(0, 4),
      ).toEqual('Test');
    });

    test('entire line', () => {
      const editor = createEditor('<blockquote>Test</blockquote>');
      expect(editor.getHTML(0, 5)).toEqual('<blockquote>Test</blockquote>');
    });

    test('entire list item', () => {
      const editor = createEditor('<ul><li>Test</li></ul>');
      expect(editor.getHTML(0, 5)).toEqual('<ul><li>Test</li></ul>');
    });

    test('across lines', () => {
      const editor = createEditor(
        '<h1 class="lxt-align-center">Header</h1><p>Text</p><blockquote>Quote</blockquote>',
      );
      expect(editor.getHTML(1, 14)).toEqual(
        '<h1 class="lxt-align-center">eader</h1><p>Text</p><blockquote>Quo</blockquote>',
      );
    });

    test('collapsible spaces', () => {
      expect(
        createEditor('<p><strong>123 </strong>123<em> 123</em></p>').getHTML(
          0,
          11,
        ),
      ).toEqual('<strong>123&nbsp;</strong>123<em>&nbsp;123</em>');

      expect(createEditor(new ChangeSet().insert('1   2\n')).getHTML(0, 5)).toEqual(
        '1&nbsp;&nbsp;&nbsp;2',
      );

      expect(
        createEditor(
          new ChangeSet().insert('  123', { bold: true }).insert('\n'),
        ).getHTML(0, 5),
      ).toEqual('<strong>&nbsp;&nbsp;123</strong>');
    });

    test('mixed list', () => {
      const editor = createEditor(
        `
          <ol>
            <li data-list="ordered">One</li>
            <li data-list="ordered">Two</li>
            <li data-list="bullet">Foo</li>
            <li data-list="bullet">Bar</li>
          </ol>
        `,
      );
      expect(editor.getHTML(2, 12)).toEqualHTML(`
        <ol>
          <li>e</li>
          <li>Two</li>
        </ol>
        <ul>
          <li>Foo</li>
          <li>Ba</li>
        </ul>
      `);
    });

    test('nested list', () => {
      const editor = createEditor(
        `
          <ol>
            <li data-list="ordered">One</li>
            <li data-list="ordered">Two</li>
            <li data-list="bullet" class="lxt-indent-1">Alpha</li>
            <li data-list="ordered" class="lxt-indent-2">I</li>
            <li data-list="ordered" class="lxt-indent-2">II</li>
            <li data-list="ordered">Three</li>
          </ol>
        `,
      );
      expect(editor.getHTML(2, 20)).toEqualHTML(`
        <ol>
          <li>e</li>
          <li>Two
            <ul>
              <li>Alpha
                <ol>
                  <li>I</li>
                  <li>II</li>
                </ol>
              </li>
            </ul>
          </li>
          <li>Thr</li>
        </ol>
      `);
    });

    test('nested checklist', () => {
      const editor = createEditor(
        `
          <ol>
            <li data-list="checked">One</li>
            <li data-list="checked">Two</li>
            <li data-list="unchecked" class="lxt-indent-1">Alpha</li>
            <li data-list="checked" class="lxt-indent-2">I</li>
            <li data-list="checked" class="lxt-indent-2">II</li>
            <li data-list="checked">Three</li>
          </ol>
        `,
      );
      expect(editor.getHTML(2, 20)).toEqualHTML(`
        <ul>
          <li data-list="checked">e</li>
          <li data-list="checked">Two
            <ul>
              <li data-list="unchecked">Alpha
                <ul>
                  <li data-list="checked">I</li>
                  <li data-list="checked">II</li>
                </ul>
              </li>
            </ul>
          </li>
          <li data-list="checked">Thr</li>
        </ul>
      `);
    });

    test('partial list', () => {
      const editor = createEditor(
        `
        <ol>
          <li data-list="ordered">1111</li>
          <li data-list="ordered" class="lxt-indent-1">AAAA</li>
          <li data-list="ordered" class="lxt-indent-2">IIII</li>
          <li data-list="ordered" class="lxt-indent-1">BBBB</li>
          <li data-list="ordered">2222</li>
        </ol>
        `,
      );
      expect(editor.getHTML(12, 12)).toEqualHTML(`
        <ol>
          <li>
            <ol>
              <li>
                <ol>
                  <li>II</li>
                </ol>
              </li>
              <li>BBBB</li>
            </ol>
          </li>
          <li>2222</li>
        </ol>
      `);
    });

    test('text within tag', () => {
      const editor = createEditor('<p><strong>a</strong></p>');
      expect(editor.getHTML(0, 1)).toEqual('<strong>a</strong>');
    });

    test('escape html', () => {
      const editor = createEditor('<p><br></p>');
      editor.insertText(0, '<b>Test</b>');
      expect(editor.getHTML(0, 11)).toEqual('&lt;b&gt;Test&lt;/b&gt;');
    });

    test('multiline code', () => {
      const editor = createEditor(
        '<p><br></p><p>0123</p><p><br></p><p><br></p><p>4567</p><p><br></p>',
      );
      const length = editor.scroll.length();
      editor.formatLine(0, length, { 'code-block': 'javascript' });

      expect(editor.getHTML(0, length)).toEqual(
        '<pre>\n\n0123\n\n\n4567\n\n</pre>',
      );
      expect(editor.getHTML(1, 7)).toEqual('<pre>\n0123\n\n\n\n</pre>');
      expect(editor.getHTML(2, 7)).toEqual('<pre>\n123\n\n\n4\n</pre>');
      expect(editor.getHTML(5, 7)).toEqual('<pre>\n\n\n\n4567\n</pre>');
    });
  });
});
