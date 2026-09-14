# Lextrix Document Engine — Transformation Progress

**Release target:** major architectural release (planning name: **Lextrix Engine** / post-2.1.x)  
**North star:** programmable document + change infrastructure; editor is one consumer  
**Discovery report:** [document-engine-transformation.md](./document-engine-transformation.md)  
**Last updated:** 2026-09-14

Use this file as the **single progress board**. Update status weekly. Do not start Phase N+1 until Phase N exit criteria are met (or explicitly waived with an ADR).

---

## Status legend

| Status | Meaning |
|--------|---------|
| `not-started` | Not begun |
| `in-progress` | Active work |
| `blocked` | Waiting on decision / dependency |
| `done` | Exit criteria met |
| `deferred` | Intentionally postponed |

---

## Phase overview

| Phase | Name | Status | Target window |
|-------|------|--------|---------------|
| 0 | Architecture discovery | `done` | 2026-09-14 |
| 1 | ChangeSet hardening + headless Document spike | `done` | 2026-09-14 |
| 2 | Transactions + editor dual-path | `done` | 2026-09-14 |
| 3 | Linear versions + Anchor prototype | `done` | 2026-09-14 |
| 4 | Review + document primitives | `done` | 2026-09-14 |
| 5A | Collaboration architecture (discovery) | `done` | 2026-09-14 |
| 5B | Collaboration / rebase / projection (impl) | `done` | 2026-09-14 |
| 6A | AI proposal infrastructure (provider-neutral) | `done` | 2026-09-14 |
| 6B | Document Intelligence Platform (contract) | `done` | 2026-09-14 |
| 6C–6D | Context & Deterministic Document Intelligence | `done` | 2026-09-14 |
| 6F–6G | Real provider + structured output | `done` | 2026-09-14 |
| 6H–6I | Provenance + acceptance policy | `done` | 2026-09-14 |
| 6J–6K | Review workflow + editor projection | `done` | 2026-09-14 |
| 6L–6M | Collaboration hardening + failure semantics | `done` | 2026-09-14 |
| 6N | Security & trust boundary | `done` | 2026-09-14 |
| 6O–6P | Final Phase 6 verification & gate | `done` | 2026-09-14 |
| 7 | Wire contracts (ADR-012) | `done` | 2026-09-14 |
| 8 | Runtime Document API | `done` | 2026-09-14 |
| 9 | Persistence / transport ports | `done` | 2026-09-14 |
| 10 | Authoritative server | `done` | 2026-09-14 |
| 11 | PostgreSQL / ownership / WebSocket | `done` | 2026-09-14 (limitations: live PG env) |
| 12 | Snapshots / compaction / presence / lifecycle | `done` | 2026-09-14 (limitations: product UX deferred) |
| — | Cloud / hosted packaging | `deferred` | Explicitly later (not Phase 8 runtime) |
| — | Future capability work | See [FUTURE-ROADMAP.md](./FUTURE-ROADMAP.md) | Not started |

---

## Phase 0 — Discovery (complete)

| Item | Status | Notes |
|------|--------|-------|
| Repo-wide architecture audit | `done` | See discovery report |
| Current / target maps | `done` | Mermaid in report |
| Gap analysis + risk register | `done` | R1–R10 |
| 15 explicit Q&A | `done` | End of discovery report |
| Progress tracker created | `done` | This file |

**Exit criteria:** Owner accepts (or amends) discovery report before production refactors.

- [x] Owner sign-off on discovery report *(Phase 1 implementation authorized)*
- [x] Agree Month-1 scope (no collab/AI product yet)

---

## Phase 1 — ChangeSet + Document spike (`done`)

**Goal:** Prove ChangeSet as foundation; spike DOM-free `Document.apply`.

| Workstream | Status | Owner | Notes |
|------------|--------|-------|-------|
| ADR-001 Canonical Document Model | `done` | | [ADR-001](./adr/ADR-001-canonical-document-model.md) Accepted |
| ADR-002 ChangeSet as Core Primitive | `done` | | [ADR-002](./adr/ADR-002-changeset-core-primitive.md) Accepted |
| ADR-003 DOM as Rendering Boundary | `done` | | [ADR-003](./adr/ADR-003-dom-rendering-boundary.md) Accepted |
| Dual operation model investigation | `done` | | [dual-operation-model.md](./dual-operation-model.md) — no structural change |
| OT property tests (compose/transform/invert/diff) | `done` | | `packages/change/tests/ot-property.test.ts` |
| ChangeSet fuzz suite + generators | `done` | | Seeded PRNG; failures reproducible by seed |
| Headless `Document` spike API | `done` | | `lextrix-change/experimental` |
| Minimal schema | `done` | | Insert-only document validation |
| Headless / Node isolation test | `done` | | Bans browser globals + DOM imports |
| Bench: compose/transform/invert/diff/apply | `done` | | `npm run bench:change` |
| Experimental API docs | `done` | | [experimental-document.md](./experimental-document.md) |
| Update this tracker | `done` | | |

**Exit criteria:**

- [x] ADRs 001–003 accepted
- [x] Property + fuzz OT suite green (`lextrix-change`: 41 tests)
- [x] Spike can `createDocument` → `apply(ChangeSet)` → `getContents` **without** `document`/`window`
- [x] Baseline benchmarks exist (tiny/medium/large)
- [x] Experimental Document API documented (unstable)
- [x] No intentional break to published editor APIs (2.1.x path untouched)

