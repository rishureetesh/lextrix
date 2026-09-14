# Lextrix documentation

**Canonical source:** this folder in the GitHub repo (`docs/`). It matches each release. The [site docs](https://iamreetesh.com/docs) mirror this content and may lag briefly after a release.

## Getting started

Follow this order if you are evaluating Lextrix for the first time:

| # | Guide | Description |
|---|-------|-------------|
| 1 | [Quick start](./getting-started/quick-start.md) | Install, themes, events |
| 2 | [Evaluation guide](./getting-started/evaluation.md) | Linear path: install → export → modules |
| 3 | [Cookbook](./guides/cookbook.md) | Copy-paste recipes |
| 4 | [React (`@lextrix/react`)](./guides/react.md) | Official React component |
| — | [Migrating to 3.0.0](./guides/migration-3.0.md) | Upgrade from 2.1.x |
| — | [Migrating to 2.1.0](./guides/migration-2.1.md) | Historical 2.0 → 2.1 |
| 5 | [Framework integration](./guides/frameworks.md) | Next.js, Vue, script tag, manual mount |
| 6 | [TypeScript](./guides/typescript.md) | Published `.d.ts` and setup |
| 7 | [DOM mounting](./guides/dom-mounting.md) | Toolbar placement and cleanup |
| 8 | [Serialization](./guides/serialization.md) | HTML, Markdown, MDX, JSON |
| 9 | [API reference](./api/reference.md) | Editor methods, modules, events |

Also: [Live playground](https://iamreetesh.com/lextrix) — try Lextrix in the browser without installing.

## Guides

| Guide | Description |
|-------|-------------|
| [Themes](./guides/themes.md) | Snow, bubble, slate, dawn + safe theme switching |
| [Configuration](./guides/configuration.md) | Modules, formats, themes, upload |
| [Modules](./guides/modules.md) | Built-in modules and authoring |
| [ChangeSet](./guides/change-set.md) | OT and JSON wire format |
| [Formats](./guides/formats.md) | Custom formats, embeds, registration |

## Architecture

| Guide | Description |
|-------|-------------|
| [Overview](./architecture/overview.md) | Packages and data flow (contributors) |
| [Document engine transformation](./architecture/document-engine-transformation.md) | Phase 0 discovery (historical) + pointers to current ADRs |
| [Transformation progress](./architecture/TRANSFORMATION-PROGRESS.md) | Phase tracker for the engine release |
| [Wire format (ADR-012)](./architecture/wire-format.md) | Stable ChangeSet / Version / Proposal / envelope contracts |
| [API stability](./architecture/api-stability.md) | Stable vs experimental export map |
| [Runtime concurrency](./architecture/runtime-concurrency.md) | Handle concurrency matrix |
| [ADRs](./architecture/adr/README.md) | Architecture Decision Records |
| [Future roadmap](./architecture/FUTURE-ROADMAP.md) | Post–Phase 0–12 strategy (discovery only; not a build commitment) |
| [Repository cleanup](./architecture/REPOSITORY-CLEANUP-REPORT.md) | Post-validation obsolete-artifact cleanup report |
| [3.0.0 release readiness](./architecture/LEXTRIX-3.0.0-RELEASE-READINESS.md) | Final release checklist, playground matrix, regression |
| [Playground guide](./playground.md) | How to run and extend the 3.0 platform playground |
| [3.0.0 release readiness (interim)](./architecture/RELEASE-3.0.0-READINESS.md) | Earlier prep notes (superseded by LEXTRIX-3.0.0 report) |

## Development

[.github/DEVELOPMENT.md](../.github/DEVELOPMENT.md) · [.github/CONTRIBUTING.md](../.github/CONTRIBUTING.md)
