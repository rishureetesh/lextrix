# ADR-006 Change Proposals (Experimental)

- Status: Accepted
- Date: 2026-09-14
- Phase: 4

## Context

Phases 1–3 provide ChangeSet, Document, Version, and Anchor. Review, suggestions, and future AI need a way to express “apply this ChangeSet to Version N” without committing it until accepted — and without rebasing or collaboration protocols yet.

## Decision

### What a Proposal is

```text
ChangeProposal = {
  id,
  documentId,
  baseVersionId,   // Version the ChangeSet was authored against
  change,          // ChangeSet transition
  meta             // ChangeMeta (source may be user|api|ai|…)
}
```

```text
Proposal ≠ ChangeSet ≠ Version ≠ History
```

A proposal is an **uncommitted intent**. Acceptance applies its ChangeSet through the sole mutation path (`DocumentHandle.apply` → `Document.apply`).

### Direct-apply rule (Phase 4)

```text
accept only if proposal.baseVersionId === currentVersion.id
```

Stale proposals (base behind HEAD) are **rejected** with an explicit error. No automatic rebase/transform in Phase 4 (leaves a clean seam for later `rebase(proposal, target)`).

### Accept / Reject

| Action | Effect |
|--------|--------|
| **Accept** | Validate → `apply(change)` → exactly one new Version (or no-op if empty change) |
| **Reject** | No Document/Version mutation |

Failed accept is **atomic**: no partial version.

### Ranges & references

- **DocumentRange** = half-open `[start, end)` of two `DocumentAnchor`s (ADR-005 mapping reused).
- **DocumentReference** = `{ documentId, versionId, range }` — headless, serializable pointer for future comments/citations. Not DOM.

### Editor authority

Strategy B unchanged. Proposal accept is a Document-engine operation; it does not project into the editor in Phase 4.

## Alternatives considered

1. **Silent rebase of stale proposals** — Deferred (collab/AI phase).
2. **Proposal = Version** — Rejected; conflates intent with state.
3. **Review UI / queues** — Out of scope; application layer.

## Consequences

- Experimental APIs under `lextrix-change/experimental`.
- Callers must refresh or rebase proposals when the document advances.
- Headless `restoreVersion` (optional) creates a **new** version equal to an old snapshot; does not rewrite history or the editor.

## Migration strategy

Ship proposal/range/reference with tests; keep editor bridge Strategy B.
