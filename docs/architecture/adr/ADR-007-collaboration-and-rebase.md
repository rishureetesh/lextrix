# ADR-007 Collaboration and Rebase Architecture

- Status: Accepted
- Date: 2026-09-14
- Phase: 5A design / 5B implementation

## Context

Phases 1–4 deliver ChangeSet OT, Document, Versions, Anchors/Ranges, and Proposals. Proposals currently **reject** when `baseVersionId ≠ HEAD`. Concurrent actors (multiplayer, AI, multi-tab) need a defined way to reconcile ChangeSets without turning the Document engine into a network protocol or adopting CRDT.

Existing algebra (ADR-002):

```text
A.transform(B, priority) → B′
Convergence: D∘A∘A.transform(B,true) == D∘B∘B.transform(A,false)
```

Linear versions store `changeFromParent` — enough to walk base→target for rebase.

## Decision

### 1. Problem collaboration solves

Multiple independent actors produce ChangeSets against known Versions; the system converges DocumentState without requiring a single live editor process.

### 2–4. Layer ownership

| Layer | Owns | Does not own |
|-------|------|--------------|
| **Document engine** | apply, versions, transform, future `rebaseProposal`, schema validation | Transport, rooms, auth |
| **Collaboration adapter** | pending queue, remote ingest, ack/dedup, calling rebase/apply | DOM, DocumentState internals |
| **Transport** | delivery | OT / Document |

### 5. Versions as change bases

Every remote/local collaborative change carries `baseVersionId`. Linear `parentId` + `changeFromParent` identify the path between versions.

### 6. Concurrent transform

Use existing Quill-compatible transform. When change C is already accepted and P is pending against the same prior base:

```text
P′ = C.transform(P, true)   // accepted change has priority
```

### 7. Proposal rebase

```text
rebaseProposal(P, target):
  for C in changesBetween(P.base, target):  // changeFromParent steps
    P.change = C.transform(P.change, true)
  P.baseVersionId = target.id
```

Unrelated versions → error. Same version → no-op. No silent accept of stale proposals without rebase.

### 8. Conflict

- **Structural:** transform/apply cannot yield valid document → reject.
- **Semantic:** OT succeeds but intent ambiguous → engine accepts OT result; app may warn.

### 9–10. Pending / remote

Adapter holds `confirmedVersion` + `pendingLocal[]`. On remote apply: advance Document, rebase pendings, project remote to editor (ADR-008).

### 11. Metadata

Engine: existing `ChangeMeta` + Proposal fields. Adapter envelope: `changeId` for dedup/ack. Actor/client IDs optional at adapter, not Document core.

### 12. Convergence guarantee

Mandate Phase 5B property tests for the ADR-002 pair plus multi-step rebase: `apply(base, compose(chain + rebased))` equals applying in alternate orders where defined.

### 13. Editor projection

**Hybrid Strategy B+** (see ADR-008): keep editor-first local path; add isolated Document→Editor for remote/projection-originated changes. Do not flip full Document-first in Phase 5.

### 14. CRDT deferred

OT ChangeSet algebra is the collab foundation. CRDT adapters remain possible later because Document consumes ChangeSets, not an OT network protocol.

### 15. Branches/merges deferred

Linear versions only. Rebase is along a single parent chain.

### 16. Outside Phase 5

WebSockets, presence, cursors, AI, cloud, auth, review UI, structural sharing, package renames.

## Alternatives considered

1. **Document-first for all edits now** — High editor risk (IME, MO, selection); deferred.
2. **Embed OT protocol inside Document** — Rejected; keeps engine portable.
3. **CRDT replace ChangeSet** — Out of scope; breaks Quill-compatible wire.
4. **Composed-diff-only rebase without pairwise proof** — Risky; require tests before optimizing.

## Consequences

- Phase 5B implemented: `changesBetween` / `rebaseProposal` / `rebaseThenAccept`; stale `acceptProposal` still rejects.
- In-memory adapter (`InMemoryCollaborationAdapter`) uses coordinator accept-order + server-side transform; `changeId` stays at envelope layer.
- Embed handlers must be identical across peers.
- **Collaboration ≠ Transport.** Document remains network-agnostic.

### Implementation clarifications (5B)

- Rebase walks `changeFromParent` only — **not** `diffVersions` as the rebase path.
- Rebase returns a **new** proposal (metadata/`id` preserved); original is not mutated.
- Adapter two-phase delivery: remotes before own-acks so pending survives concurrent flush.
- Causal same-client pendings use `dependsOn` so the coordinator does not double-transform sequential locals.

### Wire contract (Phase 7 / ADR-012)

Normative serialized collaboration envelope:

```text
{ schemaVersion, kind: "collab-envelope", changeId, documentId, baseVersionId, change: { ops }, meta, dependsOn }
```

See [ADR-012](./ADR-012-serialization-and-wire-contracts.md) and `lextrix-change/wire`. Transport implementations consume this shape; they are not part of the engine.

## Migration strategy

1. Accept this ADR + ADR-008.
2. Implement rebase in `lextrix-change/experimental` with fuzz tests.
3. Implement projection path with `origin: 'projection'`.
4. Spike in-memory adapter; transport later (must use ADR-012 envelopes).
