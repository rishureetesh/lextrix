# FUTURE ROADMAP — Architecture & Strategy Discovery

- Status: **Discovery only** — not an implementation plan commitment
- Date: 2026-09-14
- Scope: Post Phases 0–12 + Final System Validation + Browser / Chromium Validation
- Related: [FINAL-SYSTEM-VALIDATION-REPORT.md](./FINAL-SYSTEM-VALIDATION-REPORT.md), [TRANSFORMATION-PROGRESS.md](./TRANSFORMATION-PROGRESS.md), [api-stability.md](./api-stability.md), [ADR index](./adr/README.md), Phase 11–12 discovery/completion reports

> **A roadmap item is not implementation approval.**  
> Before any future implementation: confirm need → verify trigger → architecture discovery → ADR(s) where required → tests/acceptance gates → migration strategy → then implement.  
> **Do not start “Phase 13” merely because Phases 0–12 were numbered.** Prefer capability milestones.

---

## 1. Purpose

This document answers: **what Lextrix could become next**, after a release-ready document engine with documented limitations.

It classifies work as **IMPLEMENTED / DEFERRED / CANDIDATE / RESEARCH / REJECTED**, establishes dependencies and triggers, and protects architectural invariants.

It deliberately does **not**:

- promise to build every deferred idea
- invent speculative architecture for fashion
- reopen accepted ADRs without new evidence
- start product or infrastructure implementation

---

## 2. Current State

| Gate | Verdict |
|------|---------|
| Phases 0–12 | Complete (11–12 with documented limitations) |
| Final System Validation | **FINAL VALIDATION PASSED WITH DOCUMENTED LIMITATIONS** |
| Release readiness | **RELEASE-READY FOR IMPLEMENTED SCOPE WITH EXPLICIT LIMITATIONS** |
| Browser / Chromium | **BROWSER VALIDATION PASSED WITH DOCUMENTED LIMITATIONS** |

**Evidence (executed suites):**

| Suite | Result |
|-------|--------|
| `lextrix-change` | 229 PASS |
| `lextrix-collab` | 36 PASS |
| `lextrix-server` | 10 PASS / 4 PostgreSQL skipped (env) |
| `lextrix-intelligence` | 80 PASS |
| Chromium unit/integration | **582** PASS |
| Playwright Chromium e2e | **43** PASS |
| Chromium-facing total | **625** PASS |

**Environment gaps (not product incompleteness by themselves):** live PostgreSQL suite, true multi-process shared-PG fencing, production WebSocket soak, numeric SLOs, collaboration→Chromium multi-client E2E.

**Lextrix is release-ready for implemented scope.** It is **not** claimed to be a complete SaaS platform, active-active global fabric, CRDT system, E2EE collab product, full collaborative UX, agent platform, universal cross-browser certification, or production-SLO-proven service.

---

## 3. What Is Already Implemented

Preserve this foundation; do not re-list as future work.

| Layer | Implemented capability |
|-------|------------------------|
| **ChangeSet** | Canonical OT transition; dual ChangeOp + internal ops (bridge private) |
| **Document / Handle / Transaction** | Immutable state + live mutation owner + transactions |
| **Version** | Linear immutable history identity; full contents snapshot |
| **Anchor / Range** | Version-bound positions / intervals |
| **Proposal** | Requested ChangeSet vs base Version; accept/reject/rebase |
| **History** | Editor undo/redo (distinct from Version lineage) |
| **OT / Collaboration** | Transform, rebase, authoritative accept order |
| **Wire (ADR-012)** | schemaVersion **1** — changeset / version / proposal / collab-envelope |
| **Persistence ports** | CAS `compareAndAppend`, snapshots, archive, lifecycle |
| **PostgreSQL adapter** | Reference production persistence (`lextrix-server`) |
| **Authoritative server** | Server-owned Version ids / accept order (`lextrix-collab` + host) |
| **WebSocket transport** | Control frames; no Document mutation in transport |
| **Ownership / fencing** | Partition + lease + `owner_epoch` |
| **Snapshots / compaction** | Checkpoint keyed to `versionId`; seal → archive → purge |
| **Presence protocol** | Ephemeral frames; non-authoritative |
| **Multi-region foundations** | Single home region + promote/epoch contracts |
| **Intelligence** | Proposal producer + review orchestration; AI ≠ Document mutator |
| **Editor projection** | Hybrid Strategy B+; Document → editor; Chromium validated |
| **AuthN/AuthZ boundary** | Application hooks outside `lextrix-change` |
| **Tenancy/billing boundary** | Application-owned (ADR-034) |
| **Observability hooks** | Vendor-neutral (ADR-029); benches exist, SLOs not claimed |

**Package DAG (must hold):**

```text
lextrix-change  ↛  pg | ws | auth | openai
lextrix-collab  →  change only
lextrix-server  →  change, collab, pg, ws
lextrix-intelligence → change only
```

---

## 4. Roadmap Principles

