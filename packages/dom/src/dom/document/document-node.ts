/** Primary internal identity for a document tree node. */
export interface DocumentNode {
  readonly id: string;
  domNode: Node | null;
}

let nodeCounter = 0;

export function createDocumentNodeId(prefix = 'lxt-node'): string {
  nodeCounter += 1;
  return `${prefix}-${nodeCounter}`;
}

export class DocumentNodeImpl implements DocumentNode {
  constructor(
    public readonly id: string,
    public domNode: Node | null,
  ) {}
}

export default DocumentNode;
