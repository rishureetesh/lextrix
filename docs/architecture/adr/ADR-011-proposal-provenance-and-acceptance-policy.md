# ADR-011 — Proposal Provenance and Acceptance Policy

- Status: Accepted
- Date: 2026-09-14
- Related: [ADR-009](./ADR-009-ai-as-proposal-producer.md), [ADR-010](./ADR-010-document-intelligence-provider-boundary.md)

## Context

Phases 6A–6G established AI as a proposal producer with `ChangeMeta.source: 'ai'` and optional provider/model/explanation fields. Applications still lacked a clear, engine-neutral way to:

1. read provenance without treating it as document semantics
2. decide whether a proposal *may* be accepted under application rules
3. keep that decision separate from structural validation and from mutation

Without an explicit boundary, applications risk:

- baking auto-accept into the document engine
- using confidence as correctness
- using provenance as OT priority or authorization
- putting AI policy inside `lextrix-change`

## Decision

1. **Provenance is metadata on `ChangeMeta` / `ChangeProposal`.** Optional fields (`provider`, `model`, `explanation`, `confidence`, `requestId`, `generatedAt`) are informational. They never alter ChangeSet, OT, compose, transform, apply, or rebase semantics.

2. **Explanation and confidence are untrusted provider claims.** The engine does not verify explanations. Confidence is not a correctness guarantee and never triggers acceptance.

3. **Acceptance policy lives in `lextrix-intelligence` (application layer), not `lextrix-change`.**  
   `evaluateProposalAcceptancePolicy` is a pure function that returns structured reasons (`requires_review`, `stale`, `requires_rebase`, `source_not_allowed`, …). It does not call `Document.apply`, `acceptProposal`, or `rebaseProposal`.

4. **Default AI stance:** AI-sourced proposals require review; `autoAcceptAllowed` is always `false` under the default policy. Acceptance remains an explicit application call into the document engine.

5. **Validation ≠ policy.** Engine validation answers “is this structurally applicable?” Policy answers “what may the application do next?” Policy must not duplicate ChangeSet/range/schema checks unnecessarily.

6. **Provenance survives rebase and proposal serialization.** Rebase changes `baseVersionId` / ChangeSet, not origin. Accepted versions retain proposal meta when a new version is recorded. Version `toJSON` includes `meta` for audit (full wire protocol remains a later serialization ADR).

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Auto-accept when `confidence > threshold` | Violates explicit-acceptance invariant; confidence ≠ correctness |
| Policy inside `lextrix-change` | Couples portable engine to AI product rules |
| PolicyEngine / DSL / registry | Overbuilt for current needs |
| Vendor-specific proposal types (`OpenAIProposal`) | Leaks provider into core types |
| Using provenance for OT priority | Breaks collaboration convergence guarantees |

## Consequences

- Consumers of `lextrix-change` alone remain free of AI policy dependencies.
- Review UIs can render provenance without changing document semantics.
- Future stricter policies (allowlists, size caps) compose as pure functions outside the engine.
- Serialization Boundaries (planned ADR-012) still needed for complete version/collab wire formats.

## Migration strategy

None for engine consumers. Intelligence consumers may adopt:

```ts
import {
  readProposalProvenance,
  evaluateProposalAcceptancePolicy,
} from 'lextrix-intelligence';
```

Existing proposals with index-signature provenance fields continue to work.
