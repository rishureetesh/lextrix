import { useEffect, useRef, useState } from 'react';
import Lextrix from 'lextrix';
import 'lextrix/snow.css';

const INITIAL_MARKDOWN = `# Hello Lextrix

Edit this document in React. Export updates below.`;

export default function App() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [exported, setExported] = useState('');

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

    editor.importContent(INITIAL_MARKDOWN, 'markdown');

    const refresh = () => {
      editor.getExportWarnings('markdown');
      setExported(editor.exportContent('markdown'));
    };

    const onChange = () => refresh();
    editor.on('text-change', onChange);
    refresh();

    return () => {
      editor.off('text-change', onChange);
      editor.destroy();
      wrapper.replaceChildren();
    };
  }, []);

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Lextrix React example</h1>
      <div ref={wrapperRef} />
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
