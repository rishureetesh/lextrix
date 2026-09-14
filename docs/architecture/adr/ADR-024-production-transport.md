# ADR-024 Production Transport (WebSocket)

- Status: Accepted
- Date: 2026-09-14
- Phase: 11
- Related: [ADR-012](./ADR-012-serialization-and-wire-contracts.md), [ADR-019](./ADR-019-collaboration-transport.md), [ADR-022](./ADR-022-reconnect-sync.md)

## Decision

Primary production transport is **WebSocket**, carrying Phase-10 control frames:

`envelope | ack | sync | reject | error`

ADR-012 wire kinds are unchanged. Transport does not mutate Documents.

Clients address `documentId`; the host **proxies** to the current document owner rather than exposing partition topology.

Heartbeats ≠ ownership validity.

## Alternatives rejected

SSE-only; HTTP-only; redesigning ADR-012 for frames.

## Non-goals

Presence product channel as Version history; cloud vendor lock-in.
