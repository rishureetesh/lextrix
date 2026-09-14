# Collaboration Architecture (Phase 5A–5B)

- Status: Accepted (architecture + Phase 5B implementation)
- Date: 2026-09-14
- Related: [ADR-007](./adr/ADR-007-collaboration-and-rebase.md), [ADR-008](./adr/ADR-008-document-to-editor-projection.md)

**Collaboration ≠ Transport.** The Document engine remains network-agnostic.

---

## 1. What exists today (repository facts)

| Layer | Actual behavior |
|-------|-----------------|
| **ChangeSet.transform** | Quill signature: `A.transform(B, priority)` returns **B′** (B against A) |
| **Convergence** | Fuzz-proven: `D∘A∘A.transform(B,true) == D∘B∘B.transform(A,false)` (2000 iters) |
| **Attributes** | Priority wins conflicts; non-priority side overwrites when `priority=false` |
| **Versions** | Linear; each child stores `changeFromParent` + `parentId` + full snapshot |
| **Proposals** | Accept only if `baseVersionId === HEAD`; no rebase |
| **Editor bridge** | Strategy B: Editor → Document only; `origin: 'editor'` |
| **History** | Undo/redo via events — not version history |
| **Wire** | Public `ChangeOp` JSON; internal `DocumentOperation` private |

---

## 2. Transform contract (exact)

```text
A.transform(B, priority)  →  B′
```

Meaning: “Given concurrent A and B against the same base, produce B as it should look **after A has already been applied**.”

| `priority` | Meaning when A and B conflict (e.g. both insert at same index; attribute clash) |
|------------|----------------------------------------------------------------------------------|
| `true` | **A wins** — B′ is adjusted assuming A has precedence |
| `false` | **B keeps more of its intent** relative to A (A does not take precedence) |

**Convergence pair** (already tested):

```text
Left:  apply(apply(S, A), A.transform(B, true))   // A first, A has priority
Right: apply(apply(S, B), B.transform(A, false))  // B first, A still “wins” via false on reverse
```

These must document-equal. Lextrix already asserts this.

**Position transform:** `change.transformPosition(index, priority)` — used by anchors; `priority=true` ≈ affinity `before`.

---

## 3. Transform vs Rebase

| Concept | Role |
|---------|------|
| **Transform** | Algebra on two concurrent ChangeSets against one base |
| **Rebase** | Move a ChangeSet/Proposal from Version A to Version B by transforming through the accepted chain A→B |

Rebase **uses** transform; it is not a second OT engine.

---

## 4. Rebase algorithm (implemented)

Given linear history and `changeFromParent` on each version:

```text
rebaseProposal(P, targetVersion):

  if P.documentId ≠ target.documentId → error wrong_document
  if P.baseVersionId unknown → error unknown_version
  if P.baseVersionId === target.id → return equivalent new proposal

  steps = changesBetween(P.baseVersionId, target.id)
  rebased = P.change
  for C in steps:                    // chronological, base→target
    rebased = C.transform(rebased, true)  // accepted C has priority
  return new Proposal { ...P meta/id, base: target, change: rebased }
```

**Same-version:** identity copy (new object).  
**Empty change:** remains empty.  
**Structural failure:** if `transform`/`apply` dry-run fails → reject.  
**Semantic conflict:** transform succeeds but intent may be wrong — engine returns OT result; application/UI decides.

**Do not** use `diffVersions(base, target)` as the default rebase path. Sequential `changeFromParent` is canonical until equivalence is formally proven.

### Worked example

```text
S = "hello"
A = retain(5).insert("!")     // "hello!"
B = retain(0).insert("X")     // "Xhello"

A.transform(B, true)  → B′ that applies after A → "Xhello!"
B.transform(A, false) → A′ that applies after B → "Xhello!"
```

Rebase: A accepted first → HEAD after A; pending B becomes `A.transform(B, true)`.

---

## 5. Layering

```text
┌─────────────────────────────┐
│ Application (editor UI, etc)│
├─────────────────────────────┤
│ Collaboration Adapter       │  pending queue, ack, remote ingest
├─────────────────────────────┤
│ Proposal / Rebase           │  Document engine experimental APIs
├─────────────────────────────┤
│ Document + Versions         │  apply, linear history
├─────────────────────────────┤
│ ChangeSet Transform Algebra │  lextrix-change
└─────────────────────────────┘
         ↕
    Transport (out of engine)
```

| Owner | Responsibilities | Must NOT own |
|-------|------------------|--------------|
| **Document engine** | apply, versions, transform, rebaseProposal, validate | sockets, users, rooms |
| **Collaboration adapter** | pending local queue, remote ingest, ack/confirm mapping, call rebase/apply | DocumentState, DOM, rendering |
| **Transport** | bytes in/out, retry | OT, Document |

Package home for Phase 5B: keep rebase in `lextrix-change/experimental`; adapter later as experimental module/package only when needed — **no rename now**.

---

## 6. Pending / confirm model (conceptual)

```text
confirmedVersion = HEAD known agreed with peers/server
pendingLocal[]   = ChangeSets/Proposals based on confirmed or on prior pending
```

On remote R (base = confirmed):

1. Apply R to Document (→ new Version) **or** receive authoritative Version+change.
2. For each pending L: `L = rebase(L, newHead)`.
3. Project remote into editor (ADR-008) with `origin: 'projection'`.

