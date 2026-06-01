import { merge } from 'lodash-es';
import Emitter from 'lextrix-core/core/emitter.js';
import BaseTheme, { BaseTooltip } from './base.js';
import { Range } from 'lextrix-core/core/selection.js';
import type { Bounds } from 'lextrix-core/core/selection.js';
import icons from 'lextrix-ui/ui/icons.js';
import Lextrix from 'lextrix-core/core/lextrix.js';
import type { ThemeOptions } from 'lextrix-core/core/theme.js';
import type Toolbar from 'lextrix-modules/modules/toolbar.js';
import type { ToolbarConfig } from 'lextrix-modules/modules/toolbar.js';

const TOOLBAR_CONFIG: ToolbarConfig = [
  ['bold', 'italic', 'link'],
  [{ header: 1 }, { header: 2 }, 'blockquote'],
];

class BubbleTooltip extends BaseTooltip {
  static TEMPLATE = [
    '<span class="lxr-tooltip-arrow"></span>',
    '<div class="lxr-tooltip-editor">',
    '<input type="text" data-formula="e=mc^2" data-link="https://example.com" data-video="Embed URL">',
    '<a class="lxr-close"></a>',
    '</div>',
  ].join('');

  constructor(lextrix: Lextrix, bounds?: HTMLElement) {
    super(lextrix, bounds);
    this.lextrix.on(
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
          const lines = this.lextrix.getLines(range.index, range.length);
          if (lines.length === 1) {
            const bounds = this.lextrix.getBounds(range);
            if (bounds != null) {
              this.position(bounds);
            }
          } else {
            const lastLine = lines[lines.length - 1];
            const index = this.lextrix.getIndex(lastLine);
            const length = Math.min(
              lastLine.length() - 1,
              range.index + range.length - index,
            );
            const indexBounds = this.lextrix.getBounds(new Range(index, length));
            if (indexBounds != null) {
              this.position(indexBounds);
            }
          }
        } else if (
          document.activeElement !== this.textbox &&
          this.lextrix.hasFocus()
        ) {
          this.hide();
        }
      },
    );
  }

  listen() {
    super.listen();
    // @ts-expect-error Fix me later
    this.root.querySelector('.lxr-close').addEventListener('click', () => {
      this.root.classList.remove('lxr-editing');
    });
    this.lextrix.on(Emitter.events.SCROLL_OPTIMIZE, () => {
      // Let selection be restored by toolbar handlers before repositioning
      setTimeout(() => {
        if (this.root.classList.contains('lxr-hidden')) return;
        const range = this.lextrix.getSelection();
        if (range != null) {
          const bounds = this.lextrix.getBounds(range);
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
    const arrow = this.root.querySelector('.lxr-tooltip-arrow');
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

  constructor(lextrix: Lextrix, options: ThemeOptions) {
    if (
      options.modules.toolbar != null &&
      options.modules.toolbar.container == null
    ) {
      options.modules.toolbar.container = TOOLBAR_CONFIG;
    }
    super(lextrix, options);
    this.lextrix.container.classList.add('lxr-bubble');
  }

  extendToolbar(toolbar: Toolbar) {
    // @ts-expect-error
    this.tooltip = new BubbleTooltip(this.lextrix, this.options.bounds);
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
            this.lextrix.format('link', false, Lextrix.sources.USER);
          } else {
            // @ts-expect-error
            this.lextrix.theme.tooltip.edit();
          }
        },
      },
    },
  },
} satisfies ThemeOptions);

export { BubbleTooltip, BubbleTheme as default };