1. **Evidence over fashion** — build when a trigger fires, not when a blog post is trendy.
2. **Protect authority** — one linear Version history per document; one logical writer; OT unless a research program proves otherwise.
3. **Prefer work above the core** — application, host, editor, intelligence packages before changing ChangeSet/Document/Version.
4. **Hardening before productization** — prove production gates before multi-region/SaaS surfaces.
5. **Ports stay ports** — vendor persistence, IdP, billing, and UX stay outside `lextrix-change`.
6. **AI produces proposals only** — never a privileged mutation path.
7. **Roadmap ≠ backlog commitment** — classification can change only via discovery + ADR.
8. **Capability milestones, not automatic Phase N** — number phases only when a coherent architecture program needs them.

---

## 5. Architectural Guardrails

Do not violate without a new accepted ADR program:

| Invariant | Source |
|-----------|--------|
| ChangeSet is the canonical transition | ADR-001/002 |
| DOM/blots are projection, not DocumentState | ADR-003 |
| Linear Version chain (no multi-head authority) | ADR-004/020/033 |
| AI → ChangeProposal only | ADR-009/010 |
| Wire schemaVersion 1 kinds stable | ADR-012 |
| History ≠ Versioning | ADR-004 + editor history |
| Presence ≠ Version / OT | ADR-027/032 |
| Snapshot ≠ second HEAD | ADR-028/031 |
| Single home region; **active-active multi-writer rejected** | ADR-033 |
| Tenancy/billing outside OT/core | ADR-034 |
| Auth outside `lextrix-change` | ADR-026 |
| Soft-delete / tombstone before purge | ADR-035 |

---

## 6. Deferred Work

Explicitly postponed by prior ADRs / Phase 12 boundary. Plausible later; **not committed**.

| Item | Why deferred | Primary home | Trigger (see §29) |
|------|--------------|--------------|-------------------|
| Full offline collaboration product | ADR-022; reconnect exists | collab + app | Offline multi-writer product need |
| Subscribe event replay | ADR-017 | change/document | Replay consumers need catch-up |
| Branches / merge | ADR-004/007 | change (major) | Product needs divergent lines under new authority model |
| Structural sharing of Version contents | ADR-004 | change | Measured Version storage/memory bottleneck |
| Full Document-first local typing | ADR-008 | editor bridge | Strategy B+ insufficient for product |
| Presence UX / shared cursors product | ADR-027; Phase 12 | application / UI | Product surface needs awareness |
| Review UI / proposal queues product | ADR-006/013 | application | Review workflow UX required |
| Automated multi-region failover product | ADR-033 foundations only | server / ops | Availability requirements exceed single-home ops |
| Advanced tiered / object-store archive connectors | Phase 12 archive port only | server | Storage cost / cold retention material |
| Second LLM providers / registry | document-intelligence.md | intelligence | Multi-vendor production need |
| Policy DSL / trust scoring / moderation platform | intelligence deferred list | application | Compliance / trust product |
| Cloud / hosted packaging | TRANSFORMATION-PROGRESS | product | Hosted offering decision |
| Signed proposals / crypto | ADR-015 | security app | Regulatory / integrity requirement |

---

## 7. Candidate Capabilities

Plausible, not committed. Prefer those that **strengthen** current architecture without rewriting it.

| ID | Capability | Why it matters | Core vs product | Effort |
|----|------------|----------------|-----------------|--------|
| C1 | CI + live PostgreSQL required for merge | Closes Gate J; production truth | Infra hardening | SMALL–MEDIUM |
| C2 | Multi-process shared-PG fencing harness | Proves ADR-025 under real concurrency | Infra hardening | MEDIUM |
| C3 | WebSocket multi-client soak harness | Proves ADR-024 under load | Infra hardening | MEDIUM |
| C4 | Production SLO soak program | Turns ADR-029 candidates into measured targets | Ops | MEDIUM |
| C5 | Optional compose-integrity check on CAS append | Residual P3 (port trust) | Persistence hardening | SMALL–MEDIUM |
| C6 | Editor apply-failure / resync dedicated tests | Thin coverage called out in validation | Editor hardening | SMALL |
| C7 | Collaboration → Chromium multi-client E2E | Closes browser §34 gap | Editor + collab integration | MEDIUM |
| C8 | Cross-browser matrix (Firefox/WebKit) | Chromium-only claim today | Editor validation | MEDIUM |
| C9 | Compaction job automation / ops tooling | Engine exists; productized scheduler thin | Server / ops | MEDIUM |
| C10 | Object-store archive adapter behind port | Archive port ready for connectors | Server | MEDIUM |
| C11 | Presence UX (cursors/awareness) | Protocol ready; UX not | Application / UI | MEDIUM–LARGE |
| C12 | Comments / annotations on DocumentReference | Anchors/refs exist; product missing | App (+ maybe thin engine) | LARGE |
| C13 | Experimental API graduation / docs | Reduce integrator risk | API maturity | MEDIUM |
| C14 | Persistence compose check + DR exercise runbooks | ADR-030 ops maturity | Ops | MEDIUM |

---

## 8. Research Areas

Investigation required before any implementation proposal.

