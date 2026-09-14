# Lifecycle Contract (Phase 7–10)

## Document

Immutable snapshot value. No dispose. Transitions via `apply` return a new instance (or `this` if empty).

## DocumentHandle

| Phase | Behavior |
|-------|----------|
| create | `DocumentHandle.create` / `fromVersions` (compose-integrity default-on) |
| use | apply, transactions, proposals, anchors, `subscribe` |
| destroy | **None required** — GC-owned (ADR-016) |

## Client session durability (ADR-018 Model B)

```text
apply → Version commit → observers → persistence append
```

Persist fail ⇒ dirty local HEAD; no Document rollback.

## Server authority durability (ADR-020 / ADR-021)

```text
OT accept → Handle.apply → compareAndAppend → history ACK + broadcast
```

CAS fail ⇒ rehydrate prior chain; **no** history ACK; **no** broadcast.

`history` never precedes durable Version append. Phase 10 v1 co-emits `accepted` + `history` after CAS.

## Collaboration (`lextrix-collab`)

| Component | Role |
|-----------|------|
| `DocumentServerSession` | Per-document serialized writer |
| `AuthoritativeClientSession` | pending / confirmed / reconnect |
| Control frames | envelope, ack, sync, reject, error |

Reconnect: sync → rebase pending → resubmit same `changeId`s.

## Pointers

| Term | Meaning |
|------|---------|
| HEAD | Local Handle Version |
| confirmed | Last `history` ACK Version |
| durable HEAD | CAS-appended Version |
| server HEAD | Authoritative session HEAD |

Document commit ≠ observer success ≠ persistence success ≠ durability ≠ history ACK.

## Production (Phase 11–12)

PostgreSQL stores `document_heads`, `versions`, `change_ids`, `document_ownership`, plus Phase 12 `document_snapshots`, `version_archive`, lifecycle/region columns.
WebSocket carries control frames including additive `presence` and snapshot-aware `sync`.
Ownership uses PostgreSQL `owner_epoch` fencing (no Redis).
Compaction: seal snapshot → archive → optional purge. Editor undo/redo ≠ Version history.
AuthN/AuthZ via application hooks on the server host. Tenancy/billing remain application-owned.
