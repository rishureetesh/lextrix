# ADR-032 Presence Protocol

- Status: Accepted
- Date: 2026-09-14
- Phase: 12
- Related: [ADR-027](./ADR-027-presence.md), [ADR-024](./ADR-024-production-transport.md), [ADR-026](./ADR-026-auth-boundary.md)

## Context

ADR-027 established presence as ephemeral and non-authoritative but deferred protocol.

## Decision

1. Presence travels on the **same WebSocket** as document control frames, with a distinct frame `type: 'presence'`.
2. Never part of `collab-envelope`, Version, ChangeSet, OT, or PostgreSQL Version tables.
3. State is **in-memory** on the document owner (or ephemeral store); best-effort; cleared on disconnect, owner transfer, restart.
4. `actorId` stamped from AuthN principal; AuthZ for publish/subscribe.
5. Ordering: latest-wins per actor via client `generation` + server time — **not** Version sequence.
6. Isolated queues, rate limits, max participants/payload; overload drops **presence only**.

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Separate always-on presence cluster in Phase 12 | Unnecessary for minimal protocol |
| Persist presence in Versions | Violates document authority |
| Trust client actor names | Spoofing |

## Consequences

- `lextrix-collab` / `lextrix-server` gain presence frame types and ephemeral store.
- Applications may layer richer awareness UX without core changes.

## Failure behavior

Loss of presence never blocks or rolls back document accepts.

## Migration

Feature-flagged; older clients ignore unknown frame types.
