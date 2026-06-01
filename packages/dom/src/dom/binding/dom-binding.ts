import { nodeBindings } from '../node-bindings.js';
import type { Blot } from '../blot/abstract/blot.js';

/** Owns DOM node ↔ document node binding lifecycle. */
export class DomBinding {
  constructor(
    private readonly domNode: Node,
    owner: Blot,
  ) {
    nodeBindings.set(domNode, owner);
  }

  release(): void {
    nodeBindings.delete(this.domNode);
  }

  static lookup(node: Node | null): Blot | null {
    if (node == null) return null;
    return nodeBindings.get(node) ?? null;
  }
}

export default DomBinding;
