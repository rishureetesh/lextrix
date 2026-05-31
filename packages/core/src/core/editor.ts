/** Lextron core — document editor shell. */
import { cloneDeep, isEqual, merge } from 'lodash-es';
import { LeafBlot, EmbedBlot, Scope, ParentBlot } from 'lextron-dom';
import type { Blot } from 'lextron-dom';
import ChangeSet, { ChangeAttributes, ChangeOp } from 'lextron-change';
import Block, { BlockEmbed, bubbleFormats } from '../blots/block.js';
import Break from '../blots/break.js';
import CursorBlot from '../blots/cursor.js';
import type Scroll from '../blots/scroll.js';
import TextBlot, { escapeText } from '../blots/text.js';
import { Range } from './selection.js';

const ASCII = /^[ -~]*$/;

type SelectionInfo = {
  newRange: Range;
  oldRange: Range;
};

class Editor {
  scroll: Scroll;
  changeSet: ChangeSet;

  constructor(scroll: Scroll) {
    this.scroll = scroll;
    this.changeSet = this.getChangeSet();
  }

  applyChangeSet(delta: ChangeSet): ChangeSet {
    this.scroll.update();
    let scrollLength = this.scroll.length();
    this.scroll.batchStart();
    const normalizedChangeSet = normalizeChangeSet(delta);
    const deleteChangeSet = new ChangeSet();
    const normalizedOps = splitOpLines(normalizedChangeSet.ops.slice());
    normalizedOps.reduce((index, op) => {
      const length = ChangeOp.length(op);
      let attributes = op.attributes || {};
      let isImplicitNewlinePrepended = false;
      let isImplicitNewlineAppended = false;
      if (op.insert != null) {
        deleteChangeSet.retain(length);
        if (typeof op.insert === 'string') {
          const text = op.insert;
          isImplicitNewlineAppended =
            !text.endsWith('\n') &&
            (scrollLength <= index ||
              !!this.scroll.descendant(BlockEmbed, index)[0]);
          this.scroll.insertAt(index, text);
          const [line, offset] = this.scroll.line(index);
          let formats = merge({}, bubbleFormats(line));
          if (line instanceof Block) {
            const [leaf] = line.descendant(LeafBlot, offset);
            if (leaf) {
              formats = merge(formats, bubbleFormats(leaf));
            }
          }
          attributes = ChangeAttributes.diff(formats, attributes) || {};
        } else if (typeof op.insert === 'object') {
          const key = Object.keys(op.insert)[0]; // There should only be one key
          if (key == null) return index;
          const isInlineEmbed = this.scroll.query(key, Scope.INLINE) != null;
          if (isInlineEmbed) {
            if (
              scrollLength <= index ||
              !!this.scroll.descendant(BlockEmbed, index)[0]
            ) {
              isImplicitNewlineAppended = true;
            }
          } else if (index > 0) {
            const [leaf, offset] = this.scroll.descendant(LeafBlot, index - 1);
            if (leaf instanceof TextBlot) {
              const text = leaf.value();
              if (text[offset] !== '\n') {
                isImplicitNewlinePrepended = true;
              }
            } else if (
              leaf instanceof EmbedBlot &&
              leaf.statics.scope === Scope.INLINE_BLOT
            ) {
              isImplicitNewlinePrepended = true;
            }
          }
          this.scroll.insertAt(index, key, op.insert[key]);

          if (isInlineEmbed) {
            const [leaf] = this.scroll.descendant(LeafBlot, index);
            if (leaf) {
              const formats = merge({}, bubbleFormats(leaf));
              attributes = ChangeAttributes.diff(formats, attributes) || {};
            }
          }
        }
        scrollLength += length;
      } else {
        deleteChangeSet.push(op);

        if (op.retain !== null && typeof op.retain === 'object') {
          const key = Object.keys(op.retain)[0];
          if (key == null) return index;
          this.scroll.updateEmbedAt(index, key, op.retain[key]);
        }
      }
      Object.keys(attributes).forEach((name) => {
        this.scroll.formatAt(index, length, name, attributes[name]);
      });
      const prependedLength = isImplicitNewlinePrepended ? 1 : 0;
      const addedLength = isImplicitNewlineAppended ? 1 : 0;
      scrollLength += prependedLength + addedLength;
      deleteChangeSet.retain(prependedLength);
      deleteChangeSet.delete(addedLength);
      return index + length + prependedLength + addedLength;
    }, 0);
    deleteChangeSet.reduce((index, op) => {
      if (typeof op.delete === 'number') {
        this.scroll.deleteAt(index, op.delete);
        return index;
      }
      return index + ChangeOp.length(op);
    }, 0);
    this.scroll.batchEnd();
    this.scroll.optimize();
    return this.update(normalizedChangeSet);
  }

