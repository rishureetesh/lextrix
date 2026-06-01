import { merge } from 'lodash-es';
import type Lextrix from 'lextrix-core/core/lextrix.js';
import Emitter from 'lextrix-core/core/emitter.js';
import Theme from 'lextrix-core/core/theme.js';
import type { ThemeOptions } from 'lextrix-core/core/theme.js';
import ColorPicker from 'lextrix-ui/ui/color-picker.js';
import IconPicker from 'lextrix-ui/ui/icon-picker.js';
import Picker from 'lextrix-ui/ui/picker.js';
import Tooltip from 'lextrix-ui/ui/tooltip.js';
import type { Range } from 'lextrix-core/core/selection.js';
import type Clipboard from 'lextrix-modules/modules/clipboard.js';
import type History from 'lextrix-modules/modules/history.js';
import type Keyboard from 'lextrix-modules/modules/keyboard.js';
import type Uploader from 'lextrix-modules/modules/uploader.js';
import type Selection from 'lextrix-core/core/selection.js';

const ALIGNS = [false, 'center', 'right', 'justify'];

const COLORS = [
  '#0f172a',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#8b5cf6',
  '#ffffff',
  '#fecaca',
  '#fed7aa',
  '#fef08a',
  '#bbf7d0',
  '#bfdbfe',
  '#ddd6fe',
  '#cbd5e1',
  '#f87171',
  '#fb923c',
  '#facc15',
  '#4ade80',
  '#60a5fa',
  '#a78bfa',
  '#94a3b8',
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#16a34a',
  '#2563eb',
  '#7c3aed',
  '#64748b',
  '#991b1b',
  '#9a3412',
  '#854d0e',
  '#166534',
  '#1e40af',
  '#5b21b6',
];

const FONTS = [false, 'serif', 'monospace'];

const HEADERS = ['1', '2', '3', '4', '5', false];

const SIZES = ['small', false, 'large', 'huge'];

class BaseTheme extends Theme {
  pickers: Picker[];
  tooltip?: Tooltip;

  constructor(lextrix: Lextrix, options: ThemeOptions) {
    super(lextrix, options);
    const listener = (e: MouseEvent) => {
      if (!document.body.contains(lextrix.root)) {
        document.body.removeEventListener('click', listener);
        return;
      }
      if (
        this.tooltip != null &&
        // @ts-expect-error
        !this.tooltip.root.contains(e.target) &&
        // @ts-expect-error
        document.activeElement !== this.tooltip.textbox &&
        !this.lextrix.hasFocus()
      ) {
        this.tooltip.hide();
      }
      if (this.pickers != null) {
        this.pickers.forEach((picker) => {
          // @ts-expect-error
          if (!picker.container.contains(e.target)) {
            picker.close();
          }
        });
      }
    };
    lextrix.emitter.listenDOM('click', document.body, listener);
  }

  addModule(name: 'clipboard'): Clipboard;
  addModule(name: 'keyboard'): Keyboard;
  addModule(name: 'uploader'): Uploader;
  addModule(name: 'history'): History;
  addModule(name: 'selection'): Selection;
  addModule(name: string): unknown;
  addModule(name: string) {
    const module = super.addModule(name);
    if (name === 'toolbar') {
      // @ts-expect-error
      this.extendToolbar(module);
    }
    return module;
  }

  buildButtons(
    buttons: NodeListOf<HTMLElement>,
    icons: Record<string, Record<string, string> | string>,
  ) {
    Array.from(buttons).forEach((button) => {
      const className = button.getAttribute('class') || '';
      className.split(/\s+/).forEach((name) => {
        if (!name.startsWith('lxr-')) return;
        name = name.slice('lxr-'.length);
        if (icons[name] == null) return;
        if (name === 'direction') {
          // @ts-expect-error
          button.innerHTML = icons[name][''] + icons[name].rtl;
        } else if (typeof icons[name] === 'string') {
          // @ts-expect-error
          button.innerHTML = icons[name];
        } else {
          // @ts-expect-error
          const value = button.value || '';
          // @ts-expect-error
          if (value != null && icons[name][value]) {
            // @ts-expect-error
            button.innerHTML = icons[name][value];
          }
        }
      });
    });
  }

