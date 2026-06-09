import Lextrix from 'lextrix';

const themeSelect = document.getElementById('theme-select');
const themeCss = document.getElementById('theme-css');
const editorMount = document.getElementById('editor-mount');
const readOnlyToggle = document.getElementById('read-only');
const docMeta = document.getElementById('doc-meta');
const errorBanner = document.getElementById('error-banner');
const warnBanner = document.getElementById('warn-banner');
const importFormat = document.getElementById('import-format');
const importInput = document.getElementById('import-input');
const importBtn = document.getElementById('import-btn');
const resetBtn = document.getElementById('reset-btn');
const insertTableBtn = document.getElementById('insert-table-btn');
const exportTabs = document.getElementById('export-tabs');
const exportOutput = document.getElementById('export-output');
const refreshExportBtn = document.getElementById('refresh-export-btn');
const copyExportBtn = document.getElementById('copy-export-btn');

let editor = null;
let exportFormat = 'html';

const SAMPLE = {
  html: `<h1>Lextrix playground</h1>
<p>Try <strong>bold</strong>, <em>italic</em>, <u>underline</u>, and <a href="https://iamreetesh.com/lextrix">links</a>.</p>
<blockquote>A quote block.</blockquote>
<pre><code class="language-javascript">const editor = new Lextrix('#editor');</code></pre>
<ul><li>Bullet one</li><li>Bullet two</li></ul>`,
  markdown: `# Lextrix playground

**Bold** and *italic* text.

> Blockquote

\`\`\`javascript
console.log('syntax highlighting');
\`\`\`

- Item one
- Item two`,
  mdx: `# MDX sample

<Alert type="info">Experimental MDX component</Alert>

Regular **markdown** still works.`,
  json: JSON.stringify(
    {
      ops: [
        { insert: 'Lextrix JSON\n', attributes: { header: 1 } },
        { insert: 'Import via ' },
        { insert: 'ChangeSet', attributes: { bold: true } },
        { insert: '\n' },
      ],
    },
    null,
    2,
  ),
};

function fullToolbar(theme) {
  if (theme === 'bubble') {
    return {
      container: [
        ['bold', 'italic', 'underline', 'link'],
        [{ header: 1 }, { header: 2 }, 'blockquote', 'code-block'],
        ['image', 'formula'],
      ],
    };
  }
  return {
    container: [
      [{ header: [1, 2, 3, 4, 5, false] }],
      ['bold', 'italic', 'underline', 'strike', { script: 'sub' }, { script: 'super' }],
      [{ color: [] }, { background: [] }],
      [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
      [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
      [{ indent: '-1' }, { indent: '+1' }],
      [{ align: [] }, { direction: 'rtl' }],
      ['blockquote', 'code-block'],
      ['link', 'image', 'video', 'formula', 'table'],
      ['clean'],
    ],
    handlers: {
      table() {
        const mod = this.lextrix.getModule('table');
        if (mod?.insertTable) mod.insertTable(3, 3);
      },
    },
  };
}

function defaultContents() {
  return [
    { insert: 'Lextrix playground\n', attributes: { header: 1 } },
    {
      insert: 'Every module enabled: syntax, table, formula, image resize, full toolbar.\n',
    },
    {
      insert: 'Switch theme or read-only — toolbar stays inside mount; call destroy() on teardown.\n',
      attributes: { list: 'bullet' },
    },
    { insert: '\n' },
  ];
}

function setError(message) {
  if (!message) {
    errorBanner.classList.add('hidden');
    errorBanner.textContent = '';
    return;
  }
  errorBanner.textContent = message;
  errorBanner.classList.remove('hidden');
}

function setWarnings(messages) {
  if (!messages?.length) {
    warnBanner.classList.add('hidden');
    warnBanner.textContent = '';
    return;
  }
  warnBanner.textContent = messages.join(' ');
  warnBanner.classList.remove('hidden');
}

function updateMeta() {
  if (!editor) return;
  docMeta.textContent = `Length: ${editor.getLength()} chars`;
}

function loadThemeCss(theme) {
  const href = `/lextrix.${theme}.css`;
  if (themeCss.getAttribute('href') === href) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    themeCss.onload = () => resolve();
    themeCss.onerror = () => resolve();
    themeCss.href = href;
  });
}

