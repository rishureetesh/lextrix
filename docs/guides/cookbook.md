# Cookbook

Copy-paste recipes for common tasks. Written for application developers integrating the **npm** package.

**Start here if toolbars duplicate or themes break:** [DOM mounting](./dom-mounting.md).

---

## 1. Minimal editor

```html
<div id="wrapper"></div>
```

```javascript
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

const wrapper = document.getElementById('wrapper');
const mount = document.createElement('div');
wrapper.appendChild(mount);

const editor = new Lextrix(mount, {
  theme: 'snow',
  placeholder: 'Write here…',
});

editor.setContents([{ insert: 'Hello\n' }]);
```

---

## 2. Toolbar

```javascript
new Lextrix(mount, {
  theme: 'snow',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ header: [1, 2, 3, false] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean'],
    ],
  },
});
```

Use your own toolbar DOM:

```javascript
modules: { toolbar: '#my-toolbar' }
```

Button names: see [Configuration — Toolbar](./configuration.md#toolbar-buttons).

---

## 3. Save on change

```javascript
editor.on('text-change', (delta, oldDelta, source) => {
  if (source === 'user') {
    const json = editor.getContents();
    localStorage.setItem('draft', JSON.stringify(json));
  }
});
```

`source` is `'user'`, `'api'`, or `'silent'`. Ignore `'api'` if you do not want programmatic updates to trigger saves.

---

## 4. Load saved content

```javascript
const saved = localStorage.getItem('draft');
if (saved) {
  editor.setContents(JSON.parse(saved));
}
```

Or import from Markdown/HTML — [Serialization](./serialization.md).

---

## 5. Read-only display

```javascript
new Lextrix(mount, {
  theme: 'snow',
  readOnly: true,
});
editor.setContents(documentJson);
```

---

## 6. Serialization (Markdown, HTML, MDX, JSON)

```javascript
// Export
const md = editor.exportContent('markdown');
const html = editor.exportContent('html');

// Import (replaces document)
editor.importContent('# Title\n\n**bold**', 'markdown');
editor.importContent('<p>Hello</p>', 'html');

// Slice
const slice = editor.exportContent({ format: 'html', index: 0, length: 50 });
```

Tables: native editor tables cannot export to Markdown/MDX — use HTML. Details: [Serialization](./serialization.md).

---

## 7. Undo / redo

Keyboard: `Ctrl+Z` / `Ctrl+Shift+Z` (focus must be in the editor).

```javascript
editor.history.undo();
editor.history.redo();
editor.history.clear(); // new document / discard stack
```

Programmatic changes use `source: 'api'` by default and are undoable unless `history.userOnly` is true.

---

## 8. Image upload to your server

Default: base64 in document. Override uploader:

```javascript
modules: {
  uploader: {
    mimetypes: ['image/png', 'image/jpeg', 'image/webp'],
    async handler(range, files) {
      for (const file of files) {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body });
        const { url } = await res.json();
        this.lextrix.insertEmbed(range.index, 'image', url, 'user');
        range.index += 1;
      }
    },
  },
}
```

Toolbar **image** button and drag-and-drop both use this handler.

---

## 9. Image resize

```javascript
modules: { imageResize: { minWidth: 48 } }
```

Select an image in the editor — drag the corner handle.

---

## 10. Syntax highlighting

Load [highlight.js](https://highlightjs.org/) on the page first.

```javascript
modules: {
  syntax: {
    hljs: window.hljs,
    languages: [
      { key: 'javascript', label: 'JavaScript' },
      { key: 'python', label: 'Python' },
    ],
  },
}
```

---

## 11. Tables

```javascript
modules: { table: true }

editor.getModule('table').insertTable(3, 4); // rows, columns
```

---

## 12. Switch theme at runtime

See [Themes](./themes.md). Summary:

1. `getContents()`
2. Swap CSS
3. `wrapper.replaceChildren()`
4. New mount + `new Lextrix`
5. `setContents()`

---

## 13. React / Next.js

Full guide: [Framework integration](./frameworks.md).

Rules:

- `'use client'` + `dynamic(..., { ssr: false })` in Next.js
- **Wrapper ref** + inner mount div
- `import Lextrix from 'lextrix'` (default import)
- Never `<Lextrix />` in JSX

---

## 14. Custom formats (npm)

```javascript
import Lextrix, { lxrPath } from 'lextrix';

class CalloutBlot {
  // blot implementation …
}

Lextrix.register({ [lxrPath.format('callout')]: CalloutBlot });
```

`defineInlineTagFormat` and similar helpers need the monorepo. See [Formats](./formats.md).

---

## 15. Custom serializers

```javascript
import { registerSerializer } from 'lextrix';
import { ChangeSet } from 'lextrix';

registerSerializer({
  format: 'plain',
  import: (text) => new ChangeSet().insert(text).insert('\n'),
  export: (delta) => delta.getText(),
});
```

Call **before** `new Lextrix()`.

---

## 16. Check export warnings (Markdown / MDX)

```javascript
const warnings = editor.getExportWarnings('markdown');
for (const w of warnings) {
  console.warn(w.message); // tables blocked, color/align lossy, etc.
}
const md = editor.exportContent('markdown'); // throws if native table present
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Multiple toolbars | Old 2.0.0 sibling toolbar, or no `destroy()` on remount | Upgrade to 2.0.1+; call `editor.destroy()` |
| `Element type is invalid… undefined` | React: wrong import or `<Lextrix />` | [Frameworks](./frameworks.md) |
| `document is not defined` | SSR / Server Component | Client-only + `ssr: false` |
| Unstyled editor | Theme CSS not imported | `import 'lextrix/snow.css'` |
| Undo does nothing | Editor not focused | `wrapper.click()` or `editor.focus()` |
| `{ ChangeSet }` undefined (2.0.0) | Old UMD-only build | Upgrade to **2.0.1+** |

---

## API index

| Task | Methods |
|------|---------|
| Content | `getContents`, `setContents`, `getText`, `updateContents` |
| Format | `format`, `formatText`, `removeFormat` |
| Selection | `getSelection`, `setSelection`, `focus` |
| Events | `on('text-change')`, `on('selection-change')` |
| Serialize | `importContent`, `exportContent` |

Full list: [API reference](../api/reference.md).