  buildPickers(
    selects: NodeListOf<HTMLSelectElement>,
    icons: Record<string, string | Record<string, string>>,
  ) {
    this.pickers = Array.from(selects).map((select) => {
      if (select.classList.contains('lxr-align')) {
        if (select.querySelector('option') == null) {
          fillSelect(select, ALIGNS);
        }
        if (typeof icons.align === 'object') {
          return new IconPicker(select, icons.align);
        }
      }
      if (
        select.classList.contains('lxr-background') ||
        select.classList.contains('lxr-color')
      ) {
        const format = select.classList.contains('lxr-background')
          ? 'background'
          : 'color';
        if (select.querySelector('option') == null) {
          fillSelect(
            select,
            COLORS,
            format === 'background' ? '#ffffff' : '#000000',
          );
        }
        return new ColorPicker(select, icons[format] as string);
      }
      if (select.querySelector('option') == null) {
        if (select.classList.contains('lxr-font')) {
          fillSelect(select, FONTS);
        } else if (select.classList.contains('lxr-header')) {
          fillSelect(select, HEADERS);
        } else if (select.classList.contains('lxr-size')) {
          fillSelect(select, SIZES);
        }
      }
      return new Picker(select);
    });
    const update = () => {
      this.pickers.forEach((picker) => {
        picker.update();
      });
    };
    this.lextrix.on(Emitter.events.EDITOR_CHANGE, update);
  }
}
BaseTheme.DEFAULTS = merge({}, Theme.DEFAULTS, {
  modules: {
    toolbar: {
      handlers: {
        formula() {
          this.lextrix.theme.tooltip.edit('formula');
        },
        image() {
          let fileInput = this.container.querySelector(
            'input.lxr-image[type=file]',
          );
          if (fileInput == null) {
            fileInput = document.createElement('input');
            fileInput.setAttribute('type', 'file');
            fileInput.setAttribute(
              'accept',
              this.lextrix.uploader.options.mimetypes.join(', '),
            );
            fileInput.classList.add('lxr-image');
            fileInput.addEventListener('change', () => {
              const range = this.lextrix.getSelection(true);
              this.lextrix.uploader.upload(range, fileInput.files);
              fileInput.value = '';
            });
            this.container.appendChild(fileInput);
          }
          fileInput.click();
        },
        video() {
          this.lextrix.theme.tooltip.edit('video');
        },
      },
    },
  },
});

class BaseTooltip extends Tooltip {
  textbox: HTMLInputElement | null;
  linkRange?: Range;

  constructor(lextrix: Lextrix, boundsContainer?: HTMLElement) {
    super(lextrix, boundsContainer);
    this.textbox = this.root.querySelector('input[type="text"]');
    this.listen();
  }

  listen() {
    // @ts-expect-error Fix me later
    this.textbox.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.save();
        event.preventDefault();
      } else if (event.key === 'Escape') {
        this.cancel();
        event.preventDefault();
      }
    });
  }

  cancel() {
    this.hide();
    this.restoreFocus();
  }

  edit(mode = 'link', preview: string | null = null) {
    this.root.classList.remove('lxr-hidden');
    this.root.classList.add('lxr-editing');
    if (this.textbox == null) return;

    if (preview != null) {
      this.textbox.value = preview;
    } else if (mode !== this.root.getAttribute('data-mode')) {
      this.textbox.value = '';
    }
    const bounds = this.lextrix.getBounds(this.lextrix.selection.savedRange);
    if (bounds != null) {
      this.position(bounds);
    }
    this.textbox.select();
    this.textbox.setAttribute(
      'placeholder',
      this.textbox.getAttribute(`data-${mode}`) || '',
    );
    this.root.setAttribute('data-mode', mode);
  }

  restoreFocus() {
    this.lextrix.focus({ preventScroll: true });
  }

  save() {
    // @ts-expect-error Fix me later
    let { value } = this.textbox;
    switch (this.root.getAttribute('data-mode')) {
      case 'link': {
        const { scrollTop } = this.lextrix.root;
        if (this.linkRange) {
          this.lextrix.formatText(
            this.linkRange,
            'link',
            value,
            Emitter.sources.USER,
          );
          delete this.linkRange;
        } else {
          this.restoreFocus();
          this.lextrix.format('link', value, Emitter.sources.USER);
        }
        this.lextrix.root.scrollTop = scrollTop;
        break;
      }
      case 'video': {
        value = extractVideoUrl(value);
      } // eslint-disable-next-line no-fallthrough
      case 'formula': {
        if (!value) break;
        const range = this.lextrix.getSelection(true);
        if (range != null) {
          const index = range.index + range.length;
          this.lextrix.insertEmbed(
            index,
            // @ts-expect-error Fix me later
            this.root.getAttribute('data-mode'),
            value,
            Emitter.sources.USER,
          );
          if (this.root.getAttribute('data-mode') === 'formula') {
            this.lextrix.insertText(index + 1, ' ', Emitter.sources.USER);
          }
          this.lextrix.setSelection(index + 2, Emitter.sources.USER);
        }
        break;
      }
      default:
    }
    // @ts-expect-error Fix me later
    this.textbox.value = '';
    this.hide();
  }
}

function extractVideoUrl(url: string) {
  let match =
    url.match(
      /^(?:(https?):\/\/)?(?:(?:www|m)\.)?youtube\.com\/watch.*v=([a-zA-Z0-9_-]+)/,
    ) ||
    url.match(/^(?:(https?):\/\/)?(?:(?:www|m)\.)?youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `${match[1] || 'https'}://www.youtube.com/embed/${
      match[2]
    }?showinfo=0`;
  }
  // eslint-disable-next-line no-cond-assign
  if ((match = url.match(/^(?:(https?):\/\/)?(?:www\.)?vimeo\.com\/(\d+)/))) {
    return `${match[1] || 'https'}://player.vimeo.com/video/${match[2]}/`;
  }
  return url;
}

function fillSelect(
  select: HTMLSelectElement,
  values: Array<string | boolean>,
  defaultValue: unknown = false,
) {
  values.forEach((value) => {
    const option = document.createElement('option');
    if (value === defaultValue) {
      option.setAttribute('selected', 'selected');
    } else {
      option.setAttribute('value', String(value));
    }
    select.appendChild(option);
  });
}

export { BaseTooltip, BaseTheme as default };
