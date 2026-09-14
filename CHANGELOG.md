# Changelog

## 3.0.0 (2026-09-14)

Major platform release: document engine (Phases 0–12) shipped with the Lextrix editor as a projection. Wire `schemaVersion` remains **1**.

### Core

- ChangeSet OT engine as canonical transitions (`lextrix-change`)
- Dual ChangeOp / internal DocumentOperation bridge retained (not public IR)

### Document Runtime

- Stable `lextrix-change/document`: Document, DocumentHandle, transactions, subscribe
- Experimental barrel retained for graduation / advanced surfaces

### Versioning

- Linear immutable Versions, Anchors, Ranges, restore-as-new-Version

### Collaboration

- OT rebase / proposals
- `lextrix-collab`: authoritative `DocumentServerSession`, client session, ownership, presence protocol, home-region foundations

### Persistence

- Persistence + CAS ports; in-memory and PostgreSQL adapters
- `changeId` idempotency; `owner_epoch` fencing

### Server

- `lextrix-server`: WebSocket host, AuthN/AuthZ hooks, observability hooks, PG migrations

### Wire

- ADR-012 kinds unchanged (`schemaVersion: 1`)
- Additive collab control frames / sync snapshot fields

### Intelligence

- `lextrix-intelligence`: deterministic + optional OpenAI providers
- Proposals only — never a privileged Document mutation path

### Snapshots / Compaction

- Checkpoint snapshots keyed to Version ids; seal → archive → purge

### Presence

- Ephemeral presence protocol (not Version history; UX deferred)

### Editor

- Existing themes/modules/serialization preserved
- Experimental Document bridge APIs for projection / proposals

### Testing / Infrastructure

- Engine suites + Chromium unit (582) + e2e (43)
- Playground upgraded to demonstrate platform APIs (`lextrix-demo`)
- Final validation + browser validation + future roadmap docs

### Compatibility

- Prefer `importContent` / `exportContent`
- `@lextrix/react@0.3.0` peers `lextrix@^3.0.0`

### Limitations (not claimed)

- Live PG / multi-process fencing / WS soak / SLOs may be environment-gated
- Presence UX, automated multi-region product, SaaS/billing, CRDT, E2EE deferred

## @lextrix/react 0.3.0 (2026-09-14)

### Changed

- Peer dependency: `lextrix@^3.0.0`

## 2.1.0 (2026-09-14)


### Changed

- **Plugin lifecycle** — `PluginHost.destroyAll()` tears down every module; `Module.listenDom` / `Module.onEditor` / `track()` for consistent cleanup (syntax, table, toolbar, imageResize drag, uiNode)
- **Dependency inversion** — `lextrix-core` depends on module contracts, not concrete `lextrix-modules` types
- **Lazy document listeners** — shared `document` routing installs on first editor construct and releases on last destroy (no import-time side effects)
- Prefer `importContent` / `exportContent`; instance `import` / `export` marked deprecated

### Added

- `LextrixError` taxonomy (`InvalidContainerError`, `UnknownThemeError`, `MissingBlotError`, `InvalidRegistryPathError`)
- `ExtensionHost` helpers for format/module/theme/attributor registration
- `editor.getCapabilities()` for optional runtimes (`katex`, `highlightJs`, `imageResize`, serializers)
- `ChangeSet.clone()` / `ChangeSet.freeze()` for safer document sharing
- Docs: [migration guide](./docs/guides/migration-2.1.md), updated architecture principles

## @lextrix/react 0.2.0 (2026-09-14)

### Added

- `readOnly` prop — toggles editing without remount
- Ref handle `getExportWarnings()` — block unsupported Markdown/MDX saves from React

### Changed

- Controlled JSON updates use `setContents` when value parses as ChangeSet ops
- Peer dependency: `lextrix@^2.1.0`

## 2.0.5 (2026-07-12)

### Fixed

- **Image resize overlay lag on first select** — defer reposition until after layout (double `requestAnimationFrame`); listen for document scroll, window resize, and `ResizeObserver` on the image and container
- **`getModule('imageResize')` typing** — export `ImageResizeModule` with `reposition()` and `destroy()`

### Added

- TypeScript declarations for `setText`, `getLeaf`, `getLine`, `getLines`, `getIndex`, `scrollSelectionIntoView`, `scrollRectIntoView`, `focus({ preventScroll })`, `getBounds(Range)`, and `setSelection(null)`
- npm keywords for discoverability (`lextrix`, `markdown`, `image-resize`, …)

## @lextrix/react 0.1.0 (2026-07-12)

### Added

- New package **`@lextrix/react`** — official React bindings (`LextrixEditor`)
- Controlled / uncontrolled content via `value`, `defaultValue`, `format`, `onChange`
- Imperative ref: `getEditor()`, `focus`, `blur`, `exportContent`, `importContent`
- `'use client'` for Next.js App Router
- Docs: [React guide](./docs/guides/react.md)
- Example: `examples/vite-react` uses `@lextrix/react`

Install: `npm install lextrix @lextrix/react`

Requires peer **`lextrix@^2.0.5`**.

## 2.0.4 (2026-06-12)

### Fixed

- **Image resize overlay misaligned** — `reposition()` uses the image DOM rect minus the container rect (no double offset from `getBounds()`)
- Overlay mounts on `.lxr-container` (not `.lxr-editor` / scroll blot) so foreign DOM does not break reconcile
- **`getBounds()` width 0 on image embeds** — `getClientBounds()` returns `rect.width` for element nodes
- **Orphan resize overlays on remount** — `imageResize.destroy()` removes listeners and DOM; `editor.destroy()` calls it
- Image resize listeners use arrow handlers so `reposition` can be patched after init

