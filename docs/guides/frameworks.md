# Framework integration

Lextrix is a **DOM-based editor**. Vanilla apps call `new Lextrix(container, options)`. React apps should use **[`@lextrix/react`](./react.md)** (`LextrixEditor`).

## npm package layout

| Package / import | When to use |
|------------------|-------------|
| `lextrix` | Core editor (required for everyone) |
| `@lextrix/react` | Official React component — install **with** `lextrix` |
| `import Lextrix from 'lextrix'` | Bundlers resolve the **ESM** build |
| `import { ChangeSet, registerSerializer, lxrPath } from 'lextrix'` | Named APIs |
| `import 'lextrix/snow.css'` | Theme stylesheet (required) |
| Script tag `lextrix.js` | UMD global `window.Lextrix` |

Always import a theme CSS file. The editor does not inject styles.

### npm vs monorepo

| Need | npm | Monorepo (clone repo) |
|------|-----|------------------------|
| Editor + themes + serialization | `lextrix` | Same |
| React component | `lextrix` + `@lextrix/react` | `packages/react` |
| `ChangeSet`, `registerSerializer`, `lxrPath` | `import { … } from 'lextrix'` | Same |
| Custom blots | `Lextrix.register()` | Or import from `lextrix-formats` |
| Headless serialize only | Editor APIs, or clone for `lextrix-serialize` | `lextrix-serialize` |

Lextrix requires a browser (`document`). Do not import it in Server Components without a client-only boundary.

**Toolbar / remount bugs?** Read [DOM mounting](./dom-mounting.md) — call `editor.destroy()` (or use `@lextrix/react`, which does this for you).

---

## React

**Recommended:** [`@lextrix/react`](./react.md)

```bash
npm install lextrix @lextrix/react
```

```tsx
import { LextrixEditor } from '@lextrix/react';
import 'lextrix/snow.css';

<LextrixEditor theme="snow" defaultValue="# Hello\n" format="markdown" />;
```

### Manual mount (advanced)

Only if you cannot use `@lextrix/react`. Use a **wrapper ref**, a **fresh inner div**, and `destroy()` on teardown.

```tsx
'use client'; // Next.js App Router only

import { useEffect, useRef } from 'react';
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

export default function ManualEditor() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const mount = document.createElement('div');
    wrapper.appendChild(mount);

    const editor = new Lextrix(mount, {
      theme: 'snow',
      placeholder: 'Start writing…',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline'],
          [{ header: [1, 2, false] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'clean'],
        ],
      },
    });

    editor.setContents([{ insert: 'Hello Lextrix\n' }]);

    return () => {
      editor.destroy();
      wrapper.replaceChildren();
    };
  }, []);

  return <div ref={wrapperRef} className="lxr-mount" />;
}
```

**Do not** render `<Lextrix />` — `Lextrix` is a class, not a React component.

For theme switching and controlled Markdown, prefer [`LextrixEditor`](./react.md) with a remount `key` instead of hand-rolling effects.

See [Themes](./themes.md) · [React guide](./react.md).

---

## Next.js App Router

Use `@lextrix/react` from a **client** component (it includes `'use client'`):

```tsx
'use client';

import { LextrixEditor } from '@lextrix/react';
import 'lextrix/snow.css';

export default function PageEditor() {
  return <LextrixEditor theme="snow" format="markdown" />;
}
```

Optional lazy load:

```tsx
import dynamic from 'next/dynamic';

const LextrixEditor = dynamic(
  () => import('@lextrix/react').then((m) => m.LextrixEditor),
  { ssr: false },
);
```

Do not import `lextrix` or `@lextrix/react` in Server Components.

---

## Vue 3

```vue
<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

const wrapper = ref(null);
let editor;

onMounted(() => {
  const mount = document.createElement('div');
  wrapper.value.appendChild(mount);
  editor = new Lextrix(mount, {
    theme: 'snow',
    modules: { toolbar: [['bold', 'italic'], ['link']] },
  });
});

onBeforeUnmount(() => {
  editor?.destroy();
  wrapper.value?.replaceChildren();
});
</script>

<template>
  <div ref="wrapper" />
</template>
```

---

## Script tag (no bundler)

Use the published package from **npm** or a **CDN**. After `npm install lextrix`, files are at the package root (e.g. `node_modules/lextrix/lextrix.snow.css`).

**From npm (local static server):**

```html
<link rel="stylesheet" href="node_modules/lextrix/lextrix.snow.css" />
<div id="editor"></div>
<script src="node_modules/lextrix/lextrix.js"></script>
<script>
  const editor = new Lextrix('#editor', { theme: 'snow' });
</script>
```

**From jsDelivr CDN** (pin the version you use):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lextrix@2.0.5/lextrix.snow.css" />
<div id="editor"></div>
<script src="https://cdn.jsdelivr.net/npm/lextrix@2.0.5/lextrix.js"></script>
<script>
  const editor = new Lextrix('#editor', { theme: 'snow' });
</script>
```

UMD exposes `window.Lextrix` only. Named exports (`ChangeSet`, `registerSerializer`, …) require a bundler and the ESM entry (`import Lextrix from 'lextrix'`).

---

## Migrating from Quill

| Quill | Lextrix |
|-------|---------|
| `new Quill(el, opts)` | `new Lextrix(el, opts)` |
| `quill.getContents()` (Delta) | `editor.getContents()` (ChangeSet) |
| `quill.root.innerHTML` | `editor.exportContent('html')` |
| `import 'quill/dist/quill.snow.css'` | `import 'lextrix/snow.css'` |
| Delta | **ChangeSet** (same JSON shape, different name) |

See [change-set.md](./change-set.md) and [serialization.md](./serialization.md).
