# ADR-019 Collaboration Transport Boundary

- Status: Accepted
- Date: 2026-09-14
- Phase: 9
- Related: [ADR-007](./ADR-007-collaboration-and-rebase.md), [ADR-012](./ADR-012-serialization-and-wire-contracts.md), [ADR-014](./ADR-014-collaboration-failure-and-recovery.md)

## Context

In-memory collaboration exists experimentally. Real networks require a boundary so transport cannot mutate Documents or invent OT semantics. ACK must not conflate receive, persist, accept, and history.

## Decision

### Layers

```text
Collaboration Adapter
        ↓
CollabEnvelope (ADR-012 wire)
        ↓
CollaborationTransport
        ↓
CollabEnvelope
        ↓
Remote Collaboration Adapter
```

### Transport owns

Connection lifecycle, bytes, reconnect mechanics, network errors, backpressure hooks.

### Transport does not own

ChangeSet algebra, OT, Document mutation, Version creation, AuthZ, identity policy.

### Envelope-only

No `sendChangeSet` / `applyRemote` / `createVersion` on transport. Carry serialized collaboration envelopes.

### Reference server authority (Phase 10 target — not implemented here)

**Version-authoritative server:** client sends envelope → server validates/OT → creates Version → persists Version → ACK. Durable authority is Version history; envelopes coordinate.

### ACK ladder

| Level | Meaning |
|-------|---------|
| `received` | Bytes received |
| `persisted` | Durable record stored |
| `accepted` | Entered authoritative OT/accept order |
| `history` | Resulting Version in authoritative durable lineage |

These are **not** aliases. APIs must name the level.

### HEAD vs confirmedVersion

| Term | Meaning |
|------|---------|
| **HEAD** / `getLocalHead()` | Current locally materialized Version on DocumentHandle |
| **confirmedVersion** | Latest Version marked via ACK level **`history`** (optional `versionId`) |

`getConfirmedVersion()` returns `null` until a `history` ACK. It is **not** Handle HEAD. In-memory coordinator ACKs are `accepted` only (OT accept ≠ durable history).

### Causal semantics

`changeId` dedupe; `dependsOn` missing → reject (no engine buffering). Out-of-order buffering is transport/server responsibility.

### Non-goals

WebSocket/HTTP implementations, presence, AuthN/Z, graduating InMemoryCollab as stable.

## Alternatives considered

1. **Transport applies ChangeSets** — Rejected; violates Document authority.
2. **Envelope-log as sole durable history** — Rejected for reference architecture; Versions remain durable unit (ADR-018).
3. **Bare `ack`** — Rejected; ambiguous.

## Consequences

- Provider-neutral `CollaborationTransport` + ACK types.
- In-memory transport for contract tests only.
- InMemoryCollab remains experimental reference.

## Migration strategy

Additive ports; document confirmed vs HEAD; no Phase-8 Handle API break.
