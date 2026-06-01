import { LeafBlot, Scope } from 'lextrix-dom';
import type { Blot, EmbedBlot, ParentBlot } from 'lextrix-dom';
import ChangeSet, { ChangeAttributes, ChangeOp } from 'lextrix-change';
import { bubbleFormats } from './document-serializer.js';

export type RenderBlock =
  | {
      type: 'blockEmbed';
      attributes: ChangeAttributes;
      key: string;
      value: unknown;
    }
  | { type: 'block'; attributes: ChangeAttributes; changeSet: ChangeSet };

export interface DocumentContentHost {
  query(key: string, scope?: Scope): unknown;
  create(name: string, value?: unknown): Blot;
  insertBefore(blot: Blot, ref?: Blot | null): void;
  insertAt(index: number, value: string, def?: unknown): void;
  formatAt(index: number, length: number, name: string, value: unknown): void;
  descendant(criteria: unknown, index: number): [Blot | null, number];
  line(index: number): [unknown, number];
  length(): number;
  statics: { defaultChild: { blotName: string } };
  children: { find(index: number): [Blot | null, number] };
}

/** Parses change-set ops into renderable block segments. */
export function changeSetToRenderBlocks(
  scroll: DocumentContentHost,
  delta: ChangeSet,
): RenderBlock[] {
  const renderBlocks: RenderBlock[] = [];
  let currentBlockChangeSet = new ChangeSet();

  delta.forEach((op) => {
    const insert = op?.insert;
    if (!insert) return;

    if (typeof insert === 'string') {
      const splitted = insert.split('\n');
      splitted.slice(0, -1).forEach((text) => {
        currentBlockChangeSet.insert(text, op.attributes);
        renderBlocks.push({
          type: 'block',
          changeSet: currentBlockChangeSet,
          attributes: op.attributes ?? {},
        });
        currentBlockChangeSet = new ChangeSet();
      });
      const last = splitted[splitted.length - 1];
      if (last) {
        currentBlockChangeSet.insert(last, op.attributes);
      }
    } else {
      const key = Object.keys(insert)[0];
      if (!key) return;
      if (scroll.query(key, Scope.INLINE)) {
        currentBlockChangeSet.push(op);
      } else {
        if (currentBlockChangeSet.length()) {
          renderBlocks.push({
            type: 'block',
            changeSet: currentBlockChangeSet,
            attributes: {},
          });
        }
        currentBlockChangeSet = new ChangeSet();
        renderBlocks.push({
          type: 'blockEmbed',
          key,
          value: insert[key],
          attributes: op.attributes ?? {},
        });
      }
    }
  });

  if (currentBlockChangeSet.length()) {
    renderBlocks.push({
      type: 'block',
      changeSet: currentBlockChangeSet,
      attributes: {},
    });
  }

  return renderBlocks;
}

export function insertInlineContents(
  parent: ParentBlot,
  index: number,
  inlineContents: ChangeSet,
): number {
  return inlineContents.reduce((cursor, op) => {
    const length = ChangeOp.length(op);
    let attributes = op.attributes || {};
    if (op.insert != null) {
      if (typeof op.insert === 'string') {
        parent.insertAt(cursor, op.insert);
        const [leaf] = parent.descendant(LeafBlot, cursor);
        const formats = bubbleFormats(leaf);
        attributes = ChangeAttributes.diff(formats, attributes) || {};
      } else if (typeof op.insert === 'object') {
        const key = Object.keys(op.insert)[0];
        if (key == null) return cursor;
        parent.insertAt(cursor, key, op.insert[key]);
        if (parent.scroll.query(key, Scope.INLINE) != null) {
          const [leaf] = parent.descendant(LeafBlot, cursor);
          const formats = bubbleFormats(leaf);
          attributes = ChangeAttributes.diff(formats, attributes) || {};
        }
      }
    }
    Object.keys(attributes).forEach((name) => {
      parent.formatAt(cursor, length, name, attributes[name]);
    });
    return cursor + length;
  }, index);
}

