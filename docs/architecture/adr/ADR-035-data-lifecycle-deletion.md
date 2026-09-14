# ADR-035 Data Lifecycle & Deletion

- Status: Accepted
- Date: 2026-09-14
- Phase: 12
- Related: [ADR-031](./ADR-031-compaction-snapshot-architecture.md), [ADR-030](./ADR-030-disaster-recovery.md)

## Context

Production documents need inactive/archive/delete semantics without corrupting authority or compliance.

## Decision

1. Lifecycle: `active → inactive → archived → retained → deleted`.
2. **Soft-delete / tombstone first**; physical purge asynchronous and policy-driven.
3. Legal hold blocks purge.
4. Compaction archive is distinct from document-level archive but may share storage ports.
5. On document delete: stop accepts; clear presence; retain or purge Versions/snapshots/`change_ids` per policy; AuthZ denies access to tombstoned docs.
6. Application owns retention schedules; Lextrix provides lifecycle ports/hooks, not a compliance product.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Immediate physical delete on API call | Unsafe for audit/DR/refs |
| Lifecycle inside ChangeSet meta as history | Contaminates document semantics |

## Consequences

- New host/persistence hooks for tombstone and purge.
- Backup/PITR remains primary DR (ADR-030).

## Failure behavior

Failed purge leaves archive intact; document remains non-writable if tombstoned.
