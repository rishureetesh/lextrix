# Phase 11 Architecture Discovery — Production Infrastructure & Deployment Model

- Status: Discovery complete (awaiting explicit approval before implementation)
- Date: 2026-09-14
- Related: [ADR-012](./adr/ADR-012-serialization-and-wire-contracts.md), [ADR-018](./adr/ADR-018-persistence-and-durability.md)–[ADR-022](./adr/ADR-022-reconnect-sync.md)

> **Discovery only.** No production DB, WebSocket, Auth, presence, compaction, or multi-region implementation in this document’s phase.

---

## 1. Executive Summary

**Recommended production architecture:**

```text
Application (AuthN/Z, tenancy)
        ↓
lextrix-server (Node host composition — thin)
        ↓
lextrix-collab DocumentServerSession
        ↓
┌───────┴────────┬────────────────┐
│                │                │
PostgreSQL       WebSocket        Observability hooks
CAS + tables     control frames   (vendor-neutral)
document owner   + envelopes
lease (Redis or PG advisory)
```

| Decision | Choice |
|----------|--------|
| Database | **PostgreSQL** with transactional `compareAndAppend` |
| HEAD | Explicit `document_heads` row + Version table |
| Idempotency | Durable unique `(document_id, change_id)` table |
| Transport | **WebSocket** primary (bidirectional frames) |
| Ownership | **Sticky / partition ownership** + durable CAS + **lease fencing** |
| AuthN/Z | Application-owned; hooks on connect + every mutation/sync |
| Presence | Separate ephemeral channel — **not** Version history |
| Compaction | Architecture only: snapshot checkpoints + retain recent deltas |
| Multi-region | **Deferred** — single authoritative region per document |
| CRDT / branches | **Not in Phase 11** |

Core packages (`lextrix-change`, `lextrix-collab`) remain **provider-neutral**. Vendor drivers live in application or optional `lextrix-server` adapters.

---

## 2. Current Phase 10 Baseline (verified)

| Capability | Status |
|------------|--------|
| `DocumentServerSession` | Reference; in-process Promise queue |
| `compareAndAppend` | Port + in-memory; process-local atomicity |
| `changeId` dedupe | **Memory-only** Maps on session |
| Version identity | Server-generated via Handle |
| Control frames | `envelope\|ack\|sync\|reject\|error`; ADR-012 unchanged |
| Reconnect | sync → rebase → resubmit (reference client) |
| HEAD | Derived as chain tip in memory store |
| `lextrix-server` | **Does not exist** |
| DB/WS/Auth deps | **None** in change/collab |

**Defect found during discovery (not fixed in this discovery-only phase):** persistence types file on disk is named `author-types.ts` while imports expect `authority-types.ts`. Type-only imports hide the break at runtime; rename to `authority-types.ts` should be the first mechanical fix in Phase 11 implementation (or a tiny pre-fix).

**Phase 10 limitation (normative):** multi-instance safety requires deployment ownership **plus** real CAS — in-memory mutex is insufficient.

---

## 3. Production Target (what Phase 11 implementation must add)

### MUST (Phase 11 implementation)

1. PostgreSQL adapter implementing `AuthoritativeDocumentPersistence` with true transactional CAS  
2. Durable `changeId` idempotency store  
3. Explicit HEAD row / CAS token  
4. WebSocket transport adapter carrying existing control frames  
5. Document ownership lease + fencing epoch  
6. Thin `lextrix-server` (or app host) composing session + adapters  
7. AuthN/Z integration contracts (not a provider product)  
8. Observability hooks + correlation IDs  
9. Integration/concurrency/failure tests against real Postgres (CI)  
10. ADRs 023–026, 029–030 (Accepted before/with implementation)

### SHOULD

11. Snapshot checkpoint schema (write path optional; read path for sync)  
12. Hot-document limits + backpressure  
13. Presence architecture ADR (implementation may be stub)

### DEFER to Phase 12+

- Compaction job engine  
- Multi-region active-active  
- Presence product UI  
- Redis-only as sole source of truth for Versions  
- Cloud SaaS packaging  

---

## 4. Persistence Architecture

### Recommendation: PostgreSQL

| Criterion | Why Postgres |
|-----------|--------------|
| Atomic CAS | Single transaction: check head + insert version + update head |
| Lineage queries | Indexed `(document_id, sequence)`, `parent_id`, `version_id` |
| Ops maturity | Backup/PITR, failover, observability well understood |
| Consistency | Strong transactional semantics match Version authority |

**Rejected as primary Version store:**

