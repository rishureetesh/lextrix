# Dual operation model (Phase 1 investigation)

**Date:** 2026-09-14  
**Related:** [ADR-002](./adr/ADR-002-changeset-core-primitive.md)  
**Decision:** **No structural change in Phase 1** — keep public `ChangeOp` + internal `DocumentOperation` + bridge.

---

## 1. Why both representations exist

| Representation | Location | Purpose |
|----------------|----------|---------|
| `ChangeOp` | `packages/change/src/change/change-op.ts` | Quill-compatible public JSON: `{ insert }`, `{ delete }`, `{ retain }` + `attributes` |
| `DocumentOperation` | `packages/change/src/operation/kinds.ts` | Tagged union `{ kind: 'insert'\|'delete'\|'retain', ... }` for stream OT |
| Bridge | `packages/change/src/operation/legacy-bridge.ts` | `fromLegacyOps` / `toLegacyOps` |

`OperationStreamOT` and `OperationBuffer` operate on `DocumentOperation`. Public `ChangeSet.compose/diff/transform/invert` always:

```text
ChangeOp[] → fromLegacyOps → OT → toLegacyOps → ChangeSet
```

This matches Quill Delta’s public surface while keeping a cleaner internal IR for iteration/coalescing.

## 2. Can one become canonical?

| Option | Verdict |
|--------|---------|
| Public `ChangeOp` only | Would require rewriting OT/buffer; high risk |
| Internal `DocumentOperation` only | Breaks Quill wire compatibility and all serializers |
| **Keep both** | Correct for Phase 1 |

**Canonical for product wire format:** `ChangeOp` / ChangeSet JSON.  
**Canonical for OT engine:** `DocumentOperation` (private).

## 3. Is conversion lossless?

For ops Lextrix constructs through `ChangeSet` builders and OT outputs: **yes** — attributes empty objects are normalized away; insert/delete/retain shapes round-trip.

Caveats:

- Callers hand-crafting malformed ops (e.g. both `insert` and `delete` on one object) are undefined.
- Embed retain objects rely on registered embed handlers for invert/compose semantics.

## 4. Will collaboration require the internal representation?

**Not necessarily on the wire.** Collab can exchange ChangeSet JSON and run `transform` on each peer. Internal IR can stay private.

Exposing `DocumentOperation` might help a future high-performance protocol, but that is an API commitment — defer.

## 5. Would exposing it create unwanted API commitments?

**Yes.** Once published, native ops become a second public schema to version forever. Phase 1 keeps them internal.

## Phase 1 action

- Document this file.  
- Do not remove the bridge.  
- Do not export `DocumentOperation` from `lextrix-change` main entry.  
- Property tests assert behavior on the **public** ChangeSet API only.
