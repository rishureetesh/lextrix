# Lextrix — React Vite example

Minimal React integration: wrapper ref, `destroy()` on unmount, Markdown import/export.

## From the monorepo

```bash
cd lextrix
npm install
npm run build
npm run example:react
```

## What it demonstrates

- Default import: `import Lextrix from 'lextrix'`
- Theme CSS: `import 'lextrix/snow.css'`
- Wrapper ref + inner mount div
- `editor.destroy()` on unmount
- `importContent` / `exportContent` / `getExportWarnings`
- TypeScript autocomplete via published `lextrix.d.ts`

For Next.js App Router, see [Framework integration](../../docs/guides/frameworks.md).
