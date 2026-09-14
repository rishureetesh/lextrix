# API Stability (Phase 7–12)

## Stable surfaces

| Import | Contents |
|--------|----------|
| `lextrix-change` | ChangeSet OT engine |
| `lextrix-change/wire` | schemaVersion **1** (unchanged) |
| `lextrix-change/document` | Document runtime |
| `lextrix-change/persistence` | Persistence + CAS + snapshot/archive/lifecycle ports |
| `lextrix-change/collaboration` | Transport/adapter ports |
| `lextrix-collab` frame types / ownership / presence / region **contracts** | Protocol |

## Production host (`lextrix-server`)

| Surface | Class |
|---------|--------|
| Postgres / WS adapters | **Reference production adapters** — not core |
| `CollabHost` | Composition helper |
| Ownership / compaction job internals | Unstable |

## Ownership

```text
lextrix-change ↛ pg | ws | auth
lextrix-collab ↛ pg | ws
lextrix-server → pg, ws, change, collab
```

## Inventory

[api-inventory-phase11.md](./api-inventory-phase11.md) · [api-inventory-phase12.md](./api-inventory-phase12.md)
