# Lextrix 3.0.0 Release Readiness Report (interim)

> **Superseded by** [LEXTRIX-3.0.0-RELEASE-READINESS.md](./LEXTRIX-3.0.0-RELEASE-READINESS.md) — use that document for the final checklist, playground feature matrix, and regression results.

- Date: 2026-09-14
- Scope: Documentation reconciliation, version 3.0.0, playground platform demo, playground tests
- Mode: Product integration — **not** Phase 13 / not roadmap implementation

---

## 1. Verdict

```text
RELEASE PREPARATION COMPLETE WITH DOCUMENTED LIMITATIONS
Lextrix 3.0.0 is ready for the implemented platform scope.
```

Prior gates remain in force:

- FINAL VALIDATION PASSED WITH DOCUMENTED LIMITATIONS  
- BROWSER VALIDATION PASSED WITH DOCUMENTED LIMITATIONS  

---

## 2. Version matrix

| Package | Previous | Target | Reason |
|---------|----------|--------|--------|
| root monorepo | 2.1.0 | **3.0.0** | Coordinated platform release |
| `lextrix` | 2.1.0 | **3.0.0** | Published editor |
| `lextrix-change` | 2.1.0 | **3.0.0** | Engine |
| `lextrix-collab` | 2.1.0 | **3.0.0** | Collab protocol |
| `lextrix-server` | 2.1.0 | **3.0.0** | Reference host |
| `lextrix-intelligence` | 2.1.0 | **3.0.0** | Proposals |
| `lextrix-core` / `dom` / `formats` / `modules` / `serialize` / `themes` / `ui` / `demo` | 2.1.0 | **3.0.0** | Lockstep |
| `@lextrix/react` | 0.2.0 | **0.3.0** | Independent line; peer `lextrix@^3.0.0` |
| examples | 0.0.0 | 0.0.0 | Private starters (unchanged) |

**Not changed:** ADR-012 `schemaVersion: 1`, ADR numbers, unrelated dependency versions.

---

## 3. Documentation

| Doc | Classification | Action |
|-----|----------------|--------|
| Root `README.md` | CURRENT | Rewritten for 3.0 platform |
| `CHANGELOG.md` | CURRENT | Added 3.0.0 + react 0.3.0 |
| `docs/guides/migration-3.0.md` | CURRENT | New |
| `docs/architecture/overview.md` | CURRENT | Rewritten for engine + packages |
| Package READMEs (change/collab/server/intelligence/demo) | CURRENT | Added |
| ADRs | HISTORICAL + ARCHITECTURAL | Preserved |
| FUTURE-ROADMAP | FUTURE ROADMAP | Linked; not claimed as shipped |
| FINAL-SYSTEM-VALIDATION | ARCHITECTURAL | Linked |
| migration-2.1 | HISTORICAL | Kept |

---

## 4. Playground

**Location:** `packages/demo` (existing Vite playground — upgraded, not replaced)

| Capability | Demo approach |
|------------|---------------|
| Editor | Real `lextrix` themes/modules/import/export |
| Document / Versions / Anchors | Experimental bridge APIs on the live editor |
| Intelligence | `DeterministicDocumentIntelligenceProvider` (no API key) |
| Collaboration | In-memory `DocumentServerSession` + dual client submits |
| Presence | `EphemeralPresenceStore` |
| Infrastructure | In-memory CAS + lifecycle; snapshot SHA-256 labeled Node-only |

**Browser constraint:** `createSnapshotFromVersion` uses `node:crypto`. Vite aliases a browser shim when collab loads persistence barrel; infra panel avoids snapshot hashing and points to Node tests.

**Tests:** 6 Playwright Chromium cases — **PASS**

---

## 5. Regression results (this preparation)

| Suite | Result |
|-------|--------|
| Playground Playwright | **6 PASS** |
| `lextrix-change` | **229 PASS** |
| `lextrix-collab` | **36 PASS** |
| `lextrix-server` | **10 PASS** / **4 PG SKIPPED** |
| `lextrix-intelligence` | **80 PASS** |
| Chromium unit | **582 PASS** |
| Chromium e2e | **43 PASS** |

Limitations unchanged: live PG may skip; root typecheck may still report pre-existing editor/theme typing debt.

---

## 6. What was not done (by design)

- Phase 13
- CRDT / E2EE / SaaS / billing / presence UX / automated multi-region
- Architecture redesign
- Fake collaboration by copying text between editors
- Claiming roadmap items as implemented

---

## 7. How to verify locally

```bash
npm install
npm run build
npm run demo          # http://localhost:5173
npm test -w lextrix-demo
npm test              # includes playground when root script updated
```

---

## STOP

Release preparation complete. No further phase work started.
