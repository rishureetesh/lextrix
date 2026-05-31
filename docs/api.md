# API reference

Lextron exposes a familiar rich-text API centered on **ChangeSet** (operational transforms over document content).

## Construction

```javascript
const editor = new Lextron(container, options);
```

Static properties: `Lextron.version`, `Lextron.events`, `Lextron.sources`, `Lextron.import()`, `Lextron.register()`.

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
import { ChangeSet } from 'lextron';

new ChangeSet()
  .retain(5)
  .insert('Hello', { bold: true })
  .delete(2);
```

Legacy name `Delta` is not supported — use `ChangeSet`.

## Registry paths

Register custom formats or modules:

```javascript
import { lxtPath } from 'lextron-core/registry-paths.js';

Lextron.register({ [lxtPath.format('callout')]: CalloutBlot });
Lextron.register({ [lxtPath.module('mentions')]: MentionsModule });
```

Bare paths like `formats/bold` or `parchment` throw — use `lxt/*` paths only.
