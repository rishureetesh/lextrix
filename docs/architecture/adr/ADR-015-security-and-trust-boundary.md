# ADR-015 — Security & Trust Boundary

- Status: Accepted
- Date: 2026-09-14
- Related: [ADR-009](./ADR-009-ai-as-proposal-producer.md), [ADR-010](./ADR-010-document-intelligence-provider-boundary.md), [ADR-011](./ADR-011-proposal-provenance-and-acceptance-policy.md), [ADR-013](./ADR-013-proposal-review-workflow.md), [ADR-014](./ADR-014-collaboration-failure-and-recovery.md)

## Context

Phases 6A–6M established proposals, intelligence providers, review, policy, and failure semantics. Security assumptions existed in prose but were not a single enforceable trust-boundary contract:

- Wire JSON and remote envelopes were partially validated
- Metadata could carry arbitrary keys into Versions
- Remote `meta.source` could overwrite `remote` after ingest
- Forged `source: 'user'` could skip `acknowledgeReview` after parse

Authentication, encryption, and tenancy remain application/deployment concerns. This ADR defines **engine trust boundaries**, not an identity platform.

## Decision

### 1. Trust model

| Class | Examples | Engine stance |
|-------|----------|---------------|
| **Trusted** | Validated ChangeSet algebra, DocumentHandle after explicit accept | Structural authority |
| **Conditionally trusted** | Application review/policy decisions | Outside engine; must not break invariants |
| **Untrusted** | LLM output, serialized proposals/requests, collab envelopes, provenance fields, explanations, confidence, IDs from transport | Parse → validate → review → explicit accept |

### 2. Core invariant

Untrusted data may describe a proposed ChangeSet. It must never gain a privileged path to Document or Editor mutation.

### 3. Wire parsing (`parseChangeProposal` / `lextrix-change/wire`)

- No `eval` / dynamic code execution
- Explicit field extraction; op shape validation; soft size limits (`WIRE_LIMITS`)
- Meta via `sanitizeUntrustedChangeMeta` (allowlist, enum source/origin, drop invalid confidence)
- Mark `untrustedInput: true`
- Never mutates Document
- Normative schemas and unknown-field policy: [ADR-012](./ADR-012-serialization-and-wire-contracts.md)

### 4. Metadata is inert

`explanation`, `provider`, `model`, `confidence`, `requestId`, `generatedAt` are data only. They must not execute, select code, alter OT, or grant acceptance.

### 5. Policy / review

- `untrustedInput` or `source: 'ai'` → `requiresReview`; `autoAcceptAllowed` always false under default policy
- Explicit `acknowledgeReview: true` required for acceptance
- Provider/model/confidence cannot bypass review

### 6. Collaboration

Remote envelope meta is sanitized; `source`/`origin` forced to `remote`/`system`. Duplicate `changeId` remains idempotent. Missing `dependsOn` still fails closed.

### 7. Secrets

API keys must not enter ChangeProposal, ChangeMeta, Document, Version, review objects, or normal error messages. Provider credentials stay in provider config / environment.

### 8. Provenance is not authenticated

Wire claims (`provider: "OpenAI"`, `confidence: 1`) are descriptive. Cryptographic signing is out of scope.

### 9. Resource limits

Engine soft limits (ops count, insert length, meta string length, instruction length) reject pathological wire input. Stricter transport/body limits remain application-owned.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Signed proposals / crypto provenance | Out of scope; deployment concern |
| AuthN/AuthZ in engine | Wrong layer |
| Confidence-based auto-accept | Violates explicit acceptance |
| Silent range clamping | Prefer hard reject |
| HTML sanitization inside ChangeSet | Belongs to render/serialize layer |

## Consequences

- Apps must re-acknowledge wire-parsed proposals even if they claim `source: 'user'`
- Version JSON may still contain user text; apps redact for logs as needed
- ADR-012 (Serialization & Wire Contracts) is **Accepted** — use `lextrix-change/wire` for normative formats

## Migration

Additive. Existing in-process `createChangeProposal` unchanged except confidence sanitization. Parsed proposals gain `untrustedInput: true`.
