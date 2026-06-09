# Changelog

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

[2.0.0]: https://github.com/rishureetesh/lextrix/releases/tag/v2.0.0
[1.0.2]: https://github.com/rishureetesh/lextrix/releases/tag/v1.0.2
[1.0.1]: https://github.com/rishureetesh/lextrix/releases/tag/v1.0.1
[1.0.0]: https://github.com/rishureetesh/lextrix/releases/tag/v1.0.0