| Alternative | Why rejected |
|-------------|--------------|
| Pure document/KV (e.g. Mongo as sole) | Weaker/awkward CAS + lineage; easy to fork history |
| Event-log only (Kafka as authority) | Extra system; Version still needed as durable unit |
| Redis as Version authority | Persistence/durability model wrong for history |

Redis **may** hold ownership leases / presence — not authoritative Versions.

### Conceptual schema

```text
documents (
  document_id PK,
  created_at,
  -- optional app tenancy keys
)

document_heads (
  document_id PK FK,
  head_version_id NULL,          -- null = empty
  head_sequence INT NOT NULL DEFAULT -1,
  owner_epoch BIGINT NOT NULL DEFAULT 0,  -- fencing
  updated_at
)

versions (
  version_id PK,
  document_id FK,
  sequence INT NOT NULL,
  revision INT NOT NULL,
  parent_id NULL,
  change_from_parent JSONB NULL,  -- ADR-012 ChangeSet ops
  contents JSONB NOT NULL,          -- ADR-012 contents
  meta JSONB NULL,
  created_at,
  UNIQUE (document_id, sequence),
  UNIQUE (document_id, version_id) -- version_id globally unique preferred
)

change_idempotency (
  document_id,
  change_id,
  version_id NOT NULL,             -- resulting authoritative Version
  created_at,
  PRIMARY KEY (document_id, change_id)
)
```

Store **ADR-012 Version wire JSON** (or equivalent columns) — no second op dialect.

### HEAD representation

**Explicit `document_heads` row** (not only derived tip):

- Enables `SELECT … FOR UPDATE` CAS without scanning all Versions  
- Tip must always equal latest Version for that document (invariant checked on hydrate)  
- `owner_epoch` participates in fencing (see §8–9)

---

## 5. Idempotency

### Durable uniqueness

```text
PRIMARY KEY (document_id, change_id)
```

On accept:

1. Lookup `(documentId, changeId)`  
2. If present → replay stored `version_id` / prior reject code (deterministic)  
3. If absent → OT → apply → CAS Version → insert idempotency row **in same transaction** as Version+HEAD update when possible  

**Do not** rely on in-memory `acceptedByChangeId` for production.

`changeId` remains client operation identity; it is **not** `versionId`. Storing `meta.changeId` on Version is optional telemetry; the idempotency table is authoritative for dedupe.

Survives: process restart, horizontal scale, reconnect, transport retry.

---

## 6. Database Transaction Semantics

### Canonical CAS transaction

```text
BEGIN
  SELECT head_version_id, owner_epoch FROM document_heads
    WHERE document_id = $doc FOR UPDATE;

  -- fencing: reject if request.epoch < durable owner_epoch (stale owner)

  IF head_version_id IS DISTINCT FROM expected_head_id THEN
    ROLLBACK; return cas_conflict;
  END IF;

  -- optional: INSERT change_idempotency ON CONFLICT DO NOTHING …
  --   if conflict → rollback and return prior result

  INSERT INTO versions (...);
  UPDATE document_heads SET head_version_id = $new, head_sequence = $seq, updated_at = now();
  INSERT INTO change_idempotency (...);
COMMIT;
```

### Ambiguous commit

If client/server loses connection after COMMIT unknown:

1. Do **not** create another Version blindly  
2. Re-read `document_heads` + `change_idempotency` by `changeId`  
3. If Version present → treat as success (idempotent history ACK)  
4. If absent → safe to retry OT/CAS  

### Other failures

| Case | Behavior |
|------|----------|
| Duplicate `version_id` | Fail closed (server bug) |
| Serialization failure / deadlock | Retry transaction with backoff |
| DB unavailable | Reject submissions; no forged local authority |
| Failover | New primary; sessions re-hydrate HEAD |

---

## 7. Transport Architecture

### Recommendation: WebSocket (primary)

| Need | WebSocket fit |
|------|----------------|
| Bidirectional frames | Native |
| Server push broadcast | Native |
| Reconnect | Standard; app runs Phase-10 sync |
| Control frames | JSON (or binary later) envelopes |

**Rejected as primary:** SSE (server→client only; awkward submit), pure HTTP request/response (no efficient fan-out), WebTransport (immature ecosystem for v1).

**MAY:** HTTP POST for `submit`/`sync` as fallback + WS for push (same frame schema).

### Transport vs collaboration

Transport moves bytes/frames. Collaboration (`DocumentServerSession`) interprets meaning. Preserve Phase-9/10 boundary.

### Connection lifecycle

```text
TCP/WS connect
  → AuthN handshake (app token)
  → subscribe(documentId) + AuthZ
  → heartbeats
  → frames
  → disconnect → client reconnect contract
```

