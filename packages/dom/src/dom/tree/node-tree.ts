import LinkedList from '../collection/linked-list.js';
import type { Blot } from '../blot/abstract/blot.js';

/** Owns ordered child sequence for a parent document node. */
export class NodeTree {
  constructor(public readonly children: LinkedList<Blot> = new LinkedList()) {}

  get length(): number {
    return this.children.length;
  }

  contentLength(): number {
    return this.children.reduce((sum, child) => sum + child.length(), 0);
  }

  find(index: number, inclusive = false): [Blot | null, number] {
    return this.children.find(index, inclusive);
  }

  forEachAt(
    index: number,
    length: number,
    callback: (child: Blot, offset: number, span: number) => void,
  ): void {
    this.children.forEachAt(index, length, callback);
  }

  insertBefore(child: Blot, ref: Blot | null): void {
    this.children.insertBefore(child, ref);
  }

  remove(child: Blot): void {
    this.children.remove(child);
  }

  offset(target: Blot): number {
    return this.children.offset(target);
  }

  forEach(callback: (child: Blot) => void): void {
    this.children.forEach(callback);
  }
}

export default NodeTree;