**Explicitly out of scope (honored):** package renames, collab, AI UI, blot rewrite, versions/branches, cloud.

### Phase 1 summary (completed work)

1. **ADRs** — DocumentState vs ChangeSet law; ChangeSet OT guarantees; DOM as projection only.
2. **Change hardening** — Generators + 2000-iteration property tests for compose associativity, invert round-trip, transform convergence (Quill priority), diff correctness.
3. **Dual-op model** — Keep public `ChangeOp` + internal `DocumentOperation` + bridge; do not export native ops in Phase 1.
4. **Experimental Document** — Immutable headless `createDocument` / `apply` / `getContents` + minimal schema under `lextrix-change/experimental`.
5. **Benchmarks** — Reproducible script for compose/transform/invert/diff/apply at tiny/medium/large sizes.
6. **Editor** — Production blot/DOM/editor/React paths intentionally unchanged.

### Architectural decisions (Phase 1)

| Decision | Rationale |
|----------|-----------|
| DocumentState ≠ ChangeSet | State is contents+schema; ChangeSet is the transition language |
| `apply` ≡ `contents.compose(change)` | Matches Quill/Lextrix ChangeSet semantics |
| Public ops stay `ChangeOp` | Avoid premature API commitments; collab can still use internal OT |
| Experimental export only | Survive Phase 2 before public freeze |
| Attribute equality normalizes key order | JSON key order is not semantic |

### Benchmark baseline (2026-09-14, local)

| Size | compose ms/op | transform | invert | diff | apply | sample doc bytes |
|------|---------------|-----------|--------|------|-------|------------------|
| tiny | 0.0169 | 0.0298 | 0.0050 | 0.0213 | 0.0095 | 19 |
| medium | 0.0184 | 0.0198 | 0.0050 | 0.0337 | 0.0150 | 46 |
| large | 0.0485 | 0.0145 | 0.0109 | 0.1139 | 0.0419 | 888 |

Run: `npm run bench:change`

### Test results (Phase 1)

- `lextrix-change`: **6 files / 41 tests passed** (includes OT property + document isolation + experimental Document fuzz)
- Failures are reproducible via generator seeds (property tests print seed on fail)

### Unresolved questions (carry to Phase 3+)

1. ~~When does editor dual-write begin?~~ → **Resolved Phase 2:** Strategy B (editor→Document) via `modify()`.
2. Should schema grow beyond insert-only before versions?
3. Will collaboration require exporting (or stabilizing) the internal `DocumentOperation` stream?
4. How should attribute key canonicalization be enforced at the ChangeSet construction boundary?
5. When to flip authority Document→Editor (projector) — after divergence soak?
6. Position mapping for Phase 3 anchors vs DOM-bound `DocumentIndexMapper`.

### Risks discovered / confirmed

| Risk | Severity | Notes |
|------|----------|-------|
| R1 blot/DOM still live truth in production | Critical (known) | Phase 2 mirrors Document; does not flip authority |
| Attribute key order non-determinism | Low | Mitigated in test equality; not yet at write boundary |
| Dual-op bridge cost / fidelity | Medium | Documented; deferred structural cleanup |
| Premature public API commitment | Medium | Guarded by `experimental` export |
| Strategy B apply failure after blot mutate | Low | Resync Document from live editor contents |

**Phase 2 authorized and completed** (see below). **Do not auto-start Phase 3.**

---

## Phase 2 — Transactions + editor bridge (`done`)

**Goal:** Transaction → ChangeSet → Document.apply pipeline + editor bridge without destabilizing 2.1.x.

| Workstream | Status | Notes |
|------------|--------|-------|
| Transaction design (not ADR-004) | `done` | [document-transactions.md](./document-transactions.md); ADR-004 reserved for versioning |
| Dual-write strategy decision | `done` | **Strategy B** — [editor-document-bridge.md](./editor-document-bridge.md) |
| `DocumentTransaction` → ChangeSet | `done` | `lextrix-change/experimental` |
| `DocumentHandle` sole apply path | `done` | `apply` / `commitTransaction` |
| Editor bridge (`modify` hook) | `done` | `EditorDocumentBridge` one-way Editor→Document |
| History undo/redo unchanged | `done` | Verified; not versioning |
| Divergence invariant tests | `done` | `document-bridge.spec.ts` |
| Transaction unit tests | `done` | `packages/change/tests/transaction.test.ts` |
| Benchmarks (tx + apply) | `done` | `npm run bench:change` |
| Experimental docs updated | `done` | [experimental-document.md](./experimental-document.md) |

**Exit criteria:**

- [x] Transaction API exists experimentally; commit → ChangeSet; abort → no mutation; lifecycle tested
- [x] Metadata/origin semantics documented (`ChangeMeta`)
- [x] Transactions commit through `Document.apply` (no alternate Document mutation language)
- [x] Document remains DOM-free (isolation test)
- [x] Editor participates via Strategy B bridge; no uncontrolled sync loop
- [x] Editor/Document contents invariant tested
- [x] History undo/redo remains correct
- [x] Unit + integration + existing editor/history suites green on exercised paths
- [x] Transaction/apply benchmarks recorded
- [x] Docs + tracker updated

