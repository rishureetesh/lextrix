# API reference

Lextrix exposes a familiar rich-text API centered on **ChangeSet** (operational transforms over document content).

## Construction

```javascript
const editor = new Lextrix(container, options);
```

Static properties: `Lextrix.version`, `Lextrix.events`, `Lextrix.sources`, `Lextrix.import()`, `Lextrix.register()`.

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
import { lxrPath } from 'lextrix-core/registry-paths.js';

Lextrix.register({ [lxrPath.format('callout')]: CalloutBlot });
Lextrix.register({ [lxrPath.module('mentions')]: MentionsModule });
```

Bare paths like `formats/bold` or `parchment` throw — use `lxr/*` paths only. See the [Formats guide](../guides/formats.md#registration).
