# ADR-030 Disaster Recovery & Operational Integrity

- Status: Accepted
- Date: 2026-09-14
- Phase: 11 (extended Phase 12)
- Related: [ADR-018](./ADR-018-persistence-and-durability.md), [ADR-031](./ADR-031-compaction-snapshot-architecture.md)

## Decision

PostgreSQL backup/PITR is the recovery mechanism. After restore: load HEAD/chain, run `validateVersionChain` / compose integrity (with compacted-root when applicable), verify sealed snapshots, repair `document_heads` from max sequence if needed before serving writes.

**Phase 12 extension:** backups must include `document_snapshots`, archive rows, and lifecycle/region metadata. Corrupt snapshots must not become authoritative sync bases.

## Non-goals

Custom consensus; multi-region active-active DR.