**Explicitly out of scope (honored):** versions, snapshots, anchors, collab, AI, branches, blot rewrite, package renames.

### Phase 2 summary

1. **Transactions** — begin/ops/commit/abort; empty → empty ChangeSet; nested rejected on handle.
2. **Strategy B** — blot path first; settled ChangeSet mirrored into Document at end of `modify()`.
3. **Failure recovery** — on Document.apply failure, resync Document from live editor ChangeSet.
4. **Experimental editor APIs** — `getExperimentalDocument`, `experimentalTransaction`, `experimentalCommit` (opt-out: `experimentalDocument: false`).
5. **ADR-004 untouched** — still Planned for Phase 3 versioning.

### Benchmark baseline (Phase 2, 2026-09-14 local)

| Size | compose | transform | invert | diff | apply | txCommit | commitTx |
|------|---------|-----------|--------|------|-------|----------|----------|
| tiny | 0.0187 | 0.0298 | 0.0058 | 0.0224 | 0.0104 | 0.0134 | 0.0234 |
| medium | 0.0231 | 0.0290 | 0.0054 | 0.0364 | 0.0185 | 0.0083 | 0.0287 |
| large | 0.0668 | 0.0281 | 0.0214 | 0.1232 | 0.0712 | 0.0075 | 0.0552 |

No unexplained material regression vs Phase 1 order-of-magnitude baselines (local variance expected).

### Test results (Phase 2)

- `lextrix-change`: **7 files / 49 tests** passed
- `document-bridge.spec.ts`: **9** passed
- `history.spec.ts`: **21** passed
- `editor.spec.ts` + `lextrix.spec.ts` + `destroy.spec.ts`: **225** passed

**Do not start Phase 3 until owner explicitly proceeds.** *(Phase 3 authorized and completed — see below.)*

---

## Phase 3 — Linear versions + Anchors (`done`)

**Goal:** Immutable linear Versions + ChangeSet-mapped Anchors; Strategy B unchanged.

| Workstream | Status | Notes |
|------------|--------|-------|
| ADR-004 Document Versioning | `done` | [ADR-004](./adr/ADR-004-document-versioning.md) Accepted |
| ADR-005 Stable Anchors | `done` | [ADR-005](./adr/ADR-005-stable-anchors.md) Accepted |
| Linear snapshots on DocumentHandle | `done` | Full frozen ChangeSet per version |
| `diff(versionA, versionB)` | `done` | Reuses ChangeSet.diff |
| `DocumentAnchor.mapThrough` | `done` | transformPosition + affinity |
| revision vs version documented | `done` | ADR-004 |
| Editor version advancement | `done` | Strategy B reconcile records versions |
| Property/fuzz coverage | `done` | version + anchor fuzz tests |
| Benchmarks | `done` | versionApply / versionDiff / anchorMap + snapshot bytes |
| Docs | `done` | experimental-document.md updated |

**Exit criteria:**

- [x] ADR-004 accepted; immutable linear versions; empty tx = no version; multi-op tx = one step
- [x] Previous versions readable; current vs historical distinguished
- [x] `diff(A,B)` + `A.compose(diff)=B`; same-version empty
- [x] Experimental anchors with version association + mapThrough
- [x] Insertion/deletion/boundary/affinity defined and tested
- [x] Strategy B intact; history ≠ versioning; editor suites green
- [x] Snapshot strategy documented (full snapshots; structural sharing deferred)

**Explicitly out of scope (honored):** branches, merge, collab, AI, comments UI, blot rewrite.

### Version model

```text
DocumentVersion = { id, documentId, sequence, revision, contents, parentId, changeFromParent?, meta? }
```

History store: `LinearVersionStore` on `DocumentHandle`.

### Snapshot strategy

**Full document ChangeSet clone+freeze per version.** Correct and simple. Space grows O(versions × doc size). Future structural sharing can plug in without changing Version identity APIs.

### Anchor semantics

Default affinity **`after`**. `before`/`after` map to Quill `transformPosition` priority true/false.

### Benchmark baseline (Phase 3, 2026-09-14 local)

| Size | apply | versionApply | versionDiff | anchorMap | snapshots (n / bytes) |
|------|-------|--------------|-------------|-----------|------------------------|
| tiny | 0.0125 | 0.0157 | 0.0109 | 0.0018 | 6 / 322 |
| medium | 0.0134 | 0.0194 | 0.0641 | 0.0019 | 6 / 548 |
| large | 0.0685 | 0.0492 | 0.0610 | 0.0013 | 6 / 5414 |

Versioned apply overhead is small vs plain apply at these sizes; snapshot bytes scale with retained versions × content.

### Test results (Phase 3)

- `lextrix-change`: **9 files / 70 tests** passed
- Bridge + history + editor + destroy: **143** passed

### Unresolved (carried into Phase 4 — partially resolved)

1. When to introduce structural sharing / compaction for long version chains?
2. ~~Anchor ranges~~ → **Resolved Phase 4:** `DocumentRange`
3. Headless `restoreVersion` exists; editor checkout still deferred
4. Branch/merge timing (explicitly deferred).

**Phase 4 authorized and completed** (see below).

---

## Phase 4 — Review + document primitives (`done`)

**Goal:** Ranges, ChangeProposals, references — engine primitives for review without UI/collab/AI.

