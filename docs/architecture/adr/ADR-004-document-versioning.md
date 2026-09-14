# ADR-004 Document Versioning (Linear)

- Status: Accepted
- Date: 2026-09-14
- Phase: 3

## Context

Phase 1–2 delivered headless `DocumentState`, `ChangeSet` transitions, transactions, and Strategy B editor mirroring. `Document.revision` is a monotonic mutation counter used for base-state awareness — it is **not** yet a first-class immutable version identity with retained snapshots.

Future AI, collaboration, and anchors need to answer: “which document state is this?” and “what ChangeSet takes A → B?” without treating ChangeSet as the document.

## Decision

### What a Version is

A **Version** is an immutable identity for a **DocumentState** snapshot:

```text
Version = { id, documentId, sequence, revision, contents, parentId, changeFromParent?, meta? }
```

- **contents** = insert-only document ChangeSet (same representation as DocumentState).
- **Not** HTML, DOM, or “array of ChangeSets as the document.”
- ChangeSet remains the **transition**; Version identifies the **state**.

### Linear chain only

```text
v0 → v1 → v2 → …
```

Branches, merge, rebase, and distributed graphs are **out of scope** (future ADRs).

### Immutability

Once recorded, Version N’s contents never change. Mutations produce Version N+1.

### revision vs Version vs sequence

| Concept | Meaning |
|---------|---------|
| `id` | Unique Version identity within a document lineage (e.g. `doc:v3`). |
| `sequence` | 0-based ordinal in the linear chain for this document store/session. |
| `Document.revision` | Mutation counter / sync metadata. Advances on non-empty `apply`. |
| `Document.versionId` | Stable id for the current state’s Version. |
| `DocumentVersion` | Retained immutable snapshot + lineage (on `DocumentHandle`). |

For linear sessions, `sequence` often aligns with retained versions and typically tracks `revision` after non-empty applies. They remain conceptually distinct.

### Persistence (ADR-012)

Version wire documents are **self-contained** (`contents` = full snapshot) and include lineage (`parentId`, `changeFromParent`). See [ADR-012](./ADR-012-serialization-and-wire-contracts.md).

### Empty transitions

Empty ChangeSet / empty transaction: **no new Version** (no-op; same as Phase 2 empty `apply`).

### Transactions

One commit → one ChangeSet → one `apply` → **at most one** version step (not one version per inner op).

### Snapshot representation

**Full frozen document ChangeSet per version** (clone + freeze).

- Correct, simple, headless.
- Tradeoff: O(n) space per version; acceptable for Phase 3.
- Future structural sharing possible without changing Version identity APIs (contents remain ChangeSet-shaped).

### History (undo/redo)

Editor History remains event-based undo/redo. **Version ≠ History.** Do not merge them.

### Strategy B

Editor remains mutation source; DocumentHandle records versions when mirroring settled ChangeSets. No Document→Editor feedback loop.

### Diff

`diff(versionA, versionB)` = `contentsA.diff(contentsB)` (existing ChangeSet.diff). Same document required.

## Alternatives considered

1. **revision alone as Version** — Insufficient: no retained snapshots / parent ChangeSet.
2. **Version = list of ChangeSets only** — Rejected: conflates state with transitions.
3. **Structural sharing now** — Deferred; correctness first.
4. **Branches in Phase 3** — Explicitly deferred.

## Consequences

- Version history lives on experimental `DocumentHandle` (session), not on ephemeral standalone `Document` values without a handle.
- Cross-document version compare throws.
- Benchmarks must record snapshot cost growth.

## Migration strategy

1. Add `documentId` / `versionId` to Document.
2. Record versions on DocumentHandle apply/resync.
3. Expose `diffVersions` + `currentVersion` / `getVersion`.
4. Keep published editor APIs unchanged.
