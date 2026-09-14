# Phase 12 Architecture Discovery — Compaction, Presence, Multi-Region & Platform Expansion

- Status: Discovery complete (awaiting explicit approval before implementation)
- Date: 2026-09-14
- Related: [ADR-012](./adr/ADR-012-serialization-and-wire-contracts.md), [ADR-023](./adr/ADR-023-production-persistence.md)–[ADR-030](./adr/ADR-030-disaster-recovery.md), [ADR-027](./adr/ADR-027-presence.md), [ADR-028](./adr/ADR-028-compaction-snapshots.md), [Phase 11 Discovery](./PHASE-11-ARCHITECTURE-DISCOVERY.md), [Phase 11 Completion](./PHASE-11-IMPLEMENTATION-COMPLETION.md)

> **Discovery only.** Do not implement compaction jobs, presence, multi-region runtime, or SaaS control planes in this phase.

---

## 1. Executive Summary

**Recommended final architecture:**

```text
Application (tenancy, AuthN/Z, billing, deletion policy)
        ↓
lextrix-server (host: WS, Auth hooks, limits, observe)
        ↓
lextrix-collab (session, sync, ownership, presence frames)
        ↓
┌───────────────┬────────────────┬──────────────────┐
│ PostgreSQL    │ Snapshot store │ Home-region auth │
│ Versions+CAS  │ checkpoints    │ owner_epoch fence│
│ change_ids    │ + cold archive │                  │
└───────────────┴────────────────┴──────────────────┘
```

| Area | Decision |
|------|----------|
| Snapshot | **Checkpoint object** keyed by existing `versionId` — not a second Version identity |
| Compaction | Retain hot window + checkpoint; **archive** then optionally purge older Versions |
| Sync | Additive `sync` response: optional snapshot base + Version deltas — **no ADR-012 kind change** |
| Presence | Same WebSocket; separate `presence` control frames; ephemeral; AuthZ; throttled |
| Multi-region | **Single home region per document**; reject active-active multi-writer OT |
| Failover | Promote durable authority + bump fencing epoch; RPO depends on DB replication |
| Tenancy | **Application-owned**; Lextrix sees `documentId` + AuthZ; optional opaque `tenantId` for metrics only |
| Billing | Outside Lextrix; optional usage events from observe hooks |
| Phase 12 impl | Snapshot engine + sync + presence + home-region contracts + lifecycle ports |
| Phase 13+ | Active multi-region productization, SaaS control plane, CRDT (if ever) |

Baseline verified 2026-09-14: `lextrix-change` 216, `lextrix-collab` 22, `lextrix-server` 6 pass / 4 PG skipped.

---

## 2. Phase 0–11 Baseline

| Capability | Status |
|------------|--------|
| ChangeSet / Document / Handle / Version | Stable experimental → production path via collab |
| OT + rebase + proposals | Intact; provenance-blind |
| ADR-012 wire kinds | `changeset\|version\|proposal\|collab-envelope` |
| Control frames | `envelope\|ack\|sync\|reject\|error` (collab; not ADR-012 kinds) |
| Authoritative server | Per-document serialized accept; server Version identity |
| PostgreSQL | `document_heads`, `versions`, `change_ids`, `document_ownership` |
| CAS + durable idempotency | Transactional |
| Ownership | Partition + lease + `owner_epoch` |
| WebSocket host | `lextrix-server` |
| AuthN/Z | Application hooks |
| Presence / compaction engine / multi-region | **Deferred** (ADRs 027–028 boundary only) |
| Version.contents | Already full DocumentState (insert-only ChangeSet) |
| restoreVersion | Appends **new** HEAD Version via diff; does not rewrite history |
| DocumentReference | Bound to `versionId`; missing → `unknown_version` |

---

## 3. Phase 12 Goals

1. Bound operational Version growth via snapshots + retention/archive.
2. Make long-history sync efficient and correct.
3. Preserve restore, references, and lineage integrity under compaction.
4. Ship minimal ephemeral presence without contaminating document authority.
5. Specify safe multi-region deployment: home-region authority + failover fencing.
6. Clarify platform/tenancy/lifecycle boundaries for multi-customer apps.
7. Expand observability/SLO/capacity models without vendor lock-in.
8. Define exact implementation scope vs Phase 13+.

