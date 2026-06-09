# Themes

Four built-in themes: **snow**, **bubble**, **slate**, **dawn**.

## Install CSS

Themes are separate CSS files. Import exactly one (or swap at runtime):

```javascript
import 'lextrix/snow.css';
// import 'lextrix/bubble.css';
// import 'lextrix/slate.css';
// import 'lextrix/dawn.css';
```

| Theme | Toolbar style | Best for |
|-------|---------------|----------|
| `snow` | Fixed bar above editor | Docs, CMS, classic UI |
| `bubble` | Floating on selection | Comments, inline editing |
| `slate` | Dark snow-like bar | Dark apps |
| `dawn` | Warm palette | Marketing / editorial |

## Basic usage

```javascript
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

const mount = document.createElement('div');
document.getElementById('wrapper').appendChild(mount);

new Lextrix(mount, {
  theme: 'snow',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ header: [1, 2, false] }],
      ['link', 'clean'],
    ],
  },
});
```

Bubble uses a smaller default toolbar set — see [Configuration](./configuration.md#toolbar-buttons).

## Switch theme at runtime

1. Save document: `const contents = editor.getContents()`
2. Load new CSS (replace `<link>` href or dynamic `import()`)
3. **Clear wrapper** (not just the mount div) — see [DOM mounting](./dom-mounting.md)
4. Create fresh inner mount + `new Lextrix(mount, { theme: newTheme, … })`
5. `editor.setContents(contents)`

```javascript
async function switchTheme(wrapper, editor, newTheme) {
  const contents = editor.getContents();
  await loadThemeCss(newTheme); // your helper — swap link href

  wrapper.replaceChildren();
  const mount = document.createElement('div');
  wrapper.appendChild(mount);

  return new Lextrix(mount, {
    theme: newTheme,
    modules: { toolbar: toolbarFor(newTheme) },
  }).setContents(contents);
}
```

### Race conditions

If the user clicks themes quickly:

- **Debounce** or disable buttons while switching
- **Await** CSS load before creating the editor
- Always **`wrapper.replaceChildren()`** before each `new Lextrix` — never stack instances

Duplicate toolbars = cleanup skipped on parent wrapper. Not a Lextrix race bug; a DOM lifecycle bug.

## React example

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

export function ThemedEditor({ theme }: { theme: 'snow' | 'bubble' | 'slate' | 'dawn' }) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    void import(`lextrix/${theme}.css`); // ensure CSS loaded in bundler

    const mount = document.createElement('div');
    wrapper.appendChild(mount);

    const editor = new Lextrix(mount, { theme, modules: { toolbar: [['bold', 'italic']] } });

    return () => wrapper.replaceChildren();
  }, [theme]);

  return <div ref={wrapperRef} />;
}
```

Load theme CSS globally in your app if dynamic `import()` is awkward — swap a single `<link id="lextrix-theme">` in layout.
