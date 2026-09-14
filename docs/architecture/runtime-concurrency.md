# Runtime Concurrency Contract (Phase 8–9)

| Behavior | Status |
|----------|--------|
| Single-threaded JS apply | **guaranteed** |
| Open transaction blocks Handle.apply / replaceFromContents | **guaranteed** |
| Nested Handle transactions | **forbidden** (`DocumentError: nested_transaction`) |
| Empty apply / empty commit | **guaranteed** — no Version, no observer event |
| Stale proposal accept | **forbidden** (`ProposalError: stale`) |
| Duplicate collaboration delivery (adapter) | **supported** (idempotent) |
| Missing causal dependency (adapter) | **forbidden** (`CausalDependencyError`) |
| Same `documentId` on independent Handles | **undefined** — not a shared document |
| Direct `Document.apply` bypassing Handle | **unsupported** as session mutation (no versions/observers) |
| Multi-threaded shared memory | **undefined** |
| Observer reentrancy (mutate Handle from listener) | **forbidden** (`DocumentError: reentrancy`) |
| Observer failure after commit | **guaranteed** — Document/Version retained; first error rethrown as `observer_failed` |
| Persistence failure after commit | **guaranteed** — no Document rollback; dirty/lag via attachment |
| Compose-integrity on hydrate | **guaranteed** default-on; unsafe escape hatch explicit |
| Confirmed Version vs HEAD | **distinct** — confirmed only via ACK `history` |

See ADR-016, ADR-017, ADR-018, ADR-019.
