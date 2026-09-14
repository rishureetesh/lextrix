# Document Intelligence Platform (Phase 6B–6K)

- Status: **6A–6N COMPLETE · 6O–6P GATE: COMPLETE WITH DOCUMENTED LIMITATIONS**
- Date: 2026-09-14
- Package: `lextrix-intelligence` (+ optional `lextrix-intelligence/openai`); editor path in `lextrix-core`
- Related: [ADR-010](./adr/ADR-010-document-intelligence-provider-boundary.md), [ADR-011](./adr/ADR-011-proposal-provenance-and-acceptance-policy.md), [ADR-013](./adr/ADR-013-proposal-review-workflow.md), [ADR-009](./adr/ADR-009-ai-as-proposal-producer.md)

## Principle

> The provider generates proposals. The document engine decides whether those proposals are valid and applicable.

> **Provenance describes where a proposal came from. Policy describes what an application may do with it. Neither changes document semantics.**

> **Review is not a mutation system.** A stale proposal is not automatically rebased. A policy result does not itself mutate the document. The editor is not authoritative for accepted external proposals.

```text
REAL LLM (optional)
       ↓
Structured JSON edit
       ↓
ChangeProposal @ baseVersionId  (+ provenance metadata)
       ↓
createProposalReview  (pure: inspect + policy + preview)
       ↓
(optional explicit rebase) → review again
       ↓
explicit accept | reject
       ↓
Document.apply → Version
       ↓
Hybrid B+ Editor projection  (acceptProposalAndProject)
```

## Packages / exports

| Import | Contents | Dependencies |
|--------|----------|--------------|
| `lextrix-intelligence` | Contract, deterministic, provenance, policy, **review** | `lextrix-change` only |
| `lextrix-intelligence/openai` | `OpenAiDocumentIntelligenceProvider` | **native `fetch` only** — no `openai` npm package |
| Lextrix (`lextrix-core`) | `acceptProposalAndProject`, `projectAppliedChange`, `getExperimentalHandle` | change + editor; **not** intelligence |

`lextrix-change` has **zero** intelligence / OpenAI / policy / review dependency.
`lextrix-core` does **not** depend on `lextrix-intelligence`.

## Provenance (6H)

Optional `ChangeMeta` fields (typed, still non-semantic):

| Field | Role |
|-------|------|
| `source: 'ai'` | Attributable as AI-generated — **not** trusted |
| `provider` | Generic string (`deterministic`, `openai`, …) |
| `model` | Generic model id string |
| `explanation` | Untrusted human-readable claim — never executed |
| `confidence` | Optional 0..1 provider score — **not** correctness |
| `requestId` | Provider correlation id — ≠ `proposal.id` |
| `generatedAt` | Wall-clock metadata — not version/OT ordering |

Helpers:

```ts
import {
  readProposalProvenance,
  buildAiProposalMeta,
  isAiSourced,
} from 'lextrix-intelligence';
```

**explanation ≠ ChangeSet.** If they disagree, the ChangeSet is authoritative.

Provenance survives:

* rebase (`meta` copied; `baseVersionId` updates)
* `toJSON` / `parseChangeProposal`
* accept → new `DocumentVersion.meta` (and `version.toJSON().meta`)

## Confidence

> Provider/application metadata, not a document-engine guarantee.

`confidence = 0.99` does **not** mean the proposal is correct. The engine still validates structurally. Default policy never auto-accepts on confidence.

## Acceptance policy (6I)

Pure application-level evaluation — **not** in `lextrix-change`:

```ts
import { evaluateProposalAcceptancePolicy } from 'lextrix-intelligence';

const decision = evaluateProposalAcceptancePolicy({
  proposal,
  context: { headVersionId: handle.currentVersion().id },
});
// decision.eligible / requiresReview / requiresRebase / autoAcceptAllowed / reasons[]
```

Default AI behavior:

* `requiresReview: true`
* `autoAcceptAllowed: false` (always under default policy)
* stale → `requiresRebase: true`, `eligible: false`

Policy **never** mutates Document/Editor, never rebases, never accepts.

Correct flow:

```text
policy → (if eligible) → inspect/validate → acceptProposal
```

### Validation vs policy

| Layer | Question |
|-------|----------|
| Engine validation | Is this proposal structurally valid / applicable? |
| Policy | Given application rules, what should we do next? |

## Review workflow (6J)

```ts
import {
  createProposalReview,
  acceptReviewedProposal,
  rejectReviewedProposal,
  rebaseReviewedProposal,
} from 'lextrix-intelligence';

const review = createProposalReview({ handle, proposal, range: request.range });
// review.status: invalid | stale | pending | ready | blocked
// review.previewContents — ephemeral compose; no Version created
// does NOT mutate Document / Editor

if (review.status === 'stale') {
  const rebased = rebaseReviewedProposal(handle, proposal);
  // createProposalReview again on rebased
}

if (review.status === 'pending') {
  acceptReviewedProposal(handle, proposal, { acknowledgeReview: true });
  // OR rejectReviewedProposal(handle, proposal) — no mutation
}
```

Canonical persisted wire form remains **ChangeProposal** (+ provenance). Review is rebuilt from proposal + current document.

## Editor integration (6K)

