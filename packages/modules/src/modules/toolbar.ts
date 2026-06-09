/** Lextrix modules — editor behavior modules. */
import ChangeSet from 'lextrix-change';
import { EmbedBlot, Scope } from 'lextrix-dom';
import Lextrix from 'lextrix-core';
import logger from 'lextrix-core/core/logger.js';
import Module from 'lextrix-core/core/module.js';
import type { Range } from 'lextrix-core/core/selection.js';

const debug = logger('lextrix:toolbar');

type Handler = (this: Toolbar, value: any) => void;

export type ToolbarConfig = Array<
  string[] | Array<string | Record<string, unknown>>
>;
export interface ToolbarProps {
  container?: HTMLElement | ToolbarConfig | null;
  handlers?: Record<string, Handler>;
  option?: number;
  module?: boolean;
  theme?: boolean;
}

class Toolbar extends Module<ToolbarProps> {
  static DEFAULTS: ToolbarProps;

  container?: HTMLElement | null;
  /** True when this module created the toolbar element (safe to remove on destroy). */
  autoCreated = false;
  controls: [string, HTMLElement][];
  handlers: Record<string, Handler>;

  constructor(lextrix: Lextrix, options: Partial<ToolbarProps>) {
    super(lextrix, options);
    if (Array.isArray(this.options.container)) {
      const container = document.createElement('div');
      container.setAttribute('role', 'toolbar');
      addControls(container, this.options.container);
      if (lextrix.container?.firstChild) {
        lextrix.container.insertBefore(container, lextrix.container.firstChild);
      } else {
        lextrix.container?.appendChild(container);
      }
      this.container = container;
      this.autoCreated = true;
    } else if (typeof this.options.container === 'string') {
      this.container = document.querySelector(this.options.container);
    } else {
      this.container = this.options.container;
    }
    if (!(this.container instanceof HTMLElement)) {
      debug.error('Container required for toolbar', this.options);
      return;
    }
    this.container.classList.add('lxr-toolbar');
    this.controls = [];
    this.handlers = {};
    if (this.options.handlers) {
      Object.keys(this.options.handlers).forEach((format) => {
        const handler = this.options.handlers?.[format];
        if (handler) {
          this.addHandler(format, handler);
        }
      });
    }
    Array.from(this.container.querySelectorAll('button, select')).forEach(
      (input) => {
        // @ts-expect-error
        this.attach(input);
      },
    );
    this.lextrix.on(Lextrix.events.EDITOR_CHANGE, () => {
      const [range] = this.lextrix.selection.getRange(); // lextrix.getSelection triggers update
      this.update(range);
    });
  }

  destroy() {
    if (this.autoCreated && this.container?.isConnected) {
      this.container.remove();
    }
    this.container = null;
    this.controls = [];
  }

  addHandler(format: string, handler: Handler) {
    this.handlers[format] = handler;
  }

  attach(input: HTMLElement) {
    let format = Array.from(input.classList).find((className) => {
      return className.indexOf('lxr-') === 0;
    });
    if (!format) return;
    format = format.slice('lxr-'.length);
    if (input.tagName === 'BUTTON') {
      input.setAttribute('type', 'button');
    }
    if (
      this.handlers[format] == null &&
      this.lextrix.scroll.query(format) == null
    ) {
      debug.warn('ignoring attaching to nonexistent format', format, input);
      return;
    }
    const eventName = input.tagName === 'SELECT' ? 'change' : 'click';
    input.addEventListener(eventName, (e) => {
      let value;
      if (input.tagName === 'SELECT') {
        // @ts-expect-error
        if (input.selectedIndex < 0) return;
        // @ts-expect-error
        const selected = input.options[input.selectedIndex];
        if (selected.hasAttribute('selected')) {
          value = false;
        } else {
          value = selected.value || false;
        }
      } else {
        if (input.classList.contains('lxr-active')) {
          value = false;
        } else {
          // @ts-expect-error
          value = input.value || !input.hasAttribute('value');
        }
        e.preventDefault();
      }
      this.lextrix.focus();
      const [range] = this.lextrix.selection.getRange();
      if (this.handlers[format] != null) {
        this.handlers[format].call(this, value);
      } else if (
        // @ts-expect-error
        this.lextrix.scroll.query(format).prototype instanceof EmbedBlot
      ) {
        value = prompt(`Enter ${format}`); // eslint-disable-line no-alert
        if (!value) return;
        this.lextrix.updateContents(
          new ChangeSet()
            // @ts-expect-error Fix me later
            .retain(range.index)
            // @ts-expect-error Fix me later
            .delete(range.length)
            .insert({ [format]: value }),
          Lextrix.sources.USER,
        );
      } else {
        this.lextrix.format(format, value, Lextrix.sources.USER);
      }
      this.update(range);
    });
    this.controls.push([format, input]);
  }

