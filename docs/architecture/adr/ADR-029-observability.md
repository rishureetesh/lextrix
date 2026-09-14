# ADR-029 Production Observability

- Status: Accepted
- Date: 2026-09-14
- Phase: 11 (extended Phase 12)
- Related: [ADR-031](./ADR-031-compaction-snapshot-architecture.md)–[ADR-035](./ADR-035-data-lifecycle-deletion.md)

## Decision

Vendor-neutral hooks emit metrics/events. Counters must not conflate `received`, `accepted`, `history`, and `broadcast`. Correlate `documentId`, `versionId`, `changeId`, `actorId`, `connectionId`, `owner_epoch`, `region`, `snapshotId` without logging document contents or credentials by default.

**Phase 12 extension:** also emit snapshot/compaction/presence/region/lifecycle events. Numeric SLOs are measured during soak before hard targets are committed.

## Non-goals

Hard-coded Datadog/Prometheus vendor SDK in core; invented hard SLOs without measurement.