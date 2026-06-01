import type { Formattable } from '../blot/abstract/blot.js';
import { findBoundNode } from '../node-bindings.js';
import Scope from '../scope.js';
import Attributor from './attributor.js';
import ClassAttributor from './class.js';
import StyleAttributor from './style.js';

type AttributeResolver = (
  name: string,
  scope: Scope,
) => Attributor | null | undefined;

/**
 * Tracks active format attributes on a DOM element.
 * Uses injected resolver instead of static Registry.find.
 */
export class FormatAttributeStore {
  private attributes: Record<string, Attributor> = {};

  constructor(
    private readonly domNode: HTMLElement,
    private readonly resolve: AttributeResolver,
  ) {
    this.rebuild();
  }

  apply(attribute: Attributor, value: unknown): void {
    if (value) {
      if (attribute.add(this.domNode, value)) {
        if (attribute.value(this.domNode) != null) {
          this.attributes[attribute.attrName] = attribute;
        } else {
          delete this.attributes[attribute.attrName];
        }
      }
    } else {
      attribute.remove(this.domNode);
      delete this.attributes[attribute.attrName];
    }
  }

  rebuild(): void {
    this.attributes = {};
    const owner = findBoundNode(this.domNode, false);
    if (owner == null) return;

    const keys = [
      ...Attributor.keys(this.domNode),
      ...ClassAttributor.keys(this.domNode),
      ...StyleAttributor.keys(this.domNode),
    ];

    for (const name of keys) {
      const attr = this.resolve(name, Scope.ATTRIBUTE);
      if (attr instanceof Attributor) {
        this.attributes[attr.attrName] = attr;
      }
    }
  }

  copyTo(target: Formattable): void {
    for (const key of Object.keys(this.attributes)) {
      target.format(key, this.attributes[key].value(this.domNode));
    }
  }

  moveTo(target: Formattable): void {
    this.copyTo(target);
    for (const key of Object.keys(this.attributes)) {
      this.attributes[key].remove(this.domNode);
    }
    this.attributes = {};
  }

  values(): Record<string, unknown> {
    return Object.keys(this.attributes).reduce<Record<string, unknown>>(
      (acc, name) => {
        acc[name] = this.attributes[name].value(this.domNode);
        return acc;
      },
      {},
    );
  }
}

export default FormatAttributeStore;