  update(range: Range | null) {
    const formats = range == null ? {} : this.lextrix.getFormat(range);
    this.controls.forEach((pair) => {
      const [format, input] = pair;
      if (input.tagName === 'SELECT') {
        let option: HTMLOptionElement | null = null;
        if (range == null) {
          option = null;
        } else if (formats[format] == null) {
          option = input.querySelector('option[selected]');
        } else if (!Array.isArray(formats[format])) {
          let value = formats[format];
          if (typeof value === 'string') {
            value = value.replace(/"/g, '\\"');
          }
          option = input.querySelector(`option[value="${value}"]`);
        }
        if (option == null) {
          // @ts-expect-error TODO fix me later
          input.value = ''; // TODO make configurable?
          // @ts-expect-error TODO fix me later
          input.selectedIndex = -1;
        } else {
          option.selected = true;
        }
      } else if (range == null) {
        input.classList.remove('lxr-active');
        input.setAttribute('aria-pressed', 'false');
      } else if (input.hasAttribute('value')) {
        // both being null should match (default values)
        // '1' should match with 1 (headers)
        const value = formats[format] as boolean | number | string | object;
        const isActive =
          value === input.getAttribute('value') ||
          (value != null && value.toString() === input.getAttribute('value')) ||
          (value == null && !input.getAttribute('value'));
        input.classList.toggle('lxr-active', isActive);
        input.setAttribute('aria-pressed', isActive.toString());
      } else {
        const isActive = formats[format] != null;
        input.classList.toggle('lxr-active', isActive);
        input.setAttribute('aria-pressed', isActive.toString());
      }
    });
  }
}
Toolbar.DEFAULTS = {};

function addButton(container: HTMLElement, format: string, value?: string) {
  if (
    format === 'formula' &&
    typeof window !== 'undefined' &&
    // @ts-expect-error optional peer
    window.katex == null
  ) {
    return;
  }
  const input = document.createElement('button');
  input.setAttribute('type', 'button');
  input.classList.add(`lxr-${format}`);
  input.setAttribute('aria-pressed', 'false');
  if (value != null) {
    input.value = value;
    input.setAttribute('aria-label', `${format}: ${value}`);
  } else {
    input.setAttribute('aria-label', format);
  }
  container.appendChild(input);
}

function addControls(
  container: HTMLElement,
  groups:
    | (string | Record<string, unknown>)[][]
    | (string | Record<string, unknown>)[],
) {
  if (!Array.isArray(groups[0])) {
    // @ts-expect-error
    groups = [groups];
  }
  groups.forEach((controls: any) => {
    const group = document.createElement('span');
    group.classList.add('lxr-formats');
    controls.forEach((control: any) => {
      if (typeof control === 'string') {
        addButton(group, control);
      } else {
        const format = Object.keys(control)[0];
        const value = control[format];
        if (Array.isArray(value)) {
          addSelect(group, format, value);
        } else {
          addButton(group, format, value);
        }
      }
    });
    container.appendChild(group);
  });
}

function addSelect(
  container: HTMLElement,
  format: string,
  values: Array<string | boolean>,
) {
  const input = document.createElement('select');
  input.classList.add(`lxr-${format}`);
  values.forEach((value) => {
    const option = document.createElement('option');
    if (value !== false) {
      option.setAttribute('value', String(value));
    } else {
      option.setAttribute('selected', 'selected');
    }
    input.appendChild(option);
  });
  container.appendChild(input);
}

Toolbar.DEFAULTS = {
  container: null,
  handlers: {
    clean() {
      const range = this.lextrix.getSelection();
      if (range == null) return;
      if (range.length === 0) {
        const formats = this.lextrix.getFormat();
        Object.keys(formats).forEach((name) => {
          // Clean functionality in existing apps only clean inline formats
          if (this.lextrix.scroll.query(name, Scope.INLINE) != null) {
            this.lextrix.format(name, false, Lextrix.sources.USER);
          }
        });
      } else {
        this.lextrix.removeFormat(range.index, range.length, Lextrix.sources.USER);
      }
    },
    direction(value) {
      const { align } = this.lextrix.getFormat();
      if (value === 'rtl' && align == null) {
        this.lextrix.format('align', 'right', Lextrix.sources.USER);
      } else if (!value && align === 'right') {
        this.lextrix.format('align', false, Lextrix.sources.USER);
      }
      this.lextrix.format('direction', value, Lextrix.sources.USER);
    },
    indent(value) {
      const range = this.lextrix.getSelection();
      // @ts-expect-error
      const formats = this.lextrix.getFormat(range);
      // @ts-expect-error
      const indent = parseInt(formats.indent || 0, 10);
      if (value === '+1' || value === '-1') {
        let modifier = value === '+1' ? 1 : -1;
        if (formats.direction === 'rtl') modifier *= -1;
        this.lextrix.format('indent', indent + modifier, Lextrix.sources.USER);
      }
    },
    link(value) {
      if (value === true) {
        value = prompt('Enter link URL:'); // eslint-disable-line no-alert
      }
      this.lextrix.format('link', value, Lextrix.sources.USER);
    },
    list(value) {
      const range = this.lextrix.getSelection();
      // @ts-expect-error
      const formats = this.lextrix.getFormat(range);
      if (value === 'check') {
        if (formats.list === 'checked' || formats.list === 'unchecked') {
          this.lextrix.format('list', false, Lextrix.sources.USER);
        } else {
          this.lextrix.format('list', 'unchecked', Lextrix.sources.USER);
        }
      } else {
        this.lextrix.format('list', value, Lextrix.sources.USER);
      }
    },
  },
};

export { Toolbar as default, addControls };
