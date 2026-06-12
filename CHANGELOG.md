# Changelog

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
- Ordered list export always uses `1.`

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

[2.0.2]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.2
[2.0.1]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.1
[2.0.0]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.0
[1.0.2]: https://github.com/rishureetesh/lextrix/releases/tag/v1.0.2
[1.0.1]: https://github.com/rishureetesh/lextrix/releases/tag/v1.0.1
[1.0.0]: https://github.com/rishureetesh/lextrix/releases/tag/v1.0.0
