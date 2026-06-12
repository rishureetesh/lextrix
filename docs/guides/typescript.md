# TypeScript

The published `lextrix` npm package includes hand-written declarations (`lextrix.d.ts`).

## Setup

```bash
npm install lextrix
```

```typescript
import Lextrix, { ChangeSet, lxrPath } from 'lextrix';
import type {
  LextrixOptions,
  LextrixModulesConfig,
  ImageResizeOptions,
  TableModule,
  ContentSerializer,
  SafetyIssue,
  Range,
} from 'lextrix';
import 'lextrix/snow.css';

const modules: LextrixModulesConfig = {
  toolbar: [['bold', 'italic'], ['link', 'image']],
  table: true,
  imageResize: { minWidth: 48 } satisfies ImageResizeOptions,
  syntax: { hljs: globalThis.hljs, languages: [{ key: 'javascript', label: 'JS' }] },
};

const options: LextrixOptions = { theme: 'snow', modules };

const editor = new Lextrix('#editor', options);
const table = editor.getModule('table') as TableModule | undefined;
table?.insertTable(3, 3);
```

No `@types/lextrix` package is required.

## Covered APIs

- `Lextrix` class and `LextrixOptions`
- Module config types: `LextrixModulesConfig`, `ImageResizeOptions`, `ToolbarModuleOptions`, `SyntaxModuleOptions`, `UploaderModuleOptions`, `HistoryModuleOptions`, `ClipboardModuleOptions`
- `TableModule` and `getModule('table')`
- `importContent`, `exportContent`, `listExportFormats`, `getExportWarnings`
- `text-change` and `selection-change` handler signatures
- `ChangeSet`, `Range`, `SafetyIssue`, `ContentSerializer`, serialization types
- Named exports: `ChangeSet`, `lxrPath`, `registerSerializer`, `getMarkdownExportWarnings`, …

## Gaps

Declarations are maintained manually and may lag new APIs. Report missing types on [GitHub Issues](https://github.com/rishureetesh/lextrix/issues).

Advanced blot types (`Block`, `LeafBlot`, …) are not exported from the npm bundle types — use `unknown` or clone the monorepo for full internal typings.

## Example

See [examples/vite-react](../../examples/vite-react) for a typed React + Vite project.
