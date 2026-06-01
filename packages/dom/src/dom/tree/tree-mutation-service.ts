import type { Blot, Parent } from '../blot/abstract/blot.js';
import ParentBlot from '../blot/abstract/parent.js';
import type NodeTree from './node-tree.js';

/** Structural mutations on a parent document node tree. */
export class TreeMutationService {
  constructor(private readonly tree: NodeTree) {}

  insertBefore(
    parent: Parent,
    childBlot: Blot,
    refBlot?: Blot | null,
  ): void {
    if (childBlot.parent != null) {
      childBlot.parent.children.remove(childBlot);
    }
    let refDomNode: Node | null = null;
    this.tree.insertBefore(childBlot, refBlot ?? null);
    childBlot.parent = parent;
    if (refBlot != null) {
      refDomNode = refBlot.domNode;
    }
    if (
      parent.domNode.parentNode !== childBlot.domNode ||
      parent.domNode.nextSibling !== refDomNode
    ) {
      parent.domNode.insertBefore(childBlot.domNode, refDomNode);
    }
    childBlot.attach();
  }

  removeChild(_parent: Parent, child: Blot): void {
    this.tree.remove(child);
  }

  moveChildren(
    source: Parent,
    target: Parent,
    refNode?: Blot | null,
  ): void {
    this.tree.forEach((child) => {
      target.insertBefore(child, refNode);
    });
  }

  split(parent: Parent, index: number, force = false): Blot | null {
    if (!force) {
      if (index === 0) return parent;
      if (index === parent.length()) return parent.next;
    }

    const after = parent.clone() as ParentBlot;
    if (parent.parent) {
      parent.parent.insertBefore(after, parent.next || undefined);
    }

    this.tree.forEachAt(index, parent.length(), (child, offset) => {
      const split = child.split(offset, force);
      if (split != null) {
        after.appendChild(split);
      }
    });

    return after;
  }

  splitAfter(parent: Parent, child: Blot): Parent {
    const after = parent.clone() as ParentBlot;
    while (child.next != null) {
      after.appendChild(child.next);
    }
    if (parent.parent) {
      parent.parent.insertBefore(after, parent.next || undefined);
    }
    return after;
  }

  unwrap(parent: Parent): void {
    if (parent.parent) {
      this.moveChildren(parent, parent.parent, parent.next || undefined);
    }
    parent.remove();
  }

  prepareReplaceWith(parent: Parent, replacement: Blot): void {
    if (replacement instanceof ParentBlot) {
      this.moveChildren(parent, replacement);
    }
  }
}

export default TreeMutationService;
