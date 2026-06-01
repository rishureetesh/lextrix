/** Lextrix core — document editor shell. */
import { LeafBlot, Scope } from 'lextrix-dom';
import { cloneDeep, isEqual } from 'lodash-es';
import Emitter from './emitter.js';
import type { EmitterSource } from './emitter.js';
import logger from './logger.js';
import type Cursor from '../blots/cursor.js';
import type Scroll from '../blots/scroll.js';
import { DocumentIndexMapper } from './selection/document-index-mapper.js';
import { NativeSelectionBridge } from './selection/native-selection-bridge.js';
import type { NormalizedNativeRange } from './selection/types.js';

export type { Bounds } from './selection/types.js';

const debug = logger('lextrix:selection');

export class Range {
  constructor(
    public index: number,
    public length = 0,
  ) {}
}

class Selection {
  scroll: Scroll;
  emitter: Emitter;
  composing: boolean;
  mouseDown: boolean;

  root: HTMLElement;
  cursor: Cursor;
  savedRange: Range;
  lastRange: Range | null;
  lastNative: NormalizedNativeRange | null;
  private readonly nativeBridge: NativeSelectionBridge;
  private readonly indexMapper: DocumentIndexMapper;

  constructor(scroll: Scroll, emitter: Emitter) {
    this.emitter = emitter;
    this.scroll = scroll;
    this.composing = false;
    this.mouseDown = false;
    this.root = this.scroll.domNode;
    this.nativeBridge = new NativeSelectionBridge(this.root);
    this.indexMapper = new DocumentIndexMapper(this.scroll);
    // @ts-expect-error
    this.cursor = this.scroll.create('cursor', this);
    this.savedRange = new Range(0, 0);
    this.lastRange = this.savedRange;
    this.lastNative = null;
    this.handleComposition();
    this.handleDragging();
    this.emitter.listenDOM('selectionchange', document, () => {
      if (!this.mouseDown && !this.composing) {
        setTimeout(this.update.bind(this, Emitter.sources.USER), 1);
      }
    });
    this.emitter.on(Emitter.events.SCROLL_BEFORE_UPDATE, () => {
      if (!this.hasFocus()) return;
      const native = this.getNativeRange();
      if (native == null) return;
      if (native.start.node === this.cursor.textNode) return;
      this.emitter.once(
        Emitter.events.SCROLL_UPDATE,
        (source, mutations: MutationRecord[]) => {
          try {
            if (
              NativeSelectionBridge.contains(this.root, native.start.node) &&
              NativeSelectionBridge.contains(this.root, native.end.node)
            ) {
              this.setNativeRange(
                native.start.node,
                native.start.offset,
                native.end.node,
                native.end.offset,
              );
            }
            const triggeredByTyping = mutations.some(
              (mutation) =>
                mutation.type === 'characterData' ||
                mutation.type === 'childList' ||
                (mutation.type === 'attributes' &&
                  mutation.target === this.root),
            );
            this.update(triggeredByTyping ? Emitter.sources.SILENT : source);
          } catch {
            // ignore
          }
        },
      );
    });
    this.emitter.on(Emitter.events.SCROLL_OPTIMIZE, (mutations, context) => {
      if (context.range) {
        const { startNode, startOffset, endNode, endOffset } = context.range;
        this.setNativeRange(startNode, startOffset, endNode, endOffset);
        this.update(Emitter.sources.SILENT);
      }
    });
    this.update(Emitter.sources.SILENT);
  }

  handleComposition() {
    this.emitter.on(Emitter.events.COMPOSITION_BEFORE_START, () => {
      this.composing = true;
    });
    this.emitter.on(Emitter.events.COMPOSITION_END, () => {
      this.composing = false;
      if (this.cursor.parent) {
        const range = this.cursor.restore();
        if (!range) return;
        setTimeout(() => {
          this.setNativeRange(
            range.startNode,
            range.startOffset,
            range.endNode,
            range.endOffset,
          );
        }, 1);
      }
    });
  }

  handleDragging() {
    this.emitter.listenDOM('mousedown', document.body, () => {
      this.mouseDown = true;
    });
    this.emitter.listenDOM('mouseup', document.body, () => {
      this.mouseDown = false;
      this.update(Emitter.sources.USER);
    });
  }

  focus() {
    if (this.hasFocus()) return;
    this.root.focus({ preventScroll: true });
    this.setRange(this.savedRange);
  }

