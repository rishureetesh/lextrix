# ADR-026 Authentication & Authorization Boundary

- Status: Accepted
- Date: 2026-09-14
- Phase: 11
- Related: [ADR-015](./ADR-015-security-and-trust-boundary.md)

## Decision

AuthN/AuthZ are **application-owned**. Lextrix host exposes hooks:

- authenticate connection → principal
- authorize `subscribe` | `submit` | `sync`

Server stamps trusted `actorId` into ChangeMeta. Client-proposed actor identity is never authentication. OT remains provenance-blind. No JWT/OAuth/IdP inside `lextrix-change`.

## Non-goals

Identity provider product; tenancy product UI.
