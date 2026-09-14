# ADR-008 Document → Editor Projection

- Status: Accepted
- Date: 2026-09-14
- Phase: 5A design / 5B implementation
- Related: [ADR-007](./ADR-007-collaboration-and-rebase.md), [editor-document-bridge.md](../editor-document-bridge.md)

## Context

Strategy B (Phase 2): local edits are editor/blot authoritative; Document mirrors settled ChangeSets. Collaboration and proposal acceptance require applying ChangeSets that did **not** originate in the local blot tree:

```text
Remote / rebased Proposal
        ↓
Document.apply → Version N+1
        ↓
??? Editor / Blot / Selection
```

Phase 4 explicitly did not project Document→Editor. Without a defined path, remote collaboration cannot update the visible editor safely.

## Decision

### Recommended model: Hybrid Strategy B+ (Option 1)

| Path | Authority | Flow |
|------|-----------|------|
| **Local user typing / local API** | Editor first | Editor → settled ChangeSet → Document (`origin: editor`) |
| **Remote / accepted external ChangeSet** | Document first for that change | Document.apply → project via existing `updateContents` / ChangeApplier (`origin: projection`) |

Centralized dual-write of every keystroke through Document-first (Option 2 / full Strategy A) is **deferred** — too high risk for IME, MutationObserver, and selection.

### Projection mechanism (Phase 5B — implemented)

1. `Lextrix.applyExternalChange(change)` → `DocumentHandle.apply` (version advances).
2. Editor `updateContents(change, SILENT)` inside `runAsProjection` / `projectionDepth` (nesting-safe; restored in `finally`).
3. Bridge **skips** Editor→Document reconcile when `projectionDepth > 0`.
4. History: `ignoreChange` during projection + `History.transform` — not a user undo entry.

### Selection

- Mapped through the remote ChangeSet via existing `modify` / `shiftRange` (`transformPosition` semantics).
- Do not preserve browser DOM Range identity.

### Feedback loops

```text
Remote → Document.apply → Editor(projection) → [bridge skip]
```

### Failure invariant (Phase 5B)

Once `Document.apply` succeeds, the Document version is **authoritative** for that externally originated change. Projection failure does **not** roll back immutable document history.

Recovery: incremental projection → full `setContents(getContents())` inside projection guard → verify. If still divergent: explicit `desync` status (do not pretend success).

**Success invariant:** after successful projection, `Editor.contents === Document.head.contents` (canonical ChangeSet ops).

## Alternatives considered

1. **Full Document-first now** — Correct long-term; destabilizes local typing path.
2. **No editor update for remote** — Blocks collaboration UX.
3. **DOM patching without ChangeApplier** — Diverges from blot invariants; rejected.

## Consequences

- Strategy B remains for local edits.
- `applyExternalChange` is the Hybrid B+ entry point.
- Blot/MO/ChangeApplier unchanged except call sites + origin plumbing.

## Migration strategy

1. Accepted with ADR-007.
2. Implemented projection helper on Lextrix/bridge (Phase 5B).
3. Integration tests: contents equality; no double-apply; undo stack sane.
4. Only later consider flipping local typing to Document-first.