  deleteText(index: number, length: number): ChangeSet {
    this.scroll.deleteAt(index, length);
    return this.update(new ChangeSet().retain(index).delete(length));
  }

  formatLine(
    index: number,
    length: number,
    formats: Record<string, unknown> = {},
  ): ChangeSet {
    this.scroll.update();
    Object.keys(formats).forEach((format) => {
      this.scroll.lines(index, Math.max(length, 1)).forEach((line) => {
        line.format(format, formats[format]);
      });
    });
    this.scroll.optimize();
    const delta = new ChangeSet().retain(index).retain(length, cloneDeep(formats));
    return this.update(delta);
  }

  formatText(
    index: number,
    length: number,
    formats: Record<string, unknown> = {},
  ): ChangeSet {
    Object.keys(formats).forEach((format) => {
      this.scroll.formatAt(index, length, format, formats[format]);
    });
    const delta = new ChangeSet().retain(index).retain(length, cloneDeep(formats));
    return this.update(delta);
  }

  getContents(index: number, length: number): ChangeSet {
    return this.changeSet.slice(index, index + length);
  }

  getChangeSet(): ChangeSet {
    return this.scroll.lines().reduce((delta, line) => {
      return delta.concat(line.changeSet());
    }, new ChangeSet());
  }

  getFormat(index: number, length = 0): Record<string, unknown> {
    let lines: (Block | BlockEmbed)[] = [];
    let leaves: LeafBlot[] = [];
    if (length === 0) {
      this.scroll.path(index).forEach((path) => {
        const [blot] = path;
        if (blot instanceof Block) {
          lines.push(blot);
        } else if (blot instanceof LeafBlot) {
          leaves.push(blot);
        }
      });
    } else {
      lines = this.scroll.lines(index, length);
      leaves = this.scroll.descendants(LeafBlot, index, length);
    }
    const [lineFormats, leafFormats] = [lines, leaves].map((blots) => {
      const blot = blots.shift();
      if (blot == null) return {};
      let formats = bubbleFormats(blot);
      while (Object.keys(formats).length > 0) {
        const blot = blots.shift();
        if (blot == null) return formats;
        formats = combineFormats(bubbleFormats(blot), formats);
      }
      return formats;
    });
    return { ...lineFormats, ...leafFormats };
  }

  getHTML(index: number, length: number): string {
    const [line, lineOffset] = this.scroll.line(index);
    if (line) {
      const lineLength = line.length();
      const isWithinLine = line.length() >= lineOffset + length;
      if (isWithinLine && !(lineOffset === 0 && length === lineLength)) {
        return convertHTML(line, lineOffset, length, true);
      }
      return convertHTML(this.scroll, index, length, true);
    }
    return '';
  }

  getText(index: number, length: number): string {
    return this.getContents(index, length)
      .filter((op) => typeof op.insert === 'string')
      .map((op) => op.insert)
      .join('');
  }

  insertContents(index: number, contents: ChangeSet): ChangeSet {
    const normalizedChangeSet = normalizeChangeSet(contents);
    const change = new ChangeSet().retain(index).concat(normalizedChangeSet);
    this.scroll.insertContents(index, normalizedChangeSet);
    return this.update(change);
  }

  insertEmbed(index: number, embed: string, value: unknown): ChangeSet {
    this.scroll.insertAt(index, embed, value);
    return this.update(new ChangeSet().retain(index).insert({ [embed]: value }));
  }

