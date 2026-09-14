# Document Transactions (Phase 2 Design)

- Status: Accepted (Phase 2 implementation design)
- Date: 2026-09-14
- **Not an ADR number:** ADR-004 remains reserved for **Document Versioning** (Phase 3).

## Context

Phase 1 proved headless `DocumentState.apply(ChangeSet)`. Phase 2 must introduce a transaction → ChangeSet → DocumentState pipeline and bridge the production editor without inverting blot ownership.

## Decision

### Law

```text
DocumentState X
      │
      │  transaction → commit → ChangeSet
      │
      ▼
Document.apply(ChangeSet)   // sole Document mutation path
      │
      ▼
DocumentState Y
```

No alternate Document mutation APIs (`applyTransaction` / `applyEditorChange` / `applyAIChange` as independent systems). Sources differ; Document consumes ChangeSets only.

### Transaction API (experimental)

```ts
const tx = document.transaction()
tx.insert(index, text, attributes?)
tx.delete(index, length)
tx.format(index, length, attributes)
const { change, meta, baseRevision } = tx.commit({ source: 'user' })
const next = document.apply(change) // separate; or DocumentHandle.commitTransaction
```

### Lifecycle semantics

| Case | Behavior |
|------|----------|
| **Begin** | Captures base `Document` + `baseRevision`. Ops accumulate against sequential working state. |
| **Commit** | Produces exactly one logical `ChangeSet` + `ChangeMeta`. Does **not** mutate Document by itself. |
| **Empty commit** | Returns an **empty ChangeSet** (`length() === 0`) with `empty: true`. Never `null`. |
| **Abort** | Marks aborted; no ChangeSet application; further ops/commit throw. |
| **Double commit** | Throws. |
| **Commit after abort** | Throws. |
| **Nested transactions** | **Rejected** on a mutable `DocumentHandle` (one open tx). Independent txs on immutable snapshots are allowed. |

### Base-state awareness (pre-versioning)

Each Document carries a monotonic `revision` (number). Transactions record `baseRevision`. Full version graphs are Phase 3 (ADR-004); this field must not be removed.

### Metadata

```ts
type ChangeSource = 'user' | 'api' | 'system' | 'remote' | 'ai' | 'silent' | 'projection'

interface ChangeMeta {
  source: ChangeSource
  authorId?: string
  intent?: string
  origin: 'transaction' | 'editor' | 'projection' | 'system'
}
```

Extensible; AI/remote are placeholders only — not implemented.

### Editor bridge strategy

**Strategy B — editor-first + Document reconciliation** (see [editor-document-bridge.md](./editor-document-bridge.md)).

Synchronization direction (Phase 2):

```text
Editor (blot/DOM authoritative)
        │  settled ChangeSet from modify()
        ▼
Document.apply(change)   // one-way mirror
```

No Document → Editor projection loop in Phase 2 default path.

### Failure behavior (Strategy B)

Editor may already be mutated when Document.apply fails. Recovery:

1. Attempt `Document.apply(change)`.
2. On validation/apply failure: **replace** Document contents from the live editor ChangeSet snapshot (editor remains authoritative).
3. Never invent ad-hoc partial rollback of blots.

Document-first commits (experimental `experimentalCommit`) validate by building the ChangeSet first, then apply through the existing editor `updateContents` path so blot + Document stay aligned via the same reconcile hook.

### History

History continues to consume `text-change` / `editor-change` events. It is **not** document versioning.

### Attribute canonicalization

Deferred — equality tests may normalize key order; construction does not silently rewrite attributes (Phase 1 unresolved question).

## Alternatives considered

1. **ADR-004 for transactions** — Rejected; roadmap reserved ADR-004 for versioning.
2. **Strategy A Document-first for all input including typing** — Rejected for Phase 2; typing/MutationObserver path would require blot rewrite or unsafe projection.
3. **Commit auto-applies only** — Rejected as sole API; keep `commit` → ChangeSet and `apply` as separate steps, with optional `commitTransaction` helper.

## Consequences

- Experimental exports under `lextrix-change/experimental` and optional editor bridge APIs.
- Production 2.1.x editor APIs unchanged.
- Phase 3 can attach revisions/snapshots without redesigning transactions.