export function createBlockFromAttributes(
  scroll: DocumentContentHost,
  attributes: ChangeAttributes,
  refBlot?: Blot,
): ParentBlot {
  let blotName: string | undefined;
  const formats: ChangeAttributes = {};

  Object.entries(attributes).forEach(([key, value]) => {
    if (scroll.query(key, Scope.BLOCK & Scope.BLOT) != null) {
      blotName = key;
    } else {
      formats[key] = value;
    }
  });

  const block = scroll.create(
    blotName || scroll.statics.defaultChild.blotName,
    blotName ? attributes[blotName] : undefined,
  ) as ParentBlot;

  scroll.insertBefore(block, refBlot || undefined);

  const length = block.length();
  Object.entries(formats).forEach(([key, value]) => {
    block.formatAt(0, length, key, value);
  });

  return block;
}

export function applyDocumentContents(
  scroll: DocumentContentHost & {
    batchStart(): void;
    batchEnd(): void;
    optimize(): void;
    descendant(type: unknown, index: number): [Blot | null, number];
  },
  index: number,
  delta: ChangeSet,
  deps: {
    BlockEmbed: new (...args: unknown[]) => EmbedBlot;
    bubbleFormats(line: unknown): Record<string, unknown>;
  },
): void {
  const renderBlocks = changeSetToRenderBlocks(
    scroll,
    delta.concat(new ChangeSet().insert('\n')),
  );
  const last = renderBlocks.pop();
  if (last == null) return;

  scroll.batchStart();

  const first = renderBlocks.shift();
  if (first) {
    const shouldInsertNewlineChar =
      first.type === 'block' &&
      (first.changeSet.length() === 0 ||
        (!scroll.descendant(deps.BlockEmbed, index)[0] && index < scroll.length()));
    const inlineDelta =
      first.type === 'block'
        ? first.changeSet
        : new ChangeSet().insert({ [first.key]: first.value });
    insertInlineContents(scroll as unknown as ParentBlot, index, inlineDelta);
    const newlineCharLength = first.type === 'block' ? 1 : 0;
    const lineEndIndex = index + inlineDelta.length() + newlineCharLength;
    if (shouldInsertNewlineChar) {
      scroll.insertAt(lineEndIndex - 1, '\n');
    }

    const formats = deps.bubbleFormats(scroll.line(index)[0]);
    const attrs = ChangeAttributes.diff(formats, first.attributes) || {};
    Object.keys(attrs).forEach((name) => {
      scroll.formatAt(lineEndIndex - 1, 1, name, attrs[name]);
    });

    index = lineEndIndex;
  }

  let [refBlot, refBlotOffset] = scroll.children.find(index);
  if (renderBlocks.length) {
    if (refBlot) {
      refBlot = refBlot.split(refBlotOffset);
      refBlotOffset = 0;
    }

    renderBlocks.forEach((renderBlock) => {
      if (renderBlock.type === 'block') {
        const block = createBlockFromAttributes(scroll, renderBlock.attributes, refBlot || undefined);
        insertInlineContents(block, 0, renderBlock.changeSet);
      } else {
        const blockEmbed = scroll.create(
          renderBlock.key,
          renderBlock.value,
        ) as EmbedBlot;
        scroll.insertBefore(blockEmbed, refBlot || undefined);
        Object.keys(renderBlock.attributes).forEach((name) => {
          blockEmbed.format(name, renderBlock.attributes[name]);
        });
      }
    });
  }

  if (last.type === 'block' && last.changeSet.length()) {
    const offset = refBlot
      ? refBlot.offset(refBlot.scroll) + refBlotOffset
      : scroll.length();
    insertInlineContents(scroll as unknown as ParentBlot, offset, last.changeSet);
  }

  scroll.batchEnd();
  scroll.optimize();
}
