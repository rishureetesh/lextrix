# Development

Lextron is an npm [workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) monorepo.

## Packages

| Package | Role |
|---------|------|
| `packages/lextron` | Published npm package `@reetesh/lextron` |
| `packages/lextron-change` | Change-set / OT layer |
| `packages/lextron-dom` | Blot document model |
| `packages/lextron-core` | Editor shell, selection, blots |
| `packages/lextron-formats` | Bold, lists, image, … |
| `packages/lextron-modules` | Clipboard, keyboard, toolbar, … |
| `packages/lextron-ui` | Toolbar pickers and icons |
| `packages/lextron-themes` | Snow, bubble, slate, dawn |
| `packages/demo` | Vite integration demo |

## Commands

```bash
npm install
npm run build          # webpack production bundle
npm run dev            # Vite demo (:5173)
npm run dev:bundle     # webpack dev server (:8080)
npm run test           # lextron-change + lextron unit tests
npm run lint
npm run typecheck
```

### Lextron package only

```bash
npm run test:unit -w @reetesh/lextron
npm run test:fuzz -w @reetesh/lextron
npm run test:e2e -w @reetesh/lextron
```

E2E tests use Playwright with a local dev server (see `packages/lextron/playwright.config.ts`).

## npm publish

Build first, then publish from `packages/lextron/dist/dist/`:

```bash
npm run build
cd packages/lextron/dist/dist
npm pack
npm publish --access public
```

From repo root: `npm run publish:npm`

The build drops a trimmed `package.json` in `dist/dist/` (no dev or workspace deps).
README, LICENSE, and NOTICE are copied in. Source maps are not published.

## Registry paths

Use canonical `lxt/*` import paths (`lxtPath.module('toolbar')`, etc.).
Legacy bare paths (`modules/foo`, `delta`, `parchment`) throw at runtime.
