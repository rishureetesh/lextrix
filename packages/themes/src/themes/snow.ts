import { merge } from 'lodash-es';
import Emitter from 'lextrix-core/core/emitter.js';
import BaseTheme, { BaseTooltip } from './base.js';
import LinkBlot from 'lextrix-formats/formats/link.js';
import { Range } from 'lextrix-core/core/selection.js';
import icons from 'lextrix-ui/ui/icons.js';
import Lextrix from 'lextrix-core/core/lextrix.js';
import type { Context } from 'lextrix-modules/modules/keyboard.js';
import type Toolbar from 'lextrix-modules/modules/toolbar.js';
import type { ToolbarConfig } from 'lextrix-modules/modules/toolbar.js';
import type { ThemeOptions } from 'lextrix-core/core/theme.js';

const TOOLBAR_CONFIG: ToolbarConfig = [
  [{ header: ['1', '2', '3', '4', '5', false] }],
  ['bold', 'italic', 'underline', 'link'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['clean'],
];

class SnowTooltip extends BaseTooltip {
  static TEMPLATE = [
    '<a class="lxr-preview" rel="noopener noreferrer" target="_blank" href="about:blank"></a>',
    '<input type="text" data-formula="e=mc^2" data-link="https://example.com" data-video="Embed URL">',
    '<a class="lxr-action"></a>',
    '<a class="lxr-remove"></a>',
  ].join('');

  preview = this.root.querySelector('a.lxr-preview');

  listen() {
    super.listen();
    // @ts-expect-error Fix me later
    this.root
      .querySelector('a.lxr-action')
      .addEventListener('click', (event) => {
        if (this.root.classList.contains('lxr-editing')) {
          this.save();
        } else {
          // @ts-expect-error Fix me later
          this.edit('link', this.preview.textContent);
        }
        event.preventDefault();
      });
    // @ts-expect-error Fix me later
    this.root
      .querySelector('a.lxr-remove')
      .addEventListener('click', (event) => {
        if (this.linkRange != null) {
          const range = this.linkRange;
          this.restoreFocus();
          this.lextrix.formatText(range, 'link', false, Emitter.sources.USER);
          delete this.linkRange;
        }
        event.preventDefault();
        this.hide();
      });
    this.lextrix.on(
      Emitter.events.SELECTION_CHANGE,
      (range, oldRange, source) => {
        if (range == null) return;
        if (range.length === 0 && source === Emitter.sources.USER) {
          const [link, offset] = this.lextrix.scroll.descendant(
            LinkBlot,
            range.index,
          );
          if (link != null) {
            this.linkRange = new Range(range.index - offset, link.length());
            const preview = LinkBlot.formats(link.domNode);
            // @ts-expect-error Fix me later
            this.preview.textContent = preview;
            // @ts-expect-error Fix me later
            this.preview.setAttribute('href', preview);
            this.show();
            const bounds = this.lextrix.getBounds(this.linkRange);
            if (bounds != null) {
              this.position(bounds);
            }
            return;
          }
        } else {
          delete this.linkRange;
        }
        this.hide();
      },
    );
  }

  show() {
    super.show();
    this.root.removeAttribute('data-mode');
  }
}

class SnowTheme extends BaseTheme {
  constructor(lextrix: Lextrix, options: ThemeOptions) {
    if (
      options.modules.toolbar != null &&
      options.modules.toolbar.container == null
    ) {
      options.modules.toolbar.container = TOOLBAR_CONFIG;
    }
    super(lextrix, options);
    this.lextrix.container.classList.add('lxr-snow');
  }

  extendToolbar(toolbar: Toolbar) {
    if (toolbar.container != null) {
      toolbar.container.classList.add('lxr-snow');
      this.buildButtons(toolbar.container.querySelectorAll('button'), icons);
      this.buildPickers(toolbar.container.querySelectorAll('select'), icons);
      // @ts-expect-error
      this.tooltip = new SnowTooltip(this.lextrix, this.options.bounds);
      if (toolbar.container.querySelector('.lxr-link')) {
        this.lextrix.keyboard.addBinding(
          { key: 'k', shortKey: true },
          (_range: Range, context: Context) => {
            toolbar.handlers.link.call(toolbar, !context.format.link);
          },
        );
      }
    }
  }
}
SnowTheme.DEFAULTS = merge({}, BaseTheme.DEFAULTS, {
  modules: {
    toolbar: {
      handlers: {
        link(value: string) {
          if (value) {
            const range = this.lextrix.getSelection();
            if (range == null || range.length === 0) return;
            let preview = this.lextrix.getText(range);
            if (
              /^\S+@\S+\.\S+$/.test(preview) &&
              preview.indexOf('mailto:') !== 0
            ) {
              preview = `mailto:${preview}`;
            }
            // @ts-expect-error
            const { tooltip } = this.lextrix.theme;
            tooltip.edit('link', preview);
          } else {
            this.lextrix.format('link', false, Lextrix.sources.USER);
          }
        },
      },
    },
  },
} satisfies ThemeOptions);

export default SnowTheme;
