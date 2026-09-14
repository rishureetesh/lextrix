# ADR-022 Reconnect & Sync Protocol

- Status: Accepted
- Date: 2026-09-14
- Phase: 10
- Related: [ADR-012](./ADR-012-serialization-and-wire-contracts.md), [ADR-019](./ADR-019-collaboration-transport.md), [ADR-020](./ADR-020-authoritative-server.md)

## Problem

Clients disconnect with pending locals. They must catch up to authoritative history and resubmit without duplicating Versions or inventing history.

## Context

Phase-9 transport carries opaque envelopes. ACK ladder exists. No sync/reconnect protocol.

## Decision

Transport carries **discriminated control frames** beside ADR-012 envelopes. **ADR-012 is not changed.**

| Frame | Purpose |
|-------|---------|
| `envelope` | CollabEnvelope wire (submit / broadcast) |
| `ack` | `{ changeId, level, versionId? }` |
| `sync` | `{ documentId, fromVersionId? }` request/response with Version chain |
| `reject` | Stable rejection (`sync_required`, causal, auth, …) |
| `error` | Protocol / internal errors |

### Reconnect (narrow)

```text
disconnect → retain pending
reconnect → sync(from confirmed)
         → apply missing Versions
         → rebase pending
         → resubmit same changeIds
```

Not offline-first. No durable offline queue. No CRDT.

### Sync

Server returns authoritative Versions after `fromVersionId` (exclusive) through HEAD. Unknown/compacted base → `sync_required` (fail closed).

### Stale base on submit

Known ancestor within `maxRebaseDepth` → transform. Unknown / too old → `sync_required`.

## Alternatives considered

1. **Bump ADR-012 for control kinds** — Rejected; frames ride as transport discrimination.
2. **Full offline product** — Deferred.
3. **Snapshot-only sync** — MAY later; chain sync sufficient for Phase 10.

## Consequences

- `lextrix-collab` defines frame types + client reconnect helpers.
- `history` ACK with unknown `versionId` → client must sync before confirming.

## Failure semantics

Incomplete history never silently applied. Missing dependency → reject. Duplicate changeId after reconnect → idempotent.

## Security implications

Sync subject to AuthZ. History size capped. Wire parse fail-closed.

## Compatibility impact

Additive frames; envelope wire unchanged.

## Non-goals

Presence, production WS, snapshot compaction product.