| Workstream | Status | Notes |
|------------|--------|-------|
| ADR-006 Change Proposals | `done` | [ADR-006](./adr/ADR-006-change-proposals.md) |
| DocumentRange `[start,end)` | `done` | Endpoint mapThrough via ADR-005 |
| ChangeProposal accept/reject | `done` | Stale rejected; no rebase |
| DocumentReference | `done` | Minimal version-aware pointer |
| Headless restoreVersion | `done` | New version = old snapshot; history kept |
| Strategy B unchanged | `done` | Accept does not project to editor |
| Tests + benches + docs | `done` | |

**Exit criteria:**

- [x] Range anchors documented + tested (map, collapse, affinity, fuzz)
- [x] Proposal with base Version; accept → one version; reject → none; stale → error; atomic
- [x] Minimal DocumentReference; headless; mappable
- [x] Editor/history green; no feedback loop
- [x] Benchmarks recorded; docs updated

**Out of scope (honored):** collab, CRDT, AI, review UI, branches, Strategy B flip.

### Proposal / range semantics

- Range: half-open; startAffinity default `before`, endAffinity `after`; collapse on covering delete.
- Proposal: `baseVersionId === HEAD` required for accept; `ProposalError` codes: stale, wrong_document, unknown_version, invalid_change, transaction_open.
- Accept ≡ `DocumentHandle.apply(proposal.change)` when valid.

### Benchmark baseline (Phase 4, 2026-09-14 local)

| Size | apply | versionApply | rangeMap | proposalAccept | snapshots |
|------|-------|--------------|----------|----------------|-----------|
| tiny | 0.0117 | 0.0162 | 0.0017 | 0.0319 | 6 / 322B |
| medium | 0.0198 | 0.0189 | 0.0043 | 0.0789 | 6 / 548B |
| large | 0.1334 | 0.1288 | 0.0014 | 0.1015 | 6 / 5414B |

### Test results (Phase 4)

- `lextrix-change`: **11 files / 91 tests** passed
- Bridge + history + destroy: **36** passed

### Unresolved (inputs to Phase 5A — answered; 5B complete)

1. `rebaseProposal` — implemented (sequential `changeFromParent`)
2. Editor projection — Hybrid B+ via `applyExternalChange`
3. Persistent proposal queues / review workflow product — still deferred
4. Structural sharing — still deferred (rebase(N) measured in benches)
5. Anchor decorations — product layer

---

## Phase 5A — Collaboration architecture (`done` — discovery only)

**Goal:** Decide how Lextrix collaborates without implementing transport/CRDT/network.

| Workstream | Status | Notes |
|------------|--------|-------|
| Transform contract audit | `done` | Quill `A.transform(B)→B′`; convergence fuzz exists |
| Rebase algorithm spec | `done` | Sequential `changeFromParent` + `C.transform(P, true)` |
| Layering (engine / adapter / transport) | `done` | [collaboration-architecture.md](./collaboration-architecture.md) |
| ADR-007 Collaboration & Rebase | `done` | **Accepted** |
| ADR-008 Document→Editor Projection | `done` | **Accepted** — Hybrid Strategy B+ |
| Implementation code | `done` | Moved to Phase 5B |

**Exit criteria (5A):** met. Gate to 5B: ADR-007/008 Accepted.

---

## Phase 5B — Collaboration / rebase / projection (`done`)

**Goal:** Prove Document + ChangeSet + Version can safely reconcile independent changes (no network).

| Workstream | Status | Notes |
|------------|--------|-------|
| `changesBetween` / `rebaseProposal` | `done` | `lextrix-change/experimental/rebase.ts` |
| Rebase + OT property fuzz | `done` | `rebase-property.test.ts`, `ot-collab.test.ts` |
| Hybrid B+ projection | `done` | `Lextrix.applyExternalChange` + bridge `projectionDepth` |
| In-memory CollaborationAdapter | `done` | `collaboration.ts`; two/three-client convergence |
| Benchmarks | `done` | rebase 1/10/100 + collab pair in `bench-change` |
| Docs / ADRs | `done` | ADR-007/008 Accepted |

**Exit criteria:**

- [x] Rebase sequential; stale accept still fails; metadata preserved; immutable proposals
- [x] OT convergence + multi-step rebase fuzz green
- [x] Projection: no bridge feedback; contents equality; history transform; desync explicit
- [x] Adapter: pending/ack/dedup; two-client convergence; no WebSocket/CRDT
- [x] Existing suites remain green
- [x] **STOP** — no Phase 6

**Explicitly deferred:** CRDT, WebSockets, presence, AI, branches/merge, review UI, structural sharing, full Document-first local typing, package rename.

---

## Phase 6A — AI proposal infrastructure (`done`)

**Goal:** AI/agents as proposal producers — no model providers, no AI mutation path.

| Workstream | Status | Notes |
|------------|--------|-------|
| Inspect existing ChangeProposal / ChangeMeta | `done` | Already sufficient + `source: 'ai'` |
| `inspectProposal` / `parseChangeProposal` | `done` | Base validation + JSON round-trip |
| Deterministic proposal generator | `done` | `testing/deterministic-proposal-generator.ts` |
| Stale / rebase / concurrent AI↔human tests | `done` | `ai-proposal.test.ts` + property fuzz |
| ADR-009 | `done` | [ADR-009](./adr/ADR-009-ai-as-proposal-producer.md) Accepted |
| Architecture doc | `done` | [ai-proposals.md](./ai-proposals.md) |

