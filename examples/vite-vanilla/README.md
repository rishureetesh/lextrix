# Lextrix — Vanilla Vite example

Minimal runnable example: mount editor, load Markdown, export on change.

## From the monorepo

Build the bundle first, then run this example:

```bash
cd lextrix
npm install
npm run build
npm run example:vanilla
```

## What it demonstrates

- `import Lextrix from 'lextrix'`
- `import 'lextrix/snow.css'`
- `importContent` / `exportContent` / `getExportWarnings`
- `text-change` listener
