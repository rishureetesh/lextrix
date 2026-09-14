# lextrix-intelligence

Application-layer **document intelligence** for Lextrix 3.0.

## Purpose

Produce **ChangeProposals** from providers. Never mutates Document / Editor / DOM.

- Deterministic provider (no network) — ideal for demos/tests
- Optional OpenAI provider (`lextrix-intelligence/openai`, fetch-only)
- Provenance, acceptance policy, proposal review helpers

## Install

```bash
npm install lextrix-intelligence lextrix-change
```

```js
import {
  DeterministicDocumentIntelligenceProvider,
  createIntelligenceRequest,
} from 'lextrix-intelligence';
```

OpenAI requires credentials and is **optional**. The playground works without keys.
