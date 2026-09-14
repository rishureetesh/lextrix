# ADR-002 ChangeSet as Core Primitive

- Status: Accepted
- Date: 2026-09-14
- Phase: 1

## Context

`lextrix-change` already implements Quill-compatible OT:

- Public API: `ChangeSet` with `ChangeOp` (`insert` | `delete` | `retain` + attributes)
- Internal engine: `DocumentOperation` + `OperationStreamOT`
- Bridge: `fromLegacyOps` / `toLegacyOps`

Phase 1 needs explicit **guarantees** and tests so DocumentState, history, collab, and AI can share one change language.

## Decision

### Guarantees ChangeSet provides

| Operation | Meaning in Lextrix |
|-----------|-------------------|
| `compose(A, B)` | Sequential application: “do A, then B” as one change |
| `transform(A, B, priority)` | Concurrent OT: `A.transform(B, priority)` returns **B′** = B transformed against A (Quill signature) |
| `invert(A)` relative to base doc D | Change that undoes A when applied after A on D |
| `diff(D1, D2)` | Change that transforms document D1 into D2 |

`apply` on DocumentState (Phase 1) is defined as **document compose**:

```text
apply(D, C) ≜ D.contents.compose(C)
```

### Invariants (where Lextrix semantics permit)

**Compose associativity** (for compatible operation sequences):

```text
compose(compose(A, B), C)  ==  compose(A, compose(B, C))
```

(Equality of normalized ops / document effect.)

**Invert round-trip** (A is a change against document D):

```text
apply(apply(D, A), invert(A, D))  ==  D
```

i.e. `D.compose(A).compose(A.invert(D))` equals D (document equality).

**Transform convergence** (A, B concurrent against same D; Lextrix/Quill priority convention):

```text
apply(apply(D, A), A.transform(B, true))
==
apply(apply(D, B), B.transform(A, false))
```

**Diff correctness** (D1, D2 documents):

```text
apply(D1, D1.diff(D2))  ==  D2
```

### Relationship to DocumentState

- ChangeSet describes **transitions**.
- DocumentState holds **current contents** (a document ChangeSet).
- Never treat an arbitrary change (with deletes) as long-lived document state.

### Canonical internal operation representation

**Decision for Phase 1: keep the dual model.**

| Layer | Role |
|-------|------|
| **Public `ChangeOp`** | Stable wire / API / serialization format |
| **Internal `DocumentOperation`** | OT engine representation (`kind: insert\|delete\|retain`) |
| **Bridge** | Lossless for Lextrix’s supported op shapes (see dual-op note) |

Do **not** export `DocumentOperation` as public API in Phase 1 (avoids wire-format commitment). Do **not** remove the bridge. Correctness > purity.

Rationale documented in `docs/architecture/dual-operation-model.md`.

## Alternatives considered

1. **Export DocumentOperation now** — Deferred; premature API surface.
2. **Rewrite OT on ChangeOp only** — High risk; existing engine is battle-tested via Quill lineage.
3. **CRDT instead of OT** — Out of scope; transform remains the collab foundation later.

## Consequences

- Property/fuzz tests must use **actual** Lextrix method signatures (`a.transform(b, priority)` transforms **b**).
- Failing fuzz cases must be reproducible by seed.
- Public builders remain mutable (Quill DX); Documents should freeze/clone contents when sharing.

## Migration strategy

1. Add generators + property/fuzz suite under `packages/change/tests`.
2. Keep public exports unchanged except optional `lextrix-change/experimental` for Document.
3. Revisit exporting native ops only if collab protocol requires it (future ADR).
