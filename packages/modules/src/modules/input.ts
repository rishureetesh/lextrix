/** Lextrix modules — editor behavior modules. */
import ChangeSet from 'lextrix-change';
import Module from 'lextrix-core/core/module.js';
import Lextrix from 'lextrix-core';
import type { Range } from 'lextrix-core/core/selection.js';
import { deleteRange } from './keyboard.js';

const INSERT_TYPES = ['insertText', 'insertReplacementText'];

class Input extends Module {
  constructor(lextrix: Lextrix, options: Record<string, never>) {
    super(lextrix, options);

    lextrix.root.addEventListener('beforeinput', (event) => {
      this.handleBeforeInput(event);
    });

    lextrix.root.addEventListener('input', () => {
      this.handleInput();
    });

    // Gboard with English input on Android triggers `compositionstart` sometimes even
    // users are not going to type anything.
    if (!/Android/i.test(navigator.userAgent)) {
      lextrix.on(Lextrix.events.COMPOSITION_BEFORE_START, () => {
        this.handleCompositionStart();
      });
    }
  }

  private deleteRange(range: Range) {
    deleteRange({ range, lextrix: this.lextrix });
  }

  private replaceText(range: Range, text = '') {
    if (range.length === 0) return false;

    if (text) {
      // Follow the native behavior that inherits the formats of the first character
      const formats = this.lextrix.getFormat(range.index, 1);
      this.deleteRange(range);
      this.lextrix.updateContents(
        new ChangeSet().retain(range.index).insert(text, formats),
        Lextrix.sources.USER,
      );
    } else {
      this.deleteRange(range);
    }

    this.lextrix.setSelection(range.index + text.length, 0, Lextrix.sources.SILENT);
    return true;
  }

  private handleInput() {
    if (this.lextrix.composition.isComposing) return;
    const { cursor } = this.lextrix.selection;
    if (!cursor.parent) return;
    const range = cursor.restore();
    if (range) {
      this.lextrix.selection.setNativeRange(
        range.startNode,
        range.startOffset,
        range.endNode,
        range.endOffset,
      );
    }
  }

  private handleBeforeInput(event: InputEvent) {
    if (
      this.lextrix.composition.isComposing ||
      event.defaultPrevented ||
      !INSERT_TYPES.includes(event.inputType)
    ) {
      return;
    }

    const staticRange = event.getTargetRanges
      ? event.getTargetRanges()[0]
      : null;
    if (!staticRange || staticRange.collapsed === true) {
      return;
    }

    const text = getPlainTextFromInputEvent(event);
    if (text == null) {
      return;
    }
    const normalized = this.lextrix.selection.normalizeNative(staticRange);
    const range = normalized
      ? this.lextrix.selection.normalizedToRange(normalized)
      : null;
    if (range && this.replaceText(range, text)) {
      event.preventDefault();
    }
  }

  private handleCompositionStart() {
    const range = this.lextrix.getSelection();
    if (range) {
      this.replaceText(range);
    }
  }
}

function getPlainTextFromInputEvent(event: InputEvent) {
  // When `inputType` is "insertText":
  // - `event.data` should be string (Safari uses `event.dataTransfer`).
  // - `event.dataTransfer` should be null.
  // When `inputType` is "insertReplacementText":
  // - `event.data` should be null.
  // - `event.dataTransfer` should contain "text/plain" data.

  if (typeof event.data === 'string') {
    return event.data;
  }
  if (event.dataTransfer?.types.includes('text/plain')) {
    return event.dataTransfer.getData('text/plain');
  }
  return null;
}

export default Input;
