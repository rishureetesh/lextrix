# Lextrix — React Vite example

Uses **`@lextrix/react`** (`LextrixEditor`) with Markdown import/export.

## From the monorepo

```bash
cd lextrix
npm install
npm run build
npm run example:react
```

## What it demonstrates

- `npm install lextrix @lextrix/react` (workspace links both)
- `import { LextrixEditor } from '@lextrix/react'`
- Theme CSS: `import 'lextrix/snow.css'`
- Controlled export via `onChange` + `format="markdown"`
- `editor.destroy()` handled by the component on unmount

For Next.js App Router, see [React guide](../../docs/guides/react.md).
