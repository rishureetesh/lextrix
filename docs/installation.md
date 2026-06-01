# Installation

## npm (recommended)

Install the published package:

```bash
npm install lextrix
```

Import the editor and a theme stylesheet:

```javascript
import Lextrix from 'lextrix';
import 'lextrix/snow.css';
```

### Exports

| Import | Purpose |
|--------|---------|
| `lextrix` | Full editor (UMD default export) |
| `lextrix/core` | Core-only bundle (no formats/themes) |
| `lextrix/lextrix.css` | Base editor styles |
| `lextrix/snow.css` | Snow theme |
| `lextrix/bubble.css` | Bubble theme |
| `lextrix/slate.css` | Dark slate theme |
| `lextrix/dawn.css` | Warm dawn theme |

## Script tag (bundle)

After `npm run build` in this repo, use files from `packages/lextrix/dist/dist/`:

```html
<link href="lextrix.core.css" rel="stylesheet" />
<link href="lextrix.snow.css" rel="stylesheet" />
<script src="lextrix.js"></script>
<script>
  const editor = new Lextrix('#editor', { theme: 'snow' });
</script>
```

## Peer dependencies (optional features)

| Feature | Required on page |
|---------|------------------|
| Syntax highlighting | [highlight.js](https://highlightjs.org/) |
| Formulas | [KaTeX](https://katex.org/) |

These are only needed when you enable `modules.syntax` or use the formula toolbar button.

## Browser support

Node **≥ 18**, npm **≥ 8.2.3**. The editor targets modern evergreen browsers (see `browserslist` in `packages/lextrix/package.json`).
