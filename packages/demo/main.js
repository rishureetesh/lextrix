import Lextrix from 'lextrix';
import {
  bindDocumentPanel,
  refreshDocumentPanel,
} from './src/platform-panels.js';
import { bindCollabDemo, initCollabDemo } from './src/collab-demo.js';
import { bindInfraDemo } from './src/infra-demo.js';
import { clearError, showError } from './src/ui-helpers.js';

const themeSelect = document.getElementById('theme-select');
const themeCss = document.getElementById('theme-css');
const editorMount = document.getElementById('editor-mount');
const readOnlyToggle = document.getElementById('read-only');
const docMeta = document.getElementById('doc-meta');
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
  html: `<h1>Lextrix 3.0 playground</h1>
<p>Try <strong>bold</strong>, <em>italic</em>, and <a href="https://iamreetesh.com/lextrix">links</a>.</p>
<pre><code class="language-javascript">const editor = new Lextrix('#editor');</code></pre>`,
  markdown: `# Lextrix 3.0 playground

**Bold** and *italic*. Document engine panels below use real APIs.`,
  mdx: `# MDX sample

<Alert type="info">Experimental MDX</Alert>`,
  json: JSON.stringify(
    {
      ops: [
        { insert: 'Lextrix 3.0\n', attributes: { header: 1 } },
        { insert: 'ChangeSet JSON import\n' },
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
        this.lextrix.getModule('table')?.insertTable?.(3, 3);
      },
    },
  };
}

function defaultContents() {
  return [
    { insert: 'Lextrix 3.0 playground\n', attributes: { header: 1 } },
    {
      insert:
        'Rich-text editor + Document / Version / Proposal / Collaboration demos.\n',
    },
    {
      insert:
        'Editor is a projection. Use the panels below to inspect the document engine.\n',
      attributes: { list: 'bullet' },
    },
    { insert: '\n' },
  ];
}

function setError(message) {
  if (!message) {
    clearError();
    return;
  }
  showError(message);
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
  const v = editor.getExperimentalVersion?.();
  docMeta.textContent = v
    ? `Length: ${editor.getLength()} · Version ${v.id} · seq ${v.sequence}`
    : `Length: ${editor.getLength()} chars`;
  refreshDocumentPanel(editor);
}

function loadThemeCss(theme) {
  const href = `/lextrix.${theme}.css`;
  if (themeCss.getAttribute('href') === href) return Promise.resolve();
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
    experimentalDocument: true,
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
    if (format === 'json') editor.setContents(JSON.parse(raw));
    else editor.importContent(raw, format);
    setError(null);
    refreshExport();
    updateMeta();
  } catch (err) {
    setError(`Import failed: ${err.message}`);
  }
}

function loadSample() {
  setError(null);
  importInput.value = SAMPLE[importFormat.value] ?? '';
  handleImport();
}

async function switchTheme(theme) {
  const contents = editor.getContents();
  await loadThemeCss(theme);
  editor = createEditor(theme, contents);
  refreshExport();
}

editor = createEditor(themeSelect.value);
refreshExport();

bindDocumentPanel(() => editor);
bindCollabDemo();
bindInfraDemo();
initCollabDemo().catch(() => {});

themeSelect.addEventListener('change', () => switchTheme(themeSelect.value));
readOnlyToggle.addEventListener('change', () => {
  editor.enable(!readOnlyToggle.checked);
});
importBtn.addEventListener('click', handleImport);
resetBtn.addEventListener('click', loadSample);
insertTableBtn.addEventListener('click', () => {
  try {
    editor.getModule('table')?.insertTable(3, 3);
    refreshExport();
  } catch (err) {
    setError(err.message);
  }
});
refreshExportBtn.addEventListener('click', refreshExport);
exportTabs.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-format]');
  if (!btn) return;
  exportFormat = btn.dataset.format;
  for (const tab of exportTabs.querySelectorAll('button')) {
    const active = tab === btn;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
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

// Expose for playground tests
window.__lextrixPlayground = {
  getEditor: () => editor,
  refreshDocumentPanel: () => refreshDocumentPanel(editor),
};
