import type { Blot, Parent, Root } from '../blot/abstract/blot.js';
import NodeFormatOps from './node-format-ops.js';

/** Structural format mutations: wrap, unwrap, replace. */
export class FormatMutationService {
  static wrap(
    node: Blot,
    scroll: Root,
    name: string | Parent,
    value?: unknown,
  ): Parent {
    return NodeFormatOps.wrap(node, scroll, name, value);
  }

  static replaceWith(
    node: Blot,
    scroll: Root,
    name: string | Blot,
    value?: unknown,
  ): Blot {
    return NodeFormatOps.replaceWith(node, scroll, name, value);
  }

  static unwrap(parent: Parent, treeMutation: { unwrap(): void }): void {
    treeMutation.unwrap();
  }
}

export default FormatMutationService;
