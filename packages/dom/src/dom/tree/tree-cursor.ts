import type { Blot, BlotConstructor, Parent } from '../blot/abstract/blot.js';
import ParentBlot from '../blot/abstract/parent.js';
import type NodeTree from './node-tree.js';

type Criteria<T extends Blot> =
  | (new (...args: any[]) => T)
  | ((blot: Blot) => boolean);

function matches(criteria: Criteria<Blot>, child: Blot): boolean {
  if (typeof criteria === 'function') {
    const ctor = criteria as BlotConstructor;
    if (ctor.blotName != null) {
      return child instanceof ctor;
    }
    return (criteria as (blot: Blot) => boolean)(child);
  }
  return child instanceof criteria;
}

function callDescendant(
  child: ParentBlot,
  criteria: Criteria<Blot>,
  offset: number,
): [Blot | null, number] {
  if (typeof criteria === 'function') {
    const ctor = criteria as BlotConstructor;
    if (ctor.blotName != null) {
      return child.descendant(ctor as new (...args: any[]) => Blot, offset);
    }
    return child.descendant(criteria as (blot: Blot) => boolean, offset);
  }
  return child.descendant(criteria, offset);
}

function callDescendants(
  child: ParentBlot,
  criteria: Criteria<Blot>,
  childIndex: number,
  lengthLeft: number,
): Blot[] {
  if (typeof criteria === 'function') {
    const ctor = criteria as BlotConstructor;
    if (ctor.blotName != null) {
      return child.descendants(ctor as new (...args: any[]) => Blot, childIndex, lengthLeft);
    }
    return child.descendants(criteria as (blot: Blot) => boolean, childIndex, lengthLeft);
  }
  return child.descendants(criteria, childIndex, lengthLeft);
}

/** Read-only tree traversal over a NodeTree. */
export class TreeCursor {
  constructor(private readonly tree: NodeTree) {}

  descendant<T extends Blot>(
    parent: Parent,
    criteria: new (...args: any[]) => T,
    index: number,
  ): [T | null, number];
  descendant(
    parent: Parent,
    criteria: (blot: Blot) => boolean,
    index: number,
  ): [Blot | null, number];
  descendant(
    parent: Parent,
    criteria: Criteria<Blot>,
    index = 0,
  ): [Blot | null, number] {
    const [child, offset] = this.tree.find(index);
    if (child && matches(criteria, child)) {
      return [child as Blot, offset];
    }
    if (child instanceof ParentBlot) {
      return callDescendant(child, criteria, offset);
    }
    return [null, -1];
  }

  descendants(
    parent: Parent,
    criteria: Criteria<Blot>,
    index = 0,
    length: number = Number.MAX_VALUE,
  ): Blot[] {
    let descendants: Blot[] = [];
    let lengthLeft = length;

    this.tree.forEachAt(
      index,
      length,
      (child: Blot, childIndex: number, childLength: number) => {
        if (matches(criteria, child)) {
          descendants.push(child);
        }
        if (child instanceof ParentBlot) {
          descendants = descendants.concat(
            callDescendants(child, criteria, childIndex, lengthLeft),
          );
        }
        lengthLeft -= childLength;
      },
    );

    return descendants;
  }

  path(parent: Parent, index: number, inclusive = false): [Blot, number][] {
    const [child, offset] = this.tree.find(index, inclusive);
    const position: [Blot, number][] = [[parent, index]];
    if (child instanceof ParentBlot) {
      return position.concat(child.path(offset, inclusive));
    }
    if (child != null) {
      position.push([child, offset]);
    }
    return position;
  }
}

export default TreeCursor;
