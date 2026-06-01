import type { Blot, Parent } from '../blot/abstract/blot.js';
import ParentBlot from '../blot/abstract/parent.js';

const MAX_OPTIMIZE_ITERATIONS = 100;

export interface MutationCoordinatorContext {
  [key: string]: unknown;
  mutationsMap?: WeakMap<Node, MutationRecord[]>;
}

/** Coordinates mutation-observer reconcile passes for the scroll root. */
export class MutationCoordinator {
  optimizeTree(
    root: Parent,
    mutations: MutationRecord[],
    context: MutationCoordinatorContext = {},
  ): void {
    ParentBlot.prototype.optimize.call(root, context);

    const mutationsMap = context.mutationsMap || new WeakMap();
    let records = Array.from(
      (root as unknown as { observer: MutationObserver }).observer?.takeRecords?.() ??
        [],
    );
    while (records.length > 0) {
      mutations.push(records.pop()!);
    }

    const mark = (blot: Blot | null, markParent = true): void => {
      if (blot == null || blot === root) return;
      if (blot.domNode.parentNode == null) return;
      if (!mutationsMap.has(blot.domNode)) {
        mutationsMap.set(blot.domNode, []);
      }
      if (markParent) mark(blot.parent);
    };

    const walk = (blot: Blot): void => {
      if (!mutationsMap.has(blot.domNode)) return;
      if (blot instanceof ParentBlot) {
        blot.children.forEach(walk);
      }
      mutationsMap.delete(blot.domNode);
      blot.optimize(context);
    };

    let remaining = mutations;
    for (let i = 0; remaining.length > 0; i += 1) {
      if (i >= MAX_OPTIMIZE_ITERATIONS) {
        throw new Error('[Lextrix Dom] Maximum optimize iterations reached');
      }
      remaining.forEach((mutation) => {
        const scroll = root as unknown as {
          find(node: Node, bubble?: boolean): Blot | null;
        };
        const blot = scroll.find(mutation.target, true);
        if (blot == null) return;
        if (blot.domNode === mutation.target) {
          if (mutation.type === 'childList') {
            mark(scroll.find(mutation.previousSibling as Node, false));
            Array.from(mutation.addedNodes).forEach((node) => {
              const child = scroll.find(node, false);
              mark(child, false);
              if (child instanceof ParentBlot) {
                child.children.forEach((grandChild) => mark(grandChild, false));
              }
            });
          } else if (mutation.type === 'attributes') {
            mark(blot.prev);
          }
        }
        mark(blot);
      });
      root.children.forEach(walk);
      remaining = Array.from(
        (root as unknown as { observer: MutationObserver }).observer?.takeRecords?.() ??
          [],
      );
      records = remaining.slice();
      while (records.length > 0) {
        mutations.push(records.pop()!);
      }
    }
  }
}

export default MutationCoordinator;