---

## 4. Compaction & Snapshot Architecture

### Diagram A — Compaction

```text
V0 … V99          V100              V101 … V150 (HEAD)
[archived/purged]  ★ snapshot       [hot Versions]
                   checkpoint
                   versionId=V100
                   contents=materialized state
```

### Model choice

| Option | Verdict |
|--------|---------|
| A — Materialized blob attached only to Version row | Insufficient alone once Version rows are deleted |
| **B — Separate checkpoint referencing Version** | **Chosen** |
| C — New Version that is “the snapshot” | Rejected — second identity / confuses lineage |
| D — Other | N/A |

**Snapshot** = durable checkpoint:

```text
snapshotId          independent id
documentId
versionId           authoritative Version this checkpoint equals
sequence            denormalized from Version
contents            materialized DocumentState (ADR-012 ChangeSet JSON)
contentHash         optional integrity (see §5)
createdAt
policyMeta          optional (job id, reason)
```

**Authority rule:** HEAD and Version lineage remain the sole authoritative document-history identity. A snapshot never replaces HEAD. “Current document state” = HEAD Version (or Handle projection of HEAD).

Snapshots accelerate hydration and mark compaction boundaries. Because Versions already store full `contents`, a checkpoint for `versionId=V100` MUST equal `V100.contents` at creation time.

### Concurrency

Snapshot job reads a **fixed** `versionId` (e.g. V100) under read consistency:

1. Select target Version that already exists in durable store.
2. Copy `contents` (+ hash) into snapshot row.
3. Concurrent accepts of V101+ do not invalidate the snapshot of V100.
4. Compaction may only delete/archive Versions **strictly older than** the newest **sealed** snapshot’s `versionId`, and never delete HEAD or the sealed checkpoint Version until a newer sealed snapshot exists (or archive retains resolvability).

---

## 5. Snapshot Identity & Integrity

### Identity

- `snapshotId` is **independent** of `versionId`.
- Many snapshots MAY point at the same `versionId` (idempotent job retries); prefer unique `(document_id, version_id)` for “primary” sealed checkpoints.
- Clients never treat `snapshotId` as Version identity for OT base / restore target ids — restore and references use **`versionId`**.

### Integrity

At creation (and on restore/hydration of snapshot):

```text
parse contents as ChangeSet
contentHash == H(canonical serialize(contents))   // if hash present
load Version(versionId) if still hot → contents deep-equal snapshot.contents
```

**Hash:** SHA-256 over **canonical ADR-012 ChangeSet JSON** (same serializer as wire). Optional but recommended for archive/corruption detection. Not a substitute for Version lineage validation.

**Do not** invent a second cryptographic trust root for OT.

Verification timing: create-time mandatory; load-time when hydrating from snapshot/archive; periodic DR drills (ADR-030 extension).

---

## 6. History Retention

### Policy (configurable)

| Tier | Content | Default intent |
|------|---------|----------------|
| **Hot** | All Versions from last sealed snapshot (inclusive) through HEAD | Sync / accept / Handle hydrate |
| **Checkpoint** | Sealed snapshot(s) + Version row at checkpoint `versionId` while hot | Sync base |
| **Archive** | Older Version rows (or blob export) | Restore / audit / references |
| **Purge** | Physical delete after retention + no legal hold | Application policy |

**Creation triggers (policy knobs, not hard-coded semantics):**

- every **N** Versions (default candidate: 100)
- and/or every **B** bytes of cumulative `change_from_parent`
- and/or time-based max age of unsnapshotted growth
- manual admin/API
- background job owned by `lextrix-server` / application scheduler

**Deletion is not automatic correctness.** Default Phase 12 posture:

1. Seal snapshot at Vk.
2. Move V0…V(k−1) to **archive** (still resolvable).
3. Purge only under explicit retention policy.

`change_ids` for purged history: retain mapping for idempotency TTL window (configurable); after TTL, duplicate `changeId` from ancient clients may create a new Version — applications should use reconnect sync rather than infinite idempotency.

