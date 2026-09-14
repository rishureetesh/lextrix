# Lextrix Production Deployment (Phase 11 Reference)

```text
                  Load Balancer / reverse proxy
                           │
              ┌────────────┴────────────┐
              │                         │
        Collab Server A           Collab Server B
        (partitions 0..N/2)       (partitions N/2..N)
              │                         │
              └────────────┬────────────┘
                           │
                    PostgreSQL
                 document_heads
                 versions
                 change_ids
                 document_ownership
```

## Client path

Clients connect via WebSocket (`/collab?token=…`) and speak **`documentId`** only.  
The preferred host behavior is to **proxy** to the owning instance rather than exposing partition topology (ADR-024).

## Document → partition

```text
partition = hash(documentId) % partitionCount
```

`partitionCount` is configurable (not part of document semantics).

## Ownership

1. Owner acquires lease → bumps `document_heads.owner_epoch`  
2. Accept loop runs only on owner  
3. Every `compareAndAppend` includes `owner_epoch`  
4. Stale epoch → `stale_owner` (no history)

## Failure

| Event | Behavior |
|-------|----------|
| Owner crash | Lease/epoch; new owner acquires + hydrates from PG |
| DB down | Reject writes |
| Ambiguous commit | Re-read HEAD + `change_ids` |
| Client disconnect | Reconnect → sync → rebase → resubmit |

## Auth

Application provides AuthN/AuthZ hooks. TLS and secrets are deployment-owned.

## Compaction / multi-region / presence

| Area | Status |
|------|--------|
| Snapshots / compaction / archive / lifecycle | **Implemented** (Phase 12; ADR-028/031/035) |
| Presence **protocol** | **Implemented** (Phase 12; ADR-027/032) |
| Presence **UX** / awareness product | Deferred (see [FUTURE-ROADMAP.md](./FUTURE-ROADMAP.md)) |
| Multi-region **foundations** (home region + promote/epoch) | **Implemented** (ADR-033) |
| Automated multi-region failover **product** | Deferred |
| SaaS / billing / control plane | Application-owned; deferred |

Phase 12 additive schema: `migrations/002_phase12.sql` (snapshots, archive, lifecycle, home_region).