**Exit criteria:**

- [x] AI modeled as proposal producer only
- [x] No provider SDK / AI UI / agents
- [x] Stale + explicit rebase preserved
- [x] Metadata provenance does not change OT semantics
- [x] Tests + benches green
- [x] **STOP** — no LLM integration

**Deferred (6+):** OpenAI/Anthropic/Gemini, streaming, embeddings, RAG, agents, AI sidebar, cloud, semantic conflict resolution.

---

## Phase 6B — Document Intelligence Platform (`done`)

**Goal:** Provider-neutral intelligence contracts outside the document engine.

| Workstream | Status | Notes |
|------------|--------|-------|
| Package boundary | `done` | `lextrix-intelligence` → depends on `lextrix-change` only |
| Request + provider contract | `done` | `DocumentIntelligenceRequest` / `DocumentIntelligenceProvider` |
| Deterministic provider | `done` | rewrite / replace / transform / shorten |
| Structured completion seam | `done` | Injectable `complete` — no vendor SDK |
| Lifecycle / collab / fuzz tests | `done` | 11 tests |
| ADR-010 | `done` | Provider boundary Accepted |
| Docs | `done` | [document-intelligence.md](./document-intelligence.md) |

**Exit criteria:**

- [x] Intelligence outside core document semantics
- [x] Providers return proposals only
- [x] Engine has zero provider dependency
- [x] Stale/rebase/OT unchanged
- [x] **STOP** — no AI UI / agents / cloud

**Recommended next milestone (after Phase 8):** Phase 9 — Persistence / transport **consumers** of ADR-012 + runtime Handle API.

---

## Phase 6C–6D — Context & Deterministic Intelligence (`done`)

**Goal:** Close context/range/deterministic gaps without rebuilding 6B.

| Workstream | Status | Notes |
|------------|--------|-------|
| Audit 6B vs 6C/6D | `done` | Most of 6C/6D already present |
| Frozen request + HEAD isolation | `done` | Snapshot contents; no live HEAD |
| Strict range bounds | `done` | No silent clamp |
| Request serialization | `done` | `serialize` / `parseIntelligenceRequest` |
| No-op empty ChangeSet | `done` | Follows engine accept semantics |
| Embed policy | `done` | Text ops reject; replace allowed |
| Apply-correctness + attrs tests | `done` | `context-deterministic.test.ts` |
| Multi-step rebase fuzz | `done` | +100 iterations |

**Classification:** **6C COMPLETE**, **6D COMPLETE**. Remaining Phase 6 letters (6F–6P) deferred (LLM product work).

---

## Phase 6F–6G — Real provider + structured output (`done`)

**Goal:** One real LLM behind the existing contract; structured JSON → ChangeProposal; no vendor SDK in `lextrix-change`.

| Workstream | Status | Notes |
|------------|--------|-------|
| Provider selection | `done` | OpenAI via native `fetch` (no `openai` npm package) |
| Export path | `done` | `lextrix-intelligence/openai` |
| Structured schema | `done` | `{ operation: "replace", text, start?, end? }` |
| Range / version binding | `done` | Reject out-of-range; snapshot baseVersionId |
| Mocked tests (no network) | `done` | `openai-provider.test.ts` |
| Opt-in live test | `done` | `test:intelligence:live` + env gate |
| Docs | `done` | document-intelligence.md updated |

**Classification:** **6F–6G COMPLETE**.

---

## Phase 6H–6I — Provenance, Explainability & Acceptance Policy

**Goal:** Distinguish ChangeSet semantics from provenance metadata and application acceptance policy — without AI UI or auto-mutation.

| Workstream | Status | Notes |
|------------|--------|-------|
| Typed provenance fields on `ChangeMeta` | `done` | provider/model/explanation/confidence/requestId/generatedAt |
| Provenance helpers | `done` | `readProposalProvenance`, `buildAiProposalMeta` in intelligence |
| Acceptance policy (pure) | `done` | `evaluateProposalAcceptancePolicy` — never mutates |
| Rebase / serialize / accept preservation | `done` | Tests + version.toJSON includes meta |
| OT independence | `done` | Metadata does not affect transform |
| ADR-011 | `done` | Accepted |
| Docs | `done` | document-intelligence.md |

**Classification:** **6H COMPLETE · 6I COMPLETE**.

---

## Phase 6J–6K — Review Workflow & Editor Integration

**Goal:** Derived ProposalReview + Hybrid B+ accept→project without a second mutation system.

| Workstream | Status | Notes |
|------------|--------|-------|
| `createProposalReview` (pure) | `done` | inspect + policy + preview; no mutation |
| Accept/reject/rebase orchestration | `done` | Delegates to DocumentHandle; AI needs `acknowledgeReview` |
| `projectAppliedChange` / `acceptProposalAndProject` | `done` | core; no double-apply |
| Selection via existing transform | `done` | No new coordinate system |
| ADR-013 | `done` | Accepted |
| Tests | `done` | intelligence review + lextrix projection |

**Classification:** **6J COMPLETE · 6K COMPLETE**.

---

