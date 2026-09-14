# lextrix-demo

**Lextrix 3.0 platform playground** — consumer of real packages.

Full guide: [`docs/playground.md`](../../docs/playground.md).

## Run

```bash
npm run demo
# http://localhost:5173
```

`predev` builds the `lextrix` editor bundle.

## Demonstrates

| Panel | APIs |
|-------|------|
| Editor | `lextrix` themes/modules/import/export |
| Document / Versions | experimental bridge on the editor |
| Proposals | `lextrix-intelligence` deterministic provider |
| Collaboration | `lextrix-collab` + in-memory authoritative persistence |
| Infrastructure | CAS + lifecycle (snapshot/compaction Node-only notes) |

Primary UI uses readable summaries; raw state is under **Developer details**.

## Test

```bash
npm test -w lextrix-demo
```

Playwright Chromium against the Vite playground.
