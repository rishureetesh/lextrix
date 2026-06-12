# Configuration

> **Integrating in React or switching themes?** Call `editor.destroy()` on teardown — see [DOM mounting](./dom-mounting.md).

## Editor options

```typescript
new Lextrix(container, {
  theme: 'snow',           // snow | bubble | slate | dawn
  placeholder: '',
  readOnly: false,
  bounds: null,            // tooltip positioning root
  debug: false,
  formats: null,           // null = all registered formats; or string[]
  modules: { /* … */ },
});
```

## Modules

### Always enabled

These load automatically — configure via `modules.<name>`:

| Module | Options | Purpose |
|--------|---------|---------|
| `clipboard` | `matchers` | Paste HTML → ChangeSet |
| `keyboard` | bindings | Shortcuts |
| `history` | `delay`, `maxStack`, `userOnly` | Undo / redo |
| `uploader` | `mimetypes`, `handler` | Drag-drop & toolbar image upload |

### Opt-in modules

| Module | Enable | Notes |
|--------|--------|-------|
| `toolbar` | `toolbar: […]` or `'#selector'` | Button names — see below |
| `syntax` | `syntax: true` | Needs highlight.js |
| `table` | `table: true` | Table blots + cell keyboard nav |
| `imageResize` | `imageResize: true` | Drag handle on selected images |

### Toolbar buttons

Pass an array of groups:

```javascript
modules: {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ header: [1, 2, 3, 4, 5, false] }],
    [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
    [{ indent: '-1' }, { indent: '+1' }],
    [{ align: [] }, { direction: 'rtl' }],
    ['blockquote', 'code-block'],
    ['link', 'image', 'video', 'formula'],
    ['clean'],
  ],
}
```

Or point to existing DOM:

```javascript
modules: { toolbar: '#my-toolbar' }
```

When `toolbar` is an **array**, Lextrix creates `div.lxr-toolbar` as the **first child** of your mount element. Call `editor.destroy()` when tearing down — see [DOM mounting](./dom-mounting.md).

Custom handlers override theme defaults:

```javascript
modules: {
  toolbar: {
    container: ['image'],
    handlers: {
      image() { /* custom */ },
    },
  },
}
```

## Image upload to your API

Default uploader embeds images as base64. Override the handler:

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

The theme **image** button and drag-and-drop both call `uploader.upload()`.

## Image resize

Enable the module and select an image in the editor — a corner handle appears.

```javascript
modules: {
  imageResize: {
    minWidth: 48,
    maxWidth: null,   // null = editor width
  },
}
```

Resize sets `width` and `height` attributes on the `<img>` blot.

Programmatic resize:

```javascript
editor.formatText(index, 1, { width: '400', height: '300' }, 'user');
```

See also: [API reference — imageResize](../api/reference.md#image-resize-imageresize) · [Modules — Image resize](./modules.md#image-resize)

## Format whitelist

Restrict allowed formats:

```javascript
formats: ['bold', 'italic', 'link', 'header', 'list', 'image'],
```

Registered format names: `bold`, `italic`, `underline`, `strike`, `link`, `script`, `header`, `list`, `blockquote`, `code`, `code-block`, `color`, `background`, `font`, `size`, `align`, `direction`, `indent`, `image`, `video`, `formula`.

## Syntax highlighting

Load highlight.js, then:

```javascript
modules: {
  syntax: {
    hljs: window.hljs,
    languages: [
      { key: 'javascript', label: 'JavaScript' },
      { key: 'python', label: 'Python' },
    ],
    interval: 1000,
  },
}
```

## Tables

```javascript
modules: { table: true }

// Insert programmatically
editor.getModule('table').insertTable(3, 4); // rows, columns
```

## Modular registration (advanced)

Build a custom bundle from workspace packages:

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

See [Modules](./modules.md) for per-module details and authoring.