Limits: max message size (≤ wire limits), max connections/server, per-doc subscriber cap, backpressure (drop/slow disconnect).

Ordering: **per-connection FIFO**; authoritative order remains server accept queue, not network arrival across connections.

---

## 8. Authentication / Authorization

**Outside `lextrix-change`.** Application owns providers.

| Checkpoint | AuthZ |
|------------|-------|
| Connection | Authenticate principal |
| Subscribe / open document | Read (and optionally write) access |
| Every envelope submit | Write access |
| Sync / history | Read access |
| Admin restore | Elevated |

Server stamps trusted `actorId` into ChangeMeta from AuthN — **never trust client `actorId`**. OT remains provenance-blind.

Contract sketch:

```ts
interface CollabAuthContext {
  principalId: string;
  tenantId?: string;
}
authorize(ctx, { documentId, op: 'subscribe'|'submit'|'sync' }): Promise<boolean>;
```

---

## 9. Distributed Ownership

### Recommendation: Model A+B hybrid — **partition / sticky ownership + lease**

```text
hash(documentId) → partition → owning instance
instance holds lease (Redis or PG) with epoch
accept loop only on owner
CAS + epoch fence on every append
```

| Model | Verdict |
|-------|---------|
| A Sticky alone | Insufficient on crash without reassignment |
| B Partition ownership | **Chosen** for scale |
| C Distributed lock only | Contended; easy to get wrong; optional for lease impl |
| D DB-only serialization (no owner) | CAS prevents fork but **OT accept order** races across instances → **reject as sole model** |

**Why not DB-only:** Two workers can OT-transform against same HEAD concurrently, produce different child Versions, and only one CAS wins — wasting work and complicating idempotency; worse, overlapping accept without a single ordered writer violates “one acceptance stream” unless every accept is a full serialized transaction including OT under row lock (possible but couples OT latency to DB lock duration). Prefer **short owner lease** + local OT queue + quick CAS.

---

## 10. Split-Brain / Fencing

### Invariant

> A stale owner must never append authoritative history after losing ownership.

### Mechanism

1. `document_heads.owner_epoch` (monotonic)  
2. On acquire ownership: `UPDATE … SET owner_epoch = owner_epoch + 1 … RETURNING owner_epoch`  
3. Every CAS transaction includes `AND owner_epoch = $epoch`  
4. Stale owner’s commits fail fencing → no Version  

CAS alone prevents **two different Version children of same HEAD** from both committing, but **does not** stop a stale owner from believing it still serializes OT. Epoch fencing + reject on fence failure closes that.

**Split-brain A vs B both “own” D:** only the higher epoch’s CAS succeeds; lower epoch fenced.

---

## 11. Ownership Failure

| Failure | Behavior |
|---------|----------|
| Owner crash | Lease expires → new owner acquires new epoch → hydrate from DB |
| Owner pause / GC stall | Lease TTL expires; fence prevents late writes |
| Owner loses DB | Stop accepts; release/expire lease |
| Network partition | Only side with DB + valid epoch writes |

Lease TTL must exceed max accept critical section or use lock extension carefully.

---

## 12. Reconnect / Sync (production)

Preserve Phase-10:

```text
disconnect → retain pending
reconnect (possibly new instance)
  → AuthN
  → sync(from confirmedVersionId)
  → apply Versions / snapshot+deltas
  → rebase pending
  → resubmit same changeIds (durable idempotent)
```

If load balancer lands on non-owner: proxy/forward to owner **or** reject with `redirect`/`retry` (implementation detail). Do not accept mutations on non-owner.

Compacted base → `sync_required` + snapshot (see §13).

---

## 13. Snapshots / Compaction (architecture only)

```text
… V_n …
Snapshot S_k  (contents == V_k.contents; points to versionId V_k)
retain deltas V_{k+1} … HEAD
older than retention: archive/delete
```

- Snapshot is **not** a second identity system — keyed by existing `versionId`  
- Sync: if `fromVersionId` missing → return latest snapshot ≤ from? else `sync_required` with snapshot id + deltas after  
- Compaction job must pause or coordinate with owner; never delete Version still required by HEAD lineage without snapshot covering it  
- **Implement compaction engine in Phase 12**, schema hooks MAY land in Phase 11  

---

## 14. Presence

**Separate ephemeral subsystem** (WS channel or Redis pub/sub):

- cursors, selections, “user online”  
- **Must not** enter Version / ChangeSet / OT  
- Lossy; no durability requirement equal to Versions  

ADR-027 documents boundary; full presence product may wait for Phase 12.

