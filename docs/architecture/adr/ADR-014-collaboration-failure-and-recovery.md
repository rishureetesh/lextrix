# ADR-014 — Collaboration Failure & Recovery Semantics

- Status: Accepted
- Date: 2026-09-14
- Related: [ADR-007](./ADR-007-collaboration-and-rebase.md), [ADR-008](./ADR-008-document-to-editor-projection.md), [ADR-009](./ADR-009-ai-as-proposal-producer.md), [ADR-013](./ADR-013-proposal-review-workflow.md)

## Context

Phases 5B and 6A–6K established collaboration, Hybrid B+, proposals, review, and policy. Failure classes were partially implemented but not named as a single contract:

- transport ≠ validation ≠ staleness ≠ rebase failure ≠ projection desync
- Document authority on projection failure
- publish-order / `dependsOn` without out-of-order buffering
- atomic accept / immutable proposals under failure

ADR-007 covers OT/rebase ownership. ADR-008 covers Hybrid B+ success path. Neither fully specifies the failure/recovery matrix across proposal + collab + projection.

## Decision

### 1. Failure taxonomy (non-interchangeable)

| Class | Meaning | Document mutation? |
|-------|---------|-------------------|
| Transport | Delivery failed (outside engine) | No |
| Provider | Intelligence generation failed | No |
| Validation | Proposal cannot apply @ base | No |
| Stale | Valid @ base; HEAD advanced | No |
| Rebase failure | Cannot rebase through chain | No |
| Accept failure | Accept throws after inspect | No |
| Projection failure | Document advanced; editor desync | **Yes (Document)** |
| Duplicate delivery | Same `changeId` again | No (after first) |
| Causal dependency | `dependsOn` not yet accepted | No |

### 2. Atomicity

A Document mutation either completes the intended transition or leaves HEAD/versions/revision unchanged. No partial Versions.

### 3. Proposal immutability

Failed rebase/accept/projection never mutate the original proposal object (ChangeSet, baseVersionId, provenance).

### 4. Collaboration

- Publish order = accept order (in-memory coordinator).
- Missing `dependsOn` predecessors → `CausalDependencyError` (no buffering).
- Duplicate publish / remote / ACK → idempotent.
- AI proposals use the same OT path; no privileged AI collab protocol.

### 5. Projection

- Document remains authoritative if editor projection fails.
- **No Document rollback** on projection failure.
- Successful recovery via full resync → `status: 'resync'`.
- Unrecoverable → `status: 'desync'`.
- `projectAppliedChange` never re-applies Document.
- Resync/retry must not feed projection back into Document (`projectionDepth`).

### 6. Semantic vs structural

Structural failures reject. Semantic ambiguity after successful OT is an application/review concern — not resolved by the engine.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Buffer out-of-order envelopes | Scope expansion toward a network protocol |
| Rollback Document on projection failure | Violates Document authority (ADR-008) |
| Auto-rebase stale AI proposals | Violates explicit rebase (ADR-006/009) |
| Giant unified CollaborationError hierarchy | Hides failure class |

## Consequences

- Applications must re-evaluate reviews after HEAD advances.
- Apps must handle `desynchronized` without re-accepting the proposal.
- Real transports remain outside `lextrix-change`.
- Wire parse failures for envelopes/proposals are **wire parsing failures** (`WireError` / mapped `ProposalError`) — see [ADR-012](./ADR-012-serialization-and-wire-contracts.md) and [error-taxonomy.md](../error-taxonomy.md). They never partially mutate Document.

## Migration

None. `CausalDependencyError` and richer `CollabApplyRemoteResult` failure fields are additive.
