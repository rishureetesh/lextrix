import type { NormalizedNativeRange } from './types.js';

/** Bridges browser Selection API to editor-internal range shape. */
export class NativeSelectionBridge {
  constructor(private readonly root: HTMLElement) {}

  static contains(parent: Node, descendant: Node): boolean {
    try {
      // Firefox inserts inaccessible nodes around video elements
      descendant.parentNode; // eslint-disable-line @typescript-eslint/no-unused-expressions
    } catch {
      return false;
    }
    return parent.contains(descendant);
  }

  isEditorFocused(activeElement: Element | null = document.activeElement): boolean {
    return (
      activeElement === this.root ||
      (activeElement != null && NativeSelectionBridge.contains(this.root, activeElement))
    );
  }

  read(): NormalizedNativeRange | null {
    const selection = document.getSelection();
    if (selection == null || selection.rangeCount <= 0) return null;
    const nativeRange = selection.getRangeAt(0);
    if (nativeRange == null) return null;
    return this.normalize(nativeRange);
  }

  /** Reads native selection and validates it lies within the editor root. */
  readContained(): NormalizedNativeRange | null {
    const range = this.read();
    if (range == null) return null;
    if (!NativeSelectionBridge.contains(this.root, range.native.startContainer)) {
      return null;
    }
    if (
      !range.native.collapsed &&
      !NativeSelectionBridge.contains(this.root, range.native.endContainer)
    ) {
      return null;
    }
    return this.collapseElementBoundaries(range);
  }

  write(
    startNode: Node,
    startOffset: number,
    endNode: Node = startNode,
    endOffset: number = startOffset,
  ): void {
    const selection = document.getSelection();
    if (selection == null) return;
    if (
      startNode != null &&
      this.root.contains(startNode) &&
      endNode != null &&
      this.root.contains(endNode)
    ) {
      const [start, startOff] = NativeSelectionBridge.normalizeBrBoundary(
        startNode,
        startOffset,
      );
      const [end, endOff] = NativeSelectionBridge.normalizeBrBoundary(
        endNode,
        endOffset,
      );
      const range = document.createRange();
      range.setStart(start, startOff);
      range.setEnd(end, endOff);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  clear(): void {
    const selection = document.getSelection();
    selection?.removeAllRanges();
    this.root.blur();
  }

  normalize(nativeRange: AbstractRange): NormalizedNativeRange | null {
    if (!this.root.contains(nativeRange.startContainer)) {
      return null;
    }
    const range: NormalizedNativeRange = {
      start: {
        node: nativeRange.startContainer,
        offset: nativeRange.startOffset,
      },
      end: {
        node: nativeRange.endContainer,
        offset: nativeRange.endOffset,
      },
      native: nativeRange,
    };
    return this.collapseElementBoundaries(range);
  }

  /** Normalizes an external native range and validates editor containment. */
  normalizeContained(nativeRange: AbstractRange): NormalizedNativeRange | null {
    const bridged = this.normalize(nativeRange);
    if (bridged == null) return null;
    if (!NativeSelectionBridge.contains(this.root, nativeRange.startContainer)) {
      return null;
    }
    if (
      !nativeRange.collapsed &&
      !NativeSelectionBridge.contains(this.root, nativeRange.endContainer)
    ) {
      return null;
    }
    return this.collapseElementBoundaries(bridged);
  }

  /** Descend into element boundaries until text or leaf embed positions. */
  collapseElementBoundaries(
    range: NormalizedNativeRange,
  ): NormalizedNativeRange {
    for (const position of [range.start, range.end]) {
      let { node, offset } = position;
      while (!(node instanceof Text) && node.childNodes.length > 0) {
        if (node.childNodes.length > offset) {
          node = node.childNodes[offset]!;
          offset = 0;
        } else if (node.childNodes.length === offset) {
          node = node.lastChild!;
          if (node instanceof Text) {
            offset = node.data.length;
          } else if (node.childNodes.length > 0) {
            offset = node.childNodes.length;
          } else {
            offset = node.childNodes.length + 1;
          }
        } else {
          break;
        }
      }
      position.node = node;
      position.offset = offset;
    }
    return range;
  }

  private static normalizeBrBoundary(
    node: Node,
    offset: number,
  ): [Node, number] {
    if (node instanceof Element && node.tagName === 'BR') {
      const parent = node.parentNode;
      if (parent == null) {
        return [node, offset];
      }
      return [parent, Array.from(parent.childNodes).indexOf(node)];
    }
    return [node, offset];
  }
}

export default NativeSelectionBridge;
