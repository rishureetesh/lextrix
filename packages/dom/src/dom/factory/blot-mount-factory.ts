import DomError from '../error.js';
import Scope from '../scope.js';
import type { Blot, Parent, Root } from '../blot/abstract/blot.js';

/** Attaches DOM nodes to the document tree when building or reconciling. */
export class BlotMountFactory {
  static attachNode(node: Node, scroll: Root): Blot {
    const found = scroll.find(node);
    if (found) return found;

    try {
      return scroll.create(node);
    } catch (e) {
      if (!(e instanceof DomError)) throw e;
      const blot = scroll.create(Scope.INLINE) as Parent;
      Array.from(node.childNodes).forEach((child) => {
        blot.domNode.appendChild(child);
      });
      if (node.parentNode) {
        node.parentNode.replaceChild(blot.domNode, node);
      }
      blot.attach();
      return blot;
    }
  }
}

export default BlotMountFactory;
