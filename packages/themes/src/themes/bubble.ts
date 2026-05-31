import { merge } from 'lodash-es';
import Emitter from 'lextron-core/core/emitter.js';
import BaseTheme, { BaseTooltip } from './base.js';
import { Range } from 'lextron-core/core/selection.js';
import type { Bounds } from 'lextron-core/core/selection.js';
import icons from 'lextron-ui/ui/icons.js';
import Lextron from 'lextron-core/core/lextron.js';
import type { ThemeOptions } from 'lextron-core/core/theme.js';
import type Toolbar from 'lextron-modules/modules/toolbar.js';
import type { ToolbarConfig } from 'lextron-modules/modules/toolbar.js';

const TOOLBAR_CONFIG: ToolbarConfig = [
  ['bold', 'italic', 'link'],
  [{ header: 1 }, { header: 2 }, 'blockquote'],
];

class BubbleTooltip extends BaseTooltip {
  static TEMPLATE = [
    '<span class="lxt-tooltip-arrow"></span>',
    '<div class="lxt-tooltip-editor">',
    '<input type="text" data-formula="e=mc^2" data-link="https://example.com" data-video="Embed URL">',
    '<a class="lxt-close"></a>',
    '</div>',
  ].join('');

  constructor(lextron: Lextron, bounds?: HTMLElement) {
    super(lextron, bounds);
    this.lextron.on(
      Emitter.events.EDITOR_CHANGE,
      (type, range, oldRange, source) => {
        if (type !== Emitter.events.SELECTION_CHANGE) return;
        if (
          range != null &&
          range.length > 0 &&
          source === Emitter.sources.USER
        ) {
          this.show();
          // Lock our width so we will expand beyond our offsetParent boundaries
          this.root.style.left = '0px';
          this.root.style.width = '';
          this.root.style.width = `${this.root.offsetWidth}px`;
          const lines = this.lextron.getLines(range.index, range.length);
          if (lines.length === 1) {
            const bounds = this.lextron.getBounds(range);
            if (bounds != null) {
              this.position(bounds);
            }
          } else {
            const lastLine = lines[lines.length - 1];
            const index = this.lextron.getIndex(lastLine);
            const length = Math.min(
              lastLine.length() - 1,
              range.index + range.length - index,
            );
            const indexBounds = this.lextron.getBounds(new Range(index, length));
            if (indexBounds != null) {
              this.position(indexBounds);
            }
          }
        } else if (
          document.activeElement !== this.textbox &&
          this.lextron.hasFocus()
        ) {
          this.hide();
        }
      },
    );
  }

  listen() {
    super.listen();
    // @ts-expect-error Fix me later
    this.root.querySelector('.lxt-close').addEventListener('click', () => {
      this.root.classList.remove('lxt-editing');
    });
    this.lextron.on(Emitter.events.SCROLL_OPTIMIZE, () => {
      // Let selection be restored by toolbar handlers before repositioning
      setTimeout(() => {
        if (this.root.classList.contains('lxt-hidden')) return;
        const range = this.lextron.getSelection();
        if (range != null) {
          const bounds = this.lextron.getBounds(range);
          if (bounds != null) {
            this.position(bounds);
          }
        }
      }, 1);
    });
  }

  cancel() {
    this.show();
  }

  position(reference: Bounds) {
    const shift = super.position(reference);
    const arrow = this.root.querySelector('.lxt-tooltip-arrow');
    // @ts-expect-error
    arrow.style.marginLeft = '';
    if (shift !== 0) {
      // @ts-expect-error
      arrow.style.marginLeft = `${-1 * shift - arrow.offsetWidth / 2}px`;
    }
    return shift;
  }
}

class BubbleTheme extends BaseTheme {
  tooltip: BubbleTooltip;

  constructor(lextron: Lextron, options: ThemeOptions) {
    if (
      options.modules.toolbar != null &&
      options.modules.toolbar.container == null
    ) {
      options.modules.toolbar.container = TOOLBAR_CONFIG;
    }
    super(lextron, options);
    this.lextron.container.classList.add('lxt-bubble');
  }

  extendToolbar(toolbar: Toolbar) {
    // @ts-expect-error
    this.tooltip = new BubbleTooltip(this.lextron, this.options.bounds);
    if (toolbar.container != null) {
      this.tooltip.root.appendChild<HTMLElement>(toolbar.container);
      this.buildButtons(toolbar.container.querySelectorAll('button'), icons);
      this.buildPickers(toolbar.container.querySelectorAll('select'), icons);
    }
  }
}
BubbleTheme.DEFAULTS = merge({}, BaseTheme.DEFAULTS, {
  modules: {
    toolbar: {
      handlers: {
        link(value: string) {
          if (!value) {
            this.lextron.format('link', false, Lextron.sources.USER);
          } else {
            // @ts-expect-error
            this.lextron.theme.tooltip.edit();
          }
        },
      },
    },
  },
} satisfies ThemeOptions);

export { BubbleTooltip, BubbleTheme as default };
