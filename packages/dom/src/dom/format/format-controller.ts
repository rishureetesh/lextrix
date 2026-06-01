import type { Blot, Formattable, Root } from '../blot/abstract/blot.js';
import NodeFormatOps from '../format/node-format-ops.js';
import Scope from '../scope.js';

/** Blot-level formatting operations (delegates to NodeFormatOps). */
export class FormatController {
  static formatAt(
    node: Blot,
    scroll: Root,
    index: number,
    length: number,
    name: string,
    value: unknown,
  ): void {
    NodeFormatOps.formatAt(node, scroll, index, length, name, value);
  }

  static format(
    target: Formattable,
    scroll: Root,
    name: string,
    value: unknown,
  ): void {
    const attr = scroll.query(name, Scope.ATTRIBUTE);
    if (attr == null) return;
    target.format(name, value);
  }
}

export default FormatController;
