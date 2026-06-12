# Framework integration

Lextrix is a **DOM-based editor class**, not a React/Vue component. Mount it on an element with `new Lextrix(container, options)` inside a client-only lifecycle hook.

## npm package layout

| Import | When to use |
|--------|-------------|
| `import Lextrix from 'lextrix'` | Default — bundlers (Vite, Next, webpack) resolve the **ESM** build |
| `import { ChangeSet, registerSerializer, lxrPath } from 'lextrix'` | Named APIs (ESM build, 2.0.1+) |
| `import 'lextrix/snow.css'` | Theme stylesheet (required) |
| Script tag `lextrix.js` | UMD global `window.Lextrix` — no named imports |

Always import a theme CSS file. The editor does not inject styles.

### npm vs monorepo

| Need | npm (`lextrix`) | Monorepo (clone repo) |
|------|-----------------|------------------------|
| Editor + themes + serialization | Yes | Yes |
| `ChangeSet`, `registerSerializer`, `lxrPath` | `import { … } from 'lextrix'` | Same, or `lextrix-change` / `lextrix-core` |
| `defineInlineTagFormat`, custom blots | Register your own blot class + `Lextrix.register()` | Import from `lextrix-formats` |
| Headless serialize only | Use editor APIs, or clone repo for `lextrix-serialize` | `import from 'lextrix-serialize'` |

Lextrix requires a browser (`document`). Do not import it in server components or SSR routes without a client-only wrapper.

**Toolbar / theme bugs?** Read [DOM mounting](./dom-mounting.md) first — call `editor.destroy()` on remount; the auto toolbar lives **inside** the mount element (2.0.1+).

---

## React (Vite, CRA, etc.)

Use a **wrapper ref** you clear on teardown. Pass a **fresh inner div** to `new Lextrix()`.

```tsx
'use client'; // Next.js App Router only — omit in plain Vite/React SPA

import { useEffect, useRef } from 'react';
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

export default function LextrixEditor() {
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

### Theme switch (same wrapper pattern)

```tsx
useEffect(() => {
  const wrapper = wrapperRef.current;
  if (!wrapper) return;

  const mount = document.createElement('div');
  wrapper.appendChild(mount);

  const editor = new Lextrix(mount, { theme, modules: { toolbar: [...] } });
  if (initialContents) editor.setContents(initialContents);

  return () => {
    editor.destroy();
    wrapper.replaceChildren();
  };
}, [theme]);
```

See [Themes](./themes.md).

### Controlled content / serialization

```tsx
useEffect(() => {
  const wrapper = wrapperRef.current;
  if (!wrapper) return;

  const mount = document.createElement('div');
  wrapper.appendChild(mount);

  const editor = new Lextrix(mount, { theme: 'snow' });
  if (initialMarkdown) editor.importContent(initialMarkdown, 'markdown');

  const onChange = () => onSave(editor.exportContent('markdown'));
  editor.on('text-change', onChange);

  return () => {
    editor.off('text-change', onChange);
    editor.destroy();
    wrapper.replaceChildren();
  };
}, []);
```

---

## Next.js (App Router)

1. Put the editor in a **`'use client'`** component (see above).
2. Load it with **`dynamic` and `ssr: false`** so Lextrix never runs on the server.

```tsx
// app/playground/page.tsx
import dynamic from 'next/dynamic';

const LextrixEditor = dynamic(() => import('@/components/lextrix-editor'), {
  ssr: false,
  loading: () => <p>Loading editor…</p>,
});

export default function PlaygroundPage() {
  return (
    <main>
      <h1>Lextrix playground</h1>
      <LextrixEditor />
    </main>
  );
}
```

### Common Next.js mistakes

| Mistake | Result |
|---------|--------|
| `import Lextrix from 'lextrix'` in a Server Component | `document is not defined` |
| `import { Lextrix } from 'lextrix'` | `undefined` — use **default** import |
| `<Lextrix />` or `<LextrixEditor />` when import failed | “Element type is invalid… got: undefined” |
| Forgetting theme CSS | Unstyled / broken toolbar |
| Clearing only mount div on teardown | Duplicate toolbars — [DOM mounting](./dom-mounting.md) |

### MDX docs / playgrounds

Register your wrapper in the MDX provider:

```tsx
import LextrixEditor from '@/components/lextrix-editor';

const components = { LextrixEditor };

<MDXProvider components={components}>{children}</MDXProvider>
```

Then use `<LextrixEditor />` in MDX — not `<Lextrix />`.

---

## Vue 3

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

const wrapper = ref(null);
let editor = null;

onMounted(() => {
  if (!wrapper.value) return;
  const mount = document.createElement('div');
  wrapper.value.appendChild(mount);
  editor = new Lextrix(mount, {
    theme: 'snow',
    modules: { toolbar: [['bold', 'italic'], ['clean']] },
  });
});

onBeforeUnmount(() => {
  editor?.destroy();
  wrapper.value?.replaceChildren();
  editor = null;
});
</script>

<template>
  <div ref="wrapper" />
</template>
```

---

## Script tag (no bundler)

Use the published package from **npm** or a **CDN**. After `npm install lextrix`, files are in `node_modules/lextrix/dist/dist/`.

**From npm (local static server):**

```html
<link rel="stylesheet" href="node_modules/lextrix/dist/dist/lextrix.snow.css" />
<div id="editor"></div>
<script src="node_modules/lextrix/dist/dist/lextrix.js"></script>
<script>
  const editor = new Lextrix('#editor', { theme: 'snow' });
</script>
```

**From jsDelivr CDN** (replace `2.0.2` with the version you want):

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lextrix@2.0.2/dist/dist/lextrix.snow.css" />
<div id="editor"></div>
<script src="https://cdn.jsdelivr.net/npm/lextrix@2.0.2/dist/dist/lextrix.js"></script>
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
