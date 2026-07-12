# React integration

Use **`@lextrix/react`** for a typed component with correct mount/teardown. Install **both** packages:

```bash
npm install lextrix @lextrix/react react react-dom
```

Import a theme stylesheet (required):

```ts
import 'lextrix/snow.css';
```

## `LextrixEditor`

```tsx
'use client'; // Next.js App Router only

import { useState } from 'react';
import { LextrixEditor } from '@lextrix/react';
import 'lextrix/snow.css';

export function BlogEditor() {
  const [body, setBody] = useState('# Draft\n');

  return (
    <LextrixEditor
      theme="snow"
      format="markdown"
      value={body}
      onChange={setBody}
      options={{
        placeholder: 'Write your post…',
        modules: {
          toolbar: [['bold', 'italic'], ['link', 'image'], ['clean']],
          imageResize: true,
        },
      }}
      style={{ minHeight: 320 }}
    />
  );
}
```

### Props

| Prop | Description |
|------|-------------|
| `theme` | `snow`, `bubble`, `slate`, `dawn` — changing remounts the editor |
| `options` | `LextrixOptions` (minus `theme`); applied on **mount only** |
| `value` / `defaultValue` | Document string in `format` |
| `format` | `html` \| `markdown` \| `mdx` \| `json` (default `html`) |
| `onChange` | `(content, source) => void` after user edits |
| `onSelectionChange` | Lextrix selection event |
| `onReady` | `(editor) => void` once after create |
| `className` / `style` | Wrapper element |

### Ref handle

```tsx
import { useRef } from 'react';
import type { LextrixEditorHandle } from '@lextrix/react';

const ref = useRef<LextrixEditorHandle>(null);

<LextrixEditor ref={ref} onReady={(e) => e.focus()} />;

ref.current?.exportContent('markdown');
ref.current?.getEditor()?.getModule('history')?.undo();
```

## Remounting when options change

`options` are not deep-watched. Remount with `key` when modules or placeholder change:

```tsx
<LextrixEditor key={locale} options={{ placeholder: t('placeholder') }} />
```

## Next.js

- Component ships with `'use client'`
- Do not import `lextrix` or `@lextrix/react` in Server Components
- Dynamic import optional if you need to defer CSS:

```tsx
import dynamic from 'next/dynamic';

const LextrixEditor = dynamic(
  () => import('@lextrix/react').then((m) => m.LextrixEditor),
  { ssr: false },
);
```

## Manual integration (no wrapper)

See [Framework integration](./frameworks.md#react-vite-cra-etc) for the wrapper-ref pattern behind this component.

## Example app

```bash
npm run build
npm run example:react
```

Source: [`examples/vite-react`](../../examples/vite-react).
