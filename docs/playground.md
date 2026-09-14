# Lextrix playground

The **platform playground** lives in [`packages/demo`](../packages/demo). It is a Vite app that consumes published workspace packages — not a second document engine.

## How to run

From the repository root:

```bash
npm install
npm run build          # builds lextrix editor bundle (demo predev also builds)
npm run demo           # http://localhost:5173
```

Or:

```bash
npm run dev -w lextrix-demo
```

## What it demonstrates

A user should be able to open the playground and see:

1. **I am editing a document** — rich-text editor (themes, toolbar, import/export).
2. **There is an underlying Document** — Document panel via experimental bridge.
3. **There are immutable Versions** — history list; restore appends a new Version.
4. **Changes are ChangeSets** — proposal ops summarized; collab clients submit ChangeSets.
5. **Collaboration** — in-memory `DocumentServerSession` (authoritative accept).
6. **Persistence is separate** — CAS append via `InMemoryAuthoritativePersistence`.
7. **AI produces proposals** — deterministic intelligence provider; explicit accept/reject.
8. **Editor is a projection** — accept projects Document → editor without a feedback loop.

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│  packages/demo (Vite playground — consumer only)        │
│                                                         │
│  main.js ──► Lextrix editor (experimentalDocument)      │
│       │                                                 │
│       ├── platform-panels.js                            │
│       │     Document / Version / Anchor / Proposal UX   │
│       ├── collab-demo.js                                │
│       │     DocumentServerSession + presence            │
│       └── infra-demo.js                                 │
│             CAS + lifecycle (browser-safe subset)       │
└───────────────┬─────────────────┬───────────────────────┘
                │                 │
                ▼                 ▼
         lextrix (editor)   lextrix-change / collab / intelligence
                │                 │
                └────────┬────────┘
                         ▼
              Real package APIs (no duplicated engine)
```

| Layer | Package | Role in playground |
|-------|---------|-------------------|
| Editor projection | `lextrix` | Mount, toolbar, import/export, bridge |
| Document engine | `lextrix-change` | DocumentHandle, Version, ChangeSet, ports |
| Collaboration | `lextrix-collab` | Authoritative session, presence store |
| Intelligence | `lextrix-intelligence` | Deterministic proposal provider |
| Production host | `lextrix-server` | **Not** embedded — Node/PostgreSQL elsewhere |

## Demo sections

| Section | Real APIs | Notes |
|---------|-----------|-------|
| Editor | `Lextrix`, themes, modules | Always on |
| Import / Export | `importContent` / `exportContent` | Usable editing surface |
| Document | `getExperimentalDocument/Handle/Version` | Readable KV, not raw JSON dump |
| History | `listVersions`, `restoreVersion`, `diffVersions` | Restore ≠ rewrite |
| Anchors / Ranges | `createAnchor`, `createRange` | Small demo |
| Proposals | Deterministic provider + `acceptProposalAndProject` | Explicit accept |
| Collaboration | `DocumentServerSession.accept` | In-memory only |
| Presence | `EphemeralPresenceStore` | Ephemeral; cannot block accept |
| Infrastructure | CAS + lifecycle | Snapshot/compaction **Node-only notes** |

Raw JSON lives under expandable **Developer details**, not the primary UI.

## Limitations

- In-memory ports only — not PostgreSQL, not production WebSocket soak.
- Snapshot integrity hashing uses `node:crypto` → **not suitable for browser demo**; buttons explain and point to Node tests.
- Compaction seal→archive→purge likewise Node / `lextrix-server`.
- Deterministic intelligence only in-playground (no API key); OpenAI provider is optional elsewhere.
- Experimental Document bridge required (`experimentalDocument: true`).

## Optional configuration

- Theme selector (snow / bubble / slate / dawn).
- Read-only toggle.
- Vite aliases deep persistence modules and a `node:crypto` shim so collab can load without crashing the browser (shim is not a real hash).

## Tests

```bash
npm test -w lextrix-demo
```

Playwright Chromium tests assert **user-visible behavior** (load, type, format, restore, accept, collab converge, lifecycle, error banners, no fatal console errors).

## Adding future examples

1. Prefer a new **section** in `index.html` + a small module under `packages/demo/src/`.
2. Import from workspace packages only — never copy engine logic into the demo.
3. Keep primary UI readable; put dumps under `<details>Developer details</details>`.
4. If a capability needs Node (`crypto`, Postgres, multi-process fencing), label it **NOT SUITABLE FOR BROWSER DEMO** and link to package tests.
5. If an API is missing for a legitimate demo, report a **PLAYGROUND API GAP** — do not invent architecture in the playground.

See also: [architecture overview](./architecture/overview.md), [3.0.0 release readiness](./architecture/LEXTRIX-3.0.0-RELEASE-READINESS.md), [future roadmap](./architecture/FUTURE-ROADMAP.md).
