# ChangeSet guide

Lextrix represents document changes as **ChangeSets** — arrays of **ChangeOps** with `insert`, `delete`, or `retain` operations and optional attributes.

## Basic usage

```javascript
import { ChangeSet } from 'lextrix';

const change = new ChangeSet()
  .retain(5)
  .insert('Hello', { bold: true })
  .delete(2);

editor.updateContents(change, 'user');
```

## Wire format

Each op is a JSON object:

```json
{ "insert": "text", "attributes": { "bold": true } }
{ "retain": 3 }
{ "delete": 1 }
{ "insert": { "image": "https://example.com/a.png" } }
```

This shape is compatible with common operational-transform JSON conventions. Lextrix uses the name **ChangeSet** (not `Delta`).

## Public API vs internals

| You use | Package | Notes |
|---------|---------|-------|
| `ChangeSet`, `ChangeOp` | `lextrix-change` | Public boundary |
| `compose`, `diff`, `transform`, `invert` | `lextrix-change` | Convert to native ops internally |
| `DocumentOperation` | Internal only | `kind: insert \| delete \| retain` |

Algorithms run on native operations in `OperationStreamOT`. Coalescing uses `pushNativeOp` in `operation-coalesce.ts`.

## Common patterns

**Read document:**

```javascript
const contents = editor.getContents();
```

**Replace document:**

```javascript
editor.setContents(new ChangeSet().insert('Hello\n'));
```

**Partial update:**

```javascript
editor.updateContents(
  new ChangeSet().retain(index).insert('!', { bold: true }),
  'user',
);
```

## OT utilities

```javascript
import { compose, diff, transform, invert } from 'lextrix-change';

const composed = compose(a, b);
const patch = diff(oldDoc, newDoc);
```

## Further reading

- [API reference](../api/reference.md)
- [Architecture](../architecture/overview.md)
- Tests: `packages/change/tests/`