## Phase 6L–6M — Collaboration Hardening & Failure Semantics

**Goal:** Explicit failure taxonomy; causal dependency safety; projection desync without Document rollback; AI/collab use same OT.

| Workstream | Status | Notes |
|------------|--------|-------|
| Failure taxonomy | `done` | ADR-014 + failure matrix |
| CausalDependencyError | `done` | Missing dependsOn rejected |
| Duplicate publish/remote/ACK | `done` | Idempotent + tests |
| Projection desync / resync status | `done` | No Document rollback |
| AI + remote stale/rebase | `done` | Same OT path |
| Review purity under HEAD advance | `done` | Tests |
| Docs | `done` | collaboration-architecture §14 |

**Classification:** **6L COMPLETE · 6M COMPLETE**.

---

## Phase 6N — Security & Trust Boundary

**Goal:** Untrusted provider/wire/remote input cannot privileged-mutate Document/Editor; metadata inert; secrets out of proposal state.

| Workstream | Status | Notes |
|------------|--------|-------|
| `sanitizeUntrustedChangeMeta` / parse hardening | `done` | Allowlist, limits, `untrustedInput` |
| Remote meta force `source: remote` | `done` | Sanitized envelope meta |
| Policy requires review for wire input | `done` | + AI |
| Range integer hard-reject | `done` | Intelligence requests |
| Secret-safe OpenAI errors | `done` | No body/key in errors |
| ADR-015 | `done` | Accepted |
| Security tests | `done` | change + intelligence |

**Classification:** **6N COMPLETE**.

---

## Phase 6O–6P — Final Verification & Architecture Gate

**Goal:** Prove Phase 6 architecture is complete (or complete with documented limitations); no new features.

| Workstream | Status | Notes |
|------------|--------|-------|
| Package / dependency audit | `done` | change ↛ intelligence; OpenAI outside core |
| Mutation path / ChangeSet canonicality | `done` | Single Document.apply path |
| Cross-layer property tests | `done` | `phase6-gate.test.ts` |
| Full suite + projection | `done` | change 148, intel 80, serialize 122, core 5, projection 19 |
| Serialize vitest experimental alias | `done` | Small gate fix |
| Benchmarks vs Phase 1–6 baselines | `done` | Same order of magnitude; local variance |
| Docs / ADR consistency | `done` | ADR-012 remains Planned |

**Gate decision:** **PHASE 6 COMPLETE WITH DOCUMENTED LIMITATIONS**

*(Historical stop instruction at Phase 6 gate — Phase 7+ subsequently completed.)*

---

## Later phases (parked)

| Phase | Status | Gate |
|-------|--------|------|
| 7 Stabilization & Wire Contracts | `done` | ADR-012 Accepted; minimal stable `lextrix-change/wire` |
| 8 Runtime Document API Stabilization | `done` | ADR-016/017; `lextrix-change/document`; subscribe |
| 9 Persistence / transport ports | `done` | ADR-018/019; `/persistence` + `/collaboration` ports |
| 10 Authoritative collab core | `done` | ADR-020/021/022; `lextrix-collab`; CAS server session |
| 11 Production infra | `done*` | ADR-023–030; `lextrix-server`; PG tests need LEXTRIX_PG_URL |
| 12 Snapshots / compaction / presence protocol / lifecycle | `done*` | ADR-031–035; product UX / multi-region automation deferred |
| Future work | See [FUTURE-ROADMAP.md](./FUTURE-ROADMAP.md) | Capability milestones; not auto-started |

---

## Phase 12 — Compaction, Presence, Multi-Region Foundations & Platform

| Workstream | Status | Notes |
|------------|--------|-------|
| ADR-031–035 | `done` | Accepted |
| Snapshots + integrity + policy N=100 | `done` | `lextrix-change/persistence` |
| Compaction seal→archive→purge | `done` | CompactionController |
| Sync-from-snapshot | `done` | Additive sync fields |
| Presence protocol | `done` | Ephemeral; isolated queues |
| Home-region + promote/fence hooks | `done` | No active-active |
| Lifecycle tombstones | `done` | |
| PG migration 002 | `done` | Adapters + schema |
| SaaS / billing / CRDT / E2EE | `out of scope` | Phase 13+ |

**Gate decision:** **PHASE 12 IMPLEMENTATION COMPLETE WITH DOCUMENTED LIMITATIONS** (live PG suite still optional via `LEXTRIX_PG_URL`; automated multi-region product deferred)

**Do not auto-start Phase 13.**

---

## Phase 12 — Compaction, Presence, Multi-Region & Platform (Discovery)

| Workstream | Status | Notes |
|------------|--------|-------|
| Architecture discovery | `done` | [PHASE-12-ARCHITECTURE-DISCOVERY.md](./PHASE-12-ARCHITECTURE-DISCOVERY.md) |
| ADR-031–035 | `accepted` | Implemented |
| Compaction / snapshot engine | `done` | See Phase 12 implementation |
| Presence protocol | `done` | |
| Multi-region runtime | `foundations done` | Home-region + promote hooks |
| SaaS control plane | `out of scope` | Application layer |

**Gate decision:** Discovery was **APPROVED WITH OPEN DECISIONS**; implementation applied N=100, archive port, measure-then-SLO.

**Do not auto-start Phase 13.**

---

## Phase 11 — Production Persistence, Transport & Distributed Runtime

