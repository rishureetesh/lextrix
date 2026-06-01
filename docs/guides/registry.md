# Registry guide

Lextrix extensions register through **`Lextrix.register()`** using canonical **`lxr/*` import paths**.

## Path helpers

```javascript
import { lxrPath } from 'lextrix-core/registry-paths.js';

lxrPath.format('callout');           // lxr/formats/callout
lxrPath.module('mentions');         // lxr/modules/mentions
lxrPath.blot('scroll');             // lxr/blots/scroll
lxrPath.theme('snow');              // lxr/themes/snow
lxrPath.attributor('block', 'align'); // lxr/attributors/block/align
```

## Register a format

```javascript
import Lextrix from 'lextrix';
import { lxrPath } from 'lextrix-core/registry-paths.js';
import CalloutBlot from './callout-blot.js';

Lextrix.register({ [lxrPath.format('callout')]: CalloutBlot });
```

## Register a module

```javascript
import Module from 'lextrix-core/core/module.js';

class MentionsModule extends Module {
  constructor(lextrix, options) {
    super(lextrix, options);
    // …
  }
}

Lextrix.register({ [lxrPath.module('mentions')]: MentionsModule });
```

Enable in editor options:

```javascript
new Lextrix('#editor', {
  theme: 'snow',
  modules: { mentions: { trigger: '@' } },
});
```

## Import and legacy paths

`Lextrix.import('change')` and `Lextrix.import('dom')` resolve to internal packages.

These throw at runtime:

- Bare paths: `formats/bold`, `modules/toolbar`
- Legacy keys: `delta`, `parchment`

Use `lxr/*` paths or the `lxrPath` helpers instead.

## How resolution works

The registry in `lextrix-dom` composes:

1. **FormatDefinitionCatalog** — metadata for formats and attributors
2. **Node resolver** — map DOM node → blot class or attributor
3. **Node instantiator** — create blot from tag name or format name
4. **nodeBindings** — WeakMap attaching blots to DOM nodes

See [Architecture — Registry](../architecture/overview.md#registry).

## Modular bundle registration

When building a custom bundle, call registration helpers before creating the editor:

```javascript
import { registerFormats } from 'lextrix-formats';
import { registerCoreModules, registerOptionalModules } from 'lextrix-modules';

registerFormats(Lextrix);
registerCoreModules(Lextrix);
registerOptionalModules(Lextrix);
```

## Further reading

- [Format author guide](./formats.md)
- [Plugin author guide](./plugins.md)
- Source: `packages/core/src/registry-paths.ts`, `packages/dom/src/dom/format-registry.ts`
