# Evaluation guide

A linear path for trying Lextrix for the first time. No setup beyond a bundler or static HTML page.

**Using React or Next.js?** Skip to [Framework integration](../guides/frameworks.md) after step 5.

---

## 1. Try the playground

Open the [live playground](https://iamreetesh.com/lextrix) in your browser. No install required — edit content, switch themes, and try import/export panels.

---

## 2. Install Lextrix

```bash
npm install lextrix
```

Install only the **`lextrix`** package. Everything you need for a full editor ships in that bundle.

---

## 3. Import CSS

Lextrix does not inject styles. Import a theme in your app entry:

```javascript
import 'lextrix/snow.css';
```

Other themes: `lextrix/bubble.css`, `lextrix/slate.css`, `lextrix/dawn.css`.

---

## 4. Create an editor

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
      ['link', 'clean'],
    ],
  },
});
```

You should see a toolbar and an editable area immediately.

---

## 5. Load content

**From ChangeSet JSON** (same shape as `getContents()`):

```javascript
editor.setContents([
  { insert: 'Hello Lextrix\n', attributes: { header: 1 } },
  { insert: 'Edit rich text in the browser.\n' },
]);
```

**From Markdown or HTML:**

```javascript
editor.importContent('# Title\n\n**Bold** paragraph.', 'markdown');
editor.importContent('<p>Hello <strong>world</strong></p>', 'html');
```

---

## 6. Export content

```javascript
const markdown = editor.exportContent('markdown');
const html = editor.exportContent('html');
const json = editor.getContents(); // ChangeSet
```

**Before Markdown or MDX export**, check for unsupported or lossy content:

```javascript
const warnings = editor.getExportWarnings('markdown');
for (const w of warnings) {
  console.warn(w.message);
}
const md = editor.exportContent('markdown');
```

Native editor tables **cannot** export to Markdown/MDX — export throws `SerializationError`. Use `exportContent('html')` instead. See [Serialization](../guides/serialization.md) for the full limitations list.

---

## 7. React / Next.js next steps

Lextrix is a class, not a React component. Mount it in `useEffect`, call `editor.destroy()` on unmount, and import theme CSS on the client.

- [Framework integration](../guides/frameworks.md) — React, Next.js App Router, Vue, script tag
- [DOM mounting](../guides/dom-mounting.md) — toolbar placement and cleanup when remounting
- Runnable starters: [vite-vanilla](../../examples/vite-vanilla) · [vite-react](../../examples/vite-react)

---

## 8. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Unstyled editor | Import `lextrix/snow.css` (or another theme) |
| `document is not defined` | Client-only — see [Frameworks](../guides/frameworks.md) |
| Duplicate toolbars | Call `editor.destroy()` on unmount — [DOM mounting](../guides/dom-mounting.md) |
| Markdown export throws | Native table in document — use HTML export or check [Serialization](../guides/serialization.md) |

More recipes: [Cookbook](../guides/cookbook.md) · Full API: [API reference](../api/reference.md)

---

## What to read next

| Goal | Guide |
|------|-------|
| Copy-paste recipes | [Cookbook](../guides/cookbook.md) |
| Save on change, uploads, tables | [Cookbook](../guides/cookbook.md) |
| All import/export formats | [Serialization](../guides/serialization.md) |
| Module and toolbar options | [Configuration](../guides/configuration.md) |