  format(format: string, value: unknown) {
    this.scroll.update();
    const nativeRange = this.getNativeRange();
    if (
      nativeRange == null ||
      !nativeRange.native.collapsed ||
      this.scroll.query(format, Scope.BLOCK)
    )
      return;
    if (nativeRange.start.node !== this.cursor.textNode) {
      const blot = this.scroll.find(nativeRange.start.node, false);
      if (blot == null) return;
      if (blot instanceof LeafBlot) {
        const after = blot.split(nativeRange.start.offset);
        blot.parent.insertBefore(this.cursor, after);
      } else {
        // @ts-expect-error TODO: nativeRange.start.node doesn't seem to match function signature
        blot.insertBefore(this.cursor, nativeRange.start.node);
      }
      this.cursor.attach();
    }
    this.cursor.format(format, value);
    this.scroll.optimize();
    this.setNativeRange(this.cursor.textNode, this.cursor.textNode.data.length);
    this.update();
  }

  getBounds(index: number, length = 0) {
    return this.indexMapper.getClientBounds(index, length);
  }

  getNativeRange(): NormalizedNativeRange | null {
    const range = this.nativeBridge.readContained();
    debug.info('getNativeRange', range);
    return range;
  }

  getRange(): [Range, NormalizedNativeRange] | [null, null] {
    const root = this.scroll.domNode;
    if ('isConnected' in root && !root.isConnected) {
      return [null, null];
    }
    const normalized = this.getNativeRange();
    if (normalized == null) return [null, null];
    const range = this.normalizedToRange(normalized);
    return [range, normalized];
  }

  hasFocus(): boolean {
    return this.nativeBridge.isEditorFocused();
  }

  normalizedToRange(range: NormalizedNativeRange) {
    const span = this.indexMapper.toDocumentSpan(range);
    return new Range(span.index, span.length);
  }

  normalizeNative(nativeRange: AbstractRange) {
    return this.nativeBridge.normalizeContained(nativeRange);
  }

  rangeToNative(range: Range): [Node | null, number, Node | null, number] {
    return this.indexMapper.toNativePositions(range);
  }

  setNativeRange(
    startNode: Node | null,
    startOffset?: number,
    endNode = startNode,
    endOffset = startOffset,
    force = false,
  ) {
    debug.info('setNativeRange', startNode, startOffset, endNode, endOffset);
    if (
      startNode != null &&
      (this.root.parentNode == null ||
        startNode.parentNode == null ||
        // @ts-expect-error Fix me later
        endNode.parentNode == null)
    ) {
      return;
    }
    if (startNode != null) {
      if (!this.hasFocus()) this.root.focus({ preventScroll: true });
      const { native } = this.getNativeRange() || {};
      if (
        native == null ||
        force ||
        startNode !== native.startContainer ||
        startOffset !== native.startOffset ||
        endNode !== native.endContainer ||
        endOffset !== native.endOffset
      ) {
        this.nativeBridge.write(
          startNode,
          startOffset!,
          endNode!,
          endOffset!,
        );
      }
    } else {
      this.nativeBridge.clear();
    }
  }

  setRange(range: Range | null, force: boolean, source?: EmitterSource): void;
  setRange(range: Range | null, source?: EmitterSource): void;
  setRange(
    range: Range | null,
    force: boolean | EmitterSource = false,
    source: EmitterSource = Emitter.sources.API,
  ): void {
    if (typeof force === 'string') {
      source = force;
      force = false;
    }
    debug.info('setRange', range);
    if (range != null) {
      const args = this.rangeToNative(range);
      this.setNativeRange(...args, force);
    } else {
      this.setNativeRange(null);
    }
    this.update(source);
  }

  update(source: EmitterSource = Emitter.sources.USER) {
    const oldRange = this.lastRange;
    const [lastRange, nativeRange] = this.getRange();
    this.lastRange = lastRange;
    this.lastNative = nativeRange;
    if (this.lastRange != null) {
      this.savedRange = this.lastRange;
    }
    if (!isEqual(oldRange, this.lastRange)) {
      if (
        !this.composing &&
        nativeRange != null &&
        nativeRange.native.collapsed &&
        nativeRange.start.node !== this.cursor.textNode
      ) {
        const range = this.cursor.restore();
        if (range) {
          this.setNativeRange(
            range.startNode,
            range.startOffset,
            range.endNode,
            range.endOffset,
          );
        }
      }
      const args = [
        Emitter.events.SELECTION_CHANGE,
        cloneDeep(this.lastRange),
        cloneDeep(oldRange),
        source,
      ];
      this.emitter.emit(Emitter.events.EDITOR_CHANGE, ...args);
      if (source !== Emitter.sources.SILENT) {
        this.emitter.emit(...args);
      }
    }
  }
}

export default Selection;
