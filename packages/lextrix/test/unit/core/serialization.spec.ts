import '../../../src/lextrix.js';
import ChangeSet from 'lextrix-change';
import { describe, expect, test } from 'vitest';
import Lextrix from 'lextrix-core/core/lextrix.js';
import {
  htmlSerializer,
  markdownSerializer,
  mdxSerializer,
} from 'lextrix-serialize';
import { normalizeHTML } from '../__helpers__/utils.js';

const createEditor = (html = '<p><br></p>') => {
  const container = document.createElement('div');
  container.innerHTML = normalizeHTML(html);
  document.body.appendChild(container);
  return new Lextrix(container);
};

describe('Lextrix serialization', () => {
  test('export/import markdown round-trip', () => {
    const editor = createEditor('<p>Hello <strong>world</strong></p>');
    const md = editor.export('markdown');
    expect(md).toContain('**world**');

    editor.import('# Imported\n\nNew **bold** text', 'markdown');
    const exported = editor.export('markdown');
    expect(exported).toContain('# Imported');
    expect(exported).toContain('**bold**');
  });

  test('export/import HTML', () => {
    const editor = createEditor('<p>Hello <strong>world</strong></p>');
    const html = editor.export('html');
    expect(html).toContain('<strong>world</strong>');

    editor.import('<p>Replaced</p>', 'html');
    expect(editor.getSemanticHTML()).toEqualHTML('<p>Replaced</p>');
  });

  test('export/import MDX preserves components', () => {
    const editor = createEditor();
    editor.import('# Hi\n\n<Alert>Warn</Alert>', 'mdx');
    const mdx = editor.export('mdx');
    expect(mdx).toContain('<Alert>Warn</Alert>');
  });

  test('export JSON matches getContents shape', () => {
    const editor = createEditor('<p>Hello</p>');
    const json = editor.export('json');
    const ops = JSON.parse(json);
    expect(ops).toEqual(editor.getContents().ops);
  });

  test('range HTML export differs from full document', () => {
    const editor = createEditor('<p>One</p><p>Two</p><p>Three</p>');
    const full = editor.export('html');
    const slice = editor.export({ format: 'html', index: 0, length: 5 });
    expect(slice.length).toBeLessThan(full.length);
    expect(slice).not.toBe(full);
  });

  test('importContent alias works', () => {
    const editor = createEditor();
    editor.importContent('Plain paragraph', 'markdown');
    expect(editor.getText()).toContain('Plain paragraph');
  });

  test('listExportFormats returns built-in formats', () => {
    const editor = createEditor();
    expect(editor.listExportFormats()).toEqual(
      expect.arrayContaining(['html', 'markdown', 'mdx', 'json']),
    );
  });

  test('serializers: false disables formats', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new Lextrix(container, { serializers: false });
    expect(editor.listExportFormats()).toEqual([]);
    expect(() => editor.export('markdown')).toThrow(/No serializer registered/);
  });

  test('custom serializers option', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new Lextrix(container, {
      serializers: [markdownSerializer(), htmlSerializer()],
    });
    expect(editor.listExportFormats()).toEqual(['markdown', 'html']);
    expect(() => editor.export('mdx')).toThrow(/No serializer registered/);
  });

  test('mdx resolves markdown via extends', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const editor = new Lextrix(container, {
      serializers: [mdxSerializer()],
    });
    editor.import('# Only MDX registered', 'markdown');
    expect(editor.export('markdown')).toContain('# Only MDX registered');
  });

  test('setContents then export json round-trip', () => {
    const editor = createEditor();
    const delta = new ChangeSet()
      .insert('Round trip')
      .insert('\n', { header: 2 });
    editor.setContents(delta);
    const json = editor.export('json');
    editor.import(json, 'json');
    expect(editor.getContents().ops).toEqual(delta.ops);
  });

  test('HTML export then import preserves semantic content', () => {
    const editor = createEditor('<p>Hello <strong>world</strong></p>');
    const html = editor.export('html');
    editor.import(html, 'html');
    expect(editor.getSemanticHTML()).toContain('<strong>world</strong>');
    expect(editor.getText()).toContain('Hello world');
  });

  test('ordered list in one ol exports 1. 2. numbering', () => {
    const editor = createEditor(`
      <ol>
        <li data-list="ordered">cgnfgn</li>
        <li data-list="ordered">bdfgb</li>
      </ol>
    `);
    const md = editor.export('markdown');
    expect(md).toContain('1. cgnfgn');
    expect(md).toContain('2. bdfgb');
    expect(md).not.toMatch(/\n1\. bdfgb/);
  });

  test('ordered lists separated by empty line still number sequentially', () => {
    const editor = createEditor(`
      <ol><li data-list="ordered">First</li></ol>
      <p><br></p>
      <ol><li data-list="ordered">Second</li></ol>
    `);
    const md = editor.export('markdown');
    expect(md).toContain('1. First');
    expect(md).toContain('2. Second');
  });

  test('markdown ChangeSet round-trip via editor', () => {
    const editor = createEditor();
    editor.import('# Heading\n\n- Item A\n- Item B', 'markdown');
    const md = editor.export('markdown');
    editor.import(md, 'markdown');
    expect(editor.export('markdown')).toContain('# Heading');
    expect(editor.export('markdown')).toContain('- Item A');
  });

  test('selection range markdown export', () => {
    const editor = createEditor('<p>Alpha</p><p>Beta</p>');
    const slice = editor.export({ format: 'markdown', index: 6, length: 4 });
    expect(slice).toContain('Beta');
    expect(slice).not.toContain('Alpha');
  });

  test('clipboard HTML path matches import serializer', () => {
    const editor = createEditor();
    const html = '<p>Clip <em>test</em></p>';
    const delta = editor.clipboard.convert({ html, text: 'Clip test' });
    editor.setContents(delta);
    const exported = editor.export('html');
    expect(exported).toContain('<em>test</em>');
  });
});
