# API reference

Lextrix exposes a familiar rich-text API centered on **ChangeSet** (operational transforms over document content).

## Construction

```javascript
const editor = new Lextrix(container, options);
```

Static properties: `Lextrix.version`, `Lextrix.events`, `Lextrix.sources`, `Lextrix.import()`, `Lextrix.register()`.

### Lifecycle

| Method | Description |
|--------|-------------|
| `destroy()` | Remove toolbar, theme listeners, and editor DOM inside the mount container |
| `getExportWarnings(input)` | Lossy/unsupported issues before Markdown/MDX export (does not throw) |

See [DOM mounting](../guides/dom-mounting.md).

### Editor options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `theme` | `string` | `'snow'` | `snow` \| `bubble` \| `slate` \| `dawn` |
| `placeholder` | `string` | `''` | Shown when the document is empty |
| `readOnly` | `boolean` | `false` | Disable editing (`editor.enable()` / `disable()`) |
| `bounds` | `HTMLElement` \| `string` \| `null` | `null` | Root for tooltip positioning |
| `formats` | `string[]` \| `null` | `null` | Whitelist of format names; `null` = all registered |
| `modules` | `object` | `{}` | Module configuration — see [Modules](#modules) |
| `debug` | `boolean` \| `string` | `false` | Log level for development |

```javascript
new Lextrix('#editor', {
  theme: 'snow',
  placeholder: 'Write here…',
  readOnly: false,
  modules: { toolbar: [['bold', 'italic']], table: true },
});
```

## Serialization

Import and export whole documents or slices. Prefer **`importContent`** / **`exportContent`** in application code — not `Lextrix.import()`, which loads internal modules.

Full limitations (tables, lossy formats): [Serialization guide](../guides/serialization.md).

### `importContent(content, format, source?)`

| | |
|---|---|
| **Parameters** | `content` — string to parse · `format` — `'html'` \| `'markdown'` \| `'mdx'` \| `'json'` · `source` — optional `'user'` \| `'api'` \| `'silent'` (default `'api'`) |
| **Returns** | `ChangeSet` applied to the editor (document replaced) |

```javascript
editor.importContent('# Hello\n\n**bold**', 'markdown');
editor.importContent('<p>Hello <strong>world</strong></p>', 'html');
```

### `exportContent(input)`

| | |
|---|---|
| **Parameters** | `input` — format string (`'html'`, `'markdown'`, `'mdx'`, `'json'`) **or** `{ format, index?, length? }` for a slice |
| **Returns** | `string` — serialized content |
| **Throws** | `SerializationError` when export is unsupported (e.g. native editor table → Markdown/MDX) |

```javascript
const md = editor.exportContent('markdown');
const html = editor.exportContent('html');
const slice = editor.exportContent({ format: 'html', index: 0, length: 50 });
```

Aliases: `editor.import()` / `editor.export()` — same behavior.

### `listExportFormats()`

| | |
|---|---|
| **Returns** | `string[]` — formats registered for this editor (default includes `html`, `markdown`, `mdx`, `json`) |

```javascript
editor.listExportFormats(); // ['html', 'markdown', 'mdx', 'json', …]
```

### `getExportWarnings(input)`

| | |
|---|---|
| **Parameters** | Same shape as `exportContent` — format string or `{ format, index?, length? }`. Only **`markdown`** and **`mdx`** produce warnings. |
| **Returns** | `SafetyIssue[]` — `{ feature, safety: 'lossy' \| 'unsupported', message }`. Does **not** throw. |

```javascript
const warnings = editor.getExportWarnings('markdown');
if (warnings.some((w) => w.safety === 'unsupported')) {
  // e.g. native editor table — use exportContent('html') instead
}
const md = editor.exportContent('markdown'); // throws if unsupported content remains
```

## Content

| Method | Description |
|--------|-------------|
| `getContents(index?, length?)` | ChangeSet JSON |
| `setContents(delta, source?)` | Replace document |
| `getText(index?, length?)` | Plain text |
| `getLength()` | Document length |
| `getSemanticHTML(index?, length?)` | HTML string |
| `insertText(index, text, formats?, source?)` | Insert text |
| `insertEmbed(index, name, value, source?)` | Insert image, video, formula |
| `deleteText(index, length, source?)` | Delete range |
| `updateContents(delta, source?)` | Apply ChangeSet |

## Formatting

| Method | Description |
|--------|-------------|
| `format(name, value, source?)` | Format at cursor |
| `formatText(index, length, name, value, source?)` | Format range |
| `formatLine(index, length, name, value, source?)` | Block format |
| `getFormat(index?, length?)` | Active formats |
| `removeFormat(index, length, source?)` | Clear inline formats |

## Selection

| Method | Description |
|--------|-------------|
| `getSelection(focus?)` | `{ index, length }` or null |
| `setSelection(index, length?, source?)` | Set selection |
| `getBounds(index, length?)` | Pixel rect for caret/range |
| `focus()` / `blur()` / `hasFocus()` | Focus management |

## History

Access via `editor.history` (always loaded). Configure with `modules.history`.

| Method | Description |
|--------|-------------|
| `history.undo()` | Undo |
| `history.redo()` | Redo |
| `history.clear()` | Clear stacks |
| `history.cutoff()` | Start a new undo branch |

Keyboard: `Ctrl+Z` / `Ctrl+Shift+Z` when the editor is focused.

**Module options** (`modules.history`):

| Option | Default | Description |
|--------|---------|-------------|
| `delay` | `1000` | Milliseconds before merging consecutive undo steps |
| `maxStack` | `100` | Maximum undo depth |
| `userOnly` | `false` | When `true`, only `'user'`-sourced changes are undoable |

## Modules

Core modules (`clipboard`, `keyboard`, `history`, `uploader`) load automatically. Opt-in modules require `modules.<name>` in constructor options.

```javascript
editor.getModule('toolbar');
editor.getModule('table');
editor.getModule('syntax');
editor.getModule('imageResize');
editor.clipboard;   // shorthand
editor.keyboard;
editor.uploader;
editor.history;
```

### Toolbar (`toolbar`)

| | |
|---|---|
| **Enable** | `modules: { toolbar: […] }` — button groups array, `'#selector'`, or `{ container, handlers }` |
| **Access** | `editor.getModule('toolbar')` |

Pass an array to auto-create `div.lxr-toolbar` as the **first child** of the mount element:

```javascript
modules: {
  toolbar: [
    ['bold', 'italic', 'underline'],
    [{ header: [1, 2, false] }],
    ['link', 'image', 'video', 'formula', 'table'],
    ['clean'],
  ],
}
```

Custom handlers override theme defaults:

```javascript
modules: {
  toolbar: {
    container: [['image'], ['table']],
    handlers: {
      table() {
        this.lextrix.getModule('table')?.insertTable(3, 3);
      },
    },
  },
}
```

More: [Configuration — Toolbar buttons](../guides/configuration.md#toolbar-buttons)

### Table (`table`)

| | |
|---|---|
| **Enable** | `modules: { table: true }` |
| **Access** | `editor.getModule('table')` |

```javascript
editor.getModule('table')?.insertTable(3, 4); // rows, columns
```

Also: `insertRowAbove()`, `insertRowBelow()`, `insertColumnLeft()`, `insertColumnRight()`, `deleteRow()`, `deleteColumn()`.

Native editor tables **cannot** export to Markdown/MDX — use `exportContent('html')`. See [Serialization](../guides/serialization.md).

### Syntax highlighting (`syntax`)

| | |
|---|---|
| **Enable** | `modules: { syntax: true }` or options object |
| **Requires** | [highlight.js](https://highlightjs.org/) on the page (`window.hljs`) |

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

Without highlight.js the module no-ops (code blocks still work, without token colors).

### Uploader (`uploader`)

Always loaded. Handles drag-and-drop and the toolbar **image** button.

| Option | Default | Description |
|--------|---------|-------------|
| `mimetypes` | `['image/png', 'image/jpeg']` | Allowed file types |
| `handler` | base64 embed | `(range, files) => void` — `this.lextrix` is the editor |

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

### Clipboard (`clipboard`)

Always loaded. Normalizes paste from HTML, Word, Google Docs.

| Option | Description |
|--------|-------------|
| `matchers` | `[selector, matcherFn][]` — custom HTML → ChangeSet rules |

```javascript
modules: {
  clipboard: {
    matchers: [
      ['B', (node, delta) => delta.insert(node.textContent ?? '', { bold: true })],
    ],
  },
}
```

### Image resize (`imageResize`)

Opt-in module. When exactly **one image embed** is selected, shows a corner drag handle and preserves aspect ratio while resizing.

| | |
|---|---|
| **Enable** | `modules: { imageResize: true }` or an options object (see below) |
| **Access** | `editor.getModule('imageResize')` |
| **Applies to** | Image embeds only — not video, formula, or other embeds |

**Options** (pass as `modules.imageResize`):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minWidth` | `number` | `48` | Minimum width in pixels |
| `maxWidth` | `number` \| `null` | `null` | Maximum width; `null` = editor root width |

```javascript
modules: {
  toolbar: [['bold', 'italic'], ['link', 'image'], ['clean']],
  imageResize: { minWidth: 48, maxWidth: null },
},
```

Select an image in the editor, then drag the handle. Resize commits `width` and `height` attributes on the image blot.

**Programmatic resize** (same attributes the handle sets):

```javascript
editor.formatText(index, 1, { width: '400', height: '300' }, 'user');
```

Requires theme CSS (included in `lextrix/snow.css`, etc.) for `.lxr-image-resize` overlay styles.

The overlay mounts on `.lxr-container` and repositions after layout settles (selection, scroll, and resize). Always call `editor.destroy()` on unmount.

More: [Configuration — Image resize](../guides/configuration.md#image-resize) · [Modules](../guides/modules.md#image-resize)

## Registration helpers

Call **before** `new Lextrix()` unless noted.

### `registerSerializer(serializer)`

Register a custom import/export format globally.

| | |
|---|---|
| **Parameter** | `{ format, import(content, context?), export(changeSet, context?) }` |
| **See also** | [Serialization — Custom serializers](../guides/serialization.md) |

```javascript
import { registerSerializer } from 'lextrix';

registerSerializer({
  format: 'plain',
  import: (text) => [{ insert: text }],
  export: (delta) => delta.getText(),
});
```

### `unregisterSerializer(format)`

Remove a registered format. Returns `boolean`.

### `registerMdxComponent(name, handler)`

Register a JSX component handler for MDX import/export. Experimental — see [Serialization](../guides/serialization.md).

### `getMarkdownExportWarnings(delta)`

Headless helper — same warnings as `editor.getExportWarnings('markdown')` without an editor instance.

```javascript
import { getMarkdownExportWarnings, ChangeSet } from 'lextrix';

getMarkdownExportWarnings(new ChangeSet().insert('Hello\n'));
```

## Events

```javascript
editor.on('text-change', (delta, oldDelta, source) => {});
editor.on('selection-change', (range, oldRange, source) => {});
editor.on('editor-change', (eventName, ...args) => {});
```

Sources: `'user'`, `'api'`, `'silent'`.

## ChangeSet

```javascript
import { ChangeSet } from 'lextrix';

new ChangeSet()
  .retain(5)
  .insert('Hello', { bold: true })
  .delete(2);
```

Legacy name `Delta` is not supported — use `ChangeSet`. See the [ChangeSet guide](../guides/change-set.md).

## Registry paths

Register custom formats or modules:

```javascript
import Lextrix, { lxrPath } from 'lextrix';

Lextrix.register({ [lxrPath.format('callout')]: CalloutBlot });
Lextrix.register({ [lxrPath.module('mentions')]: MentionsModule });
```

Bare paths like `formats/bold` or `parchment` throw — use `lxr/*` paths only. See the [Formats guide](../guides/formats.md#registration). Advanced blot helpers (`defineInlineTagFormat`, …) require the monorepo — see [Framework integration](../guides/frameworks.md).
