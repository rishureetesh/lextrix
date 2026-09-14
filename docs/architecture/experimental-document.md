# Experimental Document API (Phase 1–8)

**Status:** experimental barrel — prefer stable imports when possible  
**Stable runtime:** `lextrix-change/document` (ADR-016 / ADR-017)  
**Stable wire:** `lextrix-change/wire` (ADR-012)  
**Import (full / unstable extras):** `lextrix-change/experimental`  
**Editor bridge:** opt-out via `experimentalDocument: false`

Use `lextrix-change/document` for Document / Handle / Transaction / Version / Anchor / Range / Proposal / subscribe.

The experimental barrel still exports `LinearVersionStore`, in-memory collab helpers, and `DocumentReference` — **no** semver promise.

## Conceptual map

| Concept | Role |
|---------|------|
| **DocumentState** | What the document IS |
| **ChangeSet** | How the document CHANGES |
| **Version** | Immutable identity/snapshot of a DocumentState |
| **Transaction** | Accumulates intents → one ChangeSet |
| **Anchor** | Version-bound point offset |
| **Range** | Half-open `[start, end)` of two anchors |
| **Proposal** | Uncommitted ChangeSet against a base Version |
| **Reference** | `{ documentId, versionId, range }` pointer |
| **History** | Editor undo/redo — **not** versioning |
| **Rebase** | Move a Proposal along a linear version chain via transform |
| **Collaboration adapter** | Pending/ack/dedup — **not** transport |
| **AI / agents** | Proposal **producers** only — never Document/DOM mutators |

```text
ChangeSet ≠ Proposal ≠ Version ≠ History
Collaboration ≠ Transport
AI ≠ mutation path
```

## Law

```text
DocumentState --apply(ChangeSet)--> DocumentState'
Proposal      --accept------------> Version   (iff base === HEAD)
Proposal      --rebase(target)----> Proposal'
AI intent     --(app)-------------> ChangeProposal
```

## AI proposals (Phase 6A)

See [ai-proposals.md](./ai-proposals.md) and [ADR-009](./adr/ADR-009-ai-as-proposal-producer.md).

```ts
const proposal = handle.createProposal(change, {
  meta: { source: 'ai', intent: 'shorten', explanation: '…' },
});
handle.inspectProposal(proposal); // validates against base; reports stale
const next = handle.rebaseProposal(proposal); // if stale — explicit
handle.acceptProposal(next);

const wire = JSON.stringify(proposal.toJSON());
const again = parseChangeProposal(wire);
```

Proposals are untrusted until validated. No model SDKs in core.

## Document intelligence (Phase 6B–6K)

Package: `lextrix-intelligence` (depends on `lextrix-change`; engine does **not** depend on it).

```ts
import {
  createIntelligenceRequest,
  createProposalReview,
  DeterministicDocumentIntelligenceProvider,
  acceptReviewedProposal,
  evaluateProposalAcceptancePolicy,
  readProposalProvenance,
} from 'lextrix-intelligence';

const request = createIntelligenceRequest(handle, {
  instruction: 'shorten',
  operation: 'shorten',
  range: handle.createRange(0, 40),
  context: { maxLength: 20 },
});
const proposal = await new DeterministicDocumentIntelligenceProvider().generate(request);
const review = createProposalReview({ handle, proposal, range: request.range });
// review is pure — no Document mutation
if (review.status === 'pending') {
  acceptReviewedProposal(handle, proposal, { acknowledgeReview: true });
}
```

Editor path (Hybrid B+, after review):

```ts
lex.acceptProposalAndProject(proposal); // Document.accept then projectAppliedChange
```

See [document-intelligence.md](./document-intelligence.md). **Phase 6 complete with documented limitations.** Phases 7–12 subsequently completed; see [FUTURE-ROADMAP.md](./FUTURE-ROADMAP.md) for future work.

```ts
// Optional real provider (no openai npm package — uses fetch)
import { OpenAiDocumentIntelligenceProvider } from 'lextrix-intelligence/openai';
```

## Rebase (Phase 5B)

```ts
const rebased = handle.rebaseProposal(proposal, tip);
// for C of changesBetween(base, tip): P' = C.transform(P, true)
```

Stale `acceptProposal` still rejects without explicit rebase.

## Collaboration / Hybrid B+

Unchanged from Phase 5B — see [collaboration-architecture.md](./collaboration-architecture.md) and ADR-007/008.

```ts
lex.applyExternalChange(remoteChange); // Document → Editor projection
```

## Editor (Strategy B — local path unchanged)

```text
Editor → settled ChangeSet → Document mirror → Version++
```
