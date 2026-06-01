/** Lextrix core — document editor shell. */
import { cloneDeep } from 'lodash-es';
import { LeafBlot } from 'lextrix-dom';
import ChangeSet from 'lextrix-change';
import Block, { BlockEmbed, bubbleFormats } from '../blots/block.js';
import Break from '../blots/break.js';
import type Scroll from '../blots/scroll.js';
import { Range } from './selection.js';
import { ChangeApplier, normalizeIncomingChange } from './change-applier/index.js';
import {
  serializeNodeHtml,
} from './html-serializer/index.js';
import { syncChangeSet } from './change-sync/index.js';

type SelectionInfo = {
  newRange: Range;
  oldRange: Range;
};

class Editor {
  scroll: Scroll;
  changeSet: ChangeSet;
  private readonly changeApplier: ChangeApplier;

  constructor(scroll: Scroll) {
    this.scroll = scroll;
    this.changeSet = this.getChangeSet();
    this.changeApplier = new ChangeApplier(scroll);
  }

  applyChangeSet(delta: ChangeSet): ChangeSet {
    const normalizedChangeSet = this.changeApplier.apply(delta);
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
        return serializeNodeHtml(line, lineOffset, length, true);
      }
      return serializeNodeHtml(this.scroll, index, length, true);
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
    const normalizedChangeSet = normalizeIncomingChange(contents);
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
    const result = syncChangeSet(
      this.scroll,
      oldChangeSet,
      change,
      mutations,
      selectionInfo,
    );

    if (result.mode === 'typing') {
      this.changeSet = oldChangeSet.compose(result.change);
      return result.change;
    }

    this.changeSet = result.cached;
    return result.change;
  }
}

export default Editor;

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
