# Quick start

**Try it:** [Live playground](https://iamreetesh.com/lextrix) — themes, import/export, and all modules in the browser.

## Install

```bash
npm install lextrix
```

```javascript
import Lextrix from 'lextrix';
import 'lextrix/snow.css';
```

| Import | Purpose |
|--------|---------|
| `lextrix` | Full editor — ESM (`lextrix.esm.js`) for bundlers, UMD (`lextrix.js`) for script tags |
| `lextrix/core` | Core-only bundle (no formats/themes) |
| `lextrix/lextrix.css` | Base editor styles |
| `lextrix/snow.css` | Snow theme |
| `lextrix/bubble.css` | Bubble theme |
| `lextrix/slate.css` | Dark slate theme |
| `lextrix/dawn.css` | Warm dawn theme |

Named imports (`ChangeSet`, `registerSerializer`, `lxrPath`, …) work from `lextrix` in bundlers (2.0.1+). Script-tag UMD exposes `window.Lextrix` only.

Optional peer dependencies: [highlight.js](https://highlightjs.org/) for syntax, [KaTeX](https://katex.org/) for formulas.

**React, Next.js, Vue:** [Framework integration](../guides/frameworks.md) · [Cookbook](../guides/cookbook.md) · [DOM mounting](../guides/dom-mounting.md) (toolbar cleanup)

For script-tag usage, use `lextrix.js` from `packages/lextrix/dist/dist/` after `npm run build`.

## Snow theme

```html
<div id="editor"></div>
```

```javascript
const editor = new Lextrix('#editor', {
  theme: 'snow',
  placeholder: 'Start writing…',
  modules: {
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean'],
    ],
    imageResize: true,
  },
});

editor.setContents([
  { insert: 'Hello Lextrix\n', attributes: { header: 1 } },
  { insert: 'Select an image and drag the corner handle to resize.\n' },
]);
```

## Bubble theme

```javascript
const editor = new Lextrix('#editor', {
  theme: 'bubble',
  modules: {
    toolbar: [
      ['bold', 'italic', 'link'],
      [{ header: 1 }, { header: 2 }],
    ],
  },
});
```

## Read-only

```javascript
const editor = new Lextrix('#editor', {
  theme: 'snow',
  readOnly: true,
});
```

## Getting content

```javascript
const json = editor.getContents();       // ChangeSet
const html = editor.exportContent('html');
const text = editor.getText();
```

## Listening to changes

```javascript
editor.on('text-change', (delta, oldDelta, source) => {
  if (source === 'user') {
    save(editor.getContents());
  }
});
```

See [Configuration](../guides/configuration.md) for modules, upload handlers, and format whitelists.
