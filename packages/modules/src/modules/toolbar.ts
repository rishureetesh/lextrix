/** Lextron modules — editor behavior modules. */
import ChangeSet from 'lextron-change';
import { EmbedBlot, Scope } from 'lextron-dom';
import Lextron from 'lextron-core';
import logger from 'lextron-core/core/logger.js';
import Module from 'lextron-core/core/module.js';
import type { Range } from 'lextron-core/core/selection.js';

const debug = logger('lextron:toolbar');

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
  controls: [string, HTMLElement][];
  handlers: Record<string, Handler>;

  constructor(lextron: Lextron, options: Partial<ToolbarProps>) {
    super(lextron, options);
    if (Array.isArray(this.options.container)) {
      const container = document.createElement('div');
      container.setAttribute('role', 'toolbar');
      addControls(container, this.options.container);
      lextron.container?.parentNode?.insertBefore(container, lextron.container);
      this.container = container;
    } else if (typeof this.options.container === 'string') {
      this.container = document.querySelector(this.options.container);
    } else {
      this.container = this.options.container;
    }
    if (!(this.container instanceof HTMLElement)) {
      debug.error('Container required for toolbar', this.options);
      return;
    }
    this.container.classList.add('lxt-toolbar');
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
    this.lextron.on(Lextron.events.EDITOR_CHANGE, () => {
      const [range] = this.lextron.selection.getRange(); // lextron.getSelection triggers update
      this.update(range);
    });
  }

  addHandler(format: string, handler: Handler) {
    this.handlers[format] = handler;
  }

  attach(input: HTMLElement) {
    let format = Array.from(input.classList).find((className) => {
      return className.indexOf('lxt-') === 0;
    });
    if (!format) return;
    format = format.slice('lxt-'.length);
    if (input.tagName === 'BUTTON') {
      input.setAttribute('type', 'button');
    }
    if (
      this.handlers[format] == null &&
      this.lextron.scroll.query(format) == null
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
        if (input.classList.contains('lxt-active')) {
          value = false;
        } else {
          // @ts-expect-error
          value = input.value || !input.hasAttribute('value');
        }
        e.preventDefault();
      }
      this.lextron.focus();
      const [range] = this.lextron.selection.getRange();
      if (this.handlers[format] != null) {
        this.handlers[format].call(this, value);
      } else if (
        // @ts-expect-error
        this.lextron.scroll.query(format).prototype instanceof EmbedBlot
      ) {
        value = prompt(`Enter ${format}`); // eslint-disable-line no-alert
        if (!value) return;
        this.lextron.updateContents(
          new ChangeSet()
            // @ts-expect-error Fix me later
            .retain(range.index)
            // @ts-expect-error Fix me later
            .delete(range.length)
            .insert({ [format]: value }),
          Lextron.sources.USER,
        );
      } else {
        this.lextron.format(format, value, Lextron.sources.USER);
      }
      this.update(range);
    });
    this.controls.push([format, input]);
  }

  update(range: Range | null) {
    const formats = range == null ? {} : this.lextron.getFormat(range);
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
        input.classList.remove('lxt-active');
        input.setAttribute('aria-pressed', 'false');
      } else if (input.hasAttribute('value')) {
        // both being null should match (default values)
        // '1' should match with 1 (headers)
        const value = formats[format] as boolean | number | string | object;
        const isActive =
          value === input.getAttribute('value') ||
          (value != null && value.toString() === input.getAttribute('value')) ||
          (value == null && !input.getAttribute('value'));
        input.classList.toggle('lxt-active', isActive);
        input.setAttribute('aria-pressed', isActive.toString());
      } else {
        const isActive = formats[format] != null;
        input.classList.toggle('lxt-active', isActive);
        input.setAttribute('aria-pressed', isActive.toString());
      }
    });
  }
}
Toolbar.DEFAULTS = {};

function addButton(container: HTMLElement, format: string, value?: string) {
  const input = document.createElement('button');
  input.setAttribute('type', 'button');
  input.classList.add(`lxt-${format}`);
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
    group.classList.add('lxt-formats');
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
  input.classList.add(`lxt-${format}`);
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
      const range = this.lextron.getSelection();
      if (range == null) return;
      if (range.length === 0) {
        const formats = this.lextron.getFormat();
        Object.keys(formats).forEach((name) => {
          // Clean functionality in existing apps only clean inline formats
          if (this.lextron.scroll.query(name, Scope.INLINE) != null) {
            this.lextron.format(name, false, Lextron.sources.USER);
          }
        });
      } else {
        this.lextron.removeFormat(range.index, range.length, Lextron.sources.USER);
      }
    },
    direction(value) {
      const { align } = this.lextron.getFormat();
      if (value === 'rtl' && align == null) {
        this.lextron.format('align', 'right', Lextron.sources.USER);
      } else if (!value && align === 'right') {
        this.lextron.format('align', false, Lextron.sources.USER);
      }
      this.lextron.format('direction', value, Lextron.sources.USER);
    },
    indent(value) {
      const range = this.lextron.getSelection();
      // @ts-expect-error
      const formats = this.lextron.getFormat(range);
      // @ts-expect-error
      const indent = parseInt(formats.indent || 0, 10);
      if (value === '+1' || value === '-1') {
        let modifier = value === '+1' ? 1 : -1;
        if (formats.direction === 'rtl') modifier *= -1;
        this.lextron.format('indent', indent + modifier, Lextron.sources.USER);
      }
    },
    link(value) {
      if (value === true) {
        value = prompt('Enter link URL:'); // eslint-disable-line no-alert
      }
      this.lextron.format('link', value, Lextron.sources.USER);
    },
    list(value) {
      const range = this.lextron.getSelection();
      // @ts-expect-error
      const formats = this.lextron.getFormat(range);
      if (value === 'check') {
        if (formats.list === 'checked' || formats.list === 'unchecked') {
          this.lextron.format('list', false, Lextron.sources.USER);
        } else {
          this.lextron.format('list', 'unchecked', Lextron.sources.USER);
        }
      } else {
        this.lextron.format('list', value, Lextron.sources.USER);
      }
    },
  },
};

export { Toolbar as default, addControls };