### Added

- Public TypeScript types for module config: `LextrixModulesConfig`, `ImageResizeOptions`, `TableModule`, `ContentSerializer`, and related interfaces
- Runnable examples: `examples/vite-vanilla`, `examples/vite-react`
- Docs: expanded [API reference](./docs/api/reference.md), [evaluation guide](./docs/getting-started/evaluation.md), [TypeScript guide](./docs/guides/typescript.md)

### Changed

- `.lxr-editor` is `position: relative` for absolute overlay positioning inside the scroll area

## 2.0.3 (2026-06-11)

### Fixed

- Strip source map references from published CSS and JS so Vite and other bundlers no longer warn about missing `lextrix.snow.css.map` (maps are excluded from the npm tarball)

## 2.0.2 (2026-06-09)

### Fixed

- **Enter in syntax-highlighted code blocks no longer freezes the editor** — removed `SyntaxCodeBlock.optimize()` that fought `Block.defaultChild` Break insertion in an infinite normalize loop
- Syntax blots (`SyntaxCodeBlock`, `CodeToken`) register only when the syntax module is active and highlight.js is available (not at bundle import)
- Syntax `highlight()` uses `SILENT` source so re-highlighting does not re-trigger `text-change` loops in host apps

## 2.0.1 (2026-06-09)

### Added

- ESM build (`lextrix.esm.js`, `lextrix.core.esm.js`) with named exports for bundlers (Vite, Next.js, webpack)
- `lxrPath` re-export from `lextrix` npm package
- [Framework integration guide](./docs/guides/frameworks.md) — React, Next.js App Router, Vue, Quill migration
- [DOM mounting guide](./docs/guides/dom-mounting.md) — toolbar sibling placement and cleanup (fixes duplicate toolbars on theme switch)
- [Cookbook](./docs/guides/cookbook.md) — copy-paste recipes for every feature
- [Themes guide](./docs/guides/themes.md) — safe runtime theme switching

### Changed

- `package.json` `exports.import` resolves to ESM; UMD (`lextrix.js`) kept for script tags
- Docs clarify npm vs monorepo imports; fix React/Next.js playground patterns (wrapper ref + `wrapper.replaceChildren()`)

### Fixed

- Named imports (`ChangeSet`, `registerSerializer`, …) from `lextrix` on npm (2.0.0 UMD-only)
- Documentation examples that cleared only the mount div (left `div.lxr-toolbar` siblings behind)
- Toolbar auto-insert now places `div.lxr-toolbar` **inside** the mount container (was sibling in 2.0.0)
- `editor.destroy()` for teardown (toolbar, theme body listener, emitter, mount DOM)
- Formula without KaTeX: no throw — fallback text + formula toolbar button hidden when `window.katex` missing
- Syntax without highlight.js: module no-ops instead of throwing
- `editor.getExportWarnings()` / `getMarkdownExportWarnings()` for color, align, font, tables before Markdown export
- `destroy()` clears emitter DOM listeners and theme `listenDOM` handlers (was leaking body click routing)
- Full-feature local playground (`packages/demo`): ESM import, KaTeX, highlight.js, import/export panels, all modules
- Prepublish runs `lextrix` unit tests (destroy, toolbar-in-mount)
- Markdown/MDX export no longer over-escapes `.` and `!` in prose (`[link](url).` not `url)\.`)
- Video tooltip insert no longer blocked when KaTeX is missing (regression from shared formula fallthrough)
- Markdown/MDX ordered lists export sequential numbering (`1.`, `2.`, …) instead of resetting every line to `1.`; numbering continues across empty lines between items (separate `<ol>` blocks in the editor)
- MDX export batches markdown blocks so list numbering matches markdown export (was per-block `1.` only)

## 2.0.0 (2026-06-08)

### Added

- `lextrix-serialize` package: HTML, Markdown, MDX, JSON import/export via ChangeSet
- `editor.importContent()` / `editor.exportContent()` on the editor API
- `registerSerializer()` / `registerMdxComponent()` for custom formats
- `SerializerHost` for headless parse/stringify
- GFM table round-trip for simple pipe tables (imported via Markdown)
- `SerializationError` when exporting native editor tables to Markdown/MDX
- Nested list support in Markdown and MDX import/export

### Changed

- Documentation consolidated; redundant architecture, compatibility matrix, and release notes removed
- Prefer `importContent` / `exportContent` over `import` / `export` for content serialization

### Limitations (unchanged in 2.0)

- HTML round-trip is partial (DOM-backed export)
- MDX components are experimental
- Markdown is a subset, not full GFM/CommonMark

## 1.0.2 (2026-05-31)

- Fix delete/undo in webpack bundles by initializing ChangeApplier delete pass after scroll is assigned
- Restore cursor synchronously on input so typed text is not left inside the cursor embed

## 1.0.1 (2026-05-31)

- Fix TypeScript errors across dom, core, formats, and test type definitions
- Restore CI: lint, typecheck, unit tests, fuzz tests, and production build

## 1.0.0 (2026-05-31)

- First stable release as **lextrix**
- Packages: change, dom, core, formats, modules, ui, themes, npm bundle
- Themes: snow, bubble, slate, dawn
- Image resize module (`modules.imageResize`)

[2.0.5]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.5
[2.0.4]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.4
[2.0.3]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.3
[2.0.2]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.2
[2.0.1]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.1
[2.0.0]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.0
[1.0.2]: https://github.com/rishureetesh/lextrix/releases/tag/v1.0.2
[1.0.1]: https://github.com/rishureetesh/lextrix/releases/tag/v1.0.1
[1.0.0]: https://github.com/rishureetesh/lextrix/releases/tag/v1.0.0
