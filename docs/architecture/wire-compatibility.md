# Wire Compatibility & Migration (ADR-012)

## Pre-Phase-7 experimental JSON

Experimental `ChangeProposal.toJSON` / `DocumentVersion.toJSON` before Phase 7 **had no published compatibility promise**.

Phase 7 parsers may accept common legacy shapes as **migration aids**:

| Legacy shape | Treatment |
|--------------|-----------|
| Bare ChangeSet ops array | schemaVersion 1 changeset |
| Proposal with top-level `ops`, no `schemaVersion` | schemaVersion 1 proposal |
| Version with top-level `ops`, no `changeFromParent` | schemaVersion 1 version with incomplete lineage |

New emitters **must** write `schemaVersion: 1` and `kind`.

## Backward compatibility

Implementations that support schemaVersion 1 **must** read schemaVersion 1 documents.

## Forward compatibility

Unsupported `schemaVersion` → **reject** (`WireError: unknown_schema_version`). No silent partial apply.

## Unknown fields

- Top-level unknown fields on a known kind → **ignore**
- Untrusted meta → **allowlist strip**
- Forbidden keys (`__proto__`, …) → **reject**

## Breaking changes

A breaking wire change requires a new `schemaVersion` and an explicit migration document. Do not silently reinterpret ops.

## Migration locus

Migration happens at the **wire parse boundary**, not inside OT/apply.

## Phase 9

ADR-012 wire formats are **unchanged**. Persistence stores Version wire records; transport carries collab-envelope wire. Hydration validates lineage/compose after parse — it does not invent a second schema policy.
