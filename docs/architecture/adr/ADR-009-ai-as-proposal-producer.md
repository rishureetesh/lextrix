# ADR-009 AI as a Proposal Producer

- Status: Accepted
- Date: 2026-09-14
- Phase: 6A
- Related: [ADR-006](./ADR-006-change-proposals.md), [ADR-007](./ADR-007-collaboration-and-rebase.md), [ADR-008](./ADR-008-document-to-editor-projection.md), [ai-proposals.md](../ai-proposals.md)

## Context

Phases 1–5B deliver ChangeSet OT, Document, Versions, Anchors/Ranges, Proposals, rebase, in-memory collaboration, and Hybrid B+ projection. Applications (including future AI) must mutate documents without gaining a privileged path into DOM, Blot, Editor, or Version internals.

## Decision

**AI is modeled as an external proposal producer.**

```text
AI / Agent / Automation
        ↓
  ChangeProposal { baseVersionId, ChangeSet, meta }
        ↓
  inspect / validate
        ↓
  optional explicit rebase
        ↓
  acceptProposal | rejectProposal
        ↓
  Document.apply → Version
        ↓
  optional Hybrid B+ editor projection
```

### Rules

1. **No AI mutation API** — no `document.applyAI`, `editor.aiInsert`, etc.
2. **ChangeSet remains the only transition representation** — natural-language intent is converted outside the engine.
3. **Proposals are version-bound** — baseVersionId required; never silently apply to HEAD.
4. **Stale proposals stay stale** — explicit `rebaseProposal` then `acceptProposal`.
5. **Source metadata is provenance, not behavior** — `ChangeMeta.source` may be `'ai'`; semantics of transform/apply unchanged.
6. **Proposals are untrusted until validated** — same boundary for AI, user, remote, import.
7. **Provider-neutral** — no OpenAI/Anthropic/Gemini types in `lextrix-change`.
8. **AI never touches DOM/Blot/Editor/History** — only proposals → Document → optional projection.

### Lifecycle

```text
Create → Inspect/Validate → (Rebase) → Accept | Reject
```

Rebase yields a **new** proposal; the original is immutable.

### Serialization

`ChangeProposal.toJSON` / `parseChangeProposal` provide a JSON-safe wire shape for cross-process handoff. Transport remains out of scope.

## Alternatives considered (rejected)

| Alternative | Why rejected |
|-------------|--------------|
| AI mutates DOM / Blot directly | Breaks Document authority; undoes engine boundary |
| AI calls editor commands as the mutation system | Couples intelligence to UI |
| Dedicated AI mutation / operation types | Second mutation system; forks OT |
| AI bypasses ChangeSet | Breaks ADR-002 |
| AI owns versions | Breaks linear Version identity |
| Automatic semantic conflict resolution | Engine invents intent; deferred to applications |
| Automatic rebase of AI proposals | Hides staleness; violates ADR-006/007 |
| Provider-specific proposal types | Couples core to vendors |

## Consequences

**Positive:** one mutation system; auditability; collab-compatible; review-ready; server-friendly; removable AI without breaking the engine.

**Costs:** AI applications must emit valid ChangeSets; stale proposals need explicit handling; semantic intent stays outside the engine.

## Migration strategy

1. Use existing `ChangeProposal` + `ChangeMeta` (`source: 'ai'` already allowed).
2. Add `inspectProposal` (validate@base without HEAD) and `parseChangeProposal`.
3. Test with deterministic generators only — no model SDKs in core.
4. Defer LLM providers, AI UI, agents, cloud to later product phases.