Duplicate detection: **collaboration-layer** `changeId` (or hash of `{actorId, clientSeq}`) — not Document engine. Engine remains idempotent only if same ChangeSet applied twice is caller’s problem; adapter should dedupe before apply.

---

## 7. Metadata

Reuse `ChangeMeta`. Add only what correctness needs at adapter layer:

| Field | Where | Why |
|-------|-------|-----|
| `source: 'remote'` | ChangeMeta | Already exists |
| `changeId` | Adapter envelope | Dedup / ack |
| `actorId` / `clientId` | Adapter envelope | Optional; not Document-required |
| `baseVersionId` | Proposal / envelope | Already on Proposal |

Do not put WebSocket session IDs into DocumentState.

---

## 8. Conflict taxonomy

| Type | Definition | Engine behavior |
|------|------------|-----------------|
| **Structural** | Cannot produce applicable ChangeSet / apply fails schema | Error / reject |
| **Semantic** | OT succeeds; human intent unclear (delete vs edit same text) | Accept OT result; surface to app |

No “smart merge” of meaning in the engine.

---

## 9. Attribute / embed notes

- **Attributes:** deterministic via priority (ChangeAttributes.transform).
- **Embeds:** transform delegates to registered embed handlers — collaboration requires same handlers registered on all peers.
- **Block/line formats:** represented as attributes on newline inserts / retains — covered by same OT if ops are well-formed.

---

## 10. Wire format

Sufficient payload:

```json
{
  "documentId": "…",
  "baseVersionId": "…",
  "changeId": "…",
  "dependsOn": ["…"],
  "ops": [ /* ChangeOp[] */ ],
  "meta": { "source": "remote", "authorId": "…" }
}
```

`dependsOn`: earlier same-client `changeId`s already accepted. Missing predecessors → `CausalDependencyError` (no out-of-order buffering in the in-memory coordinator).

ChangeSet JSON already crosses process boundaries. Treat remote ops as **untrusted** → validate in adapter then `Document.apply` / schema.

---

## 14. Failure taxonomy & recovery (Phase 6L–6M)

Failures are **not interchangeable**. See [ADR-014](./adr/ADR-014-collaboration-failure-and-recovery.md).

| Failure | Document | Proposal | Editor | Recovery |
|---------|----------|----------|--------|----------|
| Provider timeout / unavailable | unchanged | unchanged | unchanged | retry generation |
| Validation failure | unchanged | unchanged | unchanged | fix / new proposal |
| Stale proposal | unchanged | unchanged | unchanged | explicit rebase → review |
| Rebase failure | unchanged | unchanged | unchanged | reject / new proposal |
| Accept failure | unchanged | unchanged | unchanged | inspect error |
| Projection failure | **advanced** | accepted | desynced | guarded resync (no Document rollback) |
| Projection recovered via resync | advanced | accepted | synced | `status: 'resync'` |
| Duplicate remote / publish / ACK | unchanged after first | n/a | unchanged after first | ignore |
| Missing `dependsOn` | unchanged | n/a | unchanged | publish predecessor first |
| Wrong document ingest | unchanged | n/a | unchanged | drop envelope |

**Stale lifecycle:** generated → ready/pending → HEAD advances → stale → reject **or** explicit rebase → review again → accept. Never auto-rebase / auto-accept.

**Semantic conflict:** OT may succeed with ambiguous intent — engine does not choose “better” text; review/application decides.

**In-memory coordinator contract:** publish order = accept order. No CRDT, branches, or network protocol.

**Remote meta:** sanitized; forced `source: 'remote'` / `origin: 'system'` — peer claims cannot escalate authority ([ADR-015](./adr/ADR-015-security-and-trust-boundary.md)).

---

## 15. Transport & ACK ladder (Phase 9 / ADR-019)

```text
Adapter → CollabEnvelope wire → CollaborationTransport → remote Adapter
```

Transport is **envelope-only** (no OT / Version / Document mutation).

| ACK level | Meaning |
|-----------|---------|
| `received` | Bytes received |
| `persisted` | Durable record stored |
| `accepted` | Authoritative OT/accept order |
| `history` | Version in authoritative durable lineage |

**HEAD** ≠ **confirmed Version**. Confirmed advances only on ACK `history`. In-memory coordinator echoes are `accepted` only.

**Reference architecture (Phase 10):** Version-authoritative server — not implemented in Phase 9.

See [ADR-018](./adr/ADR-018-persistence-and-durability.md), [ADR-019](./adr/ADR-019-collaboration-transport.md).

---

## 11. Persistence (Phase 9 ports)

Durable unit = ADR-012 Version records via `DocumentPersistence`. `InMemoryDocumentPersistence` is reference-only. Production DB adapters are Phase 10+.

---

## 12. Performance

Phase 1–4 benches: transform ~0.02–0.03ms; versionDiff/apply grow with doc size; full snapshots ~KB per version. Rebase across N steps ≈ N transforms. Likely OK for moderate docs; measure rebase(N=100) in Phase 5B before structural sharing.

---

## 13. Phase 5B implementation plan (after approval)

1. **Rebase API** in experimental + property tests (sequential vs optional composed).
2. **Convergence suite expansion** (3-way, pending+remote).
3. **Document→Editor projection** (ADR-008): `updateContents` + `origin: projection` + skip bridge re-entry.
4. **Minimal in-memory CollaborationAdapter** (no network) for local/remote simulation.
5. **Transport** later — out of engine.

Do not implement 1–5 in Phase 5A.
