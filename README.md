# Lextrix

**Version 3.0.0** — a programmable **document engine** with a rich-text **editor projection**.

Built by **[Reetesh Kumar](https://iamreetesh.com/me)** · [Playground](https://iamreetesh.com/lextrix) · [Docs](https://iamreetesh.com/docs) · [Repo docs](./docs/README.md)

Lextrix is more than a WYSIWYG editor. ChangeSets are the canonical transitions; Documents and Versions are immutable state; the browser editor projects that state. Collaboration, persistence, and intelligence plug in through stable ports — without putting Auth, billing, or LLM vendors inside the core engine.

---

## What you get

| Layer | Role |
|-------|------|
| **ChangeSet / OT** | Canonical document transitions (`lextrix-change`) |
| **Document / Handle / Version** | Immutable state + live session + linear history |
| **Editor** | DOM projection (`lextrix` package) |
| **Collaboration** | Authoritative accept / sync (`lextrix-collab`) |
| **Server** | Reference PostgreSQL + WebSocket host (`lextrix-server`) |
| **Intelligence** | Proposal producers only (`lextrix-intelligence`) |

**Invariants:** DocumentState ≠ ChangeSet · History ≠ Versioning · AI never directly mutates · Server owns Version IDs · ADR-012 wire `schemaVersion: 1`.

---

## Quick start (editor)

```bash
npm install lextrix
```

```javascript
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

const editor = new Lextrix('#editor', {
  theme: 'snow',
  modules: { toolbar: [['bold', 'italic'], ['link']] },
});
```

React: `npm install lextrix @lextrix/react` — see [React guide](./docs/guides/react.md).

---

## Document engine (stable imports)

```javascript
import ChangeSet from 'lextrix-change';
import { DocumentHandle } from 'lextrix-change/document';
import { parseChangeSet } from 'lextrix-change/wire';
```

| Import | Stability |
|--------|-----------|
| `lextrix` | Stable editor bundle |
| `lextrix-change` | Stable ChangeSet OT |
| `lextrix-change/wire` | Stable ADR-012 |
| `lextrix-change/document` | Stable runtime Document API |
| `lextrix-change/persistence` | Stable ports (+ in-memory refs) |
| `lextrix-change/collaboration` | Stable transport ports |
| `lextrix-collab` | Stable collab protocol / sessions |
| `lextrix-change/experimental` | **Experimental** — no semver promise |
| `lextrix-server` | Reference production adapters (not core) |
| `lextrix-intelligence` | Application-layer proposals |

Details: [API stability](./docs/architecture/api-stability.md).

---

## Playground

Local platform demo (editor + Document/Version/Proposal/collab/infra panels):

```bash
npm run demo
# → http://localhost:5173
```

Guide: [docs/playground.md](./docs/playground.md). Uses real package APIs. Collaboration/persistence panels are **in-memory reference** demos — not a claim of live PostgreSQL or production WebSocket.

Playwright tests: `npm test -w lextrix-demo` (builds via Vite).

---

## Develop / test / build

```bash
npm install
npm run build
npm test                 # engine + Chromium unit suites
npm run test:unit -w lextrix
npm run test:e2e -w lextrix
npm run typecheck
```

---

## Packages

| Package | Purpose |
|---------|---------|
| `lextrix` | Published editor (themes, modules, serialization) |
| `lextrix-change` | ChangeSet, Document, wire, persistence ports |
| `lextrix-collab` | Authoritative collaboration protocol |
| `lextrix-server` | PostgreSQL + WebSocket reference host |
| `lextrix-intelligence` | Deterministic / OpenAI proposal providers |
| `lextrix-core` / `dom` / `formats` / `modules` / `themes` / `ui` / `serialize` | Editor internals |
| `@lextrix/react` | React bindings (independent semver: **0.3.0**, peer `lextrix@^3.0.0`) |
| `lextrix-demo` | This repo’s playground |

---

## Architecture & validation

- [Documentation site](https://iamreetesh.com/docs) · [Repo docs](./docs/README.md)
- [Architecture overview](./docs/architecture/overview.md)
- [ADRs](./docs/architecture/adr/README.md)
- [Final system validation](./docs/architecture/FINAL-SYSTEM-VALIDATION-REPORT.md)
- [Future roadmap](./docs/architecture/FUTURE-ROADMAP.md) *(discovery — not a build commitment)*
- [Changelog](./CHANGELOG.md)
- [Migrate from 2.1](./docs/guides/migration-3.0.md)

---

## Current limitations (honest)

Release-ready for **implemented scope**, with documented limits:

- Live PostgreSQL / multi-process fencing / WS soak / numeric SLOs may be environment-gated
- Presence **protocol** exists; presence **UX** is deferred
- Automated multi-region product, SaaS/billing, CRDT, E2EE are **not** claimed
- See validation report for the full scorecard

---

## License

MIT
