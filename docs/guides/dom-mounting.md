# DOM mounting (read this first)

Lextrix is not a single DOM node. Understanding the layout prevents duplicate toolbars and leaked listeners.

## What Lextrix creates

When you call `new Lextrix(mountElement, options)`:

1. **`mountElement`** becomes `editor.container` (class `lxr-container`).
2. If `modules.toolbar` is an **array**, Lextrix adds **`div.lxr-toolbar`** as the **first child** of `mountElement` (since 2.0.1).
3. Inside `mountElement`, **`div.lxr-editor`** holds the editable surface.

```
div (mountElement — passed to new Lextrix)
├── div.lxr-toolbar      ← when toolbar is a config array
└── div.lxr-editor       ← editable area
```

Older 2.0.0 inserted the toolbar as a **sibling before** the mount node. Upgrade to **2.0.1+** if you still see stacked toolbars outside the mount.

## Cleanup

### Preferred: `editor.destroy()`

```javascript
const editor = new Lextrix(mount, { theme: 'snow', modules: { toolbar: [...] } });

// theme switch, route leave, React unmount
editor.destroy();
```

`destroy()` removes the auto-created toolbar, clears theme `document.body` listeners, drops emitter handlers, and runs `mountElement.replaceChildren()`.

### Manual: clear the mount element

```javascript
mount.replaceChildren(); // removes toolbar + editor inside mount (2.0.1+)
```

### React wrapper pattern

Still use an outer **wrapper** you control — especially when swapping themes or remounting:

```tsx
const wrapperRef = useRef<HTMLDivElement>(null);
const editorRef = useRef<Lextrix | null>(null);

useEffect(() => {
  const wrapper = wrapperRef.current;
  if (!wrapper) return;

  const mount = document.createElement('div');
  wrapper.appendChild(mount);

  const editor = new Lextrix(mount, { theme, modules: { toolbar: [...] } });
  editorRef.current = editor;

  return () => {
    editor.destroy();
    editorRef.current = null;
    wrapper.replaceChildren();
  };
}, [theme]);
```

## Custom toolbar element

| `modules.toolbar` | Toolbar location |
|-------------------|------------------|
| Array `[['bold'], …]` | Auto `div.lxr-toolbar` inside mount |
| `'#my-toolbar'` | Your existing element |
| `{ container: HTMLElement }` | Your element |

You manage cleanup for custom toolbar DOM.

## Theme CSS

Load one theme CSS file (`import 'lextrix/snow.css'`). When switching themes at runtime, swap CSS then `destroy()` + recreate. See [Themes](./themes.md).

## Peer dependencies

| Feature | Requires | If missing (2.0.1+) |
|---------|----------|---------------------|
| Formula button | [KaTeX](https://katex.org/) on `window.katex` | Button hidden; paste/import shows LaTeX source |
| Syntax highlighting | [highlight.js](https://highlightjs.org/) | Module no-ops; code blocks work unhighlighted |

## Markdown export warnings

Before `exportContent('markdown'|'mdx')`:

```javascript
const warnings = editor.getExportWarnings('markdown');
// e.g. native tables (blocked), color/align (lossy)
```

Native editor tables still **throw** on export — use HTML or check warnings first.