| ID | Topic | Research question | What must stay reusable |
|----|-------|-------------------|-------------------------|
| R1 | **CRDT** | What offline multi-writer requirements cannot OT + reconnect serve? | Version ids, wire envelopes?, AuthZ, snapshots?, tenancy boundary — OT transform/single accept order are OT-specific |
| R2 | **E2EE collab** | Can end-to-end encryption coexist with server OT authority without becoming a different product? | Likely conflicts with server-visible ChangeSets (Phase 12) |
| R3 | **Structural sharing / content-addressed Versions** | When does full-contents-per-Version dominate cost? | Version identity APIs should remain |
| R4 | **Semantic conflict resolution** | Beyond OT positional conflicts — intent/merge UX | Proposals + review already provide a seam |
| R5 | **Branching under linear authority** | Can “branches” be application overlays (forked documentIds) without multi-head OT? | Prefer overlay first |
| R6 | **Large-document virtualized rendering** | Editor performance vs engine correctness | Keep Document engine independent of viewport |
| R7 | **Agentic AI workflows** | Multi-step actions with explicit permission, audit, human gates | Must still emit proposals only |

**CRDT stance:** Do **not** implement. Remain **RESEARCH** until a concrete trigger (offline multi-writer that OT cannot adequately serve) justifies a **separate architecture program**. Fashion is not a trigger.

---

## 9. Rejected / Do-Not-Build Areas

| Item | Classification | Reason |
|------|----------------|--------|
| Active-active multi-writer OT | **REJECTED** | ADR-033 — forks authority; needs CRDT or undefined OT |
| CRDT as drop-in OT replacement | **REJECTED** (as program without research gate) | Separate architecture; not incremental |
| Auth / IdP inside `lextrix-change` | **REJECTED** | ADR-026 |
| Billing / SaaS metering inside ChangeSet/OT | **REJECTED** | ADR-034 |
| AI privileged Document/Editor mutation | **REJECTED** | ADR-009/010 |
| Editor-specific logic in change engine | **REJECTED** | ADR-003 boundary |
| Vendor PG/WS inside `lextrix-change` | **REJECTED** | Package DAG / api-stability |
| Presence as Version history | **REJECTED** | ADR-027/032 |
| Snapshot as second HEAD identity | **REJECTED** | ADR-028/031 |
| Redis as primary Version store | **REJECTED** | Phase 11 discovery |
| Exporting `DocumentOperation` as public API | **REJECTED** (for now) | dual-operation-model.md — defer API commitment |
| E2EE on server OT path (as current design) | **REJECTED** pending research rewrite | Server must see ChangeSets to transform/accept |
| Silent history truncation without archive/sync | **REJECTED** | ADR-031/035 |

---

## 10. Production Hardening

| Item | Classification | Required for core platform? | Notes |
|------|----------------|----------------------------|-------|
| Live PostgreSQL CI | **CANDIDATE** (near-mandatory for *deploying* reference server) | For production deploy of `lextrix-server` | Validation Gate J |
| Multi-process PG fencing | **CANDIDATE** | For multi-instance deploy | ADR-025 |
| WS soak / load | **CANDIDATE** | For production transport claim | Not required for library-only use |
| Numeric SLOs | **CANDIDATE** | Ops claim only | ADR-029: measure before hard targets |
| Compose-integrity on append | **CANDIDATE** | Optional hardening | Trust Handle/server today (P3) |
| Backup / PITR / DR exercises | **DEFERRED** ops | Deployment responsibility + ADR-030 | Not new engine features |
| Ambiguous transaction validation | **IMPLEMENTED** (tests exist) + **CANDIDATE** deepen | — | Strengthen under live PG |

**Deployment vs core:** Library consumers of `lextrix-change` alone do not need PG/WS soak. Operators of `lextrix-server` **should** treat C1–C4 as pre-production gates.

---

## 11. Collaboration Evolution

| Direction | Classification | Guidance |
|-----------|----------------|----------|
| OT evolution (perf, large pending queues) | **CANDIDATE** | Only with measured bottlenecks |
| Offline-first product | **DEFERRED** | ADR-022 foundations; product is larger |
| Presence protocol | **IMPLEMENTED** | — |
| Presence UX | **DEFERRED** | Application |
| Shared cursors / awareness | **DEFERRED** | Same as presence UX |
| Comments / review threads | **CANDIDATE** (product) | Prefer app on DocumentReference |
| CRDT | **RESEARCH** | See §8 |
| Active-active | **REJECTED** | ADR-033 |
| Hot-document scale / fanout | **CANDIDATE** | Ops + host; keep single writer |
| Automated ownership routing | **CANDIDATE** | Above core; ADR-025/033 |

**Long-term model recommendation:** Keep **single-home-region authority** as the default collaborative model. It matches OT, CAS, and fencing. Change only under R1/R2-class research with explicit ADR supersession.

---

## 12. Document Infrastructure Evolution

