# Lextrix

**Modern rich-text editing engine for web applications.**

Modular, framework-agnostic, and MIT licensed. Ship a full editor with themes and toolbar modules, or compose custom builds from `lextrix-change`, `lextrix-dom`, `lextrix-core`, and `lextrix-formats`.

[Documentation](./docs/README.md) · [Quick start](./docs/getting-started/quick-start.md) · [Architecture](./docs/architecture/overview.md) · [Issues](https://github.com/rishureetesh/lextrix/issues)

---

## Why Lextrix

- **Modular** — Use the full `lextrix` bundle or assemble only the packages you need.
- **Extensible** — Register custom formats, modules, and embeds through a central registry.
- **Framework agnostic** — Works with React, Vue, Angular, Svelte, or vanilla JavaScript.
- **Plugin friendly** — Clipboard, keyboard, history, toolbar, tables, syntax, and image resize as modules.
- **TypeScript-first** — Written in TypeScript with a typed monorepo and stable public APIs.
- **Predictable changes** — Document updates flow through **ChangeSets** with compose, diff, transform, and invert.

---

## Features

- **Themes** — Snow, Bubble, Slate, and Dawn (CSS included)
- **Toolbar** — Configurable formatting controls or your own DOM toolbar
- **Rich formats** — Bold, lists, headers, links, code blocks, tables, images, video, formulas
- **Clipboard** — HTML paste normalization (Word, Google Docs, custom matchers)
- **Keyboard** — Shortcuts for lists, headers, links, and custom bindings
- **History** — Undo / redo with configurable merge delay
- **Image resize** — Drag handles on selected images
- **Syntax highlighting** — Code blocks with highlight.js
- **ChangeSet API** — JSON operations compatible with common OT conventions
- **Custom builds** — Register blots, formats, modules, UI, and themes à la carte

---

## Installation

```bash
npm install lextrix
```

```bash
pnpm add lextrix
```

```bash
yarn add lextrix
```

```bash
bun add lextrix
```

Peer dependencies (optional): [highlight.js](https://highlightjs.org/) for syntax, [KaTeX](https://katex.org/) for formulas.

---

## Quick start

```html
<div id="editor"></div>
```

```javascript
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

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
```

Listen for changes:

```javascript
editor.on('text-change', (changeSet, oldChangeSet, source) => {
  if (source === 'user') {
    save(editor.getContents());
  }
});
```

More examples: [docs/getting-started/quick-start.md](./docs/getting-started/quick-start.md)

---

## Architecture overview

Lextrix separates **change processing**, **document structure**, **DOM synchronization**, **formatting**, **selection**, and **plugins** into dedicated packages.

```text
User Input → Selection → Commands → Change Engine → Document Model → DOM Sync → Browser
```

Read the full guide: **[Architecture overview](./docs/architecture/overview.md)**

| Package | Role |
|---------|------|
| `lextrix` | Published bundle (UMD + CSS) |
| `lextrix-change` | ChangeSet / operational transform |
| `lextrix-dom` | Blots, registry, DOM sync |
| `lextrix-core` | Editor shell, selection |
| `lextrix-formats` | Built-in formats |
| `lextrix-modules` | Clipboard, keyboard, toolbar, … |
| `lextrix-ui` | Toolbar widgets |
| `lextrix-themes` | Snow, bubble, slate, dawn |

---

## Plugin system

Modules extend the editor through **PluginHost** — clipboard, keyboard, history, uploader, toolbar, syntax, tables, and custom plugins.

```javascript
import { lxrPath } from 'lextrix-core/registry-paths.js';

Lextrix.register({ [lxrPath.module('wordCount')]: WordCountModule });

new Lextrix('#editor', {
  theme: 'snow',
  modules: { wordCount: true },
});
```

Guide: [Plugin author guide](./docs/guides/plugins.md) · [Modules](./docs/guides/modules.md)

---

## Formats

Register inline, block, and embed formats with helpers and `Lextrix.register()`:

```javascript
import { lxrPath } from 'lextrix-core/registry-paths.js';
import { defineInlineTagFormat } from 'lextrix-formats/inline-format.js';

const Highlight = defineInlineTagFormat({ blotName: 'highlight', tagName: 'MARK' });
Lextrix.register({ [lxrPath.format('highlight')]: Highlight });
```

Guides: [Formats](./docs/guides/formats.md) · [Custom embeds](./docs/guides/custom-embeds.md) · [Registry](./docs/guides/registry.md)

---

## Examples

### Bubble theme (floating toolbar)

```javascript
new Lextrix('#editor', {
  theme: 'bubble',
  modules: {
    toolbar: [['bold', 'italic', 'link'], [{ header: 1 }, { header: 2 }]],
  },
});
```

### Read-only

```javascript
new Lextrix('#editor', { theme: 'snow', readOnly: true });
```

### Custom bundle (advanced)

```javascript
import Lextrix, { registerBlots } from 'lextrix-core';
import { registerFormats } from 'lextrix-formats';
import { registerCoreModules, registerOptionalModules } from 'lextrix-modules';
import { registerUI } from 'lextrix-ui';
import { registerThemes } from 'lextrix-themes';

registerBlots(Lextrix);
registerFormats(Lextrix);
registerCoreModules(Lextrix);
registerOptionalModules(Lextrix);
registerUI(Lextrix);
registerThemes(Lextrix);
```

Run the local demo: `npm run dev` → http://localhost:5173

---

## Documentation

| Topic | Link |
|-------|------|
| **Index** | [docs/README.md](./docs/README.md) |
| **Installation** | [getting-started/installation.md](./docs/getting-started/installation.md) |
| **Configuration** | [guides/configuration.md](./docs/guides/configuration.md) |
| **API reference** | [api/reference.md](./docs/api/reference.md) |
| **ChangeSet / OT** | [guides/change-set.md](./docs/guides/change-set.md) |
| **Architecture** | [architecture/overview.md](./docs/architecture/overview.md) |
| **Plugins** | [guides/plugins.md](./docs/guides/plugins.md) |
| **Formats** | [guides/formats.md](./docs/guides/formats.md) |

---

## Roadmap

- Public **live playground** and hosted demo
- **Framework starter templates** (React, Vue)
- **Published TypeScript types** on npm
- Expanded **plugin cookbook** and embed examples
- **Bundle size** benchmarks in docs
- Optional **collaboration** examples built on ChangeSet transform

---

## Development

```bash
git clone https://github.com/rishureetesh/lextrix.git
cd lextrix
npm install
npm run build
npm run dev          # Vite demo → http://localhost:5173
npm test
```

Contributing: [.github/CONTRIBUTING.md](./.github/CONTRIBUTING.md) · Monorepo guide: [.github/DEVELOPMENT.md](./.github/DEVELOPMENT.md)

Positioning notes: [docs/release/readme-review.md](./docs/release/readme-review.md)

---

## License

MIT © [Reetesh](https://github.com/rishureetesh). See [LICENSE](./LICENSE). Runtime dependencies: [NOTICE.md](./NOTICE.md).
