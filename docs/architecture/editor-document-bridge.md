# Editor ↔ Document Bridge (Phase 2)

- Status: Accepted
- Date: 2026-09-14
- Related: [document-transactions.md](./document-transactions.md), ADR-001–003

## Evidence summary

| Concern | Finding |
|---------|---------|
| Canonical truth today | Blot/DOM via `syncChangeSet`; `Editor.changeSet` is a cache |
| Typing path | MutationObserver → `SCROLL_UPDATE` → `modify` → settled ChangeSet |
| API path | `insertText` / `updateContents` / … → `modify` → settled ChangeSet |
| History | Listens to `EDITOR_CHANGE` / `TEXT_CHANGE`; undo via `updateContents` |
| Selection | `DocumentIndexMapper` is Scroll/DOM-specific — not a headless anchor |
| Experimental Document | Unused by editor before Phase 2 |

## Strategies evaluated

### Strategy A — Document-first

```text
Intent → Transaction → Document.apply → blot projection
```

**Pros:** Matches long-term architecture.  
**Cons for Phase 2:** Typing still enters via DOM; projecting Document→blots for every keystroke risks selection/MO loops and requires a real projector. High destabilization risk.

### Strategy B — Editor-first + Document reconciliation (**chosen**)

```text
Intent → existing ChangeApplier / Scroll path → settled ChangeSet
      → Document.apply(change)   // mirror only
```

**Pros:** Minimal risk to formatting, embeds, clipboard, history, selection; single chokepoint (`modify`); clear sync direction; path toward Document-first later.  
**Cons:** Temporary dual representation; Document lags only if reconcile fails (then resync from editor).

## Decision

Adopt **Strategy B** for Phase 2.

### Synchronization boundary

| Stage | Authoritative | Direction |
|-------|---------------|-----------|
| Phase 2 production editing | Blot / DOM / `Editor.changeSet` | Editor → Document (one-way) |
| Headless / Node | DocumentState | N/A |
| Future Phase (post-confidence) | DocumentState | Document → Editor projection |

### Feedback-loop prevention

- Bridge **never** calls `updateContents` / Scroll mutators when reconciling.
- `ChangeMeta.origin = 'editor'` marks mirrored changes.
- Future projection must use `origin: 'projection'` and **skip** editor→Document re-apply for that change (explicit origin, not timing hacks).
- Do not hook Document writes solely via `TEXT_CHANGE` listeners (History/`SILENT` semantics).

### Hook point

End of `modify()` in `lextrix-core` after the settled ChangeSet is known, using that ChangeSet (not the pre-sync proposal).

### Critical invariant

After any non-empty editor content mutation:

```text
editor.getContents()  ==  experimentalDocument.getContents()
```

(document equality of insert-only ops; attribute key order may be normalized in tests.)

## Migration path to Document-first

1. Keep Strategy B until divergence tests stay green under load.
2. Add API-only Document-first commits (`experimentalCommit`) that still apply through the editor once.
3. Phase 3+: projector + flip authority via ADR — still no blot rewrite required to delete the dual-write.
