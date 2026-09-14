# lextrix-server

Reference **production host** for Lextrix 3.0 — PostgreSQL persistence, WebSocket transport, Auth hooks, observability.

## Purpose

Compose `lextrix-collab` sessions with:

- PostgreSQL CAS / ownership / snapshots / archive / lifecycle
- WebSocket collab host
- Application-owned AuthN/AuthZ hooks

**Not** part of the core engine DAG. Adapters are reference implementations.

## Install

```bash
npm install lextrix-server lextrix-collab lextrix-change
```

Requires Node ≥18. Live PG tests need `LEXTRIX_PG_URL`.

## Docs

[Deployment](../../docs/architecture/deployment-production.md) · [ADR-023–030](../../docs/architecture/adr/README.md)
