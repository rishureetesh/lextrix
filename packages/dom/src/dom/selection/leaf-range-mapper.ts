import type { Leaf } from '../blot/abstract/blot.js';

/** Maps DOM selection ranges to indices within leaf document nodes. */
export class LeafRangeMapper {
  static index(leaf: Leaf, node: Node, offset: number): number {
    if (
      leaf.domNode === node ||
      leaf.domNode.compareDocumentPosition(node) &
        Node.DOCUMENT_POSITION_CONTAINED_BY
    ) {
      return Math.min(offset, 1);
    }
    return -1;
  }

  static position(
    leaf: Leaf,
    index: number,
    _inclusive?: boolean,
  ): [Node, number] {
    const childNodes = Array.from(leaf.parent.domNode.childNodes);
    let offset = childNodes.indexOf(leaf.domNode as ChildNode);
    if (index > 0) offset += 1;
    return [leaf.parent.domNode, offset];
  }
}

export default LeafRangeMapper;
