# ADR-033 Multi-Region Authority

- Status: Accepted
- Date: 2026-09-14
- Phase: 12
- Related: [ADR-025](./ADR-025-distributed-ownership.md), [ADR-030](./ADR-030-disaster-recovery.md)

## Context

Geographic deployment is required for latency and DR, but Lextrix has one authoritative Version lineage and one logical writer per document.

## Decision

1. **Single home region per document** is the authority for writes.
2. **Active-active multi-writer OT is rejected.**
3. Clients connect via edge; router **proxies** to home region (topology not part of ADR-012).
4. Home assignment: explicit, hash ring, or tenant affinity — outside ChangeSet semantics.
5. Read replicas allowed; they do not accept authoritative appends.
6. Failover = promote durable primary + **bump `owner_epoch`** (optional `region_generation`) + hydrate + re-route.
7. Network partition: non-home / non-primary **reject writes**.
8. RPO = replication mode (async ⇒ lag; sync/semi-sync ⇒ near-zero). Do not claim zero loss without sync commit.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Active-active multi-writer | Forks authority; needs CRDT or undefined OT |
| Multi-primary PostgreSQL for Versions | Breaks CAS/epoch assumptions |
| Exposing region ids to clients as protocol | Couples clients to topology |

## Consequences

- Placement metadata and routing are application/`lextrix-server` concerns.
- Cross-region presence may be eventual/local; document writes remain home-strong.

## Failure behavior

Stale region after failover cannot append (epoch/DB primary fencing).

## Migration

Single-region deployments set one home; multi-region is opt-in metadata.