---

## 7. Sync After Compaction

### Diagram B — Sync

```text
Client confirmed V40
        ↓
sync request { fromVersionId: V40 }
        ↓
Server: V40 not in hot store
        ↓
sync response {
  base: snapshot(V100) | version wire for V100,
  versions: [V101 … V150],
  headVersionId: V150,
  compaction: true
}
        ↓
Client: hydrate from snapshot V100 + apply deltas → confirmed V150
        → rebase pending → resubmit same changeIds
```

### Protocol (additive control frames — **not** ADR-012 kinds)

Extend existing `sync` **response** (preferred) with optional fields:

```text
baseSnapshot?: { snapshotId, versionId, sequence, contents, contentHash? }
versions: Version[]          // exclusive after base; may be empty
headVersionId
compactionApplied?: boolean
```

Alternatively an additive control frame `type: 'snapshot'` immediately before sync deltas — same semantics; **prefer extending `sync` response** to keep one round-trip.

**ADR-012:** unchanged kinds/schemaVersion. STOP if a change to ChangeSet/Version wire is proposed without a new schemaVersion ADR.

### Base invalidated by compaction

Client submits `baseVersionId = V40` unknown in hot store:

1. Reject with `sync_required` (existing code path).
2. Client syncs → receives snapshot(V100)+deltas.
3. Client rebases pending ChangeSets against new confirmed base (existing Phase 10 client path).
4. Server does **not** silently drop local intent; it cannot transform against missing intermediate history without client rebase from a known base.

If rebase depth exceeds limits → `sync_required` / `rebase_limit` (existing).

---

## 8. Presence Architecture

### Diagram C — Presence

```text
Client  ↔  WebSocket (same connection)
              │
              ├─ document frames: envelope/ack/sync/reject/error
              └─ presence frames: presence (separate type)
                        ↓
              Ephemeral PresenceStore (owner process memory)
              — not Version / not PostgreSQL versions —
```

### State (minimal)

```text
actorId          stamped from AuthN principal (never client-claimed)
displayName?     application-supplied claim after AuthZ
cursor?          optional opaque JSON (app schema)
selection?       optional
status?          online | away (optional)
generation       client monotonic int
serverTime       server stamp for staleness
documentId
```

### Requirements

- Ephemeral, best-effort, non-authoritative, non-versioned, non-persistent.
- Disconnect / owner transfer / server restart → presence cleared; document correctness unchanged.
- AuthZ: `presence.publish` / `presence.subscribe` (or reuse document subscribe + publish capability).
- Ordering: **latest-wins per actor** by `(generation, serverTime)` — **not** Version sequence.
- Scale: max participants/doc, max updates/sec/actor, max payload bytes, separate outbound queue from document broadcast; throttle; slow client → drop presence only (`presence_queue_full`), never block CAS.
- Same connection preferred; **never** embed in `collab-envelope` history or Version `meta` as durable presence.

---

## 9. Multi-Region Architecture

### Diagram D — Multi-region

```text
Client
  ↓
Edge / LB (nearest)
  ↓
Global router (documentId → homeRegion)  [proxy preferred]
  ↓
Home region servers
  ↓
Document partition owner (lease + owner_epoch)
  ↓
Primary PostgreSQL (authoritative)
  ⟳ async replica(s) [optional read / DR]
```

### Options evaluated

| Option | Verdict |
|--------|---------|
| **A — Single home region per document** | **Chosen** |
| B — Region failover (DR) | **Supported as operational mode** of A |
| C — Active-active multi-writer per document | **Rejected** |
| D — Region-local read replicas | Allowed for **reads/sync of durable history** only; writes to home |

**Active-active explicitly rejected:** would require multi-writer OT or CRDT; violates Phase 0–11 single authoritative order.

### Home region

```text
documentId → homeRegionId → partition → owner
```

Assignment: explicit application placement **or** hash(documentId) → region ring **or** tenant affinity map. Not part of ChangeSet/OT.

### Routing

Application/global router **proxies** to home region (Phase 11 preference). Clients speak `documentId` only.

