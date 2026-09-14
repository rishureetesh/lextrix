# ADR-021 Persistence Atomicity

- Status: Accepted
- Date: 2026-09-14
- Phase: 10
- Related: [ADR-018](./ADR-018-persistence-and-durability.md), [ADR-020](./ADR-020-authoritative-server.md)

## Problem

Multiple server workers must not create conflicting authoritative children of the same HEAD.

## Context

Phase-9 `appendVersion` is idempotent by `version.id` but does not fence concurrent appends against a shared expected HEAD. Client Model B (dirty local HEAD) must not apply to server authority.

## Decision

Authoritative persistence requires:

```ts
compareAndAppend(documentId, expectedHeadId, version)
```

Semantics:

```text
if durableHead == expectedHeadId:   // null expected for empty doc → root
  append version atomically
  advance durable HEAD
  return success
else:
  return CAS conflict (no append)
```

### History follows durability

Emit `history` ACK **only** after successful CAS. Prefer co-emitting accepted+history after CAS for Phase 10 v1.

### Uncertain persistence

Do not create another Version blindly. Re-read durable HEAD / resolve before retry.

### Multi-instance fence

Correctness = per-document writer ownership **plus** durable CAS. In-memory mutex alone is not multi-instance safety.

## Alternatives considered

1. **Load-compare-append in application memory** — Rejected as equivalent to CAS; race window.
2. **Intent-log then Version** — MAY later; Version remains durable unit.
3. **Client Model B on server** — Rejected; undurable authority must not broadcast.

## Consequences

- `AuthoritativeDocumentPersistence` extends Phase-9 ports without breaking `DocumentPersistence`.
- On CAS fail after Handle.apply, server restores previous HEAD before retry/reject.

## Failure semantics

| Case | Behavior |
|------|----------|
| Crash before persist | No Version; client retries same changeId |
| Persist OK, ACK lost | Retry → idempotent history replay |
| CAS conflict | No history; retry OT against new HEAD |
| Uncertain write | Resolve HEAD before deciding |

## Security implications

Persistence does not authorize; AuthZ is application-owned before accept.

## Compatibility impact

Additive. Phase-9 `appendVersion` / `loadChain` preserved.

## Non-goals

Vendor DB adapters, multi-region replication, compaction engine.