| Capability | Belongs in | Classification |
|------------|------------|----------------|
| Richer / semantic references | change (thin) or app | **CANDIDATE** / **RESEARCH** |
| Comments, annotations, review threads | **application** (engine: Anchor/Range/Reference) | **CANDIDATE** |
| Block-level addressing / sections | formats + app; careful with OT | **RESEARCH** |
| Cross-document linking | application | **CANDIDATE** |
| Branching / merge | change (major) or app fork | **DEFERRED** / **RESEARCH** |
| User-visible “versions” UI | application over Version API | **CANDIDATE** |
| Templates / schema evolution | application + formats | **CANDIDATE** |
| Richer embeds | formats / editor | **CANDIDATE** |
| Structural sharing | change | **RESEARCH** → possible **DEFERRED** |

**Do not automatically expand `lextrix-change`.** Prefer application composition on DocumentReference, Proposal, and Version APIs.

---

## 13. Editor Evolution

| Item | Classification | Core engine? |
|------|----------------|--------------|
| Collab → Chromium E2E | **CANDIDATE** | No — integration evidence |
| Cross-browser validation | **CANDIDATE** | No |
| Projection / selection hardening | **CANDIDATE** | Bridge tests; thin apply-fail coverage |
| Large-doc / virtualized rendering | **RESEARCH** | Editor product |
| Offline editor mode | **DEFERRED** | Product + collab |
| Accessibility | **CANDIDATE** | Editor/product |
| Plugin architecture maturity | **IMPLEMENTED** baseline; polish **CANDIDATE** | Editor |
| Headless clients | **IMPLEMENTED** (Document path) | Engine already supports |
| Mobile browser support | **CANDIDATE** | Product validation |

---

## 14. Intelligence Evolution

**Invariant:** AI produces **proposals**. AI must not become a privileged mutation path.

| Item | Classification |
|------|----------------|
| Better proposal generation / multi-proposal / ranking | **CANDIDATE** (intelligence + app) |
| Semantic validation of proposals | **CANDIDATE** |
| Summarization / extraction / classification | **CANDIDATE** (app; may not need engine changes) |
| Structured transformations | **CANDIDATE** (still via ChangeSet/Proposal) |
| RAG / embeddings | **DEFERRED** / **RESEARCH** |
| Agentic workflows | **RESEARCH** (permission + audit first) |
| Auto-accept / streaming mutation | **REJECTED** without explicit human/policy model; streaming **mutation** remains out |
| Provenance / policy (existing) | **IMPLEMENTED** |

Determinism, auditability, permissions, privacy, cost, latency, safety, and human approval remain **application + intelligence** concerns — not reasons to break ADR-009.

---

## 15. Security Evolution

| Item | Layer | Classification |
|------|-------|----------------|
| Stronger AuthN/AuthZ / roles / ACLs | Application + host hooks | **CANDIDATE** |
| Tenant isolation | Application (ADR-034) | **CANDIDATE** |
| Audit logging | Application / observe | **CANDIDATE** |
| Signed changes / request signing | App / RESEARCH | **DEFERRED** / **RESEARCH** |
| Encryption at rest / TLS | Deployment | **CANDIDATE** (ops; not engine) |
| E2EE | Research / likely product fork | **RESEARCH** (default: do not pursue on OT path) |
| Rate limits / quotas / abuse | Host (`lextrix-server` + app) | **CANDIDATE** |
| Malicious content / plugin sandbox | Editor / app | **CANDIDATE** |

Core-engine security = untrusted proposals, validation, no privileged AI path (ADR-015). Everything else is deployment/application.

---

## 16. Platform / Tenancy Evolution

| Item | Home | Classification |
|------|------|----------------|
| Tenant / org model | Application | **DEFERRED** product |
| Quotas / metering / billing | Application | **REJECTED** for core; **CANDIDATE** for app |
| API keys / service accounts | Application / host | **CANDIDATE** |
| Admin control plane | Application (SaaS) | **DEFERRED** (Phase 12 §23) |
| Data residency / compliance | Application + region metadata | **CANDIDATE** |
| Retention / deletion guarantees | App policy + ADR-035 ports | **CANDIDATE** |

Lextrix core remains **documentId + AuthZ + optional opaque tenant metrics** — not a billing platform.

---

## 17. Persistence / Storage Evolution

| Item | Classification | Notes |
|------|----------------|-------|
| Snapshot / compaction engine | **IMPLEMENTED** | |
| Compaction automation | **CANDIDATE** | Scheduler/ops |
| Object-store / tiered archive | **DEFERRED** → **CANDIDATE** when cost triggers | Behind archive port |
| Retention policies | **CANDIDATE** (app + lifecycle) | |
| Storage quotas / accounting | **CANDIDATE** (app) | |
| Structural sharing | **RESEARCH** | |
| Version compression / delta compaction | **RESEARCH** | Distinct from seal→archive |
| Restore performance | **CANDIDATE** | Measure first |
| Large-document persistence IOPS | **CANDIDATE** | Measure first |

---

## 18. Distributed / Multi-Region Evolution

| Level | Status | Bottleneck | Next |
|-------|--------|------------|------|
| Single process | **IMPLEMENTED** | CPU / memory | — |
| Single server instance | **IMPLEMENTED** (reference host) | WS fanout, PG | Harden C1–C4 |
| Multi-instance + fencing | **IMPLEMENTED** contracts; **PG multi-process NOT EXECUTED** | Lease/epoch correctness | C2 |
| Partitioned documents | **IMPLEMENTED** (ownership) | Hot partition | Ops routing |
| Multi-region foundations | **IMPLEMENTED** | Routing / promote | — |
| Automated multi-region product | **DEFERRED** | Ops maturity, measured RPO | Only if trigger |
| Active-active multi-writer | **REJECTED** | Authority fork | Do not pursue |