### Replication

- Authoritative writes: **primary** in home region.
- Cross-region: typically **asynchronous** replica → **RPO > 0** unless sync/semi-sync is configured and documented.
- CAS/`owner_epoch` semantics are **not** automatically preserved by naive multi-primary DB setups — do not use multi-primary for Versions.

### Failover

```text
Region A primary fails
→ fencing: stop A writers (epoch / promote lock)
→ promote durable data in B (or promote replica)
→ bump owner_epoch (and optional regionGeneration)
→ B hydrates HEAD from durable store
→ route clients to B
```

**RPO:** equals DB replication lag at promote time (async) or ≈0 (sync commit).  
**RTO:** detect + promote + ownership acquire + hydrate + reconnect.

### Network partition

- Only home primary accepts authoritative writes.
- Partitioned secondary region: **read-only / reject writes**.
- Never allow two regions to accept authoritative appends for the same document.

---

## 10. Fencing

Phase 11 `owner_epoch` remains the write fence **on the authoritative durable store**.

Cross-region:

1. Failover **must** bump epoch on the promoted authority before accepting writes.
2. Stale Region A reconnecting to old primary (if split-brain) must not have a writable primary; if dual-primary is possible, architecture is invalid — require single primary + STONITH/fencing at DB/ops layer.
3. Optional `region_generation` on `document_heads` if ops want explicit region fence distinct from owner lease churn — **not required** if epoch always bumps on region promote and only one primary exists.

**Invariant:** A stale region/process cannot append authoritative history after a newer fence is established.

---

## 11. Platform / Tenancy Boundary

### Diagram E — Platform boundary

```text
Application
 ├── Tenant registry
 ├── AuthN / AuthZ / IdP
 ├── Billing / quotas policy
 ├── Legal hold / deletion policy
 └── Placement (home region, retention)
       ↓
Lextrix
 ├── documentId, Version, ChangeSet, OT
 ├── persistence ports + PG adapter
 ├── collab session + WS
 ├── snapshots / archive ports
 └── observe + limit hooks
```

| Concern | Owner |
|---------|-------|
| Tenancy model | **Application** |
| `tenantId` in OT/ChangeSet | **Forbidden** |
| Opaque `tenantId` on metrics/logs | Optional via observe context |
| Quotas (docs, rate, size) | Application policy + Lextrix **resource limits** (queues, sync size, connections) |
| Billing | **Outside Lextrix** |
| Meterable events | Observe hooks: accept, sync bytes, connection-seconds, storage estimates |
| Audit (security) | Application stream; **≠** Version history |
| Encryption | TLS + at-rest = deployment; E2EE **not** selected (breaks server OT) |

---

## 12. Data Lifecycle

```text
active → inactive → archived → retained → deleted
```

| Stage | Versions | Snapshots | change_ids | Presence | Audit |
|-------|----------|-----------|------------|----------|-------|
| active | hot + checkpoints | yes | yes | ephemeral | app |
| inactive | may compact aggressively | retain | TTL | none | app |
| archived | cold archive | retain sealed | TTL/archive | none | app |
| deleted | tombstone then purge per policy | purge with doc | purge | none | retain per compliance |

**Deletion:** soft-delete / tombstone on `document_heads` (or app registry) first; physical purge asynchronous; legal hold blocks purge. Deletion ≠ immediate physical wipe by default.

---

## 13. Security

- AuthZ on subscribe, submit, sync, presence.
- Actor identity from principal only.
- Tenant isolation = AuthZ + optional DB schemas/roles at application deployment — not OT.
- Malformed wire / oversized sync / queue bounds unchanged.
- Snapshot/archive access requires same document AuthZ.
- No credentials in core; TLS deployment-owned.
- E2EE deferred/rejected for collaborative server OT path.

---

## 14. Observability & SLOs

### Metrics (extend Phase 11)

Document: accept latency, CAS conflicts, sync latency, rebase depth, snapshot age, compaction lag.  
Persistence: DB latency/errors, replication lag.  
Ownership: acquire/loss, fencing rejects.  
Transport: connections, reconnects, fan-out, queue depth.  
Presence: participants, updates/sec, drops, stale evictions.  
Multi-region: route hops, failover count, cross-region latency, lag.

