import type { Blot } from '../blot/abstract/blot.js';
import DomBinding from '../binding/dom-binding.js';
import BlotDocumentNodeAdapter from '../document/blot-document-node-adapter.js';
import FormatController from '../format/format-controller.js';
import FormatDefinitionCatalog from '../format/format-definition.js';
import FormatMutationService from '../format/format-mutation-service.js';
import NodeFormatOps from '../format/node-format-ops.js';
import type { Parent, Root } from '../blot/abstract/blot.js';

/** Composed behavior for leaf/container document nodes (ShadowBlot delegate). */
export class ShadowNodeBehavior {
  static attach(blot: Blot): void {
    BlotDocumentNodeAdapter.syncDomNode(blot);
  }

  static detach(blot: Blot, binding: DomBinding): void {
    if (blot.parent != null) {
      blot.parent.removeChild(blot);
    }
    binding.release();
    BlotDocumentNodeAdapter.release(blot);
  }

  static deleteAt(blot: Blot, index: number, length: number): void {
    const target = ShadowNodeBehavior.isolate(blot, index, length);
    target.remove();
  }

  static formatAt(
    blot: Blot,
    scroll: Root,
    index: number,
    length: number,
    name: string,
    value: unknown,
  ): void {
    FormatController.formatAt(blot, scroll, index, length, name, value);
  }

  static insertAt(
    blot: Blot,
    scroll: Root,
    index: number,
    value: string,
    def?: unknown,
  ): void {
    NodeFormatOps.insertAt(blot, scroll, index, value, def);
  }

  static isolate(blot: Blot, index: number, length: number): Blot {
    const target = blot.split(index);
    if (target == null) {
      throw new Error('Attempt to isolate at end');
    }
    target.split(length);
    return target;
  }

  static optimize(blot: Blot, _context: Record<string, unknown>): void {
    NodeFormatOps.enforceRequiredContainer(blot);
    FormatDefinitionCatalog.runOptimize(blot, _context);
  }

  static remove(blot: Blot, binding: DomBinding): void {
    if (blot.domNode.parentNode != null) {
      blot.domNode.parentNode.removeChild(blot.domNode);
    }
    ShadowNodeBehavior.detach(blot, binding);
  }

  static replaceWith(
    blot: Blot,
    scroll: Root,
    name: string | Blot,
    value?: unknown,
  ): Blot {
    return FormatMutationService.replaceWith(blot, scroll, name, value);
  }

  static wrap(
    blot: Blot,
    scroll: Root,
    name: string | Parent,
    value?: unknown,
  ): Parent {
    return FormatMutationService.wrap(blot, scroll, name, value);
  }
}

export default ShadowNodeBehavior;
