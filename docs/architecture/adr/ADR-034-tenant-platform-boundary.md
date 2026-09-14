# ADR-034 Tenant / Platform Boundary

- Status: Accepted
- Date: 2026-09-14
- Phase: 12
- Related: [ADR-015](./ADR-015-security-and-trust-boundary.md), [ADR-026](./ADR-026-auth-boundary.md), [ADR-029](./ADR-029-observability.md)

## Context

Applications need multi-customer hosting. Putting tenancy inside the OT/document engine contaminates core invariants.

## Decision

1. **Tenancy is application-owned.** Lextrix operates on `documentId` + AuthN/AuthZ hooks.
2. **No `tenantId` in ChangeSet, Version lineage, or OT.**
3. Optional opaque `tenantId` may appear only in observe/log correlation supplied by the host.
4. Quotas/billing are application policy; Lextrix enforces **resource limits** (connections, queues, sync size, rate) that apps map to plans.
5. **Billing is outside Lextrix.** Hosts may consume meterable observe events.
6. Security/application **audit ≠ Version history**.
7. Encryption: TLS + at-rest are deployment-owned; collaborative **E2EE is not selected** (incompatible with server-side OT inspection).

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| First-class tenant tables in `lextrix-change` | Couples engine to SaaS product |
| Billing meters inside core | Wrong layer |
| E2EE collab in Phase 12 | Breaks authoritative server OT |

## Consequences

- SaaS control planes stay in the application.
- Multi-tenant isolation relies on AuthZ (+ optional deployment DB isolation).

## Migration

None for single-tenant apps; multi-tenant apps pass AuthZ and optional observe context.