  insertText(
    index: number,
    text: string,
    formats: Record<string, unknown> = {},
  ): ChangeSet {
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    this.scroll.insertAt(index, text);
    Object.keys(formats).forEach((format) => {
      this.scroll.formatAt(index, text.length, format, formats[format]);
    });
    return this.update(
      new ChangeSet().retain(index).insert(text, cloneDeep(formats)),
    );
  }

  isBlank(): boolean {
    if (this.scroll.children.length === 0) return true;
    if (this.scroll.children.length > 1) return false;
    const blot = this.scroll.children.head;
    if (blot?.statics.blotName !== Block.blotName) return false;
    const block = blot as Block;
    if (block.children.length > 1) return false;
    return block.children.head instanceof Break;
  }

  removeFormat(index: number, length: number): ChangeSet {
    const text = this.getText(index, length);
    const [line, offset] = this.scroll.line(index + length);
    let suffixLength = 0;
    let suffix = new ChangeSet();
    if (line != null) {
      suffixLength = line.length() - offset;
      suffix = line
        .changeSet()
        .slice(offset, offset + suffixLength - 1)
        .insert('\n');
    }
    const contents = this.getContents(index, length + suffixLength);
    const diff = contents.diff(new ChangeSet().insert(text).concat(suffix));
    const delta = new ChangeSet().retain(index).concat(diff);
    return this.applyChangeSet(delta);
  }

  update(
    change: ChangeSet | null,
    mutations: MutationRecord[] = [],
    selectionInfo: SelectionInfo | undefined = undefined,
  ): ChangeSet {
    const oldChangeSet = this.changeSet;
    if (
      mutations.length === 1 &&
      mutations[0].type === 'characterData' &&
      // @ts-expect-error Fix me later
      mutations[0].target.data.match(ASCII) &&
      this.scroll.find(mutations[0].target)
    ) {
      // Optimization for character changes
      const textBlot = this.scroll.find(mutations[0].target) as Blot;
      const formats = bubbleFormats(textBlot);
      const index = textBlot.offset(this.scroll);
      // @ts-expect-error Fix me later
      const oldValue = mutations[0].oldValue.replace(CursorBlot.CONTENTS, '');
      const oldText = new ChangeSet().insert(oldValue);
      // @ts-expect-error
      const newText = new ChangeSet().insert(textBlot.value());
      const relativeSelectionInfo = selectionInfo && {
        oldRange: shiftRange(selectionInfo.oldRange, -index),
        newRange: shiftRange(selectionInfo.newRange, -index),
      };
      const diffChangeSet = new ChangeSet()
        .retain(index)
        .concat(oldText.diff(newText, relativeSelectionInfo));
      change = diffChangeSet.reduce((delta, op) => {
        if (op.insert) {
          return delta.insert(op.insert, formats);
        }
        return delta.push(op);
      }, new ChangeSet());
      this.changeSet = oldChangeSet.compose(change);
    } else {
      this.changeSet = this.getChangeSet();
      if (!change || !isEqual(oldChangeSet.compose(change), this.changeSet)) {
        change = oldChangeSet.diff(this.changeSet, selectionInfo);
      }
    }
    return change;
  }
}

interface ListItem {
  child: Blot;
  offset: number;
  length: number;
  indent: number;
  type: string;
}
function convertListHTML(
  items: ListItem[],
  lastIndent: number,
  types: string[],
): string {
  if (items.length === 0) {
    const [endTag] = getListType(types.pop());
    if (lastIndent <= 0) {
      return `</li></${endTag}>`;
    }
    return `</li></${endTag}>${convertListHTML([], lastIndent - 1, types)}`;
  }
  const [{ child, offset, length, indent, type }, ...rest] = items;
  const [tag, attribute] = getListType(type);
  if (indent > lastIndent) {
    types.push(type);
    if (indent === lastIndent + 1) {
      return `<${tag}><li${attribute}>${convertHTML(
        child,
        offset,
        length,
      )}${convertListHTML(rest, indent, types)}`;
    }
    return `<${tag}><li>${convertListHTML(items, lastIndent + 1, types)}`;
  }
  const previousType = types[types.length - 1];
  if (indent === lastIndent && type === previousType) {
    return `</li><li${attribute}>${convertHTML(
      child,
      offset,
      length,
    )}${convertListHTML(rest, indent, types)}`;
  }
  const [endTag] = getListType(types.pop());
  return `</li></${endTag}>${convertListHTML(items, lastIndent - 1, types)}`;
}

