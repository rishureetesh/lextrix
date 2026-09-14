# AI Proposals & Document Intelligence (Phase 6A)

- Status: Architecture complete for 6A (no model providers)
- Date: 2026-09-14
- Related: [ADR-009](./adr/ADR-009-ai-as-proposal-producer.md), [ADR-006](./adr/ADR-006-change-proposals.md)

## Principle

> **AI is a proposal producer, not a document mutator.**

```text
AI intent ("make shorter")  →  application converts  →  ChangeSet
ChangeSet + baseVersion     →  ChangeProposal
ChangeProposal              →  Document engine (validate / rebase / accept)
```

The engine never receives natural-language instructions. It never calls model APIs.

## Proposal lifecycle

```text
Create
  ↓
Inspect  (valid against base? stale relative to HEAD?)
  ↓
Review   (derived: status + policy + provenance + preview)  — Phase 6J
  ↓
Validate (accept-ready? base === HEAD + dry-run)
  ↓
Optionally Rebase (explicit)
  ↓
Accept  →  Document.apply  →  Version  →  optional Hybrid B+ projection
  OR
Reject  →  no mutation
```

| API | Role |
|-----|------|
| `createProposal` / `createChangeProposal` | Bind ChangeSet to Version |
| `inspectProposal` | Validate@base; report `stale` without requiring HEAD |
| `createProposalReview` | Derived review snapshot (`lextrix-intelligence`) |
| `validateProposal` | Accept gate (base must be HEAD) |
| `rebaseProposal` | New proposal@target; original unchanged |
| `acceptProposal` / `rejectProposal` | Commit or discard |
| `acceptProposalAndProject` | Accept + Hybrid B+ editor projection (`lextrix`) |
| `toJSON` / `parseChangeProposal` | Deterministic serialization |

## Version binding

Every proposal carries `baseVersionId`. Accepting without a known base is forbidden. If the document advanced:

```text
AI@V42 + HEAD=V45  →  stale
                   →  rebase(V42→V45) then accept
```

No automatic AI rebase.

## Source metadata

`ChangeMeta.source` may be `'ai'` (also `user`, `remote`, `system`, …). Extensible provenance fields (`explanation`, `model`, `provider`, `confidence`, `requestId`, `generatedAt`) are optional for audit/UI — they **do not** change OT/apply semantics.

Acceptance policy (`evaluateProposalAcceptancePolicy` in `lextrix-intelligence`) is application-layer and pure — see [document-intelligence.md](./document-intelligence.md) and [ADR-011](./adr/ADR-011-proposal-provenance-and-acceptance-policy.md).

Failure / collab hardening: [ADR-014](./adr/ADR-014-collaboration-failure-and-recovery.md), [collaboration-architecture.md §14](./collaboration-architecture.md).

## Security boundary

> A proposal is **untrusted input** until validated by the Document engine.

Origin (internal model, trusted server, plugin) does not skip validation.

Wire JSON is sanitized (`untrustedInput`); metadata is inert; confidence cannot grant acceptance. See [ADR-015](./adr/ADR-015-security-and-trust-boundary.md).

## Editor boundary

Forbidden: AI → DOM / Blot / `updateContents` / History.

Correct:

```text
Proposal → accept / apply → Version → optional Hybrid B+ projection
```

`acceptProposal` remains headless. Editor sync uses the existing projection path (`applyExternalChange`), not an AI-specific projector.

## Collaboration boundary

AI-origin proposals use the same `rebaseProposal` / OT as human/remote changes. No AI-specific collaboration algorithm.

## History

Accepted AI proposals create **Versions**. Whether they become undo entries is an editor policy — not automatic by virtue of `source: 'ai'`.

## Deterministic simulation

Tests use `DeterministicProposalGenerator` under `packages/change/src/testing/` — not exported from `lextrix-change/experimental`, not a model runtime.

## Explicitly deferred

LLM SDKs, streaming, embeddings, RAG, agents, AI UI, cloud, network transport, branches, CRDT, semantic conflict resolution, structural sharing, Document-first local editing.

**Next layer:** [document-intelligence.md](./document-intelligence.md) (Phase 6B provider contracts in `lextrix-intelligence`).
