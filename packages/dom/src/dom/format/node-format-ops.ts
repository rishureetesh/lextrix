import Scope from '../scope.js';
import type {
  Blot,
  Formattable,
  Parent,
  Root,
} from '../blot/abstract/blot.js';
import DomError from '../error.js';

/** Formatting and structural operations delegated from document nodes. */
export class NodeFormatOps {
  static deleteAt(node: Blot, index: number, length: number): void {
    const target = node.isolate(index, length);
    target.remove();
  }

  static formatAt(
    node: Blot,
    scroll: Root,
    index: number,
    length: number,
    name: string,
    value: unknown,
  ): void {
    const blot = node.isolate(index, length);
    if (scroll.query(name, Scope.BLOT) != null && value) {
      blot.wrap(name, value);
    } else if (scroll.query(name, Scope.ATTRIBUTE) != null) {
      const parent = scroll.create(node.statics.scope) as Parent & Formattable;
      blot.wrap(parent);
      parent.format(name, value);
    }
  }

  static insertAt(
    node: Blot,
    scroll: Root,
    index: number,
    value: string,
    def?: unknown,
  ): void {
    const blot =
      def == null ? scroll.create('text', value) : scroll.create(value, def);
    const ref = node.split(index);
    node.parent.insertBefore(blot, ref || undefined);
  }

  static replaceWith(
    node: Blot,
    scroll: Root,
    name: string | Blot,
    value?: unknown,
  ): Blot {
    const replacement =
      typeof name === 'string' ? scroll.create(name, value) : name;
    if (node.parent != null) {
      node.parent.insertBefore(replacement, node.next || undefined);
      node.remove();
    }
    return replacement;
  }

  static enforceRequiredContainer(node: Blot): void {
    const required = node.statics.requiredContainer;
    if (required && !(node.parent instanceof required)) {
      node.wrap(required.blotName);
    }
  }

  static wrap(node: Blot, scroll: Root, name: string | Parent, value?: unknown): Parent {
    const wrapper =
      typeof name === 'string'
        ? (scroll.create(name, value) as Parent)
        : name;
    if (node.parent != null) {
      node.parent.insertBefore(wrapper, node.next || undefined);
    }
    if (typeof wrapper.appendChild !== 'function') {
      throw new DomError(`Cannot wrap ${String(name)}`);
    }
    wrapper.appendChild(node);
    return wrapper;
  }
}

export default NodeFormatOps;