function createEditor(theme, contents) {
  editor?.destroy?.();
  editorMount.replaceChildren();

  const mount = document.createElement('div');
  editorMount.appendChild(mount);

  const instance = new Lextrix(mount, {
    theme,
    placeholder: 'Write something…',
    modules: {
      toolbar: fullToolbar(theme),
      syntax: {
        hljs: window.hljs ?? null,
        languages: [
          { key: 'javascript', label: 'JavaScript' },
          { key: 'typescript', label: 'TypeScript' },
          { key: 'python', label: 'Python' },
          { key: 'html', label: 'HTML' },
          { key: 'css', label: 'CSS' },
        ],
      },
      table: true,
      imageResize: true,
    },
  });

  instance.setContents(contents ?? defaultContents());
  instance.enable(!readOnlyToggle.checked);
  instance.on('text-change', () => {
    updateMeta();
    refreshExport();
  });

  updateMeta();
  return instance;
}

function refreshExport() {
  if (!editor) return;

  let warnings = [];
  try {
    warnings = editor.getExportWarnings?.(exportFormat) ?? [];
    setWarnings(warnings.map((w) => w.message).filter(Boolean));

    if (exportFormat === 'html') {
      exportOutput.textContent = editor.getSemanticHTML();
    } else if (exportFormat === 'json') {
      exportOutput.textContent = JSON.stringify(editor.getContents(), null, 2);
    } else {
      exportOutput.textContent = editor.exportContent(exportFormat);
    }
  } catch (err) {
    exportOutput.textContent = `(export failed: ${err.message})`;
    if (exportFormat === 'markdown' || exportFormat === 'mdx') {
      setWarnings([
        ...warnings.map((w) => w.message).filter(Boolean),
        err.message,
      ]);
    }
  }
}

function handleImport() {
  setError(null);
  const format = importFormat.value;
  const raw = importInput.value.trim();
  if (!raw) {
    setError('Paste content to import.');
    return;
  }
  try {
    if (format === 'json') {
      editor.setContents(JSON.parse(raw));
    } else {
      editor.importContent(raw, format);
    }
    setError(null);
    refreshExport();
    updateMeta();
  } catch (err) {
    setError(`Import failed: ${err.message}`);
  }
}

function loadSample() {
  setError(null);
  const format = importFormat.value;
  importInput.value = SAMPLE[format] ?? '';
  handleImport();
}

function insertTable() {
  setError(null);
  try {
    editor.getModule('table')?.insertTable(3, 3);
    refreshExport();
  } catch (err) {
    setError(`Table insert failed: ${err.message}`);
  }
}

async function switchTheme(theme) {
  const contents = editor.getContents();
  await loadThemeCss(theme);
  editor = createEditor(theme, contents);
  refreshExport();
}

editor = createEditor(themeSelect.value);
refreshExport();

themeSelect.addEventListener('change', () => {
  switchTheme(themeSelect.value);
});

readOnlyToggle.addEventListener('change', () => {
  editor.enable(!readOnlyToggle.checked);
});

importBtn.addEventListener('click', handleImport);
resetBtn.addEventListener('click', loadSample);
insertTableBtn.addEventListener('click', insertTable);
refreshExportBtn.addEventListener('click', refreshExport);

exportTabs.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-format]');
  if (!btn) return;
  exportFormat = btn.dataset.format;
  for (const tab of exportTabs.querySelectorAll('button')) {
    tab.classList.toggle('active', tab === btn);
  }
  refreshExport();
});

copyExportBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(exportOutput.textContent);
    copyExportBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyExportBtn.textContent = 'Copy';
    }, 1200);
  } catch {
    setError('Clipboard copy failed.');
  }
});

importInput.value = SAMPLE.markdown;
