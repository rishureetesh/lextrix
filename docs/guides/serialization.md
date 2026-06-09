# Serialization

Import and export editor content as HTML, Markdown, MDX, or JSON. All formats go through **ChangeSet** — the same model as `getContents()`, clipboard, and OT.

There is no direct HTML ↔ Markdown ↔ MDX conversion. To change formats, import into the editor (or `SerializerHost`) and export the target format.

## Quick start

```typescript
import Lextrix from 'lextrix';

const editor = new Lextrix('#editor');

const html = editor.exportContent('html');
const md = editor.exportContent('markdown');

editor.importContent('<p>Hello <strong>world</strong></p>', 'html');
editor.importContent('# Title\n\nParagraph.', 'markdown');
```

Use `importContent` / `exportContent` instead of `import` / `export`. `Lextrix.import()` is the module loader and is unrelated.

## Limitations

| Topic | Behavior |
|-------|----------|
| Native editor tables → Markdown/MDX | Throws `SerializationError` (`TABLE_EXPORT_UNSUPPORTED`). Use `exportContent('html')`. |
| GFM tables (Markdown import) | Simple tables round-trip. No colspan, rowspan, or merged cells. |
| HTML round-trip | Partial. Export uses `getSemanticHTML()`; re-import normalizes DOM structure. |
| Markdown dialect | Subset only — not full CommonMark/GFM. |
| MDX components | Experimental. JSX preserved as text unless you register handlers. |
| Ordered lists | Numbering is sequential (`1.`, `2.`, …); nested lists restart at `1.` per indent level |
| Combined bold+italic | May export as bold only |
| Align, color, font | HTML/JSON only — not exported to Markdown/MDX |
| Video embed | Markdown/MDX export as `[video](url)` |
| Horizontal rule | Literal `---` paragraph exports as `\-\-\-` so it does not become a thematic break |
| Inline escaping | Only `\*`, `` \` ``, `\_`, `\[`, `\]` — not `.` or `!` at end of sentences |

### MDX components (experimental)

`registerMdxComponent` is not stable API.

- Unknown JSX is stored as raw text with an `mdx-component` block attribute
- Frontmatter and `import`/`export` lines are stripped on import
- Parsing uses regex, not an AST — nested or complex JSX will miss edge cases
- No component embed blot, in-editor preview, or JSX runtime
- Use MDX export for CMS storage; register `toChangeSet` / `fromChangeSet` only for components you control and test

## API

### Editor

```typescript
editor.exportContent(format: string): string
editor.exportContent({ format, index?, length? }): string

editor.importContent(content: string, format: string, source?: EmitterSource): void

editor.listExportFormats(): string[]
```

`export()` and `import()` are aliases. Prefer `exportContent` / `importContent` in application code.

### Global registration

```typescript
import { registerSerializer, registerMdxComponent } from 'lextrix';
import ChangeSet from 'lextrix-change';

registerSerializer({
  format: 'plain',
  import: (text) => new ChangeSet([{ insert: text }, { insert: '\n' }]),
  export: (delta) => delta.getText(),
});
```

Call `registerSerializer` before creating editors. Serializers registered globally are merged into each editor unless `serializers: false`.

### Headless (`lextrix-serialize`)

Monorepo / contributors only — the npm package bundles serialization into `lextrix`; use `editor.importContent` / `exportContent` in apps.

```typescript
import {
  SerializerHost,
  createSerializerRegistry,
  markdownSerializer,
} from 'lextrix-serialize';

const host = new SerializerHost(createSerializerRegistry([markdownSerializer()]));

const delta = host.parse('# Hello', 'markdown');
const md = host.stringify(delta, 'markdown');
```

`host.export()` needs a bound editor adapter. For headless export, use `host.stringify()`.

### `LextrixOptions.serializers`

| Value | Effect |
|-------|--------|
| omitted or `true` | Built-in formats (json, html, markdown, mdx) plus globals |
| `ContentSerializer[]` | Listed serializers plus globals |
| `false` | No serializers, including globals |

## Examples

### Partial export

```typescript
const slice = editor.exportContent({ format: 'html', index: 0, length: 100 });
```

### React / Next.js

Use a client-only **wrapper** — see [Framework integration](./frameworks.md) and [DOM mounting](./dom-mounting.md). Minimal pattern:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

export default function Editor() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const mount = document.createElement('div');
    wrapper.appendChild(mount);

    const editor = new Lextrix(mount, { theme: 'snow' });
    if (initialMdx) editor.importContent(initialMdx, 'mdx');

    const onChange = () => save(editor.exportContent('mdx'));
    editor.on('text-change', onChange);
    return () => {
      editor.off('text-change', onChange);
      wrapper.replaceChildren();
    };
  }, []);

  return <div ref={wrapperRef} />;
}
```

In Next.js App Router, also load the component with `dynamic(..., { ssr: false })`.

### Migration from older patterns

| Before | After |
|--------|-------|
| `editor.getSemanticHTML()` | `editor.exportContent('html')` |
| `clipboard.convert({ html })` + `setContents` | `editor.importContent(html, 'html')` |
| `JSON.stringify(editor.getContents().ops)` | `editor.exportContent('json')` |

## How it works

```
HTML / Markdown / MDX / JSON
        ↓ import
    ChangeSet
        ↓ export
HTML / Markdown / MDX / JSON
```

| Package | Role |
|---------|------|
| `lextrix-change` | ChangeSet ops |
| `lextrix-modules/html-import` | HTML string → ChangeSet (shared with clipboard paste) |
| `lextrix-core` | Editor API, HTML export via blot tree |
| `lextrix-serialize` | Markdown, MDX, JSON ↔ ChangeSet; registry; host |

`lextrix-serialize` does not depend on `lextrix-core`. HTML export is DOM-backed, not derived purely from ChangeSet.

## Testing

```bash
npm run test -w lextrix-serialize
npm run test -w lextrix-core
npm run test:unit -w lextrix
```

Tests: `packages/serialize/tests/`, `packages/lextrix/test/unit/core/serialization.spec.ts`, `packages/lextrix/test/e2e/serialization.spec.ts`.
