/** Lextrix core — document editor shell. */
import { EmbedBlot, InlineBlot } from 'lextrix-dom';
import type { BlotConstructor } from 'lextrix-dom';
import {
  DEFAULT_INLINE_ORDER,
  defaultInlineNesting,
} from '../core/document/inline-nesting.js';
import Break from './break.js';
import Text from './text.js';

class Inline extends InlineBlot {
  static allowedChildren: BlotConstructor[] = [Inline, Break, EmbedBlot, Text];
  static order = [...DEFAULT_INLINE_ORDER];

  static compare(self: string, other: string) {
    return defaultInlineNesting.compare(self, other);
  }

  formatAt(index: number, length: number, name: string, value: unknown) {
    if (
      defaultInlineNesting.shouldWrapBeforeFormat(
        this.statics.blotName,
        name,
        this.scroll,
      )
    ) {
      const blot = this.isolate(index, length);
      if (value) {
        blot.wrap(name, value);
      }
    } else {
      super.formatAt(index, length, name, value);
    }
  }

  optimize(context: { [key: string]: any }) {
    super.optimize(context);
    if (
      this.parent instanceof Inline &&
      defaultInlineNesting.shouldReorderUnderParent(
        this.statics.blotName,
        this.parent.statics.blotName,
      )
    ) {
      const parent = this.parent.isolate(this.offset(), this.length());
      // @ts-expect-error TODO: make isolate generic
      this.moveChildren(parent);
      parent.wrap(this);
    }
  }
}

export default Inline;
