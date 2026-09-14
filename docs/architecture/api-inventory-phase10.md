# API Inventory — Phase 10

Authoritative collaboration core (ADR-020 / ADR-021 / ADR-022).

## New package: `lextrix-collab`

| Export | Class |
|--------|-------|
| `DocumentServerSession` | Reference authoritative server session (experimental/reference) |
| `AuthoritativeClientSession` | Client pending/confirmed/reconnect helper |
| Control frames | `envelope` / `ack` / `sync` / `reject` / `error` |
| `DEFAULT_COLLAB_LIMITS` | maxRebaseDepth=64, maxPendingEnvelopes=256 |

## Extended: `lextrix-change/persistence`

| Export | Notes |
|--------|-------|
| `AuthoritativeDocumentPersistence` | `loadHead`, `loadVersion`, `loadChain`, `compareAndAppend` |
| `InMemoryAuthoritativePersistence` | Reference CAS store — not production durable |
| Phase-9 `DocumentPersistence` | Unchanged |

## Unchanged

- ADR-012 wire (`CollabEnvelope`, Version, …)
- `lextrix-change/document` Handle/Version APIs
- No DB / WebSocket / Auth in `lextrix-change` or `lextrix-collab`

## Phase 11 boundary

Production WS/HTTP, Postgres/Redis adapters, AuthN/Z product, presence, compaction, multi-region.
