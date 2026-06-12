# Modules

## Core (always loaded)

### Clipboard

Normalizes paste from HTML, Word, Google Docs, etc. Add custom matchers:

```javascript
modules: {
  clipboard: {
    matchers: [
      ['B', (node, delta) => delta.insert(node.textContent, { bold: true })],
    ],
  },
}
```

### Keyboard

Default bindings for Enter in lists/headers, tab indent, link shortcuts (snow theme adds Ctrl/Cmd+K). Extend:

```javascript
editor.keyboard.addBinding({ key: 'b', shortKey: true }, (range, context) => {
  editor.format('bold', !context.format.bold);
});
```

### History

| Option | Default | Description |
|--------|---------|-------------|
| `delay` | `1000` | ms before merging undo steps |
| `maxStack` | `100` | Max undo depth |
| `userOnly` | `false` | Ignore API changes |

### Uploader

Handles drag-and-drop and cooperates with the toolbar image button. See [Configuration](./configuration.md#image-upload-to-your-api).

---

## Optional

### Toolbar

Renders formatting controls. Theme provides default handlers for `image`, `video`, and `formula`.

Snow theme auto-builds a default toolbar when `modules.toolbar` is set without a `container`.

### Syntax

Requires **highlight.js**. Adds a language `<select>` on code blocks and debounced highlighting.

### Table

Registers table blots. Keyboard shortcuts for navigation inside cells when the table module is active.

```javascript
const table = editor.getModule('table');
table.insertTable(2, 3);
table.deleteRow();
table.deleteColumn();
table.deleteTable();
```

No default toolbar button — add a custom handler if needed.

### Image resize

Shows a resize handle when a single image embed is selected.

| Option | Default |
|--------|---------|
| `minWidth` | `48` |
| `maxWidth` | `null` (editor width) |

Does not affect video or other embeds.

The resize overlay mounts on `.lxr-container` (sibling of the scroll surface) and tracks the image via DOM coordinates. Call `editor.destroy()` when unmounting the editor to avoid orphan overlays in SPA remounts.

API details: [API reference — imageResize](../../api/reference.md#image-resize-imageresize)

---

## Authoring a module

Modules extend `Module` from `lextrix-core` and register with `lxrPath.module()`:

```javascript
import Module from 'lextrix-core/core/module.js';
import Lextrix, { lxrPath } from 'lextrix';

class WordCountModule extends Module {
  constructor(lextrix, options) {
    super(lextrix, options);
    lextrix.on('text-change', () => this.update());
  }

  update() {
    console.log('Document length:', this.lextrix.getLength());
  }
}

Lextrix.register({ [lxrPath.module('wordCount')]: WordCountModule });

new Lextrix('#editor', {
  theme: 'snow',
  modules: { wordCount: true },
});
```

Lifecycle: theme loads modules from options → `pluginHost.register()` → `pluginHost.bindAll(editor)`.

Access instances with `editor.getModule('wordCount')`.

Study existing modules in `packages/modules/src/modules/`. Source: `packages/core/src/core/plugins/plugin-host.ts`.
