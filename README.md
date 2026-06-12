# Lextrix

Rich-text editor for the web. MIT licensed.

Built by **[Reetesh Kumar](https://iamreetesh.com/me)** · [iamreetesh.com](https://iamreetesh.com) · [Playground](https://iamreetesh.com/lextrix) · [Documentation](https://iamreetesh.com/docs)

[Playground](https://iamreetesh.com/lextrix) · [GitHub docs](./docs/README.md) · [Evaluation guide](./docs/getting-started/evaluation.md) · [Quick start](./docs/getting-started/quick-start.md) · [Issues](https://github.com/rishureetesh/lextrix/issues)

---

## Evaluate in 5 minutes

1. **[Try the playground](https://iamreetesh.com/lextrix)** — no install
2. **`npm install lextrix`** — see [Install](#install) below
3. **Create an editor** — import CSS, mount on a div, pass toolbar options
4. **Load content** — `setContents()` or `importContent()`
5. **Export content** — `exportContent('markdown')` or `exportContent('html')`

Install only **`lextrix`**. The other packages listed under [Packages](#packages) are for contributors and internal architecture — you do not need them to use the editor.

**Using React or Next.js?** Start with the [Frameworks guide](./docs/guides/frameworks.md).

Full walkthrough: [evaluation.md](./docs/getting-started/evaluation.md)

**Runnable examples:** [Vanilla Vite](./examples/vite-vanilla) · [React Vite](./examples/vite-react)

---

## Install

```bash
npm install lextrix
```

```javascript
import Lextrix from 'lextrix';
import 'lextrix/snow.css';
```

Optional: [highlight.js](https://highlightjs.org/) for syntax highlighting, [KaTeX](https://katex.org/) for formulas.

---

## Quick start

```html
<div id="editor"></div>
```

```javascript
const editor = new Lextrix('#editor', {
  theme: 'snow',
  placeholder: 'Start writing…',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ header: [1, 2, false] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean'],
    ],
    imageResize: true,
  },
});

editor.setContents([
  { insert: 'Hello Lextrix\n', attributes: { header: 1 } },
  { insert: 'Edit rich text with themes, modules, and ChangeSets.\n' },
]);

editor.on('text-change', (changeSet, oldChangeSet, source) => {
  if (source === 'user') {
    save(editor.getContents());
  }
});
```

More: [cookbook](./docs/guides/cookbook.md) · [DOM mounting](./docs/guides/dom-mounting.md) · [React / Next.js](./docs/guides/frameworks.md)

### Serialization

```javascript
const markdown = '# Title\n\n**bold** text';

editor.importContent(markdown, 'markdown');

const warnings = editor.getExportWarnings('markdown');
// Non-empty when export would be lossy or blocked (e.g. native editor tables).
// Does not throw — use this to warn users before calling exportContent.
for (const w of warnings) {
  console.warn(w.message);
}

const output = editor.exportContent('markdown');
```

`getExportWarnings` only applies to **`markdown`** and **`mdx`**. It reports lossy formatting (color, align, font) and **blocks** native editor tables. **`exportContent('markdown')` throws `SerializationError`** when a native table is present — use `exportContent('html')` for table content. See [serialization.md](./docs/guides/serialization.md) for the full limitations list.

```javascript
const html = editor.exportContent('html'); // always available for editor content
```

---

## What you get

| Area | Notes |
|------|-------|
| Themes | snow, bubble, slate, dawn (CSS included) |
| Modules | clipboard, keyboard, history, toolbar, table, syntax, image resize |
| Formats | bold, lists, headers, links, code blocks, tables, images, video, formulas |
| ChangeSet | JSON ops with compose, diff, transform, invert |
| Serialization | HTML, Markdown, MDX, JSON via ChangeSet |

---

## Packages

The **`lextrix`** npm package bundles everything below. You only install `lextrix` unless you are contributing to the monorepo.

| Package | Role |
|---------|------|
| `lextrix` | Published bundle (ESM + UMD + CSS) |
| `lextrix-change` | ChangeSet / OT |
| `lextrix-dom` | Blots, registry, DOM sync |
| `lextrix-core` | Editor shell, selection |
| `lextrix-formats` | Built-in formats |
| `lextrix-modules` | Clipboard, keyboard, toolbar, … |
| `lextrix-serialize` | Headless import/export |
| `lextrix-ui` | Toolbar widgets |
| `lextrix-themes` | Theme CSS |

Architecture: [overview.md](./docs/architecture/overview.md)

---

## Extending

**React / Next.js:** Lextrix is a class mounted with `useEffect` — not a JSX component. See [frameworks.md](./docs/guides/frameworks.md).

Register formats from npm:

```javascript
import Lextrix, { lxrPath } from 'lextrix';

Lextrix.register({ [lxrPath.format('my-format')]: MyFormatBlot });
```

Format helpers (`defineInlineTagFormat`, …) require the monorepo. Guides: [formats](./docs/guides/formats.md) · [modules](./docs/guides/modules.md) · [configuration](./docs/guides/configuration.md)

---

## Development

```bash
git clone https://github.com/rishureetesh/lextrix.git
cd lextrix
npm install
npm run build
npm run dev          # full playground at http://localhost:5173 (packages/demo)
npm test
```

Contributing: [.github/CONTRIBUTING.md](./.github/CONTRIBUTING.md) · [.github/DEVELOPMENT.md](./.github/DEVELOPMENT.md)

---

## License

MIT © [Reetesh Kumar](https://iamreetesh.com/me) · [iamreetesh.com](https://iamreetesh.com). See [LICENSE](./LICENSE). Runtime dependencies: [NOTICE.md](./NOTICE.md).
