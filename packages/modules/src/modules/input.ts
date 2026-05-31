/** Lextron modules — editor behavior modules. */
import ChangeSet from 'lextron-change';
import Module from 'lextron-core/core/module.js';
import Lextron from 'lextron-core';
import type { Range } from 'lextron-core/core/selection.js';
import { deleteRange } from './keyboard.js';

const INSERT_TYPES = ['insertText', 'insertReplacementText'];

class Input extends Module {
  constructor(lextron: Lextron, options: Record<string, never>) {
    super(lextron, options);

    lextron.root.addEventListener('beforeinput', (event) => {
      this.handleBeforeInput(event);
    });

    // Gboard with English input on Android triggers `compositionstart` sometimes even
    // users are not going to type anything.
    if (!/Android/i.test(navigator.userAgent)) {
      lextron.on(Lextron.events.COMPOSITION_BEFORE_START, () => {
        this.handleCompositionStart();
      });
    }
  }

  private deleteRange(range: Range) {
    deleteRange({ range, lextron: this.lextron });
  }

  private replaceText(range: Range, text = '') {
    if (range.length === 0) return false;

    if (text) {
      // Follow the native behavior that inherits the formats of the first character
      const formats = this.lextron.getFormat(range.index, 1);
      this.deleteRange(range);
      this.lextron.updateContents(
        new ChangeSet().retain(range.index).insert(text, formats),
        Lextron.sources.USER,
      );
    } else {
      this.deleteRange(range);
    }

    this.lextron.setSelection(range.index + text.length, 0, Lextron.sources.SILENT);
    return true;
  }

  private handleBeforeInput(event: InputEvent) {
    if (
      this.lextron.composition.isComposing ||
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
    const normalized = this.lextron.selection.normalizeNative(staticRange);
    const range = normalized
      ? this.lextron.selection.normalizedToRange(normalized)
      : null;
    if (range && this.replaceText(range, text)) {
      event.preventDefault();
    }
  }

  private handleCompositionStart() {
    const range = this.lextron.getSelection();
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
