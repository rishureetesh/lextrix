# Installation

## npm (recommended)

Install the published package:

```bash
npm install @reetesh/lextron
```

Import the editor and a theme stylesheet:

```javascript
import Lextron from '@reetesh/lextron';
import '@reetesh/lextron/snow.css';
```

### Exports

| Import | Purpose |
|--------|---------|
| `@reetesh/lextron` | Full editor (UMD default export) |
| `@reetesh/lextron/core` | Core-only bundle (no formats/themes) |
| `@reetesh/lextron/lextron.css` | Base editor styles |
| `@reetesh/lextron/snow.css` | Snow theme |
| `@reetesh/lextron/bubble.css` | Bubble theme |
| `@reetesh/lextron/slate.css` | Dark slate theme |
| `@reetesh/lextron/dawn.css` | Warm dawn theme |

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
