# Plugin author guide

Lextrix **modules** are plugins loaded by the active theme and owned by **PluginHost**.

## Minimal module

```javascript
import Module from 'lextrix-core/core/module.js';
import { lxrPath } from 'lextrix-core/registry-paths.js';
import Lextrix from 'lextrix';

class WordCountModule extends Module {
  constructor(lextrix, options) {
    super(lextrix, options);
    lextrix.on('text-change', () => this.update());
  }

  update() {
    const length = this.lextrix.getLength();
    console.log('Document length:', length);
  }
}

Lextrix.register({ [lxrPath.module('wordCount')]: WordCountModule });
```

Enable:

```javascript
new Lextrix('#editor', {
  theme: 'snow',
  modules: { wordCount: true },
});
```

## Lifecycle

```
Lextrix constructor
  → pluginHost = new PluginHost()
  → Theme loads modules from options
  → Theme.addModule() → pluginHost.register(name, instance)
  → pluginHost.bindAll(editor)
```

Access instances:

```javascript
editor.getModule('wordCount');
editor.getModule('toolbar');
```

The `theme.modules` getter returns `pluginHost.asModuleRecord()` for compatibility.

## Module base class

Extend `Module` from `lextrix-core`. The constructor receives `(lextrix, options)`.

`LextrixPlugin` defines optional `bindEditor` / `unbindEditor` for lifecycle hooks; `PluginHost.bindAll` calls them after registration.

## Core vs optional modules

| Set | Package | Examples |
|-----|---------|----------|
| Core | `lextrix-modules` | clipboard, keyboard, history, uploader |
| Optional | `lextrix-modules` | toolbar, syntax, table, imageResize |

Study existing modules in `packages/modules/src/modules/` for patterns (clipboard matchers, keyboard bindings, toolbar handlers).

## Themes

Themes (`lextrix-themes`) decide default module sets and toolbar handlers. Snow theme adds link/image handlers; bubble uses a floating toolbar.

Register a custom theme:

```javascript
import { lxrPath } from 'lextrix-core/registry-paths.js';

Lextrix.register({ [lxrPath.theme('minimal')]: MinimalTheme });
```

## Further reading

- [Modules guide](./modules.md) (consumer configuration)
- [Configuration](./configuration.md)
- [Architecture — Plugin system](../architecture/overview.md#plugin-system)
- Source: `packages/core/src/core/plugins/plugin-host.ts`, `theme.ts`, `module.ts`