---

## 19. Performance / Scale Evolution

Benchmarks exist (`bench-change`, `bench-collab`, `bench-server`, `bench-intelligence`). **No production SLOs claimed.**

| Concern | Priority | Guidance |
|---------|----------|----------|
| Very large documents | LATER / RESEARCH | Measure editor + apply path |
| Very long Version histories | LATER | Snapshots/compaction already address; measure restore/sync |
| High-frequency edits / many collaborators | LATER | Fanout + OT cost; soak first |
| Hot documents | LATER | Ownership + capacity |
| Snapshot frequency / compaction cost | OPTIONAL until measured | DEFAULT N=100 is a starting point |
| Persistence IOPS / WS fanout | LATER REQUIRED for hosted scale | After C3–C4 |
| OT complexity | RESEARCH only if measured | |

**Optimization without evidence is rejected as a roadmap driver.**

---

## 20. Dependency Graph

```text
Live PG CI (C1)
    ↓
Multi-process fencing harness (C2)
    ↓
WS soak (C3) ──→ Numeric SLO program (C4)
    ↓
Operational confidence for multi-instance deploy

Snapshot + archive ports (IMPLEMENTED)
    ↓
Object-store / tiered connectors (C10)
    ↓
Advanced retention automation

Presence protocol (IMPLEMENTED)
    ↓
Presence UX (C11)   [product trigger only]

DocumentReference + Anchor/Range (IMPLEMENTED)
    ↓
Comments / annotations (C12)   [app-first]
    ↓
Collaborative review product

OT + reconnect (IMPLEMENTED)
    ↓
Offline product (DEFERRED)
    ↓
[only if insufficient] CRDT research program (R1)

Home-region foundations (IMPLEMENTED)
    ↓
Automated multi-region failover product (DEFERRED)
    ↓
[never] active-active multi-writer

Intelligence proposals (IMPLEMENTED)
    ↓
Multi-provider / ranking (CANDIDATE)
    ↓
[gate] Agentic workflows research (R7) — still proposal-only
```

---

## 21. Prioritization

Labels are decision aids, not false precision.

| ID | Impact | Urgency | Arch risk | Effort | Deps | Strategic | Confidence | Recommendation |
|----|--------|---------|-----------|--------|------|-----------|------------|----------------|
| C1 Live PG CI | HIGH | HIGH | LOW | S–M | NONE | FOUNDATIONAL | HIGH | **NOW** |
| C2 Multi-process fencing | HIGH | HIGH | LOW | M | C1 | FOUNDATIONAL | HIGH | **NOW** |
| C3 WS soak | HIGH | MEDIUM | LOW | M | C1 | HIGH | HIGH | **NEXT** |
| C4 SLO soak | MEDIUM | MEDIUM | LOW | M | C3 | HIGH | MEDIUM | **NEXT** |
| C5 Compose integrity | MEDIUM | LOW | LOW | S–M | LOW | MEDIUM | HIGH | **LATER** |
| C6 Projection failure tests | MEDIUM | MEDIUM | LOW | S | NONE | MEDIUM | HIGH | **NEXT** |
| C7 Collab Chromium E2E | HIGH | MEDIUM | LOW | M | C3 helpful | HIGH | HIGH | **NEXT** |
| C8 Cross-browser | MEDIUM | LOW | LOW | M | C7 | MEDIUM | MEDIUM | **LATER** |
| C9 Compaction automation | MEDIUM | LOW | LOW | M | C1 | MEDIUM | MEDIUM | **LATER** |
| C10 Object-store archive | MEDIUM | LOW | LOW | M | archive port | MEDIUM | MEDIUM | **ONLY IF NEEDED** |
| C11 Presence UX | MEDIUM | LOW | LOW | M–L | protocol | MEDIUM | HIGH | **ONLY IF NEEDED** |
| C12 Comments product | MEDIUM | LOW | MEDIUM | L | refs | MEDIUM | MEDIUM | **LATER** |
| C13 API graduation | MEDIUM | LOW | MEDIUM | M | NONE | HIGH | MEDIUM | **LATER** |
| Auto multi-region product | HIGH | LOW | HIGH | VL | C1–C4 | HIGH | MEDIUM | **ONLY IF NEEDED** |
| SaaS/billing | HIGH (biz) | LOW | LOW* | VL | app | HIGH | HIGH | **ONLY IF NEEDED** (*core risk if misplaced) |
| R1 CRDT | — | — | EXTREME | RESEARCH | OT limits | — | LOW | **RESEARCH** / **DO NOT PURSUE** until trigger |
| R2 E2EE | — | — | EXTREME | RESEARCH | — | — | LOW | **DO NOT PURSUE** on OT path |
| Active-active | — | — | EXTREME | — | — | — | HIGH | **DO NOT PURSUE** |

---

