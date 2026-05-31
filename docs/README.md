# Lextron documentation

Guides for integrating Lextron into your application.

| Guide | Description |
|-------|-------------|
| [Installation](./installation.md) | npm, CDN-style bundle, CSS |
| [Quick start](./quick-start.md) | Minimal editor setup |
| [Configuration](./configuration.md) | Modules, formats, themes, upload |
| [API reference](./api.md) | Common editor methods |
| [Modules](./modules.md) | Toolbar, syntax, table, image resize, … |

## Package overview

```
lextron              ← publishable bundle (use this in apps)
├── lextron-core     ← editor shell
├── lextron-change   ← ChangeSet / OT
├── lextron-dom      ← blot model
├── lextron-formats  ← bold, image, lists, …
├── lextron-modules  ← clipboard, keyboard, toolbar, …
├── lextron-ui       ← toolbar widgets
└── lextron-themes   ← snow, bubble, slate, dawn
```

For monorepo development see [.github/DEVELOPMENT.md](../.github/DEVELOPMENT.md).
