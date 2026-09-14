# ADR-031 Compaction & Snapshot Architecture

- Status: Accepted
- Date: 2026-09-14
- Phase: 12
- Related: [ADR-012](./ADR-012-serialization-and-wire-contracts.md), [ADR-018](./ADR-018-persistence-and-durability.md), [ADR-022](./ADR-022-reconnect-sync.md), [ADR-028](./ADR-028-compaction-snapshots.md)

## Context

Full Version retention does not scale. Versions already store full `contents`, but rows and sync payloads grow without bound. ADR-028 deferred the engine.

## Decision

1. **Snapshot** = durable **checkpoint object** with independent `snapshotId`, referencing an existing `versionId`, storing materialized `contents` (+ optional SHA-256 of canonical ADR-012 ChangeSet JSON).
2. Snapshots are **not** Versions and do not become HEAD.
3. Compaction: seal snapshot at Vk → **archive** Versions with sequence &lt; k → optional **purge** under retention policy.
4. Hot store retains checkpoint Version through HEAD for accept/hydrate.
5. Sync after compaction: extend `sync` **control** response with optional `baseSnapshot` + Version deltas. **No ADR-012 kind/schema change.**
6. `restoreVersion` / `DocumentReference` resolve hot → archive; missing → fail closed (`unknown_version` / `version_unavailable`).
7. Editor undo/redo is **not** Version history; compaction must not redefine application undo stacks.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Snapshot as new Version | Second identity; confuses lineage/OT base |
| Delete without archive | Breaks restore/references/audit |
| Change ADR-012 Version kind | Unnecessary; control frames already carry sync |
| Content-only snapshot without versionId | Loses authoritative binding |

## Consequences

- New tables/ports in `lextrix-server` / persistence adapters; core remains vendor-neutral.
- Clients must tolerate additive sync fields and rebase after `sync_required`.
- Idempotency TTL for ancient `change_ids` becomes an explicit policy knob.

## Failure behavior

- Snapshot job failure: no compaction; history unchanged.
- Integrity mismatch: reject snapshot; do not seal; do not delete.
- Client base compacted: `sync_required` → snapshot+deltas → rebase/resubmit.

## Migration

Additive schema; create snapshots before enabling archive/purge flags.

## Future compatibility

CRDT-compatible: checkpoint identity, sync base blobs, archive. OT-specific: rebase from snapshot base using ChangeSet transform.
