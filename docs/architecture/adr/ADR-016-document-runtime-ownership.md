# ADR-016 Document Runtime Ownership & Session Model

- Status: Accepted
- Date: 2026-09-14
- Phase: 8

## Context

Phase 7 froze wire contracts (`lextrix-change/wire`). Runtime Document APIs remained under `lextrix-change/experimental` without a clear public ownership boundary. External applications need a stable in-process session model before persistence/transport (Phase 9+).

## Decision

### Ownership

```text
Document        = immutable DocumentState value
DocumentHandle  = mutable live session owning:
                    HEAD Document pointer,
                    linear Version lineage,
                    transactions,
                    proposals,
                    anchors/ranges,
                    observers
```

- Exactly **one** Handle owns exactly **one** in-memory Version lineage.
- Multi-document apps own `Map<documentId, DocumentHandle>` — **no** engine `DocumentStore` / registry.

### Same documentId

```text
two Handles + same documentId
  ≠
shared synchronized document
```

Each Handle has an independent `LinearVersionStore`. Synchronization is an application/collaboration concern, not an engine guarantee.

### Mutation path

```text
Handle.apply → Document.apply → record Version → notify observers → return
```

Direct `Document.apply` is a pure value transition and is **unsupported** as a session mutation path (does not update Handle versions/observers).

### Rejected for Phase 8

- `DocumentStore` / global registry
- Branches / DAG / CRDT
- Persistence backends / transport

### Lifecycle

Handle lifetime is **GC-owned**. No mandatory `dispose()`. Observer cleanup uses `unsubscribe()`. Optional future `dispose()` only if retained resources require it.

### Version identity

| Field | Meaning |
|-------|---------|
| `DocumentVersion.id` | Immutable Version identity (`${documentId}:v${sequence}`) |
| `sequence` | 0-based ordinal in this Handle's linear store |
| `revision` | `Document.revision` at snapshot (mutation counter) |
| `Document.versionId` | Id derived from `documentId` + **revision** for the value snapshot |

On the normal Handle.apply path, `sequence` and `revision` advance together from matching roots, so `Document.versionId` and `currentVersion().id` stay aligned. They are **conceptually distinct** — never treat them as interchangeable types in API contracts.

## Alternatives considered

1. **Document as sole public API** — Insufficient (no history/proposals/HEAD).
2. **DocumentStore** — Unnecessary; apps can map Handles.
3. **Mandatory dispose** — Overkill without native resources; unsubscribe covers listeners.

## Consequences

- Stable runtime export graduates Handle + Document (not VersionStore class).
- ADR-017 defines observation on Handle.
- Phase 9 persistence adapters hydrate/load into Handles.

## Migration strategy

1. Accept ADR-016 / ADR-017.
2. Implement `subscribe` + typed errors.
3. Export thin `lextrix-change/document`.
4. Keep remainder experimental.
