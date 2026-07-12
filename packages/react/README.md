# @lextrix/react

Official React bindings for [Lextrix](https://iamreetesh.com/lextrix).

## Install

```bash
npm install lextrix @lextrix/react react react-dom
```

`lextrix` is a **peer dependency** — you install both packages. `@lextrix/react` does not bundle the editor.

## Quick start

```tsx
import { LextrixEditor } from '@lextrix/react';
import 'lextrix/snow.css';

export function Editor() {
  return (
    <LextrixEditor
      theme="snow"
      defaultValue="# Hello\n"
      format="markdown"
      onChange={(markdown) => console.log(markdown)}
      style={{ minHeight: 280 }}
    />
  );
}
```

## Controlled mode

```tsx
const [markdown, setMarkdown] = useState('# Title\n');

<LextrixEditor
  value={markdown}
  format="markdown"
  onChange={setMarkdown}
  options={{
    placeholder: 'Write here…',
    modules: { toolbar: [['bold', 'italic'], ['link']] },
  }}
/>
```

## Imperative handle

```tsx
const ref = useRef<LextrixEditorHandle>(null);

<LextrixEditor ref={ref} onReady={(editor) => editor.focus()} />;

ref.current?.exportContent('markdown');
ref.current?.getEditor()?.getModule('history')?.undo();
```

## Next.js App Router

The component includes `'use client'`. Import it only from client components:

```tsx
'use client';

import { LextrixEditor } from '@lextrix/react';
import 'lextrix/snow.css';
```

## Options and remounting

`options` are applied **on mount only**. To change modules or placeholder after init, remount with a new `key`:

```tsx
<LextrixEditor key={theme} theme={theme} options={options} />
```

`theme` changes remount automatically.

## License

MIT — see [LICENSE](../../LICENSE) in the monorepo root.
