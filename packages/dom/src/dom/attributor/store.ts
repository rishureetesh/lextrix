import type { Formattable, Root } from '../blot/abstract/blot.js';
import Attributor from './attributor.js';
import FormatAttributeStore from './format-attribute-store.js';
import { FormatDefinitionCatalog } from '../format/format-definition.js';

/** Back-compat facade over FormatAttributeStore with scroll-based resolution. */
class AttributorStore {
  private readonly store: FormatAttributeStore;

  constructor(domNode: HTMLElement, scroll: Root) {
    this.store = new FormatAttributeStore(domNode, (name, scope) => {
      const fromCatalog = FormatDefinitionCatalog.resolveAttributor(name, scope);
      if (fromCatalog instanceof Attributor) {
        return fromCatalog;
      }
      const match = scroll.query(name, scope);
      return match instanceof Attributor ? match : null;
    });
  }

  public attribute(attribute: Attributor, value: unknown): void {
    this.store.apply(attribute, value);
  }

  public build(): void {
    this.store.rebuild();
  }

  public copy(target: Formattable): void {
    this.store.copyTo(target);
  }

  public move(target: Formattable): void {
    this.store.moveTo(target);
  }

  public values(): Record<string, unknown> {
    return this.store.values();
  }
}

export default AttributorStore;
