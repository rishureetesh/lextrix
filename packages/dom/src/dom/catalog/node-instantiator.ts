import type { Blot, Root } from '../blot/abstract/blot.js';
import type { BlotConstructor } from '../blot/abstract/blot.js';
import DomError from '../error.js';
import { nodeBindings } from '../node-bindings.js';
import type { RegistryDefinition } from '../registry-types.js';

/** Creates live document nodes from registry definitions. */
export class NodeInstantiator {
  create(scroll: Root, definition: RegistryDefinition, input: Node | string, value?: unknown): Blot {
    const blotClass = definition as BlotConstructor;
    const node =
      typeof input === 'string'
        ? blotClass.create(value)
        : typeof input === 'object' && input !== null
          ? input
          : blotClass.create(value);

    const blot = new blotClass(scroll, node as Node, value);
    nodeBindings.set(blot.domNode, blot);
    return blot;
  }

  createFromQuery(
    scroll: Root,
    definition: RegistryDefinition | null,
    input: Node | string,
    value?: unknown,
  ): Blot {
    if (definition == null) {
      throw new DomError(`Unable to create ${String(input)} blot`);
    }
    return this.create(scroll, definition, input, value);
  }
}
