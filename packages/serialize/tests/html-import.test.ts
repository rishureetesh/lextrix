/**
 * @vitest-environment jsdom
 */
import { describe, expect, test } from 'vitest';
import { Registry } from 'lextrix-dom';
import Block from 'lextrix-core/blots/block.js';
import Break from 'lextrix-core/blots/break.js';
import Cursor from 'lextrix-core/blots/cursor.js';
import Inline from 'lextrix-core/blots/inline.js';
import Scroll from 'lextrix-core/blots/scroll.js';
import TextBlot from 'lextrix-core/blots/text.js';
import Bold from 'lextrix-formats/formats/bold.js';
import Header from 'lextrix-formats/formats/header.js';
import { ListContainer, default as List } from 'lextrix-formats/formats/list.js';
import Emitter from 'lextrix-core/core/emitter.js';
import { importHtml } from 'lextrix-modules/html-import';

function createScroll(html = '<p><br></p>') {
  const registry = new Registry();
  [Block, Break, Cursor, Inline, Scroll, TextBlot, Bold, Header, ListContainer, List].forEach(
    (blot) => registry.register(blot),
  );
  const root = document.createElement('div');
  root.className = 'lxr-editor';
  root.innerHTML = html;
  document.body.appendChild(root);
  return new Scroll(registry, root, { emitter: new Emitter() });
}

describe('shared HTML importer (headless)', () => {
  test('paragraph HTML → ChangeSet contains text', () => {
    const scroll = createScroll();
    const delta = importHtml('<p>Hello world</p>', scroll);
    const text = delta
      .filter((op) => typeof op.insert === 'string')
      .map((op) => op.insert)
      .join('');
    expect(text).toContain('Hello world');
    expect(delta.length()).toBeGreaterThan(0);
  });

  test('heading HTML → ChangeSet applies header attribute', () => {
    const scroll = createScroll();
    const delta = importHtml('<h2>Title</h2>', scroll, {
      stripTrailingNewline: false,
    });
    const hasHeader = delta.ops.some(
      (op) => op.attributes?.header === 2,
    );
    expect(hasHeader).toBe(true);
    expect(
      delta
        .filter((op) => typeof op.insert === 'string')
        .map((op) => op.insert)
        .join(''),
    ).toContain('Title');
  });

  test('bold HTML → ChangeSet', () => {
    const scroll = createScroll();
    const delta = importHtml('<p><strong>bold</strong></p>', scroll);
    expect(delta.ops).toEqual(
      expect.arrayContaining([{ insert: 'bold', attributes: { bold: true } }]),
    );
  });

  test('clipboard and importHtml share matcher pipeline', () => {
    const scroll = createScroll();
    const a = importHtml('<p>Same</p>', scroll);
    const b = importHtml('<p>Same</p>', scroll);
    expect(a.ops).toEqual(b.ops);
  });
});