function convertHTML(
  blot: Blot,
  index: number,
  length: number,
  isRoot = false,
): string {
  if ('html' in blot && typeof blot.html === 'function') {
    return blot.html(index, length);
  }
  if (blot instanceof TextBlot) {
    const escapedText = escapeText(blot.value().slice(index, index + length));
    return escapedText.replaceAll(' ', '&nbsp;');
  }
  if (blot instanceof ParentBlot) {
    // TODO fix API
    if (blot.statics.blotName === 'list-container') {
      const items: any[] = [];
      blot.children.forEachAt(index, length, (child, offset, childLength) => {
        const formats =
          'formats' in child && typeof child.formats === 'function'
            ? child.formats()
            : {};
        items.push({
          child,
          offset,
          length: childLength,
          indent: formats.indent || 0,
          type: formats.list,
        });
      });
      return convertListHTML(items, -1, []);
    }
    const parts: string[] = [];
    blot.children.forEachAt(index, length, (child, offset, childLength) => {
      parts.push(convertHTML(child, offset, childLength));
    });
    if (isRoot || blot.statics.blotName === 'list') {
      return parts.join('');
    }
    const { outerHTML, innerHTML } = blot.domNode as Element;
    const [start, end] = outerHTML.split(`>${innerHTML}<`);
    // TODO cleanup
    if (start === '<table') {
      return `<table style="border: 1px solid #000;">${parts.join('')}<${end}`;
    }
    return `${start}>${parts.join('')}<${end}`;
  }
  return blot.domNode instanceof Element ? blot.domNode.outerHTML : '';
}

function combineFormats(
  formats: Record<string, unknown>,
  combined: Record<string, unknown>,
): Record<string, unknown> {
  return Object.keys(combined).reduce(
    (merged, name) => {
      if (formats[name] == null) return merged;
      const combinedValue = combined[name];
      if (combinedValue === formats[name]) {
        merged[name] = combinedValue;
      } else if (Array.isArray(combinedValue)) {
        if (combinedValue.indexOf(formats[name]) < 0) {
          merged[name] = combinedValue.concat([formats[name]]);
        } else {
          // If style already exists, don't add to an array, but don't lose other styles
          merged[name] = combinedValue;
        }
      } else {
        merged[name] = [combinedValue, formats[name]];
      }
      return merged;
    },
    {} as Record<string, unknown>,
  );
}

function getListType(type: string | undefined) {
  const tag = type === 'ordered' ? 'ol' : 'ul';
  switch (type) {
    case 'checked':
      return [tag, ' data-list="checked"'];
    case 'unchecked':
      return [tag, ' data-list="unchecked"'];
    default:
      return [tag, ''];
  }
}

function normalizeChangeSet(delta: ChangeSet) {
  return delta.reduce((normalizedChangeSet, op) => {
    if (typeof op.insert === 'string') {
      const text = op.insert.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      return normalizedChangeSet.insert(text, op.attributes);
    }
    return normalizedChangeSet.push(op);
  }, new ChangeSet());
}

function shiftRange({ index, length }: Range, amount: number) {
  return new Range(index + amount, length);
}

function splitOpLines(ops: ChangeOp[]) {
  const split: ChangeOp[] = [];
  ops.forEach((op) => {
    if (typeof op.insert === 'string') {
      const lines = op.insert.split('\n');
      lines.forEach((line, index) => {
        if (index) split.push({ insert: '\n', attributes: op.attributes });
        if (line) split.push({ insert: line, attributes: op.attributes });
      });
    } else {
      split.push(op);
    }
  });

  return split;
}

export default Editor;