## 22. Proposed Future Milestones

Capability milestones — **not** automatic “Phase 13.”

### Milestone A — Production Hardening (recommended first)

Live PG CI · multi-process fencing · WS soak · SLO measurement · optional compose-integrity · DR runbook exercises.

**Exit:** Operators can deploy `lextrix-server` with executed (not skipped) production gates.

### Milestone B — Editor & Integration Evidence

Collab→Chromium multi-client E2E · apply-fail/resync tests · optional cross-browser matrix.

**Exit:** Browser claim expands beyond “unit Chromium + page e2e without multi-client collab.”

### Milestone C — Operational Scale

Compaction job automation · capacity tooling · hot-document ops · fanout limits — still single-home authority.

### Milestone D — Collaboration Productization (optional)

Presence UX · comments/review UI · proposal queues — **application-first**, protocol already present.

### Milestone E — Document Platform Expansion (optional)

Templates, cross-doc links, richer embeds, semantic references — prefer app/formats; ADRs if engine expands.

### Milestone F — Intelligence Expansion (optional)

Multi-provider, ranking, RAG experiments — **proposal-only**; agents only after R7.

### Milestone G — Advanced Distributed Architecture (only if needed)

Automated multi-region failover product under ADR-033. **Not** active-active.

---

## 23. Future ADR Map

Do **not** author these now. Create only when a milestone starts discovery.

| Future capability | ADR required? | Likely scope | Prerequisites |
|-------------------|---------------|--------------|---------------|
| Compose-integrity on append | Maybe (amend ADR-021) | Persistence trust | Tests + threat model |
| Object-store archive | Maybe thin | Persistence adapter | Archive port stable |
| Automated multi-region product | Yes | Ops + region promote | Milestone A; measured RPO |
| Offline collaboration product | Yes | Collab + client | ADR-022 expansion |
| Structural sharing | Yes | Version storage | Measured bottleneck (R3) |
| Branching / merge | Yes (major) | Version authority | R5 conclusion |
| CRDT engine | Yes (new program) | Replaces OT assumptions | R1 trigger |
| E2EE collab | Yes (likely fork) | Security model | R2 |
| Comments as engine primitives | Maybe | Document refs | Prove app-layer insufficient |
| Presence UX | No (product) | UI | Protocol done |
| SaaS/billing | No (app); reject core ADR | Platform | ADR-034 holds |
| Agent permissions model | Yes if agents ship | Intelligence + security | R7 |

No mass reservation of empty ADR numbers.

---

## 24. Migration Considerations

| Candidate | Additive? | Wire-compatible? | Data migration? | Rolling deploy? |
|-----------|-----------|------------------|-----------------|-----------------|
| Live PG CI / harnesses | Yes (tests) | N/A | No | N/A |
| Compose-integrity check | Likely opt-in flag | Yes | No | Yes |
| Object-store archive | New adapter | Control/sync only | Copy archive | Yes |
| Presence UX | Client-only | Presence frames exist | No | Yes |
| Comments (app) | App schema | Yes | App DB | Yes |
| Automated multi-region | Metadata + routing | Prefer additive | Region columns exist | Careful |
| Structural sharing | Internal Version store | Should be | Rebuild snapshots | Hard |
| Branches | **Breaking authority** | Likely new | Heavy | Hard |
| CRDT | **New system** | Interop problem | Rewrite | Hard |
| E2EE | **New threat model** | Opaque payloads vs OT | Hard | Hard |

Prefer additive, wire-compatible, rolling paths. Treat authority-model changes as new architecture programs.

---

## 25. Risks

| Risk | Mitigation |
|------|------------|
| Roadmap becomes an uncontrolled feature queue | Triggers + discovery + ADR gate (§30) |
| Hardening skipped → production incidents | Milestone A before product milestones |
| Premature multi-region / CRDT / E2EE | REJECTED / RESEARCH with extreme risk labels |
| Core pollution (billing, Auth, editor DOM) | Package DAG tests + ADR-026/034/003 |
| AI mutation creep | ADR-009/010 + security tests |
| Doc lag (TRANSFORMATION-PROGRESS / deployment-production) | Treat validation + Phase 12 completion as truth; clean docs opportunistically |
| Optimization without measurement | Ban “NOW REQUIRED” without bench/soak evidence |

---

## 26. Open Questions

1. Will Lextrix’s primary consumers be **library embedders** or **hosted `lextrix-server` operators**? (Changes urgency of C1–C4.)
2. Is presence UX in-scope for Lextrix UI packages, or strictly application-owned?
3. Should comments ever become first-class engine types, or remain DocumentReference + app storage forever?
4. When (if ever) is Strategy B+ insufficient enough to justify Document-first local typing (ADR-008)?
5. What RPO/RTO do target deployments actually require before multi-region automation?
6. Should `lextrix-change/experimental` graduate piecemeal or remain a long-lived unstable barrel?
7. Is optional CAS compose-integrity worth the CPU cost in hot accept paths?

---

## 27. Decision Criteria for Starting Future Work

Start work only when **all** apply:

