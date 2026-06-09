# Architecture

Lextrix is a monorepo. Document changes flow through ChangeSet; the DOM layer keeps the browser in sync.

```text
User Input → Selection → Commands → Change Engine → Document Model → DOM Sync → Browser
```

## Packages

| Package | Role |
|---------|------|
| `lextrix-change` | ChangeSet, compose, diff, transform, invert |
| `lextrix-dom` | Blots, registry, DOM sync, mutation reconciliation |
| `lextrix-core` | Editor shell, selection, PluginHost, public API |
| `lextrix-formats` | Built-in inline, block, and embed formats |
| `lextrix-modules` | Clipboard, keyboard, history, toolbar, table, … |
| `lextrix-serialize` | Markdown, MDX, JSON ↔ ChangeSet (no core dependency) |
| `lextrix-ui` | Toolbar widgets |
| `lextrix-themes` | Snow, bubble, slate, dawn |
| `lextrix` | Published npm bundle (UMD + CSS) |

## Document model

```text
Scroll
 ├── Block
 │     ├── Inline → Text
 │     └── Embed
 └── ...
```

## Change engine

Public API: `ChangeSet` with `insert`, `delete`, `retain` ops. Internal pipeline uses `DocumentOperation` and `OperationStream` for compose/diff/transform/invert.

See [ChangeSet guide](../guides/change-set.md).

## Formatting and registry

`FormatDefinitionCatalog` holds metadata; `FormatRegistry` resolves formats at runtime. Extensions register via `Lextrix.register()` and `lxr/*` paths.

See [Formats guide](../guides/formats.md).

## Selection

`NativeSelectionBridge` reads/writes browser selection. `DocumentIndexMapper` maps between document and DOM positions.

## DOM sync

`MutationCoordinator` observes browser mutations and reconciles the internal document tree.

## Plugins

`PluginHost` owns module instances. Themes load modules from editor options.

See [Modules guide](../guides/modules.md).

## Where to start (contributors)

1. `packages/change` — ChangeSet and OT
2. `packages/core` — editor orchestration
3. `packages/formats` — format definitions
4. `packages/dom` — blots and DOM sync
5. `packages/core/src/core/plugins` — module lifecycle

Monorepo setup: [.github/DEVELOPMENT.md](../../.github/DEVELOPMENT.md).
