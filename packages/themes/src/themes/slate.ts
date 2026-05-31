import { merge } from 'lodash-es';
import Emitter from 'lextron-core/core/emitter.js';
import BaseTheme, { BaseTooltip } from './base.js';
import LinkBlot from 'lextron-formats/formats/link.js';
import { Range } from 'lextron-core/core/selection.js';
import icons from 'lextron-ui/ui/icons.js';
import Lextron from 'lextron-core/core/lextron.js';
import type { Context } from 'lextron-modules/modules/keyboard.js';
import type Toolbar from 'lextron-modules/modules/toolbar.js';
import type { ToolbarConfig } from 'lextron-modules/modules/toolbar.js';
import type { ThemeOptions } from 'lextron-core/core/theme.js';

const TOOLBAR_CONFIG: ToolbarConfig = [
  [{ header: ['1', '2', '3', '4', '5', false] }],
  ['bold', 'italic', 'underline', 'link'],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['blockquote', 'code-block', 'clean'],
];

class SlateTooltip extends BaseTooltip {
  static TEMPLATE = [
    '<a class="lxt-preview" rel="noopener noreferrer" target="_blank" href="about:blank"></a>',
    '<input type="text" data-formula="e=mc^2" data-link="https://example.com" data-video="Embed URL">',
    '<a class="lxt-action"></a>',
    '<a class="lxt-remove"></a>',
  ].join('');

  preview = this.root.querySelector('a.lxt-preview');

  listen() {
    super.listen();
    // @ts-expect-error Fix me later
    this.root
      .querySelector('a.lxt-action')
      .addEventListener('click', (event) => {
        if (this.root.classList.contains('lxt-editing')) {
          this.save();
        } else {
          // @ts-expect-error Fix me later
          this.edit('link', this.preview.textContent);
        }
        event.preventDefault();
      });
    // @ts-expect-error Fix me later
    this.root
      .querySelector('a.lxt-remove')
      .addEventListener('click', (event) => {
        if (this.linkRange != null) {
          const range = this.linkRange;
          this.restoreFocus();
          this.lextron.formatText(range, 'link', false, Emitter.sources.USER);
          delete this.linkRange;
        }
        event.preventDefault();
        this.hide();
      });
    this.lextron.on(
      Emitter.events.SELECTION_CHANGE,
      (range, _oldRange, source) => {
        if (range == null) return;
        if (range.length === 0 && source === Emitter.sources.USER) {
          const [link, offset] = this.lextron.scroll.descendant(
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
            const bounds = this.lextron.getBounds(this.linkRange);
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

class SlateTheme extends BaseTheme {
  constructor(lextron: Lextron, options: ThemeOptions) {
    if (
      options.modules.toolbar != null &&
      options.modules.toolbar.container == null
    ) {
      options.modules.toolbar.container = TOOLBAR_CONFIG;
    }
    super(lextron, options);
    this.lextron.container.classList.add('lxt-slate');
  }

  extendToolbar(toolbar: Toolbar) {
    if (toolbar.container != null) {
      toolbar.container.classList.add('lxt-slate');
      this.buildButtons(toolbar.container.querySelectorAll('button'), icons);
      this.buildPickers(toolbar.container.querySelectorAll('select'), icons);
      // @ts-expect-error
      this.tooltip = new SlateTooltip(this.lextron, this.options.bounds);
      if (toolbar.container.querySelector('.lxt-link')) {
        this.lextron.keyboard.addBinding(
          { key: 'k', shortKey: true },
          (_range: Range, context: Context) => {
            toolbar.handlers.link.call(toolbar, !context.format.link);
          },
        );
      }
    }
  }
}

SlateTheme.DEFAULTS = merge({}, BaseTheme.DEFAULTS, {
  modules: {
    toolbar: {
      handlers: {
        link(value: string) {
          if (value) {
            const range = this.lextron.getSelection();
            if (range == null || range.length === 0) return;
            let preview = this.lextron.getText(range);
            if (
              /^\S+@\S+\.\S+$/.test(preview) &&
              preview.indexOf('mailto:') !== 0
            ) {
              preview = `mailto:${preview}`;
            }
            // @ts-expect-error
            const { tooltip } = this.lextron.theme;
            tooltip.edit('link', preview);
          } else {
            this.lextron.format('link', false, Lextron.sources.USER);
          }
        },
      },
    },
  },
} satisfies ThemeOptions);

export default SlateTheme;
