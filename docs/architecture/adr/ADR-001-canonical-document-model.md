# ADR-001 Canonical Document Model

- Status: Accepted
- Date: 2026-09-14
- Phase: 1

## Context

Lextrix today treats the blot/DOM tree as the live document for editing, while `ChangeSet` acts as a cache and wire format (`Editor.changeSet`). The long-term vision requires a **DOM-free** document that can run in Node, workers, tests, and AI pipelines.

The discovery report warned against conflating **state** with **change**:

```text
DocumentState  --apply(ChangeSet)-->  DocumentState'
```

## Decision

### What is DocumentState?

`DocumentState` is the **current contents of a document**: a value that answers “what is the document right now?”

In Phase 1 it is represented as:

- a **document ChangeSet** — ops that describe content (insert-only, Quill-compatible), plus
- an optional **schema** reference for validation rules.

It is **not** an editor, blot tree, DOM node, or ChangeSet that mixes deletes/retains as the stored state.

### Mutable or immutable?

**Immutable at the Document API boundary.**

- `apply(change)` returns a **new** `Document` (or equivalent) instance.
- Internal `ChangeSet` builders may still mutate during construction; once attached to a Document, contents should be treated as frozen (callers should `clone()` / `freeze()` before sharing).

### Canonical representation (Phase 1)

```text
DocumentState.contents : ChangeSet   // insert-only document ops
DocumentState.schema   : DocumentSchema (minimal)
```

JSON serialization of state is the ChangeSet ops array (same public wire format).

### Role of schema

Minimal in Phase 1:

- Names the document kind (`default`, future custom schemas).
- Optionally validates that contents are a well-formed **document** ChangeSet (insert-only; optional trailing newline rule).
- Does **not** yet own a full format/attribute type system (formats remain in the editor registry for 2.1.x).

### Role of DOM

DOM is **not** part of DocumentState. See ADR-003.

### Role of ChangeSet

ChangeSet is the **transition language**:

```text
state' = state.apply(change)  ≡  contents.compose(change)  (Quill semantics)
```

Human, API, remote, and AI edits must eventually be expressible as ChangeSets applied to DocumentState.

## Alternatives considered

1. **Keep blot tree as canonical** — Rejected for headless/AI/server goals.
2. **Make ChangeSet itself “the document”** — Rejected: confuses transitions with state; documents and changes have different invariants (documents are insert-only; changes may delete/retain).
3. **New tree model (ProseMirror-like nodes) in Phase 1** — Deferred: high rewrite risk; ChangeSet document form already exists and is serialize-compatible.

## Consequences

- Phase 1 ships an **experimental** headless Document API (not a stable public product API).
- Production editor (2.1.x) remains blot-authoritative until a later phase dual-writes or projects.
- Serialization (JSON/MD/MDX) already speaks ChangeSet and can target DocumentState without DOM.

## Migration strategy

1. Introduce experimental Document beside `lextrix-change` (no package rename).
2. Prove apply/getContents without DOM.
3. Later phases: editor projects DocumentState → blots (ADR-003), without deleting blot code first.
