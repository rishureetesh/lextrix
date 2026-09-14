# ADR-013 — Proposal Review Workflow (Application Layer)

- Status: Accepted
- Date: 2026-09-14
- Related: [ADR-006](./ADR-006-change-proposals.md), [ADR-008](./ADR-008-document-to-editor-projection.md), [ADR-009](./ADR-009-ai-as-proposal-producer.md), [ADR-011](./ADR-011-proposal-provenance-and-acceptance-policy.md)

## Context

Phases 6A–6I established proposals, intelligence providers, provenance, and pure acceptance policy. Applications still lacked a single derived **review** view that answers: is this proposal ready, stale, invalid, or policy-blocked — without mutating the document — and a Document→Editor path that accepts a proposal **without double-applying** through `applyExternalChange`.

ADR-006 covers engine proposal primitives. ADR-011 covers policy. ADR-008 covers Hybrid B+ for arbitrary external ChangeSets. None names the review façade or the project-after-accept seam.

## Decision

1. **`ProposalReview` is a derived snapshot** in `lextrix-intelligence`, built from `inspectProposal` + `evaluateProposalAcceptancePolicy` + provenance. It is not a second source of truth and is not persisted as authoritative state. Wire format remains `ChangeProposal`.

2. **Review construction is observational.** It may inspect/validate/preview; it must not apply, accept, rebase, or touch Editor/DOM.

3. **Status is derived** (`invalid` | `stale` | `pending` | `ready` | `blocked`). Stale ≠ rejected. Accepted/rejected are outcomes of explicit orchestration, not stored review-DB states.

4. **Orchestration wrappers** (`acceptReviewedProposal`, `rejectReviewedProposal`, `rebaseReviewedProposal`) call existing `DocumentHandle` APIs only. Default AI accept requires `acknowledgeReview: true`. No auto-rebase; no auto-accept.

5. **Editor integration (6K)** lives in `lextrix-core`:
   - `projectAppliedChange` — project a ChangeSet already applied to Document (no second apply)
   - `acceptProposalAndProject` — `acceptProposal` then project under existing `projectionDepth` / `runAsProjection`
   - `getExperimentalHandle` — for applications to build reviews

6. **Core does not depend on intelligence.** Apps compose: review (intelligence) → accept+project (core).

7. **Preview** uses `base.contents.compose(proposal.change)` ephemerally — no VersionStore write.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Persist Review in VersionStore | Conflates application UX state with document history |
| Put review in `lextrix-change` | Couples engine to AI/product review rules |
| Reuse `applyExternalChange` after accept | Double-applies the same ChangeSet |
| Auto-rebase on accept | Violates explicit-rebase invariant |
| Review UI in this ADR | Out of scope (deferred) |

## Consequences

- Applications can review multiple proposals independently.
- Provenance/policy remain visible without mutating Document.
- Accepted external proposals still reach the editor only via Document→Editor projection.
- Serialization Boundaries (ADR-012) remain separate.

## Migration strategy

None for engine consumers. Optional:

```ts
import { createProposalReview, acceptReviewedProposal } from 'lextrix-intelligence';
// lex.acceptProposalAndProject(proposal) after review
```
