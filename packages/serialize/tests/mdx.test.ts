import { describe, expect, test } from 'vitest';
import ChangeSet from 'lextrix-change';
import {
  MdxComponentRegistry,
  changeSetToMdx,
  mdxSerializer,
  mdxToChangeSet,
  parseMdxComponent,
  splitMdxSegments,
} from 'lextrix-serialize';

describe('mdx serializer', () => {
  test('parses MDX components as preserved blocks', () => {
    const source = '# Hello\n\n<Alert>Warning</Alert>\n\nWorld';
    const delta = mdxSerializer().import(source);

    expect(delta.ops).toEqual([
      { insert: 'Hello' },
      { insert: '\n', attributes: { header: 1 } },
      { insert: '<Alert>Warning</Alert>' },
      { insert: '\n', attributes: { 'mdx-component': 'Alert' } },
      { insert: 'World' },
      { insert: '\n' },
    ]);
  });

  test('exports MDX components', () => {
    const delta = new ChangeSet()
      .insert('<MyCustomComponent />')
      .insert('\n', { 'mdx-component': 'MyCustomComponent' });
    expect(changeSetToMdx(delta)).toBe('<MyCustomComponent />');
  });

  test('parseMdxComponent handles self-closing tags', () => {
    const node = parseMdxComponent('<MyCustomComponent />');
    expect(node).toEqual({
      tag: 'MyCustomComponent',
      props: {},
      children: '',
      selfClosing: true,
      raw: '<MyCustomComponent />',
    });
  });

  test('splitMdxSegments separates markdown and components', () => {
    const segments = splitMdxSegments('Text\n<Alert>Hi</Alert>\nMore');
    expect(segments).toHaveLength(3);
    expect(segments[0].type).toBe('markdown');
    expect(segments[1].type).toBe('component');
    expect(segments[1].component?.tag).toBe('Alert');
    expect(segments[2].type).toBe('markdown');
  });

  test('custom component handler extension point', () => {
    const registry = new MdxComponentRegistry();
    registry.register({
      tag: 'Alert',
      toChangeSet: (node) =>
        new ChangeSet([
          { insert: node.children, attributes: { blockquote: true } },
          { insert: '\n' },
        ]),
      fromChangeSet: () => '<Alert>exported</Alert>',
    });

    const delta = mdxToChangeSet('<Alert>Warning</Alert>', undefined, registry);
    expect(delta.ops).toEqual([
      { insert: 'Warning', attributes: { blockquote: true } },
      { insert: '\n' },
    ]);

    expect(changeSetToMdx(delta, undefined, registry)).toBe('> Warning');
  });

  test('fromChangeSet invoked for preserved mdx-component blocks', () => {
    const registry = new MdxComponentRegistry();
    registry.register({
      tag: 'Alert',
      fromChangeSet: () => '<Alert>from handler</Alert>',
    });

    const delta = new ChangeSet()
      .insert('<Alert>Hi</Alert>')
      .insert('\n', { 'mdx-component': 'Alert' });

    expect(changeSetToMdx(delta, undefined, registry)).toBe(
      '<Alert>from handler</Alert>',
    );
  });

  test('registerMdxComponent adds to global registry', () => {
    const registry = new MdxComponentRegistry();
    registry.register({
      tag: 'TestComponent',
      toChangeSet: () => new ChangeSet([{ insert: 'test' }, { insert: '\n' }]),
    });
    const delta = mdxSerializer({ componentRegistry: registry }).import(
      '<TestComponent />',
    );
    expect(delta.ops).toEqual([{ insert: 'test' }, { insert: '\n' }]);
  });

  test('strips frontmatter', () => {
    const source = '---\ntitle: Hello\n---\n\n# Content';
    const delta = mdxSerializer().import(source);
    expect(delta.ops).toEqual([
      { insert: 'Content' },
      { insert: '\n', attributes: { header: 1 } },
    ]);
  });
});
