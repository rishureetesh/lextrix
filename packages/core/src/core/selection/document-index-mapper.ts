import { LeafBlot } from 'lextrix-dom';
import type Scroll from '../../blots/scroll.js';
import type { Bounds, DocumentSpan, NormalizedNativeRange } from './types.js';

/** Maps between flat document indices and DOM positions. */
export class DocumentIndexMapper {
  constructor(private readonly scroll: Scroll) {}

  normalizeIndex(index: number, source: string): number {
    if (source === 'api' || !this.scroll.domNode.isConnected) {
      return index;
    }
    return Math.max(0, Math.min(index, this.scroll.length() - 1));
  }

  toDocumentSpan(range: NormalizedNativeRange): DocumentSpan {
    const positions: [Node, number][] = [[range.start.node, range.start.offset]];
    if (!range.native.collapsed) {
      positions.push([range.end.node, range.end.offset]);
    }

    const indexes = positions.map(([node, offset]) => {
      const blot = this.scroll.find(node, true);
      if (blot == null) return 0;
      const base = blot.offset(this.scroll);
      if (offset === 0) return base;
      if (blot instanceof LeafBlot) {
        return base + blot.index(node, offset);
      }
      return base + blot.length();
    });

    const end = Math.min(Math.max(...indexes), this.scroll.length() - 1);
    const start = Math.min(end, ...indexes);
    return { index: start, length: end - start };
  }

  toNativePositions(span: DocumentSpan): [Node | null, number, Node | null, number] {
    const getPosition = (
      index: number,
      inclusive: boolean,
    ): [Node | null, number] => {
      index = this.normalizeIndex(index, 'user');
      const [leaf, leafOffset] = this.scroll.leaf(index);
      return leaf ? leaf.position(leafOffset, inclusive) : [null, -1];
    };
    return [
      ...getPosition(span.index, false),
      ...getPosition(span.index + span.length, true),
    ];
  }

  getClientBounds(index: number, length = 0): Bounds | null {
    const scrollLength = this.scroll.length();
    index = Math.min(index, scrollLength - 1);
    length = Math.min(index + length, scrollLength - 1) - index;
    let node: Node;
    let [leaf, offset] = this.scroll.leaf(index);
    if (leaf == null) return null;
    if (length > 0 && offset === leaf.length()) {
      const [next] = this.scroll.leaf(index + 1);
      if (next) {
        const [line] = this.scroll.line(index);
        const [nextLine] = this.scroll.line(index + 1);
        if (line === nextLine) {
          leaf = next;
          offset = 0;
        }
      }
    }
    [node, offset] = leaf.position(offset, true);
    const range = document.createRange();
    if (length > 0) {
      range.setStart(node, offset);
      [leaf, offset] = this.scroll.leaf(index + length);
      if (leaf == null) return null;
      [node, offset] = leaf.position(offset, true);
      range.setEnd(node, offset);
      return range.getBoundingClientRect();
    }
    let side: 'left' | 'right' = 'left';
    let rect: DOMRect;
    if (node instanceof Text) {
      if (!node.data.length) {
        return null;
      }
      if (offset < node.data.length) {
        range.setStart(node, offset);
        range.setEnd(node, offset + 1);
      } else {
        range.setStart(node, offset - 1);
        range.setEnd(node, offset);
        side = 'right';
      }
      rect = range.getBoundingClientRect();
    } else {
      if (!(leaf.domNode instanceof Element)) return null;
      rect = leaf.domNode.getBoundingClientRect();
      if (offset > 0) side = 'right';
    }
    return {
      bottom: rect.top + rect.height,
      height: rect.height,
      left: rect[side],
      right: rect[side],
      top: rect.top,
      width: rect.width,
    };
  }
}

export default DocumentIndexMapper;
