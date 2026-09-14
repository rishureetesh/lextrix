# Architecture Decision Records

ADRs for the Lextrix document-engine transformation live here.

## Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](./ADR-001-canonical-document-model.md) | Canonical Document Model | Accepted |
| [ADR-002](./ADR-002-changeset-core-primitive.md) | ChangeSet as Core Primitive | Accepted |
| [ADR-003](./ADR-003-dom-rendering-boundary.md) | DOM as Rendering Boundary | Accepted |
| [ADR-004](./ADR-004-document-versioning.md) | Document Versioning (Linear) | Accepted |
| [ADR-005](./ADR-005-stable-anchors.md) | Stable Anchors | Accepted |
| [ADR-006](./ADR-006-change-proposals.md) | Change Proposals / Review Primitives | Accepted |
| [ADR-007](./ADR-007-collaboration-and-rebase.md) | Collaboration and Rebase | Accepted |
| [ADR-008](./ADR-008-document-to-editor-projection.md) | Document → Editor Projection | Accepted |
| [ADR-009](./ADR-009-ai-as-proposal-producer.md) | AI as a Proposal Producer | Accepted |
| [ADR-010](./ADR-010-document-intelligence-provider-boundary.md) | Document Intelligence Provider Boundary | Accepted |
| [ADR-011](./ADR-011-proposal-provenance-and-acceptance-policy.md) | Proposal Provenance and Acceptance Policy | Accepted |
| [ADR-012](./ADR-012-serialization-and-wire-contracts.md) | Serialization & Wire Contracts | Accepted |
| [ADR-013](./ADR-013-proposal-review-workflow.md) | Proposal Review Workflow (Application Layer) | Accepted |
| [ADR-014](./ADR-014-collaboration-failure-and-recovery.md) | Collaboration Failure & Recovery Semantics | Accepted |
| [ADR-015](./ADR-015-security-and-trust-boundary.md) | Security & Trust Boundary | Accepted |
| [ADR-016](./ADR-016-document-runtime-ownership.md) | Document Runtime Ownership & Session Model | Accepted |
| [ADR-017](./ADR-017-document-observation.md) | Document Observation Contract | Accepted |
| [ADR-018](./ADR-018-persistence-and-durability.md) | Persistence Model & Durability Boundary | Accepted |
| [ADR-019](./ADR-019-collaboration-transport.md) | Collaboration Transport Boundary | Accepted |
| [ADR-020](./ADR-020-authoritative-server.md) | Authoritative Server & Version Sequencing | Accepted |
| [ADR-021](./ADR-021-persistence-atomicity.md) | Persistence Atomicity | Accepted |
| [ADR-022](./ADR-022-reconnect-sync.md) | Reconnect & Sync Protocol | Accepted |
| [ADR-023](./ADR-023-production-persistence.md) | Production Persistence (PostgreSQL) | Accepted |
| [ADR-024](./ADR-024-production-transport.md) | Production Transport (WebSocket) | Accepted |
| [ADR-025](./ADR-025-distributed-ownership.md) | Distributed Ownership & Fencing | Accepted |
| [ADR-026](./ADR-026-auth-boundary.md) | AuthN/AuthZ Boundary | Accepted |
| [ADR-027](./ADR-027-presence.md) | Presence Architecture | Accepted (protocol: Phase 12; UX deferred) |
| [ADR-028](./ADR-028-compaction-snapshots.md) | Compaction & Snapshots | Accepted (engine: Phase 12; see ADR-031) |
| [ADR-029](./ADR-029-observability.md) | Production Observability | Accepted |
| [ADR-030](./ADR-030-disaster-recovery.md) | Disaster Recovery | Accepted |
| [ADR-031](./ADR-031-compaction-snapshot-architecture.md) | Compaction & Snapshot Architecture | Accepted |
| [ADR-032](./ADR-032-presence-protocol.md) | Presence Protocol | Accepted |
| [ADR-033](./ADR-033-multi-region-authority.md) | Multi-Region Authority | Accepted |
| [ADR-034](./ADR-034-tenant-platform-boundary.md) | Tenant / Platform Boundary | Accepted |
| [ADR-035](./ADR-035-data-lifecycle-deletion.md) | Data Lifecycle & Deletion | Accepted |

Phase design docs:

- [Collaboration architecture (5A)](../collaboration-architecture.md)
- [Phase 11 Architecture Discovery](../PHASE-11-ARCHITECTURE-DISCOVERY.md)
- [Phase 12 Architecture Discovery](../PHASE-12-ARCHITECTURE-DISCOVERY.md)
- [Production deployment](../deployment-production.md)
- [API inventory (Phase 11)](../api-inventory-phase11.md)
- [Document Transactions](../document-transactions.md)
- [Editor ↔ Document Bridge](../editor-document-bridge.md)
- [Dual operation model](../dual-operation-model.md)
- [Experimental Document API](../experimental-document.md)

## Template

```markdown
# ADR-NNN Title

- Status: Proposed | Accepted | Superseded | Deprecated
- Date: YYYY-MM-DD

## Context

## Decision

## Alternatives considered

## Consequences

## Migration strategy
```

Progress: [TRANSFORMATION-PROGRESS.md](../TRANSFORMATION-PROGRESS.md).
