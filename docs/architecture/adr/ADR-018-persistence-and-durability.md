# ADR-018 Persistence Model & Durability Boundary

- Status: Accepted
- Date: 2026-09-14
- Phase: 9
- Related: [ADR-012](./ADR-012-serialization-and-wire-contracts.md), [ADR-016](./ADR-016-document-runtime-ownership.md), [ADR-017](./ADR-017-document-observation.md)

## Context

Phase 8 delivered a stable in-process DocumentHandle session with observers and `fromVersions` hydration. Persistence must make Version history durable without making storage the mutation engine, without a second op format, and without rolling back committed Document state when writes fail.

## Decision

### Durable unit

Persisted history is a sequence of **ADR-012 Version wire documents** (`kind: "version"`, `schemaVersion: 1`), including `contents`, `parentId`, and `changeFromParent`.

```text
wire representation = ADR-012 Version JSON
storage record      = wire bytes + optional adapter envelope (etag, blob id)
```

No second ChangeSet/operation dialect.

### Ownership

| Layer | Owns |
|-------|------|
| Engine | ChangeSet, Document mutation, Version creation, lineage/compose validation, hydration correctness |
| Persistence adapter | Storage I/O, physical durability, retry, storage atomicity |
| Application | AuthN/Z, tenancy, when to flush |

### Durability ordering (Model B)

```text
Handle.apply
  → Version commit
  → observer notification
  → persistence append (adapter/consumer)
  → apply returns (persist may fail after)
```

### Persistence failure

If append fails after Version commit:

```text
Handle HEAD     = new Version   (valid)
Durable HEAD    = previous      (lag)
Session         = dirty
```

**Never** roll back Document/Version because persistence failed. Adapters expose dirty/lag and retry with **idempotent** `appendVersion` keyed by `version.id`.

### Idempotent append

```text
append(V); append(V)  → one logical Version
```

Same `version.id` with **different** payload → `persistence_conflict` (not success).

### Hydration

```text
load records → wire parse → lineage validate → compose-integrity → fromVersions
```

Compose integrity (default on for untrusted loads):

```text
parent.contents ∘ changeFromParent ≡ child.contents
```

Fail closed on corruption. Unsafe skip is explicit and experimental.

### Non-goals

Vendor databases, compaction implementation, AuthN/Z, making persistence part of `Handle.apply`.

## Alternatives considered

1. **Persist before notify (Model A)** — Couples durability into mutation latency; rejected.
2. **Change-log only** — Weaker random access; Version wire already includes lineage.
3. **Rollback Handle on persist failure** — Violates Document authority; rejected.

## Consequences

- `lextrix-change/persistence` ports + in-memory reference adapter for tests.
- Phase 10 production stores consume this contract.
- Observers remain independent of durability success.

## Migration strategy

Additive. Phase-8 APIs unchanged. Stricter hydrate defaults for compose checks.