```ts
const review = createProposalReview({
  handle: lex.getExperimentalHandle()!,
  proposal,
});
if (review.status === 'pending' || review.status === 'ready') {
  // Application decision after review — Hybrid B+ projection:
  lex.acceptProposalAndProject(proposal);
}
```

Never: AI → `updateContents` / DOM / Blot. Selection remaps via existing ChangeSet transform on projection.

## Collaboration & failure (6L–6M)

AI proposals participate in the same OT / rebase / adapter path as human/remote ChangeSets.

* Stale when HEAD advances — never auto-rebase
* Duplicate `changeId` → one mutation
* Missing `dependsOn` → `CausalDependencyError`
* Projection failure → Document stays advanced; editor `desync` (no Document rollback)

Full matrix: [collaboration-architecture.md §14](./collaboration-architecture.md) · [ADR-014](./adr/ADR-014-collaboration-failure-and-recovery.md)

## Security & Trust Boundary (6N)

> Anything originating outside the Document Engine is untrusted until structural validation and application policy explicitly permit it.

| Rule | Meaning |
|------|---------|
| Provider output | Untrusted — ChangeProposal only, never Document/Editor |
| Serialized proposals | Untrusted — `parseChangeProposal` sanitizes meta, validates ops |
| Metadata | Inert — explanation/confidence/provider never execute or alter OT |
| `untrustedInput` | Wire-parsed proposals require `acknowledgeReview` |
| Provenance | Descriptive, **not** authenticated |
| Secrets | Never in proposal/version/meta/errors — env/config only |
| Ranges | Hard reject invalid bounds (no silent clamp) |
| Remote envelopes | Meta sanitized; `source` forced to `remote` |
| AuthN/AuthZ / crypto | **Outside** the engine (deferred) |

See [ADR-015](./adr/ADR-015-security-and-trust-boundary.md).

## Real provider setup (6F–6G)

```ts
import { createIntelligenceRequest } from 'lextrix-intelligence';
import { OpenAiDocumentIntelligenceProvider } from 'lextrix-intelligence/openai';

const provider = new OpenAiDocumentIntelligenceProvider({
  // apiKey defaults to process.env.OPENAI_API_KEY
  // model defaults to process.env.OPENAI_MODEL || 'gpt-4o-mini'
});

const request = createIntelligenceRequest(handle, {
  instruction: 'Make this more concise',
  range: handle.createRange(10, 80),
});
const proposal = await provider.generate(request);
const decision = evaluateProposalAcceptancePolicy({
  proposal,
  context: { headVersionId: handle.currentVersion().id },
});
if (decision.eligible) {
  handle.inspectProposal(proposal);
  handle.acceptProposal(proposal);
}
```

### Credentials

* `OPENAI_API_KEY` — required for live calls (never commit)
* `OPENAI_MODEL` — optional model override
* Do not log the key. Do not put keys in fixtures/tests/docs.

### Live test (opt-in, not CI)

```bash
LEXTRIX_INTELLIGENCE_LIVE=1 OPENAI_API_KEY=... npm run test:intelligence:live -w lextrix-intelligence
```

Default `npm test` uses **mocked fetch** only — no network.

## Structured output

Model must return JSON only:

```json
{
  "operation": "replace",
  "text": "...",
  "start": 10,
  "end": 80
}
```

* `start`/`end` if present **must equal** the request range
* `ops` arrays are **rejected** on the OpenAI path
* Bare prose is **rejected**
* Result → `structuredEditToChangeSet` → ordinary `ChangeProposal`

## Version / range safety

* Proposal `baseVersionId` = request snapshot (not live HEAD)
* Embed-bearing ranges → `unsupported_content`
* Out-of-range model positions → `out_of_range`
* Stale accept still fails until explicit `rebaseProposal`

## Errors

| Code | Meaning |
|------|---------|
| `provider_unavailable` | Missing key / fetch / network |
| `provider_timeout` | Abort / timeout |
| `provider_rate_limited` | HTTP 429 |
| `provider_malformed` | Bad JSON / schema |
| `out_of_range` | Model positions ≠ request range |
| Engine `ProposalError` / `RebaseError` | Unchanged |

## Security boundary

* Provenance is **not** authorization
* `source = ai` ≠ trusted
* `provider = openai` ≠ safe
* Validation remains mandatory

## Latency

Report **separately**:

* Provider/network/model latency (not a document-engine metric)
* Document-side: ChangeSet build / inspect / rebase / accept
* Policy evaluation (application-side; should stay cheap)

## Roadmap classification

| Item | Status |
|------|--------|
| 6C Context / Range | COMPLETE |
| 6D Deterministic intelligence | COMPLETE |
| 6F–6G Real provider + structured output | COMPLETE |
| 6H–6I Provenance + Policy | COMPLETE |
| **6J–6K Review + Editor Integration** | **COMPLETE** |
| **6L–6M Collab + Failure Semantics** | **COMPLETE** |
| **6N Security / Trust Boundary** | **COMPLETE** |
| **6O–6P Final Verification & Gate** | **COMPLETE WITH DOCUMENTED LIMITATIONS** |

## Explicitly deferred

Second providers, registry, agents, RAG, embeddings, AI UI, **review UI**, auto-accept/rebase, streaming document mutation, cloud, transport, policy DSL/engine, trust scoring, moderation platform.
