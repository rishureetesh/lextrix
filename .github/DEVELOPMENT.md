# Development

Lextrix is an npm [workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) monorepo.

## Packages

| Package | Role |
|---------|------|
| `packages/lextrix` | Published npm package `lextrix` |
| `packages/lextrix-change` | Change-set / OT layer |
| `packages/lextrix-dom` | Blot document model |
| `packages/lextrix-core` | Editor shell, selection, blots |
| `packages/lextrix-formats` | Bold, lists, image, … |
| `packages/lextrix-modules` | Clipboard, keyboard, toolbar, … |
| `packages/lextrix-ui` | Toolbar pickers and icons |
| `packages/lextrix-themes` | Snow, bubble, slate, dawn |
| `packages/demo` | Vite integration demo |

## Commands

```bash
npm install
npm run build          # webpack production bundle
npm run dev            # Vite demo (:5173)
npm run dev:bundle     # webpack dev server (:8080)
npm run test           # lextrix-change + lextrix unit tests
npm run lint
npm run typecheck
```

### Lextrix package only

```bash
npm run test:unit -w lextrix
npm run test:fuzz -w lextrix
npm run test:e2e -w lextrix
```

E2E tests use Playwright with a local dev server (see `packages/lextrix/playwright.config.ts`).

## npm publish

Build first, then publish from `packages/lextrix/dist/dist/`:

```bash
npm run build
cd packages/lextrix/dist/dist
npm pack
npm publish --access public
```

From repo root: `npm run publish:npm`

The build drops a trimmed `package.json` in `dist/dist/` (no dev or workspace deps).
README, LICENSE, and NOTICE are copied in. Source maps are not published.

## Registry paths

Use canonical `lxr/*` import paths (`lxrPath.module('toolbar')`, etc.).
Legacy bare paths (`modules/foo`, `delta`, `parchment`) throw at runtime.
