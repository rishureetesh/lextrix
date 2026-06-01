/** Lextrix modules — editor behavior modules. */
import { cloneDeep, isEqual } from 'lodash-es';
import ChangeSet, { ChangeAttributes } from 'lextrix-change';
import { EmbedBlot, Scope, TextBlot } from 'lextrix-dom';
import type { Blot, BlockBlot } from 'lextrix-dom';
import Lextrix from 'lextrix-core';
import logger from 'lextrix-core/core/logger.js';
import Module from 'lextrix-core/core/module.js';
import type { BlockEmbed } from 'lextrix-core/blots/block.js';
import type { Range } from 'lextrix-core/core/selection.js';

const debug = logger('lextrix:keyboard');

const SHORTKEY = /Mac/i.test(navigator.platform) ? 'metaKey' : 'ctrlKey';

export interface Context {
  collapsed: boolean;
  empty: boolean;
  offset: number;
  prefix: string;
  suffix: string;
  format: Record<string, unknown>;
  event: KeyboardEvent;
  line: BlockEmbed | BlockBlot;
}

interface BindingObject
  extends Partial<Omit<Context, 'prefix' | 'suffix' | 'format'>> {
  key: number | string | string[];
  shortKey?: boolean | null;
  shiftKey?: boolean | null;
  altKey?: boolean | null;
  metaKey?: boolean | null;
  ctrlKey?: boolean | null;
  prefix?: RegExp;
  suffix?: RegExp;
  format?: Record<string, unknown> | string[];
  handler?: (
    this: { lextrix: Lextrix },
    range: Range,
    curContext: Context,
    // eslint-disable-next-line no-use-before-define
    binding: NormalizedBinding,
  ) => boolean | void;
}

type Binding = BindingObject | string | number;

interface NormalizedBinding extends Omit<BindingObject, 'key' | 'shortKey'> {
  key: string | number;
}

interface KeyboardOptions {
  bindings: Record<string, Binding>;
}

interface KeyboardOptions {
  bindings: Record<string, Binding>;
}

class Keyboard extends Module<KeyboardOptions> {
  static DEFAULTS: KeyboardOptions;

  static match(evt: KeyboardEvent, binding: BindingObject) {
    if (
      (['altKey', 'ctrlKey', 'metaKey', 'shiftKey'] as const).some((key) => {
        return !!binding[key] !== evt[key] && binding[key] !== null;
      })
    ) {
      return false;
    }
    return binding.key === evt.key || binding.key === evt.which;
  }

  bindings: Record<string, NormalizedBinding[]>;

  constructor(lextrix: Lextrix, options: Partial<KeyboardOptions>) {
    super(lextrix, options);
    this.bindings = {};
    // @ts-expect-error Fix me later
    Object.keys(this.options.bindings).forEach((name) => {
      // @ts-expect-error Fix me later
      if (this.options.bindings[name]) {
        // @ts-expect-error Fix me later
        this.addBinding(this.options.bindings[name]);
      }
    });
    this.addBinding({ key: 'Enter', shiftKey: null }, this.handleEnter);
    this.addBinding(
      { key: 'Enter', metaKey: null, ctrlKey: null, altKey: null },
      () => {},
    );
    if (/Firefox/i.test(navigator.userAgent)) {
      // Need to handle delete and backspace for Firefox in the general case #1171
      this.addBinding(
        { key: 'Backspace' },
        { collapsed: true },
        this.handleBackspace,
      );
      this.addBinding(
        { key: 'Delete' },
        { collapsed: true },
        this.handleDelete,
      );
    } else {
      this.addBinding(
        { key: 'Backspace' },
        { collapsed: true, prefix: /^.?$/ },
        this.handleBackspace,
      );
      this.addBinding(
        { key: 'Delete' },
        { collapsed: true, suffix: /^.?$/ },
        this.handleDelete,
      );
    }
    this.addBinding(
      { key: 'Backspace' },
      { collapsed: false },
      this.handleDeleteRange,
    );
    this.addBinding(
      { key: 'Delete' },
      { collapsed: false },
      this.handleDeleteRange,
    );
    this.addBinding(
      {
        key: 'Backspace',
        altKey: null,
        ctrlKey: null,
        metaKey: null,
        shiftKey: null,
      },
      { collapsed: true, offset: 0 },
      this.handleBackspace,
    );
    this.listen();
  }

