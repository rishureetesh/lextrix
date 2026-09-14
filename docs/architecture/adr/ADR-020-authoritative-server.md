# ADR-020 Authoritative Server & Version Sequencing

- Status: Accepted
- Date: 2026-09-14
- Phase: 10
- Related: [ADR-012](./ADR-012-serialization-and-wire-contracts.md), [ADR-016](./ADR-016-document-runtime-ownership.md), [ADR-019](./ADR-019-collaboration-transport.md), [ADR-021](./ADR-021-persistence-atomicity.md), [ADR-022](./ADR-022-reconnect-sync.md)

## Problem

Network collaboration requires a single authority for document history. Clients must not invent Version identity or acceptance order.

## Context

Phase 9 defined envelope transport and ACK ladders but no network authority. In-memory collab is experimental and not durable.

## Decision

The **server** is authoritative for:

- `Version.id`, `sequence`, `revision`, `parentId`, `changeFromParent`, `contents`
- Per-document acceptance order (one logical writer stream)

Clients may propose only:

- `changeId`, `dependsOn`, `baseVersionId`, ChangeSet, untrusted client metadata

### Per-document serialization

`DocumentServerSession` serializes acceptance for one `documentId`. Correctness model: **one ordered writer per document**. Deployments may use actors, sticky routing, or partition ownership.

### Duplicate `changeId`

Same `(documentId, changeId)` must not create a second authoritative Version. Replay the known result.

### Shared mutation engine

Server applies via existing `DocumentHandle` / ChangeSet / Version — no parallel mutation engine. OT is provenance-blind.

## Alternatives considered

1. **Client-proposed Version IDs** — Rejected; forges history identity.
2. **Envelope-log as sole history** — Rejected; Versions remain durable unit (ADR-018).
3. **CRDT / multi-head** — Deferred; Phase 10 is linear OT authority.

## Consequences

- `lextrix-collab` hosts `DocumentServerSession` and control frames.
- Clients treat local HEAD as optimistic; confirmed Version follows `history` ACK.

## Failure semantics

Unknown base / rebase limit → sync-required. Missing `dependsOn` → causal reject. Apply/CAS failure → no history broadcast.

## Security implications

Never trust client Version fields. Stamp actor identity from application AuthN into meta only.

## Compatibility impact

ADR-012 unchanged. Additive collab package.

## Non-goals

Production WS/HTTP/DB, Auth products, CRDT, branches, presence.
