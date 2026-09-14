# Lextrix 3.0.0 Release Readiness

- **Date:** 2026-09-14  
- **Scope:** Documentation reconciliation, version **3.0.0**, playground upgrade (real APIs), playground browser tests, full regression  
- **Mode:** Product integration / release preparation — **not** Phase 13, **not** roadmap implementation  

**Supersedes:** [RELEASE-3.0.0-READINESS.md](./RELEASE-3.0.0-READINESS.md) (interim notes)

---

## Release Summary

Lextrix 3.0.0 packages the implemented document infrastructure (Phases 0–12) with the rich-text editor as a **projection**. The existing Vite playground (`packages/demo`) was upgraded to demonstrate Document, Version, ChangeSet, Proposal, authoritative collaboration, presence, and lifecycle/CAS ports using **real package APIs** — without duplicating the engine or marketing deferred capabilities.

Prior gates remain in force:

- `FINAL VALIDATION PASSED WITH DOCUMENTED LIMITATIONS`
- `BROWSER VALIDATION PASSED WITH DOCUMENTED LIMITATIONS`
- `CLEANUP COMPLETE WITH DOCUMENTED LIMITATIONS`

---

## Version Changes

| Package | Previous | Target | Notes |
|---------|----------|--------|-------|
| Root monorepo | 2.1.0 | **3.0.0** | Coordinated platform release |
| `lextrix` + editor pkgs | 2.1.0 | **3.0.0** | Lockstep |
| `lextrix-change` / `collab` / `server` / `intelligence` | 2.1.0 | **3.0.0** | Engine stack |
| `lextrix-demo` | 2.1.0 | **3.0.0** | Playground |
| `@lextrix/react` | 0.2.0 | **0.3.0** | Peer `lextrix@^3.0.0` |
| ADR-012 `schemaVersion` | 1 | **1** | Unchanged |
| Examples | 0.0.0 | 0.0.0 | Current 3.0 editor APIs |

Historical “2.1” references in CHANGELOG / migration guides / ADRs were **left intact** (history, not current labels). Dependency versions containing `2.x` were not rewritten.

---

## Documentation Updates

| Doc | Action |
|-----|--------|
| Root `README.md` | Platform framing + playground link |
| `CHANGELOG.md` | 3.0.0 section |
| `docs/guides/migration-3.0.md` | Upgrade guide |
| `docs/architecture/overview.md` | Engine + packages |
| Package READMEs | Current |
| `docs/playground.md` | **New** — run, architecture diagram, limitations |
| `docs/getting-started/evaluation.md` | Points to local platform playground |
| `docs/architecture/FUTURE-ROADMAP.md` | Linked; not claimed shipped |
| This report | Final readiness + matrix + checklist |

---

## Architecture Summary

```text
ChangeSet  →  Document / Version  →  Editor projection
                 ↑
         Proposals (intelligence)
                 ↑
    Authoritative session (collab) + persistence ports
                 ↑
         lextrix-server (reference host; not embedded in playground)
```

Playground is a **consumer only**. No second Document engine. No architectural contract changes for demo convenience.

**PLAYGROUND API GAP:** none blocking 3.0.0 demos. Snapshot SHA-256 requires `node:crypto` — labeled **NOT SUITABLE FOR BROWSER DEMO** (Node tests cover it).

---

## Playground Changes

| Area | Change |
|------|--------|
| UX | Readable KV / status; expandable **Developer details**; no primary JSON dumps |
| Errors | Classified banners (stale proposal, persistence, lifecycle, etc.); stacks under details |
| A11y | Labels, `aria-live` status, listbox versions, focus-visible styles |
| Collab / infra | Real `DocumentServerSession`, CAS, lifecycle; Node-only notes for snapshot/compaction |
| Tests | Playwright behavioral suite expanded (**11** cases) |
| Docs | `docs/playground.md` |

---

## Playground Feature Matrix

| Feature | Implemented in Playground | Uses Real API | Tested | Notes |
|---------|---------------------------|---------------|--------|-------|
| Editor | Yes | Yes (`lextrix`) | Yes | Load, type, format |
| Document | Yes | Yes (experimental bridge) | Yes | Panel + meta |
| Transactions | Partial | Yes (engine) | Via engine suites | No dedicated playground tx UI |
| Versions | Yes | Yes | Yes | History list updates |
| History | Yes | Yes | Yes | Restore → new Version |
| Anchors | Yes | Yes | Manual / demo btn | Readable summary |
| Ranges | Yes | Yes | Manual / demo btn | With anchors |
| Proposals | Yes | Yes (`lextrix-intelligence`) | Yes | Inspect + explicit accept |
| Intelligence | Yes | Deterministic provider | Yes | No API key in playground |
| Collaboration | Yes | Yes (`lextrix-collab`) | Yes | Dual-client converge (in-memory) |
| Server | Demo only | Session API yes | Yes | Not full `lextrix-server` host |
| Persistence | Yes (in-memory CAS) | Yes | Yes | Not PostgreSQL |
| Snapshots | **NOT SUITABLE FOR BROWSER DEMO** | — | Node tests | `node:crypto` hashing |
| Compaction | **NOT SUITABLE FOR BROWSER DEMO** | — | Node tests | seal→archive→purge in Node/server |
| Presence | Yes | Yes (ephemeral store) | Yes | Cannot block accept |
| Lifecycle | Yes | Yes | Yes | Tombstone / revive |
| Wire | Indirect | ADR-012 packages | Wire golden tests | No live wire dump UX |
| Diagnostics | Yes | Status + Developer details | Yes | Errors classified |