  addBinding(
    keyBinding: Binding,
    context:
      | Required<BindingObject['handler']>
      | Partial<Omit<BindingObject, 'key' | 'handler'>> = {},
    handler:
      | Required<BindingObject['handler']>
      | Partial<Omit<BindingObject, 'key' | 'handler'>> = {},
  ) {
    const binding = normalize(keyBinding);
    if (binding == null) {
      debug.warn('Attempted to add invalid keyboard binding', binding);
      return;
    }
    if (typeof context === 'function') {
      context = { handler: context };
    }
    if (typeof handler === 'function') {
      handler = { handler };
    }
    const keys = Array.isArray(binding.key) ? binding.key : [binding.key];
    keys.forEach((key) => {
      const singleBinding = {
        ...binding,
        key,
        ...context,
        ...handler,
      };
      this.bindings[singleBinding.key] = this.bindings[singleBinding.key] || [];
      this.bindings[singleBinding.key].push(singleBinding);
    });
  }

  listen() {
    this.lextrix.root.addEventListener('keydown', (evt) => {
      if (evt.defaultPrevented || evt.isComposing) return;

      // evt.isComposing is false when pressing Enter/Backspace when composing in Safari
      // https://bugs.webkit.org/show_bug.cgi?id=165004
      const isComposing =
        evt.keyCode === 229 && (evt.key === 'Enter' || evt.key === 'Backspace');
      if (isComposing) return;

      const bindings = (this.bindings[evt.key] || []).concat(
        this.bindings[evt.which] || [],
      );
      const matches = bindings.filter((binding) =>
        Keyboard.match(evt, binding),
      );
      if (matches.length === 0) return;
      // @ts-expect-error
      const blot = Lextrix.find(evt.target, true);
      if (blot && blot.scroll !== this.lextrix.scroll) return;
      const range = this.lextrix.getSelection();
      if (range == null || !this.lextrix.hasFocus()) return;
      const [line, offset] = this.lextrix.getLine(range.index);
      const [leafStart, offsetStart] = this.lextrix.getLeaf(range.index);
      const [leafEnd, offsetEnd] =
        range.length === 0
          ? [leafStart, offsetStart]
          : this.lextrix.getLeaf(range.index + range.length);
      const prefixText =
        leafStart instanceof TextBlot
          ? leafStart.value().slice(0, offsetStart)
          : '';
      const suffixText =
        leafEnd instanceof TextBlot ? leafEnd.value().slice(offsetEnd) : '';
      const curContext = {
        collapsed: range.length === 0,
        // @ts-expect-error Fix me later
        empty: range.length === 0 && line.length() <= 1,
        format: this.lextrix.getFormat(range),
        line,
        offset,
        prefix: prefixText,
        suffix: suffixText,
        event: evt,
      };
      const prevented = matches.some((binding) => {
        if (
          binding.collapsed != null &&
          binding.collapsed !== curContext.collapsed
        ) {
          return false;
        }
        if (binding.empty != null && binding.empty !== curContext.empty) {
          return false;
        }
        if (binding.offset != null && binding.offset !== curContext.offset) {
          return false;
        }
        if (Array.isArray(binding.format)) {
          // any format is present
          if (binding.format.every((name) => curContext.format[name] == null)) {
            return false;
          }
        } else if (typeof binding.format === 'object') {
          // all formats must match
          if (
            !Object.keys(binding.format).every((name) => {
              // @ts-expect-error Fix me later
              if (binding.format[name] === true)
                return curContext.format[name] != null;
              // @ts-expect-error Fix me later
              if (binding.format[name] === false)
                return curContext.format[name] == null;
              // @ts-expect-error Fix me later
              return isEqual(binding.format[name], curContext.format[name]);
            })
          ) {
            return false;
          }
        }
        if (binding.prefix != null && !binding.prefix.test(curContext.prefix)) {
          return false;
        }
        if (binding.suffix != null && !binding.suffix.test(curContext.suffix)) {
          return false;
        }
        // @ts-expect-error Fix me later
        return binding.handler.call(this, range, curContext, binding) !== true;
      });
      if (prevented) {
        evt.preventDefault();
      }
    });
  }

