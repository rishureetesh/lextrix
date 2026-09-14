# lextrix-collab

Authoritative collaboration protocol for Lextrix 3.0.

## Purpose

- Control frames (envelope / ack / sync / reject / error / presence)
- `DocumentServerSession` — server-owned Version identity & accept order
- `AuthoritativeClientSession` — reconnect / pending
- Ownership / `owner_epoch` fencing contracts
- Ephemeral presence store
- Home-region foundations

Depends on **`lextrix-change` only** (no pg/ws).

## Install

```bash
npm install lextrix-collab lextrix-change
```

## Example

```js
import { DocumentServerSession } from 'lextrix-collab';
import { InMemoryAuthoritativePersistence } from 'lextrix-change/persistence';
import ChangeSet from 'lextrix-change';

const persistence = new InMemoryAuthoritativePersistence();
const session = await DocumentServerSession.open('doc1', { persistence }, {
  contents: new ChangeSet([{ insert: 'Hi\n' }]),
  createIfMissing: true,
});
```

Production WebSocket + PostgreSQL: see **`lextrix-server`**.
