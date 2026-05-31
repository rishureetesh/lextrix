# Lextron

Rich text editor built around blots and change-sets. Monorepo for the core
packages; apps install `@reetesh/lextron`.

Docs: [docs/](./docs/README.md)

## Packages

| Package | Description |
|---------|-------------|
| `@reetesh/lextron` | Full editor bundle (UMD + CSS) |
| `lextron-change` | Change-set / OT (`ChangeSet`, `ChangeOp`) |
| `lextron-dom` | Document model (`Dom` facade) |
| `lextron-core` | Blots, editor shell, selection |
| `lextron-formats` | Built-in formats (bold, lists, headers, …) |
| `lextron-modules` | Modules (clipboard, keyboard, toolbar, …) |
| `lextron-ui` | Toolbar UI components and icons |
| `lextron-themes` | Snow, bubble, slate, and dawn themes |

## Quick start

```javascript
import Lextron from '@reetesh/lextron';
import '@reetesh/lextron/snow.css';

const editor = new Lextron('#editor', {
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
import Lextron, { registerBlots } from 'lextron-core';
import { registerFormats } from 'lextron-formats';
import { registerCoreModules, registerOptionalModules } from 'lextron-modules';
import { registerUI } from 'lextron-ui';
import { registerThemes } from 'lextron-themes';

registerBlots(Lextron);
registerFormats(Lextron);
registerCoreModules(Lextron);
registerOptionalModules(Lextron); // toolbar, syntax, table, imageResize
registerUI(Lextron);
registerThemes(Lextron);
```

Or use the full bundle:

```javascript
import Lextron from '@reetesh/lextron';
import '@reetesh/lextron/snow.css';

const editor = new Lextron('#editor', { theme: 'snow' });
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
