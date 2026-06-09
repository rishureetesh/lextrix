# Quick start

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
| `lextrix` | Full editor (UMD default export) |
| `lextrix/core` | Core-only bundle (no formats/themes) |
| `lextrix/lextrix.css` | Base editor styles |
| `lextrix/snow.css` | Snow theme |
| `lextrix/bubble.css` | Bubble theme |
| `lextrix/slate.css` | Dark slate theme |
| `lextrix/dawn.css` | Warm dawn theme |

Optional peer dependencies: [highlight.js](https://highlightjs.org/) for syntax, [KaTeX](https://katex.org/) for formulas.

For script-tag usage, build this repo and use files from `packages/lextrix/dist/dist/`.

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
