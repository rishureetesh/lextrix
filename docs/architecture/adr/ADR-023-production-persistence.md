# ADR-023 Production Persistence (PostgreSQL)

- Status: Accepted
- Date: 2026-09-14
- Phase: 11
- Related: [ADR-018](./ADR-018-persistence-and-durability.md), [ADR-021](./ADR-021-persistence-atomicity.md)

## Decision

Production authoritative history is stored in **PostgreSQL**.

Tables (normative):

- `document_heads` — explicit HEAD + `owner_epoch`
- `versions` — ADR-012 Version fields / wire payloads
- `change_ids` — unique `(document_id, change_id)` → `version_id`

`compareAndAppend` runs in a single transaction with `SELECT … FOR UPDATE` on the head row, optional epoch check, Version insert, head advance, and idempotency insert.

Ambiguous commit → re-read HEAD + `change_ids` before retry. Never blindly create another Version.

## Alternatives rejected

Redis/Mongo as Version authority; application-level non-transactional load-compare-append.

## Non-goals

Compaction job, multi-region replication, Redis dependency for Versions.
