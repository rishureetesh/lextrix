# TypeScript

The published `lextrix` npm package includes hand-written declarations (`lextrix.d.ts`).

## Setup

```bash
npm install lextrix
```

```typescript
import Lextrix, { ChangeSet, lxrPath } from 'lextrix';
import type { LextrixOptions, SafetyIssue, Range } from 'lextrix';
import 'lextrix/snow.css';

const options: LextrixOptions = {
  theme: 'snow',
  modules: { toolbar: [['bold', 'italic']] },
};

const editor = new Lextrix('#editor', options);
```

No `@types/lextrix` package is required.

## Covered APIs

- `Lextrix` class and `LextrixOptions`
- `importContent`, `exportContent`, `listExportFormats`, `getExportWarnings`
- `text-change` and `selection-change` handler signatures
- `ChangeSet`, `Range`, `SafetyIssue`, serialization types
- Named exports: `ChangeSet`, `lxrPath`, `registerSerializer`, …

## Gaps

Declarations are maintained manually and may lag new APIs. Report missing types on [GitHub Issues](https://github.com/rishureetesh/lextrix/issues).

Advanced blot types (`Block`, `LeafBlot`, …) are not exported from the npm bundle types — use `unknown` or clone the monorepo for full internal typings.

## Example

See [examples/vite-react](../../examples/vite-react) for a typed React + Vite project.