---

## 15. Observability

Vendor-neutral hooks (`observe({ name, documentId, detail })` already sketched in Phase 10).

### Metrics (separate counters)

`received` ≠ `accepted` ≠ `history` ≠ `broadcast`  

Also: CAS conflicts, ambiguous commits, sync_required, rebase_limit, active docs/connections, queue depth, append latency.

### Logging correlation

`documentId, versionId, changeId, requestId, actorId, clientId, sessionId, connectionId, ownerEpoch`

**Do not** log document contents by default.

---

## 16. Security Threat Model (summary)

| Threat | Mitigation | Layer |
|--------|------------|-------|
| Unauthorized access | AuthZ on subscribe/submit/sync | Application |
| Forged actorId | Server stamp from AuthN | Server host |
| Replay / dup submit | Durable changeId | Persistence |
| Oversized ops/sync | Wire + server caps | Wire / server |
| CPU rebase exhaustion | maxRebaseDepth | Collab |
| Connection exhaustion | limits / disconnect | Transport |
| Broadcast amplification | per-doc subscriber caps | Server |
| Stale owner write | epoch fence | Ownership + DB |
| Transport intercept | TLS | Ops |
| Log leakage | redaction policy | Observability |
| DB compromise | encryption, least privilege, backups | Ops |

---

## 17. Disaster Recovery

- PG continuous backup / PITR  
- Restore → run lineage + compose-integrity validation (reuse `validateVersionChain`)  
- Rebuild/verify `document_heads` from max(sequence) if needed  
- Integrity job: parent links, compose integrity sample, head match  

Restored DB must yield valid authoritative lineage before serving writes.

---

## 18. Scaling Model

| Axis | Approach |
|------|----------|
| Documents | Partition by `documentId` |
| Users/connections | Scale WS nodes; sticky to owner or fan-in |
| Ops/sec | Per-doc single writer is intentional bottleneck |
| History size | Sync slices + future snapshots |
| Hot document | Caps: queue, subscribers, reject `queue_full`; do **not** multi-write one doc |

**Primary bottleneck:** hot single-document accept serialization (by design).

Realistic assumptions to benchmark (not SLAs yet): tens of docs/sec sustained per core for small edits; fan-out to tens–hundreds of subscribers; measure before claiming more.

---

## 19. Multi-Region

**Decision: Deferred.**

Single authoritative region (or single primary) per document. Cross-region = routing to home region. Active-active OT would require a different consistency model (future / CRDT phase) and must not be bolted on silently.

---

## 20. Package Architecture

```text
lextrix-change     → engine, wire, ports (stable)
lextrix-collab     → sessions, frames (protocol stable; ref impls marked)
lextrix-server     → Node composition + optional adapter interfaces (new)
application        → pg driver, ws server, AuthN/Z, deploy
```

**Never:** `lextrix-change` → pg/ws/auth SDKs.

### Stability in Phase 11

| Stabilize | Keep reference/experimental |
|-----------|-----------------------------|
| Persistence ports + CAS result types | In-memory adapters |
| Control frame shapes | Concrete WS server class internals |
| AuthZ hook interface | Provider plugins |

---

## 21. Proposed ADRs

| ADR | Title | Required? |
|-----|-------|-----------|
| **023** | Production Persistence (PostgreSQL + schema + CAS txn) | **Yes** |
| **024** | Production Transport (WebSocket + frame binding) | **Yes** |
| **025** | Distributed Document Ownership & Fencing | **Yes** |
| **026** | AuthN/AuthZ Integration Boundary | **Yes** |
| **027** | Presence Architecture (ephemeral) | **Yes** (decision); impl MAY stub |
| **028** | Compaction & Snapshots | **Yes** (architecture); engine Phase 12 |
| **029** | Production Observability | **Yes** |
| **030** | Disaster Recovery & Operational Integrity | **Yes** |

Do not implement adapters until these are Accepted.

---

## 22. Implementation Order (next phase, after approval)

1. Accept ADR-023–030  
2. Postgres schema + transactional `compareAndAppend` + idempotency  
3. Ownership lease + epoch fencing  
4. Wire DocumentServerSession to durable idempotency + fence  
5. WebSocket transport adapter (frames)  
6. Auth hooks in host  
7. Observability metrics  
8. Integration + multi-instance concurrency tests  
9. Failure injection (crash, ambiguous commit)  
10. Benchmarks  
11. Docs / inventory  
12. **STOP** (no compaction job, no multi-region, no presence product unless stub)

---

## 23. Testing Strategy

