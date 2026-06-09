# Lextrix

Rich-text editor for the web. MIT licensed.

Built by **[Reetesh Kumar](https://iamreetesh.com/me)** · [iamreetesh.com](https://iamreetesh.com) · [Playground](https://iamreetesh.com/lextrix) · [Documentation](https://iamreetesh.com/docs)

Monorepo packages: `lextrix-change`, `lextrix-dom`, `lextrix-core`, `lextrix-formats`, `lextrix-modules`, `lextrix-serialize`, `lextrix-ui`, `lextrix-themes`. The `lextrix` npm package bundles them.

[Playground](https://iamreetesh.com/lextrix) · [Site docs](https://iamreetesh.com/docs) · [GitHub docs](./docs/README.md) · [Quick start](./docs/getting-started/quick-start.md) · [Issues](https://github.com/rishureetesh/lextrix/issues)

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
editor.importContent('# Title\n\n**bold**', 'markdown');
const mdx = editor.exportContent('mdx');
```

Native editor tables cannot export to Markdown/MDX — throws `SerializationError`. Use `exportContent('html')`. See [serialization.md](./docs/guides/serialization.md).

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
