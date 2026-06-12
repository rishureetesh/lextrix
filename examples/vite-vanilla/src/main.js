import Lextrix from 'lextrix';
import 'lextrix/snow.css';

const mount = document.getElementById('editor-mount');
const output = document.getElementById('export-output');

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

editor.importContent('# Hello Lextrix\n\nEdit this document, then check the export below.', 'markdown');

function refreshExport() {
  const warnings = editor.getExportWarnings('markdown');
  const md = editor.exportContent('markdown');
  const warnText =
    warnings.length > 0
      ? `\n\n<!-- warnings: ${warnings.map((w) => w.message).join('; ')} -->`
      : '';
  output.textContent = md + warnText;
}

editor.on('text-change', (delta, oldDelta, source) => {
  if (source === 'user') {
    refreshExport();
  }
});

refreshExport();