  handleBackspace(range: Range, context: Context) {
    // Check for astral symbols
    const length = /[\uD800-\uDBFF][\uDC00-\uDFFF]$/.test(context.prefix)
      ? 2
      : 1;
    if (range.index === 0 || this.lextrix.getLength() <= 1) return;
    let formats = {};
    const [line] = this.lextrix.getLine(range.index);
    let delta = new ChangeSet().retain(range.index - length).delete(length);
    if (context.offset === 0) {
      // Always deleting newline here, length always 1
      const [prev] = this.lextrix.getLine(range.index - 1);
      if (prev) {
        const isPrevLineEmpty =
          prev.statics.blotName === 'block' && prev.length() <= 1;
        if (!isPrevLineEmpty) {
          // @ts-expect-error Fix me later
          const curFormats = line.formats();
          const prevFormats = this.lextrix.getFormat(range.index - 1, 1);
          formats = ChangeAttributes.diff(curFormats, prevFormats) || {};
          if (Object.keys(formats).length > 0) {
            // line.length() - 1 targets \n in line, another -1 for newline being deleted
            const formatChangeSet = new ChangeSet()
              // @ts-expect-error Fix me later
              .retain(range.index + line.length() - 2)
              .retain(1, formats);
            delta = delta.compose(formatChangeSet);
          }
        }
      }
    }
    this.lextrix.updateContents(delta, Lextrix.sources.USER);
    this.lextrix.focus();
  }

  handleDelete(range: Range, context: Context) {
    // Check for astral symbols
    const length = /^[\uD800-\uDBFF][\uDC00-\uDFFF]/.test(context.suffix)
      ? 2
      : 1;
    if (range.index >= this.lextrix.getLength() - length) return;
    let formats = {};
    const [line] = this.lextrix.getLine(range.index);
    let delta = new ChangeSet().retain(range.index).delete(length);
    // @ts-expect-error Fix me later
    if (context.offset >= line.length() - 1) {
      const [next] = this.lextrix.getLine(range.index + 1);
      if (next) {
        // @ts-expect-error Fix me later
        const curFormats = line.formats();
        const nextFormats = this.lextrix.getFormat(range.index, 1);
        formats = ChangeAttributes.diff(curFormats, nextFormats) || {};
        if (Object.keys(formats).length > 0) {
          delta = delta.retain(next.length() - 1).retain(1, formats);
        }
      }
    }
    this.lextrix.updateContents(delta, Lextrix.sources.USER);
    this.lextrix.focus();
  }

  handleDeleteRange(range: Range) {
    deleteRange({ range, lextrix: this.lextrix });
    this.lextrix.focus();
  }

  handleEnter(range: Range, context: Context) {
    const lineFormats = Object.keys(context.format).reduce(
      (formats: Record<string, unknown>, format) => {
        if (
          this.lextrix.scroll.query(format, Scope.BLOCK) &&
          !Array.isArray(context.format[format])
        ) {
          formats[format] = context.format[format];
        }
        return formats;
      },
      {},
    );
    const delta = new ChangeSet()
      .retain(range.index)
      .delete(range.length)
      .insert('\n', lineFormats);
    this.lextrix.updateContents(delta, Lextrix.sources.USER);
    this.lextrix.setSelection(range.index + 1, Lextrix.sources.SILENT);
    this.lextrix.focus();
  }
}

