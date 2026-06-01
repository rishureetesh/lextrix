import type { Blot } from './blot/abstract/blot.js';

/** Maps DOM nodes to their document node instances. */
export const nodeBindings = new WeakMap<Node, Blot>();

export function findBoundNode(node?: Node | null, bubble = false): Blot | null {
  if (node == null) {
    return null;
  }
  if (nodeBindings.has(node)) {
    return nodeBindings.get(node) || null;
  }
  if (bubble) {
    let parentNode: Node | null = null;
    try {
      parentNode = node.parentNode;
    } catch {
      return null;
    }
    return findBoundNode(parentNode, bubble);
  }
  return null;
}
