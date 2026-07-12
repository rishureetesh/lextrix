import { useState } from 'react';
import { LextrixEditor } from '@lextrix/react';
import 'lextrix/snow.css';

const INITIAL_MARKDOWN = `# Hello Lextrix

Edit this document in React via **@lextrix/react**. Export updates below.`;

export default function App() {
  const [exported, setExported] = useState(INITIAL_MARKDOWN);

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Lextrix React example</h1>
      <LextrixEditor
        theme="snow"
        format="markdown"
        defaultValue={INITIAL_MARKDOWN}
        onChange={setExported}
        options={{
          placeholder: 'Start writing…',
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline'],
              [{ header: [1, 2, false] }],
              [{ list: 'ordered' }, { list: 'bullet' }],
              ['link', 'clean'],
            ],
          },
        }}
        style={{ minHeight: 240 }}
      />
      <h2>Exported Markdown</h2>
      <pre
        style={{
          background: '#f4f4f4',
          padding: '1rem',
          borderRadius: 4,
          whiteSpace: 'pre-wrap',
        }}
      >
        {exported}
      </pre>
    </main>
  );
}
