# ADR-017 Document Observation Contract

- Status: Accepted
- Date: 2026-09-14
- Phase: 8
- Related: [ADR-016](./ADR-016-document-runtime-ownership.md)

## Context

DocumentHandle had no observer API. Persistence adapters, UI, and collaboration layers need deterministic notification of committed transitions without becoming part of the mutation transaction.

## Decision

### API

```ts
const unsubscribe = handle.subscribe(listener);
unsubscribe(); // idempotent
```

### Event (immutable plain object)

```ts
{
  type: 'applied' | 'restored',
  change: ChangeSet,       // frozen transition (changeFromParent)
  document: Document,      // new HEAD value
  version: DocumentVersion,
  meta: ChangeMeta | null
}
```

- `type: 'restored'` when the transition originates from `restoreVersion`.
- Otherwise `type: 'applied'` (including proposal accept and `replaceFromContents`).

### Semantics

| Property | Rule |
|----------|------|
| Synchronous | Notified before `apply`/`restore` returns |
| Ordered | Observation order = successful apply order |
| Not cancelable | Listeners cannot undo commit |
| No replay (v1) | Future events only |
| Empty transition | **No** event (empty ChangeSet / empty commit) |
| Reentrancy | Handle mutation from inside a listener → `DocumentError` code `reentrancy` |
| Duplicate subscribe | Same function twice → **two** deliveries (documented) |
| Unsubscribe | Idempotent; no further events |

### Failure model (Option A, fair notify)

1. Document + Version are already committed.
2. Snapshot the listener list.
3. Invoke **all** listeners in subscription order.
4. If any throw, after all invocations **rethrow the first** exception.
5. Document/Version are **not** rolled back.
6. Subscriptions remain unless unsubscribed.

Observers are **not** part of the authoritative mutation transaction.

### Order relative to mutation

```text
Document.apply succeeds
→ Version recorded
→ HEAD advanced
→ notify observers
→ apply returns (or throws first observer error)
```

## Alternatives considered

1. **Async / Promise / RxJS** — Rejected; keeps engine simple and ordered.
2. **Rollback on observer failure** — Rejected; external code must not own authority.
3. **Stop at first throwing listener** — Rejected; less deterministic for remaining listeners.
4. **Replay on subscribe** — Deferred; apps read `currentVersion()`.

## Consequences

- Persistence adapters can `subscribe` and serialize committed Versions.
- Editor bridge may observe or continue using explicit projection APIs.
- Reentrancy forbidden prevents nested corruption.

## Migration strategy

Additive API on DocumentHandle; no wire changes.
