# Lextrix Architecture Overview

## Introduction

Lextrix is a standalone rich-text editor engine built for modern web applications.

The project is organized as a modular monorepo with clear separation between:

* Change processing
* Document structure
* DOM synchronization
* Formatting
* Selection handling
* Plugin integration

The architecture is designed to keep editor behavior predictable while allowing formats, modules, and integrations to evolve independently.

---

## High-Level Architecture

```text
User Input
     │
     ▼
Selection
     │
     ▼
Editor Commands
     │
     ▼
Change Engine
     │
     ▼
Document Model
     │
     ▼
DOM Synchronization
     │
     ▼
Browser DOM
```

Core subsystems communicate through well-defined boundaries rather than direct coupling.

---

## Package Structure

### lextrix-change

Responsible for change representation and transformation.

Key concepts:

* ChangeSet
* DocumentOperation
* OperationStream
* OperationBuffer

Responsibilities:

* Represent document changes
* Compose changes
* Transform concurrent changes
* Compute diffs
* Maintain operational consistency

---

### lextrix-dom

Responsible for document structure and DOM synchronization.

Key concepts:

* Blots
* FormatRegistry
* FormatDefinitionCatalog
* MutationCoordinator
* DomBinding

Responsibilities:

* Maintain document tree structure
* Manage formatting behavior
* Synchronize editor state with the browser DOM
* Reconcile DOM mutations

---

### lextrix-core

Responsible for editor orchestration.

Key concepts:

* Editor
* Lextrix
* ChangeApplier
* PluginHost
* Selection

Responsibilities:

* Apply changes
* Coordinate modules and plugins
* Manage selection state
* Expose public APIs

---

## Change Engine

The change engine is the canonical representation of document modifications.

Primary abstractions:

```text
ChangeSet
    │
    ▼
DocumentOperation
    │
    ▼
OperationStream
```

### ChangeSet

Public API used by editor consumers.

Represents a sequence of operations such as:

* Insert
* Delete
* Retain

### DocumentOperation

Internal operation model used throughout the change pipeline.

Responsibilities:

* Operation normalization
* Operation coalescing
* Transformation processing

### OperationStream

Sequential operation traversal mechanism used by:

* `compose()`
* `diff()`
* `transform()`
* `invert()`

The stream abstraction allows algorithms to operate independently of public serialization formats.

See also: [ChangeSet guide](../guides/change-set.md).

---

## Document Model

Lextrix maintains a hierarchical document structure.

```text
Scroll
 ├── Block
 │     ├── Inline
 │     │      └── Text
 │     └── Embed
 └── ...
```

The document model provides:

* Structural ownership
* Traversal
* Formatting boundaries
* DOM synchronization anchors

Each node maintains relationships with:

* Parent
* Previous sibling
* Next sibling

allowing efficient structural operations.

---

## Formatting System

Formatting is managed through a registry-driven definition system.

Core components:

```text
FormatDefinitionCatalog
        │
        ▼
FormatRegistry
        │
        ▼
Format Resolution
        │
        ▼
Document Updates
```

Responsibilities:

* Format registration
* Format lookup
* Attribute handling
* Format mutation

Supported format categories include:

* Inline formats
* Block formats
* Attribute formats
* Embeds

Format metadata is maintained separately from execution logic, allowing formats to be discovered and registered consistently.

See also: [Format author guide](../guides/formats.md), [Registry guide](../guides/registry.md).

---

## Registry System

The registry is responsible for resolving editor definitions.

Key components:

* FormatRegistry
* DefinitionCatalog
* NodeResolver
* NodeInstantiator

Responsibilities:

* Register formats
* Resolve formats
* Create editor nodes
* Map DOM elements to editor structures

The registry acts as the central discovery mechanism for editor extensions.

---

## Selection System

The selection system separates browser integration from document mapping.

```text
Browser Selection
        │
        ▼
NativeSelectionBridge
        │
        ▼
DocumentIndexMapper
        │
        ▼
Selection
```

### NativeSelectionBridge

Handles browser-specific behavior:

* Reading native selections
* Writing native selections
* Focus management
* Selection normalization

### DocumentIndexMapper

Converts between:

* Document positions
* DOM positions
* Visual bounds

### Selection

Coordinates:

* Editor events
* Cursor lifecycle
* Change notifications

---

## DOM Synchronization

Lextrix continuously synchronizes document state with browser DOM state.

Core components:

* MutationCoordinator
* ParentMutationSync
* TextNodeSync

Responsibilities:

* Observe browser mutations
* Reconcile editor structure
* Normalize text nodes
* Trigger optimization passes

The synchronization pipeline ensures consistency between the internal document model and the rendered DOM.

---

## Plugin System

Lextrix supports extension through plugins and modules.

```text
PluginHost
      │
      ├── History
      ├── Keyboard
      ├── Clipboard
      └── Custom Plugins
```

### PluginHost

Canonical owner of plugin instances.

Responsibilities:

* Plugin registration
* Plugin lifecycle
* Plugin lookup
* Plugin coordination

Plugins can extend editor behavior without modifying core systems.

See also: [Plugin author guide](../guides/plugins.md), [Modules guide](../guides/modules.md).

---

## Editor Lifecycle

Typical editing flow:

```text
User Action
      │
      ▼
Selection Update
      │
      ▼
Editor Command
      │
      ▼
ChangeSet Creation
      │
      ▼
Change Application
      │
      ▼
Document Update
      │
      ▼
DOM Synchronization
      │
      ▼
Plugin Notifications
```

---

## Design Principles

### Explicit Ownership

Every subsystem has a clear owner.

Examples:

* PluginHost owns plugins.
* MutationCoordinator owns DOM reconciliation.
* Selection owns editor selection lifecycle.

### Separation of Concerns

Browser integration, document management, formatting, and change processing are isolated into dedicated subsystems.

### Extensibility

Formats, modules, and plugins can be registered without modifying editor internals.

### Predictability

Changes flow through a consistent pipeline, ensuring deterministic editor behavior.

---

## Extension Points

The primary extension mechanisms are:

* Custom formats
* Custom modules
* Custom plugins
* Custom embeds

Most integrations can be implemented without modifying Lextrix core packages.

| Mechanism | Guide |
|-----------|-------|
| Formats | [formats.md](../guides/formats.md) |
| Modules / plugins | [plugins.md](../guides/plugins.md) |
| Embeds | [custom-embeds.md](../guides/custom-embeds.md) |
| Registration | [registry.md](../guides/registry.md) |

---

## Repository Entry Points

New contributors should start with:

1. Change Engine (`packages/change`)
2. Core Editor (`packages/core`)
3. Formatting (`packages/formats`)
4. DOM Layer (`packages/dom`)
5. Plugin System (`packages/core/src/core/plugins`)

These areas provide the clearest introduction to how Lextrix works internally.

Monorepo development: [.github/DEVELOPMENT.md](../../.github/DEVELOPMENT.md).

---

## Summary

Lextrix is organized around five major subsystems:

* Change Engine
* Document Model
* Formatting
* Selection
* Plugins

Together these systems provide a modular and extensible foundation for building rich-text editing experiences while maintaining a clear separation between document state, DOM synchronization, and editor behavior.
