# Error Taxonomy (Phase 7–9)

Compatibility status refers to **stable wire / documented experimental codes**, not a promise that every `Error.message` string is frozen.

## Categories

| Category | Examples | Mutates Document? |
|----------|----------|-------------------|
| Wire parsing failure | `WireError` | No |
| Proposal / application failure | `ProposalError` | No (accept rejects atomically) |
| Rebase failure | `RebaseError` | No |
| Collaboration causal failure | `CausalDependencyError` | No (publish rolled back) |
| Hydration / lineage | `DocumentError` (`lineage_error`, `hydration_error`) | No |
| Persistence | `PersistenceError` | No (Handle commit already done) |
| Transport | `TransportError` | No |
| Projection / desync | core projection status | Document unchanged; editor may desync |
| Provider failure | `IntelligenceProviderError`, … | No |

## Stable wire codes (`WireError.code`) — schemaVersion 1

| Code | Meaning |
|------|---------|
| `invalid_json` | JSON.parse failed |
| `invalid_type` | Wrong JSON type |
| `missing_field` | Required field absent |
| `unknown_schema_version` | Unsupported schemaVersion |
| `unsupported_kind` | Wrong `kind` for parser |
| `malformed_op` | Invalid ChangeOp |
| `limit_exceeded` | Size/complexity cap |
| `forbidden_key` | Prototype-pollution-style key |
| `invalid_id` | Empty/oversized id |
| `invalid_meta` | Reserved |

## Stable runtime codes (`DocumentError.code`) — Phase 8–9

| Code | Meaning |
|------|---------|
| `transaction_open` | Mutation while transaction open |
| `nested_transaction` | Nested Handle transaction |
| `wrong_document` | Cross-document Version/anchor |
| `unknown_version` | Missing Version id/sequence |
| `invalid_state` | Corrupt/invalid hydrate or invariant |
| `reentrancy` | Mutation from inside observer |
| `observer_failed` | Listener threw after commit (cause preserved) |
| `invalid_argument` | Bad subscribe argument |
| `lineage_error` | Invalid Version chain links / ids / sequences |
| `hydration_error` | Compose-integrity failure or invalid HEAD contents |

## Persistence codes (`PersistenceError.code`) — Phase 9–10

| Code | Meaning |
|------|---------|
| `persistence_error` | Generic storage failure / flush incomplete |
| `persistence_conflict` | Same `version.id`, different payload |
| `cas_conflict` | compareAndAppend expected HEAD mismatch |
| `stale_owner` | owner_epoch fencing rejection |
| `idempotency_conflict` | Same Version id, different payload |
| `not_found` | Unknown head / document for load |
| `invalid_argument` | Illegal append (wrong parent/sequence) |

## Collaboration reject codes (Phase 10 / `lextrix-collab`)

| Code | Meaning |
|------|---------|
| `sync_required` | Unknown/too-old base; client must sync |
| `unknown_base` | baseVersionId not in history |
| `causal_dependency` | Missing dependsOn |
| `authorization_failed` | App AuthZ hook denied |
| `cas_conflict` | Durable HEAD moved |
| `stale_owner` | owner_epoch fence |
| `rebase_limit` | Exceeded maxRebaseDepth |
| `invalid_envelope` | Wire parse failure |
| `queue_full` | Backpressure |
| `duplicate_change` | Reserved (idempotent replay preferred) |
| `document_tombstoned` | Lifecycle rejects mutation |
| `version_unavailable` | Compacted/purged Version not resolvable |
| `presence_rejected` | Presence throttle/AuthZ/capacity |

### Presence

Presence frames (`type: 'presence'`) are transport-level only. They never enter Version history.

### Snapshots

Corrupt snapshots fail closed (`persistence_conflict`). Sync uses additive `baseSnapshot` on `sync` responses — not an ADR-012 kind.

Persistence failure after Document commit does **not** become `observer_failed` when using `attachPersistence` (errors are recorded as durability lag).

## Transport codes (`TransportError.code`) — Phase 9

| Code | Meaning |
|------|---------|
| `transport_error` | Generic transport failure |
| `not_connected` | Send/deliver while disconnected |
| `invalid_message` | Reserved for malformed delivery |

## Experimental engine codes

| Error | Codes |
|-------|-------|
| `ProposalError` | `stale`, `wrong_document`, `unknown_version`, `invalid_change`, `transaction_open`, `invalid_serialized` |
| `RebaseError` | `wrong_document`, `unknown_version`, `unrelated_versions`, `corrupt_chain`, `missing_change` |
| `CausalDependencyError` | `causal_dependency` (+ `missingDependsOn`) |

## Intelligence (application-level)

`ProposalReviewError`, `IntelligenceRequestError`, `IntelligenceProviderError`, `IntelligenceParseError` — not part of `lextrix-change` stable surface.
