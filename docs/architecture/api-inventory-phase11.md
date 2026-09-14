# API Inventory — Phase 11

## New package: `lextrix-server`

| Export | Role |
|--------|------|
| `PostgresAuthoritativePersistence` | PG CAS + idempotency |
| `PostgresDocumentOwnership` | Lease + owner_epoch |
| `migratePostgres` | SQL migrations |
| `WsCollabServer` | WebSocket frame transport |
| `CollabHost` | Session host + AuthZ + broadcast |
| `CollabAuthHooks` / `allowAllAuth` | Application Auth boundary |
| Observability hooks | Vendor-neutral counters |

## Extended

| Surface | Change |
|---------|--------|
| `compareAndAppend(..., { ownerEpoch, changeId })` | Fencing + durable idempotency |
| `lookupChangeId` | Optional on persistence port |
| `lextrix-collab` ownership contracts | `DocumentOwnership`, `InMemoryDocumentOwnership` |

## Dependencies

| Package | May depend on |
|---------|----------------|
| `lextrix-change` | No `pg` / `ws` / Auth |
| `lextrix-collab` | `lextrix-change` only |
| `lextrix-server` | `pg`, `ws`, change, collab |

## Deferred

Compaction engine, presence product, multi-region, Redis.
