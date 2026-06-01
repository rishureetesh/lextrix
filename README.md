# Lextrix

Rich text editor built around blots and change-sets. Monorepo for the core
packages; apps install `lextrix`.

Docs: [docs/](./docs/README.md)

## Packages

| Package | Description |
|---------|-------------|
| `lextrix` | Full editor bundle (UMD + CSS) |
| `lextrix-change` | Change-set / OT (`ChangeSet`, `ChangeOp`) |
| `lextrix-dom` | Document model (`Dom` facade) |
| `lextrix-core` | Blots, editor shell, selection |
| `lextrix-formats` | Built-in formats (bold, lists, headers, …) |
| `lextrix-modules` | Modules (clipboard, keyboard, toolbar, …) |
| `lextrix-ui` | Toolbar UI components and icons |
| `lextrix-themes` | Snow, bubble, slate, and dawn themes |

## Quick start

```javascript
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

const editor = new Lextrix('#editor', {
  theme: 'snow',
  modules: {
    toolbar: [['bold', 'italic'], ['link', 'image'], ['clean']],
    imageResize: true,
  },
});
```

See [docs/quick-start.md](./docs/quick-start.md) for more examples.

## Plug-and-play registration

```javascript
import Lextrix, { registerBlots } from 'lextrix-core';
import { registerFormats } from 'lextrix-formats';
import { registerCoreModules, registerOptionalModules } from 'lextrix-modules';
import { registerUI } from 'lextrix-ui';
import { registerThemes } from 'lextrix-themes';

registerBlots(Lextrix);
registerFormats(Lextrix);
registerCoreModules(Lextrix);
registerOptionalModules(Lextrix); // toolbar, syntax, table, imageResize
registerUI(Lextrix);
registerThemes(Lextrix);
```

Or use the full bundle:

```javascript
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

const editor = new Lextrix('#editor', { theme: 'snow' });
```

## Development

```bash
npm install
npm run build          # production UMD + CSS bundle
npm run dev            # Vite demo → http://localhost:5173
npm run dev:bundle     # webpack dev server → http://localhost:8080
npm test               # unit + change tests
```

## License

MIT. See [LICENSE](./LICENSE). Runtime deps in [NOTICE.md](./NOTICE.md).
