import type { Blot } from '../blot/abstract/blot.js';
import {
  createDocumentNodeId,
  DocumentNodeImpl,
  type DocumentNode,
} from './document-node.js';

const blotNodes = new WeakMap<Blot, DocumentNode>();
const nodeIds = new Map<string, Blot>();

/** Bridges public Blot instances to internal DocumentNode identity. */
export class BlotDocumentNodeAdapter {
  static forBlot(blot: Blot): DocumentNode {
    let node = blotNodes.get(blot);
    if (node == null) {
      node = new DocumentNodeImpl(createDocumentNodeId(), blot.domNode);
      blotNodes.set(blot, node);
      nodeIds.set(node.id, blot);
    } else if (node.domNode !== blot.domNode) {
      node.domNode = blot.domNode;
    }
    return node;
  }

  static blotFor(node: DocumentNode): Blot | null {
    return nodeIds.get(node.id) ?? null;
  }

  static release(blot: Blot): void {
    const node = blotNodes.get(blot);
    if (node) {
      nodeIds.delete(node.id);
      blotNodes.delete(blot);
    }
  }

  static syncDomNode(blot: Blot): void {
    const node = blotNodes.get(blot);
    if (node) {
      node.domNode = blot.domNode;
    }
  }
}

export default BlotDocumentNodeAdapter;
