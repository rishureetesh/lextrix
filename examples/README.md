# Lextrix examples

Runnable starters for evaluating Lextrix. Each example uses current APIs (`importContent`, `exportContent`, `destroy()`).

| Example | Stack | Port |
|---------|-------|------|
| [vite-vanilla](./vite-vanilla) | Vanilla JS + Vite | 5174 |
| [vite-react](./vite-react) | React + `@lextrix/react` + Vite | 5175 |

## Run from the monorepo

From the repository root (one install; workspaces link `lextrix` after build):

```bash
npm install
npm run build
npm run example:vanilla   # or: npm run example:react
```

Or from an example folder: `cd examples/vite-vanilla` then `npm run dev` (ports 5174 / 5175).

## Run with npm only

After `lextrix` is published, copy an example into your project:

```bash
npm install lextrix @lextrix/react   # React example
npm install lextrix                  # vanilla example
```
