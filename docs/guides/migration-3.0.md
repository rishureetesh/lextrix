# Migrating to Lextrix 3.0.0

From **2.1.x** editor releases to the **3.0.0** document-engine platform release.

## What changed

3.0.0 packages the completed Phase 0–12 document engine with the existing editor:

- Stable `lextrix-change/document`, `/wire`, `/persistence`, `/collaboration`
- `lextrix-collab` authoritative sessions
- `lextrix-server` reference PostgreSQL + WebSocket host
- `lextrix-intelligence` proposal producers (AI never mutates Document directly)
- Snapshots / compaction / presence **protocol** / lifecycle ports
- Playground demonstrates these as a consumer of real APIs

**Wire:** ADR-012 `schemaVersion` remains **1** (not bumped with the package major).

## Install

```bash
npm install lextrix@3.0.0
# optional
npm install @lextrix/react@0.3.0   # peer lextrix@^3.0.0
npm install lextrix-change@3.0.0 lextrix-collab@3.0.0
```

## Editor API

Editor mount / themes / modules / `importContent` / `exportContent` remain the primary path.

Experimental Document bridge (on by default):

```js
editor.getExperimentalDocument();
editor.getExperimentalVersion();
editor.getExperimentalHandle();
editor.acceptProposalAndProject(proposal);
```

Disable with `{ experimentalDocument: false }` if you only want classic editor behavior.

## Breaking / intentional majors

| Area | Note |
|------|------|
| Package version | Coordinated **3.0.0** for Lextrix workspace packages |
| `@lextrix/react` | Independent line **0.3.0**; peer `lextrix@^3.0.0` |
| New packages | `lextrix-collab`, `lextrix-server`, `lextrix-intelligence` may not have been published in 2.1 consumer installs |
| Deprecated | Prefer `importContent` / `exportContent` over `import` / `export` (since 2.1) |

## Not breaking (do not “upgrade” these numbers)

- Wire `schemaVersion: 1`
- ADR numbers
- Dependency library majors unrelated to Lextrix

## Compatibility

Legacy ChangeSet bare-ops arrays and documented migration aliases remain accepted per [wire-compatibility](../architecture/wire-compatibility.md).

## Further reading

- [CHANGELOG 3.0.0](../../CHANGELOG.md)
- [API stability](../architecture/api-stability.md)
- [Final validation](../architecture/FINAL-SYSTEM-VALIDATION-REPORT.md)