### SLO **candidates** (measure, then set numbers)

| Candidate | How measured |
|-----------|--------------|
| Authoritative accept availability | successful accepts / attempts excluding client errors |
| Durability of history ACK | ACK only after commit (already) |
| Sync success after reconnect | sync+hydrate success rate |
| WebSocket availability | connect success / accept rate |
| Compaction freshness | HEAD−lastSnapshot sequence |

Do **not** publish hard numeric SLOs without production baselines.

---

## 15. Capacity Model

Assumptions for architecture (not product claims):

| Dimension | Order-of-magnitude planning |
|-----------|-----------------------------|
| Documents | 10^5–10^7 total; << active |
| Active docs | 10^3–10^5 |
| Connections | 10–10^3 per hot doc; host-limited |
| Ops/sec/doc | serialized accept → single-doc CPU/DB bound |
| Version growth | linear without compaction; bounded with N-snapshot |
| Presence | high frequency, small payloads — isolate queues |

**Bottlenecks:** (1) single-doc accept serialization, (2) PostgreSQL IOPS/storage, (3) WS fan-out, (4) large sync payloads without snapshots.

---

## 16. Cost Drivers

1. PostgreSQL storage + IOPS (Versions, indexes)  
2. Snapshot/archive storage  
3. Persistent WS connections / egress  
4. Cross-region replication & egress (if enabled)  
5. Observability volume  
6. Hot-document fan-out CPU  

Compaction trades compute (snapshot jobs) for storage and sync bandwidth.

---

## 17. Proposed ADRs

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-031](./adr/ADR-031-compaction-snapshot-architecture.md) | Compaction & Snapshot Architecture | **Proposed** |
| [ADR-032](./adr/ADR-032-presence-protocol.md) | Presence Protocol | **Proposed** (extends ADR-027) |
| [ADR-033](./adr/ADR-033-multi-region-authority.md) | Multi-Region Authority | **Proposed** |
| [ADR-034](./adr/ADR-034-tenant-platform-boundary.md) | Tenant / Platform Boundary | **Proposed** |
| [ADR-035](./adr/ADR-035-data-lifecycle-deletion.md) | Data Lifecycle & Deletion | **Proposed** |

**Not created as separate ADRs (fold into above / existing):**

- Production SLOs → expand ADR-029 during implementation  
- DR expansion → expand ADR-030 during implementation  

---

## 18. Implementation Scope (Phase 12)

### In scope

1. Accept ADR-031–035  
2. Snapshot schema + persistence port + PG migration  
3. Snapshot create API + background job contract  
4. Archive port (hot→archive); purge policy hooks  
5. Sync-after-compaction (extended sync response)  
6. Client hydrate from snapshot + deltas  
7. restoreVersion / DocumentReference behavior vs archive  
8. Minimal presence frames + in-memory store + AuthZ + throttle  
9. Home-region metadata + routing contract (proxy); failover runbook + epoch bump hooks  
10. Observe events for compaction/presence/region  
11. Tests: compaction sync, fencing across promote, presence isolation, archive restore  
12. Docs + benches  

### Out of scope (Phase 12)

- Active-active multi-writer  
- CRDT  
- Billing / admin UI / SaaS control plane  
- E2EE collaborative mode  
- Presence “product” UI  
- Automatic cross-region sync replication product  
- Deleting history without archive path  

---

## 19. Testing Strategy

| Class | Prove |
|-------|-------|
| Unit | Snapshot integrity, sync payload shaping, presence latest-wins, AuthZ |
| PG integration | Snapshot table, archive, CAS+epoch unchanged |
| Compaction | Create snapshot while writes continue; seal; sync from pre-snapshot base |
| Restore | restoreVersion from hot / snapshot / archive; fail closed if missing |
| References | unknown_version vs archive hydrate |
| Presence | no Version mutation; throttle; disconnect clear |
| Multi-instance | ownership unchanged |
| Failover drill | promote + epoch bump; stale writer rejected |
| Property | OT / lineage / wire / hydration still green |
| Load | hot doc + presence storm does not stall accepts |
| DR | backup/restore including snapshots |

