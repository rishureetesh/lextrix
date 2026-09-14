# Migrating to 2.1.0

2.1.0 is a **non-breaking** reliability release. Upgrade from 2.0.x without API rewrites.

```bash
npm install lextrix@^2.1.0
npm install @lextrix/react@^0.2.0   # React apps only
```

---

## What changed

### Lifecycle (most important for integrators)

- **`editor.destroy()`** now tears down **all** modules via `PluginHost` — not only toolbar and image resize.
- Document-level listeners install on **first** editor and release on **last** destroy (no import-time side effects).
- Remounting React editors or switching themes should no longer leak listeners or duplicate toolbars.

**Action:** If you mount/unmount editors (SPA, tabs, modals), ensure you call `destroy()` on unmount. `@lextrix/react` does this automatically.

### Preferred content APIs

| Old (deprecated) | Use instead |
|------------------|-------------|
| `editor.import(...)` | `editor.importContent(...)` |
| `editor.export(...)` | `editor.exportContent(...)` |

Static `Lextrix.import('lxr/...')` is unchanged — that is the module loader.

### New APIs (optional)

```typescript
// Optional runtimes (KaTeX, highlight.js, imageResize, serializers)
const caps = editor.getCapabilities();

// Safer Markdown/MDX saves
const warnings = editor.getExportWarnings('markdown');

// Safer ChangeSet sharing
const snapshot = editor.getContents().clone().freeze();

// Typed errors
import { InvalidContainerError, UnknownThemeError } from 'lextrix';

// Extension registration (prefer over raw paths)
import { ExtensionHost, Lextrix } from 'lextrix';
ExtensionHost.registerModule(Lextrix, 'myModule', MyModule);
```

### React (`@lextrix/react@0.2.0`)

```tsx
<LextrixEditor readOnly={!canEdit} value={body} onChange={setBody} />

const warnings = ref.current?.getExportWarnings('markdown');
```

Controlled **JSON** updates use `setContents` when the value parses as ChangeSet ops (avoids full round-trip).

---

## Checklist after upgrade

1. Replace `import`/`export` content calls with `importContent`/`exportContent`.
2. Confirm modals/routes call `destroy()` or use `@lextrix/react`.
3. Before Markdown/MDX save, call `getExportWarnings()` and block on `unsupported`.
4. Run your app smoke test: toolbar remount, image resize, code blocks (if using syntax module).

---

## Not in 2.1.0 (planned later)

- Native editor tables → Markdown export
- Removing deprecated content APIs (3.0.0)
- Immutable ChangeSet builders by default (3.0.0)

See [Architecture overview](../architecture/overview.md) for design principles.