1. A **trigger** in §29 is true (or a stronger empirical one is recorded).
2. Classification is **CANDIDATE** or **DEFERRED** (not REJECTED); RESEARCH items need a research exit report first.
3. Dependencies in §20 are satisfied or explicitly waived with risk acceptance.
4. Architecture discovery is written and reviewed.
5. Required ADRs are proposed/accepted.
6. Acceptance tests and migration strategy exist.
7. The work does not violate §5 guardrails without ADR supersession.

---

## 28. Explicit Non-Goals

- Not a commitment to implement this entire document
- Not authorization to start Phase 13 as a grab-bag
- Not a claim of SaaS / global active-active / CRDT / E2EE completeness
- Not a rewrite of ChangeSet, OT, or linear Version authority
- Not moving Auth, billing, or tenancy into `lextrix-change`
- Not granting AI a privileged mutation path
- Not optimizing without benchmarks/soaks
- Not equating “limitation in validation env” with “missing product feature”

---

## 29. What Would Trigger This Work?

| Item | Trigger |
|------|---------|
| Live PG CI / fencing / WS soak / SLOs | Intent to **deploy** `lextrix-server` (or claim production readiness beyond library scope) |
| Compose-integrity on append | Evidence of forged/invalid Version appends, or compliance need |
| Collab→Chromium E2E | Need to claim multi-client browser collab correctness |
| Cross-browser | Shipping to Firefox/WebKit customers |
| Compaction automation | Version growth operationally painful |
| Object-store / tiered storage | Snapshot/archive **cost or size** becomes material |
| Structural sharing | Full Version contents memory/storage growth **measured** bottleneck |
| Presence UX | Product surface requires user-visible awareness/cursors |
| Comments / review UI | Product requires annotation workflows |
| Offline collaboration | Offline multi-writer requirements exceed reconnect/OT product |
| Automated multi-region | Availability/latency requirements exceed single-home ops with manual promote |
| CRDT research | Offline multi-writer **cannot** be adequately served by OT + product design |
| E2EE research | Regulatory need for server-blind payloads **and** willingness to abandon/fork server OT |
| SaaS/billing | Business decision to host a multi-tenant control plane (**outside core**) |
| AI agents | Concrete multi-step workflow + explicit permission/audit model (still proposal-emitting) |
| Branches/merge | Product needs divergent lines that document-fork overlays cannot serve |
| Active-active | **No accepted trigger** under current architecture — remains REJECTED |

---

## 30. Current vs Future Matrix

| Capability | Current Status | Future Classification | Reason |
|------------|----------------|-----------------------|--------|
| ChangeSet engine | Implemented | **IMPLEMENTED** | ADR-002 |
| Document | Implemented | **IMPLEMENTED** | ADR-001 |
| Handle | Implemented | **IMPLEMENTED** | ADR-016 |
| Transactions | Implemented | **IMPLEMENTED** | Phase 2 |
| Versions (linear) | Implemented | **IMPLEMENTED** | ADR-004 |
| Anchors | Implemented | **IMPLEMENTED** | ADR-005 |
| Ranges | Implemented | **IMPLEMENTED** | Phase 3–4 |
| Proposals | Implemented | **IMPLEMENTED** | ADR-006 |
| History (undo/redo) | Implemented | **IMPLEMENTED** | Editor module |
| OT | Implemented | **IMPLEMENTED** | ADR-007 |
| Collaboration (authoritative) | Implemented | **IMPLEMENTED** | ADR-020 |
| Wire protocol | Implemented (v1) | **IMPLEMENTED** | ADR-012 |
| Persistence ports | Implemented | **IMPLEMENTED** | ADR-018/021/031 |
| PostgreSQL adapter | Implemented; live tests skipped in val env | **IMPLEMENTED** + **CANDIDATE** hardening | Gate J |
| Authoritative server | Implemented | **IMPLEMENTED** | ADR-020 |
| WebSocket | Implemented | **IMPLEMENTED** + soak **CANDIDATE** | ADR-024 |
| Ownership/fencing | Implemented; multi-process PG not executed | **IMPLEMENTED** + **CANDIDATE** harness | ADR-025 |
| Snapshots | Implemented | **IMPLEMENTED** | ADR-028/031 |
| Compaction | Implemented | **IMPLEMENTED** + automation **CANDIDATE** | ADR-031 |
| Archive | Port + PG table | **IMPLEMENTED** + connectors **DEFERRED** | Phase 12 |
| Lifecycle | Implemented | **IMPLEMENTED** | ADR-035 |
| Presence protocol | Implemented | **IMPLEMENTED** | ADR-032 |
| Presence UX | Not built | **DEFERRED** | Product |
| Multi-region foundation | Implemented | **IMPLEMENTED** | ADR-033 |
| Automated multi-region | Not built | **DEFERRED** | Phase 12 §23 |
| Active-active multi-writer | Rejected | **REJECTED** | ADR-033 |
| Tenancy | Boundary only | **DEFERRED** (app) | ADR-034 |
| Billing | Out of core | **REJECTED** (core) / app **CANDIDATE** | ADR-034 |
| AuthN | Hooks only | **IMPLEMENTED** boundary; app **CANDIDATE** | ADR-026 |
| AuthZ | Hooks only | **IMPLEMENTED** boundary; app **CANDIDATE** | ADR-026 |
| Audit | Observe hooks | **CANDIDATE** (app) | ADR-029/034 |
| AI proposals | Implemented | **IMPLEMENTED** | ADR-009 |
| AI agents | Not built | **RESEARCH** | Intelligence deferred |
| RAG | Not built | **DEFERRED** / **RESEARCH** | Intelligence deferred |
| CRDT | Out of scope | **RESEARCH** / do not pursue yet | ADR-002/007/020 |
| E2EE | Not on OT path | **RESEARCH** / do not pursue on OT | Phase 12 |
| Branches | Deferred | **DEFERRED** / **RESEARCH** | ADR-004 |
| Structural sharing | Deferred | **RESEARCH** | ADR-004 |
| Semantic conflict resolution | Deferred | **RESEARCH** | Phase 6+ |
| Cross-browser support | Chromium only | **CANDIDATE** | Browser §34 |
| Collaboration→Chromium E2E | Gap | **CANDIDATE** | Browser §34 |
| Production SLOs | Not measured | **CANDIDATE** | ADR-029 |
| Load/soak | Not executed | **CANDIDATE** | Validation §30 |
| DR testing | Documented | **CANDIDATE** (ops) | ADR-030 |
| Tiered storage | Port only | **DEFERRED** | Phase 12 §23 |