const defaultOptions: KeyboardOptions = {
  bindings: {
    bold: makeFormatHandler('bold'),
    italic: makeFormatHandler('italic'),
    underline: makeFormatHandler('underline'),
    indent: {
      // highlight tab or tab at beginning of list, indent or blockquote
      key: 'Tab',
      format: ['blockquote', 'indent', 'list'],
      handler(range, context) {
        if (context.collapsed && context.offset !== 0) return true;
        this.lextrix.format('indent', '+1', Lextrix.sources.USER);
        return false;
      },
    },
    outdent: {
      key: 'Tab',
      shiftKey: true,
      format: ['blockquote', 'indent', 'list'],
      // highlight tab or tab at beginning of list, indent or blockquote
      handler(range, context) {
        if (context.collapsed && context.offset !== 0) return true;
        this.lextrix.format('indent', '-1', Lextrix.sources.USER);
        return false;
      },
    },
    'outdent backspace': {
      key: 'Backspace',
      collapsed: true,
      shiftKey: null,
      metaKey: null,
      ctrlKey: null,
      altKey: null,
      format: ['indent', 'list'],
      offset: 0,
      handler(range, context) {
        if (context.format.indent != null) {
          this.lextrix.format('indent', '-1', Lextrix.sources.USER);
        } else if (context.format.list != null) {
          this.lextrix.format('list', false, Lextrix.sources.USER);
        }
      },
    },
    'indent code-block': makeCodeBlockHandler(true),
    'outdent code-block': makeCodeBlockHandler(false),
    'remove tab': {
      key: 'Tab',
      shiftKey: true,
      collapsed: true,
      prefix: /\t$/,
      handler(range) {
        this.lextrix.deleteText(range.index - 1, 1, Lextrix.sources.USER);
      },
    },
    tab: {
      key: 'Tab',
      handler(range, context) {
        if (context.format.table) return true;
        this.lextrix.history.cutoff();
        const delta = new ChangeSet()
          .retain(range.index)
          .delete(range.length)
          .insert('\t');
        this.lextrix.updateContents(delta, Lextrix.sources.USER);
        this.lextrix.history.cutoff();
        this.lextrix.setSelection(range.index + 1, Lextrix.sources.SILENT);
        return false;
      },
    },
    'blockquote empty enter': {
      key: 'Enter',
      collapsed: true,
      format: ['blockquote'],
      empty: true,
      handler() {
        this.lextrix.format('blockquote', false, Lextrix.sources.USER);
      },
    },
    'list empty enter': {
      key: 'Enter',
      collapsed: true,
      format: ['list'],
      empty: true,
      handler(range, context) {
        const formats: Record<string, unknown> = { list: false };
        if (context.format.indent) {
          formats.indent = false;
        }
        this.lextrix.formatLine(
          range.index,
          range.length,
          formats,
          Lextrix.sources.USER,
        );
      },
    },
    'checklist enter': {
      key: 'Enter',
      collapsed: true,
      format: { list: 'checked' },
      handler(range) {
        const [line, offset] = this.lextrix.getLine(range.index);
        const formats = {
          // @ts-expect-error Fix me later
          ...line.formats(),
          list: 'checked',
        };
        const delta = new ChangeSet()
          .retain(range.index)
          .insert('\n', formats)
          // @ts-expect-error Fix me later
          .retain(line.length() - offset - 1)
          .retain(1, { list: 'unchecked' });
        this.lextrix.updateContents(delta, Lextrix.sources.USER);
        this.lextrix.setSelection(range.index + 1, Lextrix.sources.SILENT);
        this.lextrix.scrollSelectionIntoView();
      },
    },
    'header enter': {
      key: 'Enter',
      collapsed: true,
      format: ['header'],
      suffix: /^$/,
      handler(range, context) {
        const [line, offset] = this.lextrix.getLine(range.index);
        const delta = new ChangeSet()
          .retain(range.index)
          .insert('\n', context.format)
          // @ts-expect-error Fix me later
          .retain(line.length() - offset - 1)
          .retain(1, { header: null });
        this.lextrix.updateContents(delta, Lextrix.sources.USER);
        this.lextrix.setSelection(range.index + 1, Lextrix.sources.SILENT);
        this.lextrix.scrollSelectionIntoView();
      },
    },
    'table backspace': {
      key: 'Backspace',
      format: ['table'],
      collapsed: true,
      offset: 0,
      handler() {},
    },
    'table delete': {
      key: 'Delete',
      format: ['table'],
      collapsed: true,
      suffix: /^$/,
      handler() {},
    },
    'table enter': {
      key: 'Enter',
      shiftKey: null,
      format: ['table'],
      handler(range) {
        const module = this.lextrix.getModule('table');
        if (module) {
          // @ts-expect-error
          const [table, row, cell, offset] = module.getTable(range);
          const shift = tableSide(table, row, cell, offset);
          if (shift == null) return;
          let index = table.offset();
          if (shift < 0) {
            const delta = new ChangeSet().retain(index).insert('\n');
            this.lextrix.updateContents(delta, Lextrix.sources.USER);
            this.lextrix.setSelection(
              range.index + 1,
              range.length,
              Lextrix.sources.SILENT,
            );
          } else if (shift > 0) {
            index += table.length();
            const delta = new ChangeSet().retain(index).insert('\n');
            this.lextrix.updateContents(delta, Lextrix.sources.USER);
            this.lextrix.setSelection(index, Lextrix.sources.USER);
          }
        }
      },
    },
    'table tab': {
      key: 'Tab',
      shiftKey: null,
      format: ['table'],
      handler(range, context) {
        const { event, line: cell } = context;
        const offset = cell.offset(this.lextrix.scroll);
        if (event.shiftKey) {
          this.lextrix.setSelection(offset - 1, Lextrix.sources.USER);
        } else {
          this.lextrix.setSelection(offset + cell.length(), Lextrix.sources.USER);
        }
      },
    },
    'list autofill': {
      key: ' ',
      shiftKey: null,
      collapsed: true,
      format: {
        'code-block': false,
        blockquote: false,
        table: false,
      },
      prefix: /^\s*?(\d+\.|-|\*|\[ ?\]|\[x\])$/,
      handler(range, context) {
        if (this.lextrix.scroll.query('list') == null) return true;
        const { length } = context.prefix;
        const [line, offset] = this.lextrix.getLine(range.index);
        if (offset > length) return true;
        let value;
        switch (context.prefix.trim()) {
          case '[]':
          case '[ ]':
            value = 'unchecked';
            break;
          case '[x]':
            value = 'checked';
            break;
          case '-':
          case '*':
            value = 'bullet';
            break;
          default:
            value = 'ordered';
        }
        this.lextrix.insertText(range.index, ' ', Lextrix.sources.USER);
        this.lextrix.history.cutoff();
        const delta = new ChangeSet()
          .retain(range.index - offset)
          .delete(length + 1)
          // @ts-expect-error Fix me later
          .retain(line.length() - 2 - offset)
          .retain(1, { list: value });
        this.lextrix.updateContents(delta, Lextrix.sources.USER);
        this.lextrix.history.cutoff();
        this.lextrix.setSelection(range.index - length, Lextrix.sources.SILENT);
        return false;
      },
    },
    'code exit': {
      key: 'Enter',
      collapsed: true,
      format: ['code-block'],
      prefix: /^$/,
      suffix: /^\s*$/,
      handler(range) {
        const [line, offset] = this.lextrix.getLine(range.index);
        let numLines = 2;
        let cur = line;
        while (
          cur != null &&
          cur.length() <= 1 &&
          cur.formats()['code-block']
        ) {
          // @ts-expect-error
          cur = cur.prev;
          numLines -= 1;
          // Requisite prev lines are empty
          if (numLines <= 0) {
            const delta = new ChangeSet()
              // @ts-expect-error Fix me later
              .retain(range.index + line.length() - offset - 2)
              .retain(1, { 'code-block': null })
              .delete(1);
            this.lextrix.updateContents(delta, Lextrix.sources.USER);
            this.lextrix.setSelection(range.index - 1, Lextrix.sources.SILENT);
            return false;
          }
        }
        return true;
      },
    },
    'embed left': makeEmbedArrowHandler('ArrowLeft', false),
    'embed left shift': makeEmbedArrowHandler('ArrowLeft', true),
    'embed right': makeEmbedArrowHandler('ArrowRight', false),
    'embed right shift': makeEmbedArrowHandler('ArrowRight', true),
    'table down': makeTableArrowHandler(false),
    'table up': makeTableArrowHandler(true),
  },
};

