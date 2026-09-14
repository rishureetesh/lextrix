# ADR-028 Compaction & Snapshots

- Status: Accepted
- Date: 2026-09-14
- Phase: 11

## Decision

Future compaction = snapshot checkpoint keyed by existing `versionId` + retain recent deltas. Snapshots are not a second document identity system.

**Phase 11:** schema-ready documentation only; **no compaction engine**, no Version deletion, no snapshot read path required for gate.

Phase 12 implements compaction jobs.

## Non-goals

Silent history truncation in Phase 11.
