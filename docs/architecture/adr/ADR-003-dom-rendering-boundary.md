# ADR-003 DOM as Rendering Boundary

- Status: Accepted
- Date: 2026-09-14
- Phase: 1

## Context

Production Lextrix 2.1.x uses blots (`lextrix-dom` + core Scroll) as the live editable structure. MutationObserver reconciles typing into ChangeSets. This works for the browser editor but cannot be the canonical DocumentState for headless/AI/server use.

## Decision

### Why DOM is not canonical state

- DOM is environment-specific (`window` / `document` / layout).
- Blot trees embed `domNode` references (`DocumentNode.domNode`).
- Multiple surfaces (Node, worker, CMS, AI) must share one state model without a browser.

Canonical state is **DocumentState** (ADR-001). DOM is a **projection / input surface**.

### How editor projection works (target, not Phase 1 inversion)

```text
DocumentState  --project-->  Blot tree + DOM  --user input-->  ChangeSet  --apply-->  DocumentState'
```

Phase 1 does **not** invert production ownership. The editor remains blot-authoritative for 2.1.x.

Phase 1 only **proves** DocumentState independently.

### How current blot architecture is preserved

- No rewrite of `ChangeApplier`, `MutationCoordinator`, selection, toolbar, themes, or React.
- No change to published editor constructor behavior.
- Experimental Document lives in `lextrix-change` experimental exports — zero import of `lextrix-dom` / `lextrix-core` editor.

### Migration without rewriting the editor

1. **Phase 1:** Headless Document + tests (this phase).  
2. **Phase 2+:** Optional dual-write or “editor loads from DocumentState”; blot path remains until projector is proven.  
3. Only after confidence: flip authority so blots project DocumentState (still keeping blot code).

## Alternatives considered

1. **Immediate blot rewrite** — Rejected (product risk R2).  
2. **jsdom as “headless document”** — Rejected; fake DOM is not a document engine.  
3. **Ship Document as stable API in 2.1** — Rejected; experimental until Phase 2 gate.

## Consequences

- Two truths exist temporarily: editor blot truth (production) and DocumentState (experimental). This is intentional.
- Integrators must not rely on experimental Document for production yet.
- HTML serialization remains editor-bound; JSON/MD/MDX can serve DocumentState headlessly.

## Migration strategy

Document in TRANSFORMATION-PROGRESS.md; do not flip editor authority until Phase 2 exit criteria.
