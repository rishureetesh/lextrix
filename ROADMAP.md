# Lextron roadmap

**Status: v1 independence complete.** Lextron-owned packages, APIs, and source.

**UI is frozen** — see [UI_STABILITY.md](./UI_STABILITY.md).

## Completed

### Phase 1 — Rebrand & modularize
- [x] `Lextron` API, `lxt-*` CSS prefix, workspace packages
- [x] Plug-and-play `register*()` per layer

### Phase 2 — Change layer
- [x] `ChangeSet` / `ChangeOp` / `ChangeAttributes` in `lextron-change`
- [x] Modular compose, transform, diff, invert implementation

### Phase 3 — Document model
- [x] `lextron-dom` — blot registry and attributors
- [x] Lextron-original dom internals (`DomError`, `model.ts`)

### Phase 4 — Editor modules
- [x] `lextron-core` — editor shell, selection, blots
- [x] `lextron-formats` — format definitions
- [x] `lextron-modules` — clipboard, keyboard, history, etc.

### Phase 5 — UI & themes
- [x] Snow/bubble stable
- [x] **Slate** (dark) and **Dawn** (warm light) themes added
- [x] Enhanced color palette and toolbar icon polish

### Phase 6 — Legal hygiene
- [x] MIT + NOTICE (runtime deps only)
- [x] Legacy import paths removed (`lxtPath` helpers)
- [x] Image resize module

## Future (optional)

- [ ] Lextron-original OT optimizations (collab performance)
- [ ] Additive themes beyond snow/bubble
- [ ] v2 API refinements if breaking changes are warranted
