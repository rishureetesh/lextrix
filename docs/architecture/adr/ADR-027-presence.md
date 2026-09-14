# ADR-027 Presence Architecture

- Status: Accepted
- Date: 2026-09-14
- Phase: 11

## Decision

Presence (cursors, selections, online) is an **ephemeral, non-authoritative** subsystem. It must not enter Version history, ChangeSet, OT, or PostgreSQL Version tables.

**Phase 11 implementation:** deferred (no presence product). Boundary documented for Phase 12.

## Non-goals

Embedding presence in `meta` as durable history.
