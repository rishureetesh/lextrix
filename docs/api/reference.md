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

| Method | Description |
|--------|-------------|
| `history.undo()` | Undo |
| `history.redo()` | Redo |
| `history.clear()` | Clear stacks |

## Modules

```javascript
editor.getModule('toolbar');
editor.getModule('table');
editor.getModule('syntax');
editor.clipboard;   // shorthand
editor.keyboard;
editor.uploader;
editor.history;
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
