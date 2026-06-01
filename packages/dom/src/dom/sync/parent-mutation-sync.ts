import BlotMountFactory from '../factory/blot-mount-factory.js';
import type { Blot, Parent, Root } from '../blot/abstract/blot.js';

/** Reconciles DOM childList mutations against the document child order. */
export class ParentMutationSync {
  reconcile(
    parent: Parent,
    mutations: MutationRecord[],
    scroll: Root,
    uiNode: Node | null = null,
  ): void {
    const addedNodes: Node[] = [];
    const removedNodes: Node[] = [];

    for (const mutation of mutations) {
      if (mutation.target === parent.domNode && mutation.type === 'childList') {
        addedNodes.push(...Array.from(mutation.addedNodes));
        removedNodes.push(...Array.from(mutation.removedNodes));
      }
    }

    for (const node of removedNodes) {
      if (
        node.parentNode != null &&
        (node as HTMLElement).tagName !== 'IFRAME' &&
        document.body.compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_CONTAINED_BY
      ) {
        continue;
      }
      const blot = scroll.find(node);
      if (blot == null) continue;
      if (
        blot.domNode.parentNode == null ||
        blot.domNode.parentNode === parent.domNode
      ) {
        blot.detach();
      }
    }

    addedNodes
      .filter((node) => node.parentNode === parent.domNode && node !== uiNode)
      .sort((a, b) => {
        if (a === b) return 0;
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
          ? -1
          : 1;
      })
      .forEach((node) => {
        let refBlot: Blot | null = null;
        if (node.nextSibling != null) {
          refBlot = scroll.find(node.nextSibling);
        }
        const blot = BlotMountFactory.attachNode(node, scroll);
        if (blot.next !== refBlot || blot.next == null) {
          if (blot.parent != null) {
            blot.parent.removeChild(blot);
          }
          parent.insertBefore(blot, refBlot || undefined);
        }
      });
  }
}

export default ParentMutationSync;
