const themeSelect = document.getElementById('theme-select');
const themeCss = document.getElementById('theme-css');
const editorMount = document.getElementById('editor-mount');

function toolbarFor(theme) {
  if (theme === 'bubble') {
    return [
      ['bold', 'italic', 'link'],
      [{ header: 1 }, { header: 2 }, 'blockquote'],
    ];
  }
  return [
    [{ header: [1, 2, 3, 4, 5, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }, 'font'],
    ['blockquote', 'code-block'],
    ['link', 'image'],
    ['clean'],
  ];
}

const defaultContents = () => [
  { insert: 'Hello Lextrix\n', attributes: { header: 1 } },
  {
    insert: `Lextrix demo (${themeSelect.value})\n`,
  },
];

// Theme switch rebuilds #editor-mount so old toolbar nodes don't stick around.
function createEditor(theme, contents) {
  editorMount.replaceChildren();
  const container = document.createElement('div');
  container.id = 'editor';
  editorMount.appendChild(container);

  const editor = new Lextrix(container, {
    theme,
    placeholder: 'Write something…',
    modules: {
      toolbar: toolbarFor(theme),
      imageResize: true,
    },
  });
  editor.setContents(contents ?? defaultContents());
  return editor;
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

let editor = createEditor(themeSelect.value);

themeSelect.addEventListener('change', async () => {
  const theme = themeSelect.value;
  const contents = editor.getContents();
  await loadThemeCss(theme);
  editor = createEditor(theme, contents);
});

export default editor;
