# Architecture

Lextrix **3.0** is a document engine with a rich-text editor as one projection.

```text
ChangeSet  →  Document / Handle / Version
                 ↓
         Editor (DOM projection)
                 ↓
    Collab session / Persistence ports / Intelligence proposals
```

## Conceptual model

| Concept | Role |
|---------|------|
| **ChangeSet** | Canonical transition |
| **Document** | Immutable document state |
| **Handle** | Live mutation / session owner |
| **Version** | Immutable history identity |
| **Proposal** | Requested ChangeSet vs a base Version |
| **History** | Editor undo/redo (≠ Versioning) |
| **Editor** | Projection of Document state |
| **Intelligence** | Proposal producer only |

## Packages

| Package | Role |
|---------|------|
| `lextrix-change` | ChangeSet OT, Document runtime, wire, persistence/collab **ports** |
| `lextrix-collab` | Authoritative collaboration protocol / sessions |
| `lextrix-server` | Reference PostgreSQL + WebSocket host (not core) |
| `lextrix-intelligence` | Deterministic / OpenAI proposal providers |
| `lextrix-dom` | Blots, registry, DOM sync |
| `lextrix-core` | Editor shell, selection, PluginHost, Document bridge |
| `lextrix-formats` / `modules` / `serialize` / `ui` / `themes` | Editor surface |
| `lextrix` | Published editor bundle |
| `@lextrix/react` | React bindings (independent semver) |
| `lextrix-demo` | Platform playground |

**DAG:** `lextrix-change` ↛ pg/ws/auth · `lextrix-collab` → change only · `lextrix-server` → change+collab+pg+ws

## Design principles

1. **ChangeSet is the mutation spine** — public wire stays Quill-compatible JSON ops (`schemaVersion: 1`).
2. **DocumentState ≠ ChangeSet**; **History ≠ Versioning**.
3. **AI never privileged-mutates** Document/Editor — proposals only.
4. **Server owns Version identity**; clients submit ChangeSets.
5. **CAS / changeId / owner_epoch** are correctness invariants for authoritative stores.
6. **Snapshots are checkpoints**, not a second HEAD; compaction is fail-closed.
7. **Presence is ephemeral** and cannot block accept.
8. **Editor is a projection** (Hybrid Strategy B+).
9. Prefer `importContent` / `exportContent`; PluginHost owns module lifecycle.
10. Auth, tenancy, billing stay **application-owned**.

## Where to start

1. [API stability](./api-stability.md)
2. [ADRs](./adr/README.md)
3. [Final validation](./FINAL-SYSTEM-VALIDATION-REPORT.md)
4. [Future roadmap](./FUTURE-ROADMAP.md) *(discovery only)*
5. [Playground](../../packages/demo/README.md) — `npm run demo`

Monorepo setup: [.github/DEVELOPMENT.md](../../.github/DEVELOPMENT.md).
