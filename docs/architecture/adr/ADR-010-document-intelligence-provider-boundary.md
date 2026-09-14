# ADR-010 Document Intelligence Provider Boundary

- Status: Accepted
- Date: 2026-09-14
- Phase: 6B
- Related: [ADR-009](./ADR-009-ai-as-proposal-producer.md), [document-intelligence.md](../document-intelligence.md)

## Context

Phase 6A established AI as a **proposal producer** (`ChangeProposal` + `source: 'ai'`). Applications still need a provider-neutral way to turn instructions + version-bound context into proposals without coupling `lextrix-change` to LLMs, HTTP, or prompts.

## Decision

Document intelligence is an **application-layer** capability living in package `lextrix-intelligence`.

```text
Application
    ↓
DocumentIntelligenceRequest
    ↓
DocumentIntelligenceProvider.generate()
    ↓
ChangeProposal
    ↓
lextrix-change (inspect / rebase / accept)
```

### Rules

1. **Providers never mutate** Document, Editor, DOM, Blot, History, or VersionStore.
2. **Only output** is a version-bound `ChangeProposal`.
3. **Engine has zero provider dependency** — `lextrix-change` does not import `lextrix-intelligence`.
4. **Ranges reuse** `DocumentRange` / index pairs — no `AIRange`.
5. **Context extraction** uses ChangeSet plain-text slices — not DOM.
6. **Providers are interchangeable** — deterministic, injectable structured completion, future LLM wrappers.
7. **Real LLM SDKs** (if any) inject via application `complete` callbacks — not package dependencies of the engine or intelligence contract.

### Package boundary

```text
lextrix-change          ← document engine (unchanged)
lextrix-intelligence    ← depends on change only
application / SDKs      ← optional; inject into StructuredCompletionProvider
```

## Alternatives considered (rejected)

| Alternative | Why rejected |
|-------------|--------------|
| AI inside `lextrix-change` | Couples engine to intelligence; violates removable-AI goal |
| Provider mutates Document / Editor | Second mutation system; breaks ADR-009 |
| Provider-specific ChangeSet / Document types | Forks OT and state model |
| AI-owned versions / conflict resolution | Engine invents intent; deferred |
| Giant AI framework interface (chat/embed/agent) | Lextrix is not an LLM orchestration product |

## Consequences

**Positive:** clear boundary; testable with deterministic providers; LLM-ready via injection; engine stays portable.

**Costs:** applications must convert provider output to valid ChangeSets; intent understanding stays outside the engine.

## Migration strategy

1. Ship `lextrix-intelligence` experimental contracts + deterministic provider.
2. Use `StructuredCompletionProvider` as the sole “real provider” seam (no vendor SDK in-repo).
3. Keep ADR-009 proposal rules; do not auto-rebase or auto-accept.
