# Quick start

## Snow theme (default toolbar)

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

## Bubble theme (floating toolbar)

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
const json = editor.getContents();       // ChangeSet JSON
const html = editor.root.innerHTML;      // semantic HTML from DOM
const text = editor.getText();           // plain text
```

## Listening to changes

```javascript
editor.on('text-change', (delta, oldDelta, source) => {
  if (source === 'user') {
    save(json);
  }
});
```

See [configuration.md](./configuration.md) for modules, upload handlers, and format whitelists.