Keyboard.DEFAULTS = defaultOptions;

function makeCodeBlockHandler(indent: boolean): BindingObject {
  return {
    key: 'Tab',
    shiftKey: !indent,
    format: { 'code-block': true },
    handler(range, { event }) {
      const CodeBlock = this.lextrix.scroll.query('code-block');
      // @ts-expect-error
      const { TAB } = CodeBlock;
      if (range.length === 0 && !event.shiftKey) {
        this.lextrix.insertText(range.index, TAB, Lextrix.sources.USER);
        this.lextrix.setSelection(range.index + TAB.length, Lextrix.sources.SILENT);
        return;
      }

      const lines =
        range.length === 0
          ? this.lextrix.getLines(range.index, 1)
          : this.lextrix.getLines(range);
      let { index, length } = range;
      lines.forEach((line, i) => {
        if (indent) {
          line.insertAt(0, TAB);
          if (i === 0) {
            index += TAB.length;
          } else {
            length += TAB.length;
          }
        } else if (line.domNode.textContent.startsWith(TAB)) {
          line.deleteAt(0, TAB.length);
          if (i === 0) {
            index -= TAB.length;
          } else {
            length -= TAB.length;
          }
        }
      });
      this.lextrix.update(Lextrix.sources.USER);
      this.lextrix.setSelection(index, length, Lextrix.sources.SILENT);
    },
  };
}

