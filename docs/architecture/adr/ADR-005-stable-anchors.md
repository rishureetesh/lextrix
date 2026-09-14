# ADR-005 Stable Anchors (Experimental)

- Status: Accepted
- Date: 2026-09-14
- Phase: 3

## Context

Selections and comments need positions that survive document edits. DOM Ranges and blot offsets are environment-bound. Phase 3 requires headless anchors mapped only through ChangeSets.

## Decision

### What an Anchor is

```text
DocumentAnchor = {
  documentId,
  versionId,      // version the index is valid for
  index,          // document offset [0, length]
  affinity        // 'before' | 'after'
}
```

- **Not** a DOM Range, Blot, or editor Selection.
- Belongs to an explicit Version; mapping produces an anchor for a **later** Version.

### Mapping

```text
Anchor@V + ChangeSet(V→V') → Anchor@V'
```

Implementation: `ChangeSet.transformPosition(index, priority)` where:

| affinity | priority | Insert at exact index |
|----------|----------|------------------------|
| `before` | `true`  | Anchor stays **before** inserted content |
| `after`  | `false` | Anchor moves **after** inserted content |

Default affinity: **`after`** (matches Quill/`ChangeSet.transformPosition` default).

### Deletion

Uses existing OT position transform: deletions before the index shrink it; a position inside a deleted range collapses to the deletion start (Quill semantics).

### Formatting / retain-only

Position unchanged (zero changeLength ops do not move the index).

### Identity

`mapThrough(empty ChangeSet)` keeps the same logical index (version id updated only when caller supplies the target version).

### Out of scope

Comments, suggestions, collab cursors, ranges/spans, multi-anchor trees.

## Alternatives considered

1. **DOM-based mapping** — Rejected (not headless).
2. **String search** — Rejected (ambiguous / wrong for OT).
3. **Defer affinity** — Rejected; insert-at-point is otherwise undefined.

## Consequences

- Anchors are experimental under `lextrix-change/experimental`.
- Mapping across non-adjacent versions should use `diff(versionA, versionB)` (or composed changes), not ad-hoc DOM.

## Migration strategy

Ship `createAnchor` + `mapThrough` with property tests; editor selection remains separate.
