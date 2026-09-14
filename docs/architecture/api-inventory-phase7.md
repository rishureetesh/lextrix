# Phase 7 API Inventory

Classification legend:

- **STABLE** — published compatibility under package exports
- **EXPERIMENTAL** — usable, no semver promise
- **INTELLIGENCE-ONLY** — `lextrix-intelligence`
- **EDITOR-INTEGRATION** — core/editor bridge
- **APPLICATION-LEVEL** — app orchestration
- **DEFERRED** — not ready / out of Phase 7

| API | Package | Current | Consumers | Serialization | Stability required? | Class | Reason |
|-----|---------|---------|-----------|---------------|---------------------|-------|--------|
| ChangeSet | change | STABLE | everywhere | `lextrix-change/wire` | Yes | STABLE | Foundational OT |
| Wire serializers/parsers | change/wire | STABLE (new) | persistence/transport consumers | Self | Yes | STABLE | Phase 7 goal |
| WireError / WIRE_LIMITS | change/wire | STABLE | wire callers | N/A | Yes | STABLE | Contract errors |
| Document | change/experimental | experimental | core bridge, intel | Document.toJSON (content) | Eventually | EXPERIMENTAL | Lifecycle/docs incomplete for public promise |
| DocumentHandle | change/experimental | experimental | core, intel | via Version/Proposal | Eventually | EXPERIMENTAL | No dispose; session API still evolving |
| Transaction | change/experimental | experimental | handle | N/A | Later | EXPERIMENTAL | Correct but young surface |
| DocumentVersion | change/experimental | experimental | handle, wire | ADR-012 version | Eventually | EXPERIMENTAL | Wire stable; runtime class stays experimental |
| LinearVersionStore | change/experimental | experimental | handle | N/A | No | EXPERIMENTAL | Internal-ish store |
| Anchor / Range / Reference | change/experimental | experimental | handle, intel ranges | toJSON helpers | Later | EXPERIMENTAL | No Anchor↔DOM; wire not primary |
| ChangeProposal | change/experimental | experimental | intel, handle | ADR-012 proposal | Eventually | EXPERIMENTAL | Wire stable; class experimental |
| parseChangeProposal | change/experimental | experimental | intel, tests | wraps wire | Bridge | EXPERIMENTAL | Maps to ProposalError |
| rebaseProposal | change/experimental | experimental | handle | N/A | Later | EXPERIMENTAL | Semantics solid; API freeze later |
| ChangeMeta / sanitize | change + wire re-export | experimental + wire | all | allowlist | Yes for wire | STABLE via wire re-export | Normative for untrusted |
| Review / AcceptancePolicy | intelligence | app | apps | N/A | No in change | INTELLIGENCE-ONLY / APPLICATION-LEVEL | Correct layer |
| DocumentIntelligenceProvider | intelligence | app | apps | request serialize | No in change | INTELLIGENCE-ONLY | Provider-neutral |
| OpenAI adapter | intelligence/openai | optional | apps | N/A | No | APPLICATION-LEVEL | Ecosystem |
| InMemoryCollaborationAdapter | change/experimental | experimental | tests | envelope via wire | No as “the” API | EXPERIMENTAL | Reference impl, not transport |
| CollabEnvelope type | change/experimental | experimental | adapter, wire | ADR-012 | Semantics yes | EXPERIMENTAL type + STABLE wire | Freeze wire first |
| Projection / bridge | core | editor | editor | N/A | Editor contract | EDITOR-INTEGRATION | Not change package |
| History | modules | editor | editor | N/A | Editor | EDITOR-INTEGRATION | ≠ Versions |
| Native DocumentOperation | change internal | internal | bridge | No | No | DEFERRED / do not export | Dual-op kept private |

## Minimal stable export map (Phase 7)

```text
lextrix-change
  └── ChangeSet (+ ChangeOp helpers)

lextrix-change/wire
  └── schemaVersion, serialize/parse for
      changeset | version | proposal | collab-envelope
  └── WireError, limits, meta sanitizers (re-export)
```

Everything else remains `lextrix-change/experimental` or intelligence/editor packages.
