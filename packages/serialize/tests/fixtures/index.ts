import ChangeSet from 'lextrix-change';

/** Canonical fixture IDs for regression testing. */
export type FixtureId =
  | 'paragraph'
  | 'heading'
  | 'bold-italic'
  | 'blockquote'
  | 'bullet-list'
  | 'ordered-list'
  | 'nested-list'
  | 'code-block'
  | 'link'
  | 'image'
  | 'mdx-component'
  | 'nested-inline';

export interface SerializationFixture {
  id: FixtureId;
  changeSet: ChangeSet;
  html: string;
  markdown: string;
  mdx: string;
  json: string;
  /** Intentionally lossy when round-tripping through this format. */
  lossy?: Array<'html' | 'markdown' | 'mdx' | 'json'>;
}

export const FIXTURES: SerializationFixture[] = [
  {
    id: 'paragraph',
    changeSet: new ChangeSet([{ insert: 'Hello world' }, { insert: '\n' }]),
    html: '<p>Hello world</p>',
    markdown: 'Hello world',
    mdx: 'Hello world',
    json: JSON.stringify(
      [{ insert: 'Hello world' }, { insert: '\n' }],
      null,
      2,
    ),
  },
  {
    id: 'heading',
    changeSet: new ChangeSet([
      { insert: 'Title' },
      { insert: '\n', attributes: { header: 2 } },
    ]),
    html: '<h2>Title</h2>',
    markdown: '## Title',
    mdx: '## Title',
    json: JSON.stringify(
      [{ insert: 'Title' }, { insert: '\n', attributes: { header: 2 } }],
      null,
      2,
    ),
  },
  {
    id: 'bold-italic',
    changeSet: new ChangeSet([
      {
        insert: 'Bold and italic',
        attributes: { bold: true, italic: true },
      },
      { insert: '\n' },
    ]),
    html: '<p><strong><em>Bold and italic</em></strong></p>',
    markdown: '**Bold and italic**',
    mdx: '**Bold and italic**',
    json: JSON.stringify(
      [
        { insert: 'Bold and italic', attributes: { bold: true, italic: true } },
        { insert: '\n' },
      ],
      null,
      2,
    ),
    lossy: ['markdown', 'mdx'],
  },
  {
    id: 'blockquote',
    changeSet: new ChangeSet([
      { insert: 'Quoted text' },
      { insert: '\n', attributes: { blockquote: true } },
    ]),
    html: '<blockquote>Quoted text</blockquote>',
    markdown: '> Quoted text',
    mdx: '> Quoted text',
    json: JSON.stringify(
      [
        { insert: 'Quoted text' },
        { insert: '\n', attributes: { blockquote: true } },
      ],
      null,
      2,
    ),
  },
  {
    id: 'bullet-list',
    changeSet: new ChangeSet([
      { insert: 'Item A' },
      { insert: '\n', attributes: { list: 'bullet' } },
      { insert: 'Item B' },
      { insert: '\n', attributes: { list: 'bullet' } },
    ]),
    html: '<ol><li data-list="bullet">Item A</li><li data-list="bullet">Item B</li></ol>',
    markdown: '- Item A\n- Item B',
    mdx: '- Item A\n- Item B',
    json: JSON.stringify(
      [
        { insert: 'Item A' },
        { insert: '\n', attributes: { list: 'bullet' } },
        { insert: 'Item B' },
        { insert: '\n', attributes: { list: 'bullet' } },
      ],
      null,
      2,
    ),
    lossy: ['html'],
  },
  {
    id: 'nested-list',
    changeSet: new ChangeSet([
      { insert: 'Parent' },
      { insert: '\n', attributes: { list: 'bullet' } },
      { insert: 'Child' },
      { insert: '\n', attributes: { list: 'bullet', indent: 1 } },
    ]),
    html: '<ol><li data-list="bullet">Parent</li><li data-list="bullet" class="lxr-indent-1">Child</li></ol>',
    markdown: '- Parent\n  - Child',
    mdx: '- Parent\n  - Child',
    json: JSON.stringify(
      [
        { insert: 'Parent' },
        { insert: '\n', attributes: { list: 'bullet' } },
        { insert: 'Child' },
        { insert: '\n', attributes: { list: 'bullet', indent: 1 } },
      ],
      null,
      2,
    ),
    lossy: ['html'],
  },
  {
    id: 'ordered-list',
    changeSet: new ChangeSet([
      { insert: 'First' },
      { insert: '\n', attributes: { list: 'ordered' } },
      { insert: 'Second' },
      { insert: '\n', attributes: { list: 'ordered' } },
    ]),
    html: '<ol><li data-list="ordered">First</li><li data-list="ordered">Second</li></ol>',
    markdown: '1. First\n\n1. Second',
    mdx: '1. First\n\n1. Second',
    json: JSON.stringify(
      [
        { insert: 'First' },
        { insert: '\n', attributes: { list: 'ordered' } },
        { insert: 'Second' },
        { insert: '\n', attributes: { list: 'ordered' } },
      ],
      null,
      2,
    ),
    lossy: ['html', 'markdown'],
  },
  {
    id: 'code-block',
    changeSet: new ChangeSet([
      { insert: 'const x = 1;' },
      { insert: '\n', attributes: { 'code-block': 'javascript' } },
    ]),
    html: '<pre>const x = 1;</pre>',
    markdown: '```javascript\nconst x = 1;\n```',
    mdx: '```javascript\nconst x = 1;\n```',
    json: JSON.stringify(
      [
        { insert: 'const x = 1;' },
        { insert: '\n', attributes: { 'code-block': 'javascript' } },
      ],
      null,
      2,
    ),
    lossy: ['html'],
  },
  {
    id: 'link',
    changeSet: new ChangeSet([
      { insert: 'Click here', attributes: { link: 'https://example.com' } },
      { insert: '\n' },
    ]),
    html: '<p><a href="https://example.com">Click here</a></p>',
    markdown: '[Click here](https://example.com)',
    mdx: '[Click here](https://example.com)',
    json: JSON.stringify(
      [
        { insert: 'Click here', attributes: { link: 'https://example.com' } },
        { insert: '\n' },
      ],
      null,
      2,
    ),
  },
  {
    id: 'image',
    changeSet: new ChangeSet([
      { insert: { image: 'https://example.com/a.png' }, attributes: { alt: 'Alt' } },
      { insert: '\n' },
    ]),
    html: '<p><img src="https://example.com/a.png" alt="Alt"></p>',
    markdown: '![Alt](https://example.com/a.png)',
    mdx: '![Alt](https://example.com/a.png)',
    json: JSON.stringify(
      [
        { insert: { image: 'https://example.com/a.png' }, attributes: { alt: 'Alt' } },
        { insert: '\n' },
      ],
      null,
      2,
    ),
    lossy: ['html'],
  },
  {
    id: 'mdx-component',
    changeSet: new ChangeSet([
      { insert: '<Alert>Warning</Alert>' },
      { insert: '\n', attributes: { 'mdx-component': 'Alert' } },
    ]),
    html: '<p>&lt;Alert&gt;Warning&lt;/Alert&gt;</p>',
    markdown: '<Alert>Warning</Alert>',
    mdx: '<Alert>Warning</Alert>',
    json: JSON.stringify(
      [
        { insert: '<Alert>Warning</Alert>' },
        { insert: '\n', attributes: { 'mdx-component': 'Alert' } },
      ],
      null,
      2,
    ),
    lossy: ['html', 'markdown'],
  },
  {
    id: 'nested-inline',
    changeSet: new ChangeSet([
      { insert: 'Start ' },
      { insert: 'bold', attributes: { bold: true } },
      { insert: ' end' },
      { insert: '\n' },
    ]),
    html: '<p>Start <strong>bold</strong> end</p>',
    markdown: 'Start **bold** end',
    mdx: 'Start **bold** end',
    json: JSON.stringify(
      [
        { insert: 'Start ' },
        { insert: 'bold', attributes: { bold: true } },
        { insert: ' end' },
        { insert: '\n' },
      ],
      null,
      2,
    ),
  },
];

export function getFixture(id: FixtureId): SerializationFixture {
  const fixture = FIXTURES.find((f) => f.id === id);
  if (!fixture) throw new Error(`Unknown fixture: ${id}`);
  return fixture;
}
