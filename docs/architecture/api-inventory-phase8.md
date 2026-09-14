# Phase 8 API Inventory

| Symbol | Package path | Stability | Reason |
|--------|--------------|-----------|--------|
| ChangeSet | `lextrix-change` | STABLE | OT foundation |
| Wire serializers | `lextrix-change/wire` | STABLE | ADR-012 |
| Document | `lextrix-change/document` | STABLE | Immutable value |
| DocumentHandle | `lextrix-change/document` | STABLE | Session owner |
| DocumentTransaction | `lextrix-change/document` | STABLE | Minimal tx |
| DocumentVersion | `lextrix-change/document` | STABLE | Immutable identity |
| Anchor / Range | `lextrix-change/document` | STABLE | Document-space |
| ChangeProposal + ops | `lextrix-change/document` | STABLE | Engine proposals |
| DocumentError | `lextrix-change/document` | STABLE | Runtime errors |
| subscribe / events | `lextrix-change/document` | STABLE | ADR-017 |
| ChangeMeta helpers | `lextrix-change/document` + wire | STABLE | Needed by runtime/wire |
| LinearVersionStore | experimental | EXPERIMENTAL | Implementation detail |
| DocumentReference | experimental | EXPERIMENTAL | Thin pointer |
| InMemoryCollab* | experimental | EXPERIMENTAL | Reference harness |
| replaceFromContents | experimental (+ on Handle) | EXPERIMENTAL-leaning | Recovery; available via Handle but not emphasized as primary API |
| Review / Policy / Providers | intelligence | INTELLIGENCE | App layer |
| OpenAI adapter | intelligence/openai | APPLICATION | Ecosystem |
| Projection / bridge | core | EDITOR-INTEGRATION | DOM |
| History module | modules | EDITOR-INTEGRATION | ≠ Versions |
| Native DocumentOperation | internal | INTERNAL | Dual-op private |
| Testing generators | change/testing | INTERNAL | Dev |

## Compatibility promise

Stable imports (`lextrix-change`, `/wire`, `/document`) may be depended upon without expecting arbitrary redesign of ownership, observation, or mutation semantics within a major version.

Experimental imports have **no** semver stability promise.
