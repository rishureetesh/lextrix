# API Inventory — Phase 12

## `lextrix-change/persistence` (new)

| Export | Role |
|--------|------|
| `DocumentSnapshot` / `SnapshotPersistence` | Checkpoint ports |
| `createSnapshotFromVersion` / `verifySnapshot` | Integrity (SHA-256) |
| `InMemorySnapshotPersistence` | Reference |
| `VersionArchive` / `InMemoryVersionArchive` | Archive port |
| `DocumentLifecycle` / `InMemoryDocumentLifecycle` | Tombstone → purge |
| `CompactionController` | Seal → archive → purge |
| `DEFAULT_SNAPSHOT_EVERY_N_VERSIONS` | **100** (configurable) |

## `lextrix-collab` (new)

| Export | Role |
|--------|------|
| `PresenceFrame` / `EphemeralPresenceStore` | Non-authoritative presence |
| `DocumentRegionStore` / `promoteDocumentRegion` | Home-region contracts |
| `SyncResponseFrame.baseSnapshot` | Additive sync (ADR-012 unchanged) |

## `lextrix-server` (new)

| Export | Role |
|--------|------|
| `PostgresSnapshotPersistence` | PG snapshots |
| `PostgresVersionArchive` | PG archive table |
| `PostgresDocumentLifecycle` | lifecycle_state column |
| `PostgresDocumentRegionStore` | home_region column |
| `migrations/002_phase12.sql` | Additive schema |

## Deferred (Phase 13+)

Automated multi-region product, SaaS control plane, billing, presence UX, CRDT, E2EE.