---

## Test Results

| Suite | Result |
|-------|--------|
| Playground Playwright | **11 PASS** |
| `lextrix-change` | **229 PASS** (incl. package-boundary, wire-golden, property, fuzz-style) |
| `lextrix-collab` | **36 PASS** |
| `lextrix-server` | **10 PASS** / **4 PostgreSQL SKIPPED** (no PG in env — **not** claimed passed) |
| `lextrix-intelligence` | **80 PASS** |
| Chromium unit (`test:unit`) | **582 PASS** |
| Chromium E2E | **43 PASS** |
| Fuzz (`test:fuzz`) | **4 PASS** |

---

## Browser Results

- Playground loads; editor initializes with experimental Document bridge.
- Typing / formatting / Document+Version panels behave correctly.
- Restore appends a new Version matching restored contents.
- Proposal inspect → accept only after explicit action; stale accept surfaces user-readable error.
- Collab A+B converge on shared HEAD; presence publishes.
- Infra CAS + tombstone work; snapshot/compaction buttons declare Node-only limitation.
- No fatal console errors in playground suite.

---

## Regression Results

| Gate | Result |
|------|--------|
| Node engine packages | PASS (PG skipped honestly) |
| Chromium unit + E2E | PASS |
| Playground | PASS |
| Build | **PASS** (`lextrix` + `@lextrix/react`) |
| Fuzz | PASS |
| Root `npm run typecheck` | **FAIL** — pre-existing editor/theme/test typing debt (documented; not introduced by playground) |
| `npm run lint -w lextrix` | ESLint **0 errors** / 62 prettier warnings; **fails** on `lint:tsc` (same debt) |
| Package boundaries | PASS (`lextrix-change` package-boundary) |
| Wire golden | PASS |

---

## API Stability

Stable surfaces unchanged for 3.0.0: `lextrix`, `lextrix-change`, `/wire`, `/document`, `/persistence`, `/collaboration`, `lextrix-collab`, `lextrix-intelligence`. Experimental barrel retained without semver promise. See [api-stability.md](./api-stability.md).

---

## Wire Compatibility

ADR-012 kinds and `schemaVersion: 1` unchanged. Golden + property wire tests PASS.

---

## Known Limitations

1. PostgreSQL integration tests skipped without a live database — **not passed**.
2. Playground uses in-memory ports — not production WebSocket soak or multi-process fencing.
3. Snapshot integrity / compaction seal path are Node-only in the demo (crypto).
4. Root typecheck / `lint:tsc` still report pre-existing typing debt in editor/themes/tests.
5. Deferred roadmap (CRDT, active-active, E2EE, SaaS, billing, full presence UX, AI agents, global SLO) is **not** part of 3.0.0.

---

## Deferred Roadmap Items

See [FUTURE-ROADMAP.md](./FUTURE-ROADMAP.md). Discovery only — **no Phase 13 started**.

---

## Performance Notes

Playground avoids unbounded JSON render loops; version list / frame logs are capped; collab frame buffer truncated; no runaway presence timers. Editor coalesce prevents one-Version-per-keystroke explosion (asserted in tests). Production perf SLOs are out of scope for 3.0.0 marketing.

---

## Security Notes

- Playground authorize hooks accept all envelopes (demo only).
- Intelligence is deterministic / proposal-only.
- Production AuthN/AuthZ remains host responsibility (`lextrix-server` hooks).
- Untrusted proposal limits enforced in engine (trust tests PASS).

---

## Migration Notes

See [docs/guides/migration-3.0.md](../guides/migration-3.0.md). Wire schema version stays 1; package majors move to 3.0.0; React peer bumps to `lextrix@^3.0.0`.

---

## Release Checklist

- [x] Version 3.0.0 updated  
- [x] Root README updated  
- [x] Package READMEs updated  
- [x] Architecture docs reconciled  
- [x] API docs reconciled  
- [x] Changelog updated  
- [x] Playground upgraded  
- [x] Playground uses real Lextrix APIs  
- [x] Playground browser tests pass  
- [x] Existing Chromium suite passes  
- [x] E2E suite passes  
- [x] Node regression passes (PG skipped, not claimed)  
- [ ] Typecheck passes — **documented pre-existing debt**  
- [x] Build passes  
- [ ] Lint passes — ESLint clean of errors; `lint:tsc` fails with same debt  
- [x] Wire compatibility passes  
- [x] Package boundaries pass  
- [x] No obsolete primary examples remain  
- [x] Known limitations documented  
- [x] Future roadmap referenced correctly  
- [x] No Phase 13 started  

---

## Final Verdict

```text
RELEASE PREPARATION COMPLETE WITH DOCUMENTED LIMITATIONS

Lextrix 3.0.0 is ready for the implemented document-infrastructure + editor
projection scope. Playground demonstrates the real architecture without fakes.
PostgreSQL live tests and full root typecheck remain documented gaps — not silent passes.
```

---

## STOP

Documentation reconciled. Version **3.0.0**. Playground upgraded to real APIs with behavioral tests. Full engine + Chromium + E2E + fuzz regression executed. Release documentation created. Known limitations documented. **No roadmap feature implemented. No Phase 13 started.**

**STOP.**
