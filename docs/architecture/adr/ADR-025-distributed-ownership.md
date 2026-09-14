# ADR-025 Distributed Document Ownership & Fencing

- Status: Accepted
- Date: 2026-09-14
- Phase: 11
- Related: [ADR-020](./ADR-020-authoritative-server.md), [ADR-021](./ADR-021-persistence-atomicity.md), [ADR-023](./ADR-023-production-persistence.md)

## Decision

One logical writer per document via:

```text
hash(documentId) → partition → owner instance
lease (PostgreSQL-backed)
owner_epoch (monotonic)
```

**Lease store:** PostgreSQL (`document_ownership` / head epoch) — **not Redis** for the reference implementation.

Every durable CAS includes `owner_epoch` validation. Stale epoch → reject. CAS alone is insufficient to stop stale OT writers; epoch fencing is required.

Ownership handoff: stop writes → bump epoch → new owner hydrates from PostgreSQL (not memory copy).

## Alternatives rejected

DB-only concurrent OT without owner; Redis-only locks for Phase 11 reference; sticky routing without fencing.

## Non-goals

Active-active multi-region; multi-writer documents.
