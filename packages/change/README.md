# lextrix-change

Canonical **ChangeSet** OT engine and document runtime for Lextrix 3.0.

## Purpose

- ChangeSet compose / transform / invert / diff
- Document / DocumentHandle / Version / Anchor / Range / Proposal
- Wire contracts (ADR-012)
- Persistence & collaboration **ports** (no pg/ws/auth)

## Install

```bash
npm install lextrix-change
```

## Stable imports

```js
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/document';
import { parseChangeSet, serializeChangeSet } from 'lextrix-change/wire';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';
```

| Export path | Stability |
|-------------|-----------|
| `lextrix-change` | Stable |
| `/wire` | Stable (`schemaVersion: 1`) |
| `/document` | Stable |
| `/persistence` | Stable ports |
| `/collaboration` | Stable ports |
| `/experimental` | Experimental |

## Boundaries

`lextrix-change` must not depend on PostgreSQL, WebSocket, Auth, or OpenAI.

## Docs

[API stability](../../docs/architecture/api-stability.md) · [ADRs](../../docs/architecture/adr/README.md)
