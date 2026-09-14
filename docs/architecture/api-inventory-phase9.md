# API Inventory — Phase 9

Persistence ports, hydration integrity, collaboration transport boundary.

## New exports

| Import | Contents | Class |
|--------|----------|-------|
| `lextrix-change/persistence` | `DocumentPersistence`, `PersistenceError`, `InMemoryDocumentPersistence`, `attachPersistence`, `validateVersionChain` | Provider-neutral contracts + in-memory reference (not production durable) |
| `lextrix-change/collaboration` | `CollaborationTransport`, `CollaborationAdapter`, `CollabAckLevel`, `COLLAB_ACK_LEVELS`, `InMemoryCollaborationTransport`, `TransportError` | Provider-neutral ports + fake transport for tests |

## Strengthened APIs

| API | Change |
|-----|--------|
| `DocumentHandle.fromVersions` | Default-on compose-integrity validation (`verifyComposeIntegrity`) |
| `validateVersionChain` | Lineage + compose integrity; fail closed |
| `InMemoryCollaborationAdapter` | `getLocalHead`, `getConfirmedVersion` (history ACK only), `processAck` ladder |

## Version identity pointers (do not conflate)

| Term | Meaning |
|------|---------|
| **HEAD** | Local Handle materialized Version (`getLocalHead` / `currentVersion`) |
| **confirmed Version** | Latest Version marked via ACK level `history` on the collab adapter |
| **persisted Version** | Successfully appended via persistence adapter |
| **durable Version** | Physically durable in the storage backend (adapter concern) |

## ACK ladder (distinct)

`received` → `persisted` → `accepted` → `history`

## Not in Phase 9

PostgreSQL/SQLite/Redis, production WebSocket/HTTP servers, AuthN/Z, CRDT, branches, presence, compaction.