---

## 20. Benchmark Plan

```text
snapshot_create
snapshot_verify_hash
compact_archive_1000
sync_from_snapshot_10 / _100 / _1000
hydrate_snapshot_plus_deltas
restore_from_archive
presence_update_fanout (10, 50, 200 clients)
presence_vs_accept_interference
home_region_route_proxy_overhead
failover_epoch_bump
PG storage growth with vs without compaction
```

Measure p50/p95 latency, throughput, memory, queue depth.

---

## 21. Migration / Rollout

1. Ship additive schema (`snapshots`, optional `archives`) — backward compatible.  
2. Enable snapshot **create** without deletion.  
3. Enable sync-with-snapshot path (clients tolerate unknown fields).  
4. Enable archive of old Versions behind flag.  
5. Enable purge after soak.  
6. Presence behind feature flag.  
7. Home-region metadata optional; default single region.  
8. Rolling deploy: N and N+1 servers; ADR-012 unchanged; control frames additive-only.

---

## 22. Explicit Non-Goals

- CRDT / branches / merge commits  
- Active-active multi-writer OT  
- Billing, IdP, tenant DB product inside core  
- Presence as Version history  
- Snapshot as second HEAD identity  
- Silent history truncation without archive/sync protocol  
- Cloud vendor lock-in  
- Phase 13 work (see below)  

---

## 23. Phase 13 Boundary

| Item | Why later |
|------|-----------|
| Full multi-region automated failover product | Needs mature ops + measured RPO |
| SaaS control plane / admin / billing | Application business layer |
| Presence UX / awareness product | Beyond protocol |
| Advanced tiered storage connectors | After archive port stabilizes |
| CRDT alternative engine | Separate architecture program |
| E2EE collab | Conflicts with server OT |
| PITR automation SaaS | Ops tooling |

---

## Answers to Critical Questions (57)

1. Snapshot = checkpoint object with materialized contents at a Version.  
2. Independent `snapshotId`, keyed to `versionId` — not a Version.  
3. Equality to Version.contents + optional SHA-256 of canonical contents.  
4. Policy: every N Versions / size / time / manual / job.  
5. After sealed snapshot: archive then optional purge of older Versions.  
6. Sync returns snapshot base + deltas to HEAD.  
7. restoreVersion needs target contents (hot Version, or archive/snapshot hydrate); else fail closed.  
8. DocumentReference: resolve via hot→archive; else `unknown_version` / `version_unavailable`.  
9. Wire: extend `sync` control response; **no** ADR-012 kind change.  
10–15. Presence: ephemeral actor/cursor state; same WS separate frames; not persisted; AuthN stamp; TTL/disconnect; isolated queues.  
16–24. Single home region; hash/explicit/tenant affinity; proxy routing; failover promote+epoch; stale fenced; partition → secondary read-only; async replica typical; RPO=lag; active-active rejected.  
25–32. Tenancy outside; optional opaque tenantId metrics; quotas app+limits; lifecycle §12; deletion tombstone→purge; billing outside; audit ≠ history; TLS/at-rest deployment; no E2EE.  
33–38. SLO candidates §14; metrics §14; capacity §15; costs §16; rolling additive; ADR-012 preserved.  
39–40. Reusable: Version ids, wire, transport, AuthZ, snapshots, persistence, observe, tenancy boundary. OT-specific: transform, single accept order.  
41–42. Scope §18; Phase 13 §23.

---

## Acceptance Gates (Discovery)

| Gate | Result |
|------|--------|
| A–G Snapshot/compaction/sync/restore/refs/wire | **PASS** |
| H–J Presence | **PASS** |
| K–P Multi-region/fencing/replication | **PASS** |
| Q–S Tenancy/lifecycle/security | **PASS** |
| T–V Observability/capacity/compat | **PASS** |
| W–Z CRDT boundary/scope/phase boundary | **PASS** |

**Open (non-blocking):** default numeric N/B retention; cold archive medium (object store vs table); measured SLO numbers.