---

## 31. Relationship to Final Validation

Final validation established: **the implemented system works within documented boundaries.**

This roadmap:

- does **not** reopen that verdict
- treats skipped PG/soak/SLO items as **hardening candidates**, not proof of architectural failure
- treats deferred products (SaaS, presence UX, CRDT, E2EE, multi-region automation) as **optional futures**, not incomplete core
- treats browser Chromium pass as editor evidence; multi-client collab E2E remains a **candidate gap**

Overall release stance remains:

```text
FINAL VALIDATION PASSED WITH DOCUMENTED LIMITATIONS
RELEASE-READY FOR IMPLEMENTED SCOPE WITH EXPLICIT LIMITATIONS
BROWSER VALIDATION PASSED WITH DOCUMENTED LIMITATIONS
```

---

## 32. Closing Position

Phases 0–12 built a coherent document engine: **ChangeSet → Document → Handle → Version**, with OT collaboration, wire contracts, persistence ports, authoritative server foundations, snapshots/compaction, presence protocol, and proposal-only intelligence — validated under Chromium and Node suites within explicit limitations.

The right next move is **not** another fashion-driven architecture phase. It is:

1. harden what you claim to deploy, or  
2. productize surfaces that already have protocols, or  
3. research only when OT/home-region authority is demonstrably insufficient.

**Protect the architecture. Do not build technology because it is fashionable. Do not turn every limitation into a feature. Do not turn every candidate into a commitment.**

---

## 33. Final Recommendation

### What should Lextrix work on next if development resumes?

#### Top 5 priorities

| # | Priority | Why | Trigger | Dependency | Risk | Value | Discovery needed? |
|---|----------|-----|---------|------------|------|-------|-------------------|
| 1 | **Live PostgreSQL CI + suite green** | Closes Gate J; makes reference persistence real | Deploy/`lextrix-server` claims | Docker/`LEXTRIX_PG_URL` | Low | Foundational | No (ops/CI) |
| 2 | **Multi-process shared-PG fencing harness** | Proves ownership under real concurrency | Multi-instance deploy | #1 | Low–Med | Foundational | Light (harness design) |
| 3 | **WebSocket soak + SLO measurement** | Turns benches into operational truth | Production transport claims | #1 | Low | High | Light (SLO candidates exist) |
| 4 | **Collab → Chromium multi-client E2E** | Closes browser evidence gap for collab projection | Claim multi-user editor correctness | Collab host + browser harness | Med | High | Yes (harness scope) |
| 5 | **Editor projection failure / resync tests** | Validation called coverage thin | Reliability of Hybrid B+ | Existing unit hooks | Low | Medium | No |

#### Top 5 things Lextrix should **NOT** work on yet

| # | Do not pursue yet | Why |
|---|-------------------|-----|
| 1 | **CRDT implementation** | No trigger; extreme architecture cost; OT still fits |
| 2 | **Active-active multi-writer** | Explicitly REJECTED (ADR-033) |
| 3 | **E2EE on server OT path** | Conflicts with authoritative transform/accept |
| 4 | **SaaS billing / tenancy inside core** | ADR-034; application concern |
| 5 | **AI agents / privileged AI mutation** | Breaks ADR-009; research+policy required first |

---

## 34. No Automatic Commitment

Listing an item here does **not** authorize implementation.

Before any future implementation:

1. Confirm business/technical need  
2. Verify the trigger  
3. Perform architecture discovery  
4. Create/accept ADRs where necessary  
5. Define tests and acceptance gates  
6. Define migration strategy  
7. Then implement  

---

## STOP

Future roadmap discovery complete.  
No Phase 13 implementation started.  
No production feature code added.  
No future ADRs authored.  

This file is the strategic source of truth when development resumes.
