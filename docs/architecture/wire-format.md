# Lextrix Wire Format (ADR-012)

**Status:** Normative (Phase 7)  
**Package:** `lextrix-change/wire`  
**Schema version:** `1`  
**Supported:** `[1]`

This document describes **persistence / boundary contracts**, not network transport or storage backends.

**Phase 10:** Control frames (`ack` / `sync` / `reject` / `error`) are transport-level discriminators in `lextrix-collab`. They do **not** change ADR-012 kinds. `collab-envelope` remains the change submission/broadcast body.

**Phase 11:** Production WebSocket (`lextrix-server`) carries the same control frames over the wire. ADR-012 document kinds and schema version are unchanged. Ownership topology is not part of the wire schema (proxy preferred).

**Phase 12:** Additive control-frame fields/types only:
- `sync` response may include `baseSnapshot` + `compactionApplied`
- `presence` frame type for ephemeral collaboration state

ADR-012 `kind` values and `schemaVersion: 1` are unchanged.

## Import

```ts
import {
  WIRE_SCHEMA_VERSION,
  serializeChangeSet,
  parseChangeSet,
  serializeDocumentVersion,
  parseDocumentVersion,
  serializeChangeProposal,
  parseChangeProposalWire,
  serializeCollabEnvelope,
  parseCollabEnvelope,
  WireError,
} from 'lextrix-change/wire';
```

Experimental adapters still expose `parseChangeProposal` (throws `ProposalError`) and `ChangeProposal.toJSON()` / `DocumentVersion.toJSON()` emitting schemaVersion 1.

## Document envelope

Every normative wire document includes:

| Field | Meaning |
|-------|---------|
| `schemaVersion` | Integer version of this wire schema (currently `1`) |
| `kind` | Discriminant: `changeset` \| `version` \| `proposal` \| `collab-envelope` |

## Kinds

### `changeset`

```json
{ "schemaVersion": 1, "kind": "changeset", "ops": [ /* ChangeOp[] */ ] }
```

Ops use the engine ChangeOp model (insert / delete / retain + attributes + embeds). Empty ⇒ `ops: []`.

Legacy: a bare ops array is accepted as schema v1 migration input.

### `version`

Self-contained snapshot **plus** lineage:

```json
{
  "schemaVersion": 1,
  "kind": "version",
  "id": "doc:v1",
  "documentId": "doc",
  "sequence": 1,
  "revision": 1,
  "parentId": "doc:v0",
  "contents": { "ops": [/* full DocumentState */] },
  "changeFromParent": { "ops": [/* transition */] },
  "meta": null
}
```

| Field | Role |
|-------|------|
| `id` | Version identity |
| `sequence` | Linear ordinal |
| `revision` | Document.revision at snapshot |
| `contents` | Full state (authoritative) |
| `changeFromParent` | Transition from parent (`null` at root) |

### `proposal`

```json
{
  "schemaVersion": 1,
  "kind": "proposal",
  "id": "prop_…",
  "documentId": "doc",
  "baseVersionId": "doc:v0",
  "change": { "ops": [] },
  "meta": { "source": "ai", "origin": "system" },
  "createdAt": "ISO-8601"
}
```

Legacy experimental `{ ops, documentId, baseVersionId, … }` without `schemaVersion` is accepted for migration only.

### `collab-envelope`

```json
{
  "schemaVersion": 1,
  "kind": "collab-envelope",
  "changeId": "chg_…",
  "documentId": "doc",
  "baseVersionId": "doc:v0",
  "change": { "ops": [] },
  "meta": { "source": "remote", "origin": "system" },
  "dependsOn": []
}
```

## Policies

See [ADR-012](../adr/ADR-012-serialization-and-wire-contracts.md) for unknown-field, compatibility, limits, and security rules.

## Golden fixtures

`packages/change/tests/fixtures/wire/*.json`
