# Lextrix documentation

Guides for integrating Lextrix into your application.

| Guide | Description |
|-------|-------------|
| [Installation](./installation.md) | npm, CDN-style bundle, CSS |
| [Quick start](./quick-start.md) | Minimal editor setup |
| [Configuration](./configuration.md) | Modules, formats, themes, upload |
| [API reference](./api.md) | Common editor methods |
| [Modules](./modules.md) | Toolbar, syntax, table, image resize, … |

## Package overview

```
lextrix     ← publishable bundle (use this in apps)
├── lextrix-core     ← editor shell
├── lextrix-change   ← ChangeSet / OT
├── lextrix-dom      ← blot model
├── lextrix-formats  ← bold, image, lists, …
├── lextrix-modules  ← clipboard, keyboard, toolbar, …
├── lextrix-ui       ← toolbar widgets
└── lextrix-themes   ← snow, bubble, slate, dawn
```

For monorepo development see [.github/DEVELOPMENT.md](../.github/DEVELOPMENT.md).