| Workstream | Status | Notes |
|------------|--------|-------|
| ADR-023–030 | `done` | Accepted |
| PostgreSQL adapter + migrations | `done` | `lextrix-server` |
| Durable changeId + owner_epoch CAS | `done` | |
| Ownership (PG-backed, no Redis) | `done` | |
| WebSocket + CollabHost + Auth hooks | `done` | |
| Fencing / idempotency / AuthZ tests | `done` | In-memory always; PG when URL set |
| Compaction / presence / multi-region | `deferred` | Phase 12 |

**Gate decision:** **PHASE 11 COMPLETE WITH DOCUMENTED LIMITATIONS** (live PG suite requires Docker/`LEXTRIX_PG_URL`)

**Do not auto-start Phase 12 implementation without ADR accept.**

---

## Phase 10 — Authoritative Server & Distributed Collaboration Core

**Goal:** Version-authoritative server session using DocumentHandle + CAS; sync/reconnect protocol; no production infra.

| Workstream | Status | Notes |
|------------|--------|-------|
| ADR-020 / 021 / 022 | `done` | Accepted |
| AuthoritativeDocumentPersistence + CAS | `done` | In-memory reference |
| DocumentServerSession | `done` | Per-doc writer; OT; history after CAS |
| Control frames | `done` | envelope/ack/sync/reject/error |
| AuthoritativeClientSession | `done` | confirmed/pending/reconnect |
| Tests / property / benches | `done` | lextrix-collab |
| Docs / inventory | `done` | api-inventory-phase10 |

**Gate decision:** **PHASE 10 COMPLETE WITH DOCUMENTED LIMITATIONS**

**Do not auto-start Phase 11.**

---

## Phase 9 — Persistence Ports & Collaboration Transport Boundary

**Goal:** Provider-neutral Version persistence + envelope-only transport ports; hydration compose-integrity; ACK ladder; no production infra.

| Workstream | Status | Notes |
|------------|--------|-------|
| ADR-018 Persistence & Durability | `done` | Model B; dirty on persist fail |
| ADR-019 Collaboration Transport | `done` | Envelope-only; ACK ladder; Version-authoritative ref |
| Compose-integrity hydrate | `done` | Default-on; unsafe escape hatch |
| `DocumentPersistence` + memory ref | `done` | Idempotent append by `version.id` |
| `attachPersistence` durability | `done` | No Handle rollback on fail |
| Transport + ACK ports | `done` | `lextrix-change/collaboration` |
| Confirmed vs HEAD | `done` | Confirmed = history ACK only |
| Tests / fuzz / benches | `done` | persistence, transport-ack, hydration-property |
| Docs | `done` | taxonomy, lifecycle, api inventory phase9 |

**Gate decision:** **PHASE 9 COMPLETE**

---

## Phase 8 — Runtime Document API Stabilization

**Goal:** Freeze the minimal in-process Document session contract and graduate a thin stable API.

| Workstream | Status | Notes |
|------------|--------|-------|
| ADR-016 Ownership | `done` | Handle = session; Document = value |
| ADR-017 Observation | `done` | sync subscribe; reentrancy forbidden |
| DocumentError typed codes | `done` | |
| `lextrix-change/document` export | `done` | Thin stable surface |
| `fromVersions` hydrate | `done` | Low-risk persistence aid |
| Observer + ownership tests | `done` | |
| Docs / concurrency matrix | `done` | |
| Runtime observer benches | `done` | via `bench:change` |

**Gate decision:** **PHASE 8 COMPLETE**

---

## Phase 7 — Stabilization & Wire Contracts

**Goal:** Freeze serializable document-engine contracts and graduate a minimal stable API without expanding the product surface.

| Workstream | Status | Notes |
|------------|--------|-------|
| ADR-012 Serialization & Wire Contracts | `done` | Accepted |
| ChangeSet / Version / Proposal / Envelope wire | `done` | `lextrix-change/wire` |
| Version lineage (`changeFromParent`) on wire | `done` | Self-contained snapshots retained |
| Golden + security + property wire tests | `done` | fixtures under `tests/fixtures/wire` |
| API inventory + minimal stable surface | `done` | ChangeSet + `/wire`; experimental bounded |
| Error taxonomy / lifecycle / compat docs | `done` | architecture docs |
| Long-chain / wire benches | `done` | `bench:change` phase7 chains |
| Historical discovery doc clarified | `done` | Phase 0 banner |

**Gate decision:** **PHASE 7 COMPLETE**

**Do not auto-start Phase 8.** (superseded — Phase 8 now complete)

---

## Decision log (lightweight)

