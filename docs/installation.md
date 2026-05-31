# Installation

## npm (recommended)

Install the published package:

```bash
npm install lextron
```

Import the editor and a theme stylesheet:

```javascript
import Lextron from 'lextron';
import 'lextron/snow.css';
```

### Exports

| Import | Purpose |
|--------|---------|
| `lextron` | Full editor (UMD default export) |
| `lextron/core` | Core-only bundle (no formats/themes) |
| `lextron/lextron.css` | Base editor styles |
| `lextron/snow.css` | Snow theme |
| `lextron/bubble.css` | Bubble theme |
| `lextron/slate.css` | Dark slate theme |
| `lextron/dawn.css` | Warm dawn theme |

## Script tag (bundle)

After `npm run build` in this repo, use files from `packages/lextron/dist/dist/`:

```html
<link href="lextron.core.css" rel="stylesheet" />
<link href="lextron.snow.css" rel="stylesheet" />
<script src="lextron.js"></script>
<script>
  const editor = new Lextron('#editor', { theme: 'snow' });
</script>
```

## Peer dependencies (optional features)

| Feature | Required on page |
|---------|------------------|
| Syntax highlighting | [highlight.js](https://highlightjs.org/) |
| Formulas | [KaTeX](https://katex.org/) |

These are only needed when you enable `modules.syntax` or use the formula toolbar button.

## Browser support

Node **≥ 18**, npm **≥ 8.2.3**. The editor targets modern evergreen browsers (see `browserslist` in `packages/lextron/package.json`).
