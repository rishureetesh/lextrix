# ADR-012 Serialization & Wire Contracts

- Status: Accepted
- Date: 2026-09-14
- Phase: 7

## Context

Phases 1–6 delivered a coherent headless document engine (`ChangeSet`, `Document`, `Version`, `Proposal`, collaboration semantics, intelligence boundaries). Runtime behavior is well tested, but **serializable contracts were not frozen**:

- No `schemaVersion` on wire documents
- `DocumentVersion.toJSON()` omitted `changeFromParent` (lineage incomplete for persistence)
- Collaboration envelopes existed only as in-memory TypeScript objects
- Experimental `ChangeProposal.toJSON` / `parseChangeProposal` had hardening but no compatibility promise
- `lextrix-change/experimental` grew into a large de-facto platform surface

Phase 7 freezes **wire contracts** (what may cross a process/network/persistence boundary) without implementing transport, persistence backends, AuthN/AuthZ, CRDT, or branches.

## Decision

### Scope

Normative wire documents (stable export: `lextrix-change/wire`):

| Kind | `kind` field |
|------|----------------|
| ChangeSet | `changeset` |
| DocumentVersion | `version` |
| ChangeProposal | `proposal` |
| Collaboration envelope | `collab-envelope` |

Each document includes:

```text
schemaVersion: number   // currently 1
kind: string            // discriminant
…payload fields
```

`ChangeMeta` / provenance travel **inside** proposal, version, and envelope documents. Metadata remains **inert** for OT.

Content formats in `lextrix-serialize` (HTML/Markdown/…) are **orthogonal** and are not Version/Proposal wire formats.

### ChangeSet wire

```text
{ schemaVersion: 1, kind: "changeset", ops: ChangeOp[] }
```

- `ops` is the same Quill-style operation model used by the engine (insert / delete / retain + attributes + embeds).
- Empty ChangeSet ⇒ `ops: []`.
- No second mutation abstraction. Parse produces a `ChangeSet` consumed by existing OT/apply.

### Version wire (persistence)

```text
{
  schemaVersion: 1,
  kind: "version",
  id, documentId, sequence, revision, parentId,
  contents: { ops },           // full DocumentState snapshot
  changeFromParent: { ops } | null,
  meta: ChangeMeta | null
}
```

**Self-contained:** `contents` is a complete DocumentState. Lineage fields (`parentId`, `changeFromParent`) enable chain reconstruction without requiring a live `VersionStore`. Full snapshots remain the storage model (structural sharing deferred).

#### Identity fields (must not be conflated)

| Field | Meaning |
|-------|---------|
| `id` | Unique Version identity within a document lineage |
| `sequence` | 0-based ordinal in the linear chain for this document session/store |
| `revision` | `Document.revision` at snapshot time (mutation counter / sync metadata) |

### Proposal wire

```text
{
  schemaVersion: 1,
  kind: "proposal",
  id, documentId, baseVersionId,
  change: { ops },
  meta, createdAt
}
```

Legacy experimental shape `{ ops, documentId, baseVersionId, … }` **without** `schemaVersion` is accepted as schema v1 migration input. New serializers emit ADR-012 shape (and may include deprecated top-level `ops` alias during migration).

Provenance in `meta` is descriptive only.

### Collaboration envelope wire

```text
{
  schemaVersion: 1,
  kind: "collab-envelope",
  changeId, documentId, baseVersionId,
  change: { ops },
  meta, dependsOn: string[]
}
```

Semantics (unchanged from ADR-007 / ADR-014):

- Duplicate `changeId` → idempotent
- Missing `dependsOn` predecessor → reject (`CausalDependencyError` / parse does not invent buffering)
- Concurrent changes → OT with accepted-order priority
- Transport, retry, reconnect, out-of-order buffering → **outside** this contract

### Schema versioning

- Field name: `schemaVersion` (integer)
- Current: **1**
- Supported: **[1]**
- Versions **what**: the wire document envelope + payload shape for each `kind`
- Increment on **breaking** payload/semantic changes
- Non-breaking: additive optional fields under unknown-field policy

### Unknown-field policy (hybrid)

| Situation | Behavior |
|-----------|----------|
| Unknown **top-level** fields on a known `kind` | **Ignore** (forward compatible) |
| Unknown keys inside `ChangeMeta` (untrusted) | **Strip** via allowlist (`sanitizeUntrustedChangeMeta`) |
| Unknown keys on ops beyond insert/delete/retain/attributes | **Ignore** (kind still required) |
| Forbidden keys (`__proto__`, `constructor`, `prototype`) | **Reject** |
| Missing required fields / wrong types / malformed ops | **Reject** |
| Unknown / unsupported `schemaVersion` | **Reject** |
| Unknown `kind` (when present) | **Reject** for that parser |

### Compatibility

| Direction | Policy |
|-----------|--------|
| Backward | Newer implementations MUST read schemaVersion 1 documents |
| Forward | Older implementations MUST reject unsupported `schemaVersion` (no silent partial apply) |
| Experimental pre-ADR-012 JSON | **No compatibility promise** was ever published; parsers may accept common legacy shapes as v1 migration aids only |
| Migration | Explicit parse/migrate at the wire boundary — no hidden engine magic |

### Limits (normative defaults)

See `WIRE_LIMITS` / `UNTRUSTED_META_LIMITS`. Applications may be stricter. Oversized / invalid payloads throw `WireError` (or `ProposalError` via experimental adapter) with **no partial Document mutation**.

### Security (normative)

Preserve ADR-015: malformed rejection, op/meta limits, provenance allowlist, `untrustedInput: true` on wire parse, remote meta sanitization, no AuthN/AuthZ/signing in engine.

## Alternatives considered

1. **Reject all unknown fields** — Too brittle for additive evolution; rejected in favor of hybrid.
2. **Ignore unknown schema versions** — Unsafe; rejected.
3. **Delta-only Version persistence** — Premature optimization; full snapshots retained.
4. **Put wire types in lextrix-serialize** — Rejected: engine contracts belong with ChangeSet semantics; content codecs stay separate.

## Consequences

- Stable import path: `lextrix-change/wire`
- Experimental APIs remain for Document/Handle/collab adapters; wire contracts are the first graduated platform surface beyond ChangeSet OT
- Persistence/transport (Phase 8+) MUST consume these schemas
- Benchmarks must track snapshot growth; redesign only if gates fail

## Migration strategy

1. Emit `schemaVersion: 1` + `kind` on all new serializers.
2. Accept legacy proposal/version shapes without `schemaVersion` as migration-only.
3. Document that pre-Phase-7 experimental JSON had no stability guarantee.
4. Graduate additional runtime APIs only after inventory criteria (Phase 7 API inventory).