- Unit: adapter CAS, idempotency, fence  
- Integration: real Postgres  
- Concurrency: 2+ instances, one document  
- Failure: crash before/after commit; ACK loss; lease expiry  
- Network: disconnect/dup/reorder  
- Load: hot doc + many connections  
- Recovery: restore backup + hydrate  
- Security: malformed wire, AuthZ deny  
- Property: OT + Version lineage unchanged  

---

## 24. Benchmark Plan

`append`, `CAS contention`, hydrate N, sync N, accept, WS throughput, fan-out K, reconnect, ownership handoff latency. Establish baselines; no premature optimization.

---

## 25. Migration / Rollout

```text
InMemoryAuthoritativePersistence → Postgres adapter (same port)
InMemoryCollaborationTransport → WebSocket adapter (same frames)
DocumentServerSession reference → hosted behind lextrix-server
```

Feature-flag per deployment. ADR-012 unchanged. Experimental in-memory paths remain for tests.

---

## 26. Explicit Non-Goals

CRDT, branches, AI agents, editor rewrite, cloud SaaS, billing, analytics product, offline-first product, multi-region active-active, embedding Auth provider into `lextrix-change`.

---

## 27. Phase 12 Boundary

Compaction engine, presence product, multi-region routing, advanced ops (autoscaling playbooks), optional HTTP fallback polish, managed cloud offering.

---

## 28. Answers to Critical Questions

1. **DB:** PostgreSQL  
2. **CAS:** Single txn FOR UPDATE head + insert Version + update head (+ epoch)  
3. **changeId:** Durable `(document_id, change_id)` unique table  
4. **HEAD:** Explicit `document_heads`  
5. **Load Versions:** By sequence index; sync after `fromVersionId`  
6. **Compaction:** Snapshot at Version + retain recent deltas (Phase 12 engine)  
7. **Sync after compaction:** Snapshot + deltas or `sync_required`  
8. **Transport:** WebSocket  
9. **Owner:** Partition/hash sticky + lease  
10. **Fence:** Monotonic `owner_epoch` in CAS  
11. **Owner crash:** Lease expiry → new epoch → hydrate  
12. **Split-brain:** Epoch fence + CAS; lower epoch cannot commit  
13. **DB failure:** Reject; no local authority publish  
14. **Ambiguous commit:** Re-read head + idempotency before retry  
15. **Reconnect across instances:** Sync from durable history; forward to owner  
16. **Hot docs:** Queue/subscriber caps; single writer  
17. **Slow clients:** Bounded outbound queue; disconnect  
18. **AuthN:** Application on connect  
19. **AuthZ:** Application on subscribe/submit/sync  
20. **Actor trust:** Server-stamped from AuthN  
21. **Presence:** Separate ephemeral channel  
22. **DR:** PG PITR + lineage validation  
23. **Multi-region:** Deferred  
24. **Stable APIs:** Ports + frames; not vendor adapters  
25. **Outside Lextrix:** Drivers, IdP, deploy, TLS, tenancy product  
26. **Phase 11 build:** PG adapter, WS adapter, ownership, host, hooks, tests  
27. **Phase 12:** Compaction engine, presence product, multi-region  

---

## 29. Acceptance Gates (Discovery)

| Gate | Status |
|------|--------|
| A Persistence | **PASS** — PostgreSQL |
| B CAS | **PASS** — transactional spec |
| C Idempotency | **PASS** — durable unique key |
| D Transport | **PASS** — WebSocket |
| E Ownership | **PASS** — partition + lease |
| F Fencing | **PASS** — owner_epoch |
| G Split-brain | **PASS** — epoch + CAS |
| H Recovery | **PASS** — ambiguous commit resolve |
| I Sync/compaction | **PASS** — architecture specified |
| J Security | **PASS** — AuthZ + threats |
| K Presence | **PASS** — separated |
| L Observability | **PASS** — hooks/metrics |
| M DR | **PASS** — PITR + validate |
| N Scaling | **PASS** — hot-doc strategy |
| O Multi-region | **PASS** — deferred |
| P Package boundaries | **PASS** — core neutral |
| Q API stability | **PASS** — defined |
| R Migration | **PASS** — port swap |
| S Scope | **PASS** — no CRDT/branches/AI |
| T Phase boundary | **PASS** — §3 / §27 |

---

## 30. Stop Condition

```text
DISCOVERY STATUS: COMPLETE
PHASE 11 IMPLEMENTATION: NOT STARTED
NEXT ACTION: review/approve ADRs 023–030, then authorize implementation
```

**Do not** install Postgres drivers, WebSocket servers, Auth providers, or compaction jobs until this discovery is explicitly approved.