function makeEmbedArrowHandler(
  key: string,
  shiftKey: boolean | null,
): BindingObject {
  const where = key === 'ArrowLeft' ? 'prefix' : 'suffix';
  return {
    key,
    shiftKey,
    altKey: null,
    [where]: /^$/,
    handler(range) {
      let { index } = range;
      if (key === 'ArrowRight') {
        index += range.length + 1;
      }
      const [leaf] = this.lextrix.getLeaf(index);
      if (!(leaf instanceof EmbedBlot)) return true;
      if (key === 'ArrowLeft') {
        if (shiftKey) {
          this.lextrix.setSelection(
            range.index - 1,
            range.length + 1,
            Lextrix.sources.USER,
          );
        } else {
          this.lextrix.setSelection(range.index - 1, Lextrix.sources.USER);
        }
      } else if (shiftKey) {
        this.lextrix.setSelection(
          range.index,
          range.length + 1,
          Lextrix.sources.USER,
        );
      } else {
        this.lextrix.setSelection(
          range.index + range.length + 1,
          Lextrix.sources.USER,
        );
      }
      return false;
    },
  };
}

function makeFormatHandler(format: string): BindingObject {
  return {
    key: format[0],
    shortKey: true,
    handler(range, context) {
      this.lextrix.format(format, !context.format[format], Lextrix.sources.USER);
    },
  };
}

function makeTableArrowHandler(up: boolean): BindingObject {
  return {
    key: up ? 'ArrowUp' : 'ArrowDown',
    collapsed: true,
    format: ['table'],
    handler(range, context) {
      // TODO move to table module
      const key = up ? 'prev' : 'next';
      const cell = context.line;
      const targetRow = cell.parent[key];
      if (targetRow != null) {
        if (targetRow.statics.blotName === 'table-row') {
          // @ts-expect-error
          let targetCell = targetRow.children.head;
          let cur = cell;
          while (cur.prev != null) {
            // @ts-expect-error
            cur = cur.prev;
            targetCell = targetCell.next;
          }
          const index =
            targetCell.offset(this.lextrix.scroll) +
            Math.min(context.offset, targetCell.length() - 1);
          this.lextrix.setSelection(index, 0, Lextrix.sources.USER);
        }
      } else {
        // @ts-expect-error
        const targetLine = cell.table()[key];
        if (targetLine != null) {
          if (up) {
            this.lextrix.setSelection(
              targetLine.offset(this.lextrix.scroll) + targetLine.length() - 1,
              0,
              Lextrix.sources.USER,
            );
          } else {
            this.lextrix.setSelection(
              targetLine.offset(this.lextrix.scroll),
              0,
              Lextrix.sources.USER,
            );
          }
        }
      }
      return false;
    },
  };
}

function normalize(binding: Binding): BindingObject | null {
  if (typeof binding === 'string' || typeof binding === 'number') {
    binding = { key: binding };
  } else if (typeof binding === 'object') {
    binding = cloneDeep(binding);
  } else {
    return null;
  }
  if (binding.shortKey) {
    binding[SHORTKEY] = binding.shortKey;
    delete binding.shortKey;
  }
  return binding;
}

// TODO: Move into lextrix.ts or editor.ts
function deleteRange({ lextrix, range }: { lextrix: Lextrix; range: Range }) {
  const lines = lextrix.getLines(range);
  let formats = {};
  if (lines.length > 1) {
    const firstFormats = lines[0].formats();
    const lastFormats = lines[lines.length - 1].formats();
    formats = ChangeAttributes.diff(lastFormats, firstFormats) || {};
  }
  lextrix.deleteText(range, Lextrix.sources.USER);
  if (Object.keys(formats).length > 0) {
    lextrix.formatLine(range.index, 1, formats, Lextrix.sources.USER);
  }
  lextrix.setSelection(range.index, Lextrix.sources.SILENT);
}

function tableSide(_table: unknown, row: Blot, cell: Blot, offset: number) {
  if (row.prev == null && row.next == null) {
    if (cell.prev == null && cell.next == null) {
      return offset === 0 ? -1 : 1;
    }
    return cell.prev == null ? -1 : 1;
  }
  if (row.prev == null) {
    return -1;
  }
  if (row.next == null) {
    return 1;
  }
  return null;
}

export { Keyboard as default, SHORTKEY, normalize, deleteRange };