| Date | Decision | Link |
|------|----------|------|
| 2026-09-14 | Discovery-only first; no production transformation code until sign-off | This tracker + discovery report |
| 2026-09-14 | Ship path remains 2.1.x reliability; engine work is parallel major track | — |
| 2026-09-14 | DocumentState is contents+schema; ChangeSet is transition only | ADR-001 |
| 2026-09-14 | Keep dual ChangeOp / DocumentOperation; do not export native ops | dual-operation-model.md |
| 2026-09-14 | Phase 1 experimental API lives at `lextrix-change/experimental` | experimental-document.md |
| 2026-09-14 | Phase 1 exit criteria met; Phase 2 later authorized separately | This tracker |
| 2026-09-14 | Phase 2 Strategy B (editor→Document); ADR-004 reserved for versioning | editor-document-bridge.md |
| 2026-09-14 | Phase 2 exit criteria met; Phase 3 later authorized separately | This tracker |
| 2026-09-14 | Linear Version = immutable DocumentState snapshot; full ChangeSet snapshots | ADR-004 |
| 2026-09-14 | Anchors map via ChangeSet.transformPosition + affinity | ADR-005 |
| 2026-09-14 | Phase 3 exit criteria met; Phase 4 later authorized separately | This tracker |
| 2026-09-14 | ChangeProposal + DocumentRange + DocumentReference; no auto-rebase | ADR-006 |
| 2026-09-14 | Phase 4 exit criteria met; Phase 5A architecture authorized separately | This tracker |
| 2026-09-14 | Collab = adapter above Document; rebase via transform; Hybrid B+ projection | ADR-007, ADR-008 |
| 2026-09-14 | Phase 5A complete; ADR-007/008 Accepted; Phase 5B authorized | collaboration-architecture.md |
| 2026-09-14 | Phase 5B complete — rebase, in-memory adapter, Hybrid B+; **stop before Phase 6** | This tracker |
| 2026-09-14 | Phase 6A: AI = proposal producer; ADR-009 Accepted; **stop before LLM integration** | ai-proposals.md |
| 2026-09-14 | Phase 6B: `lextrix-intelligence` provider boundary; ADR-010 Accepted; **stop** | document-intelligence.md |
| 2026-09-14 | Phase 6C–6D complete (context + deterministic); **6F–6P not started** | document-intelligence.md |
| 2026-09-14 | Phase 6F–6G: OpenAI fetch provider + structured JSON; **stop before 6H** | document-intelligence.md |
| 2026-09-14 | Phase 6H–6I: provenance + pure acceptance policy; ADR-011; **stop before 6J** | document-intelligence.md |
| 2026-09-14 | Phase 6J–6K: ProposalReview + acceptProposalAndProject; ADR-013; **stop before 6L** | document-intelligence.md |
| 2026-09-14 | Phase 6L–6M: failure taxonomy, CausalDependencyError, projection desync; ADR-014; **stop before 6N** | collaboration-architecture.md |
| 2026-09-14 | Phase 6N: trust boundary, sanitize wire meta, ADR-015; **stop before 6O** | document-intelligence.md |
| 2026-09-14 | Phase 6O–6P gate: **COMPLETE WITH DOCUMENTED LIMITATIONS**; **stop before Phase 7** | TRANSFORMATION-PROGRESS.md |
| 2026-09-14 | Phase 7: ADR-012 Accepted; `lextrix-change/wire`; minimal stable API; **stop before Phase 8** | ADR-012, wire-format.md |
| 2026-09-14 | Phase 8: ADR-016/017; `lextrix-change/document`; Handle.subscribe; **stop before Phase 9** | ADR-016, ADR-017 |
| 2026-09-14 | Phase 9: ADR-018/019; persistence + transport ports; **stop before Phase 10** | ADR-018, ADR-019 |
| 2026-09-14 | Phase 10: ADR-020/021/022; lextrix-collab DocumentServerSession; **stop before Phase 11** | ADR-020–022 |

Add rows as decisions land. Promote major ones to `docs/architecture/adr/`.

---

## Do-not-build list (active)

Until waived by ADR / Phase gate:

- [ ] Notion-like databases / tasks / chat / dashboards
- [ ] Full CRDT product
- [ ] Git-like branch UI
- [ ] Lextrix Cloud
- [ ] Rewriting blot DOM from scratch
- [ ] Marketing claim “document engine” before public API freeze
- [ ] AI that mutates editor DOM directly
- [ ] Branches / merge / cherry-pick
- [ ] Review / suggestion UI
- [ ] Production WebSockets / multiplayer / presence / remote cursors
- [ ] Production DB adapters (Postgres/SQLite/Redis/…)
- [ ] AuthN / AuthZ inside `lextrix-change`
- [ ] Silent auto-rebase inside `acceptProposal` (rebase remains explicit)

---

## Weekly checklist (copy per week)

```text
Week of: YYYY-MM-DD
- Phase in focus:
- Completed:
- Blockers:
- Next week:
- Risks changed?:
```

### Week of 2026-09-14

- Phase in focus: Phase 10 — Authoritative Collaboration Core — **PHASE 10 COMPLETE WITH DOCUMENTED LIMITATIONS**
- Completed: ADR-020/021/022, CAS persistence, DocumentServerSession, client reconnect, lextrix-collab tests/benches/docs
- Blockers: none
- Next week: Only if authorized — Phase 11 production adapters
- Risks changed?: Multi-instance safety requires deployment ownership + CAS (documented); in-memory is single-process only

---

## Release naming (proposal)

| Track | Cadence | Contents |
|-------|---------|----------|
| **2.1.x** | Patch/minor | Reliability, lifecycle, React DX (current) |
| **2.2 / 2.x experimental** | Optional | Document spike behind `experimental` flag |
| **3.0.0** | Major | Public Document API, deprecate editor-as-truth assumptions, remove deprecated aliases |

Do **not** bump to 3.0.0 until Phase 2 exit criteria are met and a migration guide exists.